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
  $createHeadingNode, // Create heading nodes (H1-H6)
  $createQuoteNode, // Create blockquote nodes
  HeadingTagType
} from '@lexical/rich-text';

// Custom format nodes (address, pre, div)
import { $createAddressNode, $createPreformattedNode, $createDivNode } from './CustomFormatNodes';

// More selection utilities
import { $setBlocksType, $patchStyleText } from '@lexical/selection';

// Horizontal rule (line separator)
import { $createHorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';

// Table utilities
import TableCreatorPlugin from './TableCreatorPlugin';

// Source code view plugin
import SourceCodePlugin from './SourceCodePlugin';

// HTML cleanup utility
import { cleanExportedHtml } from './LexicalEditor';

// Color picker
import ColorPickerPlugin from './ColorPickerPlugin';



/**
 * LowPriority constant - Used for command priority
 * When multiple listeners exist for a command, lower numbers run first
 * 1 is a low priority (runs last)
 */
const LowPriority = 1;

/**
 * ToolbarPlugin - Main toolbar component
 *
 * @param {Object} props
 * @param {string} props.toolList - Space-separated list of tools to show
 * @param {boolean} props.inline - Whether toolbar should stick to top when scrolling
 */
export default function ToolbarPlugin({ toolList, inline = true, buildLetterOnComplete = false, documents = [] }) {
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
  const [fontSize, setFontSize] = useState('16px');
  const [fontFamily, setFontFamily] = useState('default');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSource, setShowSource] = useState(false); // HTML source view
  const [sourceHTML, setSourceHTML] = useState(''); // HTML content for source view
  const [sourceError, setSourceError] = useState(null); // Error for source view

  // Table creator popover state
  const [tableAnchorEl, setTableAnchorEl] = useState(null);

  // Color picker popover states
  const [textColorAnchorEl, setTextColorAnchorEl] = useState(null);
  const [bgColorAnchorEl, setBgColorAnchorEl] = useState(null);

  /**
   * useRef - Creates a reference to a DOM element
   * Unlike state, changing a ref doesn't cause a re-render
   * Refs are useful for accessing DOM elements directly
   */
  const fontSizeRef = useRef(null);

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
    document.execCommand('copy');
  };

  const handleCut = () => {
    document.execCommand('cut');
  };

  const handlePaste = () => {
    document.execCommand('paste');
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
    const footnoteText = prompt('Enter footnote text:');
    if (footnoteText) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(`[${footnoteText}]`);
        }
      });
    }
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
    // querySelector finds the first element matching the CSS selector
    const container = document.querySelector('.lexical-editor-container');

    if (container) {
      if (!isMaximized) {
        // Maximize: Make editor fill the entire screen
        container.style.position = 'fixed'; // Fixed position relative to viewport
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw'; // 100% of viewport width
        container.style.height = '100vh'; // 100% of viewport height
        container.style.zIndex = '9999'; // Very high z-index to appear on top
        container.style.backgroundColor = 'white';
        setIsMaximized(true);
      } else {
        // Restore: Clear all the styles we added
        // Setting to '' removes the inline style
        container.style.position = '';
        container.style.top = '';
        container.style.left = '';
        container.style.width = '';
        container.style.height = '';
        container.style.zIndex = '';
        container.style.backgroundColor = '';
        setIsMaximized(false);
      }
    }
  };

  // ===== SOURCE CODE VIEW =====
  /**
   * toggleSource - Shows/hides the HTML source code view
   * This lets users see and edit the raw HTML of their content
   */
  const toggleSource = () => {
    if (!showSource) {
      // Switching TO source view: use stored raw HTML if available (set by a previous
      // source edit), otherwise generate from the current Lexical editor state
      const fieldId = documents?.[0]?.id;
      const storedRawHtml = fieldId && window._lexicalRawHtml?.[fieldId];

      if (storedRawHtml) {
        setSourceHTML(storedRawHtml);
        setShowSource(true);
      } else {
        editor.getEditorState().read(() => {
          const htmlString = cleanExportedHtml($generateHtmlFromNodes(editor, null));
          setSourceHTML(htmlString);
          setShowSource(true);
        });
      }
    } else {
      // Switching AWAY from source view: Apply the edited HTML back to the editor
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
   * applySourceChanges - Applies edited HTML back to the editor
   * Currently simplified - parses HTML and inserts as plain text
   * A more advanced version would preserve HTML structure
   */
  const applySourceChanges = () => {
    try {
      // Store the raw source HTML verbatim and write it directly to the hidden field.
      // This bypasses Lexical's lossy import/export so the exact HTML the user typed
      // is always preserved — including <style> tags, comments, custom attributes, etc.
      if (!window._lexicalRawHtml) window._lexicalRawHtml = {};
      const fieldId = documents?.[0]?.id;
      if (fieldId) {
        window._lexicalRawHtml[fieldId] = sourceHTML;
        const hiddenField = document.getElementById(fieldId);
        if (hiddenField) hiddenField.value = sourceHTML;
      }

      // Import into Lexical for visual display (best-effort — some tags may not render
      // visually but the raw HTML above is the source of truth for saving/viewing source)
      editor.update(() => {
        // Clear all existing content
        const root = $getRoot();
        root.clear();

        // Parse the HTML string into a DOM document
        const parser = new DOMParser();
        const dom = parser.parseFromString(sourceHTML, 'text/html');

        // DOMParser moves <style> tags to <head> — move them back to <body>
        // so $generateNodesFromDOM can attempt to process them
        Array.from(dom.head.querySelectorAll('style')).forEach(styleEl => {
          dom.body.insertBefore(styleEl, dom.body.firstChild);
        });

        // Convert the parsed HTML DOM into Lexical nodes, preserving all formatting
        const nodes = $generateNodesFromDOM(editor, dom);

        // Append each node to the root
        // Root can only accept block-level nodes (ElementNode, DecoratorNode)
        // Inline nodes (text, line breaks) must be wrapped in a paragraph first
        nodes.forEach(node => {
          if ($isElementNode(node) || $isDecoratorNode(node)) {
            root.append(node);
          } else {
            const paragraph = $createParagraphNode();
            paragraph.append(node);
            root.append(paragraph);
          }
        });
      }, { tag: 'source-import' }); // Tells SyncContentPlugin to skip this update

      // Clear error and hide source view after applying changes
      setSourceError(null);
      setShowSource(false);
    } catch (error) {
      // Set error message to display in the plugin
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
          newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
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
          $setBlocksType(selection, () => $createHeadingNode(formatType));
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
    <>
      {/* Main toolbar container */}
      <div className="lexical-toolbar" style={toolbarStyle}>

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

        {tools.includes('formatblock') && <div style={separatorStyle}></div>}

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
        {(tools.includes('undo') || tools.includes('redo')) && <div style={separatorStyle}></div>}

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
        >
          X<sub>2</sub>
        </button>
      )}
      {tools.includes('superscript') && (
        <button
            type="button"
          onClick={formatSuperscript}
          style={isSuperscript ? activeButtonStyle : buttonStyle}
          title="Superscript"
          aria-label="Superscript"
        >
          X<sup>2</sup>
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

      {(tools.includes('bold') || tools.includes('italic') || tools.includes('underline')) && <div style={separatorStyle}></div>}

      {tools.includes('alignleft') && (
        <button
            type="button"
          onClick={formatAlignLeft}
          style={buttonStyle}
          title="Align Left"
          aria-label="Align Left"
        >
          ≡
        </button>
      )}
      {tools.includes('aligncenter') && (
        <button
            type="button"
          onClick={formatAlignCenter}
          style={buttonStyle}
          title="Align Center"
          aria-label="Align Center"
        >
          ≣
        </button>
      )}
      {tools.includes('alignright') && (
        <button
            type="button"
          onClick={formatAlignRight}
          style={buttonStyle}
          title="Align Right"
          aria-label="Align Right"
        >
          ≡̅
        </button>
      )}
      {tools.includes('alignjustify') && (
        <button
            type="button"
          onClick={formatAlignJustify}
          style={buttonStyle}
          title="Justify"
          aria-label="Justify"
        >
          ≡
        </button>
      )}

      {(tools.includes('alignleft') || tools.includes('aligncenter')) && <div style={separatorStyle}></div>}

      {tools.includes('bullist') && (
        <button
            type="button"
          onClick={insertBulletList}
          style={buttonStyle}
          title="Bullet List"
          aria-label="Bullet List"
        >
          ⁃
        </button>
      )}
      {tools.includes('numlist') && (
        <button
            type="button"
          onClick={insertNumberList}
          style={buttonStyle}
          title="Numbered List"
          aria-label="Numbered List"
        >
          1.
        </button>
      )}
      {tools.includes('checklist') && (
        <button
            type="button"
          onClick={insertCheckList}
          style={buttonStyle}
          title="Check List"
          aria-label="Check List"
        >
          ☑
        </button>
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

      {(tools.includes('bullist') || tools.includes('numlist')) && <div style={separatorStyle}></div>}

      {tools.includes('copy') && (
        <button
            type="button"
          onClick={handleCopy}
          style={buttonStyle}
          title="Copy"
          aria-label="Copy"
        >
          📋
        </button>
      )}
      {tools.includes('cut') && (
        <button
            type="button"
          onClick={handleCut}
          style={buttonStyle}
          title="Cut"
          aria-label="Cut"
        >
          ✂️
        </button>
      )}
      {tools.includes('paste') && (
        <button
            type="button"
          onClick={handlePaste}
          style={buttonStyle}
          title="Paste"
          aria-label="Paste"
        >
          📄
        </button>
      )}
      {tools.includes('pasteword') && (
        <button
            type="button"
          onClick={handlePasteWord}
          style={buttonStyle}
          title="Paste as Plain Text"
          aria-label="Paste as Plain Text"
        >
          📝
        </button>
      )}

      {(tools.includes('copy') || tools.includes('paste')) && <div style={separatorStyle}></div>}

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
          <option value="default">Default</option>
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
        >
          <span style={{ backgroundColor: '#ffff00', padding: '0 3px', lineHeight: '1' }}>A</span>
        </button>
      )}

      {(tools.includes('textcolor') || tools.includes('bgcolor')) && <div style={separatorStyle}></div>}

      {tools.includes('table') && (
        <button
            type="button"
          onClick={handleTableClick}
          style={buttonStyle}
          title="Insert Table"
          aria-label="Insert Table"
        >
          ⊞
        </button>
      )}
      {tools.includes('footnote') && (
        <button
            type="button"
          onClick={insertFootnote}
          style={buttonStyle}
          title="Insert Footnote"
          aria-label="Insert Footnote"
        >
          †
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

      {(tools.includes('table') || tools.includes('horizontalrule')) && <div style={separatorStyle}></div>}

      {tools.includes('maximize') && (
        <button
            type="button"
          onClick={toggleMaximize}
          style={isMaximized ? activeButtonStyle : buttonStyle}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label="Maximize"
        >
          {isMaximized ? '⊡' : '⊞'}
        </button>
      )}
      {tools.includes('source') && (
        <button
            type="button"
          onClick={toggleSource}
          style={showSource ? activeButtonStyle : buttonStyle}
          title="View Source"
          aria-label="View Source"
        >
          {'<>'}
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

    {/* End of toolbar and source view */}
    </>
  );
}