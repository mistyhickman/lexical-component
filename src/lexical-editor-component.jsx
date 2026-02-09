import React from 'react';
import { createRoot } from 'react-dom/client';
import LexicalEditor from './LexicalEditor';

class LexicalEditorElement extends HTMLElement {
  constructor() {
    super();
    this.root = null;
  }

  connectedCallback() {
    // Parse attributes
    const appContainerId = this.getAttribute('appcontainerid') || 'lexical-container';
    const inlineToolbar = this.getAttribute('inlinetoolbar') !== 'false';
    const editable = this.getAttribute('editable') !== 'false';
    const toolList = this.getAttribute('toollist') || 'bold italic underline strikethrough code link unlink ul ol quote undo redo';
    
    // Parse array/object attributes
    let documents = [];
    let editorSizing = { minHeight: '200px', maxHeight: '350px', resize: 'vertical' };
    let spellCheckCallback = null;

    try {
      const docsAttr = this.getAttribute('aryeditordocuments');
      if (docsAttr) {
        documents = JSON.parse(docsAttr);
      }
    } catch (e) {
      console.error('Error parsing aryeditordocuments:', e);
    }

    try {
      const sizingAttr = this.getAttribute('editorsizing');
      if (sizingAttr) {
        editorSizing = { ...editorSizing, ...JSON.parse(sizingAttr) };
      }
    } catch (e) {
      console.error('Error parsing editorsizing:', e);
    }

    try {
      const spellCheckAttr = this.getAttribute('objspellcheckcallback');
      if (spellCheckAttr) {
        spellCheckCallback = JSON.parse(spellCheckAttr);
      }
    } catch (e) {
      console.error('Error parsing objspellcheckcallback:', e);
    }

    // Create React root and render
    this.root = createRoot(this);
    this.root.render(
      <LexicalEditor
        appContainerId={appContainerId}
        documents={documents}
        inlineToolbar={inlineToolbar}
        editorSizing={editorSizing}
        toolList={toolList}
        editable={editable}
        spellCheckCallback={spellCheckCallback}
      />
    );

    // Add default styles
    if (!document.getElementById('lexical-editor-styles')) {
      const style = document.createElement('style');
      style.id = 'lexical-editor-styles';
      style.textContent = `
        .lexical-editor-container {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .lexical-editor-wrapper {
          border: 1px solid #ccc;
          border-radius: 4px;
          overflow: hidden;
        }
        .lexical-content-editable {
          outline: none;
        }
        .lexical-placeholder {
          position: absolute;
          top: 10px;
          left: 10px;
          color: #999;
          pointer-events: none;
        }
        .lexical-paragraph {
          margin: 0 0 10px 0;
        }
        .lexical-h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0 0 10px 0;
        }
        .lexical-ul, .lexical-ol {
          margin: 0 0 10px 0;
          padding-left: 20px;
        }
        .lexical-listitem {
          margin: 0 0 5px 0;
        }
        .lexical-link {
          color: #0066cc;
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
          text-decoration: line-through;
        }
        .lexical-code {
          background-color: #f0f0f0;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: monospace;
        }
      `;
      document.head.appendChild(style);
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
    }
  }
}

// Register the custom element
customElements.define('lexical-editor', LexicalEditorElement);
