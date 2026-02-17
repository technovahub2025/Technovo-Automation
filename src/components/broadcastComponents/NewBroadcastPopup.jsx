import React from 'react';
import { X, Upload, Calendar, Send, Clock, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import MessagePreview from './MessagePreview';
import './Modal.css';

const NewBroadcastPopup = ({
  showNewBroadcastPopup,
  broadcastName,
  onBroadcastNameChange,
  messageType,
  templateName,
  onTemplateNameChange,
  officialTemplates,
  customMessage,
  onCustomMessageChange,
  uploadedFile,
  recipients,
  onFileUpload,
  onClearUpload,
  scheduledTime,
  onScheduledTimeChange,
  isSending,
  onSendBroadcast,
  onCreateBroadcast,
  onClose,
  onBackToChoice,
  getCurrentTime
}) => {
  if (!showNewBroadcastPopup) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-container new-broadcast-popup">
        <div className="popup-header">
          <div className="popup-title">
            <button 
              className="back-btn" 
              onClick={onBackToChoice}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                marginRight: '8px'
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <span>Create New Broadcast</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          <div className="form-group">
            <label>Campaign Name *</label>
            <input
              type="text"
              value={broadcastName}
              onChange={onBroadcastNameChange}
              placeholder="Enter campaign name"
              className="form-input"
            />
          </div>

          {messageType === 'template' && (
            <div className="form-group">
              <label>Template *</label>
              <select
                value={templateName}
                onChange={onTemplateNameChange}
                className="form-input"
              >
                <option value="">Select a template</option>
                {officialTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name} ({template.category}) - {template.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {messageType === 'text' && (
            <div className="form-group">
              <label>Message *</label>
              <textarea
                value={customMessage}
                onChange={onCustomMessageChange}
                placeholder="Enter your message"
                className="form-textarea"
                rows="4"
              />
            </div>
          )}

          <div className="form-group">
            <label>Recipients *</label>
            <div className="file-upload-area">
              <input
                type="file"
                accept=".csv"
                onChange={onFileUpload}
                id="csv-file-popup"
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-file-popup" className="file-upload-label">
                <Upload size={20} />
                <span>
                  {uploadedFile ? uploadedFile.name : 'Upload CSV file with phone numbers'}
                </span>
              </label>
            </div>
            
            {uploadedFile && (
              <div className="file-action-buttons">
                <button 
                  type="button"
                  className="replace-upload-btn"
                  onClick={() => {
                    const fileInput = document.getElementById('csv-file-popup');
                    if (fileInput) {
                      fileInput.value = '';
                      fileInput.click();
                    }
                  }}
                >
                  <RefreshCw size={16} />
                  Replace
                </button>
                <button 
                  type="button"
                  className="clear-upload-btn"
                  onClick={onClearUpload}
                >
                  <Trash2 size={16} />
                  Clear Upload
                </button>
              </div>
            )}
            
            {recipients.length > 0 && (
              <p className="recipients-count">
                {recipients.length} recipients loaded
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Schedule (Optional)</label>
            <div className="schedule-input-group">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={onScheduledTimeChange}
                className="form-input schedule-input-external"
                min={getCurrentTime()}
              />
              {scheduledTime && (
                <button
                  type="button"
                  className="clear-date-btn-external"
                  onClick={() => onScheduledTimeChange('')}
                  title="Clear schedule"
                >
                  <X size={16} />
                  Clear
                </button>
              )}
            </div>
            <p className={`schedule-hint ${scheduledTime ? 'scheduled' : ''}`}>
              {scheduledTime 
                ? `Scheduled for ${new Date(scheduledTime).toLocaleString()}`
                : 'Send immediately'
              }
            </p>
          </div>
        </div>

        <div className="popup-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              console.log('🔍 Button clicked');
              console.log('🔍 scheduledTime:', scheduledTime);
              console.log('🔍 isSending:', isSending);
              console.log('🔍 broadcastName:', broadcastName);
              console.log('🔍 recipients.length:', recipients.length);
              
              if (scheduledTime) {
                console.log('🔍 Calling onCreateBroadcast');
                onCreateBroadcast();
              } else {
                console.log('🔍 Calling onSendBroadcast');
                onSendBroadcast();
              }
            }}
            disabled={isSending || !broadcastName || recipients.length === 0}
          >
            {isSending ? (
              <>
                <div className="spinner"></div>
                Sending...
              </>
            ) : scheduledTime ? (
              'Schedule Broadcast'
            ) : (
              'Send Now'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewBroadcastPopup;
