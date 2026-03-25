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
import { ElementNode, DecoratorNode, $applyNodeReplacement, $createParagraphNode } from 'lexical';

// =====================================================================
// AddressNode — wraps content in an <address> HTML element
// =====================================================================

export class AddressNode extends ElementNode {
  static getType() {
    return 'address';
  }

  static clone(node) {
    return new AddressNode(node.__attributes, node.__key);
  }

  constructor(attributes, key) {
    super(key);
    this.__attributes = attributes ? { ...attributes } : {};
  }

  createDOM() {
    const el = document.createElement('address');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return el;
  }

  updateDOM(prevNode, dom) {
    const prev = prevNode.__attributes;
    const next = this.__attributes;
    for (const name of Object.keys(prev)) {
      if (!(name in next)) dom.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(next)) {
      if (prev[name] !== value) dom.setAttribute(name, value);
    }
    return false;
  }

  static importDOM() {
    return {
      address: () => ({
        conversion: (element) => {
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          return { node: $createAddressNode(attributes) };
        },
        priority: 0,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('address');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createAddressNode(serializedNode.attributes || {});
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'address',
      attributes: { ...this.__attributes },
      version: 1,
    };
  }
}

export function $createAddressNode(attributes) {
  return $applyNodeReplacement(new AddressNode(attributes || {}));
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
    return new PreformattedNode(node.__attributes, node.__key);
  }

  constructor(attributes, key) {
    super(key);
    this.__attributes = attributes ? { ...attributes } : {};
  }

  createDOM() {
    const el = document.createElement('pre');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return el;
  }

  updateDOM(prevNode, dom) {
    const prev = prevNode.__attributes;
    const next = this.__attributes;
    for (const name of Object.keys(prev)) {
      if (!(name in next)) dom.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(next)) {
      if (prev[name] !== value) dom.setAttribute(name, value);
    }
    return false;
  }

  static importDOM() {
    return {
      pre: () => ({
        conversion: (element) => {
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          return { node: $createPreformattedNode(attributes) };
        },
        priority: 0,
      }),
    };
  }

  exportDOM(editor) {
    const el = document.createElement('pre');
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createPreformattedNode(serializedNode.attributes || {});
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'preformatted',
      attributes: { ...this.__attributes },
      version: 1,
    };
  }
}

