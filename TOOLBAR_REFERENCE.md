# TOOLBAR OPTIONS REFERENCE GUIDE

## Complete List of Available Toolbar Items

All toolbar items are passed as a space-delimited string in the `toollist` parameter.

---

### Paragraph / Block Style

- **formatblock** — Paragraph format selector dropdown. Options: Normal, Heading 1–6, Formatted (`<pre>`), Address, Normal (DIV)

---

### Text Formatting

- **bold** — Bold text
- **italic** — Italic text
- **underline** — Underline text
- **subscript** — Subscript (e.g. H₂O)
- **superscript** — Superscript (e.g. X²)
- **removeformatting** — Strips all inline formatting (bold, italic, color, font, etc.) from selected text
- **fontsize** — Font size dropdown (10px to 36px)
- **fontfamily** — Font family dropdown. Options: Default, Arial, Comic Sans MS, Courier New, Georgia, Lucida Console, Tahoma, Times New Roman, Trebuchet MS, Verdana
- **fontcase** — Change case dropdown. Options: UPPERCASE, lowercase, Title Case, Sentence case
- **textcolor** — Text (foreground) color picker
- **bgcolor** — Background (highlight) color picker

---

### Alignment

> **Note:** `alignleft`, `aligncenter`, `alignright`, and `alignjustify` are displayed as a single
> dropdown on the toolbar. Include any one of these keys to show the dropdown; only the options
> whose keys appear in the toollist will be shown inside it.

- **alignleft** — Align left
- **aligncenter** — Center align
- **alignright** — Align right
- **alignjustify** — Justify text

---

### Lists and Indentation

> **Note:** `bullist`, `numlist`, and `checklist` are grouped into a single dropdown on the toolbar.

- **bullist** — Bullet (unordered) list
- **numlist** — Numbered (ordered) list
- **checklist** — Checklist with clickable checkboxes
- **outdent** — Decrease indent level
- **indent** — Increase indent level

---

### Clipboard Operations

> **Note:** `copy`, `cut`, `paste`, and `pasteword` are grouped into a single dropdown on the toolbar.

- **copy** — Copy selected text to the clipboard
- **cut** — Cut selected text to the clipboard
- **paste** — Paste plain text from the clipboard at the cursor
- **pasteword** — Alias for `paste`; included for compatibility with external toollist configurations that use the `pasteword` key

> **Browser note:** Paste uses the browser Clipboard API (`navigator.clipboard.readText()`), which
> requires the page to be served over **HTTPS** (or `localhost`). Paste via keyboard shortcut
> (Ctrl+V / Cmd+V) always works regardless.

---

### Selection

- **selectall** — Select all content in the editor

---

### History

- **undo** — Undo last change
- **redo** — Redo last change

---

### Document Elements

- **table** — Insert a table (prompts for number of rows and columns)
- **footnote** — Insert or manage endnotes (opens a dialog — see Endnote Notes below)
- **horizontalrule** — Insert a horizontal rule (`<hr>`)

---

### Editor Controls

- **spellcheck** — Launch spell check (see Spell Check Notes below)
- **maximize** — Toggle fullscreen mode
- **source** — View and edit the raw HTML source of the editor content

---

## Tool Behavior Notes

### Format Block (`formatblock`)

Displays a dropdown at the start of the toolbar. Selecting an option wraps the current paragraph
in the chosen block element:

| Option | Element |
|--------|---------|
| Normal | `<p>` |
| Heading 1–6 | `<h1>`–`<h6>` |
| Formatted | `<pre>` |
| Address | `<address>` |
| Normal (DIV) | `<div>` |

---

### Font Size (`fontsize`)

Dropdown with sizes: 10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 36px.
Applies to selected text. If no text is selected, the size is applied to the next characters typed.

---

### Font Family (`fontfamily`)

Dropdown selector. The first option reads "Font (Default)" and clears any font override.
Applies to selected text.

---

### Font Case (`fontcase`)

Dropdown selector with four options:
- **UPPERCASE** — Converts selection to all capitals
- **lowercase** — Converts selection to all lowercase
- **Title Case** — Capitalizes the first letter of each word
- **Sentence case** — Capitalizes only the first letter of the selection

Applies to the currently selected text.

---

### Text Color / Background Color (`textcolor` / `bgcolor`)

Opens a color picker dialog. Click a swatch to apply the color to selected text.
A "Remove Color" option is included to clear any applied color.

---

### Remove Formatting (`removeformatting`)

Strips all inline formatting from the selected text, including bold, italic, underline,
font size, font family, color, and background color. Block-level structure (headings, lists, etc.)
is not affected.

---

### Checklist (`checklist`)

Inserts a list with clickable checkbox items. Clicking a checkbox in the editor marks it as
checked (strikethrough style). The checked state is preserved in the exported HTML.

---

### Endnote / Footnote (`footnote`)

Opens a dialog that lets the user add new endnotes or edit existing ones.
Endnotes are displayed in the document as superscript reference markers inline,
with a numbered endnote list rendered at the bottom of the document.

The endnote section is exported as:
```html
<section class="footnotes">
  <h2>Endnotes</h2>
  <ol>
    <li id="fn-1">...</li>
  </ol>
</section>
```

The section heading and element type can be configured via `footnotesConfig` when using the
React component directly (see README.md for details).

---

### Horizontal Rule (`horizontalrule`)

Inserts a full-width `<hr>` element at the current cursor position.

---

### Maximize (`maximize`)

Toggles the editor into a full-viewport overlay. The toolbar remains visible.
Click the button again (or press Escape) to return to normal view.

---

### Source (`source`)

Switches the editor into an HTML source editing view. The raw HTML of the document is
displayed in a text area and can be edited directly. Clicking Source again (or pressing
Ctrl+Enter / Cmd+Enter) applies the changes and returns to the visual editor.

> `<style>` blocks in the source are preserved through round-trips — they are stored separately
> and re-attached to the saved HTML without being processed by Lexical.

---

### Spell Check (`spellcheck`)

Clicking the Spell Check button (`ABC✓`) calls a **global JavaScript function** that your
application must define:

```javascript
window.launchSpellCheck = function(buildLetterOnComplete) {
    // Your application's spell check logic goes here.
    // buildLetterOnComplete is true if the buildletteroncomplete option was enabled.
};
```

If `window.launchSpellCheck` is not defined, the button logs a warning to the console and
does nothing. The editor itself does not provide spell check functionality — it only acts as
the trigger point for whatever function your application supplies.

**Where to change it:** `src/ToolbarPlugin.jsx` → `handleSpellCheck` function.

---

### Paste / Paste Word (`paste` / `pasteword`)

Both keys show the same "Paste" option in the clipboard dropdown and behave identically —
they paste plain text from the system clipboard at the current cursor position.
`pasteword` exists solely for compatibility with external configurations that use that key name.

---

## Dropdown Groupings

Three groups of toolbar buttons are rendered as a single dropdown each:

| Dropdown | Keys it covers |
|----------|---------------|
| Alignment | `alignleft` `aligncenter` `alignright` `alignjustify` |
| Lists | `bullist` `numlist` `checklist` |
| Clipboard | `copy` `cut` `paste` `pasteword` |

Only the keys that appear in the `toollist` are shown as options inside each dropdown.
If none of the keys for a group appear in the toollist, that dropdown is hidden entirely.

---

## Recommended Toolbar Order

Tools appear in the order they are listed in the toollist string.
The access level presets use this ordering, which is a good baseline:

```
formatblock spellcheck undo redo bold italic underline subscript superscript
removeformatting selectall alignleft aligncenter alignright alignjustify
bullist numlist checklist outdent indent copy cut paste pasteword
fontsize fontfamily fontcase textcolor bgcolor
table footnote horizontalrule maximize source
```

---

## Customizing Toolbar Appearance

Override the default styles with CSS:

```css
/* Toolbar container */
.lexical-toolbar {
    background-color: #f0f0f0 !important;
    padding: 6px 8px !important;
}

/* All toolbar buttons */
.lexical-toolbar button {
    font-size: 14px !important;
    padding: 4px 8px !important;
}
```

---

## After Making Changes to the Source

After editing any file in `src/`:

1. Run `npm run build`
2. Copy `dist/lexical-editor.iife.js` to your application's web root
3. Hard-refresh the browser (Ctrl+F5) to clear the cached script
4. Reload your page

---

## Testing Individual Tools

To verify a specific tool works in your environment, use `initializeLexical` with a minimal toollist:

```html
<input type="hidden" id="test_id" name="test" value="">
<script src="/path/to/lexical-editor.iife.js"></script>
<script>initializeLexical('test', 'test_id', { toollist: 'bold' });</script>
```

Add tools one at a time to isolate any issues.
