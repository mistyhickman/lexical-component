import React, { useRef, useState } from 'react';

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

const Label = styled.div`
  text-align: center;
  color: #fff;
  `;

  export default function TableCreatorPlugin({ handleClose, anchorEl, dynamicPosition }) {
    const [editor] = useLexicalComposerContext();

    const [selectedRows, setSelectedRows] = useState(0);
    const [selectedCols, setSelectedCols] = useState(0);

    const savedSelectionRef = useRef(null);

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

      keyActions[event.key]();
    };

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
      <Grid className="lexical-table-popup-grid" gridSize={gridSize}>
        {Array.from({ length: gridSize * gridSize }).map((_, index) => {
          const row = Math.floor(index / gridSize);
          const col = index % gridSize;
          return (
            <Cell
              key={`grid-${row}-${col}`}
              data-index={index}
              aria-label={`Select row ${row + 1}, column ${col + 1}`}
              tabIndex={0}
              selected={row < selectedRows && col < selectedCols}
              className="lexical-table-popup-grid-cell"
              onMouseOver={() => handleMouseOver(index)}
              onClick={handleCellClick}
              onKeyDown={(e) => handleKeyDown(e, index)}
              role="button"
            />
          );
        })}
      </Grid>

      <label>{`${selectedRows} X ${selectedCols}`}</label>
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