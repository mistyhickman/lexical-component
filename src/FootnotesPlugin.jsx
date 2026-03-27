/**
 * FootnotesPlugin.jsx — Footnotes support for the Lexical editor
 *
 * Produces the same HTML structure as the CKEditor footnotes plugin
 * (github.com/andykirk/CKEditorFootnotes):
 *
 *   Inline marker:
 *     <sup data-footnote-id="abc12">
 *       <a href="#footnote-1" id="footnote-marker-1-1" rel="footnote">[1]</a>
 *     </sup>
 *
 *   Footnotes section (bottom of document):
 *     <section class="footnotes">
 *       <header><h2>Footnotes</h2></header>
 *       <ol>
 *         <li id="footnote-1" data-footnote-id="abc12">
 *           <sup><a href="#footnote-marker-1-1">^</a></sup>
 *           <cite>The footnote text.</cite>
 *         </li>
 *       </ol>
 *     </section>
 *
 * Exports:
 *   FootnoteMarkerNode   — inline DecoratorNode for the [n] reference
 *   FootnoteSectionNode  — block  DecoratorNode for the footnotes list
 *   FootnotesPlugin      — React component (rendered inside LexicalComposer)
 *                          that auto-renumbers markers on every change
 *   FootnoteDialog       — Modal dialog for inserting / re-citing footnotes
 *   $createFootnoteMarkerNode / $isFootnoteMarkerNode
 *   $createFootnoteSectionNode / $isFootnoteSectionNode
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DecoratorNode,
  $applyNodeReplacement,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  $insertNodes,
  $createParagraphNode,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a random 5-character alphanumeric ID (matches CKEditor plugin). */
function generateFootnoteId() {
  return Math.random().toString(36).slice(2, 7);
}

/**
 * Depth-first traversal of a Lexical subtree.
 * Pushes each FootnoteMarkerNode into `markers` and each
 * FootnoteSectionNode into `sections`, in document order.
 * Must be called inside editor.read() or editor.update().
 */
function collectFootnoteNodes(node, markers, sections) {
  if ($isFootnoteMarkerNode(node)) {
    markers.push(node);
    return;
  }
  if ($isFootnoteSectionNode(node)) {
    sections.push(node);
    return; // don't recurse into the section
  }
  // RootNode extends ElementNode, so $isElementNode covers it too
  if ($isElementNode(node)) {
    node.getChildren().forEach(child => collectFootnoteNodes(child, markers, sections));
  }
}

// ─── FootnoteMarkerNode ───────────────────────────────────────────────────────
//
// An INLINE DecoratorNode that represents one in-text footnote reference.
// isInline() = true so it can be inserted mid-paragraph like a character.
// Stores a stable random `footnoteId` plus the computed `order` number and
// `occurrenceIndex` (updated by FootnotesPlugin on every editor change).

export class FootnoteMarkerNode extends DecoratorNode {
  static getType() {
    return 'footnote-marker';
  }

  static clone(node) {
    return new FootnoteMarkerNode(
      node.__footnoteId,
      node.__order,
      node.__occurrenceIndex,
      node.__key,
    );
  }

  constructor(footnoteId, order = 0, occurrenceIndex = 1, key) {
    super(key);
    this.__footnoteId = footnoteId;
    this.__order = order;
    this.__occurrenceIndex = occurrenceIndex;
  }

  // ── Inline ────────────────────────────────────────────────────────────────
  isInline() {
    return true;
  }

  // ── DOM (live editor) ─────────────────────────────────────────────────────
  // createDOM() creates the container; decorate() fills it via React.
  createDOM() {
    const sup = document.createElement('sup');
    sup.setAttribute('data-footnote-id', this.__footnoteId);
    return sup;
  }

  updateDOM() {
    // React re-renders decorate() when node state changes; no need to
    // swap the DOM element itself.
    return false;
  }

