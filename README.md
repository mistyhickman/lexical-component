# Lexical Editor - Complete Installation Guide

## Prerequisites

- Node.js and npm installed on your development machine (not needed on production server)
- Basic command line familiarity

---

## Part 1: Setup and Build (One-Time Setup)

# QUICK START CHECKLIST

Follow these steps in order.

## ☐ Step 1: Install Dependencies
- [ ] Run: `npm install`
- [ ] Wait for completion (green text = success)

## ☐ Step 2: Build
- [ ] Run: `npm run build`
- [ ] Check that `dist` folder was created
- [ ] Verify `dist/lexical-editor.iife.js` exists

## Step 3: Test During Development (Optional)

To see the editor working in your browser while developing:
```bash
npm run dev
```

Then open http://localhost:5173 in your browser. You should see test editors.
Press Ctrl+C to stop the dev server when done.

## ☐ Step 4: Add build file to web application outside of this repo
- [ ] Copy `dist/lexical-editor.iife.js` to your application web root's folder (or other folder)
- [ ] Example: `C:\wwwroot\mysite\lexical-editor.iife.js`

## Step 5: Use the Editor

Include the script on any page that needs an editor:

```html
<script src="/path/to/lexical-editor.iife.js"></script>
```

### Method A: Using the `initializeLexical` Helper (Recommended)

The `initializeLexical` function (defined in `customcalls.js`) is the easiest way to add an editor.
Create a hidden input to store the content, then call the function:

```html
<!-- Hidden field to store editor content -->
<input type="hidden" id="myField_id" name="myField" value="">

<!-- Initialize the editor after the field -->
<script>initializeLexical('myField', 'myField_id');</script>

<!-- With options -->
<script>initializeLexical('myField', 'myField_id', { accessLevel: 'level2' });</script>

<!-- With custom sizing -->
<script>initializeLexical('myField', 'myField_id', {
  accessLevel: 'level3',
  editorSizing: { minHeight: '300px', maxHeight: '600px' }
});</script>
```

### Method B: Direct Web Component Tag

You can also place the `<lexical-editor>` custom element directly in your HTML:

```html
<lexical-editor
  appcontainerid="my-editor-container"
  aryeditordocuments='[{"name":"myField","id":"myField_id"}]'
  toollist="bold italic underline bullist numlist undo redo"
  editable="true"
></lexical-editor>
```

- [ ] Save and view in browser
- [ ] You should see an editor with formatting buttons
- [ ] Type something and try the formatting buttons

## ✅ You're Done!

If all steps worked, you can now use the editor in your application.

---

## `initializeLexical` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fieldName` | string | *(required)* | The `name` attribute of the hidden form field |
| `fieldId` | string | *(required)* | The `id` attribute of the hidden form field |
| `options.accessLevel` | string | `"level1"` | Toolbar preset: `"level1"`, `"level2"`, or `"level3"` |
| `options.toollist` | string | *(from accessLevel)* | Space-separated toolbar buttons; overrides `accessLevel` when set |
| `options.editable` | string | `"true"` | Set to `"false"` to make the editor read-only |
| `options.buildletteroncomplete` | string | `"false"` | Set to `"true"` to trigger letter-building when spell check completes |
| `options.editorSizing` | object | `{ minHeight: "200px", maxHeight: "350px" }` | Size constraints for the editor |

---

## Web Component Attributes (`<lexical-editor>`)

| Attribute | Default | Description |
|-----------|---------|-------------|
| `appcontainerid` | `"lexical-container"` | Unique ID applied to the editor's outer container `<div>` |
| `aryeditordocuments` | `[]` | JSON array: `[{"name":"fieldName","id":"fieldId"}]` — the hidden field to sync content into |
| `toollist` | `"bold italic underline..."` | Space-separated list of toolbar buttons to show |
| `editable` | `"true"` | Set to `"false"` for a read-only display |
| `inlinetoolbar` | `"true"` | Set to `"false"` to allow the toolbar to scroll with content |
| `buildletteroncomplete` | `"false"` | Set to `"true"` to enable letter-building on spell check complete |
| `editorsizing` | `{"minHeight":"200px","maxHeight":"350px","resize":"vertical"}` | JSON object controlling editor dimensions |

---

## Access Level Presets

Use `options.accessLevel` in `initializeLexical` to quickly set a toolbar level.

| Level | Included Buttons |
|-------|-----------------|
| `level1` | `undo redo bold italic underline bullist numlist` |
| `level2` | `formatblock undo redo bold italic underline removeformatting selectall alignleft aligncenter alignright alignjustify bullist numlist checklist outdent indent copy cut paste fontsize fontfamily fontcase textcolor bgcolor` |
| `level3` | `formatblock spellcheck undo redo bold italic underline subscript superscript removeformatting selectall alignleft aligncenter alignright alignjustify bullist numlist checklist outdent indent copy cut paste pasteword fontsize fontfamily fontcase textcolor bgcolor table footnote horizontalrule maximize source` |

---

## Available Toolbar Buttons

Use these keys in the `toollist` parameter or `options.toollist`, separated by spaces:

### Text Formatting
| Key | Description |
|-----|-------------|
| `bold` | Bold |
| `italic` | Italic |
| `underline` | Underline |
| `subscript` | Subscript |
| `superscript` | Superscript |
| `removeformatting` | Strip all inline formatting from selection |
| `fontsize` | Font size selector |
| `fontfamily` | Font family selector |
| `fontcase` | Text case (UPPERCASE / lowercase / Title Case) |
| `textcolor` | Text (foreground) color picker |
| `bgcolor` | Background (highlight) color picker |
| `formatblock` | Paragraph/heading style selector (Normal, H1–H6, etc.) |

### Alignment
| Key | Description |
|-----|-------------|
| `alignleft` | Align left |
| `aligncenter` | Align center |
| `alignright` | Align right |
| `alignjustify` | Justify |

> All four alignment options are grouped into a single dropdown on the toolbar.

### Lists and Indentation
| Key | Description |
|-----|-------------|
| `bullist` | Bullet (unordered) list |
| `numlist` | Numbered (ordered) list |
| `checklist` | Checklist (clickable checkboxes) |
| `outdent` | Decrease indent |
| `indent` | Increase indent |

> `bullist`, `numlist`, and `checklist` are grouped into a single dropdown on the toolbar.

### Clipboard
| Key | Description |
|-----|-------------|
| `copy` | Copy selection to clipboard |
| `cut` | Cut selection to clipboard |
| `paste` | Paste from clipboard (plain text) |
| `pasteword` | Alias for `paste`; used by some external access level configurations |

> `copy`, `cut`, `paste`, and `pasteword` are grouped into a single dropdown on the toolbar.

### History
| Key | Description |
|-----|-------------|
| `undo` | Undo |
| `redo` | Redo |

### Selection
| Key | Description |
|-----|-------------|
| `selectall` | Select all content |

### Insert
| Key | Description |
|-----|-------------|
| `table` | Insert a table |
| `horizontalrule` | Insert a horizontal rule (`<hr>`) |
| `footnote` | Insert/manage endnotes (see Endnotes section below) |

### View
| Key | Description |
|-----|-------------|
| `maximize` | Toggle full-screen editor view |
| `source` | Toggle HTML source code view |
| `spellcheck` | Launch spell check (see Spell Check section below) |

---

## Spell Check Integration

The `spellcheck` toolbar button calls a **global JavaScript function** named `window.launchSpellCheck`.
This function is **not built into the editor** — it must be defined by the application that includes the editor.

**How it works:**

When the user clicks the Spell Check button, the editor calls:
```javascript
window.launchSpellCheck(buildLetterOnComplete);
```

`buildLetterOnComplete` is a boolean that is `true` when the `buildletteroncomplete` attribute/option is enabled.

**What you need to do in your application:**

Define `window.launchSpellCheck` somewhere on the page before the user can click the button.
The function signature and behavior are entirely up to your application:

```javascript
// Example: open your application's spell check dialog
window.launchSpellCheck = function(buildLetterOnComplete) {
    // Your spell check logic here.
    // The buildLetterOnComplete argument tells you whether the app
    // expects letter-building to happen after spell check finishes.
    myApp.openSpellCheck({ onComplete: buildLetterOnComplete });
};
```

If `window.launchSpellCheck` is not defined when the button is clicked, the editor logs a warning to the
browser console and does nothing:
```
launchSpellCheck() is not defined. Make sure the spell check script is included on the page.
```

**Where to change it:** The call is located in [src/ToolbarPlugin.jsx](src/ToolbarPlugin.jsx) in the
`handleSpellCheck` function. If your application uses a different global function name, update that
function to call whatever your system provides.

---

## Endnotes

When `footnote` is included in the toollist, a `※` button appears in the toolbar.
Clicking it opens a dialog that lets users add or edit numbered endnotes. The endnotes are rendered as
a numbered list at the bottom of the document and are exported as standard HTML with a
`<section class="footnotes">` wrapper for CKEditor compatibility.

### Endnote Configuration (`footnotesConfig`)

When using the React component directly, you can pass a `footnotesConfig` prop to customize the
endnote section. These options are **not available** via the `initializeLexical` helper or the
web component attribute (use the React component directly for these):

| Option | Default | Description |
|--------|---------|-------------|
| `title` | `"Endnotes"` | Heading text displayed above the endnote list |
| `disableHeader` | `false` | Set to `true` to suppress the heading entirely |
| `headerEls` | `["<h2>", "</h2>"]` | Array of opening and closing tags for the section heading |
| `prefix` | `""` | String prefix added to footnote IDs in the exported HTML (for namespacing when multiple editors appear on one page) |

---

## Global JavaScript API

The editor exposes a small global API that external code (such as popup windows or other scripts)
can use to read or write editor content without going through the form field.

### `window.activeLexicalEditorId`

A string containing the hidden field `id` of whichever editor the user most recently clicked into.
Useful when you need to know which of several editors on a page is currently active.

### `window.setLexicalEditorContent(fieldId, htmlContent)`

Replaces the entire content of the editor identified by `fieldId` with the provided HTML string.

```javascript
window.setLexicalEditorContent('myField_id', '<p>New content here.</p>');
```

### `window.insertIntoActiveLexicalEditor(htmlContent)`

Inserts HTML at the current cursor position in the last-focused editor.
If the cursor is not inside an editor, the content is appended to the end.

```javascript
window.insertIntoActiveLexicalEditor('<strong>Inserted text</strong>');
```

---

## Style Tag Handling

The editor preserves `<style>` blocks that may be present in the stored HTML content.
Because Lexical's core does not support `<style>` nodes, these blocks are extracted before
loading content into the editor and re-attached to the hidden field value on every save.
This means custom CSS in the stored HTML is maintained through edits and round-trips through
the source view without any special handling required.

---

## Updating / Rebuilding

If you make changes to the React components:

1. Edit files in the `src/` folder
2. Run `npm run build` again
3. Copy the new `dist/lexical-editor.iife.js` to your application
4. Clear browser cache or hard refresh (Ctrl+F5)

---

## Production Deployment

For production:
1. Only deploy the `lexical-editor.iife.js` file
2. Do **not** deploy `node_modules`, `src` files, or `package.json` to the production server
3. The built JS file is self-contained — no other dependencies needed
4. Consider enabling gzip compression on the server for faster delivery (~158 KB gzipped)

---

## File Sizes

- Built JavaScript file: ~510 KB (minified), ~159 KB (gzipped)
- Includes all React and Lexical dependencies bundled together
- Loads once and works for all editors on the page

---

## Browser Support

Works in all modern browsers:
- Chrome / Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Does **not** work in Internet Explorer.

---

## Troubleshooting

### Editor doesn't appear
1. Check the browser console for errors (F12 → Console tab)
2. Verify the `<script src="...">` path is correct
3. Make sure the `<script>` tag loads before any `initializeLexical` calls

### Content not saving
1. Check that the hidden field has the correct `id`
2. Verify the field `name` matches what your form/server expects
3. Confirm the form's submit action includes the hidden field

### Spell check button does nothing
1. Confirm `window.launchSpellCheck` is defined on the page before the user clicks
2. Check the browser console for the warning message
3. See the **Spell Check Integration** section above for setup instructions

### Clipboard paste not working
The Paste button uses the browser Clipboard API (`navigator.clipboard.readText()`).
Chrome and Edge require the page to be served over **HTTPS** (or `localhost`) for clipboard access.
If you see a permissions error in the console, check your protocol and browser clipboard permissions.

### Styling issues
The component injects default styles automatically. To override them:
1. Use browser dev tools to inspect elements
2. Add custom CSS after the editor script with higher specificity
3. Target classes like `.lexical-editor-container`, `.lexical-editor-wrapper`, `.lexical-content-editable`, etc.

### "Error parsing aryeditordocuments"
The `aryeditordocuments` attribute must be valid JSON. Common causes:
- Unescaped double quotes inside the HTML content stored in the attribute
- Use `initializeLexical` instead — it builds this JSON for you automatically

---

## Support Files Included

- `customcalls.js` — `initializeLexical` and `previewContent` helper functions
- `index.html` — Test page for development
