import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Phone,
  MoreVertical,
  Smile,
  Mic,
  Send,
  Info,
  Reply,
  X,
  Check,
  CheckCheck,
  Paperclip,
  Download,
  Trash2,
  RotateCw,
  ChevronDown,
  Copy,
  Plus,
  FileText,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AttachmentComposerOverlay from './AttachmentComposerOverlay';
import {
  buildAttachmentComposerItemId,
  inferAttachmentComposerMediaType,
  isSupportedAttachmentComposerFile
} from './attachmentComposerUtils';
import {
  formatVoiceRecorderDuration,
  inferVoiceRecorderExtension,
  resolvePreferredVoiceRecorderMimeType
} from './voiceRecorderUtils';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EXTRA_REACTIONS = ['🔥', '👏', '🎉', '🤝', '✅', '💯'];
const IMAGE_PREVIEW_MIN_ZOOM = 0.75;
const IMAGE_PREVIEW_MAX_ZOOM = 3;
const IMAGE_PREVIEW_ZOOM_STEP = 0.25;
const getStatusIcon = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  switch (normalizedStatus) {
    case 'sent':
      return <Check size={16} className="message-status-icon status-sent" />;
    case 'delivered':
      return <CheckCheck size={16} className="message-status-icon status-delivered" />;
    case 'read':
      return <CheckCheck size={16} className="message-status-icon status-read" />;
    case 'failed':
      return <span className="message-status-icon status-failed">x</span>;
    default:
      return null;
  }
};

const isPlaceholderMediaText = (text, mediaType) => {
  const normalizedText = String(text || '').trim();
  const normalizedMediaType = String(mediaType || '').trim().toLowerCase();
  if (!normalizedMediaType) return false;
  return normalizedText === `[${normalizedMediaType.charAt(0).toUpperCase()}${normalizedMediaType.slice(1)}]`;
};

const getMessageDisplayText = (message = {}) => {
  const mediaType = String(message?.mediaType || '').trim();
  const text = String(message?.text || '').trim();
  const hasAttachment =
    Boolean(message?.mediaUrl) ||
    Boolean(message?.attachment?.publicId) ||
    Boolean(message?.attachment?.originalFileName);

  if (text && !(hasAttachment && isPlaceholderMediaText(text, mediaType))) {
    return text;
  }

  if (mediaType) {
    if (String(mediaType).trim().toLowerCase() === 'audio') {
      return '';
    }
    if (hasAttachment) {
      return '';
    }
    const label = mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    return `[${label}]`;
  }

  return '[Unsupported message]';
};

const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
};

const getFileExtension = (message = {}, attachment = {}) => {
  const direct = String(attachment?.extension || '').trim();
  if (direct) return direct.toUpperCase();
  const name = String(attachment?.originalFileName || message?.mediaCaption || '').trim();
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex > -1) return name.slice(dotIndex + 1).toUpperCase();
  const mime = String(attachment?.mimeType || '').trim();
  if (mime.includes('/')) return mime.split('/')[1].toUpperCase();
  return 'FILE';
};

const getMessageReferenceId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value._id || value.id || '').trim();
  }
  return String(value || '').trim();
};

const getMessagePreviewText = (message = {}) => {
  const displayText = getMessageDisplayText(message);
  if (displayText) return displayText;

  const attachmentName = String(
    message?.attachment?.originalFileName || message?.mediaCaption || ''
  ).trim();
  if (attachmentName) return attachmentName;

  const mediaType = String(message?.mediaType || '').trim().toLowerCase();
  switch (mediaType) {
    case 'image':
      return 'Photo';
    case 'document':
      return 'Document';
    case 'audio':
      return 'Voice message';
    case 'video':
      return 'Video';
    default:
      return 'Message';
  }
};

const extractReactionEmoji = (message = {}) => {
  const directEmoji = String(message?.reactionEmoji || '').trim();
  if (directEmoji) return directEmoji;

  const text = String(message?.text || '').trim();
  const prefix = 'Reacted with ';
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim();
  }

  return '';
};

const getMessageStatusLabel = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  switch (normalizedStatus) {
    case 'sending':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'failed':
      return 'Failed';
    default:
      return 'Received';
  }
};

const formatMessageDateTime = (timestamp) => {
  if (!timestamp) return 'Unknown time';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
};

const ChatArea = ({
  selectedConversation,
  messages,
  messagesLoading,
  hasOlderMessages,
  olderMessagesLoading,
  getConversationAvatarText,
  getConversationDisplayName,
  messageMenuRef,
  showMessageSelectMenu,
  showMessageSelectMode,
  selectedMessagesForDeletion,
  groupedMessages,
  chatMessagesRef,
  messagesEndRef,
  messageInputRef,
  messageInput,
  showEmojiPicker,
  emojiPickerRef,
  commonEmojis,
  externalMessageActionFeedback,
  onClearExternalMessageActionFeedback,
  sendingMessage,
  onToggleMessageMenu,
  onToggleMessageSelectMode,
  onDeleteConversation,
  onOpenContactInformation,
  onToggleMessageSelection,
  deleteSelectedMessages,
  onMessageInputChange,
  onSendMessage,
  onReactToMessage,
  onSendAttachment,
  onOpenAttachment,
  onDeleteMessage,
  onRetryAttachment,
  onLoadOlderMessages,
  onToggleEmojiPicker,
  onEmojiInsert,
  getMessageKey,
  formatMessageTime
}) => {
  const messageElementRefs = useRef(new Map());
  const highlightTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const externalFeedbackTimerRef = useRef(null);
  const openMenuRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const olderMessagesScrollAnchorRef = useRef(0);
  const olderMessagesLoadPendingRef = useRef(false);
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');
  const [activeHoverMenuKey, setActiveHoverMenuKey] = useState('');
  const [activeReactionPickerKey, setActiveReactionPickerKey] = useState('');
  const [activeReplyContext, setActiveReplyContext] = useState(null);
  const [messageActionFeedback, setMessageActionFeedback] = useState(null);
  const [downloadedDocumentKeys, setDownloadedDocumentKeys] = useState({});
  const [activeImagePreview, setActiveImagePreview] = useState(null);
  const [imagePreviewZoom, setImagePreviewZoom] = useState(1);
  const [showImagePreviewReactions, setShowImagePreviewReactions] = useState(false);
  const [pendingAttachmentComposer, setPendingAttachmentComposer] = useState(null);
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false);
  const [voiceRecorderState, setVoiceRecorderState] = useState({
    status: 'idle',
    durationSeconds: 0,
    restoreComposerText: ''
  });
  const [hoverMenuPlacement, setHoverMenuPlacement] = useState({
    horizontal: '',
    vertical: ''
  });
  const [reactionBarPlacement, setReactionBarPlacement] = useState({
    horizontal: '',
    vertical: ''
  });
  const attachmentInputRef = useRef(null);
  const imagePreviewReactionRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceRecorderChunksRef = useRef([]);
  const voiceRecorderStreamRef = useRef(null);
  const voiceRecorderTimerRef = useRef(null);
  const voiceRecorderStopModeRef = useRef('cancel');
  const attachmentDragDepthRef = useRef(0);

  useLayoutEffect(() => {
    if (!activeHoverMenuKey || !openMenuRef.current || !chatMessagesRef?.current) {
      setHoverMenuPlacement({ horizontal: '', vertical: '' });
      return undefined;
    }

    const updatePlacement = () => {
      const menuShell = openMenuRef.current;
      const menuElement = menuShell?.querySelector('.message-hover-menu');
      const viewportElement = chatMessagesRef.current;
      if (!menuShell || !menuElement || !viewportElement) return;

      const viewportRect = viewportElement.getBoundingClientRect();
      const shellRect = menuShell.getBoundingClientRect();
      const menuRect = menuElement.getBoundingClientRect();
      const isIncoming = Boolean(menuShell.closest('.message.incoming'));
      const viewportPadding = 12;

      const spaceRight = viewportRect.right - shellRect.left - viewportPadding;
      const spaceLeft = shellRect.right - viewportRect.left - viewportPadding;
      const spaceBelow = viewportRect.bottom - shellRect.bottom - viewportPadding;
      const spaceAbove = shellRect.top - viewportRect.top - viewportPadding;

      const preferredHorizontal = isIncoming ? 'align-start' : 'align-end';
      const fallbackHorizontal = isIncoming ? 'align-end' : 'align-start';
      const preferredHorizontalSpace =
        preferredHorizontal === 'align-start' ? spaceRight : spaceLeft;
      const fallbackHorizontalSpace =
        fallbackHorizontal === 'align-start' ? spaceRight : spaceLeft;

      let horizontal = preferredHorizontal;
      if (menuRect.width > preferredHorizontalSpace && fallbackHorizontalSpace > preferredHorizontalSpace) {
        horizontal = fallbackHorizontal;
      }

      let vertical = 'open-down';
      if (menuRect.height > spaceBelow && spaceAbove > spaceBelow) {
        vertical = 'open-up';
      }

      setHoverMenuPlacement({ horizontal, vertical });
    };

    updatePlacement();
    return undefined;
  }, [activeHoverMenuKey, chatMessagesRef]);

  useLayoutEffect(() => {
    if ((!activeReactionPickerKey && !activeHoverMenuKey) || !reactionPickerRef.current || !chatMessagesRef?.current) {
      setReactionBarPlacement({ horizontal: '', vertical: '' });
      return undefined;
    }

    const updatePlacement = () => {
      const reactionBarElement = reactionPickerRef.current;
      const viewportElement = chatMessagesRef.current;
      const bubbleElement = reactionBarElement?.closest('.bubble');
      if (!reactionBarElement || !viewportElement || !bubbleElement) return;

      const viewportRect = viewportElement.getBoundingClientRect();
      const bubbleRect = bubbleElement.getBoundingClientRect();
      const reactionRect = reactionBarElement.getBoundingClientRect();
      const viewportPadding = 12;

      const spaceRight = viewportRect.right - bubbleRect.left - viewportPadding;
      const spaceLeft = bubbleRect.right - viewportRect.left - viewportPadding;
      const spaceAbove = bubbleRect.top - viewportRect.top - viewportPadding;
      const spaceBelow = viewportRect.bottom - bubbleRect.bottom - viewportPadding;

      const preferredHorizontal = 'align-end';
      const fallbackHorizontal = 'align-start';
      const preferredHorizontalSpace =
        preferredHorizontal === 'align-start' ? spaceRight : spaceLeft;
      const fallbackHorizontalSpace =
        fallbackHorizontal === 'align-start' ? spaceRight : spaceLeft;

      let horizontal = preferredHorizontal;
      if (reactionRect.width > preferredHorizontalSpace && fallbackHorizontalSpace > preferredHorizontalSpace) {
        horizontal = fallbackHorizontal;
      }

      let vertical = 'open-up';
      if (reactionRect.height > spaceAbove && spaceBelow > spaceAbove) {
        vertical = 'open-down';
      }

      setReactionBarPlacement({ horizontal, vertical });
    };

    updatePlacement();
    return undefined;
  }, [activeHoverMenuKey, activeReactionPickerKey, chatMessagesRef]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedInsideHoverMenu =
        openMenuRef.current && openMenuRef.current.contains(event.target);
      const clickedInsideReactionPicker =
        reactionPickerRef.current && reactionPickerRef.current.contains(event.target);
      const clickedInsideImagePreviewReactions =
        imagePreviewReactionRef.current && imagePreviewReactionRef.current.contains(event.target);
      if (clickedInsideHoverMenu || clickedInsideReactionPicker || clickedInsideImagePreviewReactions) return;
      setActiveHoverMenuKey('');
      setActiveReactionPickerKey('');
      setShowImagePreviewReactions(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!messageActionFeedback) return undefined;
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setMessageActionFeedback(null);
    }, 2600);

    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [messageActionFeedback]);

  useEffect(() => {
    if (!externalMessageActionFeedback || typeof onClearExternalMessageActionFeedback !== 'function') {
      return undefined;
    }

    if (externalFeedbackTimerRef.current) {
      window.clearTimeout(externalFeedbackTimerRef.current);
    }

    externalFeedbackTimerRef.current = window.setTimeout(() => {
      onClearExternalMessageActionFeedback();
    }, 2600);

    return () => {
      if (externalFeedbackTimerRef.current) {
        window.clearTimeout(externalFeedbackTimerRef.current);
        externalFeedbackTimerRef.current = null;
      }
    };
  }, [externalMessageActionFeedback, onClearExternalMessageActionFeedback]);

  useEffect(() => {
    voiceRecorderStopModeRef.current = 'cancel';
    if (voiceRecorderTimerRef.current) {
      window.clearInterval(voiceRecorderTimerRef.current);
      voiceRecorderTimerRef.current = null;
    }
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      try {
        voiceRecorderRef.current.onstop = null;
        voiceRecorderRef.current.stop();
      } catch (_error) {
        // no-op
      }
    }
    if (voiceRecorderStreamRef.current) {
      voiceRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceRecorderStreamRef.current = null;
    }
    voiceRecorderRef.current = null;
    voiceRecorderChunksRef.current = [];
    setVoiceRecorderState({
      status: 'idle',
      durationSeconds: 0,
      restoreComposerText: ''
    });
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey('');
    setActiveReplyContext(null);
    setMessageActionFeedback(null);
    setDownloadedDocumentKeys({});
    setActiveImagePreview(null);
    setImagePreviewZoom(1);
    setShowImagePreviewReactions(false);
    setPendingAttachmentComposer(null);
    setIsAttachmentDragActive(false);
    attachmentDragDepthRef.current = 0;
    olderMessagesScrollAnchorRef.current = 0;
    olderMessagesLoadPendingRef.current = false;
  }, [selectedConversation?._id, selectedConversation?.id]);

  useEffect(
    () => () => {
      voiceRecorderStopModeRef.current = 'cancel';
      if (voiceRecorderTimerRef.current) {
        window.clearInterval(voiceRecorderTimerRef.current);
        voiceRecorderTimerRef.current = null;
      }
      if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
        try {
          voiceRecorderRef.current.onstop = null;
          voiceRecorderRef.current.stop();
        } catch (_error) {
          // no-op
        }
      }
      if (voiceRecorderStreamRef.current) {
        voiceRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
        voiceRecorderStreamRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    const handleGlobalDragReset = () => {
      attachmentDragDepthRef.current = 0;
      setIsAttachmentDragActive(false);
    };

    window.addEventListener('dragend', handleGlobalDragReset);
    window.addEventListener('drop', handleGlobalDragReset);

    return () => {
      window.removeEventListener('dragend', handleGlobalDragReset);
      window.removeEventListener('drop', handleGlobalDragReset);
    };
  }, []);

  useEffect(() => {
    if (!activeImagePreview) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveImagePreview(null);
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeImagePreview]);

  useEffect(() => {
    if (!activeImagePreview?.messageKey) return;
    setImagePreviewZoom(1);
    setShowImagePreviewReactions(false);
  }, [activeImagePreview?.messageKey]);

  const messageLookup = useMemo(() => {
    const byId = new Map();
    const byWhatsAppId = new Map();
    const keyById = new Map();
    const keyByWhatsAppId = new Map();

    (Array.isArray(groupedMessages) ? groupedMessages : []).forEach((item) => {
      if (item?.type !== 'message' || !item?.message) return;
      const msg = item.message;
      const messageKey = getMessageKey(msg, item.index);
      const messageId = String(msg?._id || msg?.id || '').trim();
      const whatsappId = String(msg?.whatsappMessageId || '').trim();
      if (messageId) {
        byId.set(messageId, msg);
        keyById.set(messageId, messageKey);
      }
      if (whatsappId) {
        byWhatsAppId.set(whatsappId, msg);
        keyByWhatsAppId.set(whatsappId, messageKey);
      }
    });

    return { byId, byWhatsAppId, keyById, keyByWhatsAppId };
  }, [groupedMessages, getMessageKey]);

  const persistedReactionMap = useMemo(() => {
    const latestReactionByMessageKey = new Map();

    (Array.isArray(messages) ? messages : []).forEach((message) => {
      if (String(message?.rawMessageType || '').trim().toLowerCase() !== 'reaction') return;

      let targetMessageKey = '';
      const targetMessageId = getMessageReferenceId(message?.reactionTo || message?.replyTo);
      if (targetMessageId && messageLookup.keyById.has(targetMessageId)) {
        targetMessageKey = messageLookup.keyById.get(targetMessageId);
      } else {
        const targetWhatsAppMessageId = String(message?.whatsappContextMessageId || '').trim();
        if (targetWhatsAppMessageId && messageLookup.keyByWhatsAppId.has(targetWhatsAppMessageId)) {
          targetMessageKey = messageLookup.keyByWhatsAppId.get(targetWhatsAppMessageId);
        }
      }

      if (!targetMessageKey) return;

      const reactionTimestamp = new Date(
        message?.timestamp || message?.whatsappTimestamp || message?.createdAt || Date.now()
      ).getTime();
      const normalizedTimestamp = Number.isFinite(reactionTimestamp) ? reactionTimestamp : 0;
      const current = latestReactionByMessageKey.get(targetMessageKey);
      if (current && current.timestamp > normalizedTimestamp) return;

      latestReactionByMessageKey.set(targetMessageKey, {
        emoji: extractReactionEmoji(message),
        timestamp: normalizedTimestamp
      });
    });

    const nextReactionMap = {};
    latestReactionByMessageKey.forEach((value, key) => {
      nextReactionMap[key] = String(value?.emoji || '').trim();
    });
    return nextReactionMap;
  }, [messages, messageLookup]);

  useLayoutEffect(() => {
    if (!olderMessagesLoadPendingRef.current || olderMessagesLoading) {
      return;
    }

    const chatContainer = chatMessagesRef.current;
    if (!chatContainer) {
      olderMessagesLoadPendingRef.current = false;
      olderMessagesScrollAnchorRef.current = 0;
      return;
    }

    const previousScrollHeight = Number(olderMessagesScrollAnchorRef.current || 0);
    if (previousScrollHeight > 0) {
      const heightDelta = chatContainer.scrollHeight - previousScrollHeight;
      if (heightDelta > 0) {
        chatContainer.scrollTop += heightDelta;
      }
    }

    olderMessagesLoadPendingRef.current = false;
    olderMessagesScrollAnchorRef.current = 0;
  }, [messages, olderMessagesLoading, chatMessagesRef]);

  const imagePreviewItems = useMemo(
    () =>
      (Array.isArray(groupedMessages) ? groupedMessages : [])
        .filter((item) => item?.type === 'message' && item?.message)
        .map((item) => {
          const message = item.message;
          const mediaType = String(message?.mediaType || '').trim().toLowerCase();
          const fileCategory = String(message?.attachment?.fileCategory || '').trim().toLowerCase();
          const isImageMessage =
            (mediaType === 'image' || fileCategory === 'image') &&
            Boolean(String(message?.mediaUrl || '').trim());
          if (!isImageMessage) return null;

          return {
            message,
            messageKey: getMessageKey(message, item.index)
          };
        })
        .filter(Boolean),
    [groupedMessages, getMessageKey]
  );

  const activeImagePreviewIndex = useMemo(() => {
    if (!activeImagePreview?.messageKey) return -1;
    return imagePreviewItems.findIndex(
      (item) => String(item?.messageKey || '') === String(activeImagePreview.messageKey || '')
    );
  }, [activeImagePreview?.messageKey, imagePreviewItems]);

  const canReactToMessage = (message = {}) =>
    Boolean(String(message?.whatsappMessageId || '').trim()) &&
    String(message?.rawMessageType || '').trim().toLowerCase() !== 'reaction' &&
    String(message?.status || '').trim().toLowerCase() !== 'sending';

  const getReplySourceMessage = (message = {}) => {
    const embeddedReply = message?.replyTo && typeof message.replyTo === 'object' ? message.replyTo : null;
    if (embeddedReply) return embeddedReply;

    const replyId = getMessageReferenceId(message?.replyTo);
    if (replyId && messageLookup.byId.has(replyId)) {
      return messageLookup.byId.get(replyId);
    }

    const contextId = String(message?.whatsappContextMessageId || '').trim();
    if (contextId && messageLookup.byWhatsAppId.has(contextId)) {
      return messageLookup.byWhatsAppId.get(contextId);
    }

    return null;
  };

  const getReplySourceMessageKey = (message = {}) => {
    const replyToId = getMessageReferenceId(message?.replyTo);
    if (replyToId && messageLookup.keyById.has(replyToId)) {
      return messageLookup.keyById.get(replyToId);
    }

    const contextId = String(message?.whatsappContextMessageId || '').trim();
    if (contextId && messageLookup.keyByWhatsAppId.has(contextId)) {
      return messageLookup.keyByWhatsAppId.get(contextId);
    }

    return '';
  };

  const scrollToReferencedMessage = (targetMessageKey) => {
    const key = String(targetMessageKey || '').trim();
    if (!key) return;
    const targetElement = messageElementRefs.current.get(key);
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(key);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageKey('');
    }, 1400);
  };

  const alignMessageForActionMenu = (targetMessageKey) => {
    const key = String(targetMessageKey || '').trim();
    if (!key) return;

    const targetElement = messageElementRefs.current.get(key);
    const chatContainer = chatMessagesRef?.current;
    if (!targetElement || !chatContainer) return;

    const containerRect = chatContainer.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top;
    const desiredTop = Math.max(72, Math.min(118, chatContainer.clientHeight * 0.2));
    const maxScrollTop = Math.max(chatContainer.scrollHeight - chatContainer.clientHeight, 0);
    const nextScrollTop = Math.max(
      0,
      Math.min(chatContainer.scrollTop + relativeTop - desiredTop, maxScrollTop)
    );

    if (Math.abs(nextScrollTop - chatContainer.scrollTop) > 1) {
      chatContainer.scrollTop = nextScrollTop;
    }
  };

  const closeMessageActionSurfaces = () => {
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey('');
  };

  const showMessageActionToast = (message, tone = 'info') => {
    setMessageActionFeedback({
      tone,
      message: String(message || '').trim()
    });
  };

  const buildReplyContext = () => {
    if (!activeReplyContext?.sourceMessage) return null;
    const sourceMessage = activeReplyContext.sourceMessage;
    const replyToMessageId = getMessageReferenceId(sourceMessage);
    const whatsappContextMessageId = String(sourceMessage?.whatsappMessageId || '').trim();

    return {
      sourceMessage,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      ...(whatsappContextMessageId ? { whatsappContextMessageId } : {})
    };
  };

  const clearReplyContext = () => {
    setActiveReplyContext(null);
  };

  const closePendingAttachmentComposer = ({ restoreComposer = false } = {}) => {
    const restoreText =
      restoreComposer && pendingAttachmentComposer
        ? String(pendingAttachmentComposer.restoreComposerText || '')
        : '';

    setPendingAttachmentComposer(null);

    if (restoreComposer && restoreText) {
      onMessageInputChange(restoreText);
    }
  };

  const resetAttachmentDragState = () => {
    attachmentDragDepthRef.current = 0;
    setIsAttachmentDragActive(false);
  };

  const dragEventHasFiles = (event) =>
    Array.from(event?.dataTransfer?.types || []).includes('Files');

  const openPendingAttachmentComposer = (filesInput) => {
    const nextFiles = Array.isArray(filesInput) ? filesInput : [filesInput];
    const supportedFiles = nextFiles.filter((file) => isSupportedAttachmentComposerFile(file));

    if (!supportedFiles.length || !onSendAttachment) {
      if (nextFiles.length) {
        showMessageActionToast('Drop an image or supported document to send it.', 'info');
      }
      return false;
    }

    if (nextFiles.length > supportedFiles.length) {
      showMessageActionToast('Only images and supported documents can be added here.', 'info');
    }

    const restoreComposerText = String(messageInput || '');

    setPendingAttachmentComposer({
      items: supportedFiles.map((file, index) => ({
        id: buildAttachmentComposerItemId(file, index),
        file,
        mediaType: inferAttachmentComposerMediaType(file)
      })),
      restoreComposerText
    });

    if (restoreComposerText) {
      onMessageInputChange('');
    }

    return true;
  };

  const handleChatDragEnter = (event) => {
    if (!dragEventHasFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    if (!selectedConversation || pendingAttachmentComposer || sendingMessage) return;
    attachmentDragDepthRef.current += 1;
    setIsAttachmentDragActive(true);
  };

  const handleChatDragOver = (event) => {
    if (!dragEventHasFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    if (!selectedConversation || pendingAttachmentComposer || sendingMessage) return;
    event.dataTransfer.dropEffect = 'copy';
    if (!isAttachmentDragActive) {
      setIsAttachmentDragActive(true);
    }
  };

  const handleChatDragLeave = (event) => {
    if (!dragEventHasFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    attachmentDragDepthRef.current = Math.max(attachmentDragDepthRef.current - 1, 0);
    if (attachmentDragDepthRef.current === 0) {
      setIsAttachmentDragActive(false);
    }
  };

  const handleChatDrop = (event) => {
    if (!dragEventHasFiles(event)) return;

    event.preventDefault();
    event.stopPropagation();
    resetAttachmentDragState();

    if (!selectedConversation) return;
    if (pendingAttachmentComposer) {
      showMessageActionToast('Finish the current attachment preview before dropping another file.', 'info');
      return;
    }
    if (sendingMessage) {
      showMessageActionToast('Please wait for the current message to finish sending.', 'info');
      return;
    }

    const droppedFiles = Array.from(event?.dataTransfer?.files || []);
    const supportedDroppedFiles = droppedFiles.filter((file) => isSupportedAttachmentComposerFile(file));

    if (!supportedDroppedFiles.length) {
      showMessageActionToast('Only images and supported documents can be dropped here.', 'info');
      return;
    }

    openPendingAttachmentComposer(supportedDroppedFiles);
  };

  const clearVoiceRecorderTimer = () => {
    if (voiceRecorderTimerRef.current) {
      window.clearInterval(voiceRecorderTimerRef.current);
      voiceRecorderTimerRef.current = null;
    }
  };

  const stopVoiceRecorderTracks = () => {
    if (voiceRecorderStreamRef.current) {
      voiceRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceRecorderStreamRef.current = null;
    }
  };

  const restoreVoiceRecorderComposerText = (restoreComposerText = '') => {
    const nextText = String(restoreComposerText || '');
    if (nextText) {
      onMessageInputChange(nextText);
    }
  };

  const resetVoiceRecorderState = ({ restoreComposer = false, restoreComposerText = '' } = {}) => {
    clearVoiceRecorderTimer();
    stopVoiceRecorderTracks();
    voiceRecorderRef.current = null;
    voiceRecorderChunksRef.current = [];
    voiceRecorderStopModeRef.current = 'cancel';
    setVoiceRecorderState({
      status: 'idle',
      durationSeconds: 0,
      restoreComposerText: ''
    });
    if (restoreComposer) {
      restoreVoiceRecorderComposerText(restoreComposerText);
    }
  };

  const cancelVoiceRecording = ({ restoreComposer = true, suppressToast = false } = {}) => {
    const currentRecorder = voiceRecorderRef.current;
    const restoreComposerText = String(voiceRecorderState.restoreComposerText || '');
    const wasActive =
      voiceRecorderState.status === 'recording' || voiceRecorderState.status === 'sending';

    voiceRecorderStopModeRef.current = 'cancel';

    if (currentRecorder && currentRecorder.state !== 'inactive') {
      try {
        currentRecorder.stop();
      } catch (_error) {
        resetVoiceRecorderState({
          restoreComposer,
          restoreComposerText
        });
      }
    } else {
      resetVoiceRecorderState({
        restoreComposer,
        restoreComposerText
      });
    }

    if (!suppressToast && wasActive) {
      showMessageActionToast('Voice message discarded', 'info');
    }
  };

  const handleSendVoiceRecording = async () => {
    if (voiceRecorderState.status !== 'recording') return;
    const currentRecorder = voiceRecorderRef.current;
    if (!currentRecorder) {
      resetVoiceRecorderState();
      return;
    }

    voiceRecorderStopModeRef.current = 'send';
    setVoiceRecorderState((current) => ({
      ...current,
      status: 'sending'
    }));

    try {
      currentRecorder.stop();
    } catch (error) {
      console.error('Unable to stop voice recorder:', error);
      resetVoiceRecorderState({
        restoreComposer: true,
        restoreComposerText: voiceRecorderState.restoreComposerText
      });
      showMessageActionToast('Unable to send voice message right now.', 'info');
    }
  };

  const handleVoiceMessageClick = async () => {
    if (!selectedConversation || sendingMessage || voiceRecorderState.status !== 'idle') return;

    if (
      typeof window === 'undefined' ||
      typeof window.MediaRecorder === 'undefined' ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      showMessageActionToast('Voice recording is not supported in this browser.', 'info');
      return;
    }

    const restoreComposerText = String(messageInput || '');
    const preferredMimeType = resolvePreferredVoiceRecorderMimeType();

    try {
      if (showEmojiPicker && typeof onToggleEmojiPicker === 'function') {
        onToggleEmojiPicker();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = preferredMimeType
        ? new window.MediaRecorder(stream, { mimeType: preferredMimeType })
        : new window.MediaRecorder(stream);
      const resolvedMimeType = String(recorder.mimeType || preferredMimeType || '').trim();

      voiceRecorderStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceRecorderChunksRef.current = [];
      voiceRecorderStopModeRef.current = 'cancel';

      recorder.ondataavailable = (event) => {
        if (event?.data?.size) {
          voiceRecorderChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('Voice recorder error:', event);
        resetVoiceRecorderState({
          restoreComposer: true,
          restoreComposerText
        });
        showMessageActionToast('Unable to record voice message.', 'info');
      };

      recorder.onstop = async () => {
        const stopMode = voiceRecorderStopModeRef.current;
        const recordedChunks = [...voiceRecorderChunksRef.current];
        const fallbackRestoreComposerText = String(
          voiceRecorderState.restoreComposerText || restoreComposerText
        );

        if (stopMode !== 'send') {
          resetVoiceRecorderState({
            restoreComposer: true,
            restoreComposerText: fallbackRestoreComposerText
          });
          return;
        }

        const finalMimeType = String(
          resolvedMimeType || recordedChunks?.[0]?.type || 'audio/webm'
        ).trim();
        const voiceBlob = new Blob(recordedChunks, {
          type: finalMimeType || 'audio/webm'
        });

        if (!voiceBlob.size) {
          resetVoiceRecorderState({
            restoreComposer: true,
            restoreComposerText: fallbackRestoreComposerText
          });
          showMessageActionToast('Voice message was too short to send.', 'info');
          return;
        }

        const extension = inferVoiceRecorderExtension(finalMimeType);
        const voiceFile = new File([voiceBlob], `voice-note-${Date.now()}.${extension}`, {
          type: finalMimeType || 'audio/webm',
          lastModified: Date.now()
        });
        const replyContext = buildReplyContext();
        const didSend = await onSendAttachment?.(voiceFile, {
          captionOverride: '',
          ...(replyContext ? { replyContext } : {})
        });

        if (didSend !== false) {
          clearReplyContext();
          resetVoiceRecorderState();
          showMessageActionToast('Voice message sent', 'success');
          return;
        }

        resetVoiceRecorderState({
          restoreComposer: true,
          restoreComposerText: fallbackRestoreComposerText
        });
      };

      recorder.start(250);

      if (restoreComposerText) {
        onMessageInputChange('');
      }

      clearVoiceRecorderTimer();
      setVoiceRecorderState({
        status: 'recording',
        durationSeconds: 0,
        restoreComposerText
      });
      voiceRecorderTimerRef.current = window.setInterval(() => {
        setVoiceRecorderState((current) =>
          current.status === 'idle'
            ? current
            : {
                ...current,
                durationSeconds: current.durationSeconds + 1
              }
        );
      }, 1000);
    } catch (error) {
      console.error('Unable to start voice recording:', error);
      stopVoiceRecorderTracks();
      voiceRecorderRef.current = null;
      voiceRecorderChunksRef.current = [];
      setVoiceRecorderState({
        status: 'idle',
        durationSeconds: 0,
        restoreComposerText: ''
      });
      const errorMessage = String(error?.message || '').toLowerCase();
      const deniedMicrophone =
        errorMessage.includes('denied') ||
        errorMessage.includes('permission') ||
        error?.name === 'NotAllowedError';
      showMessageActionToast(
        deniedMicrophone
          ? 'Microphone permission is required to record a voice message.'
          : 'Unable to access the microphone right now.',
        'info'
      );
    }
  };

  const handleAttachmentSelect = (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length || !onSendAttachment) {
      event.target.value = '';
      return;
    }

    openPendingAttachmentComposer(files);
    event.target.value = '';
  };

  const handleSendPendingAttachment = async (draftItems = []) => {
    if (!Array.isArray(draftItems) || !draftItems.length || !onSendAttachment) return [];

    const replyContext = buildReplyContext();
    const sentIds = [];

    for (const draftItem of draftItems) {
      const didSend = await onSendAttachment(draftItem.file, {
        captionOverride: String(draftItem.caption || ''),
        ...(replyContext ? { replyContext } : {})
      });

      if (didSend === false) {
        break;
      }

      sentIds.push(String(draftItem.id || ''));
    }

    if (sentIds.length === draftItems.length) {
      closePendingAttachmentComposer({ restoreComposer: false });
      clearReplyContext();
    }

    return sentIds.filter(Boolean);
  };

  const getAttachmentInfo = (message = {}) => {
    const attachment = message?.attachment || {};
    const mediaType = String(message?.mediaType || '').trim();
    const fileCategory = String(attachment?.fileCategory || mediaType || '').toLowerCase();
    const isImage = fileCategory === 'image' || mediaType === 'image';
    const isAudio = fileCategory === 'audio' || mediaType === 'audio';
    const fileExtension = getFileExtension(message, attachment);
    const fileName =
      String(attachment?.originalFileName || message?.mediaCaption || '').trim() ||
      (isImage ? 'Image attachment' : isAudio ? 'Voice message' : 'Document attachment');
    const fileSizeLabel = formatFileSize(attachment?.bytes);
    const deletedAt = attachment?.deletedAt ? String(attachment.deletedAt) : '';
    const uploadProgressRaw = attachment?.uploadProgress;
    const uploadProgress =
      typeof uploadProgressRaw === 'number' && Number.isFinite(uploadProgressRaw)
        ? Math.max(0, Math.min(1, uploadProgressRaw))
        : null;
    const uploadError = String(attachment?.uploadError || message?.errorMessage || '').trim();
    const isFailed = String(message?.status || '').toLowerCase() === 'failed' || Boolean(uploadError);

    return {
      attachment,
      isImage,
      isAudio,
      fileExtension,
      fileName,
      fileSizeLabel,
      deletedAt,
      uploadProgress,
      uploadError,
      isFailed
    };
  };

  const handleMessageInfo = (message = {}) => {
    const statusLabel =
      message?.sender === 'agent'
        ? getMessageStatusLabel(message?.status)
        : 'Received';
    const timeLabel = formatMessageDateTime(
      message?.timestamp || message?.whatsappTimestamp || message?.createdAt
    );
    const infoParts = [statusLabel, timeLabel];
    const messageId = String(message?._id || message?.whatsappMessageId || '').trim();
    if (messageId) {
      infoParts.push(`ID ${messageId}`);
    }
    closeMessageActionSurfaces();
    return showMessageActionToast(infoParts.join(' | '), 'info');
  };

  const handleReplyToMessage = (message = {}, messageKey = '') => {
    setActiveReplyContext({
      messageKey,
      sourceMessage: message,
      preview: getMessagePreviewText(message),
      senderLabel: message?.sender === 'agent' ? 'Replying to yourself' : 'Replying to contact'
    });
    closeMessageActionSurfaces();
    messageInputRef?.current?.focus?.();
  };

  const handleOpenReactMenu = (messageKey = '', message = {}) => {
    if (!messageKey) return;
    if (!canReactToMessage(message)) {
      return showMessageActionToast('This message cannot be reacted to yet.', 'info');
    }
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey((current) => (current === messageKey ? '' : messageKey));
  };

  const handleCopyMessage = async (message = {}) => {
    const text = getMessageDisplayText(message);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setActiveHoverMenuKey('');
      setActiveReactionPickerKey('');
      showMessageActionToast('Message copied', 'success');
    } catch (_error) {
      showMessageActionToast('Unable to copy message text', 'info');
    }
  };

  const handleAttachmentOpen = async (
    message = {},
    mode = 'view',
    messageKey = '',
    { hideDocumentDownload = false } = {}
  ) => {
    if (!onOpenAttachment) return;
    const openResult = await onOpenAttachment(message, mode);
    const isViewResult =
      openResult &&
      typeof openResult === 'object' &&
      String(openResult?.mode || '').trim().toLowerCase() === 'view' &&
      Boolean(String(openResult?.url || '').trim());
    const didOpen =
      typeof openResult === 'object'
        ? Boolean(openResult?.success || openResult?.url)
        : Boolean(openResult);

    if (didOpen && isViewResult) {
      setActiveImagePreview({
        src: String(openResult?.url || '').trim(),
        fileName: String(
          openResult?.fileName ||
            message?.attachment?.originalFileName ||
            message?.mediaCaption ||
            'Image attachment'
        ).trim(),
        caption: getMessageDisplayText(message),
        timestamp: formatMessageDateTime(
          message?.timestamp || message?.whatsappTimestamp || message?.createdAt
        ),
        senderLabel:
          message?.sender === 'agent'
            ? 'You'
            : String(getConversationDisplayName(selectedConversation) || 'Contact').trim(),
        message,
        messageKey
      });
    }

    if (didOpen && hideDocumentDownload && messageKey) {
      setDownloadedDocumentKeys((current) => ({
        ...current,
        [messageKey]: true
      }));
    }
    return didOpen;
  };

  const handleDownloadMessage = async (message = {}, messageKey = '') => {
    const didOpen = await handleAttachmentOpen(message, 'download', messageKey, {
      hideDocumentDownload: true
    });
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey('');
    if (didOpen) {
      showMessageActionToast('Opening attachment', 'info');
    }
  };

  const closeImagePreview = () => {
    setActiveImagePreview(null);
  };

  const zoomImagePreview = (direction = 0) => {
    const numericDirection = Number(direction || 0);
    if (!numericDirection) return;
    setImagePreviewZoom((current) => {
      const nextZoom = current + numericDirection * IMAGE_PREVIEW_ZOOM_STEP;
      return Math.min(IMAGE_PREVIEW_MAX_ZOOM, Math.max(IMAGE_PREVIEW_MIN_ZOOM, nextZoom));
    });
  };

  const resetImagePreviewZoom = () => {
    setImagePreviewZoom(1);
  };

  const openImagePreviewFromItem = async (item) => {
    if (!item?.message) return;
    await handleAttachmentOpen(item.message, 'view', item.messageKey);
  };

  const openAdjacentImagePreview = async (direction = 0) => {
    if (activeImagePreviewIndex < 0) return;
    const targetIndex = activeImagePreviewIndex + Number(direction || 0);
    if (targetIndex < 0 || targetIndex >= imagePreviewItems.length) return;
    await openImagePreviewFromItem(imagePreviewItems[targetIndex]);
  };

  const jumpToPreviewMessage = () => {
    const messageKey = String(activeImagePreview?.messageKey || '').trim();
    if (!messageKey) return;
    closeImagePreview();
    closeMessageActionSurfaces();
    window.setTimeout(() => {
      scrollToReferencedMessage(messageKey);
    }, 0);
  };

  const handleReplyFromPreview = () => {
    if (!activeImagePreview?.message) return;
    handleReplyToMessage(activeImagePreview.message, activeImagePreview.messageKey);
    closeImagePreview();
  };

  const handlePreviewReactionSelect = async (emoji = '') => {
    if (!activeImagePreview?.message || !activeImagePreview?.messageKey) return;
    await handleMessageReaction(activeImagePreview.message, activeImagePreview.messageKey, emoji);
    setShowImagePreviewReactions(false);
  };

  const handleDownloadPreviewImage = async () => {
    if (!activeImagePreview?.message) return;
    await handleAttachmentOpen(
      activeImagePreview.message,
      'download',
      activeImagePreview.messageKey
    );
  };

  const handleDeleteMessage = async (message = {}) => {
    if (!onDeleteMessage) return;
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey('');
    await onDeleteMessage(message);
  };

  const handleMessageReaction = async (message = {}, messageKey = '', emoji = '') => {
    if (!messageKey || !emoji || typeof onReactToMessage !== 'function') return;
    const selectedReaction = String(persistedReactionMap[messageKey] || '').trim();
    const nextEmoji = selectedReaction === emoji ? '' : emoji;
    setActiveHoverMenuKey('');
    setActiveReactionPickerKey('');
    await onReactToMessage(message, nextEmoji);
  };

  const renderReactionBar = (message = {}, messageKey = '') => {
    if (!messageKey || !canReactToMessage(message)) return null;
    const selectedReaction = String(persistedReactionMap[messageKey] || '').trim();
    const isPickerOpen = activeReactionPickerKey === messageKey;
    const isMenuOpen = activeHoverMenuKey === messageKey;
    const isPlacementReady = Boolean(
      String(reactionBarPlacement.horizontal || '').trim() &&
        String(reactionBarPlacement.vertical || '').trim()
    );

    return (
      <>
        <div
          className={`message-reaction-bar ${isPickerOpen || isMenuOpen ? 'is-open' : ''} ${
            reactionBarPlacement.horizontal
          } ${reactionBarPlacement.vertical} ${
            isPickerOpen || isMenuOpen ? (isPlacementReady ? 'is-ready' : 'is-measuring') : ''
          }`.trim()}
          ref={isPickerOpen || isMenuOpen ? reactionPickerRef : null}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={`${messageKey}-${emoji}`}
              type="button"
              className={`message-reaction-btn ${selectedReaction === emoji ? 'is-active' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                handleMessageReaction(message, messageKey, emoji);
              }}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className={`message-reaction-btn message-reaction-btn--more ${isPickerOpen ? 'is-active' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveReactionPickerKey((current) => (current === messageKey ? '' : messageKey));
              setActiveHoverMenuKey('');
            }}
          >
            <Plus size={16} />
          </button>
          {isPickerOpen && (
            <div className="message-reaction-picker">
              {EXTRA_REACTIONS.map((emoji) => (
                <button
                  key={`${messageKey}-extra-${emoji}`}
                  type="button"
                  className={`message-reaction-btn ${selectedReaction === emoji ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleMessageReaction(message, messageKey, emoji);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderHoverReactionTrigger = (message = {}, messageKey = '') => {
    if (!messageKey || !canReactToMessage(message)) return null;
    const isOpen = activeReactionPickerKey === messageKey;

    return (
      <button
        type="button"
        className={`message-hover-reaction-trigger ${isOpen ? 'is-open' : ''}`}
        aria-label="React to message"
        onClick={(event) => {
          event.stopPropagation();
          handleOpenReactMenu(messageKey, message);
        }}
      >
        <Smile size={16} />
      </button>
    );
  };

  const renderReactionChip = (messageKey) => {
    const selectedReaction = String(persistedReactionMap[messageKey] || '').trim();
    if (!selectedReaction) return null;
    return (
      <div className="message-reaction-chip">
        <span>{selectedReaction}</span>
      </div>
    );
  };

  const renderMessageHoverMenu = ({
    message,
    messageKey,
    hasAttachment,
    variant = 'overlay',
    contextClass = ''
  }) => {
    const copyableText = getMessageDisplayText(message);
    const canCopy = Boolean(copyableText);
    const canDownload = hasAttachment;
    const isOutgoingMessage = message?.sender === 'agent';
    const canDelete = Boolean(onDeleteMessage);
    const isOpen = activeHoverMenuKey === messageKey;
    const isPlacementReady = Boolean(
      String(hoverMenuPlacement.horizontal || '').trim() &&
        String(hoverMenuPlacement.vertical || '').trim()
    );
    const menuItems = [
      {
        key: 'reply',
        label: 'Reply',
        icon: <Reply size={15} />,
        onSelect: () => handleReplyToMessage(message, messageKey)
      },
      ...(canCopy
        ? [
            {
              key: 'copy',
              label: 'Copy',
              icon: <Copy size={15} />,
              onSelect: () => handleCopyMessage(message)
            }
          ]
        : []),
      {
        key: 'react',
        label: 'React',
        icon: <Smile size={15} />,
        onSelect: () => handleOpenReactMenu(messageKey, message)
      },
      ...(canDownload
        ? [
            {
              key: 'download',
              label: 'Download',
              icon: <Download size={15} />,
              onSelect: () => handleDownloadMessage(message, messageKey)
            }
          ]
        : []),
      ...(isOutgoingMessage
        ? [
            {
              key: 'info',
              label: 'Message info',
              icon: <Info size={15} />,
              hasSeparator: true,
              onSelect: () => handleMessageInfo(message)
            }
          ]
        : []),
      ...(canDelete
        ? [
            {
              key: 'delete',
              label: 'Delete',
              icon: <Trash2 size={15} />,
              className: 'danger',
              hasSeparator: !isOutgoingMessage,
              onSelect: () => handleDeleteMessage(message)
            }
          ]
        : [])
    ];

    if (menuItems.length === 0) return null;

    return (
      <span
        className={`message-hover-shell ${variant} ${contextClass} ${isOpen ? 'is-open' : ''}`}
        ref={isOpen ? openMenuRef : null}
      >
        <button
          type="button"
          className={`message-hover-trigger ${variant} ${contextClass} ${isOpen ? 'is-open' : ''}`}
          aria-label="Open message actions"
          onClick={(event) => {
            event.stopPropagation();
            setActiveHoverMenuKey((current) => {
              if (current === messageKey) {
                return '';
              }
              alignMessageForActionMenu(messageKey);
              return messageKey;
            });
            setActiveReactionPickerKey('');
          }}
        >
          <ChevronDown size={18} />
        </button>

        {isOpen && (
          <span
            className={`message-hover-menu ${variant} ${contextClass} ${hoverMenuPlacement.horizontal} ${hoverMenuPlacement.vertical} ${
              isPlacementReady ? 'is-ready' : 'is-measuring'
            }`.trim()}
          >
            {menuItems.map((item) => (
              <React.Fragment key={`${messageKey}-${item.key}`}>
                {item.hasSeparator && <span className="message-hover-menu-separator" />}
                <button
                  type="button"
                  className={`message-hover-menu-item ${item.className || ''}`.trim()}
                  onClick={(event) => {
                    event.stopPropagation();
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </span>
        )}
      </span>
    );
  };

  const renderAttachment = (message = {}, messageKey = '') => {
    const {
      isImage,
      isAudio,
      fileExtension,
      fileName,
      fileSizeLabel,
      deletedAt,
      uploadProgress,
      uploadError,
      isFailed
    } = getAttachmentInfo(message);
    const hasCaptionText = Boolean(getMessageDisplayText(message));
    const hasMedia = Boolean(message?.mediaUrl);
    const attachment = message?.attachment || {};
    const hasAttachmentMeta =
      Boolean(attachment?.publicId) ||
      Boolean(attachment?.originalFileName) ||
      Boolean(attachment?.bytes);
    if (!hasMedia && !hasAttachmentMeta && !isAudio) return null;
    const canOpen = Boolean(onOpenAttachment);
    const isDeleted = Boolean(deletedAt);
    const isUploading = typeof uploadProgress === 'number' && uploadProgress < 1;
    const canRetry = Boolean(onRetryAttachment) && isFailed;
    const openMode = isImage ? 'view' : 'download';
    const attachmentPages = Number(attachment?.pages || 0);
    const isDownloadButtonHidden = !isImage && !isAudio && Boolean(downloadedDocumentKeys[messageKey]);
    const documentMetaLabel = [fileExtension, fileSizeLabel || '']
      .filter(Boolean)
      .join(' • ');
    const fallbackMetaLabel =
      attachmentPages > 0 ? `${attachmentPages} ${attachmentPages === 1 ? 'page' : 'pages'}` : '';
    const documentSecondaryLabel = documentMetaLabel || fallbackMetaLabel;
    const documentBadgeLabel = String(fileExtension || 'FILE')
      .trim()
      .toUpperCase()
      .slice(0, 4) || 'FILE';

    if (!hasMedia && !message?.attachment && !isAudio) return null;

    if (isDeleted) {
      return (
        <div className="message-attachment-deleted-state">
          <div className="message-attachment-deleted-copy">
            <span className="message-attachment-deleted-title">Attachment deleted</span>
            <span className="message-attachment-deleted-meta">
              This media is no longer available in the chat.
            </span>
          </div>
          {renderMessageHoverMenu({
            message,
            messageKey,
            hasAttachment: false,
            variant: 'overlay'
          })}
        </div>
      );
    }

    if (isImage && hasMedia) {
      const messageTimestamp = formatMessageTime(
        message.timestamp || message.whatsappTimestamp || message.createdAt
      );

      return (
        <div className={`message-image ${isDeleted ? 'is-deleted' : ''}`}>
          <button
            type="button"
            className="message-image-button"
            disabled={!canOpen || isDeleted || isUploading}
            onClick={async (event) => {
              event.stopPropagation();
              if (canOpen && !isUploading) {
                await handleAttachmentOpen(message, openMode, messageKey);
              }
            }}
            aria-label="Open image attachment"
          >
            <img src={message.mediaUrl} alt={fileName} />
            {!hasCaptionText && (
              <span className="message-image-meta">
                <span className="timestamp">{messageTimestamp}</span>
                {message.sender === 'agent' && getStatusIcon(message.status)}
              </span>
            )}
          </button>
          {renderMessageHoverMenu({
            message,
            messageKey,
            hasAttachment: true,
            variant: 'overlay'
          })}
        </div>
      );
    }

    if (isAudio) {
      const canPlayAudio = Boolean(hasMedia);
      return (
        <div className="message-voice-note">
          <div className="message-voice-note-shell">
            <span className="message-voice-note-badge" aria-hidden="true">
              <Mic size={16} />
            </span>
            <div className="message-voice-note-content">
              {canPlayAudio ? (
                <audio
                  className="message-voice-note-player"
                  controls
                  preload="metadata"
                  src={message.mediaUrl}
                />
              ) : (
                <div className="message-voice-note-player message-voice-note-player--unavailable">
                  <span className="message-voice-note-waveform" aria-hidden="true" />
                  <span className="message-voice-note-unavailable-label">Voice message unavailable</span>
                </div>
              )}
              <div className="message-voice-note-details">
                <span className="message-voice-note-title">Voice message</span>
                {fileSizeLabel && (
                  <span className="message-voice-note-size">{fileSizeLabel}</span>
                )}
              </div>
            </div>
          </div>
          {renderMessageHoverMenu({
            message,
            messageKey,
            hasAttachment: canPlayAudio || hasAttachmentMeta,
            variant: 'overlay',
            contextClass: 'audio-card'
          })}
          {canRetry && (
            <div className="attachment-actions-inline">
              <button
                type="button"
                className="attachment-action-btn retry"
                onClick={(event) => {
                  event.stopPropagation();
                  onRetryAttachment(message);
                }}
              >
                <RotateCw size={16} />
                Retry
              </button>
            </div>
          )}
          {isUploading && (
            <div className="attachment-progress">
              <div className="attachment-progress-bar">
                <div
                  className="attachment-progress-fill"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                />
              </div>
              <span className="attachment-progress-label">
                Uploading {Math.round(uploadProgress * 100)}%
              </span>
              <span className="attachment-spinner" aria-hidden />
            </div>
          )}
          {!isUploading && isFailed && (
            <div className="attachment-error">
              {uploadError || 'Upload failed. Click retry to send again.'}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`message-attachment ${isDeleted ? 'is-deleted' : ''}`}>
        <button
          type="button"
          className="attachment-card attachment-card--document"
          disabled={!canOpen || isDeleted || isUploading}
          onClick={async (event) => {
            event.stopPropagation();
            if (canOpen && !isUploading) {
              await handleAttachmentOpen(message, openMode, messageKey, {
                hideDocumentDownload: true
              });
            }
          }}
          aria-label="Download document attachment"
        >
          <span className="attachment-doc-badge" aria-hidden="true">
            <span className="attachment-doc-badge-fold" />
            <FileText size={14} />
            <span className="attachment-doc-badge-label">{documentBadgeLabel}</span>
          </span>
          <span className="attachment-meta attachment-meta--document">
            <span className="attachment-name attachment-name--document">{fileName}</span>
            {documentSecondaryLabel && (
              <span className="attachment-doc-summary">{documentSecondaryLabel}</span>
            )}
          </span>
          {!isDownloadButtonHidden && (
            <span className="attachment-download-button" aria-hidden="true">
              <Download size={18} />
            </span>
          )}
        </button>
        {renderMessageHoverMenu({
          message,
          messageKey,
          hasAttachment: true,
          variant: 'overlay',
          contextClass: 'document-card'
        })}
        {canRetry && (
          <div className="attachment-actions-inline">
            <button
              type="button"
              className="attachment-action-btn retry"
              onClick={(event) => {
                event.stopPropagation();
                onRetryAttachment(message);
              }}
            >
              <RotateCw size={16} />
              Retry
            </button>
          </div>
        )}
        {isUploading && (
          <div className="attachment-progress">
            <div className="attachment-progress-bar">
              <div
                className="attachment-progress-fill"
                style={{ width: `${Math.round(uploadProgress * 100)}%` }}
              />
            </div>
            <span className="attachment-progress-label">
              Uploading {Math.round(uploadProgress * 100)}%
            </span>
            <span className="attachment-spinner" aria-hidden />
          </div>
        )}
        {!isUploading && isFailed && (
          <div className="attachment-error">
            {uploadError || 'Upload failed. Click retry to send again.'}
          </div>
        )}
        {isDeleted && <div className="attachment-deleted">Attachment deleted</div>}
      </div>
    );
  };

  const handleSendCurrentMessage = async () => {
    if (!onSendMessage) return;
    const replyContext = buildReplyContext();
    const didSend = await onSendMessage(
      replyContext ? { replyContext } : undefined
    );
    if (didSend !== false) {
      clearReplyContext();
    }
  };

  const handleChatScroll = () => {
    if (
      !onLoadOlderMessages ||
      !hasOlderMessages ||
      olderMessagesLoading ||
      messagesLoading
    ) {
      return;
    }

    const chatContainer = chatMessagesRef.current;
    if (!chatContainer || chatContainer.scrollTop > 48) {
      return;
    }

    olderMessagesScrollAnchorRef.current = chatContainer.scrollHeight;
    olderMessagesLoadPendingRef.current = true;

    Promise.resolve()
      .then(() => onLoadOlderMessages())
      .then((didLoad) => {
        if (didLoad !== false) return;
        olderMessagesLoadPendingRef.current = false;
        olderMessagesScrollAnchorRef.current = 0;
      })
      .catch(() => {
        olderMessagesLoadPendingRef.current = false;
        olderMessagesScrollAnchorRef.current = 0;
      });
  };

  const isVoiceRecordingActive = voiceRecorderState.status === 'recording';
  const isVoiceSending = voiceRecorderState.status === 'sending';
  const showVoiceRecorderComposer = isVoiceRecordingActive || isVoiceSending;

  if (!selectedConversation) {
    return (
      <div
        className="chat-area"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      >
        <div className="no-conversation-selected">
          <div className="placeholder-content">
            <h3>Welcome to Team Inbox</h3>
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`chat-area ${isAttachmentDragActive ? 'is-attachment-drag-active' : ''}`}
      onDragEnter={handleChatDragEnter}
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      <>
        <div className="chat-header">
          <div className="avatar">{getConversationAvatarText(selectedConversation)}</div>

          <div className="chat-header-info">
            <span className="name text-white">{getConversationDisplayName(selectedConversation)}</span>
            <span className="status text-white">{selectedConversation.contactPhone}</span>
          </div>

          <div className="chat-header-actions">
            <button
              className="icon-btn text-white"
              type="button"
              aria-label="Call contact (coming soon)"
              title="Call contact (coming soon)"
              disabled
            >
              <Phone size={18} />
            </button>

            <div className="chat-header-menu" ref={messageMenuRef}>
              <button
                className="icon-btn text-white"
                type="button"
                aria-label="Chat actions"
                title="Chat actions"
                onClick={onToggleMessageMenu}
              >
                <MoreVertical size={18} />
              </button>

              {showMessageSelectMenu && (
                <div className="message-select-menu">
                  <button className="select-menu-item" onClick={onToggleMessageSelectMode}>
                    {showMessageSelectMode ? 'Cancel Select' : 'Select Chat'}
                  </button>
                  <button className="select-menu-item" onClick={onDeleteConversation}>
                    Delete Chat
                  </button>
                  <button className="select-menu-item" onClick={onOpenContactInformation}>
                    Contact Information
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isAttachmentDragActive && (
          <div className="chat-attachment-drop-overlay" aria-hidden="true">
            <div className="chat-attachment-drop-card">
              <div className="chat-attachment-drop-icon-wrap">
                <Paperclip size={22} />
              </div>
              <div className="chat-attachment-drop-copy">
                <span className="chat-attachment-drop-title">
                  Drop file to send to {getConversationDisplayName(selectedConversation)}
                </span>
                <span className="chat-attachment-drop-subtitle">
                  Images and supported documents will open in preview before sending.
                </span>
              </div>
            </div>
          </div>
        )}

        {(messageActionFeedback || externalMessageActionFeedback) && (
          <div
            className={`message-action-feedback message-action-feedback--${
              (messageActionFeedback || externalMessageActionFeedback).tone || 'info'
            }`}
          >
            {(messageActionFeedback || externalMessageActionFeedback).message}
          </div>
        )}

        {pendingAttachmentComposer && (
          <AttachmentComposerOverlay
            selectedConversation={selectedConversation}
            getConversationAvatarText={getConversationAvatarText}
            getConversationDisplayName={getConversationDisplayName}
            pendingAttachment={pendingAttachmentComposer}
            onClose={() => closePendingAttachmentComposer({ restoreComposer: true })}
            onComplete={() => closePendingAttachmentComposer({ restoreComposer: false })}
            onSend={handleSendPendingAttachment}
            sendingMessage={sendingMessage}
            replyPreview={
              activeReplyContext
                ? {
                    senderLabel: activeReplyContext.senderLabel,
                    preview: activeReplyContext.preview
                  }
                : null
            }
          />
        )}

        {activeImagePreview && (
          <div
            className="chat-image-preview-overlay"
            onClick={closeImagePreview}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            <div
              className="chat-image-preview-shell"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="chat-image-preview-header">
                <div className="chat-image-preview-contact">
                  <div className="chat-image-preview-avatar">
                    {getConversationAvatarText(selectedConversation)}
                  </div>
                  <div className="chat-image-preview-meta">
                    <span className="chat-image-preview-title">
                      {selectedConversation.contactPhone ||
                        getConversationDisplayName(selectedConversation)}
                    </span>
                    <span className="chat-image-preview-time">
                      {activeImagePreview.timestamp}
                    </span>
                  </div>
                </div>
                <div className="chat-image-preview-actions">
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={() => zoomImagePreview(-1)}
                    aria-label="Zoom out"
                    title="Zoom out"
                    disabled={imagePreviewZoom <= IMAGE_PREVIEW_MIN_ZOOM}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={() => zoomImagePreview(1)}
                    aria-label="Zoom in"
                    title="Zoom in"
                    disabled={imagePreviewZoom >= IMAGE_PREVIEW_MAX_ZOOM}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={jumpToPreviewMessage}
                    aria-label="Show message in chat"
                    title="Show message in chat"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={handleReplyFromPreview}
                    aria-label="Reply to image"
                    title="Reply"
                  >
                    <Reply size={18} />
                  </button>
                  <div
                    className="chat-image-preview-reaction-wrap"
                    ref={showImagePreviewReactions ? imagePreviewReactionRef : null}
                  >
                    <button
                      type="button"
                      className="chat-image-preview-action"
                      onClick={() =>
                        canReactToMessage(activeImagePreview.message)
                          ? setShowImagePreviewReactions((current) => !current)
                          : showMessageActionToast('This message cannot be reacted to yet.', 'info')
                      }
                      aria-label="React to image"
                      title="React"
                      disabled={!canReactToMessage(activeImagePreview.message)}
                    >
                      <Smile size={18} />
                    </button>
                    {showImagePreviewReactions && (
                      <div className="chat-image-preview-reaction-picker">
                        {[...QUICK_REACTIONS, ...EXTRA_REACTIONS].map((emoji) => (
                          <button
                            key={`preview-reaction-${activeImagePreview.messageKey}-${emoji}`}
                            type="button"
                            className={`chat-image-preview-reaction-option ${
                              String(persistedReactionMap[activeImagePreview.messageKey] || '').trim() === emoji
                                ? 'is-active'
                                : ''
                            }`}
                            onClick={() => handlePreviewReactionSelect(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={handleDownloadPreviewImage}
                    aria-label="Download image"
                    title="Download image"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    type="button"
                    className="chat-image-preview-action"
                    onClick={closeImagePreview}
                    aria-label="Close image preview"
                    title="Close image preview"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="chat-image-preview-stage">
                {activeImagePreviewIndex > 0 && (
                  <button
                    type="button"
                    className="chat-image-preview-nav chat-image-preview-nav--prev"
                    onClick={() => openAdjacentImagePreview(-1)}
                    aria-label="Previous image"
                    title="Previous image"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}
                <img
                  src={activeImagePreview.src}
                  alt={activeImagePreview.fileName || 'Image preview'}
                  className="chat-image-preview-image"
                  style={{ transform: `scale(${imagePreviewZoom})` }}
                  onDoubleClick={resetImagePreviewZoom}
                />
                {activeImagePreviewIndex > -1 &&
                  activeImagePreviewIndex < imagePreviewItems.length - 1 && (
                    <button
                      type="button"
                      className="chat-image-preview-nav chat-image-preview-nav--next"
                      onClick={() => openAdjacentImagePreview(1)}
                      aria-label="Next image"
                      title="Next image"
                    >
                      <ChevronRight size={22} />
                    </button>
                  )}
              </div>

              {(activeImagePreview.caption || activeImagePreview.fileName) && (
                <div className="chat-image-preview-caption">
                  <span>{activeImagePreview.caption || activeImagePreview.fileName}</span>
                  <span className="chat-image-preview-zoom-label">
                    {Math.round(imagePreviewZoom * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="chat-messages" ref={chatMessagesRef} onScroll={handleChatScroll}>
          {olderMessagesLoading && (
            <div className="chat-history-loading">
              <span className="chat-history-loading-spinner" aria-hidden="true" />
              <span>Loading earlier messages...</span>
            </div>
          )}

          {messagesLoading && (
            <div className="chat-thread-loading">
              <span className="chat-thread-loading-spinner" aria-hidden="true" />
              <span>Loading conversation...</span>
            </div>
          )}

          {groupedMessages.map((item) => {
            if (item.type === 'separator') {
              return (
                <div key={item.key} className="message-date-separator">
                  <span>{item.label}</span>
                </div>
              );
            }

            const message = item.message;
            const messageKey = getMessageKey(message, item.index);
            const conversationReplyLabel =
              String(getConversationDisplayName(selectedConversation) || '').trim() || 'Contact';
            const replySourceMessage = getReplySourceMessage(message);
            const replySourceMessageKey = getReplySourceMessageKey(message);
            const hasContextReference = Boolean(String(message?.whatsappContextMessageId || '').trim());
            const showReplyPreview = Boolean(replySourceMessage || hasContextReference);
            const replyPreview = replySourceMessage
              ? getMessagePreviewText(replySourceMessage)
              : 'Original message';
            const replyLabel = replySourceMessage
              ? replySourceMessage?.sender === 'agent'
                ? 'You'
                : conversationReplyLabel
              : 'Quoted message';

            const hasAttachment =
              Boolean(message?.mediaUrl) ||
              Boolean(message?.attachment?.publicId) ||
              Boolean(message?.attachment?.originalFileName);
            const displayText = getMessageDisplayText(message);
            const attachmentKind = String(
              message?.attachment?.fileCategory || message?.mediaType || ''
            )
              .trim()
              .toLowerCase();
            const hasImageAttachment = attachmentKind === 'image' && Boolean(message?.mediaUrl);
            const hasAudioAttachment = attachmentKind === 'audio';
            const hasDocumentAttachment =
              hasAttachment && !hasImageAttachment && !hasAudioAttachment;
            const showAttachmentCaption = hasAttachment && Boolean(displayText);
            const hasDocumentCaption = hasDocumentAttachment && showAttachmentCaption;
            const useAttachmentCaptionTrailingMeta = showAttachmentCaption;
            const showInlineMeta = !hasImageAttachment;
            const useCompactInlineMeta =
              showInlineMeta &&
              !hasDocumentAttachment &&
              Boolean(displayText);
            const useTrailingCompactMeta =
              useCompactInlineMeta &&
              (showReplyPreview || displayText.includes('\n') || displayText.length > 70);
            const useOverlayCompactHoverMenu = useCompactInlineMeta;
            const hasActiveMessageActions =
              activeHoverMenuKey === messageKey || activeReactionPickerKey === messageKey;
            const hasPersistedReaction = Boolean(
              String(persistedReactionMap[messageKey] || '').trim()
            );

            return (
              <div
                key={messageKey}
                ref={(node) => {
                  if (node) {
                    messageElementRefs.current.set(messageKey, node);
                  } else {
                    messageElementRefs.current.delete(messageKey);
                  }
                }}
                className={`message ${message.sender === 'agent' ? 'outgoing' : 'incoming'} ${
                  showMessageSelectMode ? 'select-mode' : ''
                } ${highlightedMessageKey === messageKey ? 'reply-target-highlight' : ''} ${
                  hasPersistedReaction ? 'has-reaction-chip' : ''
                } ${
                  hasActiveMessageActions ? 'has-active-message-actions' : ''
                }`}
                onClick={() => {
                  if (showMessageSelectMode) {
                    onToggleMessageSelection(messageKey);
                  }
                }}
              >
                {showMessageSelectMode && (
                  <div className="message-select-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedMessagesForDeletion.includes(messageKey)}
                      onChange={() => onToggleMessageSelection(messageKey)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                )}

                <div
                  className={`bubble ${showInlineMeta ? 'has-inline-meta' : ''} ${
                    useCompactInlineMeta ? 'has-compact-inline-meta' : ''
                  } ${useTrailingCompactMeta ? 'has-trailing-hover-corner' : ''} ${
                    hasImageAttachment ? 'has-image-attachment' : ''
                  } ${
                    hasAudioAttachment ? 'has-audio-attachment' : ''
                  } ${
                    hasDocumentAttachment ? 'has-document-attachment' : ''
                  } ${
                    hasDocumentCaption ? 'has-document-caption' : ''
                  } ${
                    showReplyPreview ? 'has-reply-preview' : ''
                  } ${
                    hasActiveMessageActions ? 'has-active-message-actions' : ''
                  }`}
                >
                  {!showMessageSelectMode && renderHoverReactionTrigger(message, messageKey)}
                  {renderReactionBar(message, messageKey)}
                  {showReplyPreview && (
                    <div
                      className={`message-reply-preview ${replySourceMessageKey ? 'is-clickable' : ''} ${
                        replySourceMessage?.sender === 'agent'
                          ? 'is-self-source'
                          : 'is-contact-source'
                      }`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (replySourceMessageKey) {
                          scrollToReferencedMessage(replySourceMessageKey);
                        }
                      }}
                    >
                      <div className="message-reply-label">
                        {replyLabel}
                      </div>
                      <div className="message-reply-text">{replyPreview}</div>
                    </div>
                  )}
                  {!showAttachmentCaption && !hasImageAttachment && displayText && !useCompactInlineMeta && displayText}
                  {useCompactInlineMeta && (
                    <div
                      className={`message-text-content message-text-content--compact-meta ${
                        useTrailingCompactMeta ? 'message-text-content--trailing-meta' : ''
                      }`}
                    >
                      {displayText}
                      <span className="message-inline-meta message-inline-meta--compact">
                        <span className="timestamp">
                          {formatMessageTime(message.timestamp || message.whatsappTimestamp || message.createdAt)}
                        </span>
                        {message.sender === 'agent' && getStatusIcon(message.status)}
                        {!useOverlayCompactHoverMenu &&
                          renderMessageHoverMenu({
                            message,
                            messageKey,
                            hasAttachment,
                            variant: 'inline'
                          })}
                      </span>
                    </div>
                  )}
                  {useOverlayCompactHoverMenu &&
                    renderMessageHoverMenu({
                      message,
                      messageKey,
                      hasAttachment,
                      variant: 'overlay',
                      contextClass: useTrailingCompactMeta ? 'trailing-text' : 'compact-inline'
                    })}
                  {renderAttachment(message, messageKey)}
                  {showAttachmentCaption && (
                    <div
                      className={`message-media-caption ${
                        useAttachmentCaptionTrailingMeta ? 'message-media-caption--trailing-meta' : ''
                      }`}
                    >
                      <span className="message-media-caption-text">{displayText}</span>
                      <span className="message-inline-meta message-inline-meta--compact">
                        <span className="timestamp">
                          {formatMessageTime(message.timestamp || message.whatsappTimestamp || message.createdAt)}
                        </span>
                        {message.sender === 'agent' && getStatusIcon(message.status)}
                      </span>
                    </div>
                  )}
                  {renderReactionChip(messageKey)}
                  {showInlineMeta && !useCompactInlineMeta && !showAttachmentCaption && (
                    <div className="message-inline-meta">
                      <span className="timestamp">
                        {formatMessageTime(message.timestamp || message.whatsappTimestamp || message.createdAt)}
                      </span>
                      {message.sender === 'agent' && getStatusIcon(message.status)}
                      {!hasDocumentAttachment &&
                        !hasAudioAttachment &&
                        renderMessageHoverMenu({
                          message,
                          messageKey,
                          hasAttachment,
                          variant: 'inline'
                        })}
                    </div>
                  )}
                </div>

                {!showInlineMeta && !hasImageAttachment && (
                  <div className="message-info">
                    <span className="timestamp">
                      {formatMessageTime(message.timestamp || message.whatsappTimestamp || message.createdAt)}
                    </span>
                    {message.sender === 'agent' && getStatusIcon(message.status)}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {showMessageSelectMode && (
            <div className="message-selection-actions sticky-bottom-actions">
              <button
                className="delete-selected-btn"
                onClick={deleteSelectedMessages}
                disabled={selectedMessagesForDeletion.length === 0}
                style={{ opacity: selectedMessagesForDeletion.length === 0 ? 0.5 : 1 }}
              >
                Delete Selected ({selectedMessagesForDeletion.length})
              </button>
            </div>
          )}

          {activeReplyContext && (
            <div className="message-reply-composer">
              <div className="message-reply-composer-copy">
                <span className="message-reply-composer-label">
                  {activeReplyContext.senderLabel}
                </span>
                <span className="message-reply-composer-text">
                  {activeReplyContext.preview}                
                </span>
              </div>
              <button
                type="button"
                className="message-reply-composer-close"
                aria-label="Cancel reply"
                title="Cancel reply"
                onClick={clearReplyContext}
              >
                <X size={15} />
              </button>
            </div>
          )}

          <input
            ref={attachmentInputRef}
            type="file"
            className="attachment-file-input"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            multiple
            onChange={handleAttachmentSelect}
          />

          <div className={`chat-input-row ${showVoiceRecorderComposer ? 'is-voice-recording' : ''}`}>
            <button
              className="attach-btn"
              type="button"
              aria-label="Attach file"
              title="Attach file"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={sendingMessage || !selectedConversation || showVoiceRecorderComposer}
            >
              <Paperclip size={18} />
            </button>

            <div
              className={`chat-input-field-shell ${
                showVoiceRecorderComposer ? 'is-voice-recording' : ''
              } ${isVoiceSending ? 'is-sending-voice' : ''}`.trim()}
            >
              {showVoiceRecorderComposer ? (
                <>
                  <button
                    type="button"
                    className="voice-recorder-cancel-btn"
                    aria-label="Discard voice message"
                    title="Discard voice message"
                    onClick={() =>
                      cancelVoiceRecording({
                        restoreComposer: true
                      })
                    }
                    disabled={isVoiceSending}
                  >
                    <X size={16} />
                  </button>
                  <div className="voice-recorder-status">
                    <span className="voice-recorder-pulse" aria-hidden="true" />
                    <span className="voice-recorder-label">
                      {isVoiceSending ? 'Sending voice message' : 'Recording voice message'}
                    </span>
                  </div>
                  <span className="voice-recorder-duration">
                    {formatVoiceRecorderDuration(voiceRecorderState.durationSeconds)}
                  </span>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    ref={messageInputRef}
                    className="chat-message-input"
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(event) => onMessageInputChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSendCurrentMessage();
                      }
                    }}
                  />

                  <div className="chat-input-inline-actions">
                    <div className="emoji-picker-wrap" ref={emojiPickerRef}>
                      <button
                        className="emoji-btn"
                        type="button"
                        aria-label="Open emoji picker"
                        title="Open emoji picker"
                        onClick={onToggleEmojiPicker}
                      >
                        <Smile size={18} />
                      </button>
                      {showEmojiPicker && (
                        <div className="emoji-picker-popup">
                          {commonEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="emoji-option-btn"
                              onClick={() => onEmojiInsert(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      className="voice-btn"
                      type="button"
                      aria-label="Record voice message"
                      title="Voice message"
                      onClick={handleVoiceMessageClick}
                      disabled={!selectedConversation || sendingMessage}
                    >
                      <Mic size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              className="chat-send-btn"
              onClick={showVoiceRecorderComposer ? handleSendVoiceRecording : handleSendCurrentMessage}
              disabled={
                showVoiceRecorderComposer
                  ? isVoiceSending
                  : !messageInput.trim() || sendingMessage
              }
              aria-label={
                showVoiceRecorderComposer
                  ? isVoiceSending
                    ? 'Sending voice message'
                    : 'Send voice message'
                  : sendingMessage
                    ? 'Sending message'
                    : 'Send message'
              }
              title={
                showVoiceRecorderComposer
                  ? isVoiceSending
                    ? 'Sending voice message'
                    : 'Send voice message'
                  : sendingMessage
                    ? 'Sending message'
                    : 'Send message'
              }
            >
              {isVoiceSending ? (
                <RotateCw size={18} className="chat-send-btn-spinner" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </>
    </div>
  );
};

export default ChatArea;
