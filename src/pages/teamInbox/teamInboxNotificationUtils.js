import logo from '../../assets/logo.png';

export const TEAM_INBOX_NOTIFICATION_OPEN_EVENT = 'teamInbox:openConversationFromNotification';
export const TEAM_INBOX_NOTIFICATION_MODE_STORAGE_KEY = 'teamInboxNotificationMode';
export const TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT =
  'teamInbox:notificationModeChanged';
export const TEAM_INBOX_NOTIFICATION_MODES = Object.freeze({
  NOTIFICATION: 'notification',
  SILENT: 'silent',
  OFF: 'off'
});
const LEGACY_SILENT_NOTIFICATIONS_STORAGE_KEY = 'teamInboxSilentNotificationsEnabled';
const DEFAULT_NOTIFICATION_MODE = TEAM_INBOX_NOTIFICATION_MODES.SILENT;

const MEDIA_NOTIFICATION_LABELS = {
  image: 'Photo',
  video: 'Video',
  audio: 'Voice message',
  document: 'Document'
};

const isPlaceholderMediaText = (text, mediaType) => {
  const normalizedText = String(text || '').trim();
  const normalizedMediaType = String(mediaType || '').trim().toLowerCase();
  if (!normalizedMediaType) return false;
  return (
    normalizedText ===
    `[${normalizedMediaType.charAt(0).toUpperCase()}${normalizedMediaType.slice(1)}]`
  );
};

const getIncomingMessagePreviewText = (message = {}) => {
  const mediaType = String(message?.mediaType || '').trim().toLowerCase();
  const text = String(message?.text || '').trim();
  const hasAttachment =
    Boolean(message?.mediaUrl) ||
    Boolean(message?.attachment?.publicId) ||
    Boolean(message?.attachment?.originalFileName);

  if (text && !(hasAttachment && isPlaceholderMediaText(text, mediaType))) {
    return text;
  }

  const attachmentName = String(
    message?.attachment?.originalFileName || message?.mediaCaption || ''
  ).trim();

  if (attachmentName && mediaType === 'document') {
    return attachmentName;
  }

  return MEDIA_NOTIFICATION_LABELS[mediaType] || text || 'New message';
};

const getConversationDisplayName = (conversation = {}) =>
  String(conversation?.contactId?.name || conversation?.contactName || conversation?.contactPhone || '')
    .trim() || 'New message';

const buildInboxConversationPath = (conversationId) => {
  const nextConversationId = String(conversationId || '').trim();
  if (!nextConversationId || typeof window === 'undefined') {
    return '/inbox';
  }

  const currentPath = String(window.location.pathname || '').trim();
  const basePath = currentPath.includes('/inbox')
    ? currentPath.slice(0, currentPath.indexOf('/inbox'))
    : '';

  return `${basePath}/inbox/${nextConversationId}`;
};

const normalizeNotificationMode = (value) => {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  if (Object.values(TEAM_INBOX_NOTIFICATION_MODES).includes(normalizedValue)) {
    return normalizedValue;
  }

  if (value === true || normalizedValue === 'true') {
    return TEAM_INBOX_NOTIFICATION_MODES.SILENT;
  }

  if (value === false || normalizedValue === 'false') {
    return TEAM_INBOX_NOTIFICATION_MODES.NOTIFICATION;
  }

  return DEFAULT_NOTIFICATION_MODE;
};

export const getTeamInboxNotificationMode = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_NOTIFICATION_MODE;
  }

  try {
    const storedMode = localStorage.getItem(TEAM_INBOX_NOTIFICATION_MODE_STORAGE_KEY);
    if (storedMode !== null) {
      return normalizeNotificationMode(storedMode);
    }

    const legacySilentValue = localStorage.getItem(LEGACY_SILENT_NOTIFICATIONS_STORAGE_KEY);
    if (legacySilentValue !== null) {
      return normalizeNotificationMode(legacySilentValue);
    }

    return DEFAULT_NOTIFICATION_MODE;
  } catch {
    return DEFAULT_NOTIFICATION_MODE;
  }
};

export const setTeamInboxNotificationMode = (value) => {
  const nextMode = normalizeNotificationMode(value);

  try {
    localStorage.setItem(TEAM_INBOX_NOTIFICATION_MODE_STORAGE_KEY, nextMode);
    localStorage.removeItem(LEGACY_SILENT_NOTIFICATIONS_STORAGE_KEY);
  } catch {
    // Ignore localStorage write failures.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT, {
        detail: { mode: nextMode }
      })
    );
  }

  return nextMode;
};

export const requestTeamInboxNotificationPermission = async ({
  requireUserActivation = false
} = {}) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  if (
    requireUserActivation &&
    typeof navigator !== 'undefined' &&
    navigator.userActivation &&
    !navigator.userActivation.isActive
  ) {
    return 'default';
  }

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error('Failed to request Team Inbox notification permission:', error);
    return Notification.permission;
  }
};

export const showIncomingMessageSystemNotification = async ({
  message,
  conversation,
  isSelectedConversation = false,
  mode = DEFAULT_NOTIFICATION_MODE
} = {}) => {
  const notificationMode = normalizeNotificationMode(mode);
  if (notificationMode === TEAM_INBOX_NOTIFICATION_MODES.OFF) {
    return false;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (!('Notification' in window)) {
    return false;
  }

  const isIncomingContactMessage = String(message?.sender || '').trim().toLowerCase() === 'contact';
  if (!isIncomingContactMessage) {
    return false;
  }

  const pageIsVisible = document.visibilityState === 'visible' && document.hasFocus();
  if (pageIsVisible && isSelectedConversation) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    return false;
  }

  if (permission !== 'granted') {
    return false;
  }

  const conversationId = String(conversation?._id || message?.conversationId || '').trim();
  const targetPath = buildInboxConversationPath(conversationId);
  const notification = new Notification(getConversationDisplayName(conversation), {
    body: getIncomingMessagePreviewText(message),
    icon: logo,
    badge: logo,
    tag: String(message?._id || message?.whatsappMessageId || conversationId || Date.now()),
    renotify: true,
    silent: notificationMode === TEAM_INBOX_NOTIFICATION_MODES.SILENT
  });

  notification.onclick = () => {
    try {
      window.focus();
    } catch (error) {
      console.error('Failed to focus window from Team Inbox notification:', error);
    }

    if (conversationId) {
      window.dispatchEvent(
        new CustomEvent(TEAM_INBOX_NOTIFICATION_OPEN_EVENT, {
          detail: {
            conversationId,
            path: targetPath
          }
        })
      );

      window.setTimeout(() => {
        if (window.location.pathname !== targetPath) {
          window.location.assign(targetPath);
        }
      }, 120);
    }

    notification.close();
  };

  return true;
};
