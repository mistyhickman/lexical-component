/**
 * ToolbarPlugin.jsx - The formatting toolbar with all the buttons
 *
 * This file demonstrates several advanced React concepts:
 * - Multiple useState hooks for tracking button states
 * - useEffect for setting up event listeners
 * - useCallback for optimized function references
 * - useRef for accessing DOM elements directly
 * - Event handlers and user interactions
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import styled from '@emotion/styled';

// Lexical commands - These are like "actions" you can send to the editor
// Commands follow a pattern: you dispatch (send) them and the editor responds
import {
  FORMAT_TEXT_COMMAND, // Bold, italic, underline, etc.
  FORMAT_ELEMENT_COMMAND, // Alignment (left, center, right, justify)
  UNDO_COMMAND, // Undo last action
  REDO_COMMAND, // Redo last undone action
  INDENT_CONTENT_COMMAND, // Increase indent
  OUTDENT_CONTENT_COMMAND, // Decrease indent
  $getSelection, // Get current text selection
  $isRangeSelection, // Check if selection is a text range
  $createParagraphNode, // Create paragraph node
  $getRoot, // Get root node of editor
  $selectAll, // Select all content in editor
  $isElementNode, // Check if node is an element
  $isDecoratorNode, // Check if node is a decorator
} from 'lexical';


// List-related commands and utilities
import {
  INSERT_UNORDERED_LIST_COMMAND, // Create bullet list
  INSERT_ORDERED_LIST_COMMAND, // Create numbered list
  INSERT_CHECK_LIST_COMMAND, // Create check list
  REMOVE_LIST_COMMAND, // Remove list formatting
  insertList,
  $isListNode, // Check if node is a list
} from '@lexical/list';

// Link-related utilities
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';

// Selection utilities
import { $isParentElementRTL, $wrapNodes, $isAtNodeEnd } from '@lexical/selection';

// General utilities
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';

// HTML generation for source view
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';

// Rich text node creators
import {
  $createQuoteNode, // Create blockquote nodes
  HeadingTagType
} from '@lexical/rich-text';

// Custom format nodes (address, pre, div, attributed heading)
import { $createAddressNode, $createPreformattedNode, $createDivNode, $createAttributedHeadingNode } from './CustomFormatNodes';

// More selection utilities
import { $setBlocksType, $patchStyleText } from '@lexical/selection';

// Horizontal rule (line separator)
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

// Table utilities
import TableCreatorPlugin from './TableCreatorPlugin';

// Source code view plugin
import SourceCodePlugin from './SourceCodePlugin';

// HTML cleanup and style-extraction utilities
import { cleanExportedHtml, extractAndStripStyles, scopeStylesForEditor } from './LexicalEditor';
import { sanitizeHtml, sanitizeStyleHtml } from './sanitize';

// Footnote dialog
import { FootnoteDialog } from './FootnotesPlugin';

// Color picker
import ColorPickerPlugin from './ColorPickerPlugin';



/**
 * LowPriority constant - Used for command priority
 * When multiple listeners exist for a command, lower numbers run first
 * 1 is a low priority (runs last)
 */
const LowPriority = 1;

/**
 * Ensures keyboard focus is always visible on toolbar buttons and dropdowns.
 * WCAG 2.4.7 (Focus Visible) — without this, host-page CSS resets (e.g.
 * "* { outline: none }") suppress the browser default outline so users cannot
 * see where keyboard focus is.  We use :focus-visible so mouse users are not
 * affected by the outline.
 */
const ToolbarWrapper = styled.div`
  & button:focus-visible,
  & select:focus-visible {
    outline: 2px solid #005fcc;
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

// ─── Alignment dropdown data ──────────────────────────────────────────────────

const ALIGN_OPTIONS = [
  {
    key: 'alignleft',
    label: 'Align Left',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="15" height="2" rx="1"/>
        <rect x="0" y="4" width="9"  height="2" rx="1"/>
        <rect x="0" y="9" width="12" height="2" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'aligncenter',
    label: 'Align Center',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="15" height="2" rx="1"/>
        <rect x="3" y="4" width="9"  height="2" rx="1"/>
        <rect x="2" y="9" width="11" height="2" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'alignright',
    label: 'Align Right',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="15" height="2" rx="1"/>
        <rect x="6" y="4" width="9"  height="2" rx="1"/>
        <rect x="3" y="9" width="12" height="2" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'alignjustify',
    label: 'Align Justify',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="15" height="2" rx="1"/>
        <rect x="0" y="4" width="15" height="2" rx="1"/>
        <rect x="0" y="9" width="15" height="2" rx="1"/>
      </svg>
    ),
  },
];

/**
 * AlignDropdown - Compact dropdown that replaces the four individual alignment
 * buttons. Shows an SVG icon + label for each option that is present in tools.
 */
function AlignDropdown({ tools, onAlignLeft, onAlignCenter, onAlignRight, onAlignJustify, buttonStyle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const panelRef = useRef(null);

  const handlers = {
    alignleft:   onAlignLeft,
    aligncenter: onAlignCenter,
    alignright:  onAlignRight,
    alignjustify: onAlignJustify,
  };

  const visibleOptions = ALIGN_OPTIONS.filter(opt => tools.includes(opt.key));

  // Close when the user clicks outside the dropdown
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Focus first menuitem when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector('[role="menuitem"]')?.focus();
      });
    }
  }, [open]);

  const handlePanelKeyDown = (e) => {
    const items = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); triggerBtnRef.current?.focus(); }
  };

  if (visibleOptions.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...buttonStyle, gap: '4px' }}
        title="Text Alignment"
        aria-label="Text Alignment"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Show the left-align icon as the default visual cue */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
          <rect x="0" y="0" width="15" height="2" rx="1"/>
          <rect x="0" y="4" width="9"  height="2" rx="1"/>
          <rect x="0" y="9" width="12" height="2" rx="1"/>
        </svg>
        <span style={{ fontSize: '10px', lineHeight: 1 }} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Text Alignment"
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '3px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '150px',
          }}
        >
          {visibleOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              onClick={() => { handlers[opt.key](); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── List-type dropdown data ───────────────────────────────────────────────────

const LIST_OPTIONS = [
  {
    key: 'bullist',
    label: 'Bullet List',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="1.5" r="1.5"/>
        <rect x="5" y="0"  width="10" height="2" rx="1"/>
        <circle cx="2" cy="5.5" r="1.5"/>
        <rect x="5" y="4"  width="7"  height="2" rx="1"/>
        <circle cx="2" cy="9.5" r="1.5"/>
        <rect x="5" y="8"  width="9"  height="2" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'numlist',
    label: 'Numbered List',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="3.5" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="5" y="0.5" width="10" height="2" rx="1"/>
        <rect x="0" y="4" width="3.5" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="5" y="4.5" width="7"  height="2" rx="1"/>
        <rect x="0" y="8" width="3.5" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="5" y="8.5" width="9"  height="2" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'checklist',
    label: 'Check List',
    icon: (
      <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0"  width="3.5" height="3" rx="0.5"/>
        <polyline points="0.5,1.5 1.5,2.5 3,0.5" fill="none" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="5" y="0.5" width="10" height="2" rx="1"/>
        <rect x="0" y="4"  width="3.5" height="3" rx="0.5" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="5" y="4.5" width="7"  height="2" rx="1"/>
        <rect x="0" y="8"  width="3.5" height="3" rx="0.5"/>
        <polyline points="0.5,9.5 1.5,10.5 3,8.5" fill="none" stroke="white" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="5" y="8.5" width="9"  height="2" rx="1"/>
      </svg>
    ),
  },
];

/**
 * ListDropdown - Compact dropdown that replaces the three individual list-type
 * buttons. Shows an SVG icon + label for each option present in tools.
 */
function ListDropdown({ tools, onBulletList, onNumberList, onCheckList, buttonStyle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const panelRef = useRef(null);

  const handlers = {
    bullist:   onBulletList,
    numlist:   onNumberList,
    checklist: onCheckList,
  };

  const visibleOptions = LIST_OPTIONS.filter(opt => tools.includes(opt.key));

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Focus first menuitem when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector('[role="menuitem"]')?.focus();
      });
    }
  }, [open]);

  const handlePanelKeyDown = (e) => {
    const items = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); triggerBtnRef.current?.focus(); }
  };

  if (visibleOptions.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerBtnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...buttonStyle, gap: '4px' }}
        title="List Type"
        aria-label="List Type"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Bullet-list icon as the default visual cue */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="1.5" r="1.5"/>
          <rect x="5" y="0"  width="10" height="2" rx="1"/>
          <circle cx="2" cy="5.5" r="1.5"/>
          <rect x="5" y="4"  width="7"  height="2" rx="1"/>
          <circle cx="2" cy="9.5" r="1.5"/>
          <rect x="5" y="8"  width="9"  height="2" rx="1"/>
        </svg>
        <span style={{ fontSize: '10px', lineHeight: 1 }} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="List Type"
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '3px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '160px',
          }}
        >
          {visibleOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              onClick={() => { handlers[opt.key](); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Clipboard dropdown data ───────────────────────────────────────────────────

const CLIPBOARD_OPTIONS = [
  {
    key: 'cut',
    label: 'Cut',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
        <circle cx="3" cy="11" r="2.2"/>
        <circle cx="3" cy="3"  r="2.2"/>
        <line x1="4.8" y1="9.6"  x2="13" y2="1.5"/>
        <line x1="4.8" y1="4.4"  x2="13" y2="12.5"/>
      </svg>
    ),
  },
  {
    key: 'copy',
    label: 'Copy',
    icon: (
      <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="0"   width="9" height="10.5" rx="1"/>
        <rect x="0"   y="3.5" width="9" height="10.5" rx="1" fill="white"/>
      </svg>
    ),
  },
  {
    key: 'paste',
    label: 'Paste',
    icon: (
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
        <rect x="0.5" y="2"   width="11" height="12" rx="1"/>
        <rect x="3.5" y="0.5" width="5"  height="3"  rx="0.5"/>
        <line x1="2.5" y1="6.5" x2="9.5" y2="6.5"/>
        <line x1="2.5" y1="9"   x2="7.5" y2="9"/>
      </svg>
    ),
  },
  // 'pasteword' is a legacy tool key; treat it as a plain paste so any
  // toolList that includes pasteword (but not paste) still shows the option.
  {
    key: 'pasteword',
    label: 'Paste',
    icon: (
      <svg width="12" height="14" viewBox="0 0 12 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
        <rect x="0.5" y="2"   width="11" height="12" rx="1"/>
        <rect x="3.5" y="0.5" width="5"  height="3"  rx="0.5"/>
        <line x1="2.5" y1="6.5" x2="9.5" y2="6.5"/>
        <line x1="2.5" y1="9"   x2="7.5" y2="9"/>
      </svg>
    ),
  },
];

/**
 * ClipboardDropdown - Compact dropdown for Cut, Copy, and Paste actions.
 * Shows an SVG icon + label for each option present in tools.
 */
function ClipboardDropdown({ tools, onCut, onCopy, onPaste, buttonStyle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const panelRef = useRef(null);

  const handlers = {
    cut:       onCut,
    copy:      onCopy,
    paste:     onPaste,
    pasteword: onPaste, // legacy alias
  };

  const visibleOptions = CLIPBOARD_OPTIONS.filter(opt => tools.includes(opt.key));
  const defaultOption = visibleOptions.find(opt => opt.key === 'cut') || visibleOptions[0];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Focus first menuitem when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        panelRef.current?.querySelector('[role="menuitem"]')?.focus();
      });
    }
  }, [open]);

  const handlePanelKeyDown = (e) => {
    const items = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]') || []);
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); setOpen(false); triggerBtnRef.current?.focus(); }
  };

  if (visibleOptions.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerBtnRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(o => !o)}
        style={{ ...buttonStyle, gap: '4px' }}
        title="Clipboard"
        aria-label="Clipboard"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {defaultOption.icon}
        <span style={{ fontSize: '10px', lineHeight: 1 }} aria-hidden="true">▾</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Clipboard"
          onKeyDown={handlePanelKeyDown}
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            zIndex: 100,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '3px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '130px',
          }}
        >
          {visibleOptions.map(opt => (
            <button
              key={opt.key}
              type="button"
              role="menuitem"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { handlers[opt.key](); setOpen(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '7px 12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ToolbarPlugin - Main toolbar component
 *
 * @param {Object} props
 * @param {string} props.toolList - Space-separated list of tools to show
 * @param {boolean} props.inline - Whether toolbar should stick to top when scrolling
 */
export default function ToolbarPlugin({ toolList, inline = true, buildLetterOnComplete = false, documents = [], extraStylesRef, styleContainerRef, footnotesConfig = null }) {
  // Get the editor instance
  const [editor] = useLexicalComposerContext();

  // ===== STATE MANAGEMENT =====
  // Each piece of state tracks whether a formatting option is currently active
  // For example, isBold is true when the selected text is bold

  // Text formatting states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);

  // History states - track if undo/redo are available
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Editor feature states
  const [fontSize, setFontSize] = useState('14px');
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSource, setShowSource] = useState(false); // HTML source view
  const [sourceHTML, setSourceHTML] = useState(''); // HTML content for source view
  const [sourceError, setSourceError] = useState(null); // Error for source view

  // Table creator popover state
  const [tableAnchorEl, setTableAnchorEl] = useState(null);

  // Footnote dialog state
  const [showFootnoteDialog, setShowFootnoteDialog] = useState(false);

  // Color picker popover states
  const [textColorAnchorEl, setTextColorAnchorEl] = useState(null);
  const [bgColorAnchorEl, setBgColorAnchorEl] = useState(null);

  /**
   * useRef - Creates a reference to a DOM element
   * Unlike state, changing a ref doesn't cause a re-render
   * Refs are useful for accessing DOM elements directly
   */
  const fontSizeRef = useRef(null);
  // Ref to the toolbar div — used for arrow-key navigation between items
  const toolbarRef = useRef(null);

  /**
   * handleToolbarKeyDown — Arrow-key navigation within the toolbar.
   *
   * Per the ARIA Authoring Practices Guide (APG) for toolbar widgets:
   *  - Left/Right arrows move focus between toolbar items
   *  - Home/End jump to the first/last item
   *  - Tab / Shift+Tab leave the toolbar entirely (browser default)
   *
   * This satisfies WCAG 2.1.1 (Keyboard) and the ARIA toolbar pattern
   * without requiring a roving-tabindex implementation.
   */
  const handleToolbarKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const items = [
      ...toolbar.querySelectorAll('button:not([disabled]), select:not([disabled])'),
    ];
    const idx = items.indexOf(document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight' ? Math.min(idx + 1, items.length - 1) :
      e.key === 'ArrowLeft'  ? Math.max(idx - 1, 0) :
      e.key === 'Home'       ? 0 :
      /* End */                items.length - 1;
    items[next]?.focus();
  };

  // Parse the toolList string into an array
  // 'bold italic underline' becomes ['bold', 'italic', 'underline']
  // .filter(t => t.trim()) removes any empty strings
  const tools = toolList.split(' ').filter(t => t.trim());

  /**
   * updateToolbar - Updates the toolbar button states based on current selection
   *
   * useCallback is a React Hook that memoizes (caches) a function
   * This prevents unnecessary re-creations of the function on every render
   * The function is only recreated if dependencies in the array change
   */
  const updateToolbar = useCallback(() => {
    // Get the current text selection in the editor
    const selection = $getSelection();

    // Check if it's a range selection (text is selected, not just cursor position)
    if ($isRangeSelection(selection)) {
      // Check which formats are applied to the selected text
      // hasFormat() returns true if that format is active
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsCode(selection.hasFormat('code'));

      // Check if selected text is inside a link
      // anchor is where the selection starts
      const node = selection.anchor.getNode();
      const parent = node.getParent();
      // Check both the node and its parent to see if either is a link
      setIsLink($isLinkNode(parent) || $isLinkNode(node));
    }
  }, []); // Empty dependency array means this function never changes

  /**
   * useEffect - Set up event listeners when component mounts
   * This runs once when the toolbar first appears
   */
  useEffect(() => {
    /**
     * mergeRegister - Combines multiple event listener cleanup functions
     * It returns a single cleanup function that will unregister all listeners
     */
    return mergeRegister(
      // Listen for any editor updates (typing, formatting, etc.)
      editor.registerUpdateListener(({ editorState }) => {
        // Read the current state and update toolbar
        editorState.read(() => {
          updateToolbar();
        });
      }),

      // Listen for undo command
      editor.registerCommand(
        UNDO_COMMAND,
        () => {
          // Update whether undo is available
          // _selection !== null means there's something to undo
          setCanUndo(editor.getEditorState()._selection !== null);
          return false; // false means "don't stop other listeners"
        },
        LowPriority // This listener runs last
      ),

      // Listen for redo command
      editor.registerCommand(
        REDO_COMMAND,
        () => {
          // Update whether redo is available
          setCanRedo(editor.getEditorState()._selection !== null);
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]); // Re-run if editor or updateToolbar changes

  // ===== TEXT FORMATTING COMMANDS =====
  // These functions send commands to the editor to format text
  // editor.dispatchCommand() sends a command to the editor
  // FORMAT_TEXT_COMMAND is the command type
  // The second parameter ('bold', 'italic', etc.) specifies which format

  /**
   * formatBold - Toggles bold formatting on selected text
   * If text is already bold, it removes bold; if not bold, it makes it bold
   */
  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const formatStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const formatSubscript = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
  };

  const formatSuperscript = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
  };

  const formatCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  // Alignment commands
  const formatAlignLeft = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
  };

  const formatAlignCenter = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
  };

  const formatAlignRight = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
  };

  const formatAlignJustify = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
  };

  // List commands
  const insertBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const insertNumberList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const insertCheckList = () => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
  };

  // Indent/Outdent
  const formatOutdent = () => {
    editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
  };

  const formatIndent = () => {
    editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
  };

  // Clipboard commands
  const handleCopy = () => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        navigator.clipboard.writeText(text).catch(() => {});
      }
    });
  };

  const handleCut = () => {
    let textToCut = '';
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        textToCut = selection.getTextContent();
      }
    });
    if (textToCut) {
      navigator.clipboard.writeText(textToCut).then(() => {
        editor.update(() => {
          const sel = $getSelection();
          if ($isRangeSelection(sel)) {
            sel.removeText();
          }
        });
      }).catch(() => {});
    }
  };

  const handlePaste = () => {
    // document.execCommand('paste') is blocked by all modern browsers.
    // Use the Clipboard API instead and insert as text at the current selection.
    navigator.clipboard.readText().then(text => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    }).catch(() => {
      // Clipboard access denied — user can use Ctrl+V / Cmd+V instead.
    });
  };

  const handlePasteWord = () => {
    // For paste as plain text (removing Word formatting)
    navigator.clipboard.readText().then(text => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    });
  };

  // ===== FONT SIZE =====
  /**
   * handleFontSize - Changes the font size of selected text
   * Uses $patchStyleText to apply styles through Lexical's node system
   * so they persist in the editor state and appear in exported HTML.
   * @param {Event} e - The change event from the dropdown
   */
  const handleFontSize = (e) => {
    const size = e.target.value;
    setFontSize(size);

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'font-size': size });
      }
    });
  };

  // ===== FONT FAMILY =====
  /**
   * handleFontFamily - Changes the font family of selected text
   * Uses $patchStyleText to apply styles through Lexical's node system
   * so they persist in the editor state and appear in exported HTML.
   * @param {Event} e - The change event from the dropdown
   */
  const handleFontFamily = (e) => {
    const font = e.target.value;
    setFontFamily(font);

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Passing null removes the style; otherwise set the font family
        $patchStyleText(selection, {
          'font-family': font === 'default' ? null : font,
        });
      }
    });
  };

  // ===== TEXT COLOR =====
  const handleTextColorClick = (event) => {
    setTextColorAnchorEl(event.currentTarget);
  };

  const handleTextColorClose = () => {
    setTextColorAnchorEl(null);
  };

  const applyTextColor = (color) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // null removes the color (resets to automatic/default)
        $patchStyleText(selection, { color: color });
      }
    });
  };

  // ===== BACKGROUND COLOR =====
  const handleBgColorClick = (event) => {
    setBgColorAnchorEl(event.currentTarget);
  };

  const handleBgColorClose = () => {
    setBgColorAnchorEl(null);
  };

  const applyBgColor = (color) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': color });
      }
    });
  };

  // Table popover handlers
  const handleTableClick = (event) => {
    setTableAnchorEl(event.currentTarget);
  };

  const handleTableClose = () => {
    setTableAnchorEl(null);
  };

  // Footnote
  const insertFootnote = () => {
    setShowFootnoteDialog(true);
  };

  // Horizontal rule — insert directly to avoid extra empty paragraphs
  const insertHorizontalRule = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        const topLevelElement = anchorNode.getTopLevelElement();
        if (topLevelElement) {
          const hrNode = $createHorizontalRuleNode();
          topLevelElement.insertAfter(hrNode);
        }
      }
    });
  };

  // ===== MAXIMIZE EDITOR =====
  /**
   * toggleMaximize - Makes editor full-screen or restores normal size
   * This manipulates the DOM directly using standard JavaScript
   */
  const toggleMaximize = () => {
    // Use editor.getRootElement() to get THIS editor's contentEditable element,
    // then walk up the DOM with closest() to find THIS editor's container.
    // This is critical when multiple editors with different toolLists are on
    // the same page — document.querySelector() would always return the first
    // editor's container, causing the wrong editor to maximize and the wrong
    // toolbar (wrong access level) to appear in the maximized view.
    const rootElement = editor.getRootElement();
    const container = rootElement?.closest('.lexical-editor-container');

    if (container) {
      if (!isMaximized) {
        // Maximize: fill the entire viewport.
        // Use a flex column chain so the editing area grows to fill the space
        // left over after the toolbar, rather than stopping at its maxHeight.
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'white';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        const wrapper = container.querySelector('.lexical-editor-wrapper');
        if (wrapper) {
          wrapper.style.flex = '1';
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.overflow = 'hidden';
          wrapper.style.borderRadius = '0';
          wrapper.style.border = 'none';
        }

        const inner = container.querySelector('.lexical-editor-inner');
        if (inner) {
          inner.style.flex = '1';
          inner.style.display = 'flex';
          inner.style.flexDirection = 'column';
          inner.style.overflow = 'hidden';
        }

        const scroller = container.querySelector('.lexical-editor-scroller');
        if (scroller) {
          scroller.style.flex = '1';
          scroller.style.overflow = 'auto';
        }

        // Remove the maxHeight cap on the ContentEditable so it fills the scroller
        if (rootElement) {
          rootElement.style.maxHeight = 'none';
          rootElement.style.minHeight = '100%';
          rootElement.style.resize = 'none';
        }

        setIsMaximized(true);
      } else {
        // Restore: clear all inline styles added during maximize
        container.style.position = '';
        container.style.top = '';
        container.style.left = '';
        container.style.width = '';
        container.style.height = '';
        container.style.zIndex = '';
        container.style.backgroundColor = '';
        container.style.display = '';
        container.style.flexDirection = '';

        const wrapper = container.querySelector('.lexical-editor-wrapper');
        if (wrapper) {
          wrapper.style.flex = '';
          wrapper.style.display = '';
          wrapper.style.flexDirection = '';
          wrapper.style.overflow = '';
          wrapper.style.borderRadius = '';
          wrapper.style.border = '';
        }

        const inner = container.querySelector('.lexical-editor-inner');
        if (inner) {
          inner.style.flex = '';
          inner.style.display = '';
          inner.style.flexDirection = '';
          inner.style.overflow = '';
        }

        const scroller = container.querySelector('.lexical-editor-scroller');
        if (scroller) {
          scroller.style.flex = '';
          scroller.style.overflow = '';
        }

        if (rootElement) {
          rootElement.style.maxHeight = '';
          rootElement.style.minHeight = '';
          rootElement.style.resize = '';
        }

        setIsMaximized(false);
      }
    }
  };

  // ===== SOURCE CODE VIEW =====
  /**
   * toggleSource - Shows/hides the HTML source code view.
   *
   * Opening: read the hidden field value — it always holds the complete HTML
   * (Lexical content + preserved style tags written by SyncContentPlugin), so
   * the source view shows exactly what will be saved, including any <style> blocks.
   *
   * Closing: delegate to applySourceChanges().
   */
  const toggleSource = () => {
    if (!showSource) {
      // Prefer the hidden field, which SyncContentPlugin keeps up to date with
      // the full HTML (Lexical output + extraStylesRef).  Fall back to generating
      // from Lexical state + current extraStylesRef when no field exists.
      const fieldId = documents?.[0]?.id;
      const hiddenField = fieldId ? document.getElementById(fieldId) : null;

      if (hiddenField?.value) {
        setSourceHTML(hiddenField.value);
      } else {
        editor.getEditorState().read(() => {
          const { strippedHtml: lexicalHtml } = extractAndStripStyles(
            cleanExportedHtml($generateHtmlFromNodes(editor, null))
          );
          setSourceHTML((extraStylesRef?.current || '') + lexicalHtml);
        });
      }
      setShowSource(true);
    } else {
      applySourceChanges();
    }
  };

  /**
   * handleSourceChange - Updates the HTML as user types in source view
   * @param {string} html - The new HTML content
   */
  const handleSourceChange = (html) => {
    // Update our state with the new HTML content
    setSourceHTML(html);
    setSourceError(null); // Clear any previous errors
  };

  /**
   * applySourceChanges - Applies the source-view HTML back to the editor.
   *
   * 1. Extract <style> blocks from the source HTML → store in extraStylesRef
   *    and inject into the style container div for visual rendering.
   * 2. Write the complete source HTML to the hidden field immediately (safety net).
   * 3. Load the style-free HTML into Lexical.
   * 4. SyncContentPlugin will fire after the update and write
   *    (Lexical HTML + extraStylesRef) to the hidden field automatically,
   *    so the field stays correct on every subsequent keystroke too.
   */
  const applySourceChanges = () => {
    try {
      // Separate <style> blocks from the rest of the HTML, then sanitize
      // the content portion to strip scripts and event handlers before it
      // is loaded into Lexical or written to the hidden field.
      const { stylesHtml, strippedHtml: rawStrippedHtml } = extractAndStripStyles(sourceHTML);
      const strippedHtml = sanitizeHtml(rawStrippedHtml);

      // Persist styles in the shared ref so SyncContentPlugin can re-attach them
      if (extraStylesRef) extraStylesRef.current = stylesHtml;

      // Inject styles into the hidden container so CSS rules apply visually.
      // Selectors are scoped to .lexical-content-editable for the same reason
      // as LoadContentPlugin — see scopeStylesForEditor in LexicalEditor.jsx.
      if (styleContainerRef?.current) {
        styleContainerRef.current.innerHTML = sanitizeStyleHtml(scopeStylesForEditor(stylesHtml));
      }

      // Write the full source HTML to the hidden field immediately as a safety
      // net — SyncContentPlugin will update it again after editor.update() fires,
      // but this guarantees nothing is lost if the update is async.
      const fieldId = documents?.[0]?.id;
      if (fieldId) {
        const hiddenField = document.getElementById(fieldId);
        if (hiddenField) hiddenField.value = stylesHtml + strippedHtml;
      }

      // Load the style-free HTML into Lexical.
      // Tagged 'source-import' so SyncContentPlugin skips this one update
      // (the hidden field was already written above).
      // The _lexicalApplyingSourceView flag tells RawHtmlNode.importDOM to
      // yield <table> elements to Lexical's TableNode so they stay editable
      // after a source-view round-trip (without the flag, tables would be
      // captured as non-editable RawHtmlNodes just like DB-loaded tables).
      editor.update(() => {
        window._lexicalApplyingSourceView = true;
        try {
          const root = $getRoot();
          root.clear();

          const parser = new DOMParser();
          const dom = parser.parseFromString(strippedHtml, 'text/html');
          const nodes = $generateNodesFromDOM(editor, dom);

          nodes.forEach(node => {
            if ($isElementNode(node) || $isDecoratorNode(node)) {
              root.append(node);
            } else {
              const paragraph = $createParagraphNode();
              paragraph.append(node);
              root.append(paragraph);
            }
          });
        } finally {
          window._lexicalApplyingSourceView = false;
        }
      }, { tag: 'source-import' });

      setSourceError(null);
      setShowSource(false);
    } catch (error) {
      setSourceError(error.message || 'Failed to parse HTML');
    }
  };

  // Font case
  const changeFontCase = (e) => {
    const caseType = e.target.value;

    // Reset the dropdown to default after selection
    e.target.value = '';

    if (!caseType) return;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        let newText = text;

        if (caseType === 'uppercase') {
          newText = text.toUpperCase();
        } else if (caseType === 'lowercase') {
          newText = text.toLowerCase();
        } else if (caseType === 'titlecase') {
          newText = text.replace(/\w\S*/g, (txt) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        } else if (caseType === 'sentencecase') {
          newText = text.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) =>
            prefix + letter.toUpperCase()
          );
        }

        selection.insertText(newText);
      }
    });
  };

  // Remove formatting
  const removeFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Get all nodes in the selection
        const nodes = selection.getNodes();

        nodes.forEach(node => {
          // If it's a text node, remove all formatting flags (bold, italic, etc.)
          if (node.getType() === 'text') {
            node.setFormat(0);
            // Clear any inline styles (font-size, font-family, etc.)
            node.setStyle('');
          }
        });
      }
    });
  };

  // Select all
  const selectAllContent = () => {
    editor.update(() => {
      // Use Lexical's built-in $selectAll function to select all content
      $selectAll();
    });
  };

  // Paragraph format
  const handleParagraphFormat = (e) => {
    const formatType = e.target.value;
    if (!formatType) return;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        if (formatType === 'paragraph') {
          // Normal → <p>
          $setBlocksType(selection, () => $createParagraphNode());
        } else if (formatType === 'div') {
          // Normal (DIV) → <div>
          $setBlocksType(selection, () => $createDivNode());
        } else if (formatType === 'pre') {
          // Formatted → <pre>
          $setBlocksType(selection, () => $createPreformattedNode());
        } else if (formatType === 'address') {
          // Address → <address>
          $setBlocksType(selection, () => $createAddressNode());
        } else if (formatType.startsWith('h')) {
          // Headings → <h1> through <h6>
          // Use AttributedHeadingNode so the theme class is always applied
          // in createDOM() and the node type is consistent with headings
          // loaded from the database.
          $setBlocksType(selection, () => $createAttributedHeadingNode(formatType, {}));
        }
      }
    });
  };

  // Spell check — calls external launchSpellCheck() function from include file
  const handleSpellCheck = () => {
    if (typeof window.launchSpellCheck === 'function') {
      window.launchSpellCheck(buildLetterOnComplete);
    } else {
      console.warn('launchSpellCheck() is not defined. Make sure the spell check script is included on the page.');
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      const url = prompt('Enter URL:');
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $wrapNodes(selection, () => $createQuoteNode());
      }
    });
  };

  // ===== STYLES =====
  // In React, inline styles are JavaScript objects with camelCase property names

  /**
   * toolbarStyle - Styles for the main toolbar container
   * Uses flexbox for layout (display: 'flex')
   */
  const toolbarStyle = {
    display: 'flex', // Flexbox layout
    gap: '4px', // Space between buttons
    padding: '8px',
    backgroundColor: '#f0f0f0', // Light gray background
    borderBottom: '1px solid #ccc',
    flexWrap: 'wrap', // Wrap buttons to next line if needed
    alignItems: 'center', // Vertically center items
    // Conditional styling: If inline is true, make toolbar stick to top when scrolling
    ...(inline && { position: 'sticky', top: 0, zIndex: 10 })
  };

  /**
   * buttonStyle - Base style for toolbar buttons
   */
  const buttonStyle = {
    padding: '6px 10px',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    cursor: 'pointer', // Show hand cursor on hover
    borderRadius: '3px', // Rounded corners
    fontSize: '13px',
    minWidth: '30px',
    display: 'inline-flex', // Flexbox for centering content
    alignItems: 'center', // Center content vertically
    justifyContent: 'center', // Center content horizontally
  };

  /**
   * activeButtonStyle - Style for buttons that are "active" (e.g., bold when text is bold)
   * Spreads buttonStyle and overrides specific properties
   */
  const activeButtonStyle = {
    ...buttonStyle, // Copy all properties from buttonStyle
    backgroundColor: '#d0d0d0', // Darker background for active state
    fontWeight: 'bold', // Bold text
  };

  /**
   * separatorStyle - Vertical line to separate button groups
   */
  const separatorStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: '#ccc',
    margin: '0 4px',
  };

  /**
   * RETURN STATEMENT - The JSX that renders the toolbar
   *
   * Key JSX patterns used here:
   * 1. Conditional rendering: {condition && <Element />}
   *    - Only renders if condition is true
   * 2. Ternary operator: {condition ? value1 : value2}
   *    - Chooses between two values based on condition
   * 3. Arrow functions in onClick: onClick={() => doSomething()}
   *    - Creates a function that runs when button is clicked
   * 4. Fragments: <> ... </>
   *    - Groups multiple elements without adding extra DOM nodes
   */
  return (
    <ToolbarWrapper>
      {/* Main toolbar container
          role="toolbar" tells screen readers this is a toolbar widget.
          aria-label provides an accessible name for the toolbar. */}
      <div className="lexical-toolbar" style={toolbarStyle} role="toolbar" aria-label="Text formatting toolbar" ref={toolbarRef} onKeyDown={handleToolbarKeyDown}>

        {/* PARAGRAPH FORMAT DROPDOWN */}
        {tools.includes('formatblock') && (
          <select
            onChange={handleParagraphFormat}
            defaultValue="paragraph"
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              fontSize: '13px',
              cursor: 'pointer',
              width: 'auto',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              maxWidth: '160px',
            }}
            title="Paragraph Format"
            aria-label="Paragraph Format"
          >
            <option value="paragraph">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
            <option value="pre">Formatted</option>
            <option value="address">Address</option>
            <option value="div">Normal (DIV)</option>
          </select>
        )}

        {tools.includes('formatblock') && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

        {/* SPELL CHECK BUTTON */}
        {tools.includes('spellcheck') && (
          <button
            type="button"
            onClick={handleSpellCheck}
            style={buttonStyle}
            title="Spell Check Content"
            aria-label="Spell Check Content"
          >
            ABC✓
          </button>
        )}

        {/* UNDO BUTTON */}
        {tools.includes('undo') && (
          <button
            type="button"
            // Arrow function: () => editor.dispatchCommand(...)
            // This creates a function that runs when button is clicked
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            style={buttonStyle}
            title="Undo"
            aria-label="Undo"
          >
            ↶ {/* Unicode arrow character */}
          </button>
        )}

        {/* REDO BUTTON */}
        {tools.includes('redo') && (
          <button
            type="button"
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            style={buttonStyle}
            title="Redo"
            aria-label="Redo"
          >
            ↷
          </button>
        )}

        {/* SEPARATOR - Vertical line between button groups
            || is logical OR: shows separator if either button exists */}
        {(tools.includes('undo') || tools.includes('redo')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

        {/* BOLD BUTTON
            Ternary operator in style: condition ? ifTrue : ifFalse
            Shows activeButtonStyle when text is bold, buttonStyle when not */}
        {tools.includes('bold') && (
          <button
            type="button"
            onClick={formatBold}
            style={isBold ? activeButtonStyle : buttonStyle}
            title="Bold"
            aria-label="Format Bold"
            aria-pressed={isBold}
          >
            <b>B</b> {/* The <b> tag makes the B bold */}
          </button>
        )}
      {tools.includes('italic') && (
        <button
            type="button"
          onClick={formatItalic}
          style={isItalic ? activeButtonStyle : buttonStyle}
          title="Italic"
          aria-label="Format Italic"
          aria-pressed={isItalic}
        >
          <i>I</i>
        </button>
      )}
      {tools.includes('underline') && (
        <button
            type="button"
          onClick={formatUnderline}
          style={isUnderline ? activeButtonStyle : buttonStyle}
          title="Underline"
          aria-label="Format Underline"
          aria-pressed={isUnderline}
        >
          <u>U</u>
        </button>
      )}
      {tools.includes('subscript') && (
        <button
            type="button"
          onClick={formatSubscript}
          style={isSubscript ? activeButtonStyle : buttonStyle}
          title="Subscript"
          aria-label="Subscript"
          aria-pressed={isSubscript}
        >
          {/* Subscript: letter A with the 2 positioned BELOW the baseline */}
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <text x="1" y="11" fontSize="10" fontWeight="bold" fill="currentColor">A</text>
            <text x="9" y="14" fontSize="7" fill="currentColor">2</text>
          </svg>
        </button>
      )}
      {tools.includes('superscript') && (
        <button
            type="button"
          onClick={formatSuperscript}
          style={isSuperscript ? activeButtonStyle : buttonStyle}
          title="Superscript"
          aria-label="Superscript"
          aria-pressed={isSuperscript}
        >
          {/* Superscript: letter A with the 2 positioned ABOVE the cap height */}
          <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
            <text x="1" y="11" fontSize="10" fontWeight="bold" fill="currentColor">A</text>
            <text x="9" y="5"  fontSize="7" fill="currentColor">2</text>
          </svg>
        </button>
      )}
      {tools.includes('removeformatting') && (
        <button
            type="button"
          onClick={removeFormatting}
          style={buttonStyle}
          title="Remove Formatting"
          aria-label="Remove Formatting"
        >
          ✖
        </button>
      )}
      {tools.includes('selectall') && (
        <button
            type="button"
          onClick={selectAllContent}
          style={buttonStyle}
          title="Select All"
          aria-label="Select All"
        >
          ⊙
        </button>
      )}

      {(tools.includes('bold') || tools.includes('italic') || tools.includes('underline')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {(tools.includes('alignleft') || tools.includes('aligncenter') || tools.includes('alignright') || tools.includes('alignjustify')) && (
        <AlignDropdown
          tools={tools}
          onAlignLeft={formatAlignLeft}
          onAlignCenter={formatAlignCenter}
          onAlignRight={formatAlignRight}
          onAlignJustify={formatAlignJustify}
          buttonStyle={buttonStyle}
        />
      )}

      {(tools.includes('alignleft') || tools.includes('aligncenter') || tools.includes('alignright') || tools.includes('alignjustify')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {(tools.includes('bullist') || tools.includes('numlist') || tools.includes('checklist')) && (
        <ListDropdown
          tools={tools}
          onBulletList={insertBulletList}
          onNumberList={insertNumberList}
          onCheckList={insertCheckList}
          buttonStyle={buttonStyle}
        />
      )}
      {tools.includes('outdent') && (
        <button
            type="button"
          onClick={formatOutdent}
          style={buttonStyle}
          title="Decrease Indent"
          aria-label="Outdent"
        >
          ⇤
        </button>
      )}
      {tools.includes('indent') && (
        <button
            type="button"
          onClick={formatIndent}
          style={buttonStyle}
          title="Increase Indent"
          aria-label="Indent"
        >
          ⇥
        </button>
      )}

      {(tools.includes('bullist') || tools.includes('numlist') || tools.includes('checklist')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {(tools.includes('cut') || tools.includes('copy') || tools.includes('paste') || tools.includes('pasteword')) && (
        <ClipboardDropdown
          tools={tools}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          buttonStyle={buttonStyle}
        />
      )}

      {(tools.includes('cut') || tools.includes('copy') || tools.includes('paste') || tools.includes('pasteword')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {tools.includes('fontsize') && (
        <select
          ref={fontSizeRef}
          onChange={handleFontSize}
          value={fontSize}
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontSize: '13px',
            cursor: 'pointer',
            width: 'auto',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            maxWidth: '80px',
          }}
          title="Font Size"
          aria-label="Font Size"
        >
          <option value="10px">10px</option>
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="28px">28px</option>
          <option value="32px">32px</option>
          <option value="36px">36px</option>
        </select>
      )}

      {tools.includes('fontfamily') && (
        <select
          onChange={handleFontFamily}
          value={fontFamily}
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontSize: '13px',
            cursor: 'pointer',
            width: 'auto',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}
          title="Font Family"
          aria-label="Font Family"
        >
          <option value="default">Font (Default)</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Comic Sans MS', cursive">Comic Sans MS</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="'Lucida Console', monospace">Lucida Console</option>
          <option value="Tahoma, sans-serif">Tahoma</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>
      )}

      {tools.includes('fontcase') && (
        <select
          onChange={changeFontCase}
          defaultValue=""
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontSize: '13px',
            cursor: 'pointer',
            width: 'auto',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            maxWidth: '140px',
          }}
          title="Change Case"
          aria-label="Change Case"
        >
          <option value="" disabled>Change Case</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="titlecase">Title Case</option>
          <option value="sentencecase">Sentence case</option>
        </select>
      )}

      {tools.includes('textcolor') && (
        <button
            type="button"
          onClick={handleTextColorClick}
          style={buttonStyle}
          title="Text Color"
          aria-label="Text Color"
          aria-haspopup="dialog"
          aria-expanded={Boolean(textColorAnchorEl)}
        >
          <span style={{ borderBottom: '3px solid #ff0000', lineHeight: '1' }}>A</span>
        </button>
      )}
      {tools.includes('bgcolor') && (
        <button
            type="button"
          onClick={handleBgColorClick}
          style={buttonStyle}
          title="Background Color"
          aria-label="Background Color"
          aria-haspopup="dialog"
          aria-expanded={Boolean(bgColorAnchorEl)}
        >
          <span style={{ backgroundColor: '#ffff00', padding: '0 3px', lineHeight: '1' }}>A</span>
        </button>
      )}

      {(tools.includes('textcolor') || tools.includes('bgcolor')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {tools.includes('table') && (
        <button
            type="button"
          onClick={handleTableClick}
          style={buttonStyle}
          title="Insert Table"
          aria-label="Insert Table"
          aria-haspopup="dialog"
          aria-expanded={Boolean(tableAnchorEl)}
        >
          ⊞
        </button>
      )}
      {tools.includes('footnote') && (
        <button
            type="button"
          onClick={insertFootnote}
          style={buttonStyle}
          title="Insert Endnote"
          aria-label="Insert Endnote"
        >
          ※
        </button>
      )}
      {tools.includes('horizontalrule') && (
        <button
            type="button"
          onClick={insertHorizontalRule}
          style={buttonStyle}
          title="Insert Horizontal Rule"
          aria-label="Insert Horizontal Rule"
        >
          ─
        </button>
      )}

      {(tools.includes('table') || tools.includes('horizontalrule')) && <div style={separatorStyle} role="separator" aria-orientation="vertical"></div>}

      {tools.includes('maximize') && (
        <button
            type="button"
          onClick={toggleMaximize}
          style={isMaximized ? activeButtonStyle : buttonStyle}
          title={isMaximized ? "Restore editor size" : "Maximize editor"}
          aria-label={isMaximized ? "Restore editor size" : "Maximize editor"}
          aria-pressed={isMaximized}
        >
          {isMaximized ? (
            /* Restore: four corner brackets pointing INWARD toward center */
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="4,1 4,4 1,4"/>
              <polyline points="9,4 12,4 12,1"/>
              <polyline points="12,9 9,9 9,12"/>
              <polyline points="1,9 4,9 4,12"/>
            </svg>
          ) : (
            /* Maximize: corner brackets with diagonal arrow ticks pointing outward */
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="4,1.5 1.5,1.5 1.5,4"/>
              <polyline points="9,1.5 11.5,1.5 11.5,4"/>
              <polyline points="11.5,9 11.5,11.5 9,11.5"/>
              <polyline points="1.5,9 1.5,11.5 4,11.5"/>
              <line x1="1.5" y1="1.5" x2="4" y2="4"/>
              <line x1="11.5" y1="1.5" x2="9" y2="4"/>
              <line x1="11.5" y1="11.5" x2="9" y2="9"/>
              <line x1="1.5" y1="11.5" x2="4" y2="9"/>
            </svg>
          )}
        </button>
      )}
      {tools.includes('source') && (
        <button
            type="button"
          onClick={toggleSource}
          style={showSource ? activeButtonStyle : buttonStyle}
          title={showSource ? "Close source code view" : "View source code"}
          aria-label={showSource ? "Close source code view" : "View source code"}
          aria-pressed={showSource}
        >
          {'</>'}
        </button>
      )}
    </div>

    {/* ===== SOURCE CODE VIEW =====
        New SourceCodePlugin component for viewing/editing HTML */}
    <SourceCodePlugin
      isSourceCodeView={showSource}
      onHtmlChange={handleSourceChange}
      initialHtml={sourceHTML}
      error={sourceError}
      onExitShortcut={applySourceChanges}
    />

    {/* Table Creator Popover */}
    {tools.includes('table') && (
      <TableCreatorPlugin
        handleClose={handleTableClose}
        anchorEl={tableAnchorEl}
        dynamicPosition={{ vertical: 'bottom', horizontal: 'left' }}
      />
    )}

    {/* Text Color Picker Popover */}
    {tools.includes('textcolor') && (
      <ColorPickerPlugin
        anchorEl={textColorAnchorEl}
        onClose={handleTextColorClose}
        onSelectColor={applyTextColor}
      />
    )}

    {/* Background Color Picker Popover */}
    {tools.includes('bgcolor') && (
      <ColorPickerPlugin
        anchorEl={bgColorAnchorEl}
        onClose={handleBgColorClose}
        onSelectColor={applyBgColor}
      />
    )}

    {/* Footnote Dialog */}
    {tools.includes('footnote') && (
      <FootnoteDialog
        isOpen={showFootnoteDialog}
        onClose={() => setShowFootnoteDialog(false)}
        footnotesConfig={footnotesConfig || {}}
      />
    )}

    {/* End of toolbar and source view */}
    </ToolbarWrapper>
  );
}