import React, { useState } from 'react';
import { MessageSquare, Eye } from 'lucide-react';

const MessageTemplateEditor = ({ value, onChange, error, disabled }) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="form-section">
      <label className="form-label">
        <MessageSquare size={18} />
        Message Template
      </label>

      <div className="template-editor">
        <div className="editor-toolbar">
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
            <p>{value || 'Enter your message here...'}</p>
          </div>
        ) : (
          <textarea
            id="template-textarea"
            className="form-textarea"
            placeholder="Enter your message here..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={5}
          />
        )}

        {error && <span className="error-text">{error}</span>}

        <div className="template-info">
          <small>
            <strong>Note:</strong> This message will be delivered as-is to all contacts.
          </small>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplateEditor;