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
 *
 * Accessibility: follows the ARIA menu / menuitem pattern.
 * - Menu container: role="menu"
 * - All interactive items: <button role="menuitem">
 * - Submenus: role="menu" on the panel, aria-haspopup="menu" + aria-expanded on trigger
 * - Keyboard: ArrowDown/Up navigate items, ArrowRight opens submenu,
 *   ArrowLeft closes submenu, Home/End jump to first/last, Escape closes,
 *   Tab closes and returns focus to the ▾ trigger.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey, $createParagraphNode } from 'lexical';
import { $createTableRowNode, $createTableCellNode, $isTableRowNode, TableCellHeaderStates, $isTableCellNode } from '@lexical/table';
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

/** Returns all td/th elements that fall inside the bounding rectangle
 *  formed by startCell and endCell (both must belong to the same table). */
function getCellsInRect(tableEl, startCell, endCell) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  let sr = -1, sc = -1, er = -1, ec = -1;
  rows.forEach((row, ri) => {
    Array.from(row.querySelectorAll('td,th')).forEach((cell, ci) => {
      if (cell === startCell) { sr = ri; sc = ci; }
      if (cell === endCell)   { er = ri; ec = ci; }
    });
  });
  if (sr < 0 || er < 0) return [startCell];
  const minR = Math.min(sr, er), maxR = Math.max(sr, er);
  const minC = Math.min(sc, ec), maxC = Math.max(sc, ec);
  const result = [];
  rows.slice(minR, maxR + 1).forEach((row) => {
    Array.from(row.querySelectorAll('td,th')).slice(minC, maxC + 1).forEach((cell) => {
      result.push(cell);
    });
  });
  return result;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

