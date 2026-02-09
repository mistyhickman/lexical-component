import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
} from 'lexical';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  insertList,
  $isListNode,
} from '@lexical/list';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $isParentElementRTL, $wrapNodes, $isAtNodeEnd } from '@lexical/selection';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import { 
  $createHeadingNode,
  $createQuoteNode,
  HeadingTagType 
} from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  INSERT_HORIZONTAL_RULE_COMMAND,
  $createHorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';

const LowPriority = 1;

export default function ToolbarPlugin({ toolList, inline = true, spellCheckCallback }) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [fontSize, setFontSize] = useState('16px');
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceHTML, setSourceHTML] = useState('');
  const fontSizeRef = useRef(null);

  const tools = toolList.split(' ').filter(t => t.trim());

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsCode(selection.hasFormat('code'));

      const node = selection.anchor.getNode();
      const parent = node.getParent();
      setIsLink($isLinkNode(parent) || $isLinkNode(node));
    }
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        UNDO_COMMAND,
        () => {
          setCanUndo(editor.getEditorState()._selection !== null);
          return false;
        },
        LowPriority
      ),
      editor.registerCommand(
        REDO_COMMAND,
        () => {
          setCanRedo(editor.getEditorState()._selection !== null);
          return false;
        },
        LowPriority
      )
    );
  }, [editor, updateToolbar]);

  // Text formatting commands
  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const formatStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const formatSubscript = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript');
  };

  const formatSuperscript = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript');
  };

  const formatCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  // Alignment commands
  const formatAlignLeft = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
  };

  const formatAlignCenter = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
  };

  const formatAlignRight = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
  };

  const formatAlignJustify = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
  };

  // List commands
  const insertBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const insertNumberList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  // Indent/Outdent
  const formatOutdent = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'outdent');
  };

  const formatIndent = () => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'indent');
  };

  // Clipboard commands
  const handleCopy = () => {
    document.execCommand('copy');
  };

  const handleCut = () => {
    document.execCommand('cut');
  };

  const handlePaste = () => {
    document.execCommand('paste');
  };

  const handlePasteWord = () => {
    // For paste as plain text (removing Word formatting)
    navigator.clipboard.readText().then(text => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      });
    });
  };

  // Font size
  const handleFontSize = (e) => {
    const size = e.target.value;
    setFontSize(size);
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Apply font size via style
        const nodes = selection.getNodes();
        nodes.forEach(node => {
          const element = editor.getElementByKey(node.getKey());
          if (element) {
            element.style.fontSize = size;
          }
        });
      }
    });
  };

  // Table insertion
  const insertTable = () => {
    const rows = prompt('Number of rows:', '3');
    const cols = prompt('Number of columns:', '3');
    if (rows && cols) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%;">';
          for (let i = 0; i < parseInt(rows); i++) {
            tableHTML += '<tr>';
            for (let j = 0; j < parseInt(cols); j++) {
              tableHTML += '<td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>';
            }
            tableHTML += '</tr>';
          }
          tableHTML += '</table>';
          
          // Insert as text for now (proper table nodes would require custom node implementation)
          selection.insertText(tableHTML);
        }
      });
    }
  };

  // Footnote
  const insertFootnote = () => {
    const footnoteText = prompt('Enter footnote text:');
    if (footnoteText) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(`[${footnoteText}]`);
        }
      });
    }
  };

  // Horizontal rule
  const insertHorizontalRule = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const paragraph = $createParagraphNode();
        selection.insertNodes([paragraph]);
        // Insert HR as text for now
        selection.insertText('───────────────────────────────────');
      }
    });
  };

  // Maximize
  const toggleMaximize = () => {
    const container = document.querySelector('.lexical-editor-container');
    if (container) {
      if (!isMaximized) {
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.zIndex = '9999';
        container.style.backgroundColor = 'white';
        setIsMaximized(true);
      } else {
        container.style.position = '';
        container.style.top = '';
        container.style.left = '';
        container.style.width = '';
        container.style.height = '';
        container.style.zIndex = '';
        container.style.backgroundColor = '';
        setIsMaximized(false);
      }
    }
  };

  // Source code view
  const toggleSource = () => {
    if (!showSource) {
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const htmlString = root.getTextContent(); // Simplified - would need proper HTML serialization
        setSourceHTML(htmlString);
        setShowSource(true);
      });
    } else {
      // Parse source back into editor
      editor.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(sourceHTML));
        root.append(paragraph);
      });
      setShowSource(false);
    }
  };

  // Font case
  const changeFontCase = () => {
    const caseType = prompt('Enter case type:\n1 = UPPERCASE\n2 = lowercase\n3 = Title Case');
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent();
        let newText = text;
        
        if (caseType === '1') {
          newText = text.toUpperCase();
        } else if (caseType === '2') {
          newText = text.toLowerCase();
        } else if (caseType === '3') {
          newText = text.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        }
        
        selection.insertText(newText);
      }
    });
  };

  // Spell check
  const handleSpellCheck = () => {
    if (spellCheckCallback && spellCheckCallback.fnSpellCheckFunction) {
      const fn = window[spellCheckCallback.fnSpellCheckFunction];
      if (typeof fn === 'function') {
        const args = spellCheckCallback.arySpellCheckFunctionArgs || [];
        fn(...args);
      }
    }
  };

  const insertLink = useCallback(() => {
    if (!isLink) {
      const url = prompt('Enter URL:');
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editor, isLink]);

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $wrapNodes(selection, () => $createQuoteNode());
      }
    });
  };

  const toolbarStyle = {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #ccc',
    flexWrap: 'wrap',
    alignItems: 'center',
    ...(inline && { position: 'sticky', top: 0, zIndex: 10 })
  };

  const buttonStyle = {
    padding: '6px 10px',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    cursor: 'pointer',
    borderRadius: '3px',
    fontSize: '13px',
    minWidth: '30px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#d0d0d0',
    fontWeight: 'bold',
  };

  const separatorStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: '#ccc',
    margin: '0 4px',
  };

  return (
    <div className="lexical-toolbar" style={toolbarStyle}>
      {tools.includes('spellcheck') && spellCheckCallback && (
        <button
          onClick={handleSpellCheck}
          style={buttonStyle}
          title="Spell Check"
          aria-label="Spell Check"
        >
          ABC✓
        </button>
      )}

      {tools.includes('undo') && (
        <button
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          style={buttonStyle}
          title="Undo"
          aria-label="Undo"
        >
          ↶
        </button>
      )}
      {tools.includes('redo') && (
        <button
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          style={buttonStyle}
          title="Redo"
          aria-label="Redo"
        >
          ↷
        </button>
      )}

      {(tools.includes('undo') || tools.includes('redo')) && <div style={separatorStyle}></div>}

      {tools.includes('bold') && (
        <button
          onClick={formatBold}
          style={isBold ? activeButtonStyle : buttonStyle}
          title="Bold"
          aria-label="Format Bold"
        >
          <b>B</b>
        </button>
      )}
      {tools.includes('italic') && (
        <button
          onClick={formatItalic}
          style={isItalic ? activeButtonStyle : buttonStyle}
          title="Italic"
          aria-label="Format Italic"
        >
          <i>I</i>
        </button>
      )}
      {tools.includes('underline') && (
        <button
          onClick={formatUnderline}
          style={isUnderline ? activeButtonStyle : buttonStyle}
          title="Underline"
          aria-label="Format Underline"
        >
          <u>U</u>
        </button>
      )}
      {tools.includes('subscript') && (
        <button
          onClick={formatSubscript}
          style={isSubscript ? activeButtonStyle : buttonStyle}
          title="Subscript"
          aria-label="Subscript"
        >
          X<sub>2</sub>
        </button>
      )}
      {tools.includes('superscript') && (
        <button
          onClick={formatSuperscript}
          style={isSuperscript ? activeButtonStyle : buttonStyle}
          title="Superscript"
          aria-label="Superscript"
        >
          X<sup>2</sup>
        </button>
      )}

      {(tools.includes('bold') || tools.includes('italic') || tools.includes('underline')) && <div style={separatorStyle}></div>}

      {tools.includes('alignleft') && (
        <button
          onClick={formatAlignLeft}
          style={buttonStyle}
          title="Align Left"
          aria-label="Align Left"
        >
          ≡
        </button>
      )}
      {tools.includes('aligncenter') && (
        <button
          onClick={formatAlignCenter}
          style={buttonStyle}
          title="Align Center"
          aria-label="Align Center"
        >
          ≣
        </button>
      )}
      {tools.includes('alignright') && (
        <button
          onClick={formatAlignRight}
          style={buttonStyle}
          title="Align Right"
          aria-label="Align Right"
        >
          ≡̅
        </button>
      )}
      {tools.includes('alignjustify') && (
        <button
          onClick={formatAlignJustify}
          style={buttonStyle}
          title="Justify"
          aria-label="Justify"
        >
          ≡
        </button>
      )}

      {(tools.includes('alignleft') || tools.includes('aligncenter')) && <div style={separatorStyle}></div>}

      {tools.includes('bullist') && (
        <button
          onClick={insertBulletList}
          style={buttonStyle}
          title="Bullet List"
          aria-label="Bullet List"
        >
          ⁃
        </button>
      )}
      {tools.includes('numlist') && (
        <button
          onClick={insertNumberList}
          style={buttonStyle}
          title="Numbered List"
          aria-label="Numbered List"
        >
          1.
        </button>
      )}
      {tools.includes('outdent') && (
        <button
          onClick={formatOutdent}
          style={buttonStyle}
          title="Decrease Indent"
          aria-label="Outdent"
        >
          ⇤
        </button>
      )}
      {tools.includes('indent') && (
        <button
          onClick={formatIndent}
          style={buttonStyle}
          title="Increase Indent"
          aria-label="Indent"
        >
          ⇥
        </button>
      )}

      {(tools.includes('bullist') || tools.includes('numlist')) && <div style={separatorStyle}></div>}

      {tools.includes('copy') && (
        <button
          onClick={handleCopy}
          style={buttonStyle}
          title="Copy"
          aria-label="Copy"
        >
          📋
        </button>
      )}
      {tools.includes('cut') && (
        <button
          onClick={handleCut}
          style={buttonStyle}
          title="Cut"
          aria-label="Cut"
        >
          ✂️
        </button>
      )}
      {tools.includes('paste') && (
        <button
          onClick={handlePaste}
          style={buttonStyle}
          title="Paste"
          aria-label="Paste"
        >
          📄
        </button>
      )}
      {tools.includes('pasteword') && (
        <button
          onClick={handlePasteWord}
          style={buttonStyle}
          title="Paste as Plain Text"
          aria-label="Paste as Plain Text"
        >
          📝
        </button>
      )}

      {(tools.includes('copy') || tools.includes('paste')) && <div style={separatorStyle}></div>}

      {tools.includes('fontsize') && (
        <select
          ref={fontSizeRef}
          onChange={handleFontSize}
          value={fontSize}
          style={{
            padding: '4px 8px',
            border: '1px solid #ccc',
            borderRadius: '3px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
          title="Font Size"
        >
          <option value="10px">10px</option>
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
          <option value="28px">28px</option>
          <option value="32px">32px</option>
          <option value="36px">36px</option>
        </select>
      )}

      {tools.includes('fontcase') && (
        <button
          onClick={changeFontCase}
          style={buttonStyle}
          title="Change Case"
          aria-label="Change Case"
        >
          Aa
        </button>
      )}

      {tools.includes('table') && (
        <button
          onClick={insertTable}
          style={buttonStyle}
          title="Insert Table"
          aria-label="Insert Table"
        >
          ⊞
        </button>
      )}
      {tools.includes('footnote') && (
        <button
          onClick={insertFootnote}
          style={buttonStyle}
          title="Insert Footnote"
          aria-label="Insert Footnote"
        >
          †
        </button>
      )}
      {tools.includes('horizontalrule') && (
        <button
          onClick={insertHorizontalRule}
          style={buttonStyle}
          title="Insert Horizontal Rule"
          aria-label="Insert Horizontal Rule"
        >
          ─
        </button>
      )}

      {(tools.includes('table') || tools.includes('horizontalrule')) && <div style={separatorStyle}></div>}

      {tools.includes('maximize') && (
        <button
          onClick={toggleMaximize}
          style={isMaximized ? activeButtonStyle : buttonStyle}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label="Maximize"
        >
          {isMaximized ? '⊡' : '⊞'}
        </button>
      )}
      {tools.includes('source') && (
        <button
          onClick={toggleSource}
          style={showSource ? activeButtonStyle : buttonStyle}
          title="View Source"
          aria-label="View Source"
        >
          {'<>'}
        </button>
      )}
    </div>
  );
}
