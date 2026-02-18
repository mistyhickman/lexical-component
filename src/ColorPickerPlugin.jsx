/**
 * ColorPickerPlugin.jsx - A reusable color picker dropdown for the toolbar
 *
 * Displays a popover with an "Automatic" option (resets to default)
 * and a grid of standard colors. Used for both text color and
 * background color toolbar buttons.
 */

import React from 'react';
import Popover from '@mui/material/Popover';

/**
 * Standard color palette — 8 columns × 5 rows (40 colors)
 * Row 1: Grayscale
 * Row 2: Vivid/saturated colors
 * Row 3: Medium tones
 * Row 4: Light tones
 * Row 5: Dark tones
 */
const COLORS = [
  // Row 1 – Grayscale
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  // Row 2 – Vivid
  '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
  // Row 3 – Medium
  '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0',
  // Row 4 – Light / pastel
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
  // Row 5 – Dark
  '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47',
];

const COLS = 8;

export default function ColorPickerPlugin({ anchorEl, onClose, onSelectColor }) {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        },
      }}
    >
      {/* Automatic (default) button */}
      <div
        onClick={() => { onSelectColor(null); onClose(); }}
        style={{
          padding: '6px 8px',
          cursor: 'pointer',
          fontSize: '13px',
          borderBottom: '1px solid #ddd',
          marginBottom: '6px',
          textAlign: 'center',
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      >
        Automatic
      </div>

      {/* Color grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 24px)`,
        gap: '3px',
      }}>
        {COLORS.map((color) => (
          <div
            key={color}
            onClick={() => { onSelectColor(color); onClose(); }}
            title={color}
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #ccc' : '1px solid transparent',
              borderRadius: '3px',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
            onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #333'; }}
            onMouseOut={(e) => { e.currentTarget.style.outline = ''; }}
          />
        ))}
      </div>
    </Popover>
  );
}
