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
import { $getNodeByKey, $createParagraphNode, $getSelection } from 'lexical';
import { $createTableRowNode, $createTableCellNode, $isTableRowNode, TableCellHeaderStates, $isGridSelection, $isTableCellNode } from '@lexical/table';
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

  // ── Open menu on trigger click ────────────────────────────────────────────

  const openMenu = useCallback(() => {
    const cellEl = lastCellRef.current;
    if (!cellEl) return;

    let cellKey = null, rowKey = null, tableKey = null;
    let colIndex = 0, currentWidth = '65';
    let currentBorder = '', currentCellPadding = '', currentCellSpacing = '';
    let currentRowHeight = '', currentColWidth = '';
    let gridSelectionCellKeys = null;
    let isMergedCell = false;

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

      // GridSelection = multi-cell selection (native TableNode only)
      if ($isTableCellNode(cellNode)) {
        const selection = $getSelection();
        if ($isGridSelection(selection) && selection.gridKey === tableKey) {
          const cellNodes = selection.getNodes().filter($isTableCellNode);
          if (cellNodes.length >= 2) {
            gridSelectionCellKeys = cellNodes.map((n) => n.getKey());
          }
        }
        // Is this cell already merged?
        const cs = cellNode.__colSpan ?? 1;
        const rs = cellNode.__rowSpan ?? 1;
        isMergedCell = cs > 1 || rs > 1;
      }
    });

    if (!rowKey || !tableKey) return;
    setWidthValue(currentWidth);
    setBorderValue(currentBorder);
    setCellPaddingValue(currentCellPadding);
    setCellSpacingValue(currentCellSpacing);
    setRowHeightValue(currentRowHeight);
    setColWidthValue(currentColWidth);
    const rect = cellEl.getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.top + 18, cellKey, rowKey, tableKey, colIndex, gridSelectionCellKeys, isMergedCell });
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
    if (!menu?.gridSelectionCellKeys?.length) return;
    editor.update(() => {
      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode) return;
      const rows = getAllRows(tableNode);

      const selectedCells = menu.gridSelectionCellKeys
        .map((k) => $getNodeByKey(k))
        .filter(Boolean)
        .filter($isTableCellNode);
      if (selectedCells.length < 2) return;

      // Map each cell to its row/col position
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

      // Move non-empty content from other cells into the keeper
      positions.forEach(({ cell }) => {
        if (cell.getKey() === topLeft.cell.getKey()) return;
        cell.getChildren().forEach((child) => {
          if (child.getTextContent().trim().length > 0) keeper.append(child);
        });
        cell.remove();
      });

      keeper.setColSpan(maxCol - minCol + 1);
      keeper.setRowSpan(maxRow - minRow + 1);
    });
    close();
  };

  const unmergeCells = () => {
    if (!menu?.isMergedCell) return;
    editor.update(() => {
      const cellNode = $getNodeByKey(menu.cellKey);
      if (!cellNode || !$isTableCellNode(cellNode)) return;
      const colSpan = cellNode.__colSpan ?? 1;
      const rowSpan = cellNode.__rowSpan ?? 1;
      if (colSpan <= 1 && rowSpan <= 1) return;

      const tableNode = $getNodeByKey(menu.tableKey);
      if (!tableNode) return;
      const rows = getAllRows(tableNode);
      const rowNode = $getNodeByKey(menu.rowKey);
      if (!rowNode) return;

      const cellRowIdx = rows.findIndex((r) => r.getKey() === rowNode.getKey());
      const cellColIdx = rowNode.getChildren().findIndex((c) => c.getKey() === menu.cellKey);

      // Reset spans on the original cell
      const w = cellNode.getWritable();
      w.setColSpan(1);
      w.setRowSpan(1);

      // Restore cells for column span (same row, insert after the original cell)
      for (let c = 1; c < colSpan; c++) {
        const newCell = $createTableCellNode(0);
        newCell.append($createParagraphNode());
        const ref = rowNode.getChildren()[cellColIdx + c - 1];
        if (ref) ref.insertAfter(newCell);
        else rowNode.append(newCell);
      }

      // Restore cells for row span (insert into subsequent rows)
      for (let r = 1; r < rowSpan; r++) {
        const targetRow = rows[cellRowIdx + r];
        if (!targetRow) continue;
        for (let c = 0; c < colSpan; c++) {
          const newCell = $createTableCellNode(0);
          newCell.append($createParagraphNode());
          const ref = targetRow.getChildren()[cellColIdx + c];
          if (ref) ref.insertBefore(newCell);
          else targetRow.append(newCell);
        }
      }
    });
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
          {/* Align Table submenu */}
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

          {/* Table Width submenu */}
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
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={widthValue}
                  onChange={(e) => setWidthValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Table width percentage"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">%</span>
                <button className="lctm-width-apply" onClick={applyTableWidth}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Border Size submenu */}
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
                <input
                  type="number"
                  min="0"
                  value={borderValue}
                  onChange={(e) => setBorderValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Table border size in pixels"
                  placeholder="0"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">px</span>
                <button className="lctm-width-apply" onClick={applyBorder}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Cell Padding submenu */}
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
                <input
                  type="number"
                  min="0"
                  value={cellPaddingValue}
                  onChange={(e) => setCellPaddingValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Table cell padding in pixels"
                  placeholder="0"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">px</span>
                <button className="lctm-width-apply" onClick={applyCellPadding}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Cell Spacing submenu */}
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
                <input
                  type="number"
                  min="0"
                  value={cellSpacingValue}
                  onChange={(e) => setCellSpacingValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Table cell spacing in pixels"
                  placeholder="0"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">px</span>
                <button className="lctm-width-apply" onClick={applyCellSpacing}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Row Height submenu */}
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
                <input
                  type="number"
                  min="1"
                  value={rowHeightValue}
                  onChange={(e) => setRowHeightValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Row height in pixels"
                  placeholder="auto"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">px</span>
                <button className="lctm-width-apply" onClick={applyRowHeight}>Apply</button>
              </div>
            </div>
          </div>

          {/* Column Width submenu */}
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
                <input
                  type="number"
                  min="1"
                  value={colWidthValue}
                  onChange={(e) => setColWidthValue(e.target.value)}
                  className="lctm-width-input"
                  aria-label="Column width in pixels"
                  placeholder="auto"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="lctm-width-pct" aria-hidden="true">px</span>
                <button className="lctm-width-apply" onClick={applyColumnWidth}>Apply</button>
              </div>
            </div>
          </div>

          <div role="separator" className="lctm-sep" />

          <button role="menuitem" className="lctm-item" onClick={toggleCellHeader}>Toggle Column Header</button>
          <button role="menuitem" className="lctm-item" onClick={toggleRowHeader}>Toggle Row Header</button>

          {menu?.gridSelectionCellKeys?.length >= 2 && (
            <button role="menuitem" className="lctm-item" onClick={mergeCells}>Merge Cells</button>
          )}
          {menu?.isMergedCell && (
            <button role="menuitem" className="lctm-item" onClick={unmergeCells}>Unmerge Cell</button>
          )}

          <div role="separator" className="lctm-sep" />

          <button role="menuitem" className="lctm-item" onClick={() => insertRow('above')}>Insert Row Above</button>
          <button role="menuitem" className="lctm-item" onClick={() => insertRow('below')}>Insert Row Below</button>
          <button role="menuitem" className="lctm-item" onClick={() => insertColumn('left')}>Insert Column Left</button>
          <button role="menuitem" className="lctm-item" onClick={() => insertColumn('right')}>Insert Column Right</button>

          <div role="separator" className="lctm-sep" />

          <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteRow}>Delete Row</button>
          <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteColumn}>Delete Column</button>
          <button role="menuitem" className="lctm-item lctm-danger" onClick={deleteTable}>Delete Table</button>
        </div>
      )}
    </>,
    document.body
  );
}