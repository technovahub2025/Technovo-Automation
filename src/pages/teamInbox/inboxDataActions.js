import { whatsappService } from '../../services/whatsappService';
import { startLoadingTimeoutGuard } from '../../utils/loadingGuard';
import {
  mergeMessagePreservingReplyContext,
  mergeOrderedMessagesPreservingReplyContext
} from './replyMessageMergeUtils';

const DEFAULT_MESSAGES_PAGE_LIMIT = 30;
const CONVERSATION_LIST_LOADING_TIMEOUT_MS = 8000;

const normalizeMessagePageMeta = (meta = {}, fallbackLimit = DEFAULT_MESSAGES_PAGE_LIMIT) => ({
  limit: Number(meta?.limit || fallbackLimit) || fallbackLimit,
  hasMore: Boolean(meta?.hasMore),
  nextCursor: String(meta?.nextCursor || '').trim() || null
});

export const createInboxDataActions = ({
  normalizeConversation,
  setLoading,
  setConversations,
  setMessages,
  setMessagesLoading,
  setMessagesOlderLoading,
  setMessagesHasMore,
  selectedConversation,
  sendingMessage,
  messageInput,
  setSendingMessage,
  setMessageInput,
  appendMessageUnique,
  getConversationIdValue,
  conversationId,
  isRealName,
  getPhoneLookupKeys,
  setContactNameMap,
  activeMessagesConversationIdRef,
  messageLoadRequestIdRef,
  messageCacheRef,
  messagePaginationCacheRef,
  messageLoadPromiseMapRef,
  notifyActionFeedback,
  confirmAction
}) => {
  const notify = (message, tone = 'info') => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) return;
    if (typeof notifyActionFeedback === 'function') {
      notifyActionFeedback(nextMessage, tone);
      return;
    }
    console.warn('Team Inbox feedback callback missing:', nextMessage);
  };

  const confirmWithFallback = async (message) => {
    if (typeof confirmAction === 'function') {
      return Boolean(await confirmAction(String(message || '').trim()));
    }
    console.warn('Team Inbox confirm callback missing:', String(message || '').trim());
    return false;
  };

  const loadConversations = async ({ silent = false } = {}) => {
    const releaseLoadingGuard = silent
      ? () => true
      : startLoadingTimeoutGuard(
          () => setLoading(false),
          CONVERSATION_LIST_LOADING_TIMEOUT_MS
        );
    try {
      if (!silent) setLoading(true);
      const data = await whatsappService.getConversations();
      setConversations(Array.isArray(data) ? data.map(normalizeConversation) : []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      releaseLoadingGuard();
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (targetConversationId, options = {}) => {
    const normalizedConversationId = String(targetConversationId || '').trim();
    const loadOlder = Boolean(options?.loadOlder);
    const parsedPageLimit = Number(options?.limit);
    const pageLimit = Number.isFinite(parsedPageLimit)
      ? Math.max(20, Math.min(parsedPageLimit, 80))
      : DEFAULT_MESSAGES_PAGE_LIMIT;

    if (!normalizedConversationId) {
      activeMessagesConversationIdRef.current = '';
      messageLoadRequestIdRef.current += 1;
      setMessagesHasMore(false);
      setMessagesOlderLoading(false);
      setMessages([]);
      setMessagesLoading(false);
      return false;
    }

    const previousConversationId = String(activeMessagesConversationIdRef.current || '').trim();
    const isConversationSwitch = previousConversationId !== normalizedConversationId;
    const cachedMessages = messageCacheRef.current.get(normalizedConversationId);
    const cachedMeta = normalizeMessagePageMeta(
      messagePaginationCacheRef?.current?.get(normalizedConversationId),
      pageLimit
    );
    activeMessagesConversationIdRef.current = normalizedConversationId;

    if (!loadOlder && isConversationSwitch) {
      setMessages(Array.isArray(cachedMessages) ? cachedMessages : []);
    }

    if (!loadOlder) {
      setMessagesHasMore(Boolean(cachedMeta.hasMore));
      setMessagesOlderLoading(false);
    } else if (
      !Array.isArray(cachedMessages) ||
      cachedMessages.length === 0 ||
      !cachedMeta.hasMore ||
      !cachedMeta.nextCursor
    ) {
      return false;
    }

    const requestKey = loadOlder
      ? `${normalizedConversationId}::older::${cachedMeta.nextCursor}`
      : normalizedConversationId;
    const existingLoadPromise = messageLoadPromiseMapRef?.current?.get(requestKey);
    if (existingLoadPromise) {
      if (loadOlder) {
        setMessagesOlderLoading(true);
      } else {
        setMessagesLoading(!Array.isArray(cachedMessages) || cachedMessages.length === 0);
      }
      return existingLoadPromise;
    }

    const requestId = loadOlder ? Number(messageLoadRequestIdRef.current || 0) : Number(messageLoadRequestIdRef.current || 0) + 1;
    if (!loadOlder) {
      messageLoadRequestIdRef.current = requestId;
      setMessagesLoading(!Array.isArray(cachedMessages) || cachedMessages.length === 0);
    } else {
      setMessagesOlderLoading(true);
    }

    const loadPromise = whatsappService
      .getMessagesPage(normalizedConversationId, {
        limit: pageLimit,
        ...(loadOlder && cachedMeta.nextCursor ? { cursor: cachedMeta.nextCursor } : {})
      })
      .then((data) => {
        if (String(activeMessagesConversationIdRef.current || '').trim() !== normalizedConversationId) {
          return false;
        }
        if (!loadOlder && messageLoadRequestIdRef.current !== requestId) {
          return false;
        }

        const fetchedMessages = Array.isArray(data?.data) ? data.data : [];
        const fetchedMeta = normalizeMessagePageMeta(data?.meta, pageLimit);
        const currentCachedMessages = Array.isArray(
          messageCacheRef.current.get(normalizedConversationId)
        )
          ? messageCacheRef.current.get(normalizedConversationId)
          : [];

        const nextMessages = loadOlder
          ? mergeOrderedMessagesPreservingReplyContext(fetchedMessages, currentCachedMessages)
          : mergeOrderedMessagesPreservingReplyContext(currentCachedMessages, fetchedMessages);

        const shouldPreserveExistingPagination =
          !loadOlder &&
          currentCachedMessages.length > fetchedMessages.length &&
          messagePaginationCacheRef?.current?.has(normalizedConversationId);
        const nextMeta = shouldPreserveExistingPagination
          ? normalizeMessagePageMeta(
              messagePaginationCacheRef.current.get(normalizedConversationId),
              pageLimit
            )
          : fetchedMeta;

        messagePaginationCacheRef?.current?.set(normalizedConversationId, nextMeta);
        messageCacheRef.current.set(normalizedConversationId, nextMessages);
        setMessages(nextMessages);
        setMessagesHasMore(Boolean(nextMeta.hasMore));
        return true;
      })
      .catch((error) => {
        if (
          String(activeMessagesConversationIdRef.current || '').trim() === normalizedConversationId &&
          (!loadOlder ? messageLoadRequestIdRef.current === requestId : true)
        ) {
          console.error('Failed to load messages:', error);
        }
        return false;
      })
      .finally(() => {
        messageLoadPromiseMapRef?.current?.delete(requestKey);
        if (
          String(activeMessagesConversationIdRef.current || '').trim() === normalizedConversationId &&
          (!loadOlder ? messageLoadRequestIdRef.current === requestId : true)
        ) {
          setMessagesOlderLoading(false);
          setMessagesLoading(false);
        }
      });

    messageLoadPromiseMapRef?.current?.set(requestKey, loadPromise);
    return loadPromise;
  };

  const buildReplyMetadata = (replyContext = null) => {
    const sourceMessage =
      replyContext?.sourceMessage && typeof replyContext.sourceMessage === 'object'
        ? replyContext.sourceMessage
        : null;
    if (!sourceMessage) return {};

    const replyToMessageId = String(
      replyContext?.replyToMessageId || sourceMessage?._id || sourceMessage?.id || ''
    ).trim();
    const whatsappContextMessageId = String(
      replyContext?.whatsappContextMessageId || sourceMessage?.whatsappMessageId || ''
    ).trim();

    return {
      replyTo: sourceMessage,
      ...(replyToMessageId ? { replyToMessageId } : {}),
      ...(whatsappContextMessageId ? { whatsappContextMessageId } : {})
    };
  };

  const getMessageReferenceId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      return String(value?._id || value?.id || '').trim();
    }
    return String(value || '').trim();
  };

  const getAttachmentDownloadName = (message = {}) => {
    const attachment = message?.attachment || {};
    const originalFileName = String(attachment?.originalFileName || '').trim();
    if (originalFileName) return originalFileName;

    const caption = String(message?.mediaCaption || '').trim();
    if (caption && /\.[a-z0-9]{1,8}$/i.test(caption)) return caption;

    const mediaType = String(message?.mediaType || attachment?.fileCategory || 'attachment')
      .trim()
      .toLowerCase();
    const extension = String(attachment?.extension || '').trim().toLowerCase();
    return `${mediaType || 'attachment'}${extension ? `.${extension}` : ''}`;
  };

  const resolveOutgoingMediaType = (file = {}) => {
    const normalizedMimeType = String(file?.type || '').trim().toLowerCase();
    if (normalizedMimeType.startsWith('image/')) return 'image';
    if (normalizedMimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const triggerBrowserDownload = (objectUrl, fileName) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = fileName || 'attachment';
    downloadLink.rel = 'noopener';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  const downloadAttachmentFromUrl = async (sourceUrl, fileName) => {
    const normalizedUrl = String(sourceUrl || '').trim();
    if (!normalizedUrl) return false;

    if (normalizedUrl.startsWith('blob:') || normalizedUrl.startsWith('data:')) {
      triggerBrowserDownload(normalizedUrl, fileName);
      return true;
    }

    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const attachmentBlob = await response.blob();
    const objectUrl = window.URL.createObjectURL(attachmentBlob);
    try {
      triggerBrowserDownload(objectUrl, fileName);
    } finally {
      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1000);
    }

    return true;
  };

  const downloadPersistedAttachment = async (messageId, fileName) => {
    const response = await whatsappService.downloadAttachmentFile(messageId);
    if (!response?.success) {
      throw new Error(response?.error || 'Unable to download attachment');
    }

    const attachmentBlob =
      response?.data instanceof Blob ? response.data : new Blob([response?.data]);
    const objectUrl = window.URL.createObjectURL(attachmentBlob);
    try {
      triggerBrowserDownload(objectUrl, fileName);
    } finally {
      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1000);
    }

    return true;
  };

  const sendMessage = async (options = {}) => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return false;

    let optimisticId = null;
    let textToSend = '';
    const replyMetadata = buildReplyMetadata(options?.replyContext);
    try {
      setSendingMessage(true);
      const activeConversationId =
        getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
      textToSend = messageInput.trim();
      optimisticId = `temp-${Date.now()}`;

      // Optimistic UI: show outgoing message instantly.
      setMessageInput('');
      appendMessageUnique({
        _id: optimisticId,
        sender: 'agent',
        text: textToSend,
        status: 'sending',
        timestamp: new Date().toISOString(),
        conversationId: activeConversationId,
        ...replyMetadata
      });

      setConversations((prev) =>
        prev.map((conversation) =>
          getConversationIdValue(conversation) === activeConversationId
            ? {
                ...conversation,
                lastMessage: textToSend,
                lastMessageMediaType: '',
                lastMessageAttachmentName: '',
                lastMessageAttachmentPages: null,
                lastMessageTime: new Date().toISOString(),
                lastMessageFrom: 'agent'
              }
            : conversation
        )
      );

      const result = await whatsappService.sendMessage(
        selectedConversation.contactPhone,
        textToSend,
        activeConversationId,
        replyMetadata
      );

      if (result?.success) {
        const sentMessage = result.message || result.data?.message;

        if (sentMessage) {
          setMessages((prev) => {
            const sentId = sentMessage?._id ? String(sentMessage._id) : '';
            const sentWamid = sentMessage?.whatsappMessageId
              ? String(sentMessage.whatsappMessageId)
              : '';

            // Replace optimistic temp bubble.
            let next = prev.map((message) =>
              message._id === optimisticId
                ? {
                    ...mergeMessagePreservingReplyContext(message, sentMessage),
                    status: sentMessage.status || 'sent',
                    replyTo:
                      sentMessage?.replyTo ||
                      message?.replyTo ||
                      replyMetadata.replyTo,
                    replyToMessageId:
                      sentMessage?.replyToMessageId ||
                      message?.replyToMessageId ||
                      replyMetadata.replyToMessageId ||
                      '',
                    whatsappContextMessageId:
                      sentMessage?.whatsappContextMessageId ||
                      message?.whatsappContextMessageId ||
                      replyMetadata.whatsappContextMessageId ||
                      ''
                  }
                : message
            );

            // If temp wasn't found (already removed/replaced), ensure message exists once.
            const existsAfterReplace = next.some((message) => {
              const messageId = message?._id ? String(message._id) : '';
              const messageWamid = message?.whatsappMessageId
                ? String(message.whatsappMessageId)
                : '';
              return (sentId && messageId === sentId) || (sentWamid && messageWamid === sentWamid);
            });
            if (!existsAfterReplace) {
              next = [
                ...next,
                {
                  ...sentMessage,
                  status: sentMessage.status || 'sent',
                  ...replyMetadata
                }
              ];
            } else if (Object.keys(replyMetadata).length > 0) {
              next = next.map((message) => {
                const messageId = message?._id ? String(message._id) : '';
                const messageWamid = message?.whatsappMessageId
                  ? String(message.whatsappMessageId)
                  : '';
                const isTarget =
                  (sentId && messageId === sentId) || (sentWamid && messageWamid === sentWamid);
                return isTarget
                  ? {
                      ...message,
                      replyTo: message?.replyTo || replyMetadata.replyTo,
                      replyToMessageId:
                        message?.replyToMessageId || replyMetadata.replyToMessageId || '',
                      whatsappContextMessageId:
                        message?.whatsappContextMessageId ||
                        replyMetadata.whatsappContextMessageId ||
                        ''
                    }
                  : message;
              });
            }

            // De-duplicate same real message (can happen due to websocket + API race).
            const seen = new Set();
            next = next.filter((message) => {
              const messageId = message?._id ? String(message._id) : '';
              const messageWamid = message?.whatsappMessageId
                ? String(message.whatsappMessageId)
                : '';
              const key = messageId || messageWamid;
              if (!key) return true;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });

            return next;
          });
        } else {
          setMessages((prev) =>
            prev.map((message) =>
              message._id === optimisticId
                ? { ...message, status: 'sent' }
                : message
            )
          );
        }
        return true;
      } else {
        setMessages((prev) => prev.filter((message) => message._id !== optimisticId));
        setMessageInput(textToSend);
        console.error('Failed to send message:', result?.error);
        notify(result?.error || 'Message send failed', 'error');
        return false;
      }
    } catch (error) {
      if (optimisticId) {
        setMessages((prev) => prev.filter((message) => message._id !== optimisticId));
      }
      if (textToSend) {
        setMessageInput((prev) => prev || textToSend);
      }
      console.error('Error sending message:', error);
      notify(error?.message || 'Unable to send message', 'error');
      return false;
    } finally {
      setSendingMessage(false);
    }
  };

  const sendAttachment = async (file, options = {}) => {
    if (!file || !selectedConversation || sendingMessage) return false;

    let optimisticId = null;
    let localPreviewUrl = '';
    let shouldRevokeLocalPreview = false;
    const activeConversationId =
      getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
    const overrideCaption = Object.prototype.hasOwnProperty.call(options, 'captionOverride')
      ? String(options.captionOverride || '')
      : null;
    const caption = overrideCaption !== null ? overrideCaption.trim() : String(messageInput || '').trim();
    const replaceMessageId = String(options.replaceMessageId || '').trim();
    const mediaType = resolveOutgoingMediaType(file);
    const optimisticText =
      caption ||
      (mediaType === 'image' ? '[Image]' : mediaType === 'audio' ? '[Audio]' : '[Document]');
    const replyMetadata = buildReplyMetadata(options?.replyContext);
    const updateUploadProgress = (progressValue) => {
      setMessages((prev) =>
        prev.map((message) =>
          message._id === optimisticId
            ? {
                ...message,
                attachment: {
                  ...(message?.attachment || {}),
                  uploadProgress: progressValue
                }
              }
            : message
        )
      );
    };

    try {
      setSendingMessage(true);
      optimisticId = replaceMessageId || `temp-attachment-${Date.now()}`;
      localPreviewUrl = URL.createObjectURL(file);
      if (overrideCaption === null) {
        setMessageInput('');
      }

      const optimisticMessage = {
        _id: optimisticId,
        sender: 'agent',
        text: optimisticText,
        status: 'sending',
        timestamp: new Date().toISOString(),
        conversationId: activeConversationId,
        mediaType,
        mediaUrl: localPreviewUrl,
        ...replyMetadata,
        attachment: {
          originalFileName: file.name,
          mimeType: file.type,
          bytes: Number(file.size || 0),
          fileCategory: mediaType === 'image' ? 'image' : 'document',
          uploadProgress: 0,
          uploadError: '',
          _localFile: file
        }
      };

      if (replaceMessageId) {
        setMessages((prev) =>
          prev.map((message) =>
            message._id === replaceMessageId ? { ...message, ...optimisticMessage } : message
          )
        );
      } else {
        appendMessageUnique(optimisticMessage);
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          getConversationIdValue(conversation) === activeConversationId
            ? {
                ...conversation,
                lastMessage: optimisticText,
                lastMessageMediaType: mediaType,
                lastMessageAttachmentName: mediaType === 'document' ? String(file?.name || '').trim() : '',
                lastMessageAttachmentPages: null,
                lastMessageTime: new Date().toISOString(),
                lastMessageFrom: 'agent'
              }
            : conversation
        )
      );

      const result = await whatsappService.sendAttachmentMessage(
        selectedConversation.contactPhone,
        activeConversationId,
        file,
        caption,
        updateUploadProgress,
        replyMetadata
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Attachment send failed');
      }

      const sentMessage = result?.message || result?.data?.message;
      if (!sentMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            message._id === optimisticId ? { ...message, status: 'sent' } : message
          )
        );
      } else {
        shouldRevokeLocalPreview = Boolean(String(sentMessage?.mediaUrl || '').trim());
        setConversations((prev) =>
          prev.map((conversation) =>
            getConversationIdValue(conversation) === activeConversationId
              ? {
                  ...conversation,
                  lastMessage: String(sentMessage?.text || optimisticText || '').trim(),
                  lastMessageMediaType: String(sentMessage?.mediaType || mediaType || '').trim(),
                  lastMessageAttachmentName:
                    String(sentMessage?.mediaType || mediaType || '').trim().toLowerCase() ===
                    'document'
                      ? String(
                          sentMessage?.attachment?.originalFileName || file?.name || ''
                        ).trim()
                      : '',
                  lastMessageAttachmentPages:
                    String(sentMessage?.mediaType || mediaType || '').trim().toLowerCase() ===
                    'document'
                      ? Number(sentMessage?.attachment?.pages || 0) || null
                      : null,
                  lastMessageTime:
                    sentMessage?.timestamp || sentMessage?.createdAt || new Date().toISOString(),
                  lastMessageFrom: 'agent'
                }
              : conversation
          )
        );

        setMessages((prev) => {
          let next = prev.map((message) =>
            message._id === optimisticId
              ? {
                  ...mergeMessagePreservingReplyContext(message, sentMessage),
                  status: sentMessage.status || 'sent',
                  replyTo: sentMessage?.replyTo || message?.replyTo,
                  replyToMessageId:
                    sentMessage?.replyToMessageId || message?.replyToMessageId || '',
                  whatsappContextMessageId:
                    sentMessage?.whatsappContextMessageId ||
                    message?.whatsappContextMessageId ||
                    '',
                  attachment: {
                    ...(sentMessage?.attachment || {}),
                    uploadProgress: null,
                    uploadError: ''
                  }
                }
              : message
          );

          const sentId = String(sentMessage?._id || '').trim();
          if (sentId && !next.some((message) => String(message?._id || '') === sentId)) {
            next = [
              ...next,
              {
                ...sentMessage,
                status: sentMessage.status || 'sent',
                ...replyMetadata
              }
            ];
          }

          const seen = new Set();
          return next.filter((message) => {
            const key = String(message?._id || message?.whatsappMessageId || '').trim();
            if (!key) return true;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
      }
      return true;
    } catch (error) {
      if (optimisticId) {
        setMessages((prev) =>
          prev.map((message) =>
            message._id === optimisticId
              ? {
                  ...message,
                  status: 'failed',
                  attachment: {
                    ...(message?.attachment || {}),
                    uploadProgress: null,
                    uploadError: error?.message || 'Upload failed',
                    _localFile: file
                  }
                }
              : message
          )
        );
      }
      if (overrideCaption === null) {
        setMessageInput((prev) => prev || caption);
      }
      console.error('Error sending attachment:', error);
      notify(error?.message || 'Unable to send attachment', 'error');
      return false;
    } finally {
      if (!replaceMessageId && localPreviewUrl && shouldRevokeLocalPreview) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      setSendingMessage(false);
    }
  };

  const sendReaction = async (targetMessage, emoji = '') => {
    if (!selectedConversation || !targetMessage) return false;

    const activeConversationId =
      getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
    const targetMessageId = getMessageReferenceId(targetMessage);
    const targetWhatsAppMessageId = String(targetMessage?.whatsappMessageId || '').trim();
    if (!activeConversationId || !selectedConversation.contactPhone || !targetWhatsAppMessageId) {
      notify('This message cannot be reacted to yet.', 'info');
      return false;
    }

    const normalizedEmoji = String(emoji || '').trim();
    const optimisticId = `temp-reaction-${Date.now()}`;
    const optimisticReactionMessage = {
      _id: optimisticId,
      sender: 'agent',
      text: normalizedEmoji ? `Reacted with ${normalizedEmoji}` : '[Reaction removed]',
      status: 'sending',
      timestamp: new Date().toISOString(),
      conversationId: activeConversationId,
      rawMessageType: 'reaction',
      reactionEmoji: normalizedEmoji,
      whatsappContextMessageId: targetWhatsAppMessageId
    };

    appendMessageUnique(optimisticReactionMessage);

    try {
      const result = await whatsappService.sendReactionMessage(
        selectedConversation.contactPhone,
        activeConversationId,
        targetMessageId,
        targetWhatsAppMessageId,
        normalizedEmoji
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Reaction send failed');
      }

      const sentMessage = result?.message || result?.data?.message;
      if (!sentMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            String(message?._id || '') === optimisticId
              ? { ...message, status: 'sent' }
              : message
          )
        );
        return true;
      }

      setMessages((prev) => {
        const sentId = String(sentMessage?._id || '').trim();
        const sentWamid = String(sentMessage?.whatsappMessageId || '').trim();
        let next = prev.map((message) =>
          String(message?._id || '') === optimisticId
            ? mergeMessagePreservingReplyContext(message, sentMessage)
            : message
        );

        const existsAfterReplace = next.some((message) => {
          const messageId = String(message?._id || '').trim();
          const messageWamid = String(message?.whatsappMessageId || '').trim();
          return (sentId && messageId === sentId) || (sentWamid && messageWamid === sentWamid);
        });

        if (!existsAfterReplace) {
          next = [...next, sentMessage];
        }

        const seen = new Set();
        return next.filter((message) => {
          const key = String(message?._id || message?.whatsappMessageId || '').trim();
          if (!key) return true;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      return true;
    } catch (error) {
      setMessages((prev) => prev.filter((message) => String(message?._id || '') !== optimisticId));
      console.error('Error sending reaction:', error);
      notify(error?.message || 'Unable to send reaction', 'error');
      return false;
    }
  };

  const openAttachment = async (message, mode = 'view') => {
    try {
      const normalizedMode = String(mode || 'view').trim().toLowerCase();
      const isDownloadMode = normalizedMode === 'download';
      const fallbackUrl = String(message?.mediaUrl || '').trim();
      const fileName = getAttachmentDownloadName(message);
      const buildViewResult = (url) => ({
        success: true,
        mode: 'view',
        url: String(url || '').trim(),
        fileName
      });
      const messageId = String(message?._id || '').trim();
      if (!messageId) {
        if (fallbackUrl) {
          if (isDownloadMode) {
            return await downloadAttachmentFromUrl(fallbackUrl, fileName);
          }
          return buildViewResult(fallbackUrl);
        }
        return false;
      }

      if (messageId.startsWith('temp-')) {
        if (fallbackUrl) {
          if (isDownloadMode) {
            return await downloadAttachmentFromUrl(fallbackUrl, fileName);
          }
          return buildViewResult(fallbackUrl);
        }
        return false;
      }

      if (isDownloadMode) {
        return await downloadPersistedAttachment(messageId, fileName);
      }

      const response = await whatsappService.getAttachmentSignedUrl(messageId, normalizedMode, 300);
      if (!response?.success) {
        if (fallbackUrl) {
          if (isDownloadMode) {
            return await downloadAttachmentFromUrl(fallbackUrl, fileName);
          }
          return buildViewResult(fallbackUrl);
        }
        notify(response?.error || 'Unable to open attachment', 'error');
        return false;
      }

      const targetUrl = String(response?.data?.url || '').trim();
      if (!targetUrl) {
        notify('Attachment URL unavailable', 'error');
        return false;
      }

      return buildViewResult(targetUrl);
    } catch (error) {
      console.error('Error opening attachment:', error);
      notify(error?.message || 'Unable to open attachment', 'error');
      return false;
    }
  };

  const deleteAttachment = async (message) => {
    const messageId = String(message?._id || '').trim();
    if (!messageId) return;

    if (messageId.startsWith('temp-')) {
      setMessages((prev) => prev.filter((item) => String(item?._id || '') !== messageId));
      return;
    }

    const confirmed = await confirmWithFallback('Delete this attachment from this chat?');
    if (!confirmed) return;

    const result = await whatsappService.deleteAttachmentMessage(messageId);
    if (!result?.success) {
      notify(result?.error || 'Failed to delete attachment', 'error');
      return;
    }

    setMessages((prev) =>
      prev.map((item) =>
        String(item?._id || '') === messageId
          ? {
              ...item,
              mediaUrl: '',
              mediaCaption: '',
              attachment: {
                ...(item?.attachment || {}),
                deletedAt: new Date().toISOString()
              }
            }
          : item
      )
    );
  };

  const deleteMessage = async (message) => {
    const messageId = String(message?._id || '').trim();
    if (!messageId) return;

    const attachmentDeleted = Boolean(message?.attachment?.deletedAt);
    const hasAttachment =
      !attachmentDeleted &&
      (Boolean(message?.mediaUrl) ||
        Boolean(message?.attachment?.publicId) ||
        Boolean(message?.attachment?.originalFileName));

    if (hasAttachment) {
      await deleteAttachment(message);
      return;
    }

    if (messageId.startsWith('temp-')) {
      setMessages((prev) => prev.filter((item) => String(item?._id || '') !== messageId));
      return;
    }

    const confirmed = await confirmWithFallback('Delete this message from this chat?');
    if (!confirmed) return;

    const result = await whatsappService.deleteSelectedMessages([messageId]);
    if (!result?.success) {
      notify(result?.error || 'Failed to delete message', 'error');
      return;
    }

    setMessages((prev) => prev.filter((item) => String(item?._id || '') !== messageId));
  };

  const retryAttachment = async (message) => {
    if (!message) return;
    const localFile = message?.attachment?._localFile;
    if (!localFile) {
      notify('Attachment file is no longer available to retry.', 'info');
      return;
    }
    const rawText = String(message?.text || '').trim();
    const isPlaceholder = rawText === '[Image]' || rawText === '[Document]';
    const captionOverride = isPlaceholder ? '' : rawText;
    await sendAttachment(localFile, {
      captionOverride,
      replaceMessageId: message?._id
    });
  };

  const markAsRead = async (targetConversationId) => {
    try {
      await whatsappService.markConversationAsRead(targetConversationId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation._id === targetConversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  };

  const loadContacts = async ({ silent = true } = {}) => {
    try {
      const data = await whatsappService.getContacts();
      const contacts = Array.isArray(data) ? data : [];
      const nextMap = {};
      contacts.forEach((contact) => {
        const name = String(contact?.name || '').trim();
        if (!isRealName(name)) return;
        getPhoneLookupKeys(contact?.phone).forEach((key) => {
          if (!nextMap[key]) nextMap[key] = name;
        });
      });
      setContactNameMap(nextMap);
    } catch (error) {
      if (!silent) {
        console.error('Failed to load contacts:', error);
      }
    }
  };

  return {
    loadConversations,
    loadMessages,
    sendMessage,
    sendReaction,
    sendAttachment,
    openAttachment,
    deleteAttachment,
    deleteMessage,
    retryAttachment,
    markAsRead,
    loadContacts
  };
};