export function $createPreformattedNode(attributes) {
  return $applyNodeReplacement(new PreformattedNode(attributes || {}));
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
// AttributedHeadingNode — an EDITABLE heading that preserves all original
// HTML attributes (style, class, id, data-*, etc.) through round-trips.
//
// Extends ElementNode (not Lexical's built-in HeadingNode) so it is fully
// independent and doesn't inherit HeadingNode's attribute-stripping behavior.
//
// importDOM priority 2: beats HeadingNode (priority 0) for any h1-h6 element
// that arrives from DOM import (initial load or source-view apply).
//
// Toolbar-created headings use $createAttributedHeadingNode() directly with
// empty attributes {}.  When saved to the hidden field and reloaded they come
// back through importDOM at priority 2 — also as AttributedHeadingNode instances.
// =====================================================================

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Default heading sizes used for the live editor display.
// These are applied as inline !important styles in createDOM/updateDOM so they
// beat any host-application CSS reset regardless of specificity.
// They do NOT appear in the saved/exported HTML because exportDOM() creates a
// fresh element from __attributes only (no theme class, no inline overrides).
const _HEADING_SIZES = {
  h1: '2em', h2: '1.5em', h3: '1.17em', h4: '1em', h5: '0.83em', h6: '0.67em',
};

// Apply inline !important visual overrides for heading font-size and font-weight.
// Skipped for headings that already carry an explicit font-size/font-weight in
// their preserved style attribute (honouring the author's intent from the DB).
function _applyHeadingDisplayStyles(el, tag, preservedStyle) {
  const style = preservedStyle || '';
  if (!/font-size\s*:/i.test(style) && _HEADING_SIZES[tag]) {
    el.style.setProperty('font-size', _HEADING_SIZES[tag], 'important');
  }
  if (!/font-weight\s*:/i.test(style)) {
    el.style.setProperty('font-weight', 'bold', 'important');
  }
}

export class AttributedHeadingNode extends ElementNode {
  static getType() {
    return 'attributed-heading';
  }

  static clone(node) {
    return new AttributedHeadingNode(node.__tag, node.__attributes, node.__key);
  }

  constructor(tag, attributes, key) {
    super(key);
    this.__tag = tag || 'h1';
    this.__attributes = attributes ? { ...attributes } : {};
  }

  createDOM(config) {
    const el = document.createElement(this.__tag);
    // Apply preserved attributes first (style, class, id, data-*, etc.)
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    // Add the theme class so CSS-based heading rules also apply where possible.
    // cleanExportedHtml() removes lexical-* classes on export so the original
    // class attribute is not polluted after a save → reload cycle.
    const themeClass = config.theme?.heading?.[this.__tag];
    if (themeClass) el.classList.add(themeClass);
    // Apply inline !important heading display styles so the heading looks correct
    // inside the editor regardless of the host application's CSS reset rules.
    // These inline styles are editor-only: exportDOM() creates a fresh element
    // from __attributes and never copies them to the saved HTML.
    _applyHeadingDisplayStyles(el, this.__tag, this.__attributes.style);
    return el;
  }

  updateDOM(prevNode, dom) {
    // A tag-name change requires Lexical to recreate the DOM element entirely.
    if (prevNode.__tag !== this.__tag) return true;
    const prev = prevNode.__attributes;
    const next = this.__attributes;
    for (const name of Object.keys(prev)) {
      if (!(name in next)) dom.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(next)) {
      if (prev[name] !== value) dom.setAttribute(name, value);
    }
    // Re-apply inline heading display styles after any attribute update because
    // setAttribute('style', ...) replaces the entire style attribute and would
    // strip the overrides added by createDOM / a previous updateDOM call.
    _applyHeadingDisplayStyles(dom, this.__tag, next.style);
    return false;
  }

  static importDOM() {
    const conversions = {};
    for (const tag of HEADING_TAGS) {
      conversions[tag] = () => ({
        conversion: (element) => {
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          return { node: $createAttributedHeadingNode(tag, attributes) };
        },
        priority: 2,
      });
    }
    return conversions;
  }

  exportDOM(editor) {
    const el = document.createElement(this.__tag);
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createAttributedHeadingNode(
      serializedNode.tag || 'h1',
      serializedNode.attributes || {}
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  // When Enter is pressed inside a heading, insert a plain paragraph after it.
  // Without this override, ElementNode.insertNewAfter() returns null and the
  // key press is swallowed entirely.
  insertNewAfter(selection, restoreSelection = true) {
    const newElement = $createParagraphNode();
    newElement.setDirection(this.getDirection());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'attributed-heading',
      tag: this.__tag,
      attributes: { ...this.__attributes },
      version: 1,
    };
  }
}

export function $createAttributedHeadingNode(tag, attributes) {
  return $applyNodeReplacement(new AttributedHeadingNode(tag, attributes));
}

export function $isAttributedHeadingNode(node) {
  return node instanceof AttributedHeadingNode;
}

// =====================================================================
// AttributedTableStructureNode — EDITABLE nodes for all table elements
//
// Handles: <table> <thead> <tbody> <tfoot> <tr> <td> <th>
//
// A single node class covers the entire table element family.
// __tagName stores which HTML element to create; __attributes stores
// all original HTML attributes (border, cellpadding, colspan, style,
// class, etc.) so they survive round-trips through the editor.
//
// Extends ElementNode so children (rows → cells → text) become
// ordinary editable Lexical child nodes — no contenteditable="false".
//
// importDOM priority 2: beats Lexical's built-in TableNode family
// (priority 1) so these nodes are used when loading DB content.
// =====================================================================

const _TABLE_TAGS = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'];

export class AttributedTableStructureNode extends ElementNode {
  static getType() {
    return 'attributed-table-structure';
  }

  static clone(node) {
    return new AttributedTableStructureNode(node.__tagName, node.__attributes, node.__key);
  }

  constructor(tagName, attributes, key) {
    super(key);
    this.__tagName = tagName || 'table';
    this.__attributes = attributes ? { ...attributes } : {};
  }

  createDOM(config) {
    const el = document.createElement(this.__tagName);
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return el;
  }

  updateDOM(prevNode, dom) {
    // Tag name change requires full DOM element recreation — you can't rename
    // an existing element in place, so signal Lexical to call createDOM again.
    if (prevNode.__tagName !== this.__tagName) return true;
    const prev = prevNode.__attributes;
    const next = this.__attributes;
    for (const name of Object.keys(prev)) {
      if (!(name in next)) dom.removeAttribute(name);
    }
    for (const [name, value] of Object.entries(next)) {
      if (prev[name] !== value) dom.setAttribute(name, value);
    }
    return false;
  }

  static importDOM() {
    const conversions = {};
    for (const tag of _TABLE_TAGS) {
      conversions[tag] = () => ({
        conversion: (element) => {
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }
          return {
            node: $createAttributedTableStructureNode(
              element.tagName.toLowerCase(),
              attributes
            ),
          };
        },
        priority: 2,
      });
    }
    return conversions;
  }

  exportDOM(editor) {
    const el = document.createElement(this.__tagName);
    for (const [name, value] of Object.entries(this.__attributes)) {
      el.setAttribute(name, value);
    }
    return { element: el };
  }

  static importJSON(serializedNode) {
    const node = $createAttributedTableStructureNode(
      serializedNode.tagName || 'table',
      serializedNode.attributes || {}
    );
    node.setFormat(serializedNode.format);
    node.setIndent(serializedNode.indent);
    node.setDirection(serializedNode.direction);
    return node;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'attributed-table-structure',
      tagName: this.__tagName,
      attributes: { ...this.__attributes },
      version: 1,
    };
  }
}

export function $createAttributedTableStructureNode(tagName, attributes) {
  return $applyNodeReplacement(new AttributedTableStructureNode(tagName, attributes));
}

export function $isAttributedTableStructureNode(node) {
  return node instanceof AttributedTableStructureNode;
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
    // Tables are now handled by AttributedTableStructureNode (priority 2, editable).
    // Divs with attributes are handled by AttributedDivNode (priority 2, editable).
    // RawHtmlNode's importDOM is intentionally empty — the class is kept registered
    // for backward-compatibility with any serialized Lexical JSON that may contain
    // 'raw-html' nodes from earlier versions of this editor.
    return {};
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
