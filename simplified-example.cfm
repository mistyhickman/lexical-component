<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexical Editor - Simplified Usage</title>
</head>
<body>
    <h1>Simplified Lexical Editor Examples</h1>

    <!--- Example 1: Simplest possible usage --->
    <h2>Basic Editor</h2>
    <cf_lexicaleditor fieldname="content1">

    <hr>

    <!--- Example 2: With existing content --->
    <h2>Editor with Content</h2>
    <cfset existingText = "This is some existing content to edit.">
    <cf_lexicaleditor 
        fieldname="content2" 
        fieldvalue="#existingText#"
        toollist="bold italic underline ul ol undo redo">

    <hr>

    <!--- Example 3: Large editor with spell check --->
    <h2>Large Editor with Spell Check</h2>
    
    <script>
    function mySpellChecker(showDebug) {
        alert('Spell check would run here. Debug mode: ' + showDebug);
    }
    </script>

    <cf_lexicaleditor 
        fieldname="content3"
        minheight="300px"
        maxheight="600px"
        toollist="bold italic underline strikethrough code link ul ol quote undo redo spellcheck"
        spellcheckfunction="mySpellChecker"
        spellcheckargs="true">

    <hr>

    <!--- Example 4: Read-only display --->
    <h2>Read-Only Content</h2>
    <cfset readonlyText = "This text cannot be edited.">
    <cf_lexicaleditor 
        fieldname="content4"
        fieldvalue="#readonlyText#"
        editable="false"
        toollist="">

    <hr>

    <!--- Example 5: In a form --->
    <form method="post" action="save.cfm">
        <h2>Article Editor in Form</h2>
        
        <label for="title">Title:</label><br>
        <input type="text" id="title" name="title" style="width:100%;padding:8px;margin-bottom:10px;"><br>
        
        <label>Article Content:</label><br>
        <cf_lexicaleditor 
            fieldname="articleBody"
            toollist="bold italic underline ul ol quote undo redo">
        
        <br><br>
        <button type="submit">Save Article</button>
    </form>

    <!--- Load the Lexical Editor JavaScript --->
    <script src="/js/lexical-editor.iife.js"></script>
</body>
</html>
