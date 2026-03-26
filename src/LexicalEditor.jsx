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
import { AddressNode, PreformattedNode, DivNode, AttributedDivNode, AttributedTableStructureNode, AttributedHeadingNode, RawHtmlNode } from './CustomFormatNodes'; // Custom format nodes
import { FootnoteMarkerNode, FootnoteSectionNode, FootnotesPlugin } from './FootnotesPlugin'; // Footnotes support
import TableContextMenuPlugin from './TableContextMenu'; // Right-click context menu for table cells

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

/**
 * scopeStylesForEditor - Rewrites CSS selectors inside <style> blocks so they
 * only apply within the editor's content-editable area.
 *
 * Why this is needed:
 *   Without scoping, `td { border: 1px solid black }` in the content's style
 *   tag competes with the application's own `td { ... }` rules on equal footing.
 *   By rewriting it to `.lexical-content-editable td { border: 1px solid black }`,
 *   the content's styles gain higher specificity and win over unscoped application
 *   CSS.  The styles are also contained to the editor so they don't leak out and
 *   affect the rest of the host page.
 *
 * @param {string} stylesHtml - One or more raw <style>…</style> strings
 * @returns {string} The same tags with all selectors scoped to the editor
 */
export function scopeStylesForEditor(stylesHtml) {
  if (!stylesHtml) return stylesHtml;
  const scope = '.lexical-content-editable';
  return stylesHtml.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) => {
    return `<style${attrs}>${_scopeCssBlock(css, scope)}</style>`;
  });
}

function _scopeSelector(selector, scope) {
  return selector.split(',').map(s => {
    const trimmed = s.trim();
    if (!trimmed) return '';
    // Replace page-root selectors with the editor scope itself
    if (/^(html|body|:root)$/i.test(trimmed)) return scope;
    return `${scope} ${trimmed}`;
  }).filter(Boolean).join(', ');
}

