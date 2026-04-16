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

const META_RETRY_HISTORY_KEY = 'metaLeadBatchRetryHistory:v1';

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
  onResetForm,
  onMetaLeadBatchSync,
  metaLeadBatchLoading = false,
  metaLeadBatchResult = null
}) => {
  const scheduleInputRef = React.useRef(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [metaLeadIdsText, setMetaLeadIdsText] = React.useState('');
  const [metaSendTemplate, setMetaSendTemplate] = React.useState(false);
  const [metaDryRun, setMetaDryRun] = React.useState(true);
  const [metaRetryCount, setMetaRetryCount] = React.useState(0);
  const [metaLastRetryAt, setMetaLastRetryAt] = React.useState(null);
  const [metaLastRetryLeadCount, setMetaLastRetryLeadCount] = React.useState(0);
  const [metaRetryHistory, setMetaRetryHistory] = React.useState([]);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(META_RETRY_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const safe = parsed
        .map((item) => ({
          at: item?.at ? new Date(item.at) : null,
          leadCount: Number(item?.leadCount || 0)
        }))
        .filter((item) => item.at instanceof Date && !Number.isNaN(item.at.getTime()));
      setMetaRetryHistory(safe);
      setMetaRetryCount(safe.length);
      if (safe.length > 0) {
        const latest = safe[0];
        setMetaLastRetryAt(latest.at);
        setMetaLastRetryLeadCount(latest.leadCount);
      }
    } catch (_error) {
      // ignore invalid session cache
    }
  }, []);

  const persistRetryHistory = React.useCallback((history) => {
    try {
      window.sessionStorage.setItem(META_RETRY_HISTORY_KEY, JSON.stringify(history));
    } catch (_error) {
      // ignore storage errors
    }
  }, []);

  const extractTemplateBody = (template) => {
    if (!template || typeof template !== 'object') return '';

    if (typeof template.templateContent === 'string' && template.templateContent.trim()) {
      return template.templateContent.trim();
    }

    if (typeof template.content === 'string' && template.content.trim()) {
      return template.content.trim();
    }

    if (template.content && typeof template.content === 'object') {
      if (typeof template.content.body === 'string' && template.content.body.trim()) {
        return template.content.body.trim();
      }
      if (typeof template.content.text === 'string' && template.content.text.trim()) {
        return template.content.text.trim();
      }
    }

    if (Array.isArray(template.components)) {
      const bodyComponent = template.components.find((comp) => String(comp?.type || '').toUpperCase() === 'BODY');
      if (typeof bodyComponent?.text === 'string' && bodyComponent.text.trim()) {
        return bodyComponent.text.trim();
      }
    }

    return '';
  };

  const getTemplateVariableCount = React.useCallback((template) => {
    const bodyText = extractTemplateBody(template);
    if (!bodyText) return 0;

    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const numbers = matches
      .map((token) => Number(token.replace(/[{}]/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0);

    return numbers.length > 0 ? Math.max(...numbers) : 0;
  }, []);

  const buildSampleCsvRows = React.useCallback(() => {
    const selectedTemplate = (officialTemplates || []).find((t) => t.name === templateName);
    const variableCount = messageType === 'template' ? getTemplateVariableCount(selectedTemplate) : 0;

    const headers = ['phone'];
    for (let i = 1; i <= variableCount; i += 1) {
      headers.push(`var${i}`);
    }

    const firstDataRow = [''];
    for (let i = 1; i <= variableCount; i += 1) {
      firstDataRow.push('');
    }

    const secondDataRow = [''];
    for (let i = 1; i <= variableCount; i += 1) {
      secondDataRow.push('');
    }

    return [
      headers.join(','),
      firstDataRow.join(','),
      secondDataRow.join(',')
    ];
  }, [officialTemplates, templateName, messageType, getTemplateVariableCount]);

  const downloadSampleCsv = () => {
    const csvRows = buildSampleCsvRows();
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

  const handleCsvDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleCsvDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleCsvDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);

    const droppedFile = event.dataTransfer?.files?.[0];
    if (!droppedFile) return;

    if (!String(droppedFile.name || '').toLowerCase().endsWith('.csv')) {
      alert('Please drop a valid CSV file');
      return;
    }

    onFileUpload({ target: { files: [droppedFile] } });
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

  const requiredColumnsLabel = React.useMemo(() => {
    const selectedTemplate = (officialTemplates || []).find((t) => t.name === templateName);
    const variableCount = messageType === 'template' ? getTemplateVariableCount(selectedTemplate) : 0;
    const columns = ['phone'];
    for (let i = 1; i <= variableCount; i += 1) {
      columns.push(`var${i}`);
    }
    return columns.join(', ');
  }, [officialTemplates, templateName, messageType, getTemplateVariableCount]);

  const getSelectedTemplatePreview = () => {
    if (!templateName) return 'Select a template';
    const selectedTemplate = (officialTemplates || []).find((t) => t.name === templateName);
    if (!selectedTemplate) return `Template: ${templateName}`;

    let text = extractTemplateBody(selectedTemplate) || `Template: ${templateName}`;

    const firstRecipient = recipients?.[0];
    const replacementVars = firstRecipient?.variables || firstRecipient?.data?.variables || [];
    if (Array.isArray(replacementVars) && replacementVars.length > 0) {
      text = text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const index = Number(n) - 1;
        return replacementVars[index] ?? `{{${n}}}`;
      });
    }

    return text;
  };

  const handleMetaBatchSubmit = () => {
    if (typeof onMetaLeadBatchSync !== 'function') return;
    onMetaLeadBatchSync({
      leadIdsText: metaLeadIdsText,
      enableTemplateSend: Boolean(metaSendTemplate),
      dryRun: Boolean(metaDryRun)
    });
  };

  const downloadMetaBatchFailureCsv = () => {
    const syncResults = Array.isArray(metaLeadBatchResult?.syncResults)
      ? metaLeadBatchResult.syncResults
      : [];
    const sendResults = Array.isArray(metaLeadBatchResult?.sendResults)
      ? metaLeadBatchResult.sendResults
      : [];

    const syncFailures = syncResults
      .filter((item) => !item?.success)
      .map((item) => ({
        type: 'sync',
        leadId: String(item?.leadId || ''),
        phone: String(item?.phone || ''),
        error: String(item?.error || ''),
      }));

    const sendFailures = sendResults
      .filter((item) => !item?.success)
      .map((item) => ({
        type: 'send',
        leadId: String(item?.leadId || ''),
        phone: String(item?.phone || ''),
        error: String(item?.error || ''),
      }));

    const failures = [...syncFailures, ...sendFailures];
    if (!failures.length) {
      alert('No failed rows available for export.');
      return;
    }

    const escapeCsvCell = (value) => {
      const normalized = String(value ?? '');
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const rows = [
      'type,leadId,phone,error',
      ...failures.map((row) =>
        [
          escapeCsvCell(row.type),
          escapeCsvCell(row.leadId),
          escapeCsvCell(row.phone),
          escapeCsvCell(row.error)
        ].join(',')
      )
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meta_lead_batch_failures_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadMetaBatchFullCsv = () => {
    const syncResults = Array.isArray(metaLeadBatchResult?.syncResults)
      ? metaLeadBatchResult.syncResults
      : [];
    const sendResults = Array.isArray(metaLeadBatchResult?.sendResults)
      ? metaLeadBatchResult.sendResults
      : [];

    const syncRows = syncResults.map((item) => ({
      stage: 'sync',
      status: item?.success ? 'success' : 'failed',
      leadId: String(item?.leadId || ''),
      phone: String(item?.phone || ''),
      contactId: String(item?.contactId || ''),
      error: String(item?.error || '')
    }));

    const sendRows = sendResults.map((item) => ({
      stage: 'send',
      status: item?.success ? 'success' : 'failed',
      leadId: String(item?.leadId || ''),
      phone: String(item?.phone || ''),
      contactId: '',
      error: String(item?.error || '')
    }));

    const rowsData = [...syncRows, ...sendRows];
    if (!rowsData.length) {
      alert('No batch rows available for export.');
      return;
    }

    const escapeCsvCell = (value) => {
      const normalized = String(value ?? '');
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const rows = [
      'stage,status,leadId,phone,contactId,error',
      ...rowsData.map((row) =>
        [
          escapeCsvCell(row.stage),
          escapeCsvCell(row.status),
          escapeCsvCell(row.leadId),
          escapeCsvCell(row.phone),
          escapeCsvCell(row.contactId),
          escapeCsvCell(row.error)
        ].join(',')
      )
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meta_lead_batch_full_report_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const retryFailedMetaSends = () => {
    if (typeof onMetaLeadBatchSync !== 'function') return;

    const failedLeadIds = Array.from(
      new Set(
        (Array.isArray(metaLeadBatchResult?.sendResults) ? metaLeadBatchResult.sendResults : [])
          .filter((item) => item && item.success === false)
          .map((item) => String(item?.leadId || '').trim())
          .filter(Boolean)
      )
    );

    if (!failedLeadIds.length) {
      alert('No failed send rows with lead IDs found for retry.');
      return;
    }

    setMetaRetryCount((prev) => prev + 1);
    const retryAt = new Date();
    setMetaLastRetryAt(retryAt);
    setMetaLastRetryLeadCount(failedLeadIds.length);
    setMetaRetryHistory((prev) => {
      const next = [{ at: retryAt.toISOString(), leadCount: failedLeadIds.length }, ...prev].slice(0, 5);
      persistRetryHistory(next);
      return next.map((item) => ({ at: new Date(item.at), leadCount: item.leadCount }));
    });

    onMetaLeadBatchSync({
      leadIdsText: failedLeadIds.join('\n'),
      enableTemplateSend: true,
      dryRun: false
    });
  };

  const clearMetaRetryHistory = () => {
    setMetaRetryCount(0);
    setMetaLastRetryAt(null);
    setMetaLastRetryLeadCount(0);
    setMetaRetryHistory([]);
    try {
      window.sessionStorage.removeItem(META_RETRY_HISTORY_KEY);
    } catch (_error) {
      // ignore storage errors
    }
  };

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

          <div className="form-group meta-lead-sync-block">
            <label>
              <Users size={16} /> Meta Lead Batch Sync (Optional)
            </label>
            <textarea
              rows={3}
              value={metaLeadIdsText}
              onChange={(e) => setMetaLeadIdsText(e.target.value)}
              placeholder="Paste Meta lead IDs (comma/newline separated)"
            />
            <div className="meta-lead-sync-row">
              <label className="meta-lead-sync-check">
                <input
                  type="checkbox"
                  checked={metaSendTemplate}
                  onChange={(e) => setMetaSendTemplate(e.target.checked)}
                />
                Sync and send selected template
              </label>
              <label className="meta-lead-sync-check">
                <input
                  type="checkbox"
                  checked={metaDryRun}
                  onChange={(e) => setMetaDryRun(e.target.checked)}
                />
                Dry run (no send)
              </label>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleMetaBatchSubmit}
                disabled={metaLeadBatchLoading}
              >
                {metaLeadBatchLoading ? 'Syncing...' : 'Run Lead Sync'}
              </button>
            </div>
            {metaLeadBatchResult ? (
              <small className="meta-lead-sync-summary">
                {`Leads: ${metaLeadBatchResult?.summary?.totalLeadIds || 0} | Synced: ${metaLeadBatchResult?.summary?.syncedSuccess || 0} | Sync failed: ${metaLeadBatchResult?.summary?.syncedFailed || 0} | Send success: ${metaLeadBatchResult?.summary?.templateSendSuccess || 0} | Send failed: ${metaLeadBatchResult?.summary?.templateSendFailed || 0}`}
              </small>
            ) : null}
            {metaLeadBatchResult ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={downloadMetaBatchFullCsv}
              >
                Download Full Batch Report CSV
              </button>
            ) : null}
            {metaLeadBatchResult &&
            (Number(metaLeadBatchResult?.summary?.syncedFailed || 0) > 0 ||
              Number(metaLeadBatchResult?.summary?.templateSendFailed || 0) > 0) ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={downloadMetaBatchFailureCsv}
              >
                Download Failed Rows CSV
              </button>
            ) : null}
            {Number(metaLeadBatchResult?.summary?.templateSendFailed || 0) > 0 ? (
              <button
                type="button"
                className="primary-btn meta-lead-retry-btn"
                onClick={retryFailedMetaSends}
                disabled={metaLeadBatchLoading}
              >
                {metaLeadBatchLoading ? 'Retrying...' : 'Retry Failed Sends Only'}
              </button>
            ) : null}
            {metaRetryCount > 0 ? (
              <small className="meta-lead-retry-meta">
                {`Retries: ${metaRetryCount} | Last retry leads: ${metaLastRetryLeadCount} | Last retry at: ${
                  metaLastRetryAt ? metaLastRetryAt.toLocaleString() : '-'
                }`}
              </small>
            ) : null}
            {metaRetryHistory.length > 0 ? (
              <div className="meta-lead-retry-history">
                {metaRetryHistory.map((item, index) => (
                  <span key={`${item.at?.toISOString?.() || 'retry'}-${index}`} className="meta-lead-retry-chip">
                    {`${item.at ? item.at.toLocaleString() : '-'} | ${item.leadCount} leads`}
                  </span>
                ))}
              </div>
            ) : null}
            {metaRetryHistory.length > 0 ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={clearMetaRetryHistory}
              >
                Clear Retry History
              </button>
            ) : null}
          </div>

          <div className="form-group">
            <label>
              <Upload size={16} /> Upload Recipients CSV
            </label>

            <div className="voice-style-upload-wrapper">
              <input
                type="file"
                accept=".csv"
                onChange={onFileUpload}
                onClick={(e) => { e.target.value = ''; }}
                id="broadcast-csv-upload"
                className="csv-input"
              />

              {recipients.length === 0 ? (
                <>
                  <div
                    className={`voice-upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
                    onClick={triggerCsvPicker}
                    onDragOver={handleCsvDragOver}
                    onDragLeave={handleCsvDragLeave}
                    onDrop={handleCsvDrop}
                  >
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
                <strong>Supported format:</strong> CSV columns: {requiredColumnsLabel}.
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
              <button className="primary-btn" onClick={onCreateBroadcast} disabled={isSending || !recipients.length}>
                <Calendar size={16} />
                {isSending ? 'Scheduling...' : `Schedule Broadcast (${recipients.length} contacts)`}
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
            getTemplatePreview={getSelectedTemplatePreview}
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

