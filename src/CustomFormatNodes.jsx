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