function _scopeCssBlock(css, scope) {
  let result = '';
  let i = 0;

  while (i < css.length) {
    // Whitespace — copy through
    if (/\s/.test(css[i])) { result += css[i++]; continue; }

    // Comments — copy through
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) { result += css.slice(i); break; }
      result += css.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // Find next opening brace to determine what kind of block this is
    const braceOpen = css.indexOf('{', i);
    if (braceOpen === -1) { result += css.slice(i); break; }

    const token = css.slice(i, braceOpen).trim();

    // Find matching closing brace (handles nested braces correctly)
    let depth = 1;
    let j = braceOpen + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const block = css.slice(braceOpen + 1, j - 1);

    if (token.startsWith('@')) {
      const keyword = (token.match(/^@(\w+)/) || [])[1] || '';
      if (/^(media|supports|document|layer)$/i.test(keyword)) {
        // Container @rules — recurse so selectors inside are also scoped
        result += `${token} {${_scopeCssBlock(block, scope)}}`;
      } else {
        // @keyframes, @font-face, @charset, etc. — copy verbatim
        result += `${token} {${block}}`;
      }
    } else if (token) {
      result += `${_scopeSelector(token, scope)} {${block}}`;
    }

    i = j;
  }

  return result;
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
    // Selectors are scoped to .lexical-content-editable so they:
    //   (a) only apply inside the editor, not to the rest of the host page, and
    //   (b) win over unscoped application CSS due to the higher specificity.
    if (styleContainerRef?.current) {
      styleContainerRef.current.innerHTML = scopeStylesForEditor(stylesHtml);
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
        // Lexical's HTML for the editable content.
        // Strip any stray <style> tags from lexicalHtml — styles are managed
        // exclusively via extraStylesRef so they never appear twice.
        const { strippedHtml: lexicalHtml } = extractAndStripStyles(
          cleanExportedHtml($generateHtmlFromNodes(editor))
        );

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

  // 1. Remove class attributes that only contain lexical- prefixed classes.
  //    Exception: table elements keep their lexical-* classes so that
  //    LexicalTable.css styling survives the save → reload cycle.
  //    When reloaded, AttributedTableStructureNode preserves these classes in
  //    __attributes and re-applies them to the DOM, so the CSS keeps working.
  const TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th']);
  doc.querySelectorAll('[class]').forEach(el => {
    if (TABLE_TAGS.has(el.tagName.toLowerCase())) return;
    const remaining = Array.from(el.classList).filter(c => !c.startsWith('lexical-'));
    if (remaining.length === 0) {
      el.removeAttribute('class');
    } else {
      el.className = remaining.join(' ');
    }
  });

  // 1b. Strip auto-generated inline styles from toolbar-created table cells
  //     (identifiable by their lexical-table-cell / lexical-table-cell-header class).
  //     TableCellNode.exportDOM() adds border, width, vertical-align, text-align,
  //     and background-color inline styles that duplicate — and override — what
  //     the CSS class already provides.  Removing them lets the CSS class apply
  //     cleanly after reload, giving a consistent appearance to the user.
  doc.querySelectorAll('td.lexical-table-cell, th.lexical-table-cell-header').forEach(cell => {
    cell.style.removeProperty('border');
    cell.style.removeProperty('width');
    cell.style.removeProperty('vertical-align');
    cell.style.removeProperty('text-align');
    cell.style.removeProperty('background-color');
    if (cell.style.length === 0) cell.removeAttribute('style');
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

  // 4. Strip white-space: pre-wrap from inline text-formatting elements.
  //    Lexical adds this artifact to <strong>, <em>, <u>, <s>, <code>,
  //    <sub>, and <sup> for the same whitespace-preservation reason it adds
  //    it to spans.  Unlike spans, we do NOT unwrap these elements because
  //    they carry semantic meaning (bold, italic, etc.).  We only remove
  //    the artifact style; if the style attribute becomes empty afterward
  //    we remove it entirely so the saved HTML stays clean.
  doc.querySelectorAll('strong[style],em[style],u[style],s[style],code[style],sub[style],sup[style],b[style],i[style]').forEach(el => {
    const cleanStyle = (el.getAttribute('style') || '')
      .replace(/white-space:\s*pre-wrap;?\s*/g, '')
      .trim();
    if (!cleanStyle) {
      el.removeAttribute('style');
    } else {
      el.setAttribute('style', cleanStyle);
    }
  });

  // 5. Remove empty paragraphs from the exported HTML.
  //    Lexical exports blank lines as <p><br></p>. The <br> exists only so
  //    the browser gives the empty paragraph visible height while editing.
  //    PDF renderers (CFPDF, iText, etc.) treat both the <br> and the <p>
  //    as real content, producing large unwanted gaps. Removing them entirely
  //    keeps the export clean — paragraph spacing in the PDF is handled by
  //    the renderer's own default paragraph margins.
  doc.querySelectorAll('p').forEach(p => {
    const children = Array.from(p.childNodes);
    const isEmpty =
      children.length === 0 ||
      (children.length === 1 && children[0].nodeName === 'BR');
    if (isEmpty) p.parentNode.removeChild(p);
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
  footnotesConfig = null,
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
      HeadingNode, // Enables H1-H6 headings (toolbar-created headings use this)
      AttributedHeadingNode, // Preserves style/class/id attrs on h1-h6 from HTML import (priority 2)
      ListNode, // Enables lists (ul/ol)
      ListItemNode, // Enables list items (li)
      QuoteNode, // Enables blockquotes
      LinkNode, // Enables hyperlinks
      TableNode, // Enables tables
      TableRowNode, // Enables table rows
      TableCellNode, // Enables table cells
      AddressNode, // Enables <address> blocks
      PreformattedNode, // Enables <pre> blocks
      DivNode, // Enables plain <div> blocks (no attributes, priority 0)
      AttributedDivNode, // Enables <div> blocks with attributes (class/style/id/data-*, priority 2) — editable
      AttributedTableStructureNode, // Enables <table>/<thead>/<tbody>/<tfoot>/<tr>/<td>/<th> with attributes (priority 2) — editable
      HorizontalRuleNode, // Enables <hr> elements
      RawHtmlNode, // Kept for backward-compatibility with serialized 'raw-html' nodes; no longer intercepts any DOM elements
      FootnoteMarkerNode, // Inline <sup data-footnote-id> reference markers
      FootnoteSectionNode, // Block <section class="footnotes"> list at end of doc
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
  // Tracks whether the editor wrapper has focus — used to expand the content area
  const [isExpanded, setIsExpanded] = useState(false);

  const contentEditableStyle = {
    minHeight: editorSizing.minHeight, // Minimum height
    // When expanded, remove the max-height cap so all content is visible
    ...(isExpanded ? {} : { maxHeight: editorSizing.maxHeight }),
    resize: isExpanded ? 'none' : editorSizing.resize, // Disable resize handle when expanded
    overflow: isExpanded ? 'visible' : 'auto', // Let content flow when expanded
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    outline: 'none', // Remove default focus outline

    // Conditional styling: If not editable, add read-only styling
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

        <div
          className="lexical-editor-wrapper"
          onFocus={() => setIsExpanded(true)}
          onBlur={(e) => {
            // Only collapse when focus leaves the entire wrapper (not when
            // moving between toolbar buttons and the editor content area)
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsExpanded(false);
            }
          }}
        >

          {/* Our custom toolbar with formatting buttons */}
          <ToolbarPlugin
            toolList={toolList}
            inline={inlineToolbar}
            buildLetterOnComplete={buildLetterOnComplete}
            documents={documents}
            extraStylesRef={extraStylesRef}
            styleContainerRef={styleContainerRef}
            footnotesConfig={footnotesConfig}
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
            <TablePlugin hasCellMerge={true} hasCellBackgroundColor={false} /> {/* Table functionality */}
            <HorizontalRulePlugin /> {/* Horizontal rule (<hr>) support */}
            <TableContextMenuPlugin /> {/* Right-click context menu for table cells */}

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
            <FootnotesPlugin footnotesConfig={footnotesConfig || {}} />

          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}