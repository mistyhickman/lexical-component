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

import { ElementNode, $applyNodeReplacement } from 'lexical';

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
