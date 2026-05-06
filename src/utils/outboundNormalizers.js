import { formatVoiceDateTime } from './voiceTime';

export const TERMINAL_CALL_STATUSES = new Set(['completed', 'failed', 'busy', 'no-answer', 'cancelled', 'canceled']);
export const NON_TERMINAL_CALL_STATUSES = new Set(['queued', 'initiated', 'ringing', 'answered', 'in-progress', 'running', 'scheduled']);

export const normalizeStatus = (value) => String(value || '').toLowerCase();

export const formatDateTime = (value) => {
  if (!value) return '-';
  return formatVoiceDateTime(value);
};

export const deriveOutboundType = (payload = {}) => {
  const metadata = payload.metadata || payload.providerData || {};
  const explicitType = String(
    payload.type ||
    payload.campaignType ||
    payload.originType ||
    metadata.type ||
    metadata.campaignType ||
    metadata.originType ||
    ''
  ).trim().toLowerCase();

  if (explicitType === 'single' || explicitType === 'bulk') return explicitType;

  const numbers = Array.isArray(payload.numbers) ? payload.numbers : [];
  const contactCount = Number(
    payload.contactCount ??
    payload.contactSummary?.total ??
    metadata.contactCount ??
    numbers.length ??
    0
  ) || 0;
  const campaignName = String(payload.campaignName || payload.name || metadata.campaignName || '').trim();
  const singleRecipient = payload.singleRecipient || payload.phoneNumber || payload.recipientPhone || metadata.singleRecipient || '';

  if (singleRecipient && contactCount <= 1) return 'single';
  if (contactCount === 1 && /^single call\b/i.test(campaignName)) return 'single';
  if (numbers.length === 1 && /^single call\b/i.test(campaignName)) return 'single';
  return payload.campaignId || metadata.campaignId || contactCount > 1 ? 'bulk' : 'single';
};

export const getMonitorKey = (payload = {}) => {
  const callSid = String(payload.callSid || payload.call_sid || '').trim();
  if (callSid) return `call:${callSid}`;
  const campaignId = String(payload.campaignId || payload.campaignDbId || '').trim();
  const contactId = String(payload.contactId || '').trim();
  if (campaignId && contactId) return `campaign:${campaignId}:${contactId}`;
  if (campaignId) return `campaign:${campaignId}`;
  return '';
};

export const normalizeMonitorPayload = (payload = {}) => {
  const status = normalizeStatus(payload.status || 'initiated');
  const key = getMonitorKey(payload);
  if (!key) return null;
  const metadata = payload.metadata || payload.rawResponse?.metadata || {};
  const contactSummary = payload.contactSummary || payload.rawResponse?.contactSummary || {};
  const type = deriveOutboundType({
    ...payload,
    metadata,
    contactSummary
  });
  const phoneNumber = payload.phoneNumber || payload.to || payload.phone || payload.recipientPhone || metadata.singleRecipient || '';

  return {
    key,
    type,
    title: payload.title || (type === 'bulk' ? 'Bulk Campaign' : 'Single Call'),
    status: status || 'initiated',
    ended: typeof payload.ended === 'boolean' ? payload.ended : TERMINAL_CALL_STATUSES.has(status),
    callSid: payload.callSid || payload.call_sid || '',
    provider: payload.provider || metadata.provider || '',
    from: payload.from || payload.fromNumber || '',
    to: phoneNumber,
    phoneNumber,
    campaignId: payload.campaignId || metadata.campaignId || '',
    campaignDbId: payload.campaignDbId || metadata.outboundCampaignId || '',
    campaignName: payload.campaignName || payload.name || metadata.campaignName || '',
    contactId: payload.contactId || '',
    contactCount: payload.contactCount || contactSummary.total || metadata.contactCount || '',
    workflowId: payload.workflowId || payload.ivrWorkflow?.workflowId || metadata.workflowId || '',
    voiceId: payload.voiceId || payload.voice?.voiceId || metadata.voiceId || '',
    scheduleType: payload.scheduleType || payload.schedule?.scheduleType || payload.mode || 'immediate',
    scheduledAt: payload.scheduledAt || payload.schedule?.scheduledAt || metadata.scheduledAt || null,
    recurrence: payload.recurrence || payload.schedule?.recurrence || metadata.recurrence || '',
    customMessage: payload.customMessage || payload.message || '',
    metadata,
    duration: Number(payload.duration || 0) || 0,
    createdAt: payload.createdAt || payload.timestamp || payload.updatedAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || payload.timestamp || new Date().toISOString(),
    rawResponse: payload.rawResponse || null
  };
};

export const normalizeHistoryItem = (item = {}) => ({
  ...item,
  type: deriveOutboundType(item),
  phoneNumber: item.phoneNumber || item.to || item.providerData?.singleRecipient || '',
  campaignName: item.providerData?.campaignName || item.campaignName || '',
  campaignId: item.providerData?.campaignId || item.campaignId || '',
  workflowId: item.providerData?.workflowId || item.workflowId || ''
});

export const normalizeScheduledItem = (item = {}) => {
  const metadata = item.metadata || {};
  const type = deriveOutboundType(item);
  const numbers = Array.isArray(item.numbers) ? item.numbers : [];
  const phoneNumber = item.phoneNumber || item.singleRecipient || metadata.singleRecipient || numbers[0] || '';
  const contactCount = Number(item.contactCount ?? metadata.contactCount ?? numbers.length ?? 0) || 0;
  const status = normalizeStatus(item.status);

  return {
    ...item,
    id: item._id || item.id || item.scheduleId,
    type,
    state: ['completed', 'failed', 'cancelled', 'canceled'].includes(status) ? 'Final' : 'Scheduled',
    provider: item.provider || metadata.provider || 'twilio',
    phoneNumber,
    contactCount,
    displayTarget: type === 'single' ? (phoneNumber || '-') : `${contactCount || numbers.length || 0} contacts`,
    campaignName: item.campaignName || metadata.campaignName || 'Untitled Schedule',
    campaignId: item.campaignId || metadata.campaignId || '',
    workflowId: item.workflowId || metadata.workflowId || '',
    scheduledAt: item.scheduledAt || metadata.scheduledAt || item.createdAt,
    nextRunAt: item.nextRunAt || null,
    updatedAt: item.updatedAt || item.createdAt,
    recurrence: item.recurrence || 'once',
    allowedWindow: item.allowedWindow || metadata.allowedWindow || null
  };
};
