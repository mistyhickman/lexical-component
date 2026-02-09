<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexical Editor - All Toolbar Options</title>
</head>
<body>
    <h1>Lexical Editor - Complete Toolbar Examples</h1>

    <!--- Example 1: Full Toolbar with All Options --->
    <h2>Full Toolbar (All Options)</h2>
    <cf_lexicaleditor 
        fieldname="fullEditor"
        toollist="spellcheck undo redo bold italic underline subscript superscript alignleft aligncenter alignright alignjustify bullist numlist outdent indent copy cut paste pasteword fontsize fontcase table footnote horizontalrule maximize source"
        minheight="300px"
        maxheight="600px">

    <hr>

    <!--- Example 2: Basic Formatting Only --->
    <h2>Basic Formatting</h2>
    <cf_lexicaleditor 
        fieldname="basicEditor"
        toollist="bold italic underline undo redo">

    <hr>

    <!--- Example 3: Advanced Text Formatting --->
    <h2>Advanced Text Formatting</h2>
    <cf_lexicaleditor 
        fieldname="textEditor"
        toollist="bold italic underline subscript superscript fontsize fontcase undo redo">

    <hr>

    <!--- Example 4: Alignment and Lists --->
    <h2>Alignment and Lists</h2>
    <cf_lexicaleditor 
        fieldname="listEditor"
        toollist="alignleft aligncenter alignright alignjustify bullist numlist indent outdent undo redo">

    <hr>

    <!--- Example 5: Document Tools --->
    <h2>Document Tools</h2>
    <cf_lexicaleditor 
        fieldname="docEditor"
        toollist="copy cut paste pasteword table footnote horizontalrule maximize source undo redo">

    <hr>

    <!--- Example 6: Writer's Toolbar --->
    <h2>Writer's Toolbar (Recommended)</h2>
    <cf_lexicaleditor 
        fieldname="writerEditor"
        toollist="bold italic underline bullist numlist alignleft aligncenter alignright table footnote horizontalrule maximize undo redo"
        minheight="400px">

    <hr>

    <!--- Example 7: Minimal Toolbar --->
    <h2>Minimal Toolbar</h2>
    <cf_lexicaleditor 
        fieldname="minimalEditor"
        toollist="bold italic undo redo">

    <hr>

    <!--- Example 8: With Spell Check --->
    <h2>With Spell Check Function</h2>
    
    <script>
    function launchSpellCheck(fieldName, debug) {
        console.log('Spell check for field:', fieldName, 'Debug:', debug);
        alert('Spell check would run here for field: ' + fieldName);
        // Integrate with your spell check service here
        // You can get the content from the hidden field or from Lexical directly
    }
    </script>

    <cf_lexicaleditor 
        fieldname="spellEditor"
        toollist="spellcheck bold italic underline bullist numlist undo redo"
        spellcheckfunction="launchSpellCheck"
        spellcheckargs="#['spellEditor', false]#">

    <!--- Load the Lexical Editor JavaScript --->
    <script src="/js/lexical-editor.iife.js"></script>

    <hr>

    <h2>Available Toolbar Options</h2>
    <table border="1" cellpadding="8" cellspacing="0">
        <thead>
            <tr>
                <th>Tool Name</th>
                <th>Description</th>
                <th>Visual Icon</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>spellcheck</td><td>Launch spell check function</td><td>ABC✓</td></tr>
            <tr><td>undo</td><td>Undo last action</td><td>↶</td></tr>
            <tr><td>redo</td><td>Redo last action</td><td>↷</td></tr>
            <tr><td>bold</td><td>Bold text</td><td><b>B</b></td></tr>
            <tr><td>italic</td><td>Italic text</td><td><i>I</i></td></tr>
            <tr><td>underline</td><td>Underline text</td><td><u>U</u></td></tr>
            <tr><td>subscript</td><td>Subscript text</td><td>X<sub>2</sub></td></tr>
            <tr><td>superscript</td><td>Superscript text</td><td>X<sup>2</sup></td></tr>
            <tr><td>alignleft</td><td>Align text left</td><td>≡</td></tr>
            <tr><td>aligncenter</td><td>Align text center</td><td>≣</td></tr>
            <tr><td>alignright</td><td>Align text right</td><td>≡̅</td></tr>
            <tr><td>alignjustify</td><td>Justify text</td><td>≡</td></tr>
            <tr><td>bullist</td><td>Insert bullet list</td><td>⁃</td></tr>
            <tr><td>numlist</td><td>Insert numbered list</td><td>1.</td></tr>
            <tr><td>outdent</td><td>Decrease indent</td><td>⇤</td></tr>
            <tr><td>indent</td><td>Increase indent</td><td>⇥</td></tr>
            <tr><td>copy</td><td>Copy selected text</td><td>📋</td></tr>
            <tr><td>cut</td><td>Cut selected text</td><td>✂️</td></tr>
            <tr><td>paste</td><td>Paste from clipboard</td><td>📄</td></tr>
            <tr><td>pasteword</td><td>Paste as plain text (removes formatting)</td><td>📝</td></tr>
            <tr><td>fontsize</td><td>Change font size dropdown</td><td>[10px-36px]</td></tr>
            <tr><td>fontcase</td><td>Change text case (upper/lower/title)</td><td>Aa</td></tr>
            <tr><td>table</td><td>Insert table (prompts for rows/cols)</td><td>⊞</td></tr>
            <tr><td>footnote</td><td>Insert footnote</td><td>†</td></tr>
            <tr><td>horizontalrule</td><td>Insert horizontal rule/line</td><td>─</td></tr>
            <tr><td>maximize</td><td>Toggle fullscreen mode</td><td>⊞/⊡</td></tr>
            <tr><td>source</td><td>View/edit HTML source</td><td>&lt;&gt;</td></tr>
        </tbody>
    </table>

    <h3>Usage in toollist attribute:</h3>
    <p>Separate tool names with spaces:</p>
    <code>toollist="bold italic underline bullist numlist undo redo"</code>

    <h3>Order Recommendations:</h3>
    <ul>
        <li><strong>Start:</strong> spellcheck, undo, redo</li>
        <li><strong>Text Formatting:</strong> bold, italic, underline, subscript, superscript</li>
        <li><strong>Alignment:</strong> alignleft, aligncenter, alignright, alignjustify</li>
        <li><strong>Lists:</strong> bullist, numlist, indent, outdent</li>
        <li><strong>Clipboard:</strong> copy, cut, paste, pasteword</li>
        <li><strong>Advanced:</strong> fontsize, fontcase, table, footnote, horizontalrule</li>
        <li><strong>View:</strong> maximize, source</li>
    </ul>
</body>
</html>
