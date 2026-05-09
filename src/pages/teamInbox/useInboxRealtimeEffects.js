import { useEffect, useRef } from 'react';
import webSocketService from '../../services/websocketService';
import {
  mergeMessagePreservingReplyContext,
  resolvePreferredMessageStatus
} from './replyMessageMergeUtils';
import { showIncomingMessageSystemNotification } from './teamInboxNotificationUtils';
import { publishCrmContactSync } from '../../utils/crmSyncEvents';

const MESSAGE_STATUS_RANK = { sent: 1, delivered: 2, read: 3, failed: 4 };

const isTeamInboxTraceEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(import.meta?.env?.DEV) || String(window.localStorage.getItem('debugTeamInbox') || '').trim() === '1';
  } catch {
    return Boolean(import.meta?.env?.DEV);
  }
};

const traceTeamInbox = (...args) => {
  if (!isTeamInboxTraceEnabled()) return;
  console.debug('[TeamInbox:socket]', ...args);
};

const recordInboxDebugEvent = (setInboxDebugInfo, lastEvent, extra = {}) => {
  if (typeof setInboxDebugInfo !== 'function') return;

  setInboxDebugInfo({
    lastEvent: String(lastEvent || 'idle').trim() || 'idle',
    lastEventAt: new Date().toISOString(),
    source: String(extra?.source || 'socket').trim() || 'socket',
    conversationId: String(extra?.conversationId || '').trim(),
    messageId: String(extra?.messageId || '').trim(),
    details: String(extra?.details || '').trim()
  });
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
  notifyActionFeedback
}) => {
  const getContactIdFromConversationPayload = (conversation = {}) =>
    String(
      conversation?.contactId?._id ||
        conversation?.contactId?.id ||
        conversation?.contactId ||
        ''
    ).trim();

  const getConversationLastOutboundMessageId = (conversation = {}) =>
    String(
      conversation?.lastMessageWhatsappMessageId ||
        conversation?.lastMessageMessageId ||
        conversation?.lastMessageId ||
        ''
    ).trim();

  const notifiedIncomingMessageKeysRef = useRef(new Set());
  const lastContactRefreshAtRef = useRef(0);
  const lastVisibilityRefreshAtRef = useRef(0);
  const lastConversationListRefreshAtRef = useRef(0);
  const bootstrapLoadPromiseRef = useRef(null);
  const lastBootstrapLoadAtRef = useRef(0);
  const typingPruneTimerRef = useRef(null);
  const lastSyncedCompanyIdRef = useRef('');
  const lastSyncedConversationIdRef = useRef('');
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

  const pruneTypingState = (typingState = {}) => {
    const cutoff = Date.now() - 10000;
    const nextState = {};

    Object.entries(typingState || {}).forEach(([conversationId, entries]) => {
      const safeEntries = Array.isArray(entries) ? entries : [];
      const filteredEntries = safeEntries.filter((entry) => {
        const updatedAt = new Date(entry?.updatedAt || 0).getTime();
        return Number.isFinite(updatedAt) && updatedAt >= cutoff;
      });

      if (filteredEntries.length > 0) {
        nextState[conversationId] = filteredEntries;
      }
    });

    return nextState;
  };

  const areTypingStateEntriesEqual = (leftEntries = [], rightEntries = []) => {
    const normalizeEntries = (entries = []) =>
      [...entries]
        .map((entry) => ({
          userId: String(entry?.userId || '').trim(),
          conversationId: String(entry?.conversationId || '').trim(),
          displayName: String(entry?.displayName || '').trim(),
          isTyping: Boolean(entry?.isTyping),
          updatedAt: String(entry?.updatedAt || '').trim()
        }))
        .sort((left, right) => left.userId.localeCompare(right.userId));

    const left = normalizeEntries(leftEntries);
    const right = normalizeEntries(rightEntries);

    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
      const leftEntry = left[index];
      const rightEntry = right[index];
      if (
        leftEntry.userId !== rightEntry.userId ||
        leftEntry.conversationId !== rightEntry.conversationId ||
        leftEntry.displayName !== rightEntry.displayName ||
        leftEntry.isTyping !== rightEntry.isTyping ||
        leftEntry.updatedAt !== rightEntry.updatedAt
      ) {
        return false;
      }
    }

    return true;
  };

  const areTypingStatesEqual = (leftState = {}, rightState = {}) => {
    const leftKeys = Object.keys(leftState || {}).sort();
    const rightKeys = Object.keys(rightState || {}).sort();

    if (leftKeys.length !== rightKeys.length) return false;

    for (let index = 0; index < leftKeys.length; index += 1) {
      const key = leftKeys[index];
      if (key !== rightKeys[index]) return false;
      if (!areTypingStateEntriesEqual(leftState?.[key], rightState?.[key])) return false;
    }

    return true;
  };

  const bootstrapInboxData = ({
    silentConversations = false,
    silentContacts = true,
    force = false
  } = {}) => {
    const now = Date.now();
    if (!force && bootstrapLoadPromiseRef.current) {
      return bootstrapLoadPromiseRef.current;
    }

    if (!force && lastBootstrapLoadAtRef.current && now - lastBootstrapLoadAtRef.current < 15000) {
      return Promise.resolve();
    }

    const loadPromise = Promise.all([
      callbacksRef.current.loadConversations({ silent: silentConversations }),
      callbacksRef.current.loadContacts({ silent: silentContacts })
    ])
      .catch((error) => {
        console.error('Failed to bootstrap Team Inbox data:', error);
      })
      .finally(() => {
        lastBootstrapLoadAtRef.current = Date.now();
        bootstrapLoadPromiseRef.current = null;
      });

    bootstrapLoadPromiseRef.current = loadPromise;
    return loadPromise;
  };

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
    const normalizedCompanyId = String(currentCompanyId || '').trim();
    if (lastSyncedCompanyIdRef.current === normalizedCompanyId) return;

    lastSyncedCompanyIdRef.current = normalizedCompanyId;
    webSocketService.setCompanyId(normalizedCompanyId);
  }, [currentCompanyId]);

  useEffect(() => {
    const normalizedConversationId = String(activeConversationId || '').trim();
    if (lastSyncedConversationIdRef.current === normalizedConversationId) return;

    lastSyncedConversationIdRef.current = normalizedConversationId;
    webSocketService.setActiveConversationId(normalizedConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    const handleConnect = () => {
      setWsConnected(true);
      bootstrapInboxData({
        silentConversations: true,
        silentContacts: true
      });
      recordInboxDebugEvent(setInboxDebugInfo, 'socket:connected', {
        source: 'socket',
        conversationId: String(activeConversationId || '').trim(),
        details: 'WebSocket connection established'
      });
      traceTeamInbox('connected', {
        currentUserId,
        currentCompanyId,
        activeConversationId: String(activeConversationId || '').trim()
      });
    };

    const handleDisconnect = () => {
      setWsConnected(false);
      recordInboxDebugEvent(setInboxDebugInfo, 'socket:disconnected', {
        source: 'socket',
        conversationId: String(activeConversationId || '').trim(),
        details: 'WebSocket disconnected'
      });
      traceTeamInbox('disconnected');
    };

    const handleNewMessage = (data) => {
      traceTeamInbox('newMessage', {
        conversationId: String(data?.conversation?._id || '').trim(),
        messageId: String(data?.message?._id || data?.message?.whatsappMessageId || '').trim(),
        sender: String(data?.message?.sender || '').trim(),
        activeConversationId: String(selectedConversationRef?.current?._id || '').trim()
      });
      recordInboxDebugEvent(setInboxDebugInfo, 'socket:newMessage', {
        source: 'socket',
        conversationId: String(data?.conversation?._id || '').trim(),
        messageId: String(data?.message?._id || data?.message?.whatsappMessageId || '').trim(),
        details: `sender=${String(data?.message?.sender || '').trim() || 'unknown'}`
      });

      const incomingConversationRaw = data?.conversation || {};
      if (
        !callbacksRef.current.hasRealContactName(incomingConversationRaw) &&
        !callbacksRef.current.getMappedContactName(incomingConversationRaw?.contactPhone)
      ) {
        const now = Date.now();
        if (now - lastContactRefreshAtRef.current > 30000) {
          lastContactRefreshAtRef.current = now;
          callbacksRef.current.loadContacts({ silent: true });
        }
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
            {
              ...conversation,
              ...incomingConversation,
              lastMessageStatus: resolvePreferredMessageStatus(
                conversation?.lastMessageStatus,
                incomingConversation?.lastMessageStatus
              ),
              lastMessageWhatsappMessageId:
                String(
                  incomingConversation?.lastMessageWhatsappMessageId ||
                    incomingConversation?.lastMessageMessageId ||
                    incomingConversation?.lastMessageId ||
                    ''
                ).trim() ||
                String(conversation?.lastMessageWhatsappMessageId || '').trim()
            },
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
      const contactIdValue = getContactIdFromConversationPayload(data?.conversation);

      if (isIncomingContactMessage && contactIdValue) {
        publishCrmContactSync({
          contactId: contactIdValue,
          conversationId: currentConversationId,
          reason: 'inbox_contact_reply'
        });
      }
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
      traceTeamInbox('messageSent', {
        conversationId: String(data?.message?.conversationId || '').trim(),
        messageId: String(data?.message?._id || data?.message?.whatsappMessageId || '').trim()
      });
      recordInboxDebugEvent(setInboxDebugInfo, 'socket:messageSent', {
        source: 'socket',
        conversationId: String(data?.message?.conversationId || '').trim(),
        messageId: String(data?.message?._id || data?.message?.whatsappMessageId || '').trim(),
        details: 'Outbound message acknowledged'
      });

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
      traceTeamInbox('messageStatus', {
        conversationId: String(data?.conversationId || '').trim(),
        status: String(data?.status || '').trim(),
        messageId: String(data?.messageId || data?.whatsappMessageId || data?.message?._id || '').trim(),
        mediaPipelineRequestId: String(data?.mediaPipelineRequestId || '').trim()
      });
      recordInboxDebugEvent(setInboxDebugInfo, 'socket:messageStatus', {
        source: 'socket',
        conversationId: String(data?.conversationId || '').trim(),
        messageId: String(data?.messageId || data?.whatsappMessageId || data?.message?._id || '').trim(),
        details: `status=${String(data?.status || '').trim() || 'unknown'}`
      });

      const incomingStatus = String(data?.status || '').toLowerCase();
      const eventConversationId = String(data?.conversationId || '').trim();
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
      const mediaPipelineRequestId = String(data?.mediaPipelineRequestId || '').trim();

      setMessages((prev) =>
        (() => {
          const nextMessages = prev.slice();
          const updateMessageAtIndex = (index) => {
            if (index < 0 || index >= nextMessages.length) return false;
            const message = nextMessages[index];
            const currentStatus = String(message?.status || '').toLowerCase();
            const currentRank = statusRank[currentStatus] || 0;
            const nextRank = statusRank[incomingStatus] || currentRank;

            if (nextRank < currentRank) return true;

            nextMessages[index] = {
              ...message,
              status: incomingStatus || currentStatus,
              errorMessage:
                incomingStatus === 'failed'
                  ? String(data?.errorMessage || message?.errorMessage || '').trim()
                  : ''
            };
            foundMatch = true;
            return true;
          };

          for (let index = 0; index < nextMessages.length; index += 1) {
            const message = nextMessages[index];
            const messageIds = [message?._id, message?.messageId, message?.whatsappMessageId]
              .filter(Boolean)
              .map((value) => String(value));

            const matched = messageIds.some((id) => incomingMessageIds.has(id));
            if (!matched) continue;
            updateMessageAtIndex(index);
          }

          if (!foundMatch && eventConversationId) {
            for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
              const message = nextMessages[index];
              const messageConversationId = String(message?.conversationId || '').trim();
              const isOutboundAgentMessage = String(message?.sender || '').trim().toLowerCase() === 'agent';
              if (!isOutboundAgentMessage) continue;
              if (messageConversationId && messageConversationId !== eventConversationId) continue;
              updateMessageAtIndex(index);
              if (foundMatch) break;
            }
          }

          return nextMessages;
        })()
      );

      if (incomingStatus) {
        setConversations((prev) =>
          prev.map((conversation) => {
            const conversationIdValue = String(conversation?._id || '').trim();
            const previewMessageId = getConversationLastOutboundMessageId(conversation);
            const matchesConversation =
              (eventConversationId && conversationIdValue === eventConversationId) ||
              (previewMessageId && Array.from(incomingMessageIds).includes(previewMessageId));

            if (!matchesConversation) return conversation;

            const nextConversation = {
              ...conversation,
              lastMessageStatus: resolvePreferredMessageStatus(
                conversation?.lastMessageStatus,
                incomingStatus
              ),
              lastMessageWhatsappMessageId:
                String(data?.messageId || data?.whatsappMessageId || '').trim() ||
                String(conversation?.lastMessageWhatsappMessageId || '').trim()
            };

            if (incomingStatus === 'read' || incomingStatus === 'delivered') {
              nextConversation.lastMessageFrom = 'agent';
            }

            return nextConversation;
          })
        );

        if (mediaPipelineRequestId && typeof notifyActionFeedback === 'function') {
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
          notifyActionFeedback(
            `Media ${statusLabel}${mediaPipelineRequestId ? ` • ${mediaPipelineRequestId}` : ''}`,
            incomingStatus === 'failed' ? 'error' : 'info'
          );
        }

        setSelectedConversation((prev) => {
          if (!prev) return prev;
          const eventConversationId = String(data?.conversationId || '').trim();
          const selectedConversationId = String(prev?._id || '').trim();
          const previewMessageId = getConversationLastOutboundMessageId(prev);
          const selectedMatches =
            (eventConversationId && selectedConversationId === eventConversationId) ||
            (previewMessageId && Array.from(incomingMessageIds).includes(previewMessageId));

          if (!selectedMatches) return prev;
          return {
            ...prev,
            lastMessageStatus: resolvePreferredMessageStatus(
              prev?.lastMessageStatus,
              incomingStatus
            ),
            lastMessageWhatsappMessageId:
              String(data?.messageId || data?.whatsappMessageId || '').trim() ||
              String(prev?.lastMessageWhatsappMessageId || '').trim(),
            ...(incomingStatus === 'read' || incomingStatus === 'delivered'
              ? { lastMessageFrom: 'agent' }
              : {})
          };
        });

        const now = Date.now();
        if (now - lastConversationListRefreshAtRef.current > 5000) {
          lastConversationListRefreshAtRef.current = now;
          callbacksRef.current.loadConversations({ silent: true });
        }
      }

      const activeConversation = selectedConversationRef.current;
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

    const handlePresenceUpdate = (data) => {
      const userId = String(data?.userId || '').trim();
      if (!userId) return;

      setUserPresenceMap((prev) => ({
        ...prev,
        [userId]: {
          userId,
          online: Boolean(data?.online),
          socketCount: Math.max(0, Number(data?.socketCount || 0) || 0),
          lastSeen: String(data?.lastSeen || '').trim() || new Date().toISOString(),
          activeConversationId: String(data?.activeConversationId || '').trim() || null,
          updatedAt: new Date().toISOString()
        }
      }));
    };

    const handleTypingUpdate = (data) => {
      const userId = String(data?.userId || '').trim();
      const conversationId = String(data?.conversationId || '').trim();
      if (!userId || !conversationId) return;

      const nextEntry = {
        userId,
        conversationId,
        displayName: String(data?.displayName || '').trim() || null,
        isTyping: Boolean(data?.isTyping),
        updatedAt: new Date().toISOString()
      };

      setConversationTypingState((prev) => {
        const currentEntries = Array.isArray(prev?.[conversationId]) ? prev[conversationId] : [];
        const remaining = currentEntries.filter((entry) => String(entry?.userId || '').trim() !== userId);
        if (!nextEntry.isTyping) {
          const nextState = { ...prev };
          if (remaining.length > 0) {
            nextState[conversationId] = remaining;
          } else {
            delete nextState[conversationId];
          }
          return pruneTypingState(nextState);
        }

        return pruneTypingState({
          ...prev,
          [conversationId]: [...remaining, nextEntry]
        });
      });
    };

    const handleConversationRead = (data) => {
      const conversationId = String(data?.conversationId || '').trim();
      if (!conversationId) return;

      setConversations((prev) =>
        prev.map((conversation) =>
          String(conversation?._id || '').trim() === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );

      setSelectedConversation((prev) => {
        if (!prev || String(prev?._id || '').trim() !== conversationId) return prev;
        return { ...prev, unreadCount: 0 };
      });
    };

    const handleCrmChanged = () => {
      bootstrapInboxData({
        silentConversations: true,
        silentContacts: true
      });
    };

    const handleBroadcastMessageBatch = (data = {}) => {
      const events = Array.isArray(data?.events) ? data.events : [];
      if (events.length === 0) return;

      const activeConversation = selectedConversationRef.current;
      const activeConversationId = String(activeConversation?._id || '').trim();
      const batchTouchesActiveConversation = events.some(
        (event) => String(event?.conversationId || '').trim() === activeConversationId
      );

      const now = Date.now();
      if (now - lastConversationListRefreshAtRef.current > 5000) {
        lastConversationListRefreshAtRef.current = now;
        callbacksRef.current.loadConversations({ silent: true });
      }

      if (batchTouchesActiveConversation && activeConversationId) {
        callbacksRef.current.scheduleRealtimeResync(activeConversationId);
      }
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
    webSocketService.on('broadcast_message_batch', handleBroadcastMessageBatch);
    webSocketService.on('lead_score_updated', handleLeadScoreUpdated);
    webSocketService.on('leadScoreUpdated', handleLeadScoreUpdated);
    webSocketService.on('crm_changed', handleCrmChanged);
    webSocketService.on('presence:update', handlePresenceUpdate);
    webSocketService.on('typing:update', handleTypingUpdate);
    webSocketService.on('conversation_read', handleConversationRead);

    return () => {
      webSocketService.off('connected', handleConnect);
      webSocketService.off('disconnected', handleDisconnect);
      webSocketService.off('newMessage', handleNewMessage);
      webSocketService.off('new_message', handleNewMessage);
      webSocketService.off('messageSent', handleMessageSent);
      webSocketService.off('message_sent', handleMessageSent);
      webSocketService.off('messageStatus', handleMessageStatus);
      webSocketService.off('message_status', handleMessageStatus);
      webSocketService.off('broadcast_message_batch', handleBroadcastMessageBatch);
      webSocketService.off('lead_score_updated', handleLeadScoreUpdated);
      webSocketService.off('leadScoreUpdated', handleLeadScoreUpdated);
      webSocketService.off('crm_changed', handleCrmChanged);
      webSocketService.off('presence:update', handlePresenceUpdate);
      webSocketService.off('typing:update', handleTypingUpdate);
      webSocketService.off('conversation_read', handleConversationRead);
    };
  }, [
    currentUserId,
    notificationMode,
    hasBootstrapCache,
    setWsConnected,
    setConversations,
    setMessages,
    setSelectedConversation,
    selectedConversationRef
  ]);

  useEffect(() => {
    if (typingPruneTimerRef.current) {
      clearInterval(typingPruneTimerRef.current);
    }

    typingPruneTimerRef.current = setInterval(() => {
      setConversationTypingState((current) => {
        const nextState = pruneTypingState(current);
        return areTypingStatesEqual(current, nextState) ? current : nextState;
      });
    }, 5000);

    return () => {
      if (typingPruneTimerRef.current) {
        clearInterval(typingPruneTimerRef.current);
        typingPruneTimerRef.current = null;
      }
    };
  }, [setConversationTypingState]);

  useEffect(() => {
    const timerRef = realtimeResyncTimerRef;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [realtimeResyncTimerRef]);

  useEffect(() => {
    const useSilentBootstrap = Boolean(hasBootstrapCache);
    if (useSilentBootstrap && typeof setSidebarRefreshing === 'function') {
      setSidebarRefreshing(true);
    }

    bootstrapInboxData({
      silentConversations: useSilentBootstrap,
      silentContacts: true,
      force: false
    }).finally(() => {
      if (useSilentBootstrap && typeof setSidebarRefreshing === 'function') {
        setSidebarRefreshing(false);
      }
    });
  }, [hasBootstrapCache, setSidebarRefreshing]);

  useEffect(() => {
    const onFocusRefresh = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastVisibilityRefreshAtRef.current < 30000) return;
      lastVisibilityRefreshAtRef.current = now;
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
