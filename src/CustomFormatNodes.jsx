/**
 * CustomFormatNodes.jsx - Custom Lexical nodes for paragraph format types
 *
 * Provides three custom block-level nodes:
 *   - AddressNode   → renders as <address>
 *   - PreformattedNode → renders as <pre>
 *   - DivNode        → renders as <div>
 *
 * Each node extends ElementNode and implements the full Lexical node API:
 *   getType, clone, createDOM, updateDOM, importDOM, exportDOM, importJSON, exportJSON
 */

import React from 'react';
import { ElementNode, DecoratorNode, $applyNodeReplacement } from 'lexical';

// =====================================================================
// AddressNode — wraps content in an <address> HTML element
// =====================================================================

export class AddressNode extends ElementNode {
  static getType() {
    return 'address';
  }

  static clone(node) {
    return new AddressNode(node.__key);
  }

  createDOM() {
    const el = document.createElement('address');
    return el;
  }

  updateDOM() {
    return false;
  }

  static importDOM() {
    return {
      address: () => ({
        conversion: convertAddressElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('address');
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createAddressNode();
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'address',
      version: 1,
    };
  }
}

function convertAddressElement() {
  return { node: $createAddressNode() };
}

export function $createAddressNode() {
  return $applyNodeReplacement(new AddressNode());
}

export function $isAddressNode(node) {
  return node instanceof AddressNode;
}

// =====================================================================
// PreformattedNode — wraps content in a <pre> HTML element
// =====================================================================

export class PreformattedNode extends ElementNode {
  static getType() {
    return 'preformatted';
  }

  static clone(node) {
    return new PreformattedNode(node.__key);
  }

  createDOM() {
    const el = document.createElement('pre');
    return el;
  }

  updateDOM() {
    return false;
  }

  static importDOM() {
    return {
      pre: () => ({
        conversion: convertPreElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('pre');
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createPreformattedNode();
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'preformatted',
      version: 1,
    };
  }
}

function convertPreElement() {
  return { node: $createPreformattedNode() };
}

export function $createPreformattedNode() {
  return $applyNodeReplacement(new PreformattedNode());
}

export function $isPreformattedNode(node) {
  return node instanceof PreformattedNode;
}

// =====================================================================
// DivNode — wraps content in a <div> HTML element
// =====================================================================

export class DivNode extends ElementNode {
  static getType() {
    return 'custom-div';
  }

  static clone(node) {
    return new DivNode(node.__key);
  }

  createDOM() {
    const el = document.createElement('div');
    return el;
  }

  updateDOM() {
    return false;
  }

  static importDOM() {
    return {
      div: () => ({
        conversion: convertDivElement,
        priority: 0,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('div');
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createDivNode();
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'custom-div',
      version: 1,
    };
  }
}

function convertDivElement() {
  return { node: $createDivNode() };
}

export function $createDivNode() {
  return $applyNodeReplacement(new DivNode());
}

export function $isDivNode(node) {
  return node instanceof DivNode;
}

// =====================================================================
// AttributedDivNode — an EDITABLE <div> that preserves all original
// HTML attributes (class, style, id, data-*, etc.) through round-trips.
//
// Unlike RawHtmlNode (a DecoratorNode), this extends ElementNode so
// Lexical treats it as normal editable content.  Children are imported
// as Lexical child nodes — they remain fully editable.
//
// importDOM priority 2: beats plain DivNode (priority 0) for divs that
// have attributes, but defers to any higher-priority converter.
// =====================================================================

export class AttributedDivNode extends ElementNode {
  static getType() {
    return 'attributed-div';
  }

  static clone(node) {
    return new AttributedDivNode(node.__attributes, node.__key);
  }

  constructor(attributes, key) {
    super(key);
    // Store a plain-object copy so the node is self-contained
    this.__attributes = attributes ? { ...attributes } : {};
  }

  createDOM(config) {
    const el = document.createElement('div');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return el;
  }

  updateDOM(prevNode, dom) {
    const prev = prevNode.__attributes;
    const next = this.__attributes;
    // Remove attributes that were deleted
    for (const name of Object.keys(prev)) {
      if (!(name in next)) dom.removeAttribute(name);
    }
    // Add or update changed attributes
    for (const [name, value] of Object.entries(next)) {
      if (prev[name] !== value) dom.setAttribute(name, value);
    }
    return false; // we updated the DOM manually
  }

  static importDOM() {
    return {
      div: () => ({
        conversion: (element) => {
          if (!element.hasAttributes()) return null;
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          return { node: $createAttributedDivNode(attributes) };
        },
        priority: 2,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('div');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createAttributedDivNode(serializedNode.attributes || {});
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'attributed-div',
      attributes: { ...this.__attributes },
      version: 1,
    };
  }
}

export function $createAttributedDivNode(attributes) {
  return $applyNodeReplacement(new AttributedDivNode(attributes));
}

export function $isAttributedDivNode(node) {
  return node instanceof AttributedDivNode;
}

// =====================================================================
// StyleSheetNode — stores a <style> block
// Stores the full outerHTML of the <style> element so all attributes
// (media, type, etc.) are preserved through the round-trip.
// Inserted into the Lexical node tree manually in applySourceChanges
// and LoadContentPlugin, bypassing @lexical/html's IGNORE_TAGS constant
// which prevents <style> elements from being processed automatically.
// =====================================================================

export class StyleSheetNode extends DecoratorNode {
  static getType() {
    return 'stylesheet';
  }

  static clone(node) {
    return new StyleSheetNode(node.__styleOuterHtml, node.__key);
  }

  constructor(styleOuterHtml, key) {
    super(key);
    this.__styleOuterHtml = styleOuterHtml;
  }

  // Helper: parse __styleOuterHtml back into a real DOM element
  _createElement() {
    const div = document.createElement('div');
    div.innerHTML = this.__styleOuterHtml;
    return div.firstChild || document.createElement('style');
  }

  static importDOM() {
    // NOTE: This conversion is never triggered via $generateNodesFromDOM because
    // @lexical/html hard-codes IGNORE_TAGS = new Set(['STYLE', 'SCRIPT']).
    // StyleSheetNodes are created manually in applySourceChanges / LoadContentPlugin.
    return {
      style: () => ({
        conversion: (element) => ({ node: $createStyleSheetNode(element.outerHTML) }),
        priority: 0,
      }),
    };
  }

  exportDOM() {
    // Reconstruct the original <style> element with all its attributes
    return { element: this._createElement() };
  }

  // Returns an actual <style> element so the CSS rules are applied visually
  // in the editor. Browsers process <style> elements even inside contentEditable.
  createDOM() {
    return this._createElement();
  }

  updateDOM(prevNode) {
    // If the outerHTML changed, tell Lexical to recreate the DOM element
    return prevNode.__styleOuterHtml !== this.__styleOuterHtml;
  }

  static importJSON(serializedNode) {
    // Support both new format (styleOuterHtml) and old format (styleContent)
    const outerHtml = serializedNode.styleOuterHtml
      || `<style>${serializedNode.styleContent || ''}</style>`;
    return $createStyleSheetNode(outerHtml);
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'stylesheet',
      styleOuterHtml: this.__styleOuterHtml,
      version: 1,
    };
  }

  // DecoratorNode requires decorate() — return null to render nothing in the editor
  decorate() {
    return null;
  }
}

export function $createStyleSheetNode(styleOuterHtml) {
  return new StyleSheetNode(styleOuterHtml);
}

// =====================================================================
// RawHtmlNode — preserves arbitrary HTML blocks verbatim
//
// Handles:
//   - <table>  (priority 4, overrides TableNode at priority 1)
//     When loading content from the database, tables are captured here so
//     their original HTML (inline styles, attributes, colgroup, etc.) is
//     stored and re-emitted verbatim.  When source view is being applied
//     back into the editor the global flag window._lexicalApplyingSourceView
//     is set to true, causing the conversion to return null instead — which
//     lets Lexical's own TableNode handle it so the table remains fully
//     editable after a source-view round-trip.
//   - <div> with any attributes (priority 4, overrides DivNode at priority 0)
//     Plain <div> elements (no attributes) fall through to DivNode.
// =====================================================================

export class RawHtmlNode extends DecoratorNode {
  static getType() {
    return 'raw-html';
  }

  static clone(node) {
    return new RawHtmlNode(node.__rawHtml, node.__key);
  }

  constructor(rawHtml, key) {
    super(key);
    this.__rawHtml = rawHtml;
  }

  static importDOM() {
    return {
      // Preserve tables verbatim when loading from the database.
      // When source view is being applied (flag is true), return null so
      // Lexical's TableNode handles the element and the table stays editable.
      table: () => ({
        conversion: (element) => {
          if (window._lexicalApplyingSourceView) return null;
          // after: () => [] suppresses recursive child processing — table rows/cells
          // are already contained in outerHTML and must not become sibling nodes.
          return { node: new RawHtmlNode(element.outerHTML), after: () => [] };
        },
        priority: 4,
      }),
      // Note: <div> elements with attributes are handled by AttributedDivNode
      // (priority 2) which keeps them editable. RawHtmlNode no longer intercepts
      // divs so content inside attribute-bearing divs remains fully editable.
    };
  }

  exportDOM() {
    const container = document.createElement('div');
    container.innerHTML = this.__rawHtml;
    return { element: container.firstElementChild || container };
  }

  createDOM() {
    const el = document.createElement('div');
    el.contentEditable = 'false';
    el.className = 'lexical-raw-block';
    return el;
  }

  updateDOM() {
    return false;
  }

  static importJSON(serializedNode) {
    return new RawHtmlNode(serializedNode.rawHtml);
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'raw-html',
      rawHtml: this.__rawHtml,
      version: 1,
    };
  }

  decorate() {
    // display:contents makes this wrapper div invisible to the layout engine,
    // so the table (or other raw HTML) is laid out as a direct child of the
    // outer contentEditable=false div rather than being buried inside an extra
    // block wrapper that can distort table cell alignment and widths.
    return React.createElement('div', {
      style: { display: 'contents' },
      dangerouslySetInnerHTML: { __html: this.__rawHtml },
    });
  }
}

export function $createRawHtmlNode(rawHtml) {
  return new RawHtmlNode(rawHtml);
}

export function $isRawHtmlNode(node) {
  return node instanceof RawHtmlNode;
}
