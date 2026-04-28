import { getConversationPreviewMeta } from './teamInboxDisplayUtils.js';
import {
  getMappedContactName,
  getPhoneLookupKeys,
  isRealName,
  normalizePhone
} from './teamInboxIdentityUtils.js';

export { normalizePhone, getPhoneLookupKeys, isRealName, getMappedContactName };

export const getUnreadCount = (conversation) => {
  const value =
    conversation?.unreadCount ??
    conversation?.unread_count ??
    conversation?.unread ??
    conversation?.unread_messages ??
    conversation?.unreadMessagesCount ??
    conversation?.unread_message_count ??
    conversation?.unreadMessages ??
    0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const normalizeConversation = (conversation) => {
  const previewMeta = getConversationPreviewMeta(conversation);
  return {
    ...conversation,
    unreadCount: getUnreadCount(conversation),
    lastMessageMediaType:
      previewMeta.mediaType || String(conversation?.lastMessageMediaType || '').trim(),
    lastMessagePreviewText: previewMeta.previewText
  };
};

export const getContactName = (conversation) =>
  String(conversation?.contactId?.name || conversation?.contactName || '').trim();

export const hasRealContactName = (conversation) => {
  const name = getContactName(conversation);
  return isRealName(name);
};

export const getConversationDisplayName = (conversation, contactNameMap = {}) => {
  const name = getContactName(conversation);
  if (hasRealContactName(conversation)) return name;
  const mappedName = getMappedContactName(conversation?.contactPhone, contactNameMap);
  return mappedName || conversation?.contactPhone || name || 'Unknown';
};

export const getContactIdValue = (conversation) =>
  String(
    conversation?.contactId?._id ||
      conversation?.contactId?.id ||
      conversation?.contactId ||
      ''
  );

export const enrichConversationIdentity = (conversation, sources = [], contactNameMap = {}) => {
  const base = normalizeConversation(conversation || {});
  if (hasRealContactName(base)) return base;

  const basePhone = normalizePhone(base?.contactPhone);
  const baseContactId = getContactIdValue(base);
  const candidate = sources.find((item) => {
    if (!item || !hasRealContactName(item)) return false;
    const itemPhone = normalizePhone(item?.contactPhone);
    const itemContactId = getContactIdValue(item);
    if (basePhone && itemPhone && basePhone === itemPhone) return true;
    if (baseContactId && itemContactId && baseContactId === itemContactId) return true;
    return false;
  });

  const mappedName = getMappedContactName(base?.contactPhone, contactNameMap);
  if (!candidate) {
    if (!mappedName) return base;
    const mergedContact = {
      ...(base?.contactId && typeof base.contactId === 'object' ? base.contactId : {}),
      name: mappedName
    };
    return normalizeConversation({
      ...base,
      contactId: mergedContact,
      contactName: mappedName
    });
  }

  const mergedContact = {
    ...(candidate?.contactId && typeof candidate.contactId === 'object' ? candidate.contactId : {}),
    ...(base?.contactId && typeof base.contactId === 'object' ? base.contactId : {}),
    name: getContactName(base) || getContactName(candidate) || mappedName
  };

  return normalizeConversation({
    ...candidate,
    ...base,
    contactId: mergedContact,
    contactName: getContactName(base) || getContactName(candidate) || mappedName,
    contactPhone: base?.contactPhone || candidate?.contactPhone
  });
};

export const getConversationAvatarText = (conversation, contactNameMap = {}) => {
  const name = String(getConversationDisplayName(conversation, contactNameMap) || '').trim();
  const phone = String(conversation?.contactPhone || '').trim();

  if (isRealName(name)) return name.charAt(0).toUpperCase();
  if (phone) return 'UN';
  return '?';
};

export const toSafeNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed < 0 ? fallback : parsed;
};

export const getConversationIdValue = (conversation) =>
  String(conversation?._id || conversation?.id || '').trim();

export const leadStageOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'nurturing', label: 'Nurturing' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
];

export const toDateTimeLocalInputValue = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offsetMilliseconds = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
};

export const toIsoFromDateTimeLocalInput = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export const formatDateTimeForActivity = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

export const applyLeadScoreUpdateToConversation = (conversation, payload = {}) => {
  if (!conversation) return conversation;

  const eventConversationId = String(payload?.conversationId || '');
  const eventContactId = String(payload?.contactId || '');
  const conversationIdValue = String(conversation?._id || '');
  const contactIdValue = String(
    conversation?.contactId?._id ||
      conversation?.contactId?.id ||
      conversation?.contactId ||
      ''
  );

  const isMatch =
    (eventConversationId && eventConversationId === conversationIdValue) ||
    (eventContactId && eventContactId === contactIdValue);

  if (!isMatch) return conversation;

  const nextLeadScore = toSafeNonNegativeNumber(payload?.leadScore, 0);
  const currentContact = conversation?.contactId;
  const normalizedContact =
    currentContact && typeof currentContact === 'object' && !Array.isArray(currentContact)
      ? currentContact
      : {};

  return {
    ...conversation,
    leadScore: nextLeadScore,
    contactId: {
      ...normalizedContact,
      leadScore: nextLeadScore,
      leadScoreBreakdown:
        payload?.breakdown ||
        normalizedContact?.leadScoreBreakdown ||
        { read: 0, reply: 0, keyword: 0 }
    }
  };
};

export const getConversationLeadScore = (conversation) =>
  toSafeNonNegativeNumber(conversation?.contactId?.leadScore ?? conversation?.leadScore ?? 0, 0);

export const getContactIdFromConversation = (conversation) =>
  String(
    conversation?.contactId?._id ||
      conversation?.contactId?.id ||
      conversation?.contactId ||
      ''
  ).trim();

export const getContactTagsRaw = (conversation) => {
  const tags = conversation?.contactId?.tags;
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag || '').trim()).filter(Boolean);
};

export const getContactTags = (conversation) =>
  getContactTagsRaw(conversation).map((tag) => tag.toLowerCase());

export const deriveLeadStatus = (conversation) => {
  const normalizedStatus = String(conversation?.contactId?.status || '').trim().toLowerCase();
  if (normalizedStatus === 'qualified') return 'Qualified';
  if (normalizedStatus === 'unqualified') return 'Unqualified';
  if (normalizedStatus === 'won') return 'Won';
  if (normalizedStatus === 'lost') return 'Lost';
  if (normalizedStatus === 'new') return 'New';

  const tags = getContactTags(conversation);
  if (tags.includes('qualified')) return 'Qualified';
  if (tags.includes('unqualified')) return 'Unqualified';
  return 'Nurturing';
};

export const getLeadStageValue = (conversation, stageOptions = leadStageOptions) => {
  const rawStage = String(
    conversation?.contactId?.stage || conversation?.contactId?.customFields?.stage || ''
  )
    .trim()
    .toLowerCase();
  if (stageOptions.some((option) => option.value === rawStage)) return rawStage;
  return 'new';
};

export const getCrmActivityLabel = (activity = {}) => {
  const type = String(activity?.type || '').trim().toLowerCase();
  if (type === 'stage_changed') return 'Stage updated';
  if (type === 'owner_changed') return 'Owner changed';
  if (type === 'status_changed') return 'Status updated';
  if (type === 'note_updated') return 'Notes updated';
  if (type === 'document_uploaded') return 'Document uploaded';
  if (type === 'document_deleted') return 'Document deleted';
  if (type === 'task_created') return 'Task created';
  if (type === 'task_updated') return 'Task updated';
  if (type === 'task_completed') return 'Task completed';
  if (type === 'broadcast_sent') return 'Broadcast sent';
  if (type === 'deal_created') return 'Deal created';
  if (type === 'deal_updated') return 'Deal updated';
  if (type === 'deal_deleted') return 'Deal deleted';
  if (type === 'deal_won') return 'Deal won';
  if (type === 'deal_lost') return 'Deal lost';
  if (type === 'meeting_scheduled') return 'Meeting scheduled';
  if (type === 'owner_notified') return 'Owner notified';
  if (type === 'contact_created') return 'Contact created';
  if (type === 'contact_updated') return 'Contact updated';
  if (type === 'whatsapp_opt_in') return 'WhatsApp opt-in';
  if (type === 'whatsapp_opt_out') return 'WhatsApp opt-out';
  return 'Activity';
};

export const getCrmActivityDescription = (activity = {}) => {
  const type = String(activity?.type || '').trim().toLowerCase();
  const meta = activity?.meta && typeof activity.meta === 'object' ? activity.meta : {};
  if (type === 'stage_changed') {
    const nextStage = String(meta?.nextStage || '').trim();
    return nextStage ? `Moved to ${nextStage}` : 'Lead stage was changed';
  }
  if (type === 'note_updated') return 'Lead note or follow-up was updated';
  if (type === 'document_uploaded') {
    return String(meta?.fileName || meta?.title || '').trim() || 'A CRM document was uploaded';
  }
  if (type === 'document_deleted') {
    return String(meta?.fileName || meta?.title || '').trim() || 'A CRM document was deleted';
  }
  if (type === 'task_created') return String(meta?.title || '').trim() || 'A follow-up task was created';
  if (type === 'task_completed') return String(meta?.nextTask?.title || '').trim() || 'A task was completed';
  if (type === 'task_updated') return String(meta?.nextTask?.title || '').trim() || 'A task was updated';
  if (type === 'broadcast_sent') {
    const broadcastName = String(meta?.broadcastName || '').trim();
    const templateName = String(meta?.templateName || '').trim();
    const preview = String(meta?.messagePreview || '').trim();
    return (
      broadcastName ||
      templateName ||
      preview ||
      'A broadcast campaign message was sent'
    );
  }
  if (type === 'deal_created') return String(meta?.title || '').trim() || 'A new deal was created';
  if (type === 'deal_updated') return String(meta?.nextDeal?.title || '').trim() || 'A deal was updated';
  if (type === 'deal_deleted') return String(meta?.title || '').trim() || 'A deal was deleted';
  if (type === 'deal_won') return String(meta?.nextDeal?.title || '').trim() || 'A deal was marked won';
  if (type === 'deal_lost') return String(meta?.nextDeal?.title || '').trim() || 'A deal was marked lost';
  if (type === 'meeting_scheduled') {
    const summary = String(meta?.summary || '').trim();
    return summary || 'Google Meet link was created for this lead';
  }
  if (type === 'owner_notified') {
    const rule = String(meta?.automationRule || '').trim();
    const owner = String(meta?.ownerId || '').trim();
    return owner
      ? `Notification queued for owner ${owner}${rule ? ` (${rule})` : ''}`
      : 'Owner notification was created';
  }
  if (type === 'whatsapp_opt_in') {
    const source = String(meta?.source || '').trim();
    return source ? `Consent captured (${source})` : 'Consent captured';
  }
  if (type === 'whatsapp_opt_out') {
    const source = String(meta?.source || '').trim();
    return source ? `Opted out (${source})` : 'Contact opted out';
  }
  return 'CRM record updated';
};
