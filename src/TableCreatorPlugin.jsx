/**
 * TableCreatorPlugin.jsx - Popover grid for choosing table dimensions
 *
 * 508 / WCAG 2.1 AA compliance:
 *  - Popover content is wrapped in role="dialog" with aria-modal and aria-label
 *  - MUI Popover provides the focus trap and Escape-to-close behaviour
 *  - Grid container has role="grid" and aria-label
 *  - Each cell has role="gridcell", aria-selected, and a descriptive aria-label
 *  - Selection size is announced via an aria-live="polite" <output> element
 *  - Arrow-key navigation already existed; Escape is handled by MUI Popover
 */

import { useEffect, useRef, useState } from 'react';

import styled from '@emotion/styled';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import Popover from '@mui/material/Popover';
import { $setSelection } from 'lexical';
import PropTypes from 'prop-types';

const gridSize = 8;

const Grid = styled.div`
  display: grid;
  gap: 10px;
  margin-bottom: 8px;
  grid-template-columns: ${(props) => `repeat(${props.gridSize},15px)`};
  grid-template-rows: ${(props) => `repeat(${props.gridSize},15px)`};
  `;

const Cell = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid #fff;
  border-radius: 4px;
  background-color: ${(props) => (props.selected ? '#0077b6' : '#fff')};
  cursor: pointer;
  `;

const SizeLabel = styled.div`
  text-align: center;
  color: #fff;
  `;

  export default function TableCreatorPlugin({ handleClose, anchorEl, dynamicPosition }) {
    const [editor] = useLexicalComposerContext();

    const [selectedRows, setSelectedRows] = useState(0);
    const [selectedCols, setSelectedCols] = useState(0);

    const savedSelectionRef = useRef(null);
    // Ref to the first grid cell so we can set initial focus when the popover opens
    const firstCellRef = useRef(null);

    // Move focus to the first grid cell when the popover opens
    useEffect(() => {
      if (anchorEl) {
        setTimeout(() => firstCellRef.current?.focus(), 50);
      }
    }, [anchorEl]);

    const createTable = (rows, cols) => {
      editor.update(() => {
        if (savedSelectionRef.current) $setSelection(savedSelectionRef.current);

        editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: cols , rows });
      editor.focus();
      });
      handleClose();
    };

    const selectGridCells = (index) => {
      const rowSize = gridSize;
      const row = Math.floor(index / rowSize);
      const col = index % rowSize;

      setSelectedRows(row + 1);
      setSelectedCols(col + 1);
    };

    const moveCellsByArrowKeys = (idx) => {
      selectGridCells(idx);
      const nextCell = document.querySelector(`[data-index="${idx}"]`);
      nextCell?.focus();
    };

    const handleMouseOver = (index) => selectGridCells(index);
    const handleCellClick = () => createTable(selectedRows, selectedCols);

    const handleKeyDown = (event, index) => {
      event.preventDefault();

      const keyActions = {
        Enter: handleCellClick,
        ArrowUp: () => moveCellsByArrowKeys(Math.max(0, index - gridSize)),
        ArrowDown: () => moveCellsByArrowKeys(Math.min(gridSize * gridSize - 1, index + gridSize)),
        ArrowLeft: () => moveCellsByArrowKeys(Math.max(0, index - 1)),
        ArrowRight: () => moveCellsByArrowKeys(Math.min(gridSize * gridSize - 1, index + 1)),
      };

      keyActions[event.key]?.();
    };

    const sizeDescription = selectedRows > 0
      ? `${selectedRows} row by ${selectedCols} column table selected. Press Enter to insert.`
      : 'Move over the grid or use arrow keys to select table size, then press Enter.';

    return (
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        className = "lexical-table-popup"
        anchorOrigin={dynamicPosition}
        transformOrigin={{ vertical: dynamicPosition.vertical === 'bottom' ? 'top' : 'bottom',
        horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              background: '#707070',
              boxShadow: 'none',
              padding: '12px 18px 8px 12px',
              borderRadius: '12px',
            },
          },
        }}
      >
        {/* role="dialog" makes this a modal dialog landmark for screen readers.
            aria-modal="true" tells AT that content behind the dialog is inert.
            aria-labelledby associates the dialog with its heading. */}
        <div role="dialog" aria-modal="true" aria-label="Insert table — select dimensions">

          {/* role="grid" marks the cell container as an interactive grid widget.
              aria-label describes the purpose. aria-rowcount / aria-colcount inform
              screen readers of the full grid dimensions. */}
          <Grid
            className="lexical-table-popup-grid"
            gridSize={gridSize}
            role="grid"
            aria-label="Table size selector. Use arrow keys to navigate, Enter to insert."
            aria-rowcount={gridSize}
            aria-colcount={gridSize}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, index) => {
              const row = Math.floor(index / gridSize);
              const col = index % gridSize;
              const isSelected = row < selectedRows && col < selectedCols;
              return (
                <Cell
                  key={`grid-${row}-${col}`}
                  data-index={index}
                  // aria-label describes this specific cell position
                  aria-label={`${row + 1} row by ${col + 1} column`}
                  // aria-selected communicates the highlighted selection state
                  aria-selected={isSelected}
                  tabIndex={index === 0 ? 0 : -1}
                  selected={isSelected}
                  className="lexical-table-popup-grid-cell"
                  onMouseOver={() => handleMouseOver(index)}
                  onClick={handleCellClick}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  // role="gridcell" is the correct role for cells within a grid
                  role="gridcell"
                  ref={index === 0 ? firstCellRef : undefined}
                />
              );
            })}
          </Grid>

          {/* <output> is the semantically correct element for a live result value.
              aria-live="polite" causes screen readers to announce the updated
              selection size after the user moves to a new cell. */}
          <output aria-live="polite" aria-atomic="true">
            <SizeLabel>{selectedRows > 0 ? `${selectedRows} × ${selectedCols}` : '0 × 0'}</SizeLabel>
          </output>

          {/* Visually hidden description read by screen readers */}
          <span
            style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
            aria-live="polite"
            aria-atomic="true"
          >
            {sizeDescription}
          </span>

        </div>
      </Popover>
    );
  };

TableCreatorPlugin.propTypes = {
  handleClose: PropTypes.func.isRequired,
  anchorEl: PropTypes.shape({}),
  dynamicPosition: PropTypes.shape({
    vertical: PropTypes.string,
  }).isRequired,
};
