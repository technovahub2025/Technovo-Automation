import { getConversationAssignedLookupId, getConversationPreviewMeta } from './teamInboxDisplayUtils.js';
import {
  getMappedContactName,
  getConversationPhoneValue,
  getPhoneLookupKeys,
  isRealName,
  normalizePhone
} from './teamInboxIdentityUtils.js';
import { DEFAULT_PIPELINE_STAGE_OPTIONS, getPipelineStageLabel } from '../../utils/crmPipelineStages';
import { resolvePreferredMessageStatus } from './replyMessageMergeUtils.js';

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
  const summaryId = String(conversation?.summaryId || conversation?._id || '').trim();
  const contactPhone = getConversationPhoneValue(conversation);
  const contactPhoneDigits = normalizePhone(contactPhone);
  const contactNameLower = String(conversation?.contactId?.name || conversation?.contactName || '')
    .trim()
    .toLowerCase();
  const previewTextLower = String(previewMeta.previewText || '').trim().toLowerCase();
  const lastMessageLower = String(conversation?.lastMessage || '').trim().toLowerCase();
  const contactSnapshot = conversation?.contactId;
  const hasContactOwnerField =
    contactSnapshot && typeof contactSnapshot === 'object'
      ? Object.prototype.hasOwnProperty.call(contactSnapshot, 'ownerId')
      : false;
  const contactOwnerId = hasContactOwnerField ? String(contactSnapshot?.ownerId || '').trim() : '';
  const assignedLower = String(
    hasContactOwnerField && !contactOwnerId
      ? 'Unassigned'
      : contactSnapshot?.ownerName ||
        contactSnapshot?.assignedToName ||
        contactSnapshot?.assignedAgentName ||
        contactSnapshot?.assigneeName ||
        conversation?.assignedToName ||
        conversation?.assignedAgentName ||
        conversation?.assigneeName ||
        conversation?.assignedTo ||
        conversation?.assignedAgent ||
        ''
  )
    .trim()
    .toLowerCase();
  const leadStatusLower = String(conversation?.leadStatus || conversation?.contactId?.leadStatus || '')
    .trim()
    .toLowerCase();
  const leadStageLower = String(conversation?.contactId?.stage || conversation?.contactId?.customFields?.stage || '')
    .trim()
    .toLowerCase();
  const assignedLookupId = String(getConversationAssignedLookupId(conversation) || '').trim();
  const searchParts = [
    summaryId,
    contactNameLower,
    contactPhone,
    contactPhoneDigits,
    previewTextLower,
    lastMessageLower,
    String(
      conversation?.assignedToName ||
        conversation?.assignedAgentName ||
        conversation?.assigneeName ||
        conversation?.contactId?.assignedToName ||
        conversation?.contactId?.assignedAgentName ||
        conversation?.contactId?.assigneeName ||
        conversation?.contactId?.ownerName ||
        ''
    )
      .trim()
      .toLowerCase(),
    assignedLower,
    assignedLookupId,
    leadStatusLower,
    leadStageLower
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  const sidebarSearchText = Array.from(new Set(searchParts)).join(' ');
  const canonicalConversationId = String(
    conversation?.conversationId ||
      conversation?.conversation_id ||
      conversation?.threadConversationId ||
      conversation?._id ||
      conversation?.id ||
      ''
  ).trim();
  return {
    ...conversation,
    ...(summaryId ? { summaryId } : {}),
    _id: canonicalConversationId || String(conversation?._id || '').trim(),
    id: canonicalConversationId || String(conversation?.id || '').trim() || String(conversation?._id || '').trim(),
    contactPhone,
    contactPhoneDigits,
    contactNameLower,
    unreadCount: getUnreadCount(conversation),
    lastMessageMediaType:
      previewMeta.mediaType || String(conversation?.lastMessageMediaType || '').trim(),
    lastMessagePreviewText: previewMeta.previewText,
    sidebarSearchText
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
  const phoneValue = getConversationPhoneValue(conversation);
  const mappedName = getMappedContactName(phoneValue, contactNameMap);
  return mappedName || phoneValue || name || 'Unknown';
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

  const basePhone = normalizePhone(getConversationPhoneValue(base));
  const baseContactId = getContactIdValue(base);
  const candidate = sources.find((item) => {
    if (!item || !hasRealContactName(item)) return false;
    const itemPhone = normalizePhone(getConversationPhoneValue(item));
    const itemContactId = getContactIdValue(item);
    if (basePhone && itemPhone && basePhone === itemPhone) return true;
    if (baseContactId && itemContactId && baseContactId === itemContactId) return true;
    return false;
  });

  const mappedName = getMappedContactName(getConversationPhoneValue(base), contactNameMap);
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
    contactPhone: getConversationPhoneValue(base) || getConversationPhoneValue(candidate)
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
  String(
    conversation?.conversationId ||
      conversation?.conversation_id ||
      conversation?.threadConversationId ||
      conversation?._id ||
      conversation?.id ||
      ''
  ).trim();

export const getConversationIdentityTokens = (conversation) => {
  const safeConversation = conversation || {};
  const tokens = new Set();

  const conversationId = getConversationIdValue(safeConversation);
  if (conversationId) {
    tokens.add(`id:${conversationId}`);
  }

  const contactId = getContactIdValue(safeConversation);
  if (contactId) {
    tokens.add(`contact:${contactId}`);
  }

  getPhoneLookupKeys(getConversationPhoneValue(safeConversation)).forEach((phoneKey) => {
    if (phoneKey) {
      tokens.add(`phone:${phoneKey}`);
    }
  });

  return tokens;
};

export const conversationsShareIdentity = (leftConversation, rightConversation) => {
  if (!leftConversation || !rightConversation) return false;

  const leftTokens = getConversationIdentityTokens(leftConversation);
  if (leftTokens.size === 0) return false;

  const rightTokens = getConversationIdentityTokens(rightConversation);
  if (rightTokens.size === 0) return false;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      return true;
    }
  }

  return false;
};

const pickPreferredPhoneValue = (existingConversation = {}, incomingConversation = {}) => {
  const existingPhone = getConversationPhoneValue(existingConversation);
  const incomingPhone = getConversationPhoneValue(incomingConversation);
  const existingDigits = normalizePhone(existingPhone);
  const incomingDigits = normalizePhone(incomingPhone);

  if (!existingPhone) return incomingPhone || '';
  if (!incomingPhone) return existingPhone;
  if (incomingDigits.length > existingDigits.length) return incomingPhone;
  if (existingDigits.length > incomingDigits.length) return existingPhone;
  return incomingPhone.length >= existingPhone.length ? incomingPhone : existingPhone;
};

export const mergeConversationRecords = (existingConversation = {}, incomingConversation = {}) => {
  const existingSafe = existingConversation || {};
  const incomingSafe = incomingConversation || {};
  const existingId = getConversationIdValue(existingSafe);
  const incomingId = getConversationIdValue(incomingSafe);
  const canonicalId = incomingId || existingId;
  const existingSummaryId = String(existingSafe?.summaryId || '').trim();
  const incomingSummaryId = String(incomingSafe?.summaryId || '').trim();
  const existingPhone = getConversationPhoneValue(existingSafe);
  const incomingPhone = getConversationPhoneValue(incomingSafe);
  const mergedContactId =
    existingSafe?.contactId && typeof existingSafe.contactId === 'object'
      ? { ...existingSafe.contactId }
      : {};
  if (incomingSafe?.contactId && typeof incomingSafe.contactId === 'object') {
    Object.assign(mergedContactId, incomingSafe.contactId);
  }

  const preferredPhone = pickPreferredPhoneValue(existingSafe, incomingSafe);
  const mergedUnreadCount = Math.max(getUnreadCount(existingSafe), getUnreadCount(incomingSafe));
  const mergedLastMessageStatus = resolvePreferredMessageStatus(
    existingSafe?.lastMessageStatus,
    incomingSafe?.lastMessageStatus
  );

  return normalizeConversation({
    ...existingSafe,
    ...incomingSafe,
    ...(incomingSummaryId || existingSummaryId
      ? {
          summaryId:
            incomingSummaryId ||
            existingSummaryId ||
            (existingId && existingId !== canonicalId ? existingId : '')
        }
      : {}),
    _id: canonicalId || existingId || incomingId,
    id: canonicalId || getConversationIdValue(existingSafe) || getConversationIdValue(incomingSafe),
    contactPhone: preferredPhone || existingPhone || incomingPhone,
    contactId:
      Object.keys(mergedContactId).length > 0
        ? mergedContactId
        : incomingSafe?.contactId || existingSafe?.contactId,
    unreadCount: mergedUnreadCount,
    lastMessageStatus: mergedLastMessageStatus || existingSafe?.lastMessageStatus || incomingSafe?.lastMessageStatus,
    lastMessageFrom:
      String(incomingSafe?.lastMessageFrom || '').trim() || String(existingSafe?.lastMessageFrom || '').trim(),
    lastMessageWhatsappMessageId:
      String(incomingSafe?.lastMessageWhatsappMessageId || '').trim() ||
      String(existingSafe?.lastMessageWhatsappMessageId || '').trim()
  });
};

const findConversationMatchIndexes = (conversations = [], incomingConversation = {}) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  if (getConversationIdentityTokens(incomingConversation).size === 0) return [];

  const matches = [];
  safeConversations.forEach((conversation, index) => {
    if (conversationsShareIdentity(conversation, incomingConversation)) {
      matches.push(index);
    }
  });
  return matches;
};

export const getConversationSortTimestamp = (conversation) => {
  const rawTimestamp =
    conversation?.lastMessageTime ||
    conversation?.updatedAt ||
    conversation?.createdAt ||
    conversation?.lastActivityAt ||
    0;
  const parsedTimestamp = new Date(rawTimestamp);
  const numericTimestamp = parsedTimestamp.valueOf();
  return Number.isFinite(numericTimestamp) ? numericTimestamp : 0;
};

export const upsertConversationInOrderedList = (conversations = [], incomingConversation = {}) => {
  const safeConversations = Array.isArray(conversations) ? [...conversations] : [];
  const incomingConversationId = getConversationIdValue(incomingConversation);
  const incomingIdentityTokens = getConversationIdentityTokens(incomingConversation);
  if (!incomingConversationId && incomingIdentityTokens.size === 0) return safeConversations;

  const matchedIndexes = findConversationMatchIndexes(safeConversations, incomingConversation);
  const existingConversation =
    matchedIndexes.length > 0 ? safeConversations[matchedIndexes[0]] || {} : {};
  const mergedConversation = mergeConversationRecords(existingConversation, incomingConversation);

  if (matchedIndexes.length > 0) {
    for (let index = matchedIndexes.length - 1; index >= 0; index -= 1) {
      safeConversations.splice(matchedIndexes[index], 1);
    }
  }

  const incomingTimestamp = getConversationSortTimestamp(mergedConversation);
  let insertIndex = safeConversations.findIndex(
    (conversation) => getConversationSortTimestamp(conversation) < incomingTimestamp
  );
  if (insertIndex < 0) {
    insertIndex = safeConversations.length;
  }

  safeConversations.splice(insertIndex, 0, mergedConversation);
  return safeConversations;
};

export const mergeConversationPageIntoOrderedList = (
  conversations = [],
  incomingConversations = []
) => {
  let nextConversations = Array.isArray(conversations) ? [...conversations] : [];
  (Array.isArray(incomingConversations) ? incomingConversations : []).forEach((conversation) => {
    nextConversations = upsertConversationInOrderedList(nextConversations, conversation);
  });
  return nextConversations;
};

export const patchConversationInOrderedList = (
  conversations = [],
  conversationId = '',
  patch = {}
) => {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) return Array.isArray(conversations) ? [...conversations] : [];

  const nextConversations = Array.isArray(conversations) ? [...conversations] : [];
  const existingIndex = nextConversations.findIndex(
    (conversation) => getConversationIdValue(conversation) === normalizedConversationId
  );
  if (existingIndex < 0) return nextConversations;

  const existingConversation = nextConversations[existingIndex] || {};
  const nextConversation =
    typeof patch === 'function'
      ? patch(existingConversation)
      : mergeConversationRecords(existingConversation, patch);

  nextConversations[existingIndex] = nextConversation;
  return nextConversations;
};

export const removeConversationByIdFromOrderedList = (conversations = [], conversationId = '') => {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) return Array.isArray(conversations) ? [...conversations] : [];

  const nextConversations = Array.isArray(conversations) ? [...conversations] : [];
  const existingIndex = nextConversations.findIndex(
    (conversation) => getConversationIdValue(conversation) === normalizedConversationId
  );
  if (existingIndex < 0) return nextConversations;

  nextConversations.splice(existingIndex, 1);
  return nextConversations;
};

export const patchConversationsByIds = (
  conversations = [],
  conversationIds = [],
  patch = {}
) => {
  const idSet = new Set(
    (Array.isArray(conversationIds) ? conversationIds : [])
      .map((conversationId) => String(conversationId || '').trim())
      .filter(Boolean)
  );
  if (idSet.size === 0) return Array.isArray(conversations) ? [...conversations] : [];

  return (Array.isArray(conversations) ? conversations : []).map((conversation) => {
    const conversationId = getConversationIdValue(conversation);
    if (!idSet.has(conversationId)) return conversation;
    return typeof patch === 'function' ? patch(conversation) : { ...conversation, ...patch };
  });
};

export const dedupeConversationListByIdentity = (conversations = []) => {
  let nextConversations = [];
  (Array.isArray(conversations) ? conversations : []).forEach((conversation) => {
    nextConversations = upsertConversationInOrderedList(nextConversations, conversation);
  });
  return nextConversations;
};

export const leadStageOptions = DEFAULT_PIPELINE_STAGE_OPTIONS.map((stage) => ({
  value: stage.key,
  label: String(stage.label || '').replace(' Lead', '') || getPipelineStageLabel(stage.key)
}));

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
  const explicitLeadStatus = String(
    conversation?.leadStatus ||
      conversation?.contactId?.leadStatus ||
      conversation?.status ||
      ''
  )
    .trim()
    .toLowerCase();
  if (explicitLeadStatus === 'new_lead') return 'New Lead';
  if (explicitLeadStatus === 'interested') return 'Interested';
  if (explicitLeadStatus === 'follow_up') return 'Follow Up';
  if (explicitLeadStatus === 'proposal_sent') return 'Proposal Sent';
  if (explicitLeadStatus === 'converted') return 'Converted';
  if (explicitLeadStatus === 'closed') return 'Closed';

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

export const getLeadStageLabel = (conversation, stageOptions = leadStageOptions) => {
  const stageValue = getLeadStageValue(conversation, stageOptions);
  const matchedStage = (Array.isArray(stageOptions) ? stageOptions : leadStageOptions).find(
    (stage) => String(stage?.value || '').trim().toLowerCase() === stageValue
  );
  return String(matchedStage?.label || getPipelineStageLabel(stageValue)).trim() || 'New Lead';
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
