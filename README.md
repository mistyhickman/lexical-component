# Lexical Editor - Complete Installation Guide

## Prerequisites

- Node.js and npm installed on your development machine (not needed on production server)
- Basic command line familiarity

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

## ☐ Step 4: Add build file to web application
- [ ] Copy `dist/lexical-editor.iife.js` to your application web root's folder (or other folder)
- [ ] Example: `C:\wwwroot\mysite\lexical-editor.iife.js`

## Step 5: Use the Editor

#### Method A: Direct Tag Usage

```html
<!--- Create hidden field to store content --->
<input type="hidden" id="myfield_id" name="myfield" value="">

<!--- Add the editor --->
<lexical-editor
    appcontainerid="myfield_container"
    aryeditordocuments='[{"name":"myfield","id":"myfield_id","body":""}]'
    toollist="bold italic underline ul ol undo redo"
></lexical-editor>
```

- [ ] Save and view in browser
- [ ] You should see an editor with Bold, Italic, Underline, etc buttons
- [ ] Type something and try the formatting buttons

## ✅ You're Done!

If all steps worked, you can now use the editor in your application.



## Custom Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| fieldname | "editor" | Name of the form field |
| fieldvalue | "" | Initial content (HTML) |
| toollist | "bold italic underline..." | Space-separated list of toolbar buttons |
| minheight | "200px" | Minimum editor height |
| maxheight | "350px" | Maximum editor height |
| resize | "vertical" | CSS resize property |
| editable | "true" | Whether editor is editable |
| inlinetoolbar | "true" | Toolbar stays at top when scrolling |
| spellcheckfunction | "" | JavaScript function name for spell check |
| spellcheckargs | "" | Arguments to pass to spell check function |

## Available Toolbar Buttons

Use these in the `toollist` parameter (space-separated):
- `bold` - Bold text
- `italic` - Italic text
- `underline` - Underline text
- `strikethrough` - Strikethrough text
- `code` - Code formatting
- `link` - Insert link
- `unlink` - Remove link
- `ul` - Bullet list
- `ol` - Numbered list
- `quote` - Block quote
- `undo` - Undo action
- `redo` - Redo action
- `spellcheck` - Spell check button (requires callback function)

Example: `toollist="bold italic underline ul ol undo redo"`



## Troubleshooting

## Common Issues

**"npm not found"**
→ Node.js not installed or not in PATH. Restart terminal after installing.

**"Cannot find module"**
→ Run `npm install` again

**Editor doesn't appear**
→ Check browser console (F12). Verify script src path is correct.


### Editor doesn't appear
1. Check browser console for errors (F12 → Console tab)
2. Verify the JavaScript file path is correct
3. Make sure the `<script>` tag is at the bottom of the page

### Content not saving
1. Check that the hidden field has the correct ID
2. Verify the form's submit action
3. Check that the field name matches what you're expecting in the form scope

### Styling issues
The component includes default styles. To customize:
1. Use browser dev tools to inspect elements
2. Add custom CSS to override default styles
3. Target classes like `.lexical-editor-container`, `.lexical-toolbar`, etc.

## Updating/Rebuilding

If you make changes to the React components:

1. Edit files in the `src/` folder
2. Run `npm run build` again
3. Copy the new `dist/lexical-editor.iife.js` to your ColdFusion application
4. Clear browser cache or hard refresh (Ctrl+F5)

## Production Deployment

For production:
1. Only deploy the `lexical-editor.iife.js` file and ColdFusion files
2. Do NOT deploy node_modules, src files, or package.json to production server
3. Consider minifying/compressing the JS file for faster loading
4. The built JS file is self-contained - no other dependencies needed

## File Sizes

- Built JavaScript file: ~500KB-1MB (minified)
- Includes all React and Lexical dependencies
- Loads once and works for all editors on the page

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

Does NOT work in Internet Explorer.

## Next Steps

1. Test with the index.html file
2. Integrate into your existing forms
3. Customize toolbar buttons per your needs
4. Add your spell check integration if needed
5. Style to match your application's look and feel

## Support Files Included

- `example-coldfusion-page.cfm` - Direct tag usage examples
- `simplified-example.cfm` - Custom tag usage examples
- `lexicaleditor.cfm` - Custom tag for easy integration
- `index.html` - Test page for development

## Need Help?

Check the browser console for error messages. Most issues are related to:
- Incorrect file paths
- Missing script tag
- JavaScript errors in spell check callbacks
- Malformed JSON in attributes
