import React, { useState } from 'react';
import { MessageSquare, Eye, Code } from 'lucide-react';

const MessageTemplateEditor = ({ value, onChange, error, disabled, contacts }) => {
  const [showPreview, setShowPreview] = useState(false);

  const insertVariable = (variable) => {
    const cursorPos = document.getElementById('template-textarea').selectionStart;
    const newValue = value.substring(0, cursorPos) + `{{${variable}}}` + value.substring(cursorPos);
    onChange(newValue);
  };

  const getPreviewText = () => {
    if (!contacts || contacts.length === 0) return value;
    
    const sampleContact = contacts[0];
    let preview = value;
    
    // Replace variables
    preview = preview.replace(/{{name}}/g, sampleContact.name || 'Customer');
    preview = preview.replace(/{{phone}}/g, sampleContact.phone);
    
    Object.keys(sampleContact.customFields || {}).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, sampleContact.customFields[key]);
    });
    
    return preview;
  };

  const availableVariables = contacts.length > 0
    ? ['name', 'phone', ...Object.keys(contacts[0].customFields || {})]
    : ['name', 'phone'];

  return (
    <div className="form-section">
      <label className="form-label">
        <MessageSquare size={18} />
        Message Template
      </label>

      <div className="template-editor">
        <div className="editor-toolbar">
          <span className="toolbar-label">Insert variable:</span>
          {availableVariables.map(variable => (
            <button
              key={variable}
              type="button"
              className="variable-btn"
              onClick={() => insertVariable(variable)}
              disabled={disabled}
            >
              <Code size={14} />
              {variable}
            </button>
          ))}
          
          <button
            type="button"
            className="preview-btn"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye size={14} />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div className="template-preview">
            <p>{getPreviewText()}</p>
            {contacts.length === 0 && (
              <small className="preview-note">Upload contacts to see personalized preview</small>
            )}
          </div>
        ) : (
          <textarea
            id="template-textarea"
            className="form-textarea"
            placeholder="Hi {{name}}, we have a special offer for you!"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={5}
          />
        )}

        {error && <span className="error-text">{error}</span>}

        <div className="template-info">
          <small>
            <strong>Variables:</strong> Use {`{{variable}}`} format. Available: {availableVariables.join(', ')}
          </small>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplateEditor;