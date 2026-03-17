/**
 * TableContextMenu.jsx
 *
 * Renders a small ▾ trigger button in the top-right corner of whichever
 * table cell the mouse is hovering over.  Clicking it opens a dropdown menu
 * with full table-editing operations.
 *
 * DOM → Lexical node lookup: Lexical stores the node key on each DOM element
 * as __lexicalKey_<editorKey>.  We read that property directly and then use
 * $getNodeByKey inside editorState.read(), which only needs the active editor
 * state (not the active editor reference that $getNearestNodeFromDOMNode
 * requires and that editorState.read() does not set).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $createParagraphNode } from 'lexical';
import { $createTableRowNode, $createTableCellNode, $isTableRowNode, TableCellHeaderStates } from '@lexical/table';
import { $createAttributedTableStructureNode, AttributedTableStructureNode } from './CustomFormatNodes';
import './TableContextMenu.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseStyle(s) {
  const obj = {};
  if (!s) return obj;
  s.split(';').forEach((part) => {
    const idx = part.indexOf(':');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) obj[k] = v;
  });
  return obj;
}

function serializeStyle(obj) {
  return Object.entries(obj)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

/** Returns all row nodes across tbody/thead/tfoot — works for both
 *  AttributedTableStructureNode trees (HTML-imported) and native
 *  TableNode/TableRowNode trees (toolbar-created). */
function getAllRows(tableNode) {
  if (!tableNode) return [];
  const rows = [];
  tableNode.getChildren().forEach((child) => {
    const tag = child.__tagName;
    if (tag === 'tr') {
      rows.push(child);
    } else if (['tbody', 'thead', 'tfoot'].includes(tag)) {
      child.getChildren().forEach((row) => {
        if (row.__tagName === 'tr' || $isTableRowNode(row)) rows.push(row);
      });
    } else if ($isTableRowNode(child)) {
      // Native TableRowNode direct child of TableNode (no tbody wrapper)
      rows.push(child);
    }
  });
  return rows;
}

/**
 * Walk up the DOM from `el` to find the first element that has a Lexical node
 * key attached.  Lexical sets the key as a plain property named
 * __lexicalKey_<editorKey> on each DOM element it manages.  We scan own
 * properties for that prefix so we don't have to know the (minified) editor
 * key value — accessing editor._key directly doesn't work in the minified
 * IIFE build because the property name is mangled.
 */
function getDOMNodeLexicalKey(el) {
  let node = el;
  while (node) {
    for (const prop of Object.keys(node)) {
      if (prop.startsWith('__lexicalKey_')) return node[prop];
    }
    node = node.parentElement;
  }
  return null;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default function TableContextMenuPlugin() {
  const [editor] = useLexicalComposerContext();

  /** The <td>/<th> DOM element the mouse is currently over (or null). */
  const [hoveredCellEl, setHoveredCellEl] = useState(null);

  /** Open menu state, or null when closed. */
  const [menu, setMenu] = useState(null);

  const [widthValue, setWidthValue] = useState('65');

  const menuRef = useRef(null);       // ref to the menu DOM element
  const triggerRef = useRef(null);    // ref to the ▾ trigger button DOM element
  const lastCellRef = useRef(null);   // tracks hovered cell without causing extra renders
  const menuStateRef = useRef(null);  // mirrors `menu` without causing effect re-runs

  // Keep menuStateRef in sync so the global mousemove handler can read it
  useEffect(() => { menuStateRef.current = menu; }, [menu]);

  const close = useCallback(() => setMenu(null), []);

  // ── Mouse tracking (global — avoids "hover gap" between cell and trigger) ─

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (menuStateRef.current) return; // don't disturb state while menu is open

      // If the mouse is over the trigger button itself, keep hover alive
      if (triggerRef.current?.contains(e.target)) return;

      const root = editor.getRootElement();
      let cellEl = null;
      if (root?.contains(e.target)) {
        let el = e.target;
        while (el && el !== root) {
          const tag = el.tagName?.toLowerCase();
          if (tag === 'td' || tag === 'th') { cellEl = el; break; }
          el = el.parentElement;
        }
      }

      if (cellEl !== lastCellRef.current) {
        lastCellRef.current = cellEl;
        setHoveredCellEl(cellEl);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [editor]); // only depends on editor, not menu

  // Hide the trigger button when the page scrolls (position would be stale)
  useEffect(() => {
    const hide = () => {
      if (!menuStateRef.current) {
        lastCellRef.current = null;
        setHoveredCellEl(null);
      }
    };
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, []);

  // ── Open menu on trigger click ────────────────────────────────────────────

  const openMenu = useCallback(() => {
    const cellEl = lastCellRef.current;
    if (!cellEl) return;

    let cellKey = null, rowKey = null, tableKey = null;
    let colIndex = 0, currentWidth = '65';

    // Lexical stores the node key on each DOM element as __lexicalKey_<editorKey>.
    // We read it directly then look up via $getNodeByKey inside editorState.read(),
    // which only needs the active editor state (not the active editor reference).
    // startKey is the Lexical node key for the <td>/<th> DOM element itself.
    // Since we walk up in getDOMNodeLexicalKey, this gives us the cell node directly.
    const startKey = getDOMNodeLexicalKey(cellEl);

    editor.getEditorState().read(() => {
      const cellNode = startKey ? $getNodeByKey(startKey) : null;
      if (!cellNode) return;

      cellKey = cellNode.getKey();

      const rowNode = cellNode.getParent();
      if (!rowNode) return;
      rowKey = rowNode.getKey();

      // Table is the parent of the row, or grandparent via tbody/thead/tfoot
      let tableNode = rowNode.getParent();
      if (
        tableNode &&
        ['tbody', 'thead', 'tfoot'].includes(tableNode.__tagName)
      ) {
        tableNode = tableNode.getParent();
      }
      if (!tableNode) return;
      tableKey = tableNode.getKey();

      colIndex = rowNode.getChildren().findIndex((n) => n.getKey() === cellKey);

      // Pre-fill the width input with the table's current % width (if any)
      const attrs = tableNode.__attributes || {};
      const styleObj = parseStyle(attrs.style || '');
      const widthStr = styleObj['width'] || attrs.width || '';
      const m = widthStr.match(/^(\d+(?:\.\d+)?)/);
      if (m) currentWidth = m[1];
    });

    if (!rowKey || !tableKey) return;
    setWidthValue(currentWidth);
    const rect = cellEl.getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.top + 18, cellKey, rowKey, tableKey, colIndex });
  }, [editor]);

  // ── Close on outside click or Escape ─────────────────────────────────────

  useEffect(() => {
    if (!menu) return;
    const onMD = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inTrigger = triggerRef.current?.contains(e.target);
      if (!inMenu && !inTrigger) close();
    };
    const onKD = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onMD);
    document.addEventListener('keydown', onKD);
    return () => {
      document.removeEventListener('mousedown', onMD);
      document.removeEventListener('keydown', onKD);
    };
  }, [menu, close]);

  // ── Table operations ──────────────────────────────────────────────────────

  const alignTable = (alignment) => {
    if (!menu) return;
    // Update __attributes for AttributedTableStructureNode persistence
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode) return;
      const writable = tableNode.getWritable();
      const attrs = writable.__attributes || {};
      const style = parseStyle(attrs.style || '');
      delete style['float'];
      if (alignment === 'left')        { style['margin-left'] = '0';    style['margin-right'] = 'auto'; }
      else if (alignment === 'center') { style['margin-left'] = 'auto'; style['margin-right'] = 'auto'; }
      else                             { style['margin-left'] = 'auto'; style['margin-right'] = '0'; }
      writable.__attributes = { ...attrs, style: serializeStyle(style) };
    });
    // Also apply directly to the DOM element — required for built-in TableNode
    // whose updateDOM() ignores __attributes entirely.
    const domEl = editor.getElementByKey?.(menu.tableKey);
    if (domEl) {
      domEl.style.removeProperty('float');
      if (alignment === 'left')        { domEl.style.marginLeft = '0';    domEl.style.marginRight = 'auto'; }
      else if (alignment === 'center') { domEl.style.marginLeft = 'auto'; domEl.style.marginRight = 'auto'; }
      else                             { domEl.style.marginLeft = 'auto'; domEl.style.marginRight = '0'; }
    }
    close();
  };

  const applyTableWidth = () => {
    if (!menu) return;
    const w = widthValue.trim();
    if (!w) return;
    // Update __attributes for AttributedTableStructureNode persistence
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode) return;
      const writable = tableNode.getWritable();
      const attrs = writable.__attributes || {};
      const style = parseStyle(attrs.style || '');
      style['width'] = `${w}%`;
      writable.__attributes = { ...attrs, style: serializeStyle(style) };
    });
    // Also apply directly to the DOM element — required for built-in TableNode
    const domEl = editor.getElementByKey?.(menu.tableKey);
    if (domEl) domEl.style.width = `${w}%`;
    close();
  };

  const toggleCellHeader = () => {
    if (!menu) return;
    editor.update(() => {
      const cellNode = $getNodeByKey(menu.cellKey);
      if (!cellNode) return;
      if (cellNode instanceof AttributedTableStructureNode) {
        // HTML-imported table — toggle td ↔ th via __tagName
        cellNode.getWritable().__tagName = cellNode.__tagName === 'td' ? 'th' : 'td';
      } else {
        // Toolbar-created table — toggle __headerState COLUMN bit
        const isHeader = cellNode.hasHeader();
        cellNode.getWritable().__headerState = isHeader
          ? TableCellHeaderStates.NO_STATUS
          : TableCellHeaderStates.COLUMN;
      }
    });
    close();
  };

  const toggleRowHeader = () => {
    if (!menu) return;
    editor.update(() => {
      const rowNode = $getNodeByKey(menu.rowKey);
      if (!rowNode) return;
      const cells = rowNode.getChildren();
      if (cells.length === 0) return;
      if (cells[0] instanceof AttributedTableStructureNode) {
        // HTML-imported table — toggle __tagName on each cell
        const allTh = cells.every((c) => c.__tagName === 'th');
        const newTag = allTh ? 'td' : 'th';
        cells.forEach((c) => { c.getWritable().__tagName = newTag; });
      } else {
        // Toolbar-created table — toggle ROW header state on each cell
        const allHeaders = cells.every((c) => c.hasHeader());
        const newState = allHeaders
          ? TableCellHeaderStates.NO_STATUS
          : TableCellHeaderStates.ROW;
        cells.forEach((c) => { c.getWritable().__headerState = newState; });
      }
    });
    close();
  };

  const insertRow = (position) => {
    if (!menu) return;
    editor.update(() => {
      const rowNode = $getNodeByKey(menu.rowKey);
      if (!rowNode) return;
      const numCols = Math.max(rowNode.getChildrenSize(), 1);
      let newRow;
      if (rowNode instanceof AttributedTableStructureNode) {
        // HTML-imported table — keep using AttributedTableStructureNode
        newRow = $createAttributedTableStructureNode('tr', {});
        for (let i = 0; i < numCols; i++) {
          const cell = $createAttributedTableStructureNode('td', {});
          cell.append($createParagraphNode());
          newRow.append(cell);
        }
      } else {
        // Toolbar-created table — use native TableRowNode/TableCellNode so
        // TableNode.exportDOM() doesn't throw "Expected to find row node"
        newRow = $createTableRowNode();
        for (let i = 0; i < numCols; i++) {
          const cell = $createTableCellNode(0);
          cell.append($createParagraphNode());
          newRow.append(cell);
        }
      }
      if (position === 'above') rowNode.insertBefore(newRow);
      else rowNode.insertAfter(newRow);
    });
    close();
  };

  const insertColumn = (position) => {
    if (!menu) return;
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      getAllRows(tableNode).forEach((row) => {
        const cells = row.getChildren();
        const cell = row instanceof AttributedTableStructureNode
          ? $createAttributedTableStructureNode('td', {})
          : $createTableCellNode(0);
        cell.append($createParagraphNode());
        const ref = cells[menu.colIndex];
        if (ref) {
          if (position === 'left') ref.insertBefore(cell);
          else ref.insertAfter(cell);
        } else {
          row.append(cell);
        }
      });
    });
    close();
  };

  const deleteRow = () => {
    if (!menu) return;
    editor.update(() => { $getNodeByKey(menu.rowKey)?.remove(); });
    close();
  };

  const deleteColumn = () => {
    if (!menu) return;
    editor.update(() => {
      getAllRows($getNodeByKey(menu.tableKey)).forEach((row) => {
        row.getChildren()[menu.colIndex]?.remove();
      });
    });
    close();
  };

  const deleteTable = () => {
    if (!menu) return;
    editor.update(() => { $getNodeByKey(menu.tableKey)?.remove(); });
    close();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Show trigger only when hovering a cell and no menu is open
  const showTrigger = !!hoveredCellEl && !menu;

  // Recompute cell rect on every render so it stays fresh after scrolling
  const cellRect = hoveredCellEl ? hoveredCellEl.getBoundingClientRect() : null;

  // Clamp menu to viewport
  const menuLeft = menu ? Math.min(menu.x - 210, window.innerWidth - 225) : 0;
  const menuTop  = menu ? Math.min(menu.y,        window.innerHeight - 390) : 0;

  return createPortal(
    <>
      {/* ▾ trigger button — appears at top-right of hovered cell */}
      {showTrigger && cellRect && (
        <button
          ref={triggerRef}
          className="lctm-trigger"
          style={{ left: cellRect.right - 22, top: cellRect.top + 2 }}
          onMouseDown={(e) => { e.stopPropagation(); openMenu(); }}
          title="Table options"
          aria-label="Table options"
        >
          ▾
        </button>
      )}

      {/* Dropdown menu */}
      {menu && (
        <div
          ref={menuRef}
          className="lexical-table-context-menu"
          style={{ left: menuLeft, top: menuTop }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Align Table */}
          <div className="lctm-item lctm-has-sub">
            <span>Align Table</span>
            <span className="lctm-arrow">▶</span>
            <div className="lctm-submenu">
              <div className="lctm-item" onClick={() => alignTable('left')}>Left</div>
              <div className="lctm-item" onClick={() => alignTable('center')}>Center</div>
              <div className="lctm-item" onClick={() => alignTable('right')}>Right</div>
            </div>
          </div>

          {/* Table Width */}
          <div className="lctm-item lctm-has-sub">
            <span>Table Width</span>
            <span className="lctm-arrow">▶</span>
            <div className="lctm-submenu lctm-width-panel">
              <div className="lctm-width-row">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={widthValue}
                  onChange={(e) => setWidthValue(e.target.value)}
                  className="lctm-width-input"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct">%</span>
                <button className="lctm-width-apply" onClick={applyTableWidth}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="lctm-sep" />

          <div className="lctm-item" onClick={toggleCellHeader}>Toggle Column Header</div>
          <div className="lctm-item" onClick={toggleRowHeader}>Toggle Row Header</div>

          <div className="lctm-sep" />

          <div className="lctm-item" onClick={() => insertRow('above')}>Insert Row Above</div>
          <div className="lctm-item" onClick={() => insertRow('below')}>Insert Row Below</div>
          <div className="lctm-item" onClick={() => insertColumn('left')}>Insert Column Left</div>
          <div className="lctm-item" onClick={() => insertColumn('right')}>Insert Column Right</div>

          <div className="lctm-sep" />

          <div className="lctm-item lctm-danger" onClick={deleteRow}>Delete Row</div>
          <div className="lctm-item lctm-danger" onClick={deleteColumn}>Delete Column</div>
          <div className="lctm-item lctm-danger" onClick={deleteTable}>Delete Table</div>
        </div>
      )}
    </>,
    document.body
  );
}
