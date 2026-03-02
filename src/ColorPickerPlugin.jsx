/**
 * ColorPickerPlugin.jsx - A reusable color picker dropdown for the toolbar
 *
 * Displays a popover with an "Automatic" option (resets to default)
 * and a grid of standard colors. Used for both text color and
 * background color toolbar buttons.
 *
 * 508 / WCAG 2.1 AA compliance:
 *  - All interactive elements are <button> (keyboard + pointer accessible)
 *  - Each color button has a descriptive aria-label
 *  - The color grid has role="group" with an accessible name
 *  - Arrow-key navigation moves focus within the grid (like a toolbar widget)
 *  - onFocus/onBlur mirror the mouse hover outline so focus is always visible
 *  - MUI Popover provides the focus trap and Escape-to-close behaviour
 */

import React, { useRef } from 'react';
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

/** Human-readable names for screen readers, keyed by hex value */
const COLOR_NAMES = {
  '#000000': 'Black',        '#434343': 'Very Dark Gray',  '#666666': 'Dark Gray',
  '#999999': 'Gray',         '#b7b7b7': 'Medium Gray',     '#cccccc': 'Light Gray',
  '#d9d9d9': 'Very Light Gray', '#ffffff': 'White',
  '#ff0000': 'Red',          '#ff9900': 'Orange',          '#ffff00': 'Yellow',
  '#00ff00': 'Bright Green', '#00ffff': 'Cyan',            '#0000ff': 'Blue',
  '#9900ff': 'Purple',       '#ff00ff': 'Magenta',
  '#e06666': 'Light Red',    '#f6b26b': 'Light Orange',    '#ffd966': 'Light Yellow',
  '#93c47d': 'Light Green',  '#76a5af': 'Light Teal',      '#6fa8dc': 'Light Blue',
  '#8e7cc3': 'Light Purple', '#c27ba0': 'Light Pink',
  '#f4cccc': 'Pale Pink',    '#fce5cd': 'Pale Orange',     '#fff2cc': 'Pale Yellow',
  '#d9ead3': 'Pale Green',   '#d0e0e3': 'Pale Teal',       '#cfe2f3': 'Pale Blue',
  '#d9d2e9': 'Pale Purple',  '#ead1dc': 'Pale Lavender',
  '#990000': 'Dark Red',     '#b45f06': 'Dark Orange',     '#bf9000': 'Dark Yellow',
  '#38761d': 'Dark Green',   '#134f5c': 'Dark Teal',       '#0b5394': 'Dark Blue',
  '#351c75': 'Dark Purple',  '#741b47': 'Dark Magenta',
};

const COLS = 8;

export default function ColorPickerPlugin({ anchorEl, onClose, onSelectColor }) {
  const gridRef = useRef(null);

  /**
   * Arrow-key navigation within the color grid.
   * Moves focus between colour buttons without leaving the grid,
   * matching the ARIA "toolbar" / roving-tabindex keyboard pattern.
   */
  const handleGridKeyDown = (e, index) => {
    let nextIndex = null;
    if (e.key === 'ArrowRight')      nextIndex = Math.min(index + 1, COLORS.length - 1);
    else if (e.key === 'ArrowLeft')  nextIndex = Math.max(index - 1, 0);
    else if (e.key === 'ArrowDown')  nextIndex = Math.min(index + COLS, COLORS.length - 1);
    else if (e.key === 'ArrowUp')    nextIndex = Math.max(index - COLS, 0);

    if (nextIndex !== null) {
      e.preventDefault();
      const buttons = gridRef.current?.querySelectorAll('button[data-color-index]');
      buttons?.[nextIndex]?.focus();
    }
  };

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
      {/* Automatic (default) button — resets colour to the document default.
          Uses <button> so it is keyboard-accessible and announced by screen readers. */}
      <button
        type="button"
        onClick={() => { onSelectColor(null); onClose(); }}
        aria-label="Reset to automatic color"
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 8px',
          cursor: 'pointer',
          fontSize: '13px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid #ddd',
          marginBottom: '6px',
          textAlign: 'center',
          borderRadius: '4px 4px 0 0',
        }}
        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = ''; }}
        onFocus={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
        onBlur={(e) => { e.currentTarget.style.backgroundColor = ''; }}
      >
        Automatic
      </button>

      {/* Color grid
          role="group" + aria-label names the group of colour options.
          Arrow-key navigation is provided by handleGridKeyDown.
          Each swatch is a <button> with a human-readable aria-label. */}
      <div
        ref={gridRef}
        role="group"
        aria-label="Color palette"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 24px)`,
          gap: '3px',
        }}
      >
        {COLORS.map((color, index) => (
          <button
            key={color}
            type="button"
            data-color-index={index}
            onClick={() => { onSelectColor(color); onClose(); }}
            aria-label={`Select color: ${COLOR_NAMES[color] || color}`}
            title={COLOR_NAMES[color] || color}
            style={{
              width: '24px',
              height: '24px',
              backgroundColor: color,
              border: color === '#ffffff' ? '1px solid #ccc' : '1px solid transparent',
              borderRadius: '3px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              padding: 0,
              outline: 'none',
            }}
            onMouseOver={(e) => { e.currentTarget.style.outline = '2px solid #333'; e.currentTarget.style.outlineOffset = '1px'; }}
            onMouseOut={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid #333'; e.currentTarget.style.outlineOffset = '1px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
            onKeyDown={(e) => handleGridKeyDown(e, index)}
          />
        ))}
      </div>
    </Popover>
  );
}
