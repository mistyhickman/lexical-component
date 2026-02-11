/**
 * initializeLexical - Creates a Lexical editor instance
 *
 * @param {string} fieldName - The name for the hidden form field
 * @param {string} fieldId   - The ID for the hidden form field (must match an existing hidden input)
 * @param {Object} [options] - Optional configuration overrides
 * @param {string} [options.toollist]     - Space-separated list of toolbar buttons
 * @param {string} [options.editable]     - "true" or "false" (default: "true")
 * @param {Object} [options.editorSizing] - e.g. { minHeight: "300px", maxHeight: "600px" }
 *
 * Usage:
 *   <input type="hidden" id="myField_id" name="myField" value="">
 *   <script>initializeLexical('myField', 'myField_id');</script>
 */
function initializeLexical(fieldName, fieldId, options) {
    options = options || {};

    var toollist = options.toollist ||
        'spellcheck undo redo bold italic underline subscript superscript removeformatting selectall ' +
        'alignleft aligncenter alignright alignjustify bullist numlist checklist outdent indent ' +
        'copy cut paste pasteword fontsize fontfamily fontcase table footnote horizontalrule maximize source';

    var editable = options.editable !== undefined ? options.editable : 'true';
    var containerId = fieldName + '_container';

    // Build the aryeditordocuments JSON
    var docsJson = '[{"name":"' + fieldName + '","id":"' + fieldId + '"}]';

    // Create the <lexical-editor> element
    var editorEl = document.createElement('lexical-editor');
    editorEl.setAttribute('appcontainerid', containerId);
    editorEl.setAttribute('aryeditordocuments', docsJson);
    editorEl.setAttribute('toollist', toollist);
    editorEl.setAttribute('editable', editable);

    // Apply editor sizing if provided
    if (options.editorSizing) {
        editorEl.setAttribute('editorsizing', JSON.stringify(options.editorSizing));
    }

    // Insert the editor after the hidden field
    var hiddenField = document.getElementById(fieldId);
    if (hiddenField) {
        hiddenField.parentNode.insertBefore(editorEl, hiddenField.nextSibling);
    } else {
        var targetDiv = document.getElementById(fieldName + '_editor');
        if (targetDiv) {
            targetDiv.appendChild(editorEl);
        } else {
            console.error('initializeLexical: Could not find element with id "' + fieldId + '" or "' + fieldName + '_editor"');
        }
    }
}

/**
 * previewContent - Opens a popup window displaying the editor's HTML content
 *
 * @param {string} fieldId - The ID of the hidden field to preview
 */
function previewContent(fieldId) {
    var content = document.getElementById(fieldId).value;
    var previewWindow = window.open('', 'PreviewWindow', 'width=800,height=600,scrollbars=yes,resizable=yes');
    previewWindow.document.open();
    previewWindow.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Content Preview</title></head><body>' + content + '</body></html>');
    previewWindow.document.close();
}
