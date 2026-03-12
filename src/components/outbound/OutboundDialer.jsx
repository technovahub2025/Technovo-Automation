import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  ChevronDown,
  CirclePlus,
  FileText,
  PencilLine,
  PhoneCall,
  SlidersHorizontal,
  Trash,
  Upload,
  X
} from 'lucide-react';
import { useExotelOutbound } from '../../hooks/useBroadcast';
import ContactUploader from '../../pages/VoiceBroadcast/components/ContactUploader';
import './OutboundDialer.css';

const EXOTEL_NUMBER_PLACEHOLDER = '+91XXXXXXXXXX';
const TWILIO_FROM_PLACEHOLDER = '+14155550123';
const BULK_VOICE_OPTIONS = [
  { id: 'ta-IN-PallaviNeural', label: 'PallaviNeural (Female, Tamil)', language: 'ta-IN', gender: 'Female' },
  { id: 'ta-IN-ValluvarNeural', label: 'ValluvarNeural (Male, Tamil)', language: 'ta-IN', gender: 'Male' },
  { id: 'en-GB-SoniaNeural', label: 'SoniaNeural (Female, English)', language: 'en-GB', gender: 'Female' },
  { id: 'en-GB-RyanNeural', label: 'RyanNeural (Male, English)', language: 'en-GB', gender: 'Male' }
];

const normalizeLocalNumber = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if (String(value || '').trim().startsWith('+91') && /^\+91[6-9][0-9]{9}$/.test(String(value || '').trim())) {
    return String(value || '').trim();
  }
  return '';
};

const DEFAULT_CALL_SETTINGS = {
  recordCall: true,
  maxDuration: 300,
  retryAttempts: 3,
  disclaimerText: 'This is an automated call from',
  optOutEnabled: true,
  dndRespect: true,
  traiConsentConfirmed: false
};

const OutboundDialer = ({
  showBulkUpload = false,
  callSettings = DEFAULT_CALL_SETTINGS,
  onCallSettingsChange = () => {},
  onMonitorUpdate = () => {}
}) => {
  const [mode, setMode] = useState('single');
  const [provider, setProvider] = useState('exotel');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [singleVoiceId, setSingleVoiceId] = useState(BULK_VOICE_OPTIONS[0].id);
  const [singleWorkflowId, setSingleWorkflowId] = useState('');
  const [singleScheduleType, setSingleScheduleType] = useState('immediate');
  const [singleScheduledAt, setSingleScheduledAt] = useState('');
  const [isTemplateComposerOpen, setIsTemplateComposerOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateScript, setTemplateScript] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkVoiceId, setBulkVoiceId] = useState(BULK_VOICE_OPTIONS[0].id);
  const [bulkWorkflowId, setBulkWorkflowId] = useState('');
  const [bulkScheduleType, setBulkScheduleType] = useState('immediate');
  const [bulkScheduledAt, setBulkScheduledAt] = useState('');
  const [bulkRecurrence, setBulkRecurrence] = useState('none');
  const [bulkAllowedWindowStart, setBulkAllowedWindowStart] = useState('09:00');
  const [bulkAllowedWindowEnd, setBulkAllowedWindowEnd] = useState('21:00');
  const [bulkContacts, setBulkContacts] = useState([]);
  const [csvData, setCsvData] = useState('');
  const [bulkUploaderKey, setBulkUploaderKey] = useState(0);
  const [localResult, setLocalResult] = useState(null);
  const [localError, setLocalError] = useState('');
  const [templateDeleting, setTemplateDeleting] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState('');

  const {
    quickCallLoading,
    bulkLoading,
    overview,
    templates,
    workflows,
    templateSaving,
    error,
    quickCall,
    launchBulkCampaign,
    fetchOverview,
    fetchTemplates,
    fetchWorkflows,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = useExotelOutbound();

  useEffect(() => {
    fetchOverview().catch(() => {});
    fetchTemplates().catch(() => {});
    fetchWorkflows().catch(() => {});
  }, [fetchOverview, fetchTemplates, fetchWorkflows]);

  const normalizedSingleTo = useMemo(() => normalizeLocalNumber(phoneNumber), [phoneNumber]);
  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template?._id) === String(selectedTemplateId)) || null,
    [templates, selectedTemplateId]
  );
  const selectedSingleVoice = useMemo(
    () => BULK_VOICE_OPTIONS.find((voice) => voice.id === singleVoiceId) || BULK_VOICE_OPTIONS[0],
    [singleVoiceId]
  );
  const selectedSingleWorkflow = useMemo(
    () => workflows.find((workflow) => String(workflow?._id) === String(singleWorkflowId)) || null,
    [workflows, singleWorkflowId]
  );
  const selectedBulkVoice = useMemo(
    () => BULK_VOICE_OPTIONS.find((voice) => voice.id === bulkVoiceId) || BULK_VOICE_OPTIONS[0],
    [bulkVoiceId]
  );
  const selectedBulkTemplate = useMemo(
    () => templates.find((template) => String(template?._id) === String(bulkTemplateId)) || null,
    [templates, bulkTemplateId]
  );
  const selectedBulkWorkflow = useMemo(
    () => workflows.find((workflow) => String(workflow?._id) === String(bulkWorkflowId)) || null,
    [workflows, bulkWorkflowId]
  );
  const resolvedBulkMessage = selectedBulkTemplate?.script || bulkMessage;
  const isEditingTemplate = Boolean(editingTemplateId);

  useEffect(() => {
    if (selectedTemplateId) {
      setCustomMessage('');
    }
  }, [selectedTemplateId]);

  const handleBulkContactsUploaded = (contacts) => {
    setBulkContacts(Array.isArray(contacts) ? contacts : []);
    setLocalError('');
    setLocalResult(null);
  };

  const handleBulkUploadProcessed = ({ rawText }) => {
    setCsvData(rawText || '');
  };

  const handleResetSingleForm = () => {
    setProvider('exotel');
    setPhoneNumber('');
    setFromNumber('');
    setSelectedTemplateId('');
    setCustomMessage('');
    setSingleVoiceId(BULK_VOICE_OPTIONS[0].id);
    setSingleWorkflowId('');
    setSingleScheduleType('immediate');
    setSingleScheduledAt('');
    setLocalError('');
    setLocalResult(null);
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateScript('');
    setIsTemplateComposerOpen(false);
    onCallSettingsChange({ ...DEFAULT_CALL_SETTINGS });
  };

  const handleResetBulkForm = () => {
    setProvider('exotel');
    setFromNumber('');
    setCampaignName('');
    setBulkTemplateId('');
    setBulkMessage('');
    setBulkVoiceId(BULK_VOICE_OPTIONS[0].id);
    setBulkWorkflowId('');
    setBulkScheduleType('immediate');
    setBulkScheduledAt('');
    setBulkRecurrence('none');
    setBulkAllowedWindowStart('09:00');
    setBulkAllowedWindowEnd('21:00');
    setBulkContacts([]);
    setCsvData('');
    setLocalError('');
    setLocalResult(null);
    setBulkUploaderKey((prev) => prev + 1);
    onCallSettingsChange({ ...DEFAULT_CALL_SETTINGS });
  };

  const handleQuickCall = async () => {
    if (!normalizedSingleTo) {
      setLocalError('Enter a valid phone number.');
      return;
    }

    if (!selectedTemplateId && !customMessage.trim()) {
      setLocalError('Select a template or enter a custom message.');
      return;
    }
    if (singleScheduleType === 'once' && !singleScheduledAt) {
      setLocalError('Select the date and time for the scheduled call.');
      return;
    }
    if (!callSettings?.traiConsentConfirmed) {
      setLocalError('Confirm recipient consent to comply with TRAI calling rules.');
      return;
    }

    try {
      setLocalError('');
      const response = await quickCall({
        provider,
        to: normalizedSingleTo,
        from: fromNumber,
        templateId: selectedTemplateId,
        customMessage: customMessage.trim(),
        voiceId: selectedSingleVoice.id,
        voice: selectedSingleVoice.id,
        workflowId: singleWorkflowId,
        scheduleType: singleScheduleType,
        scheduledAt: singleScheduledAt || null,
        recurrence: 'none',
        timezone: 'Asia/Kolkata',
        allowedWindowStart: '09:00',
        allowedWindowEnd: '21:00',
        recordCall: Boolean(callSettings?.recordCall),
        maxDuration: Number(callSettings?.maxDuration || 300),
        retryAttempts: Number(callSettings?.retryAttempts || 3),
        disclaimerText: String(callSettings?.disclaimerText || 'This is an automated call from').trim(),
        optOutEnabled: Boolean(callSettings?.optOutEnabled),
        dndRespect: Boolean(callSettings?.dndRespect),
        compliance: {
          disclaimerText: String(callSettings?.disclaimerText || 'This is an automated call from').trim(),
          optOutEnabled: Boolean(callSettings?.optOutEnabled),
          dndRespect: Boolean(callSettings?.dndRespect)
        },
        traiConsentConfirmed: Boolean(callSettings?.traiConsentConfirmed)
      });
      setLocalResult(response);
      onMonitorUpdate({
        type: 'single',
        title: 'Single Call',
        status: response?.status || response?.data?.status || (singleScheduleType === 'once' ? 'scheduled' : 'initiated'),
        callSid: response?.callSid || response?.data?.callSid || response?.data?.call_sid || '',
        provider,
        from: fromNumber,
        to: normalizedSingleTo,
        templateId: selectedTemplateId || '',
        workflowId: singleWorkflowId,
        voiceId: selectedSingleVoice.id,
        scheduleType: singleScheduleType,
        scheduledAt: singleScheduledAt || null,
        customMessage: customMessage.trim() || selectedTemplate?.script || '',
        updatedAt: new Date().toISOString(),
        rawResponse: response
      });
    } catch (requestError) {
      setLocalError(requestError?.response?.data?.message || requestError?.message || 'Quick call failed.');
    }
  };

  const handleBulkCampaign = async () => {
    if (!campaignName.trim()) {
      setLocalError('Campaign name is required.');
      return;
    }
    if (!bulkContacts.length) {
      setLocalError('Upload a CSV file with valid numbers.');
      return;
    }
    if (!resolvedBulkMessage.trim()) {
      setLocalError('Enter the audio message for this campaign.');
      return;
    }
    if (bulkScheduleType === 'once' && !bulkScheduledAt) {
      setLocalError('Select the date and time for the scheduled campaign.');
      return;
    }
    if (!callSettings?.traiConsentConfirmed) {
      setLocalError('Confirm recipient consent to comply with TRAI calling rules.');
      return;
    }

    try {
      setLocalError('');
      const response = await launchBulkCampaign({
        provider,
        campaignName: campaignName.trim(),
        numbers: bulkContacts.map((contact) => contact.phone).filter(Boolean),
        from: fromNumber,
        csvData,
        maxConcurrent: 5,
        customMessage: resolvedBulkMessage.trim(),
        voiceId: selectedBulkVoice.id,
        voice: selectedBulkVoice.id,
        templateId: bulkTemplateId,
        workflowId: bulkWorkflowId,
        scheduleType: bulkScheduleType,
        scheduledAt: bulkScheduledAt || null,
        recurrence: bulkRecurrence,
        timezone: 'Asia/Kolkata',
        allowedWindowStart: bulkAllowedWindowStart,
        allowedWindowEnd: bulkAllowedWindowEnd,
        recordCall: Boolean(callSettings?.recordCall),
        maxDuration: Number(callSettings?.maxDuration || 300),
        retryAttempts: Number(callSettings?.retryAttempts || 3),
        disclaimerText: String(callSettings?.disclaimerText || 'This is an automated call from').trim(),
        optOutEnabled: Boolean(callSettings?.optOutEnabled),
        dndRespect: Boolean(callSettings?.dndRespect),
        compliance: {
          disclaimerText: String(callSettings?.disclaimerText || 'This is an automated call from').trim(),
          optOutEnabled: Boolean(callSettings?.optOutEnabled),
          dndRespect: Boolean(callSettings?.dndRespect)
        },
        traiConsentConfirmed: Boolean(callSettings?.traiConsentConfirmed)
      });
      setLocalResult(response);
      onMonitorUpdate({
        type: 'bulk',
        title: 'Bulk Campaign',
        status:
          response?.status ||
          response?.data?.status ||
          (bulkScheduleType === 'immediate' ? 'initiated' : bulkScheduleType === 'once' ? 'scheduled' : 'recurring'),
        campaignId: response?.campaignId || response?.data?.campaignId || response?.data?.id || '',
        campaignName: campaignName.trim(),
        provider,
        from: fromNumber,
        contactCount: bulkContacts.length,
        workflowId: bulkWorkflowId,
        voiceId: selectedBulkVoice.id,
        scheduleType: bulkScheduleType,
        scheduledAt: bulkScheduledAt || null,
        recurrence: bulkRecurrence,
        allowedWindowStart: bulkAllowedWindowStart,
        allowedWindowEnd: bulkAllowedWindowEnd,
        templateId: bulkTemplateId || '',
        customMessage: resolvedBulkMessage.trim(),
        updatedAt: new Date().toISOString(),
        rawResponse: response
      });
    } catch (requestError) {
      setLocalError(requestError?.response?.data?.message || requestError?.message || 'Bulk campaign failed.');
    }
  };

  const handleOpenTemplateComposer = () => {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateScript('');
    setIsTemplateComposerOpen(true);
    setLocalError('');
  };

  const handleCloseTemplateComposer = () => {
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateScript('');
    setIsTemplateComposerOpen(false);
  };

  const handleEditTemplate = () => {
    if (!selectedTemplate) {
      return;
    }

    setEditingTemplateId(String(selectedTemplate._id));
    setTemplateName(selectedTemplate.name || '');
    setTemplateScript(selectedTemplate.script || '');
    setIsTemplateComposerOpen(true);
    setLocalError('');
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    const script = templateScript.trim();

    if (name.length < 2 || name.length > 80) {
      setLocalError('Template name must be between 2 and 80 characters.');
      return;
    }

    if (!script) {
      setLocalError('Template script is required.');
      return;
    }

    try {
      setLocalError('');
      const saved = isEditingTemplate
        ? await updateTemplate(editingTemplateId, { name, script })
        : await createTemplate({ name, script });
      if (saved?._id) {
        setSelectedTemplateId(saved._id);
      }
      handleCloseTemplateComposer();
    } catch (requestError) {
      setLocalError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        `Template ${isEditingTemplate ? 'update' : 'creation'} failed.`
      );
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate?._id || templateDeleting) {
      return;
    }

    const shouldDelete = window.confirm(`Delete template "${selectedTemplate.name}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setTemplateDeleting(true);
      setLocalError('');
      await deleteTemplate(selectedTemplate._id);
      setSelectedTemplateId('');
      handleCloseTemplateComposer();
    } catch (requestError) {
      setLocalError(requestError?.response?.data?.message || requestError?.message || 'Template deletion failed.');
    } finally {
      setTemplateDeleting(false);
    }
  };

  return (
    <div className="outbound-dialer-wrap">
      <div className="outbound-card">
        <div className="outbound-section-head">
          <h3>Quick Calls</h3>
          <p>Run a single call or switch to bulk campaign mode without leaving this workspace.</p>
        </div>

        <div className="composer-mode-switch">
          <button
            type="button"
            className={`composer-mode-btn ${mode === 'single' ? 'active' : ''}`}
            onClick={() => setMode('single')}
          >
            Single Call
          </button>
          <button
            type="button"
            className={`composer-mode-btn ${mode === 'bulk' ? 'active' : ''}`}
            onClick={() => setMode('bulk')}
          >
            Bulk Campaign
          </button>
        </div>

        <div className={`quick-call-banner ${mode === 'bulk' ? 'bulk' : ''}`}>
          <strong>{mode === 'bulk' ? 'Campaign launch' : 'Instant outbound call'}</strong>
          <p>
            {mode === 'bulk'
              ? 'Upload one CSV, validate recipients instantly, and trigger the full batch from here.'
              : 'Call one number now using a saved script or a one-off message.'}
          </p>
        </div>
      </div>

      <div className="outbound-card">
        {mode === 'single' ? (
          <div className="outbound-grid outbound-grid-3">
            <div>
              <label>Telephony Selector</label>
              <select
                className="outbound-input"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                <option value="exotel">Exotel</option>
                <option value="twilio">Twilio</option>
              </select>
            </div>
            <div>
              <label>From Number</label>
              <input
                className="outbound-input"
                type="tel"
                placeholder={provider === 'twilio' ? TWILIO_FROM_PLACEHOLDER : EXOTEL_NUMBER_PLACEHOLDER}
                value={fromNumber}
                onChange={(event) => setFromNumber(event.target.value)}
              />
            </div>
            <div>
              <label>To Number</label>
              <input
                className="outbound-input"
                type="tel"
                placeholder={EXOTEL_NUMBER_PLACEHOLDER}
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="outbound-grid outbound-grid-2">
              <div>
                <label>Telephony Provider</label>
                <select
                  className="outbound-input"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="exotel">Exotel</option>
                  <option value="twilio">Twilio</option>
                </select>
              </div>
              <div>
                <label>From Number</label>
                <input
                  className="outbound-input"
                  type="tel"
                  placeholder={provider === 'twilio' ? TWILIO_FROM_PLACEHOLDER : EXOTEL_NUMBER_PLACEHOLDER}
                  value={fromNumber}
                  onChange={(event) => setFromNumber(event.target.value)}
                />
              </div>
            </div>

            <div className="outbound-grid outbound-grid-1">
              <div>
                <label>Campaign Name</label>
                <input
                  className="outbound-input"
                  type="text"
                  placeholder="Bulk Campaign"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {mode === 'single' ? (
          <>
            <div className="outbound-grid outbound-grid-2 single-voice-grid">
              <div>
                <label>Voice Selection</label>
                <select
                  className="outbound-input"
                  value={singleVoiceId}
                  onChange={(event) => setSingleVoiceId(event.target.value)}
                >
                  {BULK_VOICE_OPTIONS.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))}
                </select>
                <p className="outbound-muted bulk-voice-meta">
                  {selectedSingleVoice.gender} voice, {selectedSingleVoice.language}
                </p>
              </div>
              <div>
                <label>Reuse Existing IVR (optional)</label>
                <select
                  className="outbound-input"
                  value={singleWorkflowId}
                  onChange={(event) => setSingleWorkflowId(event.target.value)}
                >
                  <option value="">Select IVR workflow</option>
                  {workflows.map((workflow) => (
                    <option key={workflow._id} value={workflow._id}>
                      {workflow.displayName || workflow.promptKey}
                    </option>
                  ))}
                </select>
                <p className="outbound-muted bulk-voice-meta">
                  {selectedSingleWorkflow
                    ? `${selectedSingleWorkflow.menuOptions?.length || 0} menu options ready for this call`
                    : 'The answered call will enter the selected inbound IVR flow.'}
                </p>
              </div>
            </div>

            <div className="outbound-grid outbound-grid-2 single-voice-grid">
              <div>
                <label>Call Start</label>
                <select
                  className="outbound-input"
                  value={singleScheduleType}
                  onChange={(event) => setSingleScheduleType(event.target.value)}
                >
                  <option value="immediate">Start Immediately</option>
                  <option value="once">Schedule Once</option>
                </select>
              </div>
              {singleScheduleType === 'once' ? (
                <div>
                  <label>Scheduled Date & Time</label>
                  <input
                    className="outbound-input"
                    type="datetime-local"
                    value={singleScheduledAt}
                    onChange={(event) => setSingleScheduledAt(event.target.value)}
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div className="template-row">
              <div className="template-selector-block">
                <label>Saved Template</label>
                <select
                  className="outbound-input"
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="template-actions template-actions-inline">
                {selectedTemplate?._id && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={handleEditTemplate}
                    title="Edit Template"
                    aria-label="Edit Template"
                  >
                    <PencilLine size={16} strokeWidth={2} />
                  </button>
                )}
                {selectedTemplate?._id && (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={handleDeleteTemplate}
                    disabled={templateDeleting}
                    title="Delete Template"
                    aria-label="Delete Template"
                  >
                    <Trash size={16} strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  className={`secondary-btn template-toggle-btn ${isTemplateComposerOpen && !isEditingTemplate ? 'open' : ''}`}
                  onClick={isTemplateComposerOpen ? handleCloseTemplateComposer : handleOpenTemplateComposer}
                  title={isTemplateComposerOpen && !isEditingTemplate ? 'Close' : 'Add Template'}
                  aria-label={isTemplateComposerOpen && !isEditingTemplate ? 'Close' : 'Add Template'}
                >
                  {isTemplateComposerOpen && !isEditingTemplate ? <X size={16} strokeWidth={2} /> : <CirclePlus size={16} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {selectedTemplate && (
              <div className="template-preview-card">
                <div className="template-preview-head">
                  <div>
                    <p className="template-preview-label">Template Preview</p>
                    <h4>{selectedTemplate.name}</h4>
                  </div>
                  <span className="template-preview-meta">
                    Updated {new Date(selectedTemplate.updatedAt || selectedTemplate.createdAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <div className="template-preview-body">
                  {selectedTemplate.script}
                </div>
              </div>
            )}

            {isTemplateComposerOpen && (
              <div className="template-expand-panel">
                <p className="template-expand-subtitle">
                  {isEditingTemplate
                    ? 'Update the selected outbound voice template.'
                    : 'Create a reusable outbound voice script for this selector.'}
                </p>
                <div className="outbound-grid outbound-grid-2 compact-grid">
                  <div>
                    <label>Template Name</label>
                    <input
                      className="outbound-input"
                      type="text"
                      maxLength={80}
                      placeholder="Payment reminder"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                    />
                  </div>
                  <div className="template-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleCloseTemplateComposer}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleSaveTemplate}
                      disabled={templateSaving}
                    >
                      {templateSaving ? 'Saving...' : isEditingTemplate ? 'Update Template' : 'Save Template'}
                    </button>
                  </div>
                </div>

                <label>Template Script</label>
                <textarea
                  className="outbound-textarea"
                  value={templateScript}
                  onChange={(event) => setTemplateScript(event.target.value)}
                  maxLength={1000}
                  placeholder="Hello, this is a reminder about your scheduled payment."
                />
                <p className="outbound-muted">{templateScript.trim().length}/1000 characters</p>
              </div>
            )}

            {!selectedTemplateId && (
              <>
                <label>Custom Message</label>
                <textarea
                  className="outbound-textarea"
                  value={customMessage}
                  onChange={(event) => setCustomMessage(event.target.value)}
                  placeholder="Enter a message for this call"
                />
              </>
            )}

            <details className="additional-settings-panel">
              <summary className="additional-settings-summary">
                <span className="additional-settings-summary-text">
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Additional Settings
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>

              <div className="additional-settings-content">
                <p className="additional-settings-copy">
                  Only call opt-in users. DND numbers should remain blocked. Recipients can press 9 to opt out.
                </p>

                <div className="outbound-grid outbound-grid-3 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.recordCall)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          recordCall: event.target.checked
                        })}
                      />
                      <span>Record Calls</span>
                    </label>
                  </div>
                  <div className="setting-item-card">
                    <label>Max Duration (seconds)</label>
                    <input
                      className="outbound-input"
                      type="number"
                      min="30"
                      max="1800"
                      value={Number(callSettings?.maxDuration || 300)}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        maxDuration: Number.parseInt(event.target.value, 10) || 300
                      })}
                    />
                  </div>
                  <div className="setting-item-card">
                    <label>Retry Attempts</label>
                    <input
                      className="outbound-input"
                      type="number"
                      min="0"
                      max="5"
                      value={Number(callSettings?.retryAttempts || 3)}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        retryAttempts: Number.parseInt(event.target.value, 10) || 0
                      })}
                    />
                  </div>
                </div>

                <div className="outbound-grid outbound-grid-1 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label>Compliance Disclaimer</label>
                    <input
                      className="outbound-input"
                      type="text"
                      maxLength="120"
                      value={String(callSettings?.disclaimerText || 'This is an automated call from')}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        disclaimerText: event.target.value
                      })}
                    />
                    <p className="outbound-muted">Played before the main outbound message, matching voice broadcast settings.</p>
                  </div>
                </div>

                <div className="outbound-grid outbound-grid-2 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.dndRespect)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          dndRespect: event.target.checked
                        })}
                      />
                      <span>Keep DND filtering enabled</span>
                    </label>
                  </div>
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.optOutEnabled)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          optOutEnabled: event.target.checked
                        })}
                      />
                      <span>Enable Opt-Out (Press 9)</span>
                    </label>
                    <p className="outbound-muted">Use this for calls where recipients must be able to opt out.</p>
                  </div>
                  <div className="additional-settings-consent">
                    <div className="setting-item-card consent-card">
                      <label className="setting-checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(callSettings?.traiConsentConfirmed)}
                          onChange={(event) => onCallSettingsChange({
                            ...callSettings,
                            traiConsentConfirmed: event.target.checked
                          })}
                        />
                        <span>I confirm the recipient has consented and this call follows TRAI rules.</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <div className="outbound-actions-row">
              <button type="button" className="primary-btn" onClick={handleQuickCall} disabled={quickCallLoading}>
                <PhoneCall size={16} />
                {quickCallLoading ? 'Calling...' : singleScheduleType === 'once' ? 'Schedule Call' : 'Place Call'}
              </button>
              <button
                type="button"
                className="secondary-btn reset-btn"
                onClick={handleResetSingleForm}
                disabled={quickCallLoading}
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bulk-form-stack">
              <div className="outbound-grid outbound-grid-2">
                <div>
                  <label>Saved Template</label>
                  <select
                    className="outbound-input"
                    value={bulkTemplateId}
                    onChange={(event) => setBulkTemplateId(event.target.value)}
                  >
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template._id} value={template._id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Voice Selection</label>
                  <select
                    className="outbound-input"
                    value={bulkVoiceId}
                    onChange={(event) => setBulkVoiceId(event.target.value)}
                  >
                    {BULK_VOICE_OPTIONS.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.label}
                      </option>
                    ))}
                  </select>
                  <p className="outbound-muted bulk-voice-meta">
                    {selectedBulkVoice.gender} voice, {selectedBulkVoice.language}
                  </p>
                </div>
              </div>

              <div className="outbound-grid outbound-grid-2">
                <div>
                  <label>{selectedBulkTemplate ? 'Template Message' : 'Audio Message'}</label>
                  {selectedBulkTemplate ? (
                    <div className="template-preview-card bulk-template-preview">
                      <div className="template-preview-body">
                        {selectedBulkTemplate.script}
                      </div>
                    </div>
                  ) : (
                    <textarea
                      className="outbound-textarea bulk-message-textarea"
                      value={bulkMessage}
                      onChange={(event) => setBulkMessage(event.target.value)}
                      placeholder="Enter the message to be spoken during the call"
                    />
                  )}
                </div>
                <div>
                <label>Reuse Existing IVR (optional)</label>
                  <select
                    className="outbound-input"
                    value={bulkWorkflowId}
                    onChange={(event) => setBulkWorkflowId(event.target.value)}
                  >
                    <option value="">Select IVR workflow</option>
                    {workflows.map((workflow) => (
                      <option key={workflow._id} value={workflow._id}>
                        {workflow.displayName || workflow.promptKey}
                      </option>
                    ))}
                  </select>
                  <p className="outbound-muted bulk-voice-meta">
                    {selectedBulkWorkflow
                      ? `${selectedBulkWorkflow.menuOptions?.length || 0} menu options ready for outbound callers`
                      : 'Answered outbound calls will enter the selected inbound IVR flow.'}
                  </p>
                </div>
              </div>

              <div className="outbound-grid outbound-grid-2">
                <div>
                  <label>Campaign Start</label>
                  <select
                    className="outbound-input"
                    value={bulkScheduleType}
                    onChange={(event) => setBulkScheduleType(event.target.value)}
                  >
                    <option value="immediate">Start Immediately</option>
                    <option value="once">Schedule Once</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
                {bulkScheduleType !== 'immediate' ? (
                  <div>
                    <label>{bulkScheduleType === 'once' ? 'Scheduled Date & Time' : 'Recurrence'}</label>
                    {bulkScheduleType === 'once' ? (
                      <input
                        className="outbound-input"
                        type="datetime-local"
                        value={bulkScheduledAt}
                        onChange={(event) => setBulkScheduledAt(event.target.value)}
                      />
                    ) : (
                      <select
                        className="outbound-input"
                        value={bulkRecurrence}
                        onChange={(event) => setBulkRecurrence(event.target.value)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    )}
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {bulkScheduleType !== 'immediate' && (
                <div className="outbound-grid outbound-grid-2">
                  <div className="outbound-grid outbound-grid-2 compact-grid bulk-window-grid">
                    <div>
                      <label>Allowed Window Start</label>
                      <input
                        className="outbound-input"
                        type="time"
                        value={bulkAllowedWindowStart}
                        onChange={(event) => setBulkAllowedWindowStart(event.target.value)}
                      />
                    </div>
                    <div>
                      <label>Allowed Window End</label>
                      <input
                        className="outbound-input"
                        type="time"
                        value={bulkAllowedWindowEnd}
                        onChange={(event) => setBulkAllowedWindowEnd(event.target.value)}
                      />
                    </div>
                  </div>
                  <div />
                </div>
              )}
            </div>

            <ContactUploader
              key={bulkUploaderKey}
              contacts={bulkContacts}
              onContactsUploaded={handleBulkContactsUploaded}
              onUploadProcessed={handleBulkUploadProcessed}
              error={localError}
              disabled={bulkLoading}
              previewTitle="contacts uploaded"
              emptyStateTitle="Upload Contacts CSV"
              emptyStateSubtitle="Click to select or drag and drop"
              emptyStateHint='CSV must include "phone", "mobile", or "number" column'
              supportedColumnsHelp='CSV with columns: phone/mobile/number, name (optional), and any custom fields for personalization.'
              sampleFileName="outbound_bulk_contacts_sample.csv"
              transformContact={(row, index, normalizePhoneNumber) => {
                const candidate = row.phone || row.mobile || row.number || row.to || Object.values(row || {})[0];
                if (!candidate) {
                  return null;
                }

                const phone = normalizeLocalNumber(candidate) || normalizePhoneNumber(candidate);
                if (!phone) {
                  return null;
                }

                const customFields = {};
                Object.keys(row || {}).forEach((key) => {
                  if (!['phone', 'mobile', 'number', 'to', 'name'].includes(String(key).toLowerCase()) && row[key]) {
                    customFields[key] = row[key];
                  }
                });

                return {
                  phone,
                  name: row.name || `Contact ${index + 1}`,
                  customFields
                };
              }}
            />

            <details className="additional-settings-panel">
              <summary className="additional-settings-summary">
                <span className="additional-settings-summary-text">
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Additional Settings
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>

              <div className="additional-settings-content">
                <p className="additional-settings-copy">
                  Only call opt-in users. DND numbers should remain blocked. Recipients can press 9 to opt out.
                </p>

                <div className="outbound-grid outbound-grid-3 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.recordCall)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          recordCall: event.target.checked
                        })}
                      />
                      <span>Enable recording</span>
                    </label>
                  </div>
                  <div className="setting-item-card">
                    <label>Max Duration (seconds)</label>
                    <input
                      className="outbound-input"
                      type="number"
                      min="30"
                      max="1800"
                      value={Number(callSettings?.maxDuration || 300)}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        maxDuration: Number.parseInt(event.target.value, 10) || 300
                      })}
                    />
                  </div>
                  <div className="setting-item-card">
                    <label>Retry Attempts</label>
                    <input
                      className="outbound-input"
                      type="number"
                      min="0"
                      max="5"
                      value={Number(callSettings?.retryAttempts || 3)}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        retryAttempts: Number.parseInt(event.target.value, 10) || 0
                      })}
                    />
                  </div>
                </div>

                <div className="outbound-grid outbound-grid-1 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label>Compliance Disclaimer</label>
                    <input
                      className="outbound-input"
                      type="text"
                      maxLength="120"
                      value={String(callSettings?.disclaimerText || 'This is an automated call from')}
                      onChange={(event) => onCallSettingsChange({
                        ...callSettings,
                        disclaimerText: event.target.value
                      })}
                    />
                    <p className="outbound-muted">Played before the main campaign message, matching voice broadcast settings.</p>
                  </div>
                </div>

                <div className="outbound-grid outbound-grid-2 compact-grid additional-settings-grid">
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.dndRespect)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          dndRespect: event.target.checked
                        })}
                      />
                      <span>Keep DND filtering enabled</span>
                    </label>
                  </div>
                  <div className="setting-item-card">
                    <label className="setting-checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(callSettings?.optOutEnabled)}
                        onChange={(event) => onCallSettingsChange({
                          ...callSettings,
                          optOutEnabled: event.target.checked
                        })}
                      />
                      <span>Enable Opt-Out (Press 9)</span>
                    </label>
                    <p className="outbound-muted">Use this for campaigns where recipients must be able to opt out.</p>
                  </div>
                  <div className="additional-settings-consent">
                    <div className="setting-item-card consent-card">
                      <label className="setting-checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(callSettings?.traiConsentConfirmed)}
                          onChange={(event) => onCallSettingsChange({
                            ...callSettings,
                            traiConsentConfirmed: event.target.checked
                          })}
                        />
                        <span>I confirm the uploaded recipients have consented and the campaign follows TRAI rules.</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <div className="outbound-actions-row">
              <button type="button" className="primary-btn" onClick={handleBulkCampaign} disabled={bulkLoading}>
                <Upload size={16} />
                {bulkLoading ? 'Launching...' : bulkScheduleType === 'immediate' ? 'Launch Campaign' : 'Save Campaign'}
              </button>
              <button
                type="button"
                className="secondary-btn reset-btn"
                onClick={handleResetBulkForm}
                disabled={bulkLoading}
              >
                Reset
              </button>
            </div>
          </>
        )}

        {localResult && (
          <div className="outbound-result-box">
            <p><strong>Success</strong></p>
            <p>{localResult.callSid ? `Call SID: ${localResult.callSid}` : `Campaign ID: ${localResult.campaignId}`}</p>
          </div>
        )}

        {(localError || error) && <div className="outbound-error">{localError || error}</div>}
      </div>

      <div className={`trai-banner ${overview?.trai?.isTraiAllowedNow ? 'ok' : 'blocked'}`}>
        {provider === 'twilio'
          ? 'Twilio quick calls are available outside the Exotel TRAI campaign window, but still require a valid E.164 From number.'
          : overview?.trai?.isTraiAllowedNow
          ? 'Calling window is active.'
          : 'Calling is available only between 09:00 and 21:00 IST.'}
      </div>
    </div>
  );
};

export default OutboundDialer;