export default function TableContextMenuPlugin() {
  const [editor] = useLexicalComposerContext();

  /** The <td>/<th> DOM element the mouse is currently over (or null). */
  const [hoveredCellEl, setHoveredCellEl] = useState(null);

  /** Open menu state, or null when closed. */
  const [menu, setMenu] = useState(null);

  const [widthValue, setWidthValue] = useState('65');
  const [borderValue, setBorderValue] = useState('');
  const [cellPaddingValue, setCellPaddingValue] = useState('');
  const [cellSpacingValue, setCellSpacingValue] = useState('');
  const [rowHeightValue, setRowHeightValue] = useState('');
  const [colWidthValue, setColWidthValue] = useState('');

  /** Which submenu is currently open via keyboard: 'align' | 'width' | null */
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const menuRef = useRef(null);       // ref to the menu DOM element
  const triggerRef = useRef(null);    // ref to the ▾ trigger button DOM element
  const lastCellRef = useRef(null);   // tracks hovered cell without causing extra renders
  const menuStateRef = useRef(null);  // mirrors `menu` without causing effect re-runs

  // ── Drag-selection state ──────────────────────────────────────────────────
  const cellDragStartRef = useRef(null);   // td/th where the drag began
  const isDraggingRef = useRef(false);     // true once mouse has moved to a different cell
  const selectedCellElsRef = useRef(new Set()); // highlighted td/th DOM elements

  // Keep menuStateRef in sync so the global mousemove handler can read it
  useEffect(() => { menuStateRef.current = menu; }, [menu]);

  const close = useCallback(() => {
    setMenu(null);
    setOpenSubmenu(null);
    // Return focus to the ▾ trigger so keyboard users can continue navigating
    triggerRef.current?.focus();
  }, []);

  // Focus the first menuitem when the menu opens
  useEffect(() => {
    if (menu) {
      requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]');
        firstItem?.focus();
      });
    }
  }, [menu]);

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

  // ── Drag cell selection ───────────────────────────────────────────────────

  const clearCellSelection = useCallback(() => {
    selectedCellElsRef.current.forEach((el) => el.classList.remove('lctm-cell-selected'));
    selectedCellElsRef.current.clear();
  }, []);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const getCellEl = (target) => {
      let el = target;
      while (el && el !== root) {
        if (el.tagName === 'TD' || el.tagName === 'TH') return el;
        el = el.parentElement;
      }
      return null;
    };

    const onMouseDown = (e) => {
      // Ignore clicks on the trigger / menu portals (outside root)
      if (!root.contains(e.target)) return;
      const cell = getCellEl(e.target);
      if (!cell) {
        // Clicked inside editor but not on a cell — clear selection
        if (!menuStateRef.current) clearCellSelection();
        cellDragStartRef.current = null;
        return;
      }
      // Mark drag start; selection highlight applied only once mouse moves to another cell
      cellDragStartRef.current = cell;
      isDraggingRef.current = false;
    };

    const onMouseMove = (e) => {
      if (!cellDragStartRef.current || !(e.buttons & 1)) {
        cellDragStartRef.current = null;
        return;
      }
      const currentCell = getCellEl(e.target);
      if (!currentCell) return;
      const startTable = cellDragStartRef.current.closest('table');
      const curTable   = currentCell.closest('table');
      if (!startTable || startTable !== curTable) return;

      // Only enter drag mode once the mouse actually moves to a different cell
      if (!isDraggingRef.current) {
        if (currentCell === cellDragStartRef.current) return;
        // First cross-cell move — kill any text selection the browser built up
        // and lock user-select so it can't restart while the button stays held
        isDraggingRef.current = true;
        window.getSelection()?.removeAllRanges();
        root.style.userSelect = 'none';
      }

      // Highlight the rectangle from start to current cell
      const cells = getCellsInRect(startTable, cellDragStartRef.current, currentCell);
      selectedCellElsRef.current.forEach((el) => el.classList.remove('lctm-cell-selected'));
      selectedCellElsRef.current.clear();
      cells.forEach((el) => {
        el.classList.add('lctm-cell-selected');
        selectedCellElsRef.current.add(el);
      });
    };

    const onMouseUp = () => {
      root.style.userSelect = '';  // always restore
      if (!isDraggingRef.current && !menuStateRef.current) {
        clearCellSelection();
      }
      cellDragStartRef.current = null;
      isDraggingRef.current = false;
    };

    root.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      root.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [editor, clearCellSelection]);

  // ── Open menu on trigger click ────────────────────────────────────────────

  const openMenu = useCallback(() => {
    const cellEl = lastCellRef.current;
    if (!cellEl) return;

    let cellKey = null, rowKey = null, tableKey = null;
    let colIndex = 0, currentWidth = '65';
    let currentBorder = '', currentCellPadding = '', currentCellSpacing = '';
    let currentRowHeight = '', currentColWidth = '';
    let gridSelectionCellKeys = null;
    let isMergeValid = false;

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
      currentBorder = attrs.border || '';
      currentCellPadding = attrs.cellpadding || '';
      currentCellSpacing = attrs.cellspacing || '';

      // Pre-fill row height from the row node's style
      const rowStyleObj = parseStyle(rowNode.__attributes?.style || '');
      currentRowHeight = rowStyleObj['height']?.replace('px', '').trim() || '';

      // Pre-fill column width from the hovered cell's style
      const cellStyleObj = parseStyle(cellNode.__attributes?.style || '');
      currentColWidth = cellStyleObj['width']?.replace('px', '').trim() || '';

    });

    if (!rowKey || !tableKey) return;

    // Use DOM-tracked drag selection for merge validity — works for both table types.
    const selEls = Array.from(selectedCellElsRef.current);
    if (selEls.length >= 2) {
      const tableEl = cellEl.closest('table');
      if (selEls.every((el) => el.closest('table') === tableEl)) {
        gridSelectionCellKeys = selEls.map((el) => getDOMNodeLexicalKey(el)).filter(Boolean);

        // Validate contiguous rectangle via DOM row/col positions
        const tableRows = Array.from(tableEl.querySelectorAll('tr'));
        const positions = selEls.map((c) => {
          let ri = -1, ci = -1;
          tableRows.forEach((row, rowIdx) => {
            Array.from(row.querySelectorAll('td,th')).forEach((cell, colIdx) => {
              if (cell === c) { ri = rowIdx; ci = colIdx; }
            });
          });
          return { ri, ci };
        }).filter((p) => p.ri >= 0 && p.ci >= 0);

        if (positions.length === selEls.length) {
          const minRi = Math.min(...positions.map((p) => p.ri));
          const maxRi = Math.max(...positions.map((p) => p.ri));
          const minCi = Math.min(...positions.map((p) => p.ci));
          const maxCi = Math.max(...positions.map((p) => p.ci));
          isMergeValid = positions.length === (maxRi - minRi + 1) * (maxCi - minCi + 1);
        }
      }
    }

    setWidthValue(currentWidth);
    setBorderValue(currentBorder);
    setCellPaddingValue(currentCellPadding);
    setCellSpacingValue(currentCellSpacing);
    setRowHeightValue(currentRowHeight);
    setColWidthValue(currentColWidth);
    const rect = cellEl.getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.top + 18, cellKey, rowKey, tableKey, colIndex, gridSelectionCellKeys, isMergeValid });
  }, [editor]);

  // ── Close on outside click or Escape ─────────────────────────────────────

  useEffect(() => {
    if (!menu) return;
    const onMD = (e) => {
      const inMenu = menuRef.current?.contains(e.target);
      const inTrigger = triggerRef.current?.contains(e.target);
      if (!inMenu && !inTrigger) close();
    };
    document.addEventListener('mousedown', onMD);
    return () => {
      document.removeEventListener('mousedown', onMD);
    };
  }, [menu, close]);

  // ── Menu keyboard navigation ──────────────────────────────────────────────

  const handleMenuKeyDown = useCallback((e) => {
    // Collect all visible menuitems (excludes items hidden inside closed submenus)
    const allItems = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitem"]') || []
    ).filter((el) => el.offsetParent !== null);

    const currentIdx = allItems.indexOf(document.activeElement);
    const focused = document.activeElement;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        allItems[(currentIdx + 1) % allItems.length]?.focus();
        break;

      case 'ArrowUp':
        e.preventDefault();
        allItems[(currentIdx - 1 + allItems.length) % allItems.length]?.focus();
        break;

      case 'Home':
        e.preventDefault();
        allItems[0]?.focus();
        break;

      case 'End':
        e.preventDefault();
        allItems[allItems.length - 1]?.focus();
        break;

      case 'ArrowRight': {
        // Open submenu if the focused item is a submenu trigger
        const submenuKey = focused?.getAttribute('data-submenu');
        if (submenuKey) {
          e.preventDefault();
          setOpenSubmenu(submenuKey);
          requestAnimationFrame(() => {
            const panel = menuRef.current?.querySelector(`[data-submenu-panel="${submenuKey}"]`);
            panel?.querySelector('[role="menuitem"]')?.focus();
          });
        }
        break;
      }

      case 'ArrowLeft': {
        // Close submenu if focus is inside one
        const subPanel = focused?.closest('[data-submenu-panel]');
        if (subPanel) {
          e.preventDefault();
          const key = subPanel.getAttribute('data-submenu-panel');
          setOpenSubmenu(null);
          requestAnimationFrame(() => {
            menuRef.current?.querySelector(`[data-submenu="${key}"]`)?.focus();
          });
        }
        break;
      }

      case 'Escape':
        e.preventDefault();
        // If inside a submenu, just close the submenu; otherwise close the whole menu
        if (focused?.closest('[data-submenu-panel]')) {
          const subPanel = focused.closest('[data-submenu-panel]');
          const key = subPanel.getAttribute('data-submenu-panel');
          setOpenSubmenu(null);
          requestAnimationFrame(() => {
            menuRef.current?.querySelector(`[data-submenu="${key}"]`)?.focus();
          });
        } else {
          close();
        }
        break;

      case 'Tab':
        e.preventDefault();
        close();
        break;

      default:
        break;
    }
  }, [close]);

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

  const applyBorder = () => {
    if (!menu) return;
    const v = borderValue.trim();
    // Persist on AttributedTableStructureNode (DB-loaded tables) via Lexical state
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode || !tableNode.__attributes) return;
      const writable = tableNode.getWritable();
      const attrs = { ...writable.__attributes };
      if (v) attrs.border = v; else delete attrs.border;
      writable.__attributes = attrs;
    });
    // Direct DOM update — reliable for both node types; closest('table') avoids
    // any Lexical key-map lookup issues and survives TablePlugin reconciliation
    const tableEl = lastCellRef.current?.closest('table');
    if (tableEl) {
      if (v) tableEl.setAttribute('border', v); else tableEl.removeAttribute('border');
    }
    close();
  };

  const applyCellPadding = () => {
    if (!menu) return;
    const v = cellPaddingValue.trim();
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode || !tableNode.__attributes) return;
      const writable = tableNode.getWritable();
      const attrs = { ...writable.__attributes };
      if (v) attrs.cellpadding = v; else delete attrs.cellpadding;
      writable.__attributes = attrs;
    });
    const tableEl = lastCellRef.current?.closest('table');
    if (tableEl) {
      if (v) tableEl.setAttribute('cellpadding', v); else tableEl.removeAttribute('cellpadding');
    }
    close();
  };

  const applyCellSpacing = () => {
    if (!menu) return;
    const v = cellSpacingValue.trim();
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode || !tableNode.__attributes) return;
      const writable = tableNode.getWritable();
      const attrs = { ...writable.__attributes };
      if (v) attrs.cellspacing = v; else delete attrs.cellspacing;
      writable.__attributes = attrs;
    });
    const tableEl = lastCellRef.current?.closest('table');
    if (tableEl) {
      if (v) tableEl.setAttribute('cellspacing', v); else tableEl.removeAttribute('cellspacing');
    }
    close();
  };

  const applyRowHeight = () => {
    if (!menu) return;
    const v = rowHeightValue.trim();
    editor.update(() => {
      const rowNode = $getNodeByKey(menu.rowKey);
      if (!rowNode) return;
      if (rowNode instanceof AttributedTableStructureNode) {
        const writable = rowNode.getWritable();
        const attrs = { ...(writable.__attributes || {}) };
        const style = parseStyle(attrs.style || '');
        if (v) style['height'] = `${v}px`; else delete style['height'];
        writable.__attributes = { ...attrs, style: serializeStyle(style) };
      }
    });
    // Direct DOM update — required for native TableRowNode
    const rowEl = editor.getElementByKey?.(menu.rowKey);
    if (rowEl) {
      if (v) rowEl.style.height = `${v}px`; else rowEl.style.removeProperty('height');
    }
    close();
  };

  const applyColumnWidth = () => {
    if (!menu) return;
    const v = colWidthValue.trim();
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      getAllRows(tableNode).forEach((row) => {
        const cell = row.getChildren()[menu.colIndex];
        if (!cell) return;
        if (cell instanceof AttributedTableStructureNode) {
          const writable = cell.getWritable();
          const attrs = { ...(writable.__attributes || {}) };
          const style = parseStyle(attrs.style || '');
          if (v) style['width'] = `${v}px`; else delete style['width'];
          writable.__attributes = { ...attrs, style: serializeStyle(style) };
        }
      });
    });
    // Direct DOM update — required for native TableCellNode
    const tableEl = lastCellRef.current?.closest('table');
    if (tableEl) {
      tableEl.querySelectorAll('tr').forEach((tr) => {
        const cell = tr.cells[menu.colIndex];
        if (cell) {
          if (v) cell.style.width = `${v}px`; else cell.style.removeProperty('width');
        }
      });
    }
    close();
  };

  const toggleCellHeader = () => {
    if (!menu) return;
    editor.update(() => {
      const cellNode = $getNodeByKey(menu.cellKey);
      if (!cellNode) return;
      if (cellNode instanceof AttributedTableStructureNode) {
        // HTML-imported table — toggle td ↔ th via __tagName AND update class
        const writable = cellNode.getWritable();
        const isCurrentlyHeader = writable.__tagName === 'th';
        writable.__tagName = isCurrentlyHeader ? 'td' : 'th';
        const attrs = { ...writable.__attributes };
        if (isCurrentlyHeader) {
          if (attrs.class === 'lexical-table-cell-header') attrs.class = 'lexical-table-cell';
        } else {
          if (attrs.class === 'lexical-table-cell') attrs.class = 'lexical-table-cell-header';
        }
        writable.__attributes = attrs;
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
        // HTML-imported table — toggle __tagName AND class on each cell
        const allTh = cells.every((c) => c.__tagName === 'th');
        const newTag = allTh ? 'td' : 'th';
        cells.forEach((c) => {
          const writable = c.getWritable();
          writable.__tagName = newTag;
          const attrs = { ...writable.__attributes };
          if (allTh) {
            if (attrs.class === 'lexical-table-cell-header') attrs.class = 'lexical-table-cell';
          } else {
            if (attrs.class === 'lexical-table-cell') attrs.class = 'lexical-table-cell-header';
          }
          writable.__attributes = attrs;
        });
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

  const mergeCells = () => {
    if (!menu?.isMergeValid) return;

    const cellKeys = Array.from(selectedCellElsRef.current)
      .map((el) => getDOMNodeLexicalKey(el))
      .filter(Boolean);
    if (cellKeys.length < 2) return;

    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode) return;
      const rows = getAllRows(tableNode);

      const selectedCells = cellKeys.map((k) => $getNodeByKey(k)).filter(Boolean);
      if (selectedCells.length < 2) return;

      const positions = selectedCells.map((cell) => {
        const row = cell.getParent();
        const ri = rows.findIndex((r) => r.getKey() === row.getKey());
        const ci = row.getChildren().findIndex((c) => c.getKey() === cell.getKey());
        return { cell, ri, ci };
      }).filter((p) => p.ri >= 0 && p.ci >= 0);
      if (positions.length < 2) return;

      const minRow = Math.min(...positions.map((p) => p.ri));
      const maxRow = Math.max(...positions.map((p) => p.ri));
      const minCol = Math.min(...positions.map((p) => p.ci));
      const maxCol = Math.max(...positions.map((p) => p.ci));

      const topLeft = positions.find((p) => p.ri === minRow && p.ci === minCol);
      if (!topLeft) return;

      const keeper = topLeft.cell.getWritable();
      const colSpan = maxCol - minCol + 1;
      const rowSpan = maxRow - minRow + 1;

      // Move non-empty content from merged cells into keeper
      positions.forEach(({ cell }) => {
        if (cell.getKey() === topLeft.cell.getKey()) return;
        cell.getChildren().forEach((child) => {
          if (child.getTextContent().trim().length > 0) keeper.append(child);
        });
        cell.remove();
      });

      // Apply spans — AttributedTableStructureNode stores in __attributes;
      // native TableCellNode uses setColSpan/setRowSpan.
      if (keeper instanceof AttributedTableStructureNode) {
        const attrs = { ...(keeper.__attributes || {}) };
        if (colSpan > 1) attrs.colspan = String(colSpan); else delete attrs.colspan;
        if (rowSpan > 1) attrs.rowspan = String(rowSpan); else delete attrs.rowspan;
        keeper.__attributes = attrs;
      } else if ($isTableCellNode(keeper)) {
        keeper.setColSpan(colSpan);
        keeper.setRowSpan(rowSpan);
      }
    });

    clearCellSelection();
    close();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Show trigger only when hovering a cell and no menu is open
  const showTrigger = !!hoveredCellEl && !menu;

  // Recompute cell rect on every render so it stays fresh after scrolling
  const cellRect = hoveredCellEl ? hoveredCellEl.getBoundingClientRect() : null;

  // Clamp menu to viewport (main menu is now ~160px tall with 3 groups + separator + merge)
  const menuLeft = menu ? Math.min(menu.x - 210, window.innerWidth - 225) : 0;
  const menuTop  = menu ? Math.min(menu.y,        window.innerHeight - 170) : 0;

  return createPortal(
    <>
      {/* ▾ trigger button — appears at top-right of hovered cell */}
      {showTrigger && cellRect && (
        <button
          ref={triggerRef}
          className="lctm-trigger"
          style={{ left: cellRect.right - 22, top: cellRect.top + 2 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(); }}
          title="Table options"
          aria-label="Table options"
          aria-haspopup="menu"
          aria-expanded={false}
        >
          ▾
        </button>
      )}

      {/* Dropdown menu */}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Table options"
          className="lexical-table-context-menu"
          style={{ left: menuLeft, top: menuTop }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={handleMenuKeyDown}
        >
          {/* ── Table Properties ── */}
          <div className="lctm-has-sub">
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSubmenu === 'tableprops'}
              data-submenu="tableprops"
              className="lctm-item"
              onClick={() => setOpenSubmenu(openSubmenu === 'tableprops' ? null : 'tableprops')}
            >
              <span>Table Properties</span>
              <span className="lctm-arrow" aria-hidden="true">▶</span>
            </button>
            <div
              role="menu"
              aria-label="Table Properties"
              data-submenu-panel="tableprops"
              className={`lctm-submenu${openSubmenu === 'tableprops' ? ' lctm-submenu-open' : ''}`}
            >
              {/* Align Table */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'align'}
                  data-submenu="align"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'align' ? null : 'align')}
                >
                  <span>Align Table</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Align Table"
                  data-submenu-panel="align"
                  className={`lctm-submenu${openSubmenu === 'align' ? ' lctm-submenu-open' : ''}`}
                >
                  <button role="menuitem" className="lctm-item" onClick={() => alignTable('left')}>Left</button>
                  <button role="menuitem" className="lctm-item" onClick={() => alignTable('center')}>Center</button>
                  <button role="menuitem" className="lctm-item" onClick={() => alignTable('right')}>Right</button>
                </div>
              </div>

              {/* Table Width */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'width'}
                  data-submenu="width"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'width' ? null : 'width')}
                >
                  <span>Table Width</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Table Width"
                  data-submenu-panel="width"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'width' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="1" max="200" value={widthValue} onChange={(e) => setWidthValue(e.target.value)} className="lctm-width-input" aria-label="Table width percentage" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">%</span>
                    <button className="lctm-width-apply" onClick={applyTableWidth}>Apply</button>
                  </div>
                </div>
              </div>

              {/* Border Size */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'border'}
                  data-submenu="border"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'border' ? null : 'border')}
                >
                  <span>Border Size</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Border Size"
                  data-submenu-panel="border"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'border' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="0" value={borderValue} onChange={(e) => setBorderValue(e.target.value)} className="lctm-width-input" aria-label="Table border size in pixels" placeholder="0" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">px</span>
                    <button className="lctm-width-apply" onClick={applyBorder}>Apply</button>
                  </div>
                </div>
              </div>

              {/* Cell Padding */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'cellpadding'}
                  data-submenu="cellpadding"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'cellpadding' ? null : 'cellpadding')}
                >
                  <span>Cell Padding</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Cell Padding"
                  data-submenu-panel="cellpadding"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'cellpadding' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="0" value={cellPaddingValue} onChange={(e) => setCellPaddingValue(e.target.value)} className="lctm-width-input" aria-label="Cell padding in pixels" placeholder="0" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">px</span>
                    <button className="lctm-width-apply" onClick={applyCellPadding}>Apply</button>
                  </div>
                </div>
              </div>

              {/* Cell Spacing */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'cellspacing'}
                  data-submenu="cellspacing"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'cellspacing' ? null : 'cellspacing')}
                >
                  <span>Cell Spacing</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Cell Spacing"
                  data-submenu-panel="cellspacing"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'cellspacing' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="0" value={cellSpacingValue} onChange={(e) => setCellSpacingValue(e.target.value)} className="lctm-width-input" aria-label="Cell spacing in pixels" placeholder="0" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">px</span>
                    <button className="lctm-width-apply" onClick={applyCellSpacing}>Apply</button>
                  </div>
                </div>
              </div>

              <div role="separator" className="lctm-sep" />
              <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteTable}>Delete Table</button>
            </div>
          </div>

          {/* ── Row Options ── */}
          <div className="lctm-has-sub">
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSubmenu === 'rowoptions'}
              data-submenu="rowoptions"
              className="lctm-item"
              onClick={() => setOpenSubmenu(openSubmenu === 'rowoptions' ? null : 'rowoptions')}
            >
              <span>Row Options</span>
              <span className="lctm-arrow" aria-hidden="true">▶</span>
            </button>
            <div
              role="menu"
              aria-label="Row Options"
              data-submenu-panel="rowoptions"
              className={`lctm-submenu${openSubmenu === 'rowoptions' ? ' lctm-submenu-open' : ''}`}
            >
              {/* Row Height */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'rowheight'}
                  data-submenu="rowheight"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'rowheight' ? null : 'rowheight')}
                >
                  <span>Row Height</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Row Height"
                  data-submenu-panel="rowheight"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'rowheight' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="1" value={rowHeightValue} onChange={(e) => setRowHeightValue(e.target.value)} className="lctm-width-input" aria-label="Row height in pixels" placeholder="auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">px</span>
                    <button className="lctm-width-apply" onClick={applyRowHeight}>Apply</button>
                  </div>
                </div>
              </div>

              <button role="menuitem" className="lctm-item" onClick={toggleRowHeader}>Toggle Row Header</button>
              <button role="menuitem" className="lctm-item" onClick={() => insertRow('above')}>Insert Row Above</button>
              <button role="menuitem" className="lctm-item" onClick={() => insertRow('below')}>Insert Row Below</button>
              <div role="separator" className="lctm-sep" />
              <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteRow}>Delete Row</button>
            </div>
          </div>

          {/* ── Column Options ── */}
          <div className="lctm-has-sub">
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSubmenu === 'columnoptions'}
              data-submenu="columnoptions"
              className="lctm-item"
              onClick={() => setOpenSubmenu(openSubmenu === 'columnoptions' ? null : 'columnoptions')}
            >
              <span>Column Options</span>
              <span className="lctm-arrow" aria-hidden="true">▶</span>
            </button>
            <div
              role="menu"
              aria-label="Column Options"
              data-submenu-panel="columnoptions"
              className={`lctm-submenu${openSubmenu === 'columnoptions' ? ' lctm-submenu-open' : ''}`}
            >
              {/* Column Width */}
              <div className="lctm-has-sub">
                <button
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={openSubmenu === 'colwidth'}
                  data-submenu="colwidth"
                  className="lctm-item"
                  onClick={() => setOpenSubmenu(openSubmenu === 'colwidth' ? null : 'colwidth')}
                >
                  <span>Column Width</span>
                  <span className="lctm-arrow" aria-hidden="true">▶</span>
                </button>
                <div
                  role="menu"
                  aria-label="Column Width"
                  data-submenu-panel="colwidth"
                  className={`lctm-submenu lctm-width-panel${openSubmenu === 'colwidth' ? ' lctm-submenu-open' : ''}`}
                >
                  <div className="lctm-width-row">
                    <input type="number" min="1" value={colWidthValue} onChange={(e) => setColWidthValue(e.target.value)} className="lctm-width-input" aria-label="Column width in pixels" placeholder="auto" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} />
                    <span className="lctm-width-pct" aria-hidden="true">px</span>
                    <button className="lctm-width-apply" onClick={applyColumnWidth}>Apply</button>
                  </div>
                </div>
              </div>

              <button role="menuitem" className="lctm-item" onClick={toggleCellHeader}>Toggle Column Header</button>
              <button role="menuitem" className="lctm-item" onClick={() => insertColumn('left')}>Insert Column Left</button>
              <button role="menuitem" className="lctm-item" onClick={() => insertColumn('right')}>Insert Column Right</button>
              <div role="separator" className="lctm-sep" />
              <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteColumn}>Delete Column</button>
            </div>
          </div>

          <div role="separator" className="lctm-sep" />

          {/* Merge Cells — always visible, greyed when selection isn't valid */}
          <button
            role="menuitem"
            className={`lctm-item${menu?.isMergeValid ? '' : ' lctm-item--disabled'}`}
            onClick={menu?.isMergeValid ? mergeCells : undefined}
            aria-disabled={!menu?.isMergeValid}
            title={!menu?.isMergeValid ? 'Select 2 or more adjacent cells to merge' : undefined}
          >
            Merge Cells
          </button>
        </div>
      )}
    </>,
    document.body
  );
}