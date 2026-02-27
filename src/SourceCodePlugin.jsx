import { useEffect, useRef, useState } from 'react';

import styled from '@emotion/styled';
import PropTypes from 'prop-types';

const SourceCodeContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
  `;

const SourceCodeHeader = styled.div`
  background-color: #f1f3f4;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #5f6368;
  display: flex;
  justify-content: space-between;
  align-items: center;
  `;

const WarningText = styled.div`
color: #d93025;
font-size: 11px;
`;

const SourceCodeTextArea = styled.textarea`
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid #ccc;
  border-top: none;
  border-radius: 0 0 4px 4px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  background-color: #f8f9fa;

  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const ErrorBanner = styled.div`
  margin-top: -1px;
  border: 1px solid #d93025;
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: #fde8e7;
  color: #8b1411;
  padding: 8px 12px;
  font-size: 12px;
`;

export default function SourceCodePlugin({ isSourceCodeView, onHtmlChange, initialHtml = ' ', error = null, onExitShortcut = () => {} }) {
  const [htmlContent, setHtmlContent] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isSourceCodeView) {
      setHtmlContent(initialHtml || '');
      // Move focus to the textarea when source view opens so keyboard users
      // land directly in the editing area without an extra Tab press.
      // Use a short delay to let the element fully render first.
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [initialHtml, isSourceCodeView]);

  const handleHtmlChange = (event) => {
    const newHtml = event.target.value;
    setHtmlContent(newHtml);
    onHtmlChange?.(newHtml);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExitShortcut();
    }
  };

  if (!isSourceCodeView) return null;

  return (
    // role="region" + aria-label turns this into a named landmark so screen
    // reader users can jump directly to the source editor from the landmark menu.
    <SourceCodeContainer role="region" aria-label="HTML source code editor">
      <SourceCodeHeader>
        {/* aria-hidden hides the decorative header text — the region label above
            already provides the accessible name for this section. */}
        <span aria-hidden="true">HTML Source Code</span>
        {/* role="note" marks the warning as supplemental information.
            The text label makes the warning understandable without colour alone. */}
        <WarningText role="note" aria-label="Warning: Invalid HTML may break formatting">
          ⚠ Invalid HTML may break formatting
        </WarningText>
      </SourceCodeHeader>

      <SourceCodeTextArea
        ref={textareaRef}
        value={htmlContent}
        onChange={handleHtmlChange}
        onKeyDown={handleKeyDown}
        placeholder="Edit the HTML source code here..."
        spellCheck={false}
        aria-label="HTML Source Code Editor"
        aria-multiline="true"
        aria-invalid={!!error}
        aria-describedby={error ? 'source-code-error' : 'source-code-hint'}
      />

      {/* Keyboard shortcut hint — always present but visually hidden; referenced
          by aria-describedby when there is no error so users know Ctrl+Enter exits. */}
      <span
        id="source-code-hint"
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        Press Control Enter to apply changes and return to the visual editor.
      </span>

      {error && (
        // role="alert" + aria-live="assertive" causes screen readers to
        // interrupt and announce the error immediately when it appears.
        <ErrorBanner id="source-code-error" role="alert" aria-live="assertive">
          <strong>Error:</strong> {error} Tip: remove scripts, inline event handlers, disallowed tags, and unsafe URLs.
        </ErrorBanner>
      )}
    </SourceCodeContainer>
  );
}

SourceCodePlugin.propTypes = {
  isSourceCodeView: PropTypes.bool.isRequired,
  onHtmlChange: PropTypes.func.isRequired,
  initialHtml: PropTypes.string,
  error: PropTypes.string,
  onExitShortcut: PropTypes.func,
};
