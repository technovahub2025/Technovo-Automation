import { useEffect, useRef } from 'react';
import webSocketService from '../../services/websocketService';
import {
  patchConversationInOrderedList,
  upsertConversationInOrderedList
} from './teamInboxUtils';

const MESSAGE_STATUS_BATCH_WINDOW_MS = 120;
const LIST_REFRESH_DEBOUNCE_MS = 180;
const LIST_REFRESH_MIN_INTERVAL_MS = 1500;
const OVERVIEW_REFRESH_DEBOUNCE_MS = 180;
const OVERVIEW_REFRESH_MIN_INTERVAL_MS = 1200;

const getConversationId = (conversation) =>
  String(conversation?._id || conversation?.id || '').trim();

const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '');

const getRelatedConversationIds = (data = {}, fallbackId = '') =>
  Array.from(
    new Set(
      [
        fallbackId,
        data?.conversationId,
        data?.message?.conversationId,
        data?.conversation?._id,
        data?.conversation?.id,
        ...(Array.isArray(data?.relatedConversationIds) ? data.relatedConversationIds : []),
        ...(Array.isArray(data?.message?.relatedConversationIds) ? data.message.relatedConversationIds : []),
        ...(Array.isArray(data?.conversation?.relatedConversationIds)
          ? data.conversation.relatedConversationIds
          : [])
      ]
        .map((id) => String(id || '').trim())
        .filter(Boolean)
  )
  );

const getConversationContactId = (conversation = {}) =>
  String(conversation?.contactId?._id || conversation?.contactId?.id || conversation?.contactId || '')
    .trim();

const mergeContactSnapshotIntoConversation = (conversation = {}, contactUpdate = {}) => {
  const normalizedContactId = String(contactUpdate?._id || contactUpdate?.id || '').trim();
  if (!normalizedContactId) return conversation;

  const conversationContactId = getConversationContactId(conversation);
  if (!conversationContactId || conversationContactId !== normalizedContactId) {
    return conversation;
  }

  const currentContact =
    conversation?.contactId && typeof conversation.contactId === 'object' ? conversation.contactId : {};

  return {
    ...conversation,
    contactId: {
      ...currentContact,
      ...contactUpdate
    },
    contactName: String(contactUpdate?.name || '').trim() || conversation?.contactName || ''
  };
};

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
  setWsConnected,
  hasBootstrapCache,
  loadConversations,
  loadContacts,
  hasRealContactName,
  setConversations,
  setMessages,
  appendMessageUnique,
  upsertMessage,
  patchMessage,
  setSelectedConversation,
  conversationLookupMap,
  upsertConversation,
  patchConversation,
  applyLeadScoreUpdateToConversation,
  refreshInboxOverview,
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
  const lastInboxOverviewRefreshAtRef = useRef(0);
  const inboxOverviewRefreshTimerRef = useRef(null);
  const messageStatusFlushTimerRef = useRef(null);
  const pendingMessageStatusUpdatesRef = useRef(new Map());
  const contactBootstrapLoadKeyRef = useRef('');

  useEffect(() => {
    const normalizedCompanyId = String(currentCompanyId || '').trim();
    webSocketService.setCompanyId(normalizedCompanyId);
    return () => {
      webSocketService.setCompanyId('');
    };
  }, [currentCompanyId]);

  useEffect(() => {
    webSocketService.setActiveConversationId(activeConversationId);
    return () => {
      webSocketService.setActiveConversationId('');
    };
  }, [activeConversationId]);

  const notify = (message, tone = 'info') => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) return;
    if (typeof notifyActionFeedback === 'function') {
      notifyActionFeedback(nextMessage, tone);
      return;
    }
    console.warn('Team Inbox feedback callback missing:', nextMessage);
  };

  const getConversationLabel = (data = {}) =>
    String(
      data?.conversation?.contactId?.name ||
        data?.conversation?.contactName ||
        data?.conversation?.contactPhone ||
        data?.conversation?.name ||
        data?.contactName ||
        data?.contactPhone ||
        'Conversation'
    ).trim() || 'Conversation';

  const getAssigneeLabel = (data = {}) =>
    String(
      data?.assignedToName ||
        data?.assignedAgentName ||
        data?.assigneeName ||
        data?.conversation?.assignedToName ||
        data?.conversation?.assignedAgentName ||
        data?.assignedTo?.name ||
        data?.assignedTo?.displayName ||
        data?.assignedTo?.fullName ||
        data?.assignedTo?.email ||
        data?.assignedTo ||
        ''
    ).trim();

  const getTaskTitle = (data = {}) =>
    String(data?.task?.title || data?.title || data?.conversation?.taskTitle || '').trim();

  const getFollowUpLabel = (data = {}) => {
    const rawValue = String(data?.followUpAt || data?.conversation?.contactId?.nextFollowUpAt || '').trim();
    if (!rawValue) return '';
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return 'follow-up updated';
    return parsed.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      Promise.resolve(loadConversations({ silent, reason, skipCache: true }))
        .catch(() => undefined)
        .finally(() => undefined);
    }, delay);
  };

  const queueInboxOverviewRefresh = ({
    minIntervalMs = OVERVIEW_REFRESH_MIN_INTERVAL_MS,
    debounceMs = OVERVIEW_REFRESH_DEBOUNCE_MS
  } = {}) => {
    if (typeof refreshInboxOverview !== 'function') return;

    const now = Date.now();
    const elapsed = now - Number(lastInboxOverviewRefreshAtRef.current || 0);
    const delay = Math.max(0, elapsed >= minIntervalMs ? debounceMs : minIntervalMs - elapsed);

    if (inboxOverviewRefreshTimerRef.current) return;

    inboxOverviewRefreshTimerRef.current = window.setTimeout(() => {
      inboxOverviewRefreshTimerRef.current = null;
      lastInboxOverviewRefreshAtRef.current = Date.now();
      Promise.resolve(refreshInboxOverview({ skipCache: true })).catch(() => undefined);
    }, delay);
  };

  const flushMessageStatusBatch = (batch = []) => {
    const safeBatch = Array.isArray(batch) ? batch.filter(Boolean) : [];
    if (safeBatch.length === 0) return;

    let shouldFallbackScan = false;

    safeBatch.forEach((update) => {
      const targetIdentity = String(update?.messageId || update?.whatsappMessageId || '').trim();
      if (targetIdentity && typeof patchMessage === 'function') {
        patchMessage(targetIdentity, (message) => {
          const merged = mergeMessageStatus(message, update);
          return merged.status !== message.status || merged.errorMessage !== message.errorMessage
            ? merged
            : message;
        });
      } else {
        shouldFallbackScan = true;
      }
    });

    if (shouldFallbackScan) {
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
    }

    if (typeof patchConversation === 'function') {
      safeBatch.forEach((update) => {
        const eventConversationId = String(update?.conversationId || '').trim();
        if (!eventConversationId) return;

        const matchingConversation = conversationLookupMap?.get(eventConversationId);
        if (!matchingConversation) return;

        patchConversation(
          eventConversationId,
          {
            ...matchingConversation,
            lastMessageStatus:
              String(update?.status || '').trim().toLowerCase() ||
              matchingConversation?.lastMessageStatus ||
              '',
            lastMessageWhatsappMessageId:
              String(update?.messageId || update?.whatsappMessageId || '').trim() ||
              String(matchingConversation?.lastMessageWhatsappMessageId || '').trim(),
            ...(String(update?.status || '').trim().toLowerCase() === 'read' ||
            String(update?.status || '').trim().toLowerCase() === 'delivered'
              ? { lastMessageFrom: 'agent' }
              : {})
          },
          { reorder: false }
        );
      });
    } else {
      setConversations((prev) => {
        let next = prev;
        let mutated = false;

        safeBatch.forEach((update) => {
          const eventConversationId = String(update?.conversationId || '').trim();
          if (!eventConversationId) return;

          const matchingConversation =
            conversationLookupMap?.get(eventConversationId) ||
            (Array.isArray(next)
              ? next.find((conversation) => getConversationId(conversation) === eventConversationId)
              : null);
          if (!matchingConversation) return;

          next = patchConversationInOrderedList(next, eventConversationId, {
            ...matchingConversation,
            lastMessageStatus:
              String(update?.status || '').trim().toLowerCase() ||
              matchingConversation?.lastMessageStatus ||
              '',
            lastMessageWhatsappMessageId:
              String(update?.messageId || update?.whatsappMessageId || '').trim() ||
              String(matchingConversation?.lastMessageWhatsappMessageId || '').trim(),
            ...(String(update?.status || '').trim().toLowerCase() === 'read' ||
            String(update?.status || '').trim().toLowerCase() === 'delivered'
              ? { lastMessageFrom: 'agent' }
              : {})
          });
          mutated = true;
        });

        return mutated ? next : prev;
      });
    }

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
      const incomingMessage = data?.message || {};
      const conversationId = String(
        data?.conversationId ||
          incomingMessage?.conversationId ||
          data?.conversation?._id ||
          data?.conversation?.id ||
          ''
      ).trim();
      const activeId = String(activeConversationId || '').trim();
      const targetConversationId = String(incomingMessage?.conversationId || conversationId || '').trim();
      const eventConversationIds = getRelatedConversationIds(data, targetConversationId || conversationId);
      const activeConversation = activeId ? conversationLookupMap?.get(activeId) : null;
      const eventPhone = normalizePhoneDigits(
        data?.conversation?.contactPhone ||
          data?.conversation?.contactId?.phone ||
          data?.contactPhone ||
          incomingMessage?.conversation?.contactPhone ||
          ''
      );
      const activePhone = normalizePhoneDigits(
        activeConversation?.contactPhone ||
          activeConversation?.contactId?.phone ||
          activeConversation?.phone ||
          ''
      );
      const isSamePhoneThread =
        Boolean(activePhone && eventPhone) &&
        (activePhone === eventPhone ||
          activePhone.endsWith(eventPhone.slice(-10)) ||
          eventPhone.endsWith(activePhone.slice(-10)));
      const isActiveThreadEvent =
        Boolean(activeId) &&
        (eventConversationIds.includes(activeId) || isSamePhoneThread);
      const incomingConversation =
        data?.conversation && typeof data.conversation === 'object'
          ? data.conversation
          : incomingMessage?.conversation && typeof incomingMessage.conversation === 'object'
            ? incomingMessage.conversation
            : null;
      if (conversationId && activeId && !isActiveThreadEvent) {
        if (incomingConversation) {
          if (typeof upsertConversation === 'function') {
            upsertConversation(incomingConversation);
          } else {
            setConversations((prev) => upsertConversationInOrderedList(prev, incomingConversation));
          }
        }
        return;
      }

      if (conversationId && incomingMessage && Object.keys(incomingMessage).length > 0) {
        const messageForActiveThread =
          isActiveThreadEvent && activeId
            ? { ...incomingMessage, conversationId: activeId }
            : incomingMessage;
        if (typeof upsertMessage === 'function') {
          upsertMessage(messageForActiveThread);
        } else if (typeof appendMessageUnique === 'function') {
          appendMessageUnique(messageForActiveThread);
        } else {
          setMessages((prev) =>
            prev.some((message) => String(message?._id || '') === String(messageForActiveThread?._id || ''))
              ? prev
              : [...prev, messageForActiveThread]
          );
        }
      }
      const nextConversation = incomingConversation
        ? {
            ...incomingConversation,
            _id:
              isActiveThreadEvent && activeId
                ? activeId
                : String(incomingConversation?._id || conversationId || '').trim() || conversationId,
            id:
              isActiveThreadEvent && activeId
                ? activeId
                : String(incomingConversation?.id || incomingConversation?._id || conversationId || '').trim() || conversationId,
            lastMessage:
              String(
                incomingMessage?.text ||
                  incomingMessage?.mediaCaption ||
                  incomingConversation?.lastMessage ||
                  ''
              ).trim(),
            lastMessageTime:
              incomingMessage?.timestamp ||
              incomingMessage?.whatsappTimestamp ||
              incomingConversation?.lastMessageTime ||
              data?.timestamp ||
              new Date().toISOString(),
            lastMessageFrom:
              String(incomingMessage?.sender || incomingConversation?.lastMessageFrom || 'agent')
                .trim()
                .toLowerCase(),
            lastMessageStatus:
              String(incomingMessage?.status || incomingConversation?.lastMessageStatus || 'sent')
                .trim()
                .toLowerCase()
          }
        : conversationId || activeId
          ? {
              _id: isActiveThreadEvent && activeId ? activeId : conversationId,
              id: isActiveThreadEvent && activeId ? activeId : conversationId,
              lastMessage:
                String(incomingMessage?.text || incomingMessage?.mediaCaption || data?.preview || '')
                  .trim(),
              lastMessageTime:
                incomingMessage?.timestamp ||
                incomingMessage?.whatsappTimestamp ||
                data?.timestamp ||
                new Date().toISOString(),
              lastMessageFrom:
                String(incomingMessage?.sender || data?.lastMessageFrom || 'agent')
                  .trim()
                  .toLowerCase(),
              lastMessageStatus:
                String(incomingMessage?.status || data?.status || 'sent').trim().toLowerCase(),
              unreadCount: 0
            }
          : null;

      if (nextConversation) {
        if (typeof upsertConversation === 'function') {
          upsertConversation(nextConversation);
        } else {
          setConversations((prev) => upsertConversationInOrderedList(prev, nextConversation));
        }
      }
    };

    const handleNewMessage = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      const activeId = String(activeConversationId || '').trim();
      const incomingMessage = data?.message || data;
      const targetConversationId = String(incomingMessage?.conversationId || conversationId || '').trim();
      const conversationLabel = getConversationLabel(data);
      const eventConversationIds = getRelatedConversationIds(data, targetConversationId);
      const activeConversation = activeId ? conversationLookupMap?.get(activeId) : null;
      const eventPhone = normalizePhoneDigits(
        data?.conversation?.contactPhone ||
          data?.conversation?.contactId?.phone ||
          data?.contactPhone ||
          incomingMessage?.conversation?.contactPhone ||
          ''
      );
      const activePhone = normalizePhoneDigits(
        activeConversation?.contactPhone ||
          activeConversation?.contactId?.phone ||
          activeConversation?.phone ||
          ''
      );
      const isSamePhoneThread =
        Boolean(activePhone && eventPhone) &&
        (activePhone === eventPhone ||
          activePhone.endsWith(eventPhone.slice(-10)) ||
          eventPhone.endsWith(activePhone.slice(-10)));
      const isActiveThreadEvent =
        Boolean(activeId) &&
        (eventConversationIds.includes(activeId) || isSamePhoneThread);

      if (targetConversationId && activeId && isActiveThreadEvent) {
        if (typeof upsertMessage === 'function') {
          upsertMessage(incomingMessage);
        } else if (typeof appendMessageUnique === 'function') {
          appendMessageUnique(incomingMessage);
        } else if (typeof setMessages === 'function') {
          setMessages((prev) => (prev.some((message) => String(message?._id || '') === String(incomingMessage?._id || '')) ? prev : [...prev, incomingMessage]));
        }
        const existingConversation =
          conversationLookupMap?.get(activeId) || conversationLookupMap?.get(targetConversationId);
        const nextConversation = {
          ...(data?.conversation && typeof data.conversation === 'object' ? data.conversation : {}),
          ...(incomingMessage?.conversation && typeof incomingMessage.conversation === 'object'
            ? incomingMessage.conversation
            : {}),
          _id: activeId,
          id: activeId,
          lastMessage:
            String(incomingMessage?.text || incomingMessage?.mediaCaption || data?.preview || '').trim() ||
            String(existingConversation?.lastMessage || '').trim(),
          lastMessageTime:
            incomingMessage?.timestamp ||
            incomingMessage?.whatsappTimestamp ||
            data?.timestamp ||
            existingConversation?.lastMessageTime ||
            new Date().toISOString(),
          lastMessageFrom:
            String(incomingMessage?.sender || data?.lastMessageFrom || 'contact').trim().toLowerCase() ||
            String(existingConversation?.lastMessageFrom || '').trim(),
          lastMessageStatus:
            String(incomingMessage?.status || data?.status || '').trim().toLowerCase() ||
            String(existingConversation?.lastMessageStatus || '').trim(),
          unreadCount: Number.isFinite(Number(data?.unreadCount))
            ? Math.max(0, Number(data.unreadCount))
            : Math.max(0, Number(existingConversation?.unreadCount || 0))
        };
        if (typeof upsertConversation === 'function') {
          upsertConversation(nextConversation);
        } else {
          setConversations((prev) => upsertConversationInOrderedList(prev, nextConversation));
        }
        return;
      }

      notify(`New reply from ${conversationLabel}`, 'info');
      const existingConversation = conversationLookupMap?.get(targetConversationId);
      const nextConversation = {
        ...(data?.conversation && typeof data.conversation === 'object' ? data.conversation : {}),
        ...(incomingMessage?.conversation && typeof incomingMessage.conversation === 'object'
          ? incomingMessage.conversation
          : {}),
        _id: targetConversationId,
        id: targetConversationId,
        lastMessage:
          String(incomingMessage?.text || incomingMessage?.mediaCaption || data?.preview || '').trim() ||
          String(existingConversation?.lastMessage || '').trim(),
        lastMessageTime:
          incomingMessage?.timestamp ||
          incomingMessage?.whatsappTimestamp ||
          data?.timestamp ||
          existingConversation?.lastMessageTime ||
          new Date().toISOString(),
        lastMessageFrom:
          String(incomingMessage?.sender || data?.lastMessageFrom || 'contact').trim().toLowerCase() ||
          String(existingConversation?.lastMessageFrom || '').trim(),
        lastMessageStatus:
          String(incomingMessage?.status || data?.status || '').trim().toLowerCase() ||
          String(existingConversation?.lastMessageStatus || '').trim(),
        unreadCount: Number.isFinite(Number(data?.unreadCount))
          ? Math.max(0, Number(data.unreadCount))
          : Math.max(0, Number(existingConversation?.unreadCount || 0) + 1)
      };

      if (typeof upsertConversation === 'function') {
        upsertConversation(nextConversation);
      } else {
        setConversations((prev) => upsertConversationInOrderedList(prev, nextConversation));
      }
      queueInboxOverviewRefresh();
    };

    const handleConversationRead = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      if (!conversationId) return;
      const patch = (existingConversation = {}) => ({
        ...existingConversation,
        unreadCount: 0,
        lastMessageStatus: String(data?.status || '').trim().toLowerCase() || 'read',
        lastMessageFrom: 'agent'
      });
      if (typeof patchConversation === 'function') {
        patchConversation(conversationId, patch, { reorder: false });
      } else {
        setConversations((prev) => patchConversationInOrderedList(prev, conversationId, patch));
      }
      setSelectedConversation((prev) => {
        if (!prev || String(prev?._id || prev?.id || '').trim() !== conversationId) return prev;
        return patch(prev);
      });
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

      const eventConversationId = String(data?.conversationId || '').trim();
      if (eventConversationId) {
        const matchingConversation = conversationLookupMap?.get(eventConversationId);
        if (matchingConversation) {
          const nextConversation = {
            ...matchingConversation,
            lastMessageStatus: incomingStatus || matchingConversation?.lastMessageStatus || '',
            lastMessageWhatsappMessageId:
              String(data?.messageId || data?.whatsappMessageId || '').trim() ||
              String(matchingConversation?.lastMessageWhatsappMessageId || '').trim(),
            ...(incomingStatus === 'read' || incomingStatus === 'delivered'
              ? { lastMessageFrom: 'agent' }
              : {})
          };
          if (typeof patchConversation === 'function') {
            patchConversation(eventConversationId, nextConversation, { reorder: false });
          } else {
            setConversations((prev) => patchConversationInOrderedList(prev, eventConversationId, nextConversation));
          }
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
      const nextStatus = String(data?.status || '').trim();
      const nextUpdatedAt = String(data?.updatedAt || new Date().toISOString()).trim();
      setUserPresenceMap((prev) => {
        const previousEntry = prev?.[userId] || {};
        if (
          String(previousEntry?.status || '').trim() === nextStatus &&
          String(previousEntry?.updatedAt || '').trim() === nextUpdatedAt
        ) {
          return prev;
        }

        return {
          ...prev,
          [userId]: {
            ...previousEntry,
            status: nextStatus,
            updatedAt: nextUpdatedAt
          }
        };
      });
    };

    const handleTypingUpdate = (data = {}) => {
      const conversationId = String(data?.conversationId || '').trim();
      const userId = String(data?.userId || '').trim();
      if (!conversationId || !userId || typeof setConversationTypingState !== 'function') return;
      setConversationTypingState((prev) => {
        const current = Array.isArray(prev?.[conversationId]) ? prev[conversationId] : [];
        const nextIsTyping = Boolean(data?.isTyping);
        const nextUpdatedAt = String(data?.updatedAt || new Date().toISOString()).trim();
        const nextDisplayName = String(data?.displayName || data?.name || '').trim();
        const existingIndex = current.findIndex((entry) => String(entry?.userId || '') === userId);
        const existingEntry = existingIndex >= 0 ? current[existingIndex] : null;
        if (
          existingEntry &&
          Boolean(existingEntry?.isTyping) === nextIsTyping &&
          String(existingEntry?.displayName || '').trim() === nextDisplayName &&
          String(existingEntry?.updatedAt || '').trim() === nextUpdatedAt
        ) {
          return prev;
        }
        const nextEntries = current.filter((entry) => String(entry?.userId || '') !== userId);
        if (nextIsTyping) {
          nextEntries.push({
            userId,
            conversationId,
            displayName: nextDisplayName,
            isTyping: true,
            updatedAt: nextUpdatedAt
          });
        }
        if (existingIndex < 0 && !nextIsTyping) {
          return prev;
        }
        return {
          ...(prev || {}),
          [conversationId]: nextEntries
        };
      });
    };

    const handleCacheInvalidated = (data = {}) => {
      const eventConversationIds = Array.isArray(data?.conversationIds)
        ? data.conversationIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      const eventConversationId = String(data?.conversationId || '').trim();
      const invalidatedConversationIds = Array.from(
        new Set([eventConversationId, ...eventConversationIds].filter(Boolean))
      );
      const activeId = String(activeConversationId || '').trim();
      if (activeId && invalidatedConversationIds.includes(activeId)) {
        if (data?.conversation) {
          if (typeof upsertConversation === 'function') {
            upsertConversation(data.conversation);
          } else {
            setConversations((prev) => upsertConversationInOrderedList(prev, data.conversation));
          }
        }
        return;
      }
      if (data?.conversation) {
        if (typeof upsertConversation === 'function') {
          upsertConversation(data.conversation);
        } else {
          setConversations((prev) => upsertConversationInOrderedList(prev, data.conversation));
        }
      } else {
        queueConversationListRefresh({ silent: true, reason: 'cache_invalidated' });
      }
      queueInboxOverviewRefresh();
    };

    const handleInboxMutationEvent = (data = {}, eventType = 'crm_changed') => {
      const conversationLabel = getConversationLabel(data);
      const assigneeLabel = getAssigneeLabel(data);
      const taskTitle = getTaskTitle(data);
      const followUpLabel = getFollowUpLabel(data);
      const contactUpdate = data?.contact && typeof data.contact === 'object' ? data.contact : null;

      if (contactUpdate) {
        if (typeof setConversations === 'function') {
          setConversations((prev) =>
            Array.isArray(prev)
              ? prev.map((conversation) => mergeContactSnapshotIntoConversation(conversation, contactUpdate))
              : prev
          );
        }

        if (typeof setSelectedConversation === 'function') {
          setSelectedConversation((prev) => mergeContactSnapshotIntoConversation(prev, contactUpdate));
        }
      }

      if (eventType === 'inbox_assignment_updated') {
        notify(
          assigneeLabel
            ? `${conversationLabel} assigned to ${assigneeLabel}`
            : `${conversationLabel} assignment updated`,
          'success'
        );
      } else if (eventType === 'inbox_lead_status_updated') {
        notify(`${conversationLabel} lead stage updated`, 'info');
      } else if (eventType === 'inbox_conversation_closed') {
        notify(`${conversationLabel} closed`, 'info');
      } else if (eventType === 'inbox_conversation_reopened') {
        notify(`${conversationLabel} reopened`, 'info');
      } else if (eventType === 'inbox_conversation_flagged') {
        notify(`${conversationLabel} marked important`, 'info');
      } else if (eventType === 'inbox_internal_note_added') {
        notify(`Note added to ${conversationLabel}`, 'info');
      } else if (eventType === 'inbox_followup_updated') {
        notify(
          followUpLabel
            ? `${conversationLabel} follow-up scheduled for ${followUpLabel}`
            : `${conversationLabel} follow-up updated`,
          'info'
        );
      } else if (eventType === 'inbox_task_created') {
        notify(
          taskTitle
            ? `Task created for ${conversationLabel}: ${taskTitle}`
            : `Task created for ${conversationLabel}`,
          'info'
        );
      }

      if (data?.conversation) {
        if (typeof upsertConversation === 'function') {
          upsertConversation(data.conversation);
        } else {
          setConversations((prev) => upsertConversationInOrderedList(prev, data.conversation));
        }
      } else {
        queueConversationListRefresh({ silent: true, reason: 'crm_mutation' });
      }
      queueInboxOverviewRefresh();
    };

    const handleCrmChanged = (data) => handleInboxMutationEvent(data, 'crm_changed');
    const handleInboxAssignmentUpdated = (data) =>
      handleInboxMutationEvent(data, 'inbox_assignment_updated');
    const handleInboxLeadStatusUpdated = (data) =>
      handleInboxMutationEvent(data, 'inbox_lead_status_updated');
    const handleInboxConversationClosed = (data) =>
      handleInboxMutationEvent(data, 'inbox_conversation_closed');
    const handleInboxConversationReopened = (data) =>
      handleInboxMutationEvent(data, 'inbox_conversation_reopened');
    const handleInboxConversationFlagged = (data) =>
      handleInboxMutationEvent(data, 'inbox_conversation_flagged');
    const handleInboxInternalNoteAdded = (data) =>
      handleInboxMutationEvent(data, 'inbox_internal_note_added');
    const handleInboxFollowupUpdated = (data) =>
      handleInboxMutationEvent(data, 'inbox_followup_updated');
    const handleInboxTaskCreated = (data) =>
      handleInboxMutationEvent(data, 'inbox_task_created');

    webSocketService.on('connected', handleConnected);
    webSocketService.on('disconnected', handleDisconnected);
    webSocketService.on('connect_error', handleConnectError);
    webSocketService.on('message_sent', handleMessageSent);
    webSocketService.on('new_message', handleNewMessage);
    webSocketService.on('message_received', handleNewMessage);
    webSocketService.on('message_status', handleMessageStatus);
    webSocketService.on('message_delivered', handleMessageStatus);
    webSocketService.on('message_read', handleMessageStatus);
    webSocketService.on('conversation_read', handleConversationRead);
    webSocketService.on('lead_score_updated', handleLeadScoreUpdated);
    webSocketService.on('crm_changed', handleCrmChanged);
    webSocketService.on('team_inbox_cache_invalidated', handleCacheInvalidated);
    webSocketService.on('inbox_assignment_updated', handleInboxAssignmentUpdated);
    webSocketService.on('inbox_lead_status_updated', handleInboxLeadStatusUpdated);
    webSocketService.on('inbox_conversation_closed', handleInboxConversationClosed);
    webSocketService.on('inbox_conversation_reopened', handleInboxConversationReopened);
    webSocketService.on('inbox_conversation_flagged', handleInboxConversationFlagged);
    webSocketService.on('inbox_internal_note_added', handleInboxInternalNoteAdded);
    webSocketService.on('inbox_followup_updated', handleInboxFollowupUpdated);
    webSocketService.on('inbox_task_created', handleInboxTaskCreated);
    webSocketService.on('presence', handlePresenceUpdate);
    webSocketService.on('typing', handleTypingUpdate);
    webSocketService.on('typing_status', handleTypingUpdate);

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
      const bootstrapKey = [
        String(currentUserId || '').trim(),
        String(currentCompanyId || '').trim(),
        hasBootstrapCache ? '1' : '0',
        hasRealContactName ? '1' : '0'
      ].join('::');
      if (contactBootstrapLoadKeyRef.current !== bootstrapKey) {
        contactBootstrapLoadKeyRef.current = bootstrapKey;
        void loadContacts({ silent: true }).catch(() => undefined);
      }
    }

    return () => {
    webSocketService.off('connected', handleConnected);
    webSocketService.off('disconnected', handleDisconnected);
    webSocketService.off('connect_error', handleConnectError);
    webSocketService.off('message_sent', handleMessageSent);
    webSocketService.off('new_message', handleNewMessage);
    webSocketService.off('message_received', handleNewMessage);
    webSocketService.off('message_status', handleMessageStatus);
    webSocketService.off('message_delivered', handleMessageStatus);
    webSocketService.off('message_read', handleMessageStatus);
    webSocketService.off('conversation_read', handleConversationRead);
      webSocketService.off('lead_score_updated', handleLeadScoreUpdated);
      webSocketService.off('crm_changed', handleCrmChanged);
      webSocketService.off('team_inbox_cache_invalidated', handleCacheInvalidated);
      webSocketService.off('inbox_assignment_updated', handleInboxAssignmentUpdated);
      webSocketService.off('inbox_lead_status_updated', handleInboxLeadStatusUpdated);
      webSocketService.off('inbox_conversation_closed', handleInboxConversationClosed);
      webSocketService.off('inbox_conversation_reopened', handleInboxConversationReopened);
      webSocketService.off('inbox_conversation_flagged', handleInboxConversationFlagged);
      webSocketService.off('inbox_internal_note_added', handleInboxInternalNoteAdded);
      webSocketService.off('inbox_followup_updated', handleInboxFollowupUpdated);
      webSocketService.off('inbox_task_created', handleInboxTaskCreated);
      webSocketService.off('presence', handlePresenceUpdate);
      webSocketService.off('typing', handleTypingUpdate);
      webSocketService.off('typing_status', handleTypingUpdate);

      if (conversationListRefreshTimerRef.current) {
        clearTimeout(conversationListRefreshTimerRef.current);
        conversationListRefreshTimerRef.current = null;
      }
      if (messageStatusFlushTimerRef.current) {
        clearTimeout(messageStatusFlushTimerRef.current);
        messageStatusFlushTimerRef.current = null;
      }
      if (inboxOverviewRefreshTimerRef.current) {
        clearTimeout(inboxOverviewRefreshTimerRef.current);
        inboxOverviewRefreshTimerRef.current = null;
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
    notifyActionFeedback,
    patchConversation,
    setConversationTypingState,
    setInboxDebugInfo,
    setMessages,
    setSelectedConversation,
    setUserPresenceMap,
    setWsConnected,
    upsertConversation
  ]);

  useEffect(() => {
    if (!threadFreshSyncAtRef) return undefined;
    if (!activeConversationId) return undefined;
    threadFreshSyncAtRef.current = Number(threadFreshSyncAtRef.current || 0) || 0;
    return undefined;
  }, [activeConversationId, threadFreshSyncAtRef]);
};