  // ── exportDOM (written to hidden field by SyncContentPlugin) ──────────────
  exportDOM() {
    const n = this.__order || 1;
    const occurrence = this.__occurrenceIndex || 1;
    const sup = document.createElement('sup');
    sup.setAttribute('data-footnote-id', this.__footnoteId);
    const a = document.createElement('a');
    a.href = `#footnote-${n}`;
    a.id = `footnote-marker-${n}-${occurrence}`;
    a.rel = 'footnote';
    a.textContent = `[${n}]`;
    sup.appendChild(a);
    return { element: sup };
  }

  // ── importDOM (parses existing CKEditor footnote HTML) ───────────────────
  // Priority 4 so it wins over any default <sup> superscript handler.
  // Returns null for plain <sup> (no data-footnote-id) → falls through.
  static importDOM() {
    return {
      sup: () => ({
        conversion: (element) => {
          const footnoteId = element.getAttribute('data-footnote-id');
          if (!footnoteId) return null; // plain superscript — fall through
          // Parse the current order number from the inner <a> href if present
          let order = 0;
          let occurrenceIndex = 1;
          const a = element.querySelector('a[href]');
          if (a) {
            const hrefMatch = a.getAttribute('href')?.match(/#footnote-(\d+)/);
            if (hrefMatch) order = parseInt(hrefMatch[1], 10);
            const idMatch = a.getAttribute('id')?.match(/footnote-marker-\d+-(\d+)/);
            if (idMatch) occurrenceIndex = parseInt(idMatch[1], 10);
          }
          return { node: new FootnoteMarkerNode(footnoteId, order, occurrenceIndex) };
        },
        priority: 4,
      }),
    };
  }

  // ── JSON serialization ────────────────────────────────────────────────────
  static importJSON(serialized) {
    return new FootnoteMarkerNode(
      serialized.footnoteId,
      serialized.order,
      serialized.occurrenceIndex,
    );
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'footnote-marker',
      version: 1,
      footnoteId: this.__footnoteId,
      order: this.__order,
      occurrenceIndex: this.__occurrenceIndex,
    };
  }

  // ── Accessors (safe reads in editor.read() context) ───────────────────────
  getFootnoteId() { return this.getLatest().__footnoteId; }
  getOrder()      { return this.getLatest().__order; }

  /** Called by FootnotesPlugin to renumber this marker. */
  setOrder(order, occurrenceIndex) {
    const writable = this.getWritable();
    writable.__order = order;
    writable.__occurrenceIndex = occurrenceIndex;
  }

  // ── Visual render (inside the editor) ────────────────────────────────────
  decorate() {
    const n = this.__order || '?';
    return (
      <FootnoteMarkerView order={n} footnoteId={this.__footnoteId} />
    );
  }
}

