/**
 * LexicalEditor.jsx - Main React component for the rich text editor
 *
 * This file uses several React concepts:
 * - Functional Components: Functions that return JSX (UI)
 * - Hooks: Special functions that let you "hook into" React features
 *   - useState: Manages component state (data that can change)
 *   - useEffect: Runs code when component mounts or data changes
 * - Props: Data passed from parent to child components
 */

// React core imports
import React, { useEffect, useRef, useState } from 'react';

// CSS imports
import './LexicalTable.css';

// Lexical core components - These are building blocks for the editor
import { LexicalComposer } from '@lexical/react/LexicalComposer'; // Main wrapper that provides editor context
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'; // Enables rich text editing
import { ContentEditable } from '@lexical/react/LexicalContentEditable'; // The actual editable area
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'; // Enables undo/redo
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'; // Auto-focuses editor on load
import { ListPlugin } from '@lexical/react/LexicalListPlugin'; // Enables bullet and numbered lists
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'; // Enables clickable check lists
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'; // Tab key for indentation
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'; // Enables table functionality
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'; // Enables horizontal rule
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'; // Horizontal rule node
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary'; // Catches and handles errors

// Lexical node types - These define what kind of content the editor can handle
import { HeadingNode, QuoteNode } from '@lexical/rich-text'; // Heading and quote nodes
import { ListItemNode, ListNode } from '@lexical/list'; // List nodes
import { LinkNode } from '@lexical/link'; // Hyperlink nodes
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table'; // Table nodes
import { AddressNode, PreformattedNode, DivNode, RawHtmlNode } from './CustomFormatNodes'; // Custom format nodes

// Hook to access the Lexical editor instance from within plugins
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// Lexical utility functions - These are used to manipulate editor content
// The $ prefix is a Lexical convention meaning "this runs inside an editor update"
import { $getRoot, $createParagraphNode, $isElementNode, $isDecoratorNode, $getSelection, $isRangeSelection, $insertNodes } from 'lexical';

/**
 * extractAndStripStyles — Pulls every <style>…</style> block out of an HTML
 * string and returns them separately.
 *
 * Why this is needed: Lexical's $generateNodesFromDOM hard-codes
 * IGNORE_TAGS = ['STYLE', 'SCRIPT'], so <style> elements are silently
 * dropped during import.  By extracting them BEFORE importing into Lexical
 * and re-attaching them AFTER generating HTML from Lexical, we keep the
 * full HTML intact without touching Lexical's internals.
 *
 * @param {string} html - Raw HTML that may contain <style> blocks
 * @returns {{ stylesHtml: string, strippedHtml: string }}
 */
export function extractAndStripStyles(html) {
  const pattern = /<style[^>]*>[\s\S]*?<\/style>/gi;
  const stylesHtml = (html.match(pattern) || []).join('');
  const strippedHtml = html.replace(pattern, '');
  return { stylesHtml, strippedHtml };
}

// HTML import/export utilities for preserving HTML formatting
import { $generateNodesFromDOM, $generateHtmlFromNodes } from '@lexical/html';

// Our custom toolbar component
import ToolbarPlugin from './ToolbarPlugin';

/**
 * LoadContentPlugin - Loads initial HTML content into the editor.
 *
 * Style tags are extracted BEFORE import (Lexical ignores them via IGNORE_TAGS)
 * and stored in extraStylesRef so they survive through subsequent edits and
 * round-trips to the source view.
 *
 * @param {Object} props
 * @param {Array}  props.documents        - Document objects; uses first element
 * @param {Object} props.extraStylesRef   - Ref that holds preserved <style> HTML
 * @param {Object} props.styleContainerRef - Ref to the hidden style-injection div
 */
function LoadContentPlugin({ documents, extraStylesRef, styleContainerRef }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!documents || documents.length === 0) return;
    const firstDoc = documents[0];

    // Prefer the hidden field value (avoids JSON-escaping issues with HTML that
    // contains double quotes), fall back to the body property.
    let htmlContent = '';
    if (firstDoc.id) {
      const hiddenField = document.getElementById(firstDoc.id);
      if (hiddenField?.value) htmlContent = hiddenField.value;
    }
    if (!htmlContent && firstDoc.body) htmlContent = firstDoc.body;
    if (!htmlContent) return;

    // Pull <style> blocks out of the HTML so Lexical never sees them.
    // Store them in the shared ref; SyncContentPlugin will re-attach them
    // to the hidden field after every Lexical update.
    const { stylesHtml, strippedHtml } = extractAndStripStyles(htmlContent);
    extraStylesRef.current = stylesHtml;

    // Inject the styles into the hidden div so CSS rules apply visually.
    // <style> elements apply globally even inside a display:none container.
    if (styleContainerRef?.current) {
      styleContainerRef.current.innerHTML = stylesHtml;
    }

    // Load the style-free HTML into Lexical
    editor.update(() => {
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
    });
  }, [editor, documents]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * ExternalAPIPlugin - Tracks active editor focus and provides a global API
 * so external code (like popup windows) can insert content into the active editor.
 *
 * Global API exposed:
 *   window.activeLexicalEditorId  - The hidden field ID of the last focused editor
 *   window.setLexicalEditorContent(fieldId, htmlContent) - Set content of a specific editor
 *   window.insertIntoActiveLexicalEditor(htmlContent) - Insert content into the active editor
 *
 * @param {Object} props
 * @param {Array} props.documents - Array of documents (used to get field IDs)
 */
function ExternalAPIPlugin({ documents }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Get the field ID for this editor instance
    const fieldId = documents && documents.length > 0 ? documents[0].id : null;
    if (!fieldId) return;

    // Initialize the global editor registry if it doesn't exist
    if (!window._lexicalEditors) {
      window._lexicalEditors = {};
    }

    // Register this editor instance in the global registry
    window._lexicalEditors[fieldId] = editor;

    // Listen for focus events on the editor's root element
    const rootElement = editor.getRootElement();
    const handleFocus = () => {
      window.activeLexicalEditorId = fieldId;
    };

    if (rootElement) {
      rootElement.addEventListener('focus', handleFocus);
    }

    // Provide a global function to set content into any editor by field ID
    if (!window.setLexicalEditorContent) {
      window.setLexicalEditorContent = function(targetFieldId, htmlContent) {
        const targetEditor = window._lexicalEditors[targetFieldId];
        if (!targetEditor) {
          console.error('No Lexical editor found for field ID:', targetFieldId);
          return;
        }

        targetEditor.update(() => {
          const root = $getRoot();
          root.clear();

          const parser = new DOMParser();
          const dom = parser.parseFromString(htmlContent, 'text/html');
          const nodes = $generateNodesFromDOM(targetEditor, dom);

          nodes.forEach(node => {
            if ($isElementNode(node) || $isDecoratorNode(node)) {
              root.append(node);
            } else {
              const paragraph = $createParagraphNode();
              paragraph.append(node);
              root.append(paragraph);
            }
          });
        });
      };
    }

    // Insert content at the cursor position in the currently active editor
    // If cursor is not in the editor, content is appended at the end
    if (!window.insertIntoActiveLexicalEditor) {
      window.insertIntoActiveLexicalEditor = function(htmlContent) {
        const activeId = window.activeLexicalEditorId;
        if (!activeId) {
          console.error('No active Lexical editor. Click on an editor first.');
          return;
        }
        const targetEditor = window._lexicalEditors[activeId];
        if (!targetEditor) {
          console.error('No Lexical editor found for field ID:', activeId);
          return;
        }

        targetEditor.update(() => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(htmlContent, 'text/html');
          const nodes = $generateNodesFromDOM(targetEditor, dom);

          // Check if there's a current selection (cursor in the editor)
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            // Insert at the current cursor position
            $insertNodes(nodes);
          } else {
            // No cursor in editor - append at the end
            const root = $getRoot();
            nodes.forEach(node => {
              if ($isElementNode(node) || $isDecoratorNode(node)) {
                root.append(node);
              } else {
                const paragraph = $createParagraphNode();
                paragraph.append(node);
                root.append(paragraph);
              }
            });
          }
        });
      };
    }

    // Cleanup on unmount
    return () => {
      if (rootElement) {
        rootElement.removeEventListener('focus', handleFocus);
      }
      if (window._lexicalEditors) {
        delete window._lexicalEditors[fieldId];
      }
    };
  }, [editor, documents]);

  return null;
}

/**
 * EditablePlugin - Controls whether the editor is read-only or editable
 *
 * @param {Object} props
 * @param {boolean} props.editable - True if editor should be editable
 */
function EditablePlugin({ editable }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Set the editor's editable state
    // When false, user can't type or modify content (read-only mode)
    editor.setEditable(editable);
  }, [editor, editable]); // Re-run when editable prop changes

  return null;
}

/**
 * SyncContentPlugin - Syncs editor content to hidden form fields on every update.
 *
 * The output is always:  cleanExportedHtml(Lexical HTML)  +  extraStylesRef.current
 * This ensures style tags extracted at load-time (or applied via source view) are
 * always re-attached, giving one self-contained HTML value in the hidden field.
 *
 * @param {Object} props
 * @param {Array}  props.documents      - Documents with hidden-field IDs to update
 * @param {Object} props.extraStylesRef - Shared ref holding preserved <style> HTML
 * @param {string} props.containerId    - ID of the editor container (for keying)
 */
function SyncContentPlugin({ documents, extraStylesRef, containerId }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      // applySourceChanges writes the hidden field directly before triggering
      // editor.update(), so skip the redundant sync for that tagged update.
      if (tags.has('source-import')) return;

      editorState.read(() => {
        // Lexical's HTML for the editable content (no style tags)
        const lexicalHtml = cleanExportedHtml($generateHtmlFromNodes(editor));

        // Re-attach preserved style tags so the hidden field always contains
        // the complete document HTML, including any <style> blocks the user added.
        // Prepend styles so they appear at the top (matching original DB position).
        const combined = (extraStylesRef.current || '') + lexicalHtml;

        documents?.forEach(doc => {
          const hiddenField = document.getElementById(doc.id);
          if (hiddenField) hiddenField.value = combined;
        });
      });
    });
  }, [editor, documents, containerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/**
 * cleanExportedHtml - Strips Lexical-specific attributes from exported HTML
 * Exported so it can also be used by ToolbarPlugin for the source view.
 *
 * Lexical's $generateHtmlFromNodes adds theme classes (e.g. class="lexical-paragraph"),
 * direction attributes (dir="ltr"), and wraps text in <span style="white-space: pre-wrap;">.
 * This function removes those artifacts so the saved HTML is clean, while preserving
 * any meaningful inline styles (font-size, font-family, etc.) on span elements.
 */
export function cleanExportedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. Remove class attributes that only contain lexical- prefixed classes
  doc.querySelectorAll('[class]').forEach(el => {
    const remaining = Array.from(el.classList).filter(c => !c.startsWith('lexical-'));
    if (remaining.length === 0) {
      el.removeAttribute('class');
    } else {
      el.className = remaining.join(' ');
    }
  });

  // 2. Remove dir="ltr" attributes (browser default, not needed in saved HTML)
  doc.querySelectorAll('[dir="ltr"]').forEach(el => {
    el.removeAttribute('dir');
  });

  // 2b. Remove spellcheck attributes (added by some Lexical nodes, not needed in saved HTML)
  doc.querySelectorAll('[spellcheck]').forEach(el => {
    el.removeAttribute('spellcheck');
  });

  // 3. Clean up span elements:
  //    - Unwrap spans whose only style is "white-space: pre-wrap" (Lexical artifact)
  //    - Keep spans that carry meaningful styles (font-size, color, etc.)
  //      but strip the white-space: pre-wrap portion from those
  doc.querySelectorAll('span').forEach(span => {
    const style = span.getAttribute('style') || '';
    const cleanStyle = style.replace(/white-space:\s*pre-wrap;?\s*/g, '').trim();

    if (!cleanStyle) {
      // No meaningful styles — unwrap the span, keeping its child nodes
      while (span.firstChild) {
        span.parentNode.insertBefore(span.firstChild, span);
      }
      span.parentNode.removeChild(span);
    } else {
      // Has meaningful styles — keep the span but drop white-space: pre-wrap
      span.setAttribute('style', cleanStyle);
    }
  });

  // 4. Rescue <style> elements that DOMParser moved to <head> back into <body>
  //    so they are included in the returned innerHTML
  Array.from(doc.head.querySelectorAll('style')).forEach(styleEl => {
    doc.body.insertBefore(styleEl, doc.body.firstChild);
  });

  return doc.body.innerHTML;
}

/**
 * LexicalEditor - The main editor component
 *
 * This is a React functional component. The function receives props (properties)
 * as its parameter and returns JSX (what to display).
 *
 * The parameter uses destructuring to extract specific props:
 * { appContainerId, documents, ... } instead of just (props)
 * This is equivalent to: const appContainerId = props.appContainerId
 *
 * The = after parameters sets default values if the prop isn't provided
 *
 * export default makes this the main export from this file
 *
 * @param {Object} props - Component properties
 * @param {string} props.appContainerId - Unique ID for this editor instance
 * @param {Array} props.documents - Documents to load into editor
 * @param {boolean} props.inlineToolbar - Whether toolbar should stick to top
 * @param {Object} props.editorSizing - Size constraints (min/max height, resize)
 * @param {string} props.toolList - Space-separated list of toolbar buttons
 * @param {boolean} props.editable - Whether editor allows editing
 */
export default function LexicalEditor({
  appContainerId,
  documents,
  inlineToolbar = true,
  editorSizing = { minHeight: '200px', maxHeight: '350px', resize: 'vertical' },
  toolList = 'bold italic underline strikethrough code link unlink ul ol quote undo redo',
  editable = true,
  buildLetterOnComplete = false,
}) {
  /**
   * useState - A React Hook for managing component state
   *
   * State is data that can change over time. When state changes, React
   * re-renders the component to show the updated data.
   *
   * useState returns an array with two items:
   * [currentValue, functionToUpdateValue]
   *
   * We use array destructuring to name them:
   * const [floatingAnchorElem, setFloatingAnchorElem] = useState(null);
   *                ^                    ^                          ^
   *          current value      updater function           initial value
   */
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null);

  // Holds the raw <style>…</style> HTML that Lexical cannot store in its node tree.
  // Written by LoadContentPlugin / applySourceChanges; read by SyncContentPlugin
  // and ToolbarPlugin when opening source view.
  const extraStylesRef = useRef('');

  // DOM ref to the hidden div that holds injected <style> elements.
  // <style> tags apply their CSS globally even inside a display:none container,
  // so the visual editor reflects any custom CSS the user typed in source view.
  const styleContainerRef = useRef(null);

  /**
   * onRef - A callback function passed to a ref attribute
   * Refs in React give you direct access to DOM elements
   * This is called when the element is mounted to the DOM
   */
  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      // Update our state with the DOM element reference
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  /**
   * initialConfig - Configuration object for Lexical editor
   * This tells Lexical how to set up and style the editor
   */
  const initialConfig = {
    // namespace: Unique identifier for this editor instance
    namespace: 'LexicalEditor',

    // theme: Maps Lexical node types to CSS classes
    // This connects Lexical's internal nodes to our CSS styles
    theme: {
      paragraph: 'lexical-paragraph', // Regular paragraphs
      heading: {
        h1: 'lexical-h1',
        h2: 'lexical-h2',
        h3: 'lexical-h3',
        h4: 'lexical-h4',
        h5: 'lexical-h5',
        h6: 'lexical-h6',
      },
      list: {
        ul: 'lexical-ul', // Unordered list (bullets)
        ol: 'lexical-ol', // Ordered list (numbers)
        listitem: 'lexical-listitem', // Individual list items
        listitemChecked: 'lexical-listitem-checked', // Checked checklist item
        listitemUnchecked: 'lexical-listitem-unchecked', // Unchecked checklist item
        nested: {
          listitem: 'lexical-nested-listitem', // Nested list items
        },
      },
      link: 'lexical-link', // Hyperlinks
      table: 'lexical-table', // Table container
      tableRow: 'lexical-table-row', // Table rows
      tableCell: 'lexical-table-cell', // Table cells
      tableCellHeader: 'lexical-table-cell-header', // Table header cells
      text: {
        // Text formatting classes
        bold: 'lexical-bold',
        italic: 'lexical-italic',
        underline: 'lexical-underline',
        strikethrough: 'lexical-strikethrough',
        code: 'lexical-code',
        subscript: 'lexical-subscript',
        superscript: 'lexical-superscript',
      },
    },

    // onError: Function called when editor encounters an error
    // Arrow function: (parameter) => { code } is shorthand for function(parameter) { code }
    onError: (error) => {
      console.error(error); // Log error to browser console
    },

    // nodes: Array of custom node types the editor can use
    // These define what types of content the editor supports
    nodes: [
      HeadingNode, // Enables H1-H6 headings
      ListNode, // Enables lists (ul/ol)
      ListItemNode, // Enables list items (li)
      QuoteNode, // Enables blockquotes
      LinkNode, // Enables hyperlinks
      TableNode, // Enables tables
      TableRowNode, // Enables table rows
      TableCellNode, // Enables table cells
      AddressNode, // Enables <address> blocks
      PreformattedNode, // Enables <pre> blocks
      DivNode, // Enables <div> blocks
      HorizontalRuleNode, // Enables <hr> elements
      RawHtmlNode, // Preserves <table> and other blocks verbatim (priority 4 importDOM)
      // Note: <style> tags are handled outside Lexical's node system via
      // extraStylesRef + extractAndStripStyles — see LoadContentPlugin and
      // SyncContentPlugin for details.
    ],

    // Initial editable state
    editable: editable,
  };

  /**
   * contentEditableStyle - Inline styles for the editable area
   * In React, inline styles are JavaScript objects with camelCase properties
   */
  const contentEditableStyle = {
    minHeight: editorSizing.minHeight, // Minimum height
    maxHeight: editorSizing.maxHeight, // Maximum height (scrolls after this)
    resize: editorSizing.resize, // Allow user to resize ('vertical', 'horizontal', 'both', 'none')
    overflow: 'auto', // Add scrollbars when content exceeds maxHeight
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    outline: 'none', // Remove default focus outline

    // Conditional styling: If not editable, add read-only styling
    // The ... spread operator merges the object on the right
    // !editable is a boolean check (! means NOT)
    // && is logical AND - only executes right side if left side is true
    ...(!editable && { backgroundColor: '#f5f5f5', cursor: 'not-allowed' })
  };

  /**
   * return statement - What the component displays (JSX)
   *
   * JSX looks like HTML but it's actually JavaScript.
   * It gets compiled to React.createElement() calls.
   *
   * Key JSX concepts:
   * - className (not class) for CSS classes
   * - style={{}} for inline styles (double braces: outer is JSX, inner is object)
   * - {variable} to insert JavaScript values
   * - Self-closing tags like <HistoryPlugin />
   */
  return (
    // Outer container with the unique ID
    <div id={appContainerId} className="lexical-editor-container">

      {/* Hidden container for injected <style> elements.
          CSS from <style> tags applies globally even inside display:none,
          so custom styles entered via source view are reflected visually. */}
      <div
        ref={styleContainerRef}
        aria-hidden="true"
        style={{ display: 'none' }}
      />

      {/* LexicalComposer - The root Lexical component
          It creates a "context" that all child plugins can access
          Think of it like a container that holds the editor instance */}
      <LexicalComposer initialConfig={initialConfig}>

        <div className="lexical-editor-wrapper">

          {/* Our custom toolbar with formatting buttons */}
          <ToolbarPlugin
            toolList={toolList}
            inline={inlineToolbar}
            buildLetterOnComplete={buildLetterOnComplete}
            documents={documents}
            extraStylesRef={extraStylesRef}
            styleContainerRef={styleContainerRef}
          />

          <div className="lexical-editor-inner">

            {/* RichTextPlugin - The main editing plugin
                It requires three props: contentEditable, placeholder, and ErrorBoundary */}
            <RichTextPlugin
              // contentEditable prop: The actual editable area
              contentEditable={
                <div className="lexical-editor-scroller">
                  <div className="lexical-editor" ref={onRef}>
                    {/* ContentEditable - The div that users type into.
                        aria-label names the field for screen readers.
                        aria-multiline signals it is a multi-line text editor.
                        role="textbox" is set implicitly by Lexical but we
                        reinforce aria-multiline so assistive tech uses the
                        correct reading mode (not single-line form input mode). */}
                    <ContentEditable
                      className="lexical-content-editable"
                      style={contentEditableStyle}
                      aria-label="Rich text editor. Use the formatting toolbar above to apply styles."
                      aria-multiline="true"
                    />
                  </div>
                </div>
              }

              // placeholder prop: Shown when editor is empty
              placeholder={
                // aria-hidden hides the placeholder from screen readers —
                // the accessible name comes from the ContentEditable aria-label above,
                // so announcing the placeholder text separately would be redundant/confusing.
                <div className="lexical-placeholder" aria-hidden="true" style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  color: '#999',
                  pointerEvents: 'none', // Don't block clicks
                  userSelect: 'none' // Can't be selected
                }}>
                  Enter some text...
                </div>
              }

              // ErrorBoundary prop: Catches errors in the editor
              ErrorBoundary={LexicalErrorBoundary}
            />

            {/* Built-in Lexical plugins - Each adds specific functionality */}
            <HistoryPlugin /> {/* Undo/redo functionality */}
            <ListPlugin /> {/* Bullet and numbered lists */}
            <CheckListPlugin /> {/* Clickable check lists */}
            <TabIndentationPlugin /> {/* Tab key to indent */}
            <AutoFocusPlugin /> {/* Focus editor when page loads */}
            <TablePlugin hasCellMerge={false} hasCellBackgroundColor={false} /> {/* Table functionality */}
            <HorizontalRulePlugin /> {/* Horizontal rule (<hr>) support */}

            {/* Our custom plugins */}
            <LoadContentPlugin
              documents={documents}
              extraStylesRef={extraStylesRef}
              styleContainerRef={styleContainerRef}
            />
            <EditablePlugin editable={editable} />
            <SyncContentPlugin
              documents={documents}
              extraStylesRef={extraStylesRef}
              containerId={appContainerId}
            />
            <ExternalAPIPlugin documents={documents} />

          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}