import React from 'react';
import { 
  CheckCircle, 
  FileText, 
  Upload, 
  Calendar, 
  Send, 
  Clock,
  RefreshCw
} from 'lucide-react';
import MessagePreview from './MessagePreview';
import './ScheduleForm.css';

const ScheduleForm = ({
  messageType,
  broadcastName,
  onBroadcastNameChange,
  onMessageTypeChange,
  templateName,
  onTemplateNameChange,
  language,
  templateFilter,
  onTemplateFilterChange,
  officialTemplates,
  filteredTemplates,
  onSyncTemplates,
  templateVariables,
  customMessage,
  onCustomMessageChange,
  selectedLocalTemplate,
  onLocalTemplateSelect,
  templates,
  onFileUpload,
  uploadedFile,
  recipients,
  fileVariables,
  onClearUpload,
  scheduledTime,
  onScheduledTimeChange,
  isSending,
  onCreateBroadcast,
  onSendBroadcast,
  sendResults,
  onBackToOverview
}) => {
  return (
    <div className="schedule-form-container">
      <div className="campaign-config-wrapper">
        <div className="form-section">
          <h3>Configure WhatsApp Campaign</h3>

          <div className="form-group">
            <label>Campaign Name</label>
            <input
              type="text"
              placeholder="e.g. Diwali Promo 2024"
              value={broadcastName}
              onChange={onBroadcastNameChange}
            />
          </div>

          <div className="form-group">
            <label>Message Type</label>
            <div className="message-type-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="message_type"
                  value="template"
                  checked={messageType === 'template'}
                  onChange={onMessageTypeChange}
                />
                <span>
                  <CheckCircle size={14} /> WhatsApp Template
                </span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="message_type"
                  value="text"
                  checked={messageType === 'text'}
                  onChange={onMessageTypeChange}
                />
                <span>
                  <FileText size={14} /> Custom Text Message
                </span>
              </label>
            </div>
          </div>

          {messageType === 'template' ? (
            <>
              <div className="form-group">
                <label>
                  <CheckCircle size={16} /> Template Name
                </label>

                <div className="template-filters">
                  <button 
                    className={`filter-btn ${templateFilter === 'all' ? 'active' : ''}`} 
                    onClick={() => onTemplateFilterChange('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`filter-btn ${templateFilter === 'marketing' ? 'active' : ''}`} 
                    onClick={() => onTemplateFilterChange('marketing')}
                  >
                    Marketing
                  </button>
                  <button 
                    className={`filter-btn ${templateFilter === 'utility' ? 'active' : ''}`} 
                    onClick={() => onTemplateFilterChange('utility')}
                  >
                    Utility
                  </button>
                  <button 
                    className={`filter-btn ${templateFilter === 'authentication' ? 'active' : ''}`} 
                    onClick={() => onTemplateFilterChange('authentication')}
                  >
                    Authentication
                  </button>
                </div>

                <div className="template-selector-with-sync">
                  <select value={templateName} onChange={onTemplateNameChange}>
                    <option value="">Select template...</option>
                    {filteredTemplates.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.name} ({template.language}) - {template.status}
                      </option>
                    ))}
                  </select>
                  
                  <button 
                    type="button" 
                    className="sync-templates-btn" 
                    onClick={onSyncTemplates}
                    title="Sync templates from WhatsApp Business Manager"
                  >
                    <RefreshCw size={16} />
                  </button>

                  {templateName && (() => {
                    const selectedTemplate = officialTemplates.find(t => t.name === templateName);
                    const variableCount = selectedTemplate ? 
                      (selectedTemplate.content?.body?.match(/\{\{\d+\}\}/g) || []).length :
                      0;
                    return variableCount > 0 ? (
                      <div className="variable-count-indicator">
                        {variableCount} variable{variableCount !== 1 ? 's' : ''} required
                      </div>
                    ) : null;
                  })()}
                </div>

                <small>These are your approved templates from WhatsApp Business Manager</small>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>
                  <FileText size={16} /> Custom Message
                </label>

                <div className="whatsapp-message-input">
                  <textarea
                    placeholder="Type your message here..."
                    value={customMessage}
                    onChange={onCustomMessageChange}
                    rows={4}
                    className="message-textarea"
                    maxLength={1000}
                  />

                  <div className="message-input-footer">
                    <span className="char-count">{customMessage.length}/1000</span>
                    <div className="message-actions">
                      <span className="action-icon">😊</span>
                      <span className="action-icon">📎</span>
                    </div>
                  </div>
                </div>

                <small>
                  Use {'{var1}'}, {'{var2}'} or {'{{1}}'}, {'{{2}}'} for variables from CSV.
                </small>
              </div>

              <div className="form-group">
                <label>Or use saved local template:</label>
                <div className="template-selector">
                  <select
                    value={selectedLocalTemplate}
                    onChange={(e) => onLocalTemplateSelect(e.target.value)}
                    className="template-dropdown"
                  >
                    <option value="">Select message template...</option>
                    {templates.map((template) => (
                      <option key={template._id || template.name} value={template.name}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <small>These are custom message templates</small>
              </div>
            </>
          )}

          <div className="form-group">
            <label>
              <Upload size={16} /> Upload Recipients CSV
            </label>

            <div className="csv-upload-area">
              <input type="file" accept=".csv" onChange={onFileUpload} id="csv-upload" className="csv-input" />

              <label htmlFor="csv-upload" className="csv-upload-label">
                <div className="upload-content">
                  <div className="upload-icon">📄</div>
                  <div className="upload-text">
                    <p>Click to upload</p>
                    <span>CSV files only</span>
                  </div>
                </div>
              </label>
            </div>

            <small>Format: phone,var1,var2,var3...</small>
          </div>

          <div className="form-group">
            <label>
              <Calendar size={16} /> Schedule Time (Optional)
            </label>

            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={onScheduledTimeChange}
              min={new Date().toISOString().slice(0, 16)}
            />

            <small>Leave empty to send immediately</small>
          </div>

          {uploadedFile && (
            <div className="file-info-card">
              <div className="file-details">
                <div className="file-icon">📊</div>

                <div className="file-info">
                  <p className="file-name">{uploadedFile.name}</p>
                  <p className="file-stats">{recipients.length} recipients found</p>

                  {fileVariables.length > 0 && (
                    <p className="variables-info">
                      ✅ {fileVariables.length} variables detected: {fileVariables.join(', ')}
                    </p>
                  )}
                </div>

                <button
                  className="remove-file"
                  onClick={onClearUpload}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button className="secondary-btn" onClick={onBackToOverview}>
              Back to Overview
            </button>

            {scheduledTime ? (
              <button className="primary-btn" onClick={onCreateBroadcast} disabled={!recipients.length}>
                <Calendar size={16} />
                Schedule Campaign
              </button>
            ) : (
              <button className="primary-btn" onClick={onSendBroadcast} disabled={isSending || !recipients.length}>
                {isSending ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Campaign
                  </>
                )}
              </button>
            )}
          </div>

          {sendResults && (
            <div className="results-section">
              <h4>Campaign Results</h4>

              <div className="result-stats">
                <div className="stat">
                  <span className="label">Total Sent:</span>
                  <span className="value">{sendResults.total_sent}</span>
                </div>

                <div className="stat">
                  <span className="label">Successful:</span>
                  <span className="value success">{sendResults.successful}</span>
                </div>

                <div className="stat">
                  <span className="label">Failed:</span>
                  <span className="value failed">
                    {(sendResults.total_sent || 0) - (sendResults.successful || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <MessagePreview
          messageType={messageType}
          templateName={templateName}
          customMessage={customMessage}
          recipients={recipients}
          getTemplatePreview={() => {
            if (!templateName) return 'Select a template';
            const templateMessages = {
              hello_world: 'Hello World! This is a sample template message.',
              welcome_message: 'Welcome {{1}}! Thank you for joining our service.',
              promotion: 'Hi {{1}}, get {{2}} off on your next purchase! Use code: {{3}}',
            };
            return templateMessages[templateName] || `Template: ${templateName}`;
          }}
          getMessagePreview={() => {
            if (!customMessage) return 'Enter your custom message';
            return customMessage;
          }}
        />
      </div>
    </div>
  );
};

export default ScheduleForm;
