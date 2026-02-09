<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lexical Editor in ColdFusion</title>
</head>
<body>
    <h1>ColdFusion Lexical Editor Example</h1>

    <cfset fieldName = "myContent">
    <cfset fieldId = "#fieldName#_id">
    <cfset containerId = "#fieldName#_container">
    
    <!--- Hidden field to store editor content --->
    <input type="hidden" id="#fieldId#" name="#fieldName#" value="">

    <!--- Example 1: Basic Editor --->
    <h2>Basic Editor</h2>
    <lexical-editor
        appcontainerid="#containerId#"
        aryeditordocuments='[{"name":"#fieldName#","id":"#fieldId#","body":""}]'
        toollist="bold italic underline strikethrough code link unlink ul ol quote undo redo"
        inlinetoolbar="true"
        editable="true"
    ></lexical-editor>

    <hr>

    <!--- Example 2: Editor with Existing Content --->
    <cfset existingContent = "This is some <strong>existing</strong> content that was saved previously.">
    <cfset field2Name = "editableContent">
    <cfset field2Id = "#field2Name#_id">
    <cfset container2Id = "#field2Name#_container">
    
    <h2>Editor with Existing Content</h2>
    <input type="hidden" id="#field2Id#" name="#field2Name#" value="#HTMLEditFormat(existingContent)#">
    
    <lexical-editor
        appcontainerid="#container2Id#"
        aryeditordocuments='[{"name":"#field2Name#","id":"#field2Id#","body":"#JSStringFormat(existingContent)#"}]'
        toollist="bold italic underline ul ol undo redo"
    ></lexical-editor>

    <hr>

    <!--- Example 3: Custom Sizing and Spell Check --->
    <h2>Custom Sizing with Spell Check</h2>
    <cfset field3Name = "largeEditor">
    <cfset field3Id = "#field3Name#_id">
    <cfset container3Id = "#field3Name#_container">
    
    <input type="hidden" id="#field3Id#" name="#field3Name#" value="">
    
    <script>
    function launchSpellCheck(debug) {
        console.log('Spell check launched with debug:', debug);
        alert('Spell check functionality would be implemented here!');
        // Here you would integrate with your spell check service
    }
    </script>
    
    <lexical-editor
        appcontainerid="#container3Id#"
        aryeditordocuments='[{"name":"#field3Name#","id":"#field3Id#","body":""}]'
        editorsizing='{"minHeight":"300px","maxHeight":"600px","resize":"vertical"}'
        toollist="bold italic underline strikethrough code link unlink ul ol quote undo redo spellcheck"
        objspellcheckcallback='{"fnSpellCheckFunction":"launchSpellCheck","arySpellCheckFunctionArgs":[false]}'
    ></lexical-editor>

    <hr>

    <!--- Example 4: Read-Only Editor --->
    <h2>Read-Only Display</h2>
    <cfset readonlyContent = "This content cannot be edited.">
    <cfset field4Name = "readonlyField">
    <cfset field4Id = "#field4Name#_id">
    <cfset container4Id = "#field4Name#_container">
    
    <lexical-editor
        appcontainerid="#container4Id#"
        aryeditordocuments='[{"name":"#field4Name#","id":"#field4Id#","body":"#JSStringFormat(readonlyContent)#"}]'
        editable="false"
        toollist=""
    ></lexical-editor>

    <hr>

    <!--- Form submission example --->
    <form method="post" action="process.cfm">
        <h2>Submit Form Example</h2>
        
        <cfset formFieldName = "articleContent">
        <cfset formFieldId = "#formFieldName#_id">
        <cfset formContainerId = "#formFieldName#_container">
        
        <input type="hidden" id="#formFieldId#" name="#formFieldName#" value="">
        
        <lexical-editor
            appcontainerid="#formContainerId#"
            aryeditordocuments='[{"name":"#formFieldName#","id":"#formFieldId#","body":""}]'
            toollist="bold italic underline ul ol undo redo"
        ></lexical-editor>
        
        <br>
        <button type="submit">Submit Content</button>
    </form>

    <!--- Load the Lexical Editor Web Component --->
    <!--- IMPORTANT: Update this path to where you place the built JS file --->
    <script src="/js/lexical-editor.iife.js"></script>
</body>
</html>
