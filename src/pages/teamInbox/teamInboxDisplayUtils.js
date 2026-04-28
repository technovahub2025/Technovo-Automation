import { doesConversationMatchSearch } from './teamInboxIdentityUtils.js';

const conversationMediaLabels = {
  image: 'Photo',
  video: 'Video',
  audio: 'Voice message',
  document: 'Document'
};

const formatConversationDocumentPreviewText = (conversation = {}, rawText = '') => {
  const attachmentName = String(conversation?.lastMessageAttachmentName || '').trim();
  const pageCount = Number(conversation?.lastMessageAttachmentPages || 0);
  const pagesLabel =
    Number.isFinite(pageCount) && pageCount > 0
      ? ` \u2022 ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`
      : '';

  if (attachmentName) {
    return `${attachmentName}${pagesLabel}`;
  }

  return rawText;
};

const conversationMediaPlaceholders = {
  image: new Set(['[image]', 'image', '[photo]', 'photo']),
  video: new Set(['[video]', 'video']),
  audio: new Set(['[audio]', 'audio', '[voice message]', 'voice message']),
  document: new Set(['[document]', 'document', '[file]', 'file', '[attachment]', 'attachment'])
};

const inferConversationMediaType = (conversation = {}) => {
  const explicitType = String(conversation?.lastMessageMediaType || '')
    .trim()
    .toLowerCase();
  if (explicitType && conversationMediaLabels[explicitType]) {
    return explicitType;
  }

  const normalizedText = String(conversation?.lastMessage || '')
    .trim()
    .toLowerCase();
  if (!normalizedText) return '';

  if (conversationMediaPlaceholders.image.has(normalizedText)) return 'image';
  if (conversationMediaPlaceholders.video.has(normalizedText)) return 'video';
  if (conversationMediaPlaceholders.audio.has(normalizedText)) return 'audio';
  if (conversationMediaPlaceholders.document.has(normalizedText)) return 'document';
  return '';
};

export const getConversationPreviewMeta = (conversation = {}) => {
  const mediaType = inferConversationMediaType(conversation);
  const rawText = String(conversation?.lastMessage || '').trim();
  const normalizedRawText = rawText.toLowerCase();
  const isPlaceholderMediaText = Boolean(
    mediaType && conversationMediaPlaceholders[mediaType]?.has(normalizedRawText)
  );
  const defaultPreviewText =
    mediaType && (!rawText || isPlaceholderMediaText)
      ? conversationMediaLabels[mediaType] || rawText
      : rawText;
  const previewText =
    mediaType === 'document'
      ? formatConversationDocumentPreviewText(conversation, defaultPreviewText)
      : defaultPreviewText;

  return {
    mediaType,
    isMedia: Boolean(mediaType),
    showStatusIcon: String(conversation?.lastMessageFrom || '').trim().toLowerCase() === 'agent',
    previewText
  };
};

const toCleanString = (value) => String(value || '').trim();

const pickFirstLabel = (...values) => {
  for (const value of values) {
    const normalized = toCleanString(value);
    if (normalized) return normalized;
  }
  return '';
};

export const resolveConversationAssigneeLabel = (conversation = {}) => {
  const directAssignee = conversation?.assignedTo;
  const owner = conversation?.owner;

  const label = pickFirstLabel(
    conversation?.assignedToName,
    conversation?.assigneeName,
    conversation?.ownerName,
    conversation?.assignedAgentName,
    directAssignee?.name,
    directAssignee?.fullName,
    directAssignee?.email,
    owner?.name,
    owner?.fullName,
    owner?.email
  );

  return label || 'Unassigned';
};

const getSlaDueAtValue = (conversation = {}) =>
  pickFirstLabel(
    conversation?.slaDueAt,
    conversation?.slaDeadlineAt,
    conversation?.slaDeadline,
    conversation?.nextReplyDueAt
  );

export const resolveConversationSlaMeta = (conversation = {}) => {
  const explicitStatus = toCleanString(
    conversation?.slaStatus || conversation?.slaState || conversation?.responseSlaStatus
  ).toLowerCase();

  const isBreachedFlag =
    conversation?.slaBreached === true ||
    conversation?.isSlaBreached === true ||
    conversation?.responseSlaBreached === true;

  if (isBreachedFlag || explicitStatus === 'breached' || explicitStatus === 'overdue') {
    return { label: 'SLA Breached', tone: 'breached' };
  }

  if (explicitStatus === 'at_risk' || explicitStatus === 'warning') {
    return { label: 'SLA At Risk', tone: 'warning' };
  }

  if (explicitStatus === 'ok' || explicitStatus === 'healthy' || explicitStatus === 'on_track') {
    return { label: 'SLA Healthy', tone: 'healthy' };
  }

  const dueAtRaw = getSlaDueAtValue(conversation);
  if (!dueAtRaw) return { label: '', tone: '' };

  const dueAt = new Date(dueAtRaw);
  if (Number.isNaN(dueAt.getTime())) return { label: '', tone: '' };

  const diffMs = dueAt.getTime() - Date.now();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes <= 0) {
    return { label: 'SLA Breached', tone: 'breached' };
  }
  if (diffMinutes <= 30) {
    return { label: 'SLA At Risk', tone: 'warning' };
  }
  return { label: 'SLA Healthy', tone: 'healthy' };
};

export const formatConversationTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
};

export const formatDateLabel = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const filterConversations = ({
  conversations,
  searchTerm,
  conversationFilter,
  getUnreadCount,
  getConversationDisplayName
}) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];

  return safeConversations
    .filter((conversation) =>
      doesConversationMatchSearch({
        conversation,
        searchTerm,
        getConversationDisplayName
      })
    )
    .filter((conversation) => {
      if (conversationFilter === 'unread') return getUnreadCount(conversation) > 0;
      if (conversationFilter === 'read') return getUnreadCount(conversation) === 0;
      return true;
    });
};

export const buildGroupedMessages = (messages) => {
  const groupedMessages = [];
  let lastDateKey = '';

  const visibleMessages = (Array.isArray(messages) ? messages : []).filter(
    (message) => String(message?.rawMessageType || '').trim().toLowerCase() !== 'reaction'
  );

  visibleMessages.forEach((message, index) => {
    const timestamp = message.timestamp || message.whatsappTimestamp || message.createdAt;
    const date = new Date(timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (key !== lastDateKey) {
      groupedMessages.push({
        type: 'separator',
        key: `sep-${key}-${index}`,
        label: formatDateLabel(timestamp)
      });
      lastDateKey = key;
    }

    groupedMessages.push({
      type: 'message',
      key: message._id || `msg-${index}`,
      message,
      index
    });
  });

  return groupedMessages;
};

export const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getMessageKey = (message, index) =>
  message?._id || message?.whatsappMessageId || `tmp-${index}`;
