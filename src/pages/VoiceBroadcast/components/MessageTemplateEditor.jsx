import React, { useState, useEffect } from 'react';
import { MessageSquare, Eye } from 'lucide-react';
import './MessageTemplateEditor.css';

const MessageTemplateEditor = ({ value, onChange, error, disabled, language }) => {
  const [showPreview, setShowPreview] = useState(false);

  const handleTamilInput = (e) => {
    const inputValue = e.target.value;

    if (language === 'ta-IN') {
      const tamilPattern = /[^\u0B80-\u0BFF\s0-9.,!?;:()\-\n"'']/g;
      const filteredValue = inputValue.replace(tamilPattern, '');

      if (filteredValue !== inputValue) {
        e.target.value = filteredValue;
        onChange(filteredValue);
        return;
      }
    }

    onChange(inputValue);
  };

  useEffect(() => {
    const textarea = document.getElementById('template-textarea');
    if (textarea) {
      if (language === 'ta-IN') {
        textarea.lang = 'ta';
        textarea.style.imeMode = 'active';
        textarea.setAttribute('inputmode', 'text');
        textarea.setAttribute('autocomplete', 'off');
        textarea.setAttribute('spellcheck', 'false');
      } else {
        textarea.lang = 'en';
        textarea.style.imeMode = 'auto';
      }
    }
  }, [language]);

  return (
    <div className="form-section voice-broadcast__section">
      <label className="form-label voice-broadcast__label">
        <MessageSquare size={18} />
        Message Template
        {language === 'ta-IN' && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
            (தமிழில் உள்ளிடவும் - Type in Tamil)
          </span>
        )}
      </label>

      <div className="template-editor voice-broadcast__template-editor">
        <div className="editor-toolbar voice-broadcast__template-toolbar">
          <button
            type="button"
            className="preview-btn voice-broadcast__template-toggle"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye size={14} />
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {showPreview ? (
          <div className="template-preview voice-broadcast__template-preview">
            <p>{value || 'Enter your message here...'}</p>
          </div>
        ) : (
          <textarea
            id="template-textarea"
            className="form-textarea voice-broadcast__textarea"
            placeholder={language === 'ta-IN' ? 'உங்கள் செய்தியை இங்கே உள்ளிடவும்...' : 'Enter your message here...'}
            value={value}
            onChange={handleTamilInput}
            onKeyPress={handleTamilInput}
            onInput={handleTamilInput}
            disabled={disabled}
            rows={5}
            style={{
              fontFamily: language === 'ta-IN' ? "'Noto Sans Tamil', sans-serif" : 'inherit'
            }}
          />
        )}

        {error && <span className="error-text voice-broadcast__error-text">{error}</span>}

        <div className="template-info voice-broadcast__template-info">
          <small>
            <strong>Note:</strong>
            {language === 'ta-IN'
              ? ' இந்த செய்தி அனைத்துத் தொடர்புகளுக்கும் வழங்கப்படும். தமிழில் உள்ளிட, உங்கள் கீபோர்டில் தமிழ் ஆதரவை இயக்கவும் அல்லது Google Input Tools பயன்படுத்தவும்.'
              : ' This message will be delivered as-is to all contacts.'
            }
          </small>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplateEditor;
