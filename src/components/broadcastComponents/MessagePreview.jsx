import React from 'react';
import './MessagePreview.css';
import { FileText, Users } from 'lucide-react';
import whatsappLogo from '../../assets/WhatsApp.svg.webp';

const MessagePreview = ({
  messageType,
  templateName,
  selectedTemplate,
  templateHeaderMediaUrl,
  customMessage,
  recipients,
  getTemplatePreview,
  getMessagePreview
}) => {
  const templateHeader = selectedTemplate?.content?.header || null;
  const templateHeaderType = String(templateHeader?.type || templateHeader?.format || '').trim().toLowerCase();
  const resolvedTemplateHeaderMediaUrl = String(
    templateHeaderMediaUrl || templateHeader?.mediaUrl || ''
  ).trim();

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getCurrentPhoneTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="preview-section">
      <h3>Message Preview</h3>

      <div className="phone-mockup">
        <div className="phone-header">
          <span className="phone-time">{getCurrentPhoneTime()}</span>
          <div className="phone-icons">
            <span className="network-icon">📶</span>
            <span className="signal-bars">📶</span>
            <span className="battery">🔋</span>
          </div>
        </div>

        <div className="chat-header">
          <div className="chat-header-left">
            <span className="back-arrow">←</span>

            <div className="contact-info">
              <div className="contact-avatar">
                <img src={whatsappLogo} alt="WhatsApp Business" className="contact-avatar-img" />
              </div>

              <div className="contact-details">
                <div className="contact-name">
                  WhatsApp Business <span className="verified-badge">✓</span>
                </div>
                <div className="contact-status">Online</div>
              </div>
            </div>
          </div>

          <div className="chat-header-right">
            <span className="menu-icon">⋮</span>
          </div>
        </div>

        <div className="chat-container">
          <div className="date-separator">
            <span className="date-text">Today</span>
          </div>

          <div className="message-bubble sent">
            {messageType === 'template' ? (
              templateName ? (
                <>
                  {templateHeaderType === 'image' && resolvedTemplateHeaderMediaUrl ? (
                    <div className="template-media-preview">
                      <img
                        src={resolvedTemplateHeaderMediaUrl}
                        alt={`${templateName} header`}
                        className="template-media-preview__image"
                      />
                      <span className="template-media-preview__label">Image header from template</span>
                    </div>
                  ) : templateHeaderType === 'image' ? (
                    <div className="template-media-preview template-media-preview--missing">
                      <span className="template-media-preview__label">Image header required. Upload one to preview.</span>
                    </div>
                  ) : null}
                  <p className="template-content">{getTemplatePreview()}</p>
                </>
              ) : (
                <p className="placeholder-text">Select a template to preview</p>
              )
            ) : customMessage ? (
              <p className="custom-content">{getMessagePreview()}</p>
            ) : (
              <p className="placeholder-text">Enter your custom message to preview</p>
            )}

            {recipients.length > 0 && (
              <div className="recipient-preview">
                <small>📱 Sending to {recipients.length} recipient(s)</small>
              </div>
            )}

            <div className="message-meta">
              <span className="msg-time">{getCurrentTime()}</span>
              <span className="message-status">
                <span className="checkmark">✓</span>
                <span className="checkmark">✓</span>
              </span>
            </div>
          </div>
        </div>

        <div className="chat-input">
          <div className="input-container">
            <span className="emoji-icon">😊</span>
            <input type="text" className="message-input" placeholder="Type a message" readOnly />
            <span className="attachment-icon">📎</span>
            <span className="camera-icon">📷</span>
            <span className="mic-icon">🎤</span>
          </div>
        </div>
      </div>

      <div className="preview-info">
        {messageType === 'template' ? (
          <div className="info-badge official">WhatsApp Template</div>
        ) : (
          <div className="info-badge custom">
            <FileText size={12} />
            Custom Text Message
          </div>
        )}

        <div className="preview-stats">
          <span className="stat-item">
            <Users size={12} />
            {recipients.length} recipients
          </span>
          <span className="stat-item">
            <FileText size={12} />
            {messageType === 'template' ? 'Template' : 'Custom'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessagePreview;
