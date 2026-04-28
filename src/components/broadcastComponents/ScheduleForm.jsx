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
import { downloadCsv } from '../../utils/csvExport';

const META_RETRY_HISTORY_KEY = 'metaLeadBatchRetryHistory:v1';
const BROADCAST_SCHEDULE_DRAFT_KEY = 'broadcast:schedule-form:draft:v1';
const parseLeadIds = (input = '') =>
  Array.from(
    new Set(
      String(input || '')
        .split(/[\n,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
const parseSuppressionListEntries = (input = '') =>
  String(input || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
const isValidSuppressionPhone = (value = '') => /^\+?[1-9]\d{7,14}$/.test(String(value || '').trim());
const canUseSessionStorage = () =>
  typeof window !== 'undefined' &&
  typeof window.sessionStorage !== 'undefined';

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
  onAutoCleanRecipients,
  scheduledTime,
  onScheduledTimeChange,
  isSending,
  onCreateBroadcast,
  onSendBroadcast,
  sendResults,
  onBackToOverview,
  onResetForm,
  resetVersion = 0,
  onMetaLeadBatchSync,
  onToast,
  metaLeadBatchLoading = false,
  metaLeadBatchResult = null,
  quietHoursEnabled = false,
  onQuietHoursEnabledChange = () => {},
  quietHoursStartHour = 22,
  onQuietHoursStartHourChange = () => {},
  quietHoursEndHour = 9,
  onQuietHoursEndHourChange = () => {},
  quietHoursTimezone = 'Asia/Kolkata',
  onQuietHoursTimezoneChange = () => {},
  quietHoursAction = 'defer',
  onQuietHoursActionChange = () => {},
  retryPolicyEnabled = true,
  onRetryPolicyEnabledChange = () => {},
  retryMaxAttempts = 3,
  onRetryMaxAttemptsChange = () => {},
  retryBackoffSeconds = 45,
  onRetryBackoffSecondsChange = () => {},
  respectOptOut = true,
  onRespectOptOutChange = () => {},
  suppressionListRaw = '',
  onSuppressionListRawChange = () => {}
}) => {
  const scheduleInputRef = React.useRef(null);
  const hasAppliedResetVersion = React.useRef(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [metaLeadIdsText, setMetaLeadIdsText] = React.useState('');
  const [metaSendTemplate, setMetaSendTemplate] = React.useState(false);
  const [metaDryRun, setMetaDryRun] = React.useState(true);
  const [metaRetryCount, setMetaRetryCount] = React.useState(0);
  const [metaLastRetryAt, setMetaLastRetryAt] = React.useState(null);
  const [metaLastRetryLeadCount, setMetaLastRetryLeadCount] = React.useState(0);
  const [metaRetryHistory, setMetaRetryHistory] = React.useState([]);
  const [draftSavedAt, setDraftSavedAt] = React.useState(null);
  const [hasStoredDraft, setHasStoredDraft] = React.useState(false);
  const hasRestoredDraftRef = React.useRef(false);
  const lastDraftPayloadRef = React.useRef('');

  React.useEffect(() => {
    if (!canUseSessionStorage()) return;
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
    } catch {
      // ignore invalid session cache
    }
  }, []);

  React.useEffect(() => {
    if (!hasAppliedResetVersion.current) {
      hasAppliedResetVersion.current = true;
      return;
    }

    setMetaLeadIdsText('');
    setMetaSendTemplate(false);
    setMetaDryRun(true);
    setMetaRetryCount(0);
    setMetaLastRetryAt(null);
    setMetaLastRetryLeadCount(0);
    setMetaRetryHistory([]);
    setDraftSavedAt(null);
    setHasStoredDraft(false);
    hasRestoredDraftRef.current = false;
    lastDraftPayloadRef.current = '';
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(META_RETRY_HISTORY_KEY);
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
    } catch {
      // ignore storage errors
    }
  }, [resetVersion]);

  React.useEffect(() => {
    if (!canUseSessionStorage() || hasRestoredDraftRef.current) return;
    hasRestoredDraftRef.current = true;

    const hasExistingData =
      String(broadcastName || '').trim().length > 0 ||
      String(templateName || '').trim().length > 0 ||
      String(customMessage || '').trim().length > 0 ||
      String(scheduledTime || '').trim().length > 0 ||
      String(suppressionListRaw || '').trim().length > 0 ||
      String(metaLeadIdsText || '').trim().length > 0 ||
      quietHoursEnabled ||
      (Array.isArray(recipients) && recipients.length > 0);
    if (hasExistingData) return;

    try {
      const raw = window.sessionStorage.getItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      if (!raw) return;
      setHasStoredDraft(true);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      if (typeof parsed.broadcastName === 'string') {
        onBroadcastNameChange?.({ target: { value: parsed.broadcastName } });
      }
      if (typeof parsed.templateName === 'string') {
        onTemplateNameChange?.({ target: { value: parsed.templateName } });
      }
      if (typeof parsed.templateFilter === 'string') {
        onTemplateFilterChange?.(parsed.templateFilter);
      }
      if (typeof parsed.customMessage === 'string') {
        onCustomMessageChange?.({ target: { value: parsed.customMessage } });
      }
      if (typeof parsed.scheduledTime === 'string') {
        onScheduledTimeChange?.({ target: { value: parsed.scheduledTime } });
      }
      if (typeof parsed.quietHoursEnabled === 'boolean') {
        onQuietHoursEnabledChange?.(parsed.quietHoursEnabled);
      }
      if (typeof parsed.quietHoursStartHour !== 'undefined') {
        onQuietHoursStartHourChange?.(String(parsed.quietHoursStartHour));
      }
      if (typeof parsed.quietHoursEndHour !== 'undefined') {
        onQuietHoursEndHourChange?.(String(parsed.quietHoursEndHour));
      }
      if (typeof parsed.quietHoursTimezone === 'string') {
        onQuietHoursTimezoneChange?.(parsed.quietHoursTimezone);
      }
      if (typeof parsed.quietHoursAction === 'string') {
        onQuietHoursActionChange?.(parsed.quietHoursAction);
      }
      if (typeof parsed.retryPolicyEnabled === 'boolean') {
        onRetryPolicyEnabledChange?.(parsed.retryPolicyEnabled);
      }
      if (typeof parsed.retryMaxAttempts !== 'undefined') {
        onRetryMaxAttemptsChange?.(String(parsed.retryMaxAttempts));
      }
      if (typeof parsed.retryBackoffSeconds !== 'undefined') {
        onRetryBackoffSecondsChange?.(String(parsed.retryBackoffSeconds));
      }
      if (typeof parsed.respectOptOut === 'boolean') {
        onRespectOptOutChange?.(parsed.respectOptOut);
      }
      if (typeof parsed.suppressionListRaw === 'string') {
        onSuppressionListRawChange?.(parsed.suppressionListRaw);
      }
      if (typeof parsed.metaLeadIdsText === 'string') {
        setMetaLeadIdsText(parsed.metaLeadIdsText);
      }
      if (typeof parsed.metaSendTemplate === 'boolean') {
        setMetaSendTemplate(parsed.metaSendTemplate);
      }
      if (typeof parsed.metaDryRun === 'boolean') {
        setMetaDryRun(parsed.metaDryRun);
      }
    } catch {
      // ignore invalid draft payload
    }
  }, [
    broadcastName,
    templateName,
    customMessage,
    scheduledTime,
    suppressionListRaw,
    metaLeadIdsText,
    quietHoursEnabled,
    recipients,
    onBroadcastNameChange,
    onTemplateNameChange,
    onTemplateFilterChange,
    onCustomMessageChange,
    onScheduledTimeChange,
    onQuietHoursEnabledChange,
    onQuietHoursStartHourChange,
    onQuietHoursEndHourChange,
    onQuietHoursTimezoneChange,
    onQuietHoursActionChange,
    onRetryPolicyEnabledChange,
    onRetryMaxAttemptsChange,
    onRetryBackoffSecondsChange,
    onRespectOptOutChange,
    onSuppressionListRawChange
  ]);

  const buildDraftPayload = React.useCallback(() => ({
    broadcastName: String(broadcastName || ''),
    templateName: String(templateName || ''),
    templateFilter: String(templateFilter || ''),
    customMessage: String(customMessage || ''),
    scheduledTime: String(scheduledTime || ''),
    quietHoursEnabled: Boolean(quietHoursEnabled),
    quietHoursStartHour,
    quietHoursEndHour,
    quietHoursTimezone: String(quietHoursTimezone || ''),
    quietHoursAction: String(quietHoursAction || ''),
    retryPolicyEnabled: Boolean(retryPolicyEnabled),
    retryMaxAttempts,
    retryBackoffSeconds,
    respectOptOut: Boolean(respectOptOut),
    suppressionListRaw: String(suppressionListRaw || ''),
    metaLeadIdsText: String(metaLeadIdsText || ''),
    metaSendTemplate: Boolean(metaSendTemplate),
    metaDryRun: Boolean(metaDryRun)
  }), [
    broadcastName,
    templateName,
    templateFilter,
    customMessage,
    scheduledTime,
    quietHoursEnabled,
    quietHoursStartHour,
    quietHoursEndHour,
    quietHoursTimezone,
    quietHoursAction,
    retryPolicyEnabled,
    retryMaxAttempts,
    retryBackoffSeconds,
    respectOptOut,
    suppressionListRaw,
    metaLeadIdsText,
    metaSendTemplate,
    metaDryRun
  ]);

  const hasFormProgress = React.useMemo(() => {
    const hasCampaignMeta =
      String(broadcastName || '').trim().length > 0 ||
      String(templateName || '').trim().length > 0 ||
      String(customMessage || '').trim().length > 0;
    const hasUploadOrRecipients = Boolean(uploadedFile) || (Array.isArray(recipients) && recipients.length > 0);
    const hasScheduleOrPolicy =
      String(scheduledTime || '').trim().length > 0 ||
      quietHoursEnabled ||
      String(suppressionListRaw || '').trim().length > 0;
    const hasMetaLeadDraft = String(metaLeadIdsText || '').trim().length > 0;
    return hasCampaignMeta || hasUploadOrRecipients || hasScheduleOrPolicy || hasMetaLeadDraft;
  }, [
    broadcastName,
    templateName,
    customMessage,
    uploadedFile,
    recipients,
    scheduledTime,
    quietHoursEnabled,
    suppressionListRaw,
    metaLeadIdsText
  ]);

  React.useEffect(() => {
    if (!canUseSessionStorage()) return;
    if (!hasFormProgress) {
      try {
        window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      } catch {
        // ignore storage errors
      }
      lastDraftPayloadRef.current = '';
      if (hasStoredDraft || draftSavedAt) {
        setHasStoredDraft(false);
        setDraftSavedAt(null);
      }
      return;
    }

    const payload = buildDraftPayload();
    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastDraftPayloadRef.current) return;

    try {
      window.sessionStorage.setItem(BROADCAST_SCHEDULE_DRAFT_KEY, serializedPayload);
      lastDraftPayloadRef.current = serializedPayload;
      setHasStoredDraft(true);
      setDraftSavedAt(new Date());
    } catch {
      // ignore storage errors
    }
  }, [
    buildDraftPayload,
    hasFormProgress,
    hasStoredDraft,
    draftSavedAt
  ]);

  const persistRetryHistory = React.useCallback((history) => {
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.setItem(META_RETRY_HISTORY_KEY, JSON.stringify(history));
    } catch {
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
    const [headerLine, ...dataLines] = csvRows;
    const headers = String(headerLine || '').split(',');
    const rows = dataLines.map((line) => String(line || '').split(','));
    downloadCsv({
      filename: 'broadcast_contacts_sample.csv',
      headers,
      rows,
      exportType: 'broadcast_contacts_sample'
    });
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
      onToast?.('Please drop a valid CSV file.', 'error');
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

  const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return Math.trunc(parsed);
  };

  const normalizeQuietStartHour = () => {
    const normalized = clampNumber(quietHoursStartHour, 0, 23, 22);
    onQuietHoursStartHourChange(String(normalized));
  };

  const normalizeQuietEndHour = () => {
    const normalized = clampNumber(quietHoursEndHour, 0, 23, 9);
    onQuietHoursEndHourChange(String(normalized));
  };

  const normalizeRetryAttempts = () => {
    const normalized = clampNumber(retryMaxAttempts, 1, 10, 3);
    onRetryMaxAttemptsChange(String(normalized));
  };

  const normalizeRetryBackoff = () => {
    const normalized = clampNumber(retryBackoffSeconds, 5, 600, 45);
    onRetryBackoffSecondsChange(String(normalized));
  };

  const normalizeQuietTimezone = () => {
    const trimmed = String(quietHoursTimezone || '').trim();
    onQuietHoursTimezoneChange(trimmed || 'Asia/Kolkata');
  };

  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const getRecipientDiagnostics = React.useCallback(() => {
    const phoneCountMap = new Map();
    (recipients || []).forEach((recipient) => {
      const raw = recipient?.data || recipient || {};
      const fullData = raw.fullData || raw || {};
      const phone = String(
        recipient?.phone ||
        raw.phone ||
        fullData.phone ||
        fullData.mobile ||
        fullData.number ||
        ''
      ).trim();
      if (!phone || phone === '-') return;
      phoneCountMap.set(phone, (phoneCountMap.get(phone) || 0) + 1);
    });

    const rows = (recipients || []).map((recipient, index) => {
      const raw = recipient?.data || recipient || {};
      const fullData = raw.fullData || raw || {};
      const normalizedPhone = String(
        recipient?.phone ||
        raw.phone ||
        fullData.phone ||
        fullData.mobile ||
        fullData.number ||
        ''
      ).trim();
      const phone = normalizedPhone || '-';
      const name = raw.name || fullData.name || `Contact ${index + 1}`;
      const customFieldCount = Object.keys(fullData).filter((key) => !['phone', 'mobile', 'number', 'name', 'variables'].includes(String(key).toLowerCase())).length;
      const isMissingPhone = !normalizedPhone || normalizedPhone === '-';
      const isDuplicatePhone = !isMissingPhone && (phoneCountMap.get(normalizedPhone) || 0) > 1;

      return {
        index,
        phone,
        name,
        customFieldCount,
        qualityLabel: isMissingPhone ? 'Missing phone' : isDuplicatePhone ? 'Duplicate phone' : 'Valid',
        qualityTone: isMissingPhone || isDuplicatePhone ? 'issue' : 'ok'
      };
    });

    const missingPhoneCount = rows.filter((row) => row.qualityLabel === 'Missing phone').length;
    const duplicatePhoneCount = rows.filter((row) => row.qualityLabel === 'Duplicate phone').length;
    const validCount = rows.filter((row) => row.qualityTone === 'ok').length;
    const skippedCount = missingPhoneCount + duplicatePhoneCount;

    return {
      rows,
      summary: {
        validCount,
        skippedCount,
        missingPhoneCount,
        duplicatePhoneCount,
        hasIssues: skippedCount > 0
      }
    };
  }, [recipients]);

  const recipientDiagnostics = React.useMemo(() => getRecipientDiagnostics(), [getRecipientDiagnostics]);
  const contactRows = React.useMemo(
    () => recipientDiagnostics.rows.slice(0, 5),
    [recipientDiagnostics]
  );
  const recipientQualitySummary = recipientDiagnostics.summary;

  const downloadRecipientIssueCsv = () => {
    const issueRows = recipientDiagnostics.rows.filter((row) => row.qualityTone === 'issue');
    if (!issueRows.length) {
      onToast?.('No issue rows available for export.', 'info');
      return;
    }

    downloadCsv({
      filename: `recipient_quality_issues_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      headers: ['rowNumber', 'phone', 'name', 'issueType'],
      rows: issueRows.map((row) => [row.index + 1, row.phone, row.name, row.qualityLabel]),
      exportType: 'recipient_quality_issues'
    });
  };

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
    const leadIds = parsedMetaLeadIds;
    if (!leadIds.length) {
      onToast?.('Please enter at least one Meta lead ID.', 'error');
      return;
    }
    onMetaLeadBatchSync({
      leadIdsText: leadIds.join('\n'),
      enableTemplateSend: Boolean(metaSendTemplate),
      dryRun: Boolean(metaDryRun)
    });
  };

  const downloadMetaBatchFailureCsv = () => {
    const exportGeneratedAt = new Date().toISOString();
    const lastRetryAtIso = metaLastRetryAt instanceof Date ? metaLastRetryAt.toISOString() : '';
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
        messageId: String(item?.messageId || item?.response?.messages?.[0]?.id || ''),
        status: String(item?.status || ''),
      }));

    const sendFailures = sendResults
      .filter((item) => !item?.success)
      .map((item) => ({
        type: 'send',
        leadId: String(item?.leadId || ''),
        phone: String(item?.phone || ''),
        error: String(item?.error || ''),
        messageId: String(item?.messageId || item?.response?.messages?.[0]?.id || ''),
        status: String(item?.status || ''),
      }));

    const failures = [...syncFailures, ...sendFailures];
    if (!failures.length) {
      onToast?.('No failed rows available for export.', 'info');
      return;
    }

    const headers = ['type', 'leadId', 'phone', 'status', 'messageId', 'error', 'retryCount', 'lastRetryAt', 'exportGeneratedAt'];
    const rows = failures.map((row) => [
      row.type,
      row.leadId,
      row.phone,
      row.status,
      row.messageId,
      row.error,
      metaRetryCount,
      lastRetryAtIso,
      exportGeneratedAt
    ]);

    downloadCsv({
      filename: `meta_lead_batch_failures_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      headers,
      rows,
      exportType: 'meta_lead_batch_failures'
    });
  };

  const downloadMetaBatchFullCsv = () => {
    const exportGeneratedAt = new Date().toISOString();
    const lastRetryAtIso = metaLastRetryAt instanceof Date ? metaLastRetryAt.toISOString() : '';
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
      messageId: String(item?.messageId || item?.response?.messages?.[0]?.id || ''),
      error: String(item?.error || '')
    }));

    const sendRows = sendResults.map((item) => ({
      stage: 'send',
      status: item?.success ? 'success' : 'failed',
      leadId: String(item?.leadId || ''),
      phone: String(item?.phone || ''),
      contactId: String(item?.contactId || ''),
      messageId: String(item?.messageId || item?.response?.messages?.[0]?.id || ''),
      error: String(item?.error || '')
    }));

    const rowsData = [...syncRows, ...sendRows];
    if (!rowsData.length) {
      onToast?.('No batch rows available for export.', 'info');
      return;
    }

    const headers = ['stage', 'status', 'leadId', 'phone', 'contactId', 'messageId', 'error', 'retryCount', 'lastRetryAt', 'exportGeneratedAt'];
    const rows = rowsData.map((row) => [
      row.stage,
      row.status,
      row.leadId,
      row.phone,
      row.contactId,
      row.messageId,
      row.error,
      metaRetryCount,
      lastRetryAtIso,
      exportGeneratedAt
    ]);

    downloadCsv({
      filename: `meta_lead_batch_full_report_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      headers,
      rows,
      exportType: 'meta_lead_batch_full_report'
    });
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
      onToast?.('No failed send rows with lead IDs found for retry.', 'info');
      return;
    }

    setMetaLeadIdsText(failedLeadIds.join('\n'));
    setMetaSendTemplate(true);
    setMetaDryRun(false);
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

  const parsedMetaLeadIds = parseLeadIds(metaLeadIdsText);
  const suppressionListMeta = React.useMemo(() => {
    const entries = parseSuppressionListEntries(suppressionListRaw);
    const uniqueEntries = Array.from(new Set(entries));
    const invalidEntries = uniqueEntries.filter((entry) => !isValidSuppressionPhone(entry));
    return {
      total: uniqueEntries.length,
      invalidEntries
    };
  }, [suppressionListRaw]);
  const hasMetaLeadIds = React.useMemo(
    () => parsedMetaLeadIds.length > 0,
    [parsedMetaLeadIds]
  );
  const hasRecipientIssues = recipientQualitySummary.hasIssues;
  const policyValidation = React.useMemo(() => {
    if (!quietHoursEnabled && !retryPolicyEnabled) {
      return { isInvalid: false, reason: '' };
    }

    const toInteger = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
    };

    if (quietHoursEnabled) {
      const startHour = toInteger(quietHoursStartHour);
      const endHour = toInteger(quietHoursEndHour);
      if (Number.isNaN(startHour) || startHour < 0 || startHour > 23) {
        return { isInvalid: true, reason: 'Quiet hours start must be between 0 and 23.' };
      }
      if (Number.isNaN(endHour) || endHour < 0 || endHour > 23) {
        return { isInvalid: true, reason: 'Quiet hours end must be between 0 and 23.' };
      }
      if (startHour === endHour) {
        return { isInvalid: true, reason: 'Quiet hours start and end cannot be the same.' };
      }
      if (!String(quietHoursTimezone || '').trim()) {
        return { isInvalid: true, reason: 'Quiet hours timezone is required when quiet hours are enabled.' };
      }
    }

    if (retryPolicyEnabled) {
      const attempts = toInteger(retryMaxAttempts);
      const backoff = toInteger(retryBackoffSeconds);
      if (Number.isNaN(attempts) || attempts < 1 || attempts > 10) {
        return { isInvalid: true, reason: 'Retry max attempts must be between 1 and 10.' };
      }
      if (Number.isNaN(backoff) || backoff < 5 || backoff > 600) {
        return { isInvalid: true, reason: 'Retry backoff must be between 5 and 600 seconds.' };
      }
    }

    if (suppressionListMeta.invalidEntries.length > 0) {
      return {
        isInvalid: true,
        reason: `Invalid suppression numbers: ${suppressionListMeta.invalidEntries.slice(0, 3).join(', ')}${
          suppressionListMeta.invalidEntries.length > 3 ? '...' : ''
        }`
      };
    }

    return { isInvalid: false, reason: '' };
  }, [
    quietHoursEnabled,
    quietHoursStartHour,
    quietHoursEndHour,
    quietHoursTimezone,
    retryPolicyEnabled,
    retryMaxAttempts,
    retryBackoffSeconds,
    suppressionListMeta
  ]);

  const scheduleValidation = React.useMemo(() => {
    const raw = String(scheduledTime || '').trim();
    if (!raw) {
      return { isInvalid: false, reason: '' };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { isInvalid: true, reason: 'Selected schedule date/time is invalid.' };
    }

    const now = new Date();
    if (parsed.getTime() <= now.getTime()) {
      return { isInvalid: true, reason: 'Schedule time must be in the future.' };
    }

    return { isInvalid: false, reason: '' };
  }, [scheduledTime]);

  const canSubmitCampaign = React.useMemo(() => {
    const hasRecipients = Array.isArray(recipients) && recipients.length > 0;
    const hasName = String(broadcastName || '').trim().length > 0;
    if (!hasRecipients || !hasName) return false;

    if (messageType === 'template') {
      return String(templateName || '').trim().length > 0;
    }

    return String(customMessage || '').trim().length > 0;
  }, [recipients, broadcastName, messageType, templateName, customMessage]);

  React.useEffect(() => {
    if (!hasFormProgress || typeof window === 'undefined') return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasFormProgress]);

  const handleResetClick = () => {
    if (!hasFormProgress) {
      onResetForm?.();
      return;
    }

    const message =
      'Reset will clear campaign name, message/template, contacts, schedule and policy settings. Continue?';
    const shouldReset = typeof window === 'undefined' ? true : window.confirm(message);
    if (!shouldReset) return;
    if (canUseSessionStorage()) {
      try {
        window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      } catch {
        // ignore storage errors
      }
    }
    setHasStoredDraft(false);
    setDraftSavedAt(null);
    lastDraftPayloadRef.current = '';
    onResetForm?.();
  };

  const handleBackToOverviewClick = () => {
    if (!hasFormProgress) {
      onBackToOverview?.();
      return;
    }

    const message = 'You have unsaved campaign changes. Leave this page and go back to overview?';
    const shouldLeave = typeof window === 'undefined' ? true : window.confirm(message);
    if (!shouldLeave) return;
    onBackToOverview?.();
  };

  React.useEffect(() => {
    if (!sendResults || !canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      setHasStoredDraft(false);
      setDraftSavedAt(null);
      lastDraftPayloadRef.current = '';
    } catch {
      // ignore storage errors
    }
  }, [sendResults]);

  const handleClearSavedDraft = () => {
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      setHasStoredDraft(false);
      setDraftSavedAt(null);
      lastDraftPayloadRef.current = '';
      onToast?.('Saved draft cleared.', 'success');
    } catch {
      onToast?.('Unable to clear saved draft right now.', 'error');
    }
  };

  const handleSaveDraftNow = React.useCallback(() => {
    if (!canUseSessionStorage()) {
      onToast?.('Draft save is unavailable in this environment.', 'error');
      return;
    }
    if (!hasFormProgress) {
      onToast?.('Nothing to save yet. Fill campaign details first.', 'info');
      return;
    }

    const payload = buildDraftPayload();

    try {
      const serializedPayload = JSON.stringify(payload);
      window.sessionStorage.setItem(BROADCAST_SCHEDULE_DRAFT_KEY, serializedPayload);
      lastDraftPayloadRef.current = serializedPayload;
      setHasStoredDraft(true);
      setDraftSavedAt(new Date());
      onToast?.('Draft saved.', 'success');
    } catch {
      onToast?.('Unable to save draft right now.', 'error');
    }
  }, [buildDraftPayload, hasFormProgress, onToast]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKeyDown = (event) => {
      const isSaveCombo = (event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 's';
      if (!isSaveCombo) return;
      if (!hasFormProgress) return;
      event.preventDefault();
      handleSaveDraftNow();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSaveDraftNow, hasFormProgress]);

  const handleCreateBroadcastClick = () => {
    if (hasRecipientIssues) {
      onToast?.(
        `Please resolve recipient issues before scheduling (${recipientQualitySummary.missingPhoneCount} missing phone, ${recipientQualitySummary.duplicatePhoneCount} duplicates).`,
        'error'
      );
      return;
    }
    if (scheduleValidation.isInvalid) {
      onToast?.(scheduleValidation.reason, 'error');
      return;
    }
    if (policyValidation.isInvalid) {
      onToast?.(policyValidation.reason, 'error');
      return;
    }
    onCreateBroadcast?.();
  };

  const handleSendBroadcastClick = () => {
    if (hasRecipientIssues) {
      onToast?.(
        `Please resolve recipient issues before sending (${recipientQualitySummary.missingPhoneCount} missing phone, ${recipientQualitySummary.duplicatePhoneCount} duplicates).`,
        'error'
      );
      return;
    }
    if (policyValidation.isInvalid) {
      onToast?.(policyValidation.reason, 'error');
      return;
    }
    onSendBroadcast?.();
  };

  const clearMetaRetryHistory = () => {
    setMetaRetryCount(0);
    setMetaLastRetryAt(null);
    setMetaLastRetryLeadCount(0);
    setMetaRetryHistory([]);
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(META_RETRY_HISTORY_KEY);
    } catch {
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
            <small className="meta-lead-sync-summary">
              {hasMetaLeadIds
                ? `${parsedMetaLeadIds.length} lead ID${parsedMetaLeadIds.length === 1 ? '' : 's'} ready`
                : 'No lead IDs parsed yet'}
            </small>
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
                disabled={metaLeadBatchLoading || !hasMetaLeadIds}
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

                  <div className={`recipient-quality-summary ${recipientQualitySummary.hasIssues ? 'has-issues' : 'is-clean'}`}>
                    {recipientQualitySummary.hasIssues ? (
                      <>
                        <strong>{recipientQualitySummary.validCount} valid contacts ready.</strong>{' '}
                        Skipping {recipientQualitySummary.skippedCount} rows
                        ({recipientQualitySummary.missingPhoneCount} missing phone, {recipientQualitySummary.duplicatePhoneCount} duplicates).
                      </>
                    ) : (
                      <>
                        <strong>All {recipientQualitySummary.validCount} contacts are valid.</strong> No missing or duplicate phone rows detected.
                      </>
                    )}
                  </div>

                  <div className="recipient-quality-actions">
                    <button
                      type="button"
                      className="contacts-clean-btn"
                      onClick={onAutoCleanRecipients}
                      disabled={!recipientQualitySummary.hasIssues || typeof onAutoCleanRecipients !== 'function'}
                    >
                      Auto-clean rows
                    </button>
                    <button
                      type="button"
                      className="contacts-clean-btn"
                      onClick={downloadRecipientIssueCsv}
                      disabled={!recipientQualitySummary.hasIssues}
                    >
                      Download issue rows
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
                          <tr
                            key={`${row.phone}-${row.index}`}
                            className={row.qualityTone === 'issue' ? 'contact-row-issue' : ''}
                          >
                            <td>{row.index + 1}</td>
                            <td className="phone-cell">
                              <span>{row.phone}</span>
                              <span className={`phone-quality-badge ${row.qualityTone}`}>
                                {row.qualityLabel}
                              </span>
                            </td>
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
                      min={getCurrentDateTimeLocal()}
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
                {scheduleValidation.isInvalid ? (
                  <small className="schedule-validation-error">{scheduleValidation.reason}</small>
                ) : null}
              </div>
            </details>
          </div>

          <div className="form-group policy-settings-block">
            <details>
              <summary>
                <Settings size={16} />
                Delivery & Compliance Policy
              </summary>
              <div className="policy-settings-content">
                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(event) => onQuietHoursEnabledChange(event.target.checked)}
                  />
                  <span>Enable quiet hours</span>
                </label>

                {quietHoursEnabled ? (
                  <div className="policy-grid">
                    <div className="policy-field">
                      <span>Start hour</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={quietHoursStartHour}
                        onChange={(event) => onQuietHoursStartHourChange(event.target.value)}
                        onBlur={normalizeQuietStartHour}
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
                        onBlur={normalizeQuietEndHour}
                      />
                    </div>
                    <div className="policy-field">
                      <span>Timezone</span>
                      <input
                        type="text"
                        value={quietHoursTimezone}
                        onChange={(event) => onQuietHoursTimezoneChange(event.target.value)}
                        onBlur={normalizeQuietTimezone}
                        placeholder="Asia/Kolkata"
                      />
                    </div>
                    <div className="policy-field">
                      <span>Action</span>
                      <select
                        value={quietHoursAction}
                        onChange={(event) => onQuietHoursActionChange(event.target.value)}
                      >
                        <option value="defer">Defer send</option>
                        <option value="skip">Skip send</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={retryPolicyEnabled}
                    onChange={(event) => onRetryPolicyEnabledChange(event.target.checked)}
                  />
                  <span>Enable retry policy</span>
                </label>

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
                      onBlur={normalizeRetryAttempts}
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
                      onBlur={normalizeRetryBackoff}
                    />
                  </div>
                </div>

                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={respectOptOut}
                    onChange={(event) => onRespectOptOutChange(event.target.checked)}
                  />
                  <span>Respect opted-out recipients</span>
                </label>

                <div className="policy-field suppression-list-field">
                  <span>Suppression list (comma/newline separated)</span>
                  <textarea
                    rows={3}
                    value={suppressionListRaw}
                    onChange={(event) => onSuppressionListRawChange(event.target.value)}
                    placeholder="+919999999999, +919888888888"
                  />
                  <small className="suppression-list-meta">
                    {suppressionListMeta.total > 0
                      ? `${suppressionListMeta.total} unique number${suppressionListMeta.total === 1 ? '' : 's'}`
                      : 'No suppression numbers added'}
                  </small>
                  {suppressionListMeta.invalidEntries.length > 0 ? (
                    <small className="suppression-list-error">
                      Invalid format: {suppressionListMeta.invalidEntries.slice(0, 5).join(', ')}
                      {suppressionListMeta.invalidEntries.length > 5 ? '...' : ''}
                    </small>
                  ) : null}
                </div>
                {policyValidation.isInvalid ? (
                  <small className="policy-validation-error">{policyValidation.reason}</small>
                ) : null}
              </div>
            </details>
          </div>

          {uploadedFile && fileVariables.length > 0 && (
            <div className="variable-file-info">
              Variables detected: {fileVariables.join(', ')}
            </div>
          )}

          <div className="form-actions">
            {hasStoredDraft ? (
              <div className="draft-status-meta">
                {draftSavedAt
                  ? `Draft auto-saved at ${draftSavedAt.toLocaleTimeString()}`
                  : 'Draft auto-save is enabled'}
              </div>
            ) : null}

            {hasRecipientIssues ? (
              <div className="submit-block-warning">
                <strong>Broadcast blocked:</strong> fix recipient issues first ({recipientQualitySummary.missingPhoneCount} missing phone, {recipientQualitySummary.duplicatePhoneCount} duplicates).
              </div>
            ) : null}

            <button type="button" className="secondary-btn" onClick={handleSaveDraftNow}>
              Save Draft Now
            </button>

            {hasStoredDraft ? (
              <button type="button" className="secondary-btn" onClick={handleClearSavedDraft}>
                Clear Saved Draft
              </button>
            ) : null}

            <button className="secondary-btn" onClick={handleResetClick}>
              Reset
            </button>

            <button className="secondary-btn" onClick={handleBackToOverviewClick}>
              Back to Overview
            </button>

            {scheduledTime ? (
              <button
                className="primary-btn"
                onClick={handleCreateBroadcastClick}
                disabled={isSending || !canSubmitCampaign || hasRecipientIssues || scheduleValidation.isInvalid || policyValidation.isInvalid}
              >
                <Calendar size={16} />
                {isSending ? 'Scheduling...' : `Schedule Broadcast (${recipients.length} contacts)`}
              </button>
            ) : (
              <button
                className="primary-btn"
                onClick={handleSendBroadcastClick}
                disabled={isSending || !canSubmitCampaign || hasRecipientIssues || policyValidation.isInvalid}
              >
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
