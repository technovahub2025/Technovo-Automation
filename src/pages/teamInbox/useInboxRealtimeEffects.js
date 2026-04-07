import { useEffect, useRef } from 'react';
import webSocketService from '../../services/websocketService';
import { mergeMessagePreservingReplyContext } from './replyMessageMergeUtils';
import { showIncomingMessageSystemNotification } from './teamInboxNotificationUtils';

export const useInboxRealtimeEffects = ({
  currentUserId,
  notificationMode,
  setWsConnected,
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
  realtimeResyncTimerRef
}) => {
  const notifiedIncomingMessageKeysRef = useRef(new Set());
  const callbacksRef = useRef({
    loadConversations,
    loadContacts,
    hasRealContactName,
    getMappedContactName,
    enrichConversationIdentity,
    getUnreadCount,
    appendMessageUnique,
    markAsRead,
    scheduleRealtimeResync,
    loadMessages,
    applyLeadScoreUpdateToConversation
  });

  useEffect(() => {
    callbacksRef.current = {
      loadConversations,
      loadContacts,
      hasRealContactName,
      getMappedContactName,
      enrichConversationIdentity,
      getUnreadCount,
      appendMessageUnique,
      markAsRead,
      scheduleRealtimeResync,
      loadMessages,
      applyLeadScoreUpdateToConversation
    };
  }, [
    loadConversations,
    loadContacts,
    hasRealContactName,
    getMappedContactName,
    enrichConversationIdentity,
    getUnreadCount,
    appendMessageUnique,
    markAsRead,
    scheduleRealtimeResync,
    loadMessages,
    applyLeadScoreUpdateToConversation
  ]);

  useEffect(() => {
    const handleConnect = () => {
      setWsConnected(true);
      callbacksRef.current.loadConversations({ silent: true });
      callbacksRef.current.loadContacts({ silent: true });
      console.log('? WebSocket connected in TeamInbox');
    };

    const handleDisconnect = () => {
      setWsConnected(false);
      console.log('? WebSocket disconnected in TeamInbox');
    };

    const handleNewMessage = (data) => {
      console.log('?? New message received:', data);

      const incomingConversationRaw = data?.conversation || {};
      if (
        !callbacksRef.current.hasRealContactName(incomingConversationRaw) &&
        !callbacksRef.current.getMappedContactName(incomingConversationRaw?.contactPhone)
      ) {
        callbacksRef.current.loadContacts({ silent: true });
      }

      setConversations((prev) => {
        const incomingConversation = callbacksRef.current.enrichConversationIdentity(
          data?.conversation || {},
          [...prev, selectedConversationRef.current].filter(Boolean)
        );
        const activeConversation = selectedConversationRef.current;
        const isSelectedConversation =
          activeConversation && activeConversation._id === incomingConversation._id;
        const isIncomingContactMessage = data?.message?.sender === 'contact';

        let found = false;
        const updated = prev.map((conversation) => {
          if (conversation._id !== incomingConversation._id) return conversation;

          found = true;
          const mergedConversation = callbacksRef.current.enrichConversationIdentity(
            { ...conversation, ...incomingConversation },
            [conversation, incomingConversation, ...prev]
          );

          if (isSelectedConversation && isIncomingContactMessage) {
            mergedConversation.unreadCount = 0;
          } else if (isIncomingContactMessage) {
            mergedConversation.unreadCount = Math.max(
              callbacksRef.current.getUnreadCount(incomingConversation),
              callbacksRef.current.getUnreadCount(conversation) + 1,
              1
            );
          }

          return mergedConversation;
        });

        if (!found && incomingConversation._id) {
          updated.unshift(
            callbacksRef.current.enrichConversationIdentity(
              {
                ...incomingConversation,
                unreadCount:
                  isSelectedConversation && isIncomingContactMessage
                    ? 0
                    : Math.max(
                        callbacksRef.current.getUnreadCount(incomingConversation),
                        isIncomingContactMessage ? 1 : 0
                      )
              },
              [...prev, selectedConversationRef.current].filter(Boolean)
            )
          );
        }

        return updated.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      });

      const activeConversation = selectedConversationRef.current;
      const currentConversationId = String(data?.conversation?._id || '').trim();
      const isSelectedConversation =
        Boolean(activeConversation?._id) &&
        String(activeConversation._id).trim() === currentConversationId;
      const incoming = data?.message || {};
      const isIncomingContactMessage = String(incoming?.sender || '').trim().toLowerCase() === 'contact';
      const incomingNotificationKey =
        String(incoming?._id || incoming?.whatsappMessageId || '').trim() ||
        `${currentConversationId}:${String(
          incoming?.timestamp || incoming?.whatsappTimestamp || incoming?.createdAt || Date.now()
        ).trim()}:${String(incoming?.text || incoming?.mediaType || '').trim()}`;

      if (isIncomingContactMessage && incomingNotificationKey) {
        const notifiedKeys = notifiedIncomingMessageKeysRef.current;
        if (!notifiedKeys.has(incomingNotificationKey)) {
          notifiedKeys.add(incomingNotificationKey);
          if (notifiedKeys.size > 500) {
            const firstKey = notifiedKeys.values().next().value;
            if (firstKey) notifiedKeys.delete(firstKey);
          }

          const notificationConversation = callbacksRef.current.enrichConversationIdentity(
            data?.conversation || {},
            [activeConversation].filter(Boolean)
          );

          showIncomingMessageSystemNotification({
            message: incoming,
            conversation: notificationConversation,
            isSelectedConversation,
            mode: notificationMode
          }).catch((error) => {
            console.error('Failed to show Team Inbox system notification:', error);
          });
        }
      }

      if (activeConversation && activeConversation._id === data?.conversation?._id) {
        if (incoming?.sender === 'agent') {
          setMessages((prev) => {
            const incomingId = incoming?._id ? String(incoming._id) : '';
            const incomingWamid = incoming?.whatsappMessageId
              ? String(incoming.whatsappMessageId)
              : '';

            const existingIndex = prev.findIndex((message) => {
              const messageId = message?._id ? String(message._id) : '';
              const messageWamid = message?.whatsappMessageId
                ? String(message.whatsappMessageId)
                : '';
              return (
                (incomingId && messageId === incomingId) ||
                (incomingWamid && messageWamid === incomingWamid)
              );
            });
            if (existingIndex >= 0) {
              return prev.map((message, index) =>
                index === existingIndex
                  ? mergeMessagePreservingReplyContext(message, incoming)
                  : message
              );
            }

            const optimisticIndex = prev.findIndex(
              (message) =>
                typeof message?._id === 'string' &&
                message._id.startsWith('temp-') &&
                message.sender === 'agent' &&
                message.text === incoming.text
            );
            if (optimisticIndex >= 0) {
              return prev.map((message, index) =>
                index === optimisticIndex
                  ? mergeMessagePreservingReplyContext(message, incoming)
                  : message
              );
            }

            return [...prev, incoming];
          });
        } else {
          callbacksRef.current.appendMessageUnique(incoming);
          callbacksRef.current.markAsRead(activeConversation._id);
        }
        callbacksRef.current.scheduleRealtimeResync(activeConversation._id);
      }
    };

    const handleMessageSent = (data) => {
      console.log('?? Message sent confirmation:', data);

      const activeConversation = selectedConversationRef.current;
      if (activeConversation && activeConversation._id === data.message.conversationId) {
        setMessages((prev) => {
          const incoming = data.message || {};
          const incomingId = incoming?._id ? String(incoming._id) : '';
          const incomingWamid = incoming?.whatsappMessageId
            ? String(incoming.whatsappMessageId)
            : '';

          const existingIndex = prev.findIndex((message) => {
            const messageId = message?._id ? String(message._id) : '';
            const messageWamid = message?.whatsappMessageId
              ? String(message.whatsappMessageId)
              : '';
            return (
              (incomingId && messageId === incomingId) ||
              (incomingWamid && messageWamid === incomingWamid)
            );
          });
          if (existingIndex >= 0) {
            return prev.map((message, index) =>
              index === existingIndex
                ? mergeMessagePreservingReplyContext(message, incoming)
                : message
            );
          }

          const optimisticIndex = prev.findIndex(
            (message) =>
              typeof message?._id === 'string' &&
              message._id.startsWith('temp-') &&
              message.sender === 'agent' &&
              message.text === incoming.text
          );
          if (optimisticIndex >= 0) {
            return prev.map((message, index) =>
              index === optimisticIndex
                ? mergeMessagePreservingReplyContext(message, incoming)
                : message
            );
          }

          return [...prev, incoming];
        });
      }
    };

    const handleMessageStatus = (data) => {
      console.log('Message status update:', data);

      const incomingStatus = String(data?.status || '').toLowerCase();
      const incomingMessageIds = new Set(
        [
          data?.messageId,
          data?.id,
          data?.whatsappMessageId,
          data?.message?._id,
          data?.message?.messageId,
          data?.message?.whatsappMessageId
        ]
          .filter(Boolean)
          .map((value) => String(value))
      );

      const statusRank = { sent: 1, delivered: 2, read: 3, failed: 4 };
      let foundMatch = false;

      setMessages((prev) =>
        prev.map((message) => {
          const messageIds = [message?._id, message?.messageId, message?.whatsappMessageId]
            .filter(Boolean)
            .map((value) => String(value));

          const matched = messageIds.some((id) => incomingMessageIds.has(id));
          if (!matched) return message;

          foundMatch = true;
          const currentStatus = String(message?.status || '').toLowerCase();
          const currentRank = statusRank[currentStatus] || 0;
          const nextRank = statusRank[incomingStatus] || currentRank;

          return nextRank >= currentRank
            ? {
                ...message,
                status: incomingStatus || currentStatus,
                errorMessage:
                  incomingStatus === 'failed'
                    ? String(data?.errorMessage || message?.errorMessage || '').trim()
                    : ''
              }
            : message;
        })
      );

      const activeConversation = selectedConversationRef.current;
      const eventConversationId = data?.conversationId ? String(data.conversationId) : '';
      if (
        !foundMatch &&
        activeConversation &&
        eventConversationId &&
        String(activeConversation._id) === eventConversationId
      ) {
        callbacksRef.current.loadMessages(activeConversation._id);
      }
      if (
        activeConversation &&
        eventConversationId &&
        String(activeConversation._id) === eventConversationId
      ) {
        callbacksRef.current.scheduleRealtimeResync(activeConversation._id);
      }
    };

    const handleLeadScoreUpdated = (data) => {
      if (!data) return;

      setConversations((prev) =>
        prev.map((conversation) =>
          callbacksRef.current.applyLeadScoreUpdateToConversation(conversation, data)
        )
      );

      setSelectedConversation((prev) =>
        callbacksRef.current.applyLeadScoreUpdateToConversation(prev, data)
      );
    };

    webSocketService.connect(currentUserId);
    webSocketService.on('connected', handleConnect);
    webSocketService.on('disconnected', handleDisconnect);
    webSocketService.on('newMessage', handleNewMessage);
    webSocketService.on('new_message', handleNewMessage);
    webSocketService.on('messageSent', handleMessageSent);
    webSocketService.on('message_sent', handleMessageSent);
    webSocketService.on('messageStatus', handleMessageStatus);
    webSocketService.on('message_status', handleMessageStatus);
    webSocketService.on('lead_score_updated', handleLeadScoreUpdated);
    webSocketService.on('leadScoreUpdated', handleLeadScoreUpdated);

    return () => {
      webSocketService.off('connected', handleConnect);
      webSocketService.off('disconnected', handleDisconnect);
      webSocketService.off('newMessage', handleNewMessage);
      webSocketService.off('new_message', handleNewMessage);
      webSocketService.off('messageSent', handleMessageSent);
      webSocketService.off('message_sent', handleMessageSent);
      webSocketService.off('messageStatus', handleMessageStatus);
      webSocketService.off('message_status', handleMessageStatus);
      webSocketService.off('lead_score_updated', handleLeadScoreUpdated);
      webSocketService.off('leadScoreUpdated', handleLeadScoreUpdated);
    };
  }, [
    currentUserId,
    notificationMode,
    setWsConnected,
    setConversations,
    setMessages,
    setSelectedConversation,
    selectedConversationRef
  ]);

  useEffect(() => {
    const timerRef = realtimeResyncTimerRef;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [realtimeResyncTimerRef]);

  useEffect(() => {
    callbacksRef.current.loadConversations();
    callbacksRef.current.loadContacts({ silent: true });
  }, []);

  useEffect(() => {
    const onFocusRefresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      callbacksRef.current.loadConversations({ silent: true });
    };
    window.addEventListener('focus', onFocusRefresh);
    document.addEventListener('visibilitychange', onFocusRefresh);
    return () => {
      window.removeEventListener('focus', onFocusRefresh);
      document.removeEventListener('visibilitychange', onFocusRefresh);
    };
  }, []);
};