function FootnoteMarkerView({ order, footnoteId }) {
  return (
    <a
      href={`#footnote-${order}`}
      rel="footnote"
      onClick={(e) => e.preventDefault()}
      title={`Endnote ${order}`}
      style={{
        color: '#0066cc',
        textDecoration: 'none',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      [{order}]
    </a>
  );
}

export function $createFootnoteMarkerNode(footnoteId, order = 0, occurrenceIndex = 1) {
  return $applyNodeReplacement(new FootnoteMarkerNode(footnoteId, order, occurrenceIndex));
}

export function $isFootnoteMarkerNode(node) {
  return node instanceof FootnoteMarkerNode;
}

// ─── FootnoteSectionNode ──────────────────────────────────────────────────────
//
// A block-level DecoratorNode that represents the entire footnotes section.
// Stores an ordered array of { id, text } entries plus the display config.
// FootnotesPlugin keeps this node in sync with the marker nodes.

export class FootnoteSectionNode extends DecoratorNode {
  static getType() {
    return 'footnote-section';
  }

  static clone(node) {
    return new FootnoteSectionNode(node.__footnotes, node.__config, node.__key);
  }

  /**
   * @param {Array<{id:string, text:string}>} footnotes - Ordered footnote entries
   * @param {Object} config - { prefix, disableHeader, title, headerEls }
   */
  constructor(footnotes = [], config = {}, key) {
    super(key);
    this.__footnotes = footnotes;
    this.__config = config;
  }

  // ── DOM (live editor) ─────────────────────────────────────────────────────
  createDOM() {
    const el = document.createElement('div');
    el.contentEditable = 'false';
    return el;
  }

  updateDOM() {
    return false; // React re-renders via decorate()
  }

  // ── exportDOM ─────────────────────────────────────────────────────────────
  // Produces the same <section class="footnotes"> HTML as the CKEditor plugin.
  exportDOM() {
    const {
      prefix = '',
      disableHeader = false,
      title = 'Endnotes',
      headerEls = ['<h2>', '</h2>'],
    } = this.__config || {};

    const p = prefix ? `-${prefix}` : '';
    const section = document.createElement('section');
    section.className = 'footnotes';

    if (!disableHeader) {
      const header = document.createElement('header');
      const tmp = document.createElement('div');
      tmp.innerHTML = (Array.isArray(headerEls) ? headerEls[0] : `<${headerEls}>`)
        + title
        + (Array.isArray(headerEls) ? headerEls[1] : `</${headerEls}>`);
      while (tmp.firstChild) header.appendChild(tmp.firstChild);
      section.appendChild(header);
    }

    const ol = document.createElement('ol');
    (this.__footnotes || []).forEach((fn, idx) => {
      const n = idx + 1;
      const li = document.createElement('li');
      li.id = `footnote${p}-${n}`;
      li.setAttribute('data-footnote-id', fn.id);

      const sup = document.createElement('sup');
      const backLink = document.createElement('a');
      backLink.href = `#footnote-marker${p}-${n}-1`;
      backLink.textContent = '^';
      sup.appendChild(backLink);
      sup.appendChild(document.createTextNode(' '));
      li.appendChild(sup);

      const cite = document.createElement('cite');
      cite.innerHTML = fn.text || '';
      li.appendChild(cite);

      ol.appendChild(li);
    });

    section.appendChild(ol);
    return { element: section };
  }

  // ── importDOM (parses existing CKEditor footnote section HTML) ────────────
  // Priority 4, returns null for non-footnote <section> elements.
  static importDOM() {
    return {
      section: () => ({
        conversion: (element) => {
          if (!element.classList.contains('footnotes')) return null;
          const footnotes = [];
          element.querySelectorAll('li[data-footnote-id]').forEach(li => {
            const id = li.getAttribute('data-footnote-id');
            const cite = li.querySelector('cite');
            if (id) footnotes.push({ id, text: cite ? cite.innerHTML : '' });
          });
          return { node: new FootnoteSectionNode(footnotes) };
        },
        priority: 4,
      }),
    };
  }

  // ── JSON serialization ────────────────────────────────────────────────────
  static importJSON(serialized) {
    return new FootnoteSectionNode(serialized.footnotes, serialized.config);
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'footnote-section',
      version: 1,
      footnotes: this.__footnotes,
      config: this.__config,
    };
  }

  // ── Accessors ─────────────────────────────────────────────────────────────
  getFootnotes() { return this.getLatest().__footnotes; }
  getConfig()    { return this.getLatest().__config; }

  setFootnotes(footnotes) {
    this.getWritable().__footnotes = footnotes;
  }

  // ── Visual render ─────────────────────────────────────────────────────────
  decorate(editor) {
    return (
      <FootnoteSectionView
        footnotes={this.__footnotes}
        config={this.__config}
        editor={editor}
        nodeKey={this.__key}
      />
    );
  }
}

function FootnoteSectionView({ footnotes, config = {}, editor, nodeKey }) {
  const {
    disableHeader = false,
    title = 'Endnotes',
    headerEls = ['<h2>', '</h2>'],
  } = config;

  const headerHtml = Array.isArray(headerEls)
    ? headerEls[0] + title + headerEls[1]
    : `<h2>${title}</h2>`;

  // ── Edit modal state ───────────────────────────────────────────────────────
  const [editIdx, setEditIdx]   = useState(null);
  const [editText, setEditText] = useState('');
  const editTextareaRef = useRef(null);
  const editPrevFocusRef = useRef(null); // tracks focus before modal opens

  useEffect(() => {
    if (editIdx !== null) {
      setTimeout(() => editTextareaRef.current?.focus(), 50);
    }
  }, [editIdx]);

  const openEdit = (idx) => {
    editPrevFocusRef.current = document.activeElement;
    setEditText(footnotes[idx].text);
    setEditIdx(idx);
  };

  const handleEditSave = () => {
    const idx = editIdx;
    const newText = editText;
    setEditIdx(null);
    setEditText('');
    setTimeout(() => editPrevFocusRef.current?.focus(), 0);
    editor.update(() => {
      const root = $getRoot();
      root.getChildren().forEach(child => {
        if ($isFootnoteSectionNode(child)) {
          const updated = footnotes.map((f, i) => i === idx ? { ...f, text: newText } : f);
          child.getWritable().setFootnotes(updated);
        }
      });
    }, { tag: 'footnotes-reorder' });
  };

  const handleEditCancel = () => {
    setEditIdx(null);
    setEditText('');
    setTimeout(() => editPrevFocusRef.current?.focus(), 0);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') { handleEditCancel(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleEditSave(); return; }
    // Focus trap: keep Tab key cycling within the dialog
    if (e.key === 'Tab') {
      const focusable = Array.from(
        e.currentTarget.querySelectorAll('button, textarea, input, [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
  };

  // ── Shared modal button styles (mirrors FootnoteDialog) ───────────────────
  const cancelBtnStyle = {
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px',
  };
  const saveBtnStyle = {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '4px',
    background: '#005fcc',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <>
      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      {editIdx !== null && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Endnote"
          onKeyDown={handleEditKeyDown}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleEditCancel(); }}
        >
          <div style={{
            background: 'white',
            borderRadius: '6px',
            padding: '24px',
            minWidth: '400px',
            maxWidth: '560px',
            width: '90vw',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
              Edit Endnote {editIdx + 1}
            </h2>
            <label
              htmlFor="footnote-edit-text"
              style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}
            >
              Endnote text:
            </label>
            <textarea
              id="footnote-edit-text"
              ref={editTextareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              placeholder="Enter endnote text (HTML is supported)…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical',
              }}
              aria-label="Endnote text"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" onClick={handleEditCancel} style={cancelBtnStyle}>
                Cancel
              </button>
              <button type="button" onClick={handleEditSave} style={saveBtnStyle}>
                Save
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#888' }}>
              Ctrl+Enter to save · Esc to cancel
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* ── Footnotes section ────────────────────────────────────────────── */}
      <section
        className="footnotes"
        style={{ background: '#eee', padding: '1px 15px 10px', marginTop: '12px' }}
      >
        {!disableHeader && (
          <div dangerouslySetInnerHTML={{ __html: headerHtml }} />
        )}
        <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
          {(footnotes || []).map((fn, idx) => (
            <li key={fn.id} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ flex: 1 }}>
                  <cite
                    style={{ fontStyle: 'normal' }}
                    dangerouslySetInnerHTML={{ __html: fn.text || '' }}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(idx)}
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    border: '1px solid #aaa',
                    borderRadius: '3px',
                    background: 'white',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  title={`Edit endnote ${idx + 1}`}
                  aria-label={`Edit endnote ${idx + 1}`}
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function $createFootnoteSectionNode(footnotes = [], config = {}) {
  return $applyNodeReplacement(new FootnoteSectionNode(footnotes, config));
}

export function $isFootnoteSectionNode(node) {
  return node instanceof FootnoteSectionNode;
}

// ─── FootnotesPlugin ──────────────────────────────────────────────────────────
//
// Rendered inside <LexicalComposer>. Listens for every editor change and:
//   1. Traverses the tree to find all FootnoteMarkerNode instances in order.
//   2. Assigns sequential order numbers and occurrence indices.
//   3. Keeps the FootnoteSectionNode's footnotes array in sync.
//   4. Creates the section node if markers exist but no section yet.
//   5. Removes the section node if all markers are deleted.
//
// Uses { tag: 'footnotes-reorder' } on its own update to prevent re-triggering.

export function FootnotesPlugin({ footnotesConfig = {} }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      // Skip updates triggered by our own reordering
      if (tags.has('footnotes-reorder')) return;

      editorState.read(() => {
        const root = $getRoot();
        const markers = [];
        const sections = [];
        collectFootnoteNodes(root, markers, sections);

        // Build target order state
        const orderArr = [];      // unique IDs in first-appearance order
        const occurrences = {};   // id → current occurrence count
        const targetState = markers.map(marker => {
          const id = marker.getFootnoteId();
          if (!orderArr.includes(id)) {
            orderArr.push(id);
            occurrences[id] = 0;
          }
          occurrences[id]++;
          return {
            marker,
            orderNum: orderArr.indexOf(id) + 1,
            occurrence: occurrences[id],
          };
        });

        // Check if any marker needs its number updated
        const markersNeedUpdate = targetState.some(
          ({ marker, orderNum, occurrence }) =>
            marker.getOrder() !== orderNum ||
            marker.getLatest().__occurrenceIndex !== occurrence,
        );

        // Build the new footnotes list for the section
        const existingSection = sections[0] || null;
        const existingFootnotes = existingSection ? existingSection.getFootnotes() : [];
        const textById = {};
        existingFootnotes.forEach(fn => { textById[fn.id] = fn.text; });

        const newFootnotes = orderArr.map(id => ({
          id,
          text: textById[id] || '',
        }));

        const sectionNeedsUpdate = existingSection
          ? JSON.stringify(newFootnotes) !== JSON.stringify(existingFootnotes)
          : markers.length > 0;

        if (!markersNeedUpdate && !sectionNeedsUpdate) return;

        // Apply the renumbering
        editor.update(() => {
          targetState.forEach(({ marker, orderNum, occurrence }) => {
            if (
              marker.getOrder() !== orderNum ||
              marker.getLatest().__occurrenceIndex !== occurrence
            ) {
              marker.getWritable().setOrder(orderNum, occurrence);
            }
          });

          const currentRoot = $getRoot();
          if (markers.length === 0) {
            // No markers remain — remove the section entirely
            if (existingSection) {
              existingSection.getWritable().remove();
            }
          } else if (existingSection) {
            // Update existing section
            existingSection.getWritable().setFootnotes(newFootnotes);
            existingSection.getWritable().__config = footnotesConfig;
          } else {
            // Create a new section at the end of the document
            currentRoot.append($createFootnoteSectionNode(newFootnotes, footnotesConfig));
          }
        }, { tag: 'footnotes-reorder' });
      });
    });
  }, [editor, footnotesConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─── FootnoteDialog ───────────────────────────────────────────────────────────
//
// Modal dialog rendered by ToolbarPlugin (inside LexicalComposer).
// Uses useLexicalComposerContext() to read state and dispatch mutations.
//
// Props:
//   isOpen         — boolean
//   onClose        — () => void
//   footnotesConfig — { prefix, disableHeader, title, headerEls }

export function FootnoteDialog({ isOpen, onClose, footnotesConfig = {} }) {
  const [editor] = useLexicalComposerContext();
  const [newText, setNewText] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [existingFootnotes, setExistingFootnotes] = useState([]);
  const textareaRef = useRef(null);
  const dialogPrevFocusRef = useRef(null); // tracks focus before dialog opens

  // Populate existing footnotes and reset form whenever dialog opens
  useEffect(() => {
    if (!isOpen) {
      setNewText('');
      setSelectedId('');
      return;
    }

    // Store element that had focus before opening so we can restore it on close
    dialogPrevFocusRef.current = document.activeElement;

    editor.getEditorState().read(() => {
      const root = $getRoot();
      let footnotes = [];
      root.getChildren().forEach(child => {
        if ($isFootnoteSectionNode(child)) footnotes = child.getFootnotes();
      });
      setExistingFootnotes(footnotes);
    });

    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isOpen, editor]);

  const handleInsert = () => {
    const isNew = !selectedId;
    if (isNew && !newText.trim()) return;
    if (!isNew && !selectedId) return;

    const footnoteId = isNew ? generateFootnoteId() : selectedId;

    editor.update(() => {
      const root = $getRoot();

      // Find existing section node
      let sectionNode = null;
      root.getChildren().forEach(child => {
        if ($isFootnoteSectionNode(child)) sectionNode = child;
      });

      // Add new footnote text to the section
      if (isNew) {
        const newEntry = { id: footnoteId, text: newText.trim() };
        if (sectionNode) {
          sectionNode.getWritable().setFootnotes([
            ...sectionNode.getFootnotes(),
            newEntry,
          ]);
        } else {
          root.append($createFootnoteSectionNode([newEntry], footnotesConfig));
        }
      }

      // Insert the inline marker at the cursor
      const selection = $getSelection();
      const marker = $createFootnoteMarkerNode(footnoteId);
      if ($isRangeSelection(selection)) {
        $insertNodes([marker]);
      } else {
        // No cursor — append to last block or create one
        const last = root.getLastChild();
        if (last && typeof last.append === 'function') {
          last.append(marker);
        } else {
          const para = $createParagraphNode();
          para.append(marker);
          root.append(para);
        }
      }
    });

    handleClose();
  };

  // Restore focus to the element that opened this dialog, then call onClose
  const handleClose = () => {
    setTimeout(() => dialogPrevFocusRef.current?.focus(), 0);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { handleClose(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleInsert(); return; }
    // Focus trap: keep Tab key cycling within the dialog
    if (e.key === 'Tab') {
      const focusable = Array.from(
        e.currentTarget.querySelectorAll('button, textarea, input, [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage Endnotes"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: 'white',
        borderRadius: '6px',
        padding: '24px',
        minWidth: '400px',
        maxWidth: '560px',
        width: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600 }}>
          Manage Endnotes
        </h2>

        {/* New footnote textarea */}
        <label
          htmlFor="footnote-new-text"
          style={{ display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '14px' }}
        >
          New endnote:
        </label>
        <textarea
          id="footnote-new-text"
          ref={textareaRef}
          value={newText}
          onChange={(e) => { setNewText(e.target.value); setSelectedId(''); }}
          rows={4}
          placeholder="Enter endnote text (HTML is supported)…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: '14px',
            resize: 'vertical',
          }}
          aria-label="New endnote text"
        />

        {/* Existing footnotes list */}
        {existingFootnotes.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: '14px' }}>
              — OR — choose an existing endnote:
            </p>
            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '8px',
            }}>
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                {existingFootnotes.map((fn, idx) => (
                  <li key={fn.id} style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="footnote-existing"
                        value={fn.id}
                        checked={selectedId === fn.id}
                        onChange={() => { setSelectedId(fn.id); setNewText(''); }}
                        style={{ marginTop: '2px', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '14px' }}>
                        <strong>[{idx + 1}]</strong>{' '}
                        <span dangerouslySetInnerHTML={{ __html: fn.text }} />
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '20px',
        }}>
          <button
            type="button"
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '4px',
              background: '#005fcc',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Insert
          </button>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#888' }}>
          Ctrl+Enter to insert · Esc to cancel
        </p>
      </div>
    </div>
  );
}