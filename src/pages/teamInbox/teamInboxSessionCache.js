const TEAM_INBOX_CACHE_VERSION = 1;
const TEAM_INBOX_CACHE_PREFIX = 'team-inbox-cache';

const TEAM_INBOX_BOOTSTRAP_TTL_MS = 30 * 60 * 1000;
const TEAM_INBOX_THREAD_TTL_MS = 15 * 60 * 1000;
const TEAM_INBOX_MAX_CONVERSATIONS = 150;
const TEAM_INBOX_MAX_CONTACT_NAMES = 500;
const TEAM_INBOX_MAX_THREADS = 12;
const TEAM_INBOX_MAX_MESSAGES_PER_THREAD = 40;

const runtimeBootstrapCache = new Map();
const runtimeThreadCache = new Map();

const toTrimmedString = (value) => String(value || '').trim();

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseStoredEntry = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const getLocalStorageCandidate = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const probeKey = '__team_inbox_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
};

const getSessionStorageCandidate = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.sessionStorage;
    const probeKey = '__team_inbox_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
};

const getAvailableStorage = () => getLocalStorageCandidate() || getSessionStorageCandidate();

const buildBootstrapCacheKey = (currentUserId) => {
  const normalizedUserId = toTrimmedString(currentUserId);
  if (!normalizedUserId) return '';
  return [
    TEAM_INBOX_CACHE_PREFIX,
    `v${TEAM_INBOX_CACHE_VERSION}`,
    normalizedUserId,
    'bootstrap'
  ].join(':');
};

const buildThreadCacheKey = (currentUserId) => {
  const normalizedUserId = toTrimmedString(currentUserId);
  if (!normalizedUserId) return '';
  return [
    TEAM_INBOX_CACHE_PREFIX,
    `v${TEAM_INBOX_CACHE_VERSION}`,
    normalizedUserId,
    'threads'
  ].join(':');
};

const isUnsafeUrl = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized.startsWith('blob:') || normalized.startsWith('data:');
};

const sanitizeUrl = (value) => {
  const normalized = toTrimmedString(value);
  if (!normalized || isUnsafeUrl(normalized)) return '';
  return normalized;
};

const pickString = (value) => {
  const normalized = toTrimmedString(value);
  return normalized || '';
};

const sanitizeAttachment = (attachment = {}) => {
  if (!attachment || typeof attachment !== 'object') return null;
  const nextAttachment = {
    publicId: pickString(attachment.publicId),
    originalFileName: pickString(attachment.originalFileName),
    fileName: pickString(attachment.fileName),
    fileCategory: pickString(attachment.fileCategory),
    mimeType: pickString(attachment.mimeType),
    extension: pickString(attachment.extension),
    url: sanitizeUrl(attachment.url),
    thumbnailUrl: sanitizeUrl(attachment.thumbnailUrl),
    fileSize:
      Number.isFinite(Number(attachment.fileSize)) && Number(attachment.fileSize) >= 0
        ? Number(attachment.fileSize)
        : 0
  };

  if (!Object.values(nextAttachment).some(Boolean)) return null;
  return nextAttachment;
};

const sanitizeReplyMessage = (message = {}) => {
  if (!message || typeof message !== 'object') return null;

  const messageId = pickString(message._id || message.id || message.whatsappMessageId);
  if (!messageId || messageId.startsWith('temp-')) return null;

  return {
    _id: pickString(message._id || message.id),
    whatsappMessageId: pickString(message.whatsappMessageId),
    sender: pickString(message.sender),
    senderName: pickString(message.senderName),
    text: pickString(message.text),
    status: pickString(message.status),
    timestamp: pickString(message.timestamp),
    whatsappTimestamp: pickString(message.whatsappTimestamp),
    createdAt: pickString(message.createdAt),
    mediaType: pickString(message.mediaType),
    mediaCaption: pickString(message.mediaCaption),
    mediaUrl: sanitizeUrl(message.mediaUrl),
    rawMessageType: pickString(message.rawMessageType),
    attachmentDeleted: Boolean(message.attachmentDeleted),
    attachment: sanitizeAttachment(message.attachment)
  };
};

export const sanitizeTeamInboxMessageForCache = (message = {}) => {
  if (!message || typeof message !== 'object') return null;

  const normalizedId = pickString(message._id || message.id || message.whatsappMessageId);
  if (!normalizedId || normalizedId.startsWith('temp-')) return null;

  return {
    _id: pickString(message._id || message.id),
    whatsappMessageId: pickString(message.whatsappMessageId),
    conversationId: pickString(message.conversationId),
    sender: pickString(message.sender),
    senderName: pickString(message.senderName),
    text: pickString(message.text),
    status: pickString(message.status),
    timestamp: pickString(message.timestamp),
    whatsappTimestamp: pickString(message.whatsappTimestamp),
    createdAt: pickString(message.createdAt),
    mediaType: pickString(message.mediaType),
    mediaCaption: pickString(message.mediaCaption),
    mediaUrl: sanitizeUrl(message.mediaUrl),
    rawMessageType: pickString(message.rawMessageType),
    errorMessage: pickString(message.errorMessage),
    reaction: pickString(message.reaction),
    replyToMessageId: pickString(message.replyToMessageId),
    whatsappContextMessageId: pickString(message.whatsappContextMessageId),
    attachmentDeleted: Boolean(message.attachmentDeleted),
    attachment: sanitizeAttachment(message.attachment),
    replyTo: sanitizeReplyMessage(message.replyTo)
  };
};

const sanitizeContact = (contact = {}) => {
  if (!contact || typeof contact !== 'object') return null;

  return {
    _id: pickString(contact._id || contact.id),
    id: pickString(contact.id),
    name: pickString(contact.name),
    phone: pickString(contact.phone),
    email: pickString(contact.email),
    status: pickString(contact.status),
    stage: pickString(contact.stage),
    leadScore:
      Number.isFinite(Number(contact.leadScore)) && Number(contact.leadScore) >= 0
        ? Number(contact.leadScore)
        : 0,
    tags: Array.isArray(contact.tags)
      ? contact.tags.map((tag) => pickString(tag)).filter(Boolean).slice(0, 20)
      : [],
    customFields:
      contact.customFields && typeof contact.customFields === 'object'
        ? {
            stage: pickString(contact.customFields.stage)
          }
        : {}
  };
};

const sanitizeConversationForCache = (conversation = {}) => {
  if (!conversation || typeof conversation !== 'object') return null;

  const conversationId = pickString(conversation._id || conversation.id);
  if (!conversationId) return null;

  return {
    _id: conversationId,
    id: pickString(conversation.id),
    contactName: pickString(conversation.contactName),
    contactPhone: pickString(conversation.contactPhone),
    lastMessage: pickString(conversation.lastMessage),
    lastMessageTime: pickString(conversation.lastMessageTime),
    lastMessageFrom: pickString(conversation.lastMessageFrom),
    lastMessageMediaType: pickString(conversation.lastMessageMediaType),
    lastMessagePreviewText: pickString(conversation.lastMessagePreviewText),
    lastMessageAttachmentName: pickString(conversation.lastMessageAttachmentName),
    lastMessageAttachmentPages:
      Number.isFinite(Number(conversation.lastMessageAttachmentPages)) &&
      Number(conversation.lastMessageAttachmentPages) >= 0
        ? Number(conversation.lastMessageAttachmentPages)
        : 0,
    unreadCount:
      Number.isFinite(Number(conversation.unreadCount)) && Number(conversation.unreadCount) >= 0
        ? Number(conversation.unreadCount)
        : 0,
    leadScore:
      Number.isFinite(Number(conversation.leadScore)) && Number(conversation.leadScore) >= 0
        ? Number(conversation.leadScore)
        : 0,
    contactId: sanitizeContact(conversation.contactId)
  };
};

const sanitizeContactNameMap = (contactNameMap = {}) => {
  const entries = Object.entries(
    contactNameMap && typeof contactNameMap === 'object' ? contactNameMap : {}
  )
    .map(([key, value]) => [pickString(key), pickString(value)])
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .slice(0, TEAM_INBOX_MAX_CONTACT_NAMES);

  return Object.fromEntries(entries);
};

const normalizeBootstrapEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  return {
    updatedAt: toPositiveNumber(entry.updatedAt, Date.now()),
    expiresAt: toPositiveNumber(entry.expiresAt, Date.now()),
    conversations: Array.isArray(entry.conversations) ? entry.conversations : [],
    contactNameMap:
      entry.contactNameMap && typeof entry.contactNameMap === 'object'
        ? entry.contactNameMap
        : {}
  };
};

const normalizeThreadBucket = (bucket) => {
  if (!bucket || typeof bucket !== 'object') return null;
  return {
    updatedAt: toPositiveNumber(bucket.updatedAt, Date.now()),
    expiresAt: toPositiveNumber(bucket.expiresAt, Date.now()),
    threads:
      bucket.threads && typeof bucket.threads === 'object' && !Array.isArray(bucket.threads)
        ? bucket.threads
        : {}
  };
};

export const readTeamInboxBootstrapCache = ({
  currentUserId,
  allowStale = true
} = {}) => {
  const cacheKey = buildBootstrapCacheKey(currentUserId);
  if (!cacheKey) return null;

  const now = Date.now();
  const runtimeEntry = normalizeBootstrapEntry(runtimeBootstrapCache.get(cacheKey));
  if (runtimeEntry) {
    const isStale = runtimeEntry.expiresAt <= now;
    if (!isStale || allowStale) {
      return { ...runtimeEntry, isStale };
    }
    runtimeBootstrapCache.delete(cacheKey);
  }

  const storage = getAvailableStorage();
  if (!storage) return null;

  const storedEntry = normalizeBootstrapEntry(parseStoredEntry(storage.getItem(cacheKey)));
  if (!storedEntry) return null;
  runtimeBootstrapCache.set(cacheKey, storedEntry);

  const isStale = storedEntry.expiresAt <= now;
  if (isStale && !allowStale) {
    runtimeBootstrapCache.delete(cacheKey);
    storage.removeItem(cacheKey);
    return null;
  }

  return { ...storedEntry, isStale };
};

export const writeTeamInboxBootstrapCache = ({
  currentUserId,
  conversations = [],
  contactNameMap = {}
} = {}) => {
  const cacheKey = buildBootstrapCacheKey(currentUserId);
  if (!cacheKey) return null;

  const nextEntry = {
    updatedAt: Date.now(),
    expiresAt: Date.now() + TEAM_INBOX_BOOTSTRAP_TTL_MS,
    conversations: (Array.isArray(conversations) ? conversations : [])
      .map(sanitizeConversationForCache)
      .filter(Boolean)
      .slice(0, TEAM_INBOX_MAX_CONVERSATIONS),
    contactNameMap: sanitizeContactNameMap(contactNameMap)
  };

  runtimeBootstrapCache.set(cacheKey, nextEntry);
  const storage = getAvailableStorage();
  if (storage) {
    try {
      storage.setItem(cacheKey, JSON.stringify(nextEntry));
    } catch (error) {
      console.warn('Failed to persist Team Inbox bootstrap cache:', error);
    }
  }

  return nextEntry;
};

export const clearTeamInboxBootstrapCache = ({ currentUserId } = {}) => {
  const cacheKey = buildBootstrapCacheKey(currentUserId);
  if (!cacheKey) return false;

  runtimeBootstrapCache.delete(cacheKey);
  const storage = getAvailableStorage();
  if (storage) {
    try {
      storage.removeItem(cacheKey);
    } catch (error) {
      console.warn('Failed to clear Team Inbox bootstrap cache:', error);
    }
  }

  return true;
};

const sanitizeMessagePageMeta = (meta = {}) => ({
  limit: Math.max(1, Math.min(toPositiveNumber(meta.limit, TEAM_INBOX_MAX_MESSAGES_PER_THREAD), 80)),
  hasMore: Boolean(meta.hasMore),
  nextCursor: pickString(meta.nextCursor) || null
});

export const readTeamInboxThreadCache = ({
  currentUserId,
  conversationId,
  allowStale = true
} = {}) => {
  const normalizedConversationId = pickString(conversationId);
  const cacheKey = buildThreadCacheKey(currentUserId);
  if (!cacheKey || !normalizedConversationId) return null;

  const now = Date.now();
  const runtimeBucket = normalizeThreadBucket(runtimeThreadCache.get(cacheKey));
  const runtimeEntry = runtimeBucket?.threads?.[normalizedConversationId] || null;
  if (runtimeEntry) {
    const isStale = toPositiveNumber(runtimeEntry.expiresAt, 0) <= now;
    if (!isStale || allowStale) {
      return {
        updatedAt: toPositiveNumber(runtimeEntry.updatedAt, now),
        expiresAt: toPositiveNumber(runtimeEntry.expiresAt, now),
        messages: Array.isArray(runtimeEntry.messages) ? runtimeEntry.messages : [],
        meta: sanitizeMessagePageMeta(runtimeEntry.meta),
        isStale
      };
    }
  }

  const storage = getAvailableStorage();
  if (!storage) return null;

  const storedBucket = normalizeThreadBucket(parseStoredEntry(storage.getItem(cacheKey)));
  if (!storedBucket) return null;
  runtimeThreadCache.set(cacheKey, storedBucket);

  const storedEntry = storedBucket.threads?.[normalizedConversationId] || null;
  if (!storedEntry) return null;

  const isStale = toPositiveNumber(storedEntry.expiresAt, 0) <= now;
  if (isStale && !allowStale) {
    return null;
  }

  return {
    updatedAt: toPositiveNumber(storedEntry.updatedAt, now),
    expiresAt: toPositiveNumber(storedEntry.expiresAt, now),
    messages: Array.isArray(storedEntry.messages) ? storedEntry.messages : [],
    meta: sanitizeMessagePageMeta(storedEntry.meta),
    isStale
  };
};

export const writeTeamInboxThreadCache = ({
  currentUserId,
  conversationId,
  messages = [],
  meta = {}
} = {}) => {
  const normalizedConversationId = pickString(conversationId);
  const cacheKey = buildThreadCacheKey(currentUserId);
  if (!cacheKey || !normalizedConversationId) return null;

  const now = Date.now();
  const storage = getAvailableStorage();
  const existingBucket =
    normalizeThreadBucket(runtimeThreadCache.get(cacheKey)) ||
    normalizeThreadBucket(parseStoredEntry(storage?.getItem(cacheKey))) || {
      updatedAt: now,
      expiresAt: now + TEAM_INBOX_THREAD_TTL_MS,
      threads: {}
    };

  const nextThreads = {
    ...(existingBucket.threads || {}),
    [normalizedConversationId]: {
      updatedAt: now,
      expiresAt: now + TEAM_INBOX_THREAD_TTL_MS,
      messages: (Array.isArray(messages) ? messages : [])
        .map(sanitizeTeamInboxMessageForCache)
        .filter(Boolean)
        .slice(-TEAM_INBOX_MAX_MESSAGES_PER_THREAD),
      meta: sanitizeMessagePageMeta(meta)
    }
  };

  const prunedEntries = Object.entries(nextThreads)
    .sort(
      (left, right) =>
        toPositiveNumber(right?.[1]?.updatedAt, 0) - toPositiveNumber(left?.[1]?.updatedAt, 0)
    )
    .slice(0, TEAM_INBOX_MAX_THREADS);

  const nextBucket = {
    updatedAt: now,
    expiresAt: now + TEAM_INBOX_THREAD_TTL_MS,
    threads: Object.fromEntries(prunedEntries)
  };

  runtimeThreadCache.set(cacheKey, nextBucket);

  if (storage) {
    try {
      storage.setItem(cacheKey, JSON.stringify(nextBucket));
    } catch (error) {
      console.warn('Failed to persist Team Inbox thread cache:', error);
    }
  }

  return nextBucket.threads[normalizedConversationId];
};

export const clearTeamInboxThreadCache = ({
  currentUserId,
  conversationId
} = {}) => {
  const cacheKey = buildThreadCacheKey(currentUserId);
  if (!cacheKey) return false;

  const normalizedConversationId = pickString(conversationId);
  if (!normalizedConversationId) {
    runtimeThreadCache.delete(cacheKey);
    const storage = getAvailableStorage();
    if (storage) {
      try {
        storage.removeItem(cacheKey);
      } catch (error) {
        console.warn('Failed to clear Team Inbox thread cache:', error);
      }
    }
    return true;
  }

  const storage = getAvailableStorage();
  const existingBucket =
    normalizeThreadBucket(runtimeThreadCache.get(cacheKey)) ||
    normalizeThreadBucket(parseStoredEntry(storage?.getItem(cacheKey)));
  if (!existingBucket) return false;

  const nextThreads = { ...(existingBucket.threads || {}) };
  delete nextThreads[normalizedConversationId];

  const nextBucket = {
    updatedAt: Date.now(),
    expiresAt: Date.now() + TEAM_INBOX_THREAD_TTL_MS,
    threads: nextThreads
  };

  runtimeThreadCache.set(cacheKey, nextBucket);
  if (storage) {
    try {
      storage.setItem(cacheKey, JSON.stringify(nextBucket));
    } catch (error) {
      console.warn('Failed to update Team Inbox thread cache:', error);
    }
  }

  return true;
};
