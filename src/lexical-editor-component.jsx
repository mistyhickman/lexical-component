// Import React library
import React from 'react';
// Import createRoot - React 18's new way to render components into the DOM
import { createRoot } from 'react-dom/client';
// Import our main Lexical editor React component
import LexicalEditor from './LexicalEditor';
// Import table CSS
import './LexicalTable.css';

/**
 * LexicalEditorElement - A Web Component wrapper for our React-based Lexical editor
 *
 * Why Web Components? They allow us to create custom HTML elements (like <lexical-editor>)
 * that can be used in any HTML page or any page for that matter.
 *
 * HTMLElement is the base class for all HTML elements in the browser
 */
class LexicalEditorElement extends HTMLElement {
  /**
   * Constructor - Called when a new <lexical-editor> element is created
   * This runs BEFORE the element is added to the page
   */
  constructor() {
    // Call the parent class (HTMLElement) constructor
    super();
    // Initialize a property to hold our React root (null until we render)
    this.root = null;
  }

  /**
   * connectedCallback - A Web Component lifecycle method
   * This is automatically called when the element is added to the DOM (the page)
   * This is where we set up our React component
   */
  connectedCallback() {
    // ===== PARSE HTML ATTRIBUTES =====
    // HTML attributes are the values set in the HTML tag, like:
    // <lexical-editor appcontainerid="my-editor" editable="true"></lexical-editor>

    // Get the container ID, or use a default if not provided
    // The || operator means "if left side is falsy, use right side"
    const appContainerId = this.getAttribute('appcontainerid') || 'lexical-container';

    // Check if inline toolbar should be shown
    // !== 'false' means "true unless explicitly set to 'false'"
    const inlineToolbar = this.getAttribute('inlinetoolbar') !== 'false';

    // Check if editor should be editable
    const editable = this.getAttribute('editable') !== 'false';

    // Get the list of tools to show in toolbar, or use defaults
    const toolList = this.getAttribute('toollist') || 'bold italic underline strikethrough code link unlink ul ol quote undo redo';

    // ===== PARSE COMPLEX ATTRIBUTES (JSON) =====
    // Some attributes contain JSON data (arrays or objects) that need special parsing

    // Initialize with default values
    let documents = []; // Will hold array of document objects with content to load
    let editorSizing = { minHeight: '200px', maxHeight: '350px', resize: 'vertical' }; // Default editor dimensions
    let spellCheckCallback = null; // Optional spell check configuration

    // Try to parse the documents array
    // We use try/catch because JSON.parse() will throw an error if the JSON is invalid
    try {
      const docsAttr = this.getAttribute('aryeditordocuments');
      if (docsAttr) {
        // Sanitize the JSON string before parsing:
        // Database content often contains raw line breaks, carriage returns, and tabs
        // which are invalid control characters inside JSON strings.
        // This replaces them with their properly escaped equivalents.
        const sanitized = docsAttr
          .replace(/\r\n/g, '\\n')  // Windows-style line breaks
          .replace(/\r/g, '\\n')    // Old Mac-style line breaks
          .replace(/\n/g, '\\n')    // Unix-style line breaks
          .replace(/\t/g, '\\t');   // Tab characters

        documents = JSON.parse(sanitized);
      }
    } catch (e) {
      // If parsing fails (malformed JSON), log the error to browser console
      console.error('Error parsing aryeditordocuments:', e);
    }

    // Try to parse the editor sizing configuration
    try {
      const sizingAttr = this.getAttribute('editorsizing');
      if (sizingAttr) {
        // The spread operator (...) merges objects
        // Example: { minHeight: '200px', maxHeight: '350px' } + { maxHeight: '500px' }
        //       => { minHeight: '200px', maxHeight: '500px' }
        // This keeps defaults but allows overriding specific properties
        editorSizing = { ...editorSizing, ...JSON.parse(sizingAttr) };
      }
    } catch (e) {
      console.error('Error parsing editorsizing:', e);
    }

    // Try to parse the spell check callback configuration
    try {
      const spellCheckAttr = this.getAttribute('objspellcheckcallback');
      if (spellCheckAttr) {
        spellCheckCallback = JSON.parse(spellCheckAttr);
      }
    } catch (e) {
      console.error('Error parsing objspellcheckcallback:', e);
    }

    // ===== CREATE AND RENDER THE REACT COMPONENT =====

    // createRoot() creates a React "root" that manages rendering React components into a DOM element
    // 'this' refers to the <lexical-editor> element itself
    this.root = createRoot(this);

    // render() displays our React component inside the root
    // JSX syntax (looks like HTML) is used to create React elements
    this.root.render(
      // <LexicalEditor> creates an instance of our LexicalEditor component
      // Everything between the opening and closing tags are "props" (properties)
      // Props are how we pass data from parent to child components in React
      <LexicalEditor
        // Pass all the parsed attributes as props to the React component
        appContainerId={appContainerId}        // ID for the editor container
        documents={documents}                  // Array of documents to load
        inlineToolbar={inlineToolbar}          // Whether toolbar should be inline
        editorSizing={editorSizing}            // Size configuration object
        toolList={toolList}                    // String of tools to show
        editable={editable}                    // Whether editor is editable
        spellCheckCallback={spellCheckCallback} // Spell check configuration
      />
    );

    // ===== ADD DEFAULT CSS STYLES =====

    // Check if styles have already been added to the page
    // We only want to add them once, even if there are multiple editors
    if (!document.getElementById('lexical-editor-styles')) {
      // Create a new <style> element (like <style> tags in HTML)
      const style = document.createElement('style');
      // Give it an ID so we can check if it exists later
      style.id = 'lexical-editor-styles';
      // Set the CSS content using a template literal (backticks allow multi-line strings)
      style.textContent = `
        /* Main container for the entire editor */
        .lexical-editor-container {
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* Wrapper that contains toolbar and editor */
        .lexical-editor-wrapper {
          border: 1px solid #ccc;
          border-radius: 4px;
          overflow: hidden; /* Prevent content from spilling out */
        }

        /* Inner wrapper for positioning */
        .lexical-editor-inner {
          position: relative; /* Allows absolute positioning of children */
        }

        /* Scrollable area for editor content */
        .lexical-editor-scroller {
          position: relative;
          overflow: auto; /* Add scrollbars when content overflows */
        }

        /* Main editor area */
        .lexical-editor {
          position: relative;
        }

        /* The actual editable content area */
        .lexical-content-editable {
          outline: none; /* Remove browser's default focus outline */
          position: relative;
        }

        /* Placeholder text shown when editor is empty */
        .lexical-placeholder {
          position: absolute; /* Position over the editor */
          top: 10px;
          left: 10px;
          color: #999; /* Gray text */
          pointer-events: none; /* Don't block clicks to editor */
          user-select: none; /* Can't be selected/highlighted */
        }
        /* Paragraph styling */
        .lexical-paragraph {
          margin: 0 0 10px 0; /* Bottom margin only */
        }

        /* Heading styles - Different sizes for different heading levels */
        .lexical-h1 {
          font-size: 2em; /* 2x normal size */
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h2 {
          font-size: 1.5em; /* 1.5x normal size */
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h3 {
          font-size: 1.17em; /* Slightly larger than normal */
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h4 {
          font-size: 1em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h5 {
          font-size: 0.83em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h6 {
          font-size: 0.67em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }

        /* Code/Preformatted block */
        .lexical-code-block {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 10px;
          margin: 0 0 10px 0;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        /* List styling - Both unordered (ul) and ordered (ol) lists */
        .lexical-ul, .lexical-ol {
          margin: 0 0 10px 0;
          padding-left: 20px; /* Indent the list */
        }
        .lexical-ul {
          list-style-type: disc; /* Bullet points */
        }
        .lexical-ol {
          list-style-type: decimal; /* Numbers: 1, 2, 3... */
        }
        .lexical-listitem {
          margin: 0 0 5px 0;
        }
        .lexical-nested-listitem {
          list-style-type: none;
        }
        .lexical-nested-listitem:before {
          content: '';
        }
        ul.lexical-ul ul.lexical-ul {
          list-style-type: circle;
        }
        ul.lexical-ul ul.lexical-ul ul.lexical-ul {
          list-style-type: square;
        }
        ol.lexical-ol ol.lexical-ol {
          list-style-type: lower-alpha;
        }
        ol.lexical-ol ol.lexical-ol ol.lexical-ol {
          list-style-type: lower-roman;
        }

        /* Checklist styles */
        .lexical-listitem-checked,
        .lexical-listitem-unchecked {
          position: relative;
          list-style-type: none;
          padding-left: 24px;
          margin-left: -24px;
          cursor: pointer;
        }
        .lexical-listitem-checked::before,
        .lexical-listitem-unchecked::before {
          content: '';
          position: absolute;
          left: 0;
          top: 4px;
          width: 16px;
          height: 16px;
          border: 2px solid #999;
          border-radius: 3px;
          background-color: #fff;
          cursor: pointer;
        }
        .lexical-listitem-checked::before {
          background-color: #4a90d9;
          border-color: #4a90d9;
        }
        .lexical-listitem-checked::after {
          content: '';
          position: absolute;
          left: 6px;
          top: 6px;
          width: 5px;
          height: 10px;
          border: solid #fff;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .lexical-listitem-checked {
          text-decoration: line-through;
          color: #999;
        }

        /* Text formatting styles */
        .lexical-link {
          color: #0066cc; /* Blue color for links */
          text-decoration: underline;
        }
        .lexical-bold {
          font-weight: bold;
        }
        .lexical-italic {
          font-style: italic;
        }
        .lexical-underline {
          text-decoration: underline;
        }
        .lexical-strikethrough {
          text-decoration: line-through; /* Line through the middle */
        }
        .lexical-code {
          background-color: #f0f0f0; /* Light gray background */
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace; /* Fixed-width font like code editors */
        }
        .lexical-subscript {
          font-size: 0.75em; /* Smaller text */
          vertical-align: sub; /* Below the baseline (like H₂O) */
        }
        .lexical-superscript {
          font-size: 0.75em; /* Smaller text */
          vertical-align: super; /* Above the baseline (like X²) */
        }
      `;
      // Add the <style> element to the document's <head>
      document.head.appendChild(style);
    }
  }

  /**
   * disconnectedCallback - Another Web Component lifecycle method
   * Called when the element is removed from the DOM (the page)
   * This is where we clean up to prevent memory leaks
   */
  disconnectedCallback() {
    if (this.root) {
      // Unmount the React component and clean up its resources
      this.root.unmount();
    }
  }
}

/**
 * Register our custom element with the browser
 * After this line, we can use <lexical-editor> in any HTML page
 * The browser will automatically create instances of LexicalEditorElement
 * when it encounters <lexical-editor> tags
 */
customElements.define('lexical-editor', LexicalEditorElement);