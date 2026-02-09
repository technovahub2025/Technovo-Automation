import React, { useState, useEffect } from 'react';
import { MessageSquare, Eye } from 'lucide-react';
import './MessageTemplateEditor.css';

const MessageTemplateEditor = ({ value, onChange, error, disabled, language }) => {
  const [showPreview, setShowPreview] = useState(false);

  // Validate and filter input for Tamil language
  const handleTamilInput = (e) => {
    const inputValue = e.target.value;
    
    if (language === 'ta-IN') {
      // Filter out English letters and keep only Tamil characters, numbers, spaces, and allowed punctuation
      const tamilPattern = /[^\u0B80-\u0BFF\s0-9.,!?;:()\-\n"'']/g;
      const filteredValue = inputValue.replace(tamilPattern, '');
      
      // Update the textarea value to the filtered version
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
      // Enable Tamil input when Tamil language is selected
      if (language === 'ta-IN') {
        textarea.lang = 'ta';
        textarea.style.imeMode = 'active';
        // Add Google Input Tools support for Tamil
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
    <div className="form-section">
      <label className="form-label">
        <MessageSquare size={18} />
        Message Template
        {language === 'ta-IN' && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#64748b' }}>
            (தமிழில் உள்ளிடவும் - Type in Tamil)
          </span>
        )}
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

        {error && <span className="error-text">{error}</span>}

        <div className="template-info">
          <small>
            <strong>Note:</strong> 
            {language === 'ta-IN' 
              ? ' இந்த செய்தி அனைத்து தொடர்புகளுக்கும் வழங்கப்படும். தமிழில் உள்ளிட, உங்கள் கீபோர்டில் தமிழ் ஆதரவை இயக்கவும் அல்லது Google Input Tools பயன்படுத்தவும்.'
              : ' This message will be delivered as-is to all contacts.'
            }
          </small>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplateEditor;