<cfsilent>
<!---
Custom Tag: LexicalEditor
Usage: <cf_lexicaleditor 
    fieldname="myContent"
    fieldvalue=""
    toollist="bold italic underline ul ol undo redo"
    minheight="200px"
    maxheight="350px"
    editable="true"
    inlinetoolbar="true"
    spellcheckfunction="launchSpellCheck"
    spellcheckargs="false"
>
--->

<cfparam name="attributes.fieldname" default="editor">
<cfparam name="attributes.fieldvalue" default="">
<cfparam name="attributes.toollist" default="bold italic underline strikethrough code link unlink ul ol quote undo redo">
<cfparam name="attributes.minheight" default="200px">
<cfparam name="attributes.maxheight" default="350px">
<cfparam name="attributes.resize" default="vertical">
<cfparam name="attributes.editable" default="true">
<cfparam name="attributes.inlinetoolbar" default="true">
<cfparam name="attributes.spellcheckfunction" default="">
<cfparam name="attributes.spellcheckargs" default="">

<cfset fieldId = attributes.fieldname & "_id">
<cfset containerId = attributes.fieldname & "_container">

<!--- Build the documents array --->
<cfset documents = []>
<cfset arrayAppend(documents, {
    "name" = attributes.fieldname,
    "id" = fieldId,
    "body" = attributes.fieldvalue
})>

<!--- Build editor sizing object --->
<cfset editorSizing = {
    "minHeight" = attributes.minheight,
    "maxHeight" = attributes.maxheight,
    "resize" = attributes.resize
}>

<!--- Build spell check callback if provided --->
<cfset spellCheckCallback = "">
<cfif len(trim(attributes.spellcheckfunction))>
    <cfset spellCheckArgs = []>
    <cfif isArray(attributes.spellcheckargs)>
        <cfset spellCheckArgs = attributes.spellcheckargs>
    <cfelseif len(trim(attributes.spellcheckargs))>
        <cfset arrayAppend(spellCheckArgs, attributes.spellcheckargs)>
    </cfif>
    <cfset spellCheckCallback = {
        "fnSpellCheckFunction" = attributes.spellcheckfunction,
        "arySpellCheckFunctionArgs" = spellCheckArgs
    }>
</cfif>

</cfsilent><cfoutput>
<!--- Hidden field to store content --->
<input type="hidden" id="#fieldId#" name="#attributes.fieldname#" value="#HTMLEditFormat(attributes.fieldvalue)#">

<!--- Lexical Editor Component --->
<lexical-editor
    appcontainerid="#containerId#"
    aryeditordocuments='#serializeJSON(documents)#'
    toollist="#attributes.toollist#"
    editorsizing='#serializeJSON(editorSizing)#'
    inlinetoolbar="#attributes.inlinetoolbar#"
    editable="#attributes.editable#"
    <cfif len(trim(spellCheckCallback))>objspellcheckcallback='#serializeJSON(spellCheckCallback)#'</cfif>
></lexical-editor>
</cfoutput>
