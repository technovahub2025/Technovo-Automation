import { useEffect, useRef } from 'react';
import webSocketService from '../../services/websocketService';

const MESSAGE_STATUS_BATCH_WINDOW_MS = 120;
const LIST_REFRESH_DEBOUNCE_MS = 180;
const LIST_REFRESH_MIN_INTERVAL_MS = 1500;

const getConversationId = (conversation) =>
  String(conversation?._id || conversation?.id || '').trim();

const getErrorMessageFromPayload = (payload = {}) =>
  String(
    payload?.errorMessage ||
      payload?.message?.errorMessage ||
      payload?.error ||
      payload?.message ||
      ''
  ).trim();

const mergeMessageStatus = (message, update) => {
  const nextStatus = String(update?.status || '').trim().toLowerCase();
  const currentStatus = String(message?.status || '').trim().toLowerCase();
  const nextErrorMessage =
    nextStatus === 'failed'
      ? getErrorMessageFromPayload(update) || message?.errorMessage || ''
      : '';

  return {
    ...message,
    status: nextStatus || currentStatus,
    errorMessage: nextErrorMessage
  };
};

export const useInboxRealtimeEffects = ({
  currentUserId,
  currentCompanyId,
  activeConversationId,
  notificationMode,
  setWsConnected,
  hasBootstrapCache,
  loadConversations,
  loadContacts,
  hasRealContactName,
  getMappedContactName,
  setConversations,
  enrichConversationIdentity,
  selectedConversationRef,
  getUnreadCount,
  setMessages,
  appendMessageUnique,
  markAsRead,
  scheduleRealtimeResync,
  loadMessages,
  setSelectedConversation,
  applyLeadScoreUpdateToConversation,
  setSidebarRefreshing,
  realtimeResyncTimerRef,
  setUserPresenceMap,
  setConversationTypingState,
  setInboxDebugInfo,
  notifyActionFeedback,
  threadFreshSyncAtRef
}) => {
  const lastConversationListRefreshAtRef = useRef(0);
  const conversationListRefreshTimerRef = useRef(null);
  const pendingConversationListRefreshReasonRef = useRef('unknown');
  const messageStatusFlushTimerRef = useRef(null);
  const pendingMessageStatusUpdatesRef = useRef(new Map());

  const notify = (message, tone = 'info') => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) return;
    if (typeof notifyActionFeedback === 'function') {
      notifyActionFeedback(nextMessage, tone);
      return;
    }
    console.warn('Team Inbox feedback callback missing:', nextMessage);
  };

  const queueConversationListRefresh = ({
    silent = true,
    minIntervalMs = LIST_REFRESH_MIN_INTERVAL_MS,
    debounceMs = LIST_REFRESH_DEBOUNCE_MS,
    reason = 'unknown'
  } = {}) => {
    if (typeof loadConversations !== 'function') return;

    const now = Date.now();
    const elapsed = now - Number(lastConversationListRefreshAtRef.current || 0);
    const delay = Math.max(0, elapsed >= minIntervalMs ? debounceMs : minIntervalMs - elapsed);
    pendingConversationListRefreshReasonRef.current =
      String(reason || 'unknown').trim() || 'unknown';

    if (conversationListRefreshTimerRef.current) return;

    conversationListRefreshTimerRef.current = window.setTimeout(() => {
      conversationListRefreshTimerRef.current = null;
      lastConversationListRefreshAtRef.current = Date.now();
      if (typeof setSidebarRefreshing === 'function') {
        setSidebarRefreshing(true);
      }
      Promise.resolve(loadConversations({ silent }))
        .catch(() => undefined)
        .finally(() => {
          if (typeof setSidebarRefreshing === 'function') {
            setSidebarRefreshing(false);
          }
        });
    }, delay);
  };

  const flushMessageStatusBatch = (batch = []) => {
    const safeBatch = Array.isArray(batch) ? batch.filter(Boolean) : [];
    if (safeBatch.length === 0) return;

    setMessages((prev) => {
      const nextMessages = prev.slice();
      let mutated = false;

      safeBatch.forEach((update) => {
        const updateConversationId = String(update?.conversationId || '').trim();
        const updateMessageIds = new Set(
          [update?.messageId, update?.whatsappMessageId].filter(Boolean).map((value) => String(value))
        );

        for (let index = 0; index < nextMessages.length; index += 1) {
          const message = nextMessages[index];
          const messageIds = [message?._id, message?.messageId, message?.whatsappMessageId]
            .filter(Boolean)
            .map((value) => String(value));
          const matchedById = messageIds.some((id) => updateMessageIds.has(id));
          const matchedByConversation =
            !matchedById &&
            updateConversationId &&
            String(message?.conversationId || '').trim() === updateConversationId &&
            String(message?.sender || '').trim().toLowerCase() === 'agent';

          if (!matchedById && !matchedByConversation) continue;
          const merged = mergeMessageStatus(message, update);
          if (merged.status !== message.status || merged.errorMessage !== message.errorMessage) {
            nextMessages[index] = merged;
            mutated = true;
          }
        }
      });

      return mutated ? nextMessages : prev;
    });

    setConversations((prev) => {
      let next = prev;
      let mutated = false;

      safeBatch.forEach((update) => {
        const eventConversationId = String(update?.conversationId || '').trim();
        if (!eventConversationId) return;

        const matchingConversation = Array.isArray(next)
          ? next.find((conversation) => getConversationId(conversation) === eventConversationId)
          : null;
        if (!matchingConversation) return;

        const nextConversation = {
          ...matchingConversation,
          lastMessageStatus: String(update?.status || '').trim().toLowerCase() || matchingConversation?.lastMessageStatus || '',
          lastMessageWhatsappMessageId:
            String(update?.messageId || update?.whatsappMessageId || '').trim() ||
            String(matchingConversation?.lastMessageWhatsappMessageId || '').trim(),
          ...(String(update?.status || '').trim().toLowerCase() === 'read' ||
          String(update?.status || '').trim().toLowerCase() === 'delivered'
            ? { lastMessageFrom: 'agent' }
            : {})
        };

        next = next.map((conversation) =>
          getConversationId(conversation) === eventConversationId ? nextConversation : conversation
        );
        mutated = true;
      });

      return mutated ? next : prev;
    });

    setSelectedConversation((prev) => {
      if (!prev) return prev;
      const selectedConversationId = getConversationId(prev);
      let next = prev;
      let mutated = false;

      safeBatch.forEach((update) => {
        if (getConversationId({ _id: update?.conversationId }) !== selectedConversationId) return;
        const nextStatus = String(update?.status || '').trim().toLowerCase();
        next = {
          ...next,
          lastMessageStatus: nextStatus || next?.lastMessageStatus || '',
          lastMessageWhatsappMessageId:
            String(update?.messageId || update?.whatsappMessageId || '').trim() ||
            String(next?.lastMessageWhatsappMessageId || '').trim(),
          ...(nextStatus === 'read' || nextStatus === 'delivered'
            ? { lastMessageFrom: 'agent' }
            : {})
        };
        mutated = true;
      });

      return mutated ? next : prev;
    });
  };

  const queueMessageStatusUpdate = (() => {
    let timer = null;
    return (data = {}) => {
      const normalized = {
        conversationId: String(data?.conversationId || '').trim(),
        status: String(data?.status || '').trim().toLowerCase(),
        messageId: String(
          data?.messageId ||
            data?.id ||
            data?.whatsappMessageId ||
            data?.message?._id ||
            data?.message?.messageId ||
            data?.message?.whatsappMessageId ||
            ''
        ).trim(),
        whatsappMessageId: String(data?.whatsappMessageId || data?.message?.whatsappMessageId || '').trim(),
        errorMessage: getErrorMessageFromPayload(data),
        mediaPipelineRequestId: String(data?.mediaPipelineRequestId || '').trim()
      };

      if (!normalized.conversationId && !normalized.messageId && !normalized.whatsappMessageId) return;

      const batchKey = [
        normalized.conversationId || 'unknown-conversation',
        normalized.messageId || 'unknown-message',
        normalized.mediaPipelineRequestId || 'no-media'
      ].join('::');

      const existing = pendingMessageStatusUpdatesRef.current.get(batchKey);
      pendingMessageStatusUpdatesRef.current.set(batchKey, {
        ...(existing || {}),
        ...normalized
      });

      if (timer) return;
      timer = window.setTimeout(() => {
        timer = null;
        const batch = Array.from(pendingMessageStatusUpdatesRef.current.values());
        pendingMessageStatusUpdatesRef.current.clear();
        flushMessageStatusBatch(batch);
      }, MESSAGE_STATUS_BATCH_WINDOW_MS);
      messageStatusFlushTimerRef.current = timer;
    };
  })();

  useEffect(() => {
    if (typeof setWsConnected === 'function') {
      setWsConnected(Boolean(webSocketService.isConnected?.()));
    }

    const handleConnected = () => {
      if (typeof setWsConnected === 'function') setWsConnected(true);
    };
    const handleDisconnected = () => {
      if (typeof setWsConnected === 'function') setWsConnected(false);
    };
    const handleConnectError = () => {
      if (typeof setWsConnected === 'function') setWsConnected(false);
    };

    const handleMessageSent = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      if (conversationId && activeConversationId && conversationId !== activeConversationId) {
        queueConversationListRefresh({ silent: true, reason: 'message_sent_other_thread' });
        return;
      }

      if (conversationId && typeof scheduleRealtimeResync === 'function') {
        scheduleRealtimeResync(conversationId);
      }
    };

    const handleNewMessage = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      const activeId = String(activeConversationId || '').trim();
      const incomingMessage = data?.message || data;
      const targetConversationId = String(incomingMessage?.conversationId || conversationId || '').trim();

      if (targetConversationId && activeId && targetConversationId === activeId) {
        if (typeof appendMessageUnique === 'function') {
          appendMessageUnique(incomingMessage);
        } else if (typeof setMessages === 'function') {
          setMessages((prev) => (prev.some((message) => String(message?._id || '') === String(incomingMessage?._id || '')) ? prev : [...prev, incomingMessage]));
        }
        if (typeof scheduleRealtimeResync === 'function') {
          scheduleRealtimeResync(targetConversationId);
        }
        return;
      }

      queueConversationListRefresh({ silent: true, reason: 'new_message' });
    };

    const handleConversationRead = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      if (!conversationId) return;
      if (typeof markAsRead === 'function') {
        markAsRead(conversationId);
      }
      queueConversationListRefresh({ silent: true, reason: 'conversation_read' });
    };

    const handleMessageStatus = (data = {}) => {
      const incomingStatus = String(data?.status || '').toLowerCase();
      const mediaPipelineRequestId = String(data?.mediaPipelineRequestId || '').trim();
      const backendErrorMessage = String(
        data?.errorMessage ||
          data?.errorDetails ||
          data?.errorCode ||
          data?.message?.errorMessage ||
          data?.message?.errorDetails ||
          data?.message?.errorCode ||
          data?.error ||
          data?.message ||
          ''
      ).trim();

      queueMessageStatusUpdate(data);

      if (incomingStatus && mediaPipelineRequestId) {
        const statusLabel =
          incomingStatus === 'read'
            ? 'Read'
            : incomingStatus === 'delivered'
              ? 'Delivered'
              : incomingStatus === 'failed'
                ? 'Failed'
                : incomingStatus === 'sent'
                  ? 'Sent'
                  : incomingStatus;
        const friendlyFailureReason =
          incomingStatus === 'failed'
            ? backendErrorMessage ||
              'WhatsApp rejected the media send. Please check the 24-hour window, media upload response, or template policy.'
            : '';
        const statusMessage =
          incomingStatus === 'failed' && friendlyFailureReason
            ? `Media failed: ${friendlyFailureReason}`
            : `Media ${statusLabel}`;

        notify(
          `${statusMessage}${mediaPipelineRequestId ? ` • ${mediaPipelineRequestId}` : ''}`,
          incomingStatus === 'failed' ? 'error' : 'info'
        );
      }

      if (typeof scheduleRealtimeResync === 'function') {
        const conversationId = String(data?.conversationId || '').trim();
        const activeId = String(activeConversationId || '').trim();
        if (conversationId && conversationId === activeId) {
          scheduleRealtimeResync(conversationId);
        }
      }
    };

    const handleLeadScoreUpdated = (data = {}) => {
      if (typeof applyLeadScoreUpdateToConversation === 'function') {
        applyLeadScoreUpdateToConversation(data);
      }
    };

    const handlePresenceUpdate = (data = {}) => {
      const userId = String(data?.userId || '').trim();
      if (!userId || typeof setUserPresenceMap !== 'function') return;
      setUserPresenceMap((prev) => ({
        ...prev,
        [userId]: {
          ...(prev?.[userId] || {}),
          status: String(data?.status || '').trim(),
          updatedAt: data?.updatedAt || new Date().toISOString()
        }
      }));
    };

    const handleTypingUpdate = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      const userId = String(data?.userId || '').trim();
      if (!conversationId || !userId || typeof setConversationTypingState !== 'function') return;
      setConversationTypingState((prev) => {
        const current = Array.isArray(prev?.[conversationId]) ? prev[conversationId] : [];
        const nextEntries = current.filter((entry) => String(entry?.userId || '') !== userId);
        if (Boolean(data?.isTyping)) {
          nextEntries.push({
            userId,
            conversationId,
            displayName: String(data?.displayName || data?.name || '').trim(),
            isTyping: true,
            updatedAt: data?.updatedAt || new Date().toISOString()
          });
        }
        return {
          ...(prev || {}),
          [conversationId]: nextEntries
        };
      });
    };

    const handleCacheInvalidated = (data = {}) => {
      const eventConversationId = String(data?.conversationId || '').trim();
      const activeId = String(activeConversationId || '').trim();
      if (eventConversationId && activeId && eventConversationId === activeId) {
        if (typeof scheduleRealtimeResync === 'function') {
          scheduleRealtimeResync(activeConversationId);
        }
        return;
      }
      queueConversationListRefresh({ silent: true, reason: 'cache_invalidated' });
    };

    webSocketService.on('connected', handleConnected);
    webSocketService.on('disconnected', handleDisconnected);
    webSocketService.on('connect_error', handleConnectError);
    webSocketService.on('message_sent', handleMessageSent);
    webSocketService.on('new_message', handleNewMessage);
    webSocketService.on('message_status', handleMessageStatus);
    webSocketService.on('conversation_read', handleConversationRead);
    webSocketService.on('lead_score_updated', handleLeadScoreUpdated);
    webSocketService.on('crm_changed', queueConversationListRefresh);
    webSocketService.on('team_inbox_cache_invalidated', handleCacheInvalidated);
    webSocketService.on('presence', handlePresenceUpdate);
    webSocketService.on('typing', handleTypingUpdate);

    webSocketService
      .connect(currentUserId || 'team-inbox-user', (payload) => {
        if (payload?.type === 'message_status') handleMessageStatus(payload);
        if (payload?.type === 'new_message') handleNewMessage(payload);
      })
      .catch((error) => {
        console.error('Team Inbox websocket connection failed:', error);
        if (typeof setWsConnected === 'function') setWsConnected(false);
      });

    if (hasBootstrapCache && typeof loadContacts === 'function' && !hasRealContactName) {
      void loadContacts({ silent: true }).catch(() => undefined);
    }

    return () => {
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('connect_error', handleConnectError);
      webSocketService.off('message_sent', handleMessageSent);
      webSocketService.off('new_message', handleNewMessage);
      webSocketService.off('message_status', handleMessageStatus);
      webSocketService.off('conversation_read', handleConversationRead);
      webSocketService.off('lead_score_updated', handleLeadScoreUpdated);
      webSocketService.off('crm_changed', queueConversationListRefresh);
      webSocketService.off('team_inbox_cache_invalidated', handleCacheInvalidated);
      webSocketService.off('presence', handlePresenceUpdate);
      webSocketService.off('typing', handleTypingUpdate);

      if (conversationListRefreshTimerRef.current) {
        clearTimeout(conversationListRefreshTimerRef.current);
        conversationListRefreshTimerRef.current = null;
      }
      if (messageStatusFlushTimerRef.current) {
        clearTimeout(messageStatusFlushTimerRef.current);
        messageStatusFlushTimerRef.current = null;
      }
      if (realtimeResyncTimerRef?.current) {
        clearTimeout(realtimeResyncTimerRef.current);
        realtimeResyncTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeConversationId,
    applyLeadScoreUpdateToConversation,
    currentCompanyId,
    currentUserId,
    hasBootstrapCache,
    hasRealContactName,
    loadContacts,
    loadConversations,
    markAsRead,
    notifyActionFeedback,
    scheduleRealtimeResync,
    setConversationTypingState,
    setInboxDebugInfo,
    setMessages,
    setSelectedConversation,
    setSidebarRefreshing,
    setUserPresenceMap,
    setWsConnected
  ]);

  useEffect(() => {
    if (!threadFreshSyncAtRef) return undefined;
    if (!activeConversationId) return undefined;
    threadFreshSyncAtRef.current = Number(threadFreshSyncAtRef.current || 0) || 0;
    return undefined;
  }, [activeConversationId, threadFreshSyncAtRef]);
};
