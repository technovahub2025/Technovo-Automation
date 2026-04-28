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
  getCurrentTime,
  quietHoursEnabled,
  onQuietHoursEnabledChange,
  quietHoursStartHour,
  onQuietHoursStartHourChange,
  quietHoursEndHour,
  onQuietHoursEndHourChange,
  quietHoursTimezone,
  onQuietHoursTimezoneChange,
  quietHoursAction,
  onQuietHoursActionChange,
  retryPolicyEnabled,
  onRetryPolicyEnabledChange,
  retryMaxAttempts,
  onRetryMaxAttemptsChange,
  retryBackoffSeconds,
  onRetryBackoffSecondsChange,
  respectOptOut,
  onRespectOptOutChange,
  suppressionListRaw,
  onSuppressionListRawChange
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

          <div className="form-group policy-section">
            <label>Delivery & Compliance</label>

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(event) => onQuietHoursEnabledChange(event.target.checked)}
                />
                <span>Enable quiet hours</span>
              </label>
            </div>

            {quietHoursEnabled && (
              <div className="policy-grid">
                <div className="policy-field">
                  <span>Start hour</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={quietHoursStartHour}
                    onChange={(event) => onQuietHoursStartHourChange(event.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="policy-field">
                  <span>End hour</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={quietHoursEndHour}
                    onChange={(event) => onQuietHoursEndHourChange(event.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="policy-field">
                  <span>Timezone</span>
                  <input
                    type="text"
                    value={quietHoursTimezone}
                    onChange={(event) => onQuietHoursTimezoneChange(event.target.value)}
                    className="form-input"
                    placeholder="Asia/Kolkata"
                  />
                </div>
                <div className="policy-field">
                  <span>Action</span>
                  <select
                    value={quietHoursAction}
                    onChange={(event) => onQuietHoursActionChange(event.target.value)}
                    className="form-input"
                  >
                    <option value="defer">Defer send</option>
                    <option value="skip">Skip send</option>
                  </select>
                </div>
              </div>
            )}

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={retryPolicyEnabled}
                  onChange={(event) => onRetryPolicyEnabledChange(event.target.checked)}
                />
                <span>Enable retry policy</span>
              </label>
            </div>

            <div className="policy-grid">
              <div className="policy-field">
                <span>Max attempts</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={retryMaxAttempts}
                  disabled={!retryPolicyEnabled}
                  onChange={(event) => onRetryMaxAttemptsChange(event.target.value)}
                  className="form-input"
                />
              </div>
              <div className="policy-field">
                <span>Backoff (seconds)</span>
                <input
                  type="number"
                  min="5"
                  max="600"
                  value={retryBackoffSeconds}
                  disabled={!retryPolicyEnabled}
                  onChange={(event) => onRetryBackoffSecondsChange(event.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={respectOptOut}
                  onChange={(event) => onRespectOptOutChange(event.target.checked)}
                />
                <span>Respect opted-out recipients</span>
              </label>
            </div>

            <div className="policy-field">
              <span>Suppression list (comma/newline separated)</span>
              <textarea
                value={suppressionListRaw}
                onChange={(event) => onSuppressionListRawChange(event.target.value)}
                className="form-textarea policy-textarea"
                rows="3"
                placeholder="+919999999999, +919888888888"
              />
            </div>
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
