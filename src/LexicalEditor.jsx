import React, { useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';

import ToolbarPlugin from './ToolbarPlugin';

// Plugin to load initial content
function LoadContentPlugin({ documents }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    if (documents && documents.length > 0) {
      // Load the first document's content
      const firstDoc = documents[0];
      if (firstDoc.body) {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          
          // Parse HTML content
          const parser = new DOMParser();
          const doc = parser.parseFromString(firstDoc.body, 'text/html');
          const textContent = doc.body.textContent || '';
          
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode(textContent));
          root.append(paragraph);
        });
      }
    }
  }, [editor, documents]);
  
  return null;
}

// Plugin to set editable state
function EditablePlugin({ editable }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  
  return null;
}

// Plugin to sync content back to hidden fields
function SyncContentPlugin({ documents, containerId }) {
  const [editor] = useLexicalComposerContext();
  
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        
        // Update hidden fields for each document
        if (documents && documents.length > 0) {
          documents.forEach(doc => {
            const hiddenField = document.getElementById(doc.id);
            if (hiddenField) {
              hiddenField.value = textContent;
            }
          });
        }
      });
    });
  }, [editor, documents, containerId]);
  
  return null;
}

export default function LexicalEditor({ 
  appContainerId, 
  documents, 
  inlineToolbar = true,
  editorSizing = { minHeight: '200px', maxHeight: '350px', resize: 'vertical' },
  toolList = 'bold italic underline strikethrough code link unlink ul ol quote undo redo',
  editable = true,
  spellCheckCallback = null
}) {
  const [floatingAnchorElem, setFloatingAnchorElem] = useState(null);

  const onRef = (_floatingAnchorElem) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  const initialConfig = {
    namespace: 'LexicalEditor',
    theme: {
      paragraph: 'lexical-paragraph',
      heading: {
        h1: 'lexical-h1',
        h2: 'lexical-h2',
        h3: 'lexical-h3',
      },
      list: {
        ul: 'lexical-ul',
        ol: 'lexical-ol',
        listitem: 'lexical-listitem',
        nested: {
          listitem: 'lexical-nested-listitem',
        },
      },
      link: 'lexical-link',
      text: {
        bold: 'lexical-bold',
        italic: 'lexical-italic',
        underline: 'lexical-underline',
        strikethrough: 'lexical-strikethrough',
        code: 'lexical-code',
        subscript: 'lexical-subscript',
        superscript: 'lexical-superscript',
      },
    },
    onError: (error) => {
      console.error(error);
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
    ],
    editable: editable,
  };

  const contentEditableStyle = {
    minHeight: editorSizing.minHeight,
    maxHeight: editorSizing.maxHeight,
    resize: editorSizing.resize,
    overflow: 'auto',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    outline: 'none',
    ...(!editable && { backgroundColor: '#f5f5f5', cursor: 'not-allowed' })
  };

  return (
    <div id={appContainerId} className="lexical-editor-container">
      <LexicalComposer initialConfig={initialConfig}>
        <div className="lexical-editor-wrapper">
          <ToolbarPlugin 
            toolList={toolList} 
            inline={inlineToolbar}
            spellCheckCallback={spellCheckCallback}
          />
          <div className="lexical-editor-inner">
            <RichTextPlugin
              contentEditable={
                <div className="lexical-editor-scroller">
                  <div className="lexical-editor" ref={onRef}>
                    <ContentEditable 
                      className="lexical-content-editable"
                      style={contentEditableStyle}
                    />
                  </div>
                </div>
              }
              placeholder={
                <div className="lexical-placeholder" style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  color: '#999',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}>
                  Enter some text...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <TabIndentationPlugin />
            <AutoFocusPlugin />
            <LoadContentPlugin documents={documents} />
            <EditablePlugin editable={editable} />
            <SyncContentPlugin documents={documents} containerId={appContainerId} />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
}