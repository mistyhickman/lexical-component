# TOOLBAR OPTIONS REFERENCE GUIDE

## Complete List of Available Toolbar Items

All toolbar items are passed as a space-delimited string in the `toollist` parameter.

### Text Formatting
- **bold** - Bold text (B)
- **italic** - Italic text (I)
- **underline** - Underline text (U)
- **subscript** - Subscript formatting (X₂)
- **superscript** - Superscript formatting (X²)
- **fontsize** - Font size dropdown (10px to 36px)
- **fontcase** - Change case (UPPERCASE, lowercase, Title Case)

### Alignment
- **alignleft** - Align left
- **aligncenter** - Center align
- **alignright** - Align right
- **alignjustify** - Justify text

### Lists and Indentation
- **bullist** - Bullet/unordered list
- **numlist** - Numbered/ordered list
- **indent** - Increase indent level
- **outdent** - Decrease indent level

### Clipboard Operations
- **copy** - Copy selected text
- **cut** - Cut selected text
- **paste** - Paste from clipboard
- **pasteword** - Paste as plain text (removes Word formatting)

### Document Elements
- **table** - Insert table (prompts for rows/columns)
- **footnote** - Insert footnote
- **horizontalrule** - Insert horizontal line

### Editor Controls
- **undo** - Undo last change
- **redo** - Redo last change
- **spellcheck** - Launch spell check (requires callback function)
- **maximize** - Toggle fullscreen mode
- **source** - View/edit HTML source code


## Tool Behavior Notes

### Font Size
- Shows dropdown with sizes: 10px, 12px, 14px, 16px (default), 18px, 20px, 24px, 28px, 32px, 36px
- Applies to selected text

### Font Case
- Prompts user to select:
  - 1 = UPPERCASE
  - 2 = lowercase  
  - 3 = Title Case
- Applies to selected text

### Footnote
- Prompts for footnote text
- Inserts as [footnote text]

### Horizontal Rule
- Inserts a horizontal line separator

### Maximize
- Toggles fullscreen mode
- Editor takes over entire viewport
- Click again to restore

### Source
- Switches to HTML source view
- Edit raw HTML if needed
- Click again to return to visual editor

### Paste Word
- Removes formatting from pasted content
- Useful when copying from Word/other rich text sources
- Pastes as plain text only



## Customizing Toolbar Appearance

The toolbar includes default styling, but you can override with CSS:

```css
/* Target the toolbar */
.lexical-toolbar {
    background-color: #your-color !important;
    padding: 10px !important;
}

/* Target toolbar buttons */
.lexical-toolbar button {
    font-size: 14px !important;
    padding: 8px 12px !important;
}

/* Active/selected button state */
.lexical-toolbar button[style*="font-weight: bold"] {
    background-color: #your-active-color !important;
}
```

## Order Matters

Tools appear in the toolbar in the exact order you list them. Recommended order:
1. Spell check (if used)
2. Undo/Redo
3. Text formatting (bold, italic, underline, etc.)
4. Alignment
5. Lists and indentation
6. Clipboard operations
7. Font controls
8. Document elements (table, footnote, HR)
9. View controls (maximize, source)

Example of well-ordered toolbar:
```
spellcheck undo redo bold italic underline subscript superscript alignleft aligncenter alignright alignjustify bullist numlist indent outdent fontsize fontcase table footnote horizontalrule maximize source
```

## After Making Changes

After updating the ToolbarPlugin.jsx file:
1. Run `npm run build`
2. Copy `dist/lexical-editor.iife.js` to your ColdFusion web root
3. Clear browser cache (Ctrl+F5)
4. Reload your page

## Testing Individual Tools

To test a specific tool, create a simple test page:

```html
<lexical-editor 
    fieldname="test"
    toollist="bold">
<script src="/js/lexical-editor.iife.js"></script>
```

Add one tool at a time to verify each works correctly in your environment.
