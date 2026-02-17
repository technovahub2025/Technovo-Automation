import React from 'react';
import {
  CheckCircle,
  FileText,
  Upload,
  Calendar,
  Send,
  Clock,
  Users,
  Download,
  Settings
} from 'lucide-react';
import MessagePreview from './MessagePreview';
import './ScheduleForm.css';

const ScheduleForm = ({
  messageType,
  broadcastName,
  onBroadcastNameChange,
  templateName,
  onTemplateNameChange,
  templateFilter,
  onTemplateFilterChange,
  officialTemplates,
  filteredTemplates,
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
  onBackToOverview,
  onResetForm
}) => {
  const scheduleInputRef = React.useRef(null);

  const sampleCsvRows = [
    'phone,name,var1,var2,var3',
    '919876543210,Rahul,Rahul,ORD1001,10-Feb-2026',
    '919876543211,Priya,Priya,ORD1002,11-Feb-2026',
    '919876543212,Amit,Amit,ORD1003,12-Feb-2026'
  ];

  const downloadSampleCsv = () => {
    const blob = new Blob([sampleCsvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'broadcast_contacts_sample.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const triggerCsvPicker = () => {
    const input = document.getElementById('broadcast-csv-upload');
    if (input) input.click();
  };

  const openSchedulePicker = () => {
    setTimeout(() => {
      if (scheduleInputRef.current?.showPicker) {
        scheduleInputRef.current.showPicker();
      } else if (scheduleInputRef.current) {
        scheduleInputRef.current.focus();
      }
    }, 0);
  };

  const clearScheduleTime = () => {
    onScheduledTimeChange({ target: { value: '' } });
  };

  const getContactRows = () => {
    return (recipients || []).slice(0, 5).map((recipient, index) => {
      const raw = recipient?.data || recipient || {};
      const fullData = raw.fullData || raw || {};
      const phone = recipient?.phone || raw.phone || fullData.phone || fullData.mobile || fullData.number || '-';
      const name = raw.name || fullData.name || `Contact ${index + 1}`;
      const customFieldCount = Object.keys(fullData).filter((key) => !['phone', 'mobile', 'number', 'name', 'variables'].includes(String(key).toLowerCase())).length;
      return { index, phone, name, customFieldCount };
    });
  };

  const contactRows = getContactRows();

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

          {messageType === 'template' ? (
            <>
              <div className="form-group">
                <div className="template-header-row">
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

                  {templateName && (() => {
                    const selectedTemplate = officialTemplates.find((t) => t.name === templateName);
                    const variableCount = selectedTemplate
                      ? (selectedTemplate.content?.body?.match(/\{\{\d+\}\}/g) || []).length
                      : 0;
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
                      <span className="action-icon">:)</span>
                      <span className="action-icon">[+]</span>
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

            <div className="voice-style-upload-wrapper">
              <input
                type="file"
                accept=".csv"
                onChange={onFileUpload}
                id="broadcast-csv-upload"
                className="csv-input"
              />

              {recipients.length === 0 ? (
                <>
                  <div className="voice-upload-dropzone" onClick={triggerCsvPicker}>
                    <Upload size={48} />
                    <h3>Upload CSV File</h3>
                    <p>Click to select or drag and drop</p>
                    <small>CSV must include "phone" or "mobile" column</small>
                  </div>

                  <button
                    type="button"
                    className="download-sample-btn"
                    onClick={downloadSampleCsv}
                  >
                    <Download size={16} />
                    Download Sample CSV
                  </button>
                </>
              ) : (
                <div className="contacts-preview-panel">
                  <div className="contacts-preview-header">
                    <div className="contacts-preview-info">
                      <Users size={20} />
                      <span>{recipients.length} contacts uploaded</span>
                    </div>
                    <button
                      type="button"
                      className="contacts-clear-btn"
                      onClick={onClearUpload}
                      title="Clear contacts"
                    >
                      ×
                    </button>
                  </div>

                  <div className="contacts-preview-table-wrap">
                    <table className="contacts-preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Phone</th>
                          <th>Name</th>
                          <th>Custom Fields</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactRows.map((row) => (
                          <tr key={`${row.phone}-${row.index}`}>
                            <td>{row.index + 1}</td>
                            <td className="phone-cell">{row.phone}</td>
                            <td>{row.name}</td>
                            <td>
                              {row.customFieldCount > 0 ? (
                                <span className="field-badge">{row.customFieldCount} fields</span>
                              ) : (
                                <span className="muted-text">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recipients.length > 5 && (
                      <p className="contacts-more-row">... and {recipients.length - 5} more contacts</p>
                    )}
                  </div>

                  <button type="button" className="replace-csv-btn" onClick={triggerCsvPicker}>
                    <Upload size={16} />
                    Replace CSV
                  </button>
                </div>
              )}
            </div>

            <div className="upload-format-info">
              <small>
                <strong>Supported format:</strong> CSV with columns: phone/mobile, name (optional), and custom fields.
              </small>
            </div>
          </div>

          <div className="form-group advanced-settings-block">
            <details>
              <summary>
                <Settings size={16} />
                Scheduled Time
              </summary>
              <div className="advanced-settings-content">
                <div className="schedule-input-row">
                  <div className="schedule-picker-wrap">
                    <input
                      ref={scheduleInputRef}
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={onScheduledTimeChange}
                      onFocus={openSchedulePicker}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>

                  {scheduledTime ? (
                    <button
                      type="button"
                      className="schedule-clear-btn"
                      onClick={clearScheduleTime}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <small>
                  Select date/time to schedule. Use <strong>Clear</strong> for immediate send.
                </small>
              </div>
            </details>
          </div>

          {uploadedFile && fileVariables.length > 0 && (
            <div className="variable-file-info">
              Variables detected: {fileVariables.join(', ')}
            </div>
          )}

          <div className="form-actions">
            <button className="secondary-btn" onClick={onResetForm}>
              Reset
            </button>

            <button className="secondary-btn" onClick={onBackToOverview}>
              Back to Overview
            </button>

            {scheduledTime ? (
              <button className="primary-btn" onClick={onCreateBroadcast} disabled={!recipients.length}>
                <Calendar size={16} />
                Schedule Broadcast ({recipients.length} contacts)
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
                    Start Broadcast ({recipients.length} contacts)
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

        <div id="broadcast-message-preview">
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
                promotion: 'Hi {{1}}, get {{2}} off on your next purchase! Use code: {{3}}'
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
    </div>
  );
};

export default ScheduleForm;

