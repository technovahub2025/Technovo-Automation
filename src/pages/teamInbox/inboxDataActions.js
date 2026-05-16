import axios from 'axios';
import { whatsappService } from '../../services/whatsappService';
import { startLoadingTimeoutGuard } from '../../utils/loadingGuard';
import {
  mergeMessagePreservingReplyContext,
  mergeOrderedMessagesPreservingReplyContext,
  resolvePreferredMessageStatus
} from './replyMessageMergeUtils';
import {
  readTeamInboxThreadCache,
  writeTeamInboxThreadCache
} from './teamInboxSessionCache';
import { upsertConversationInOrderedList } from './teamInboxUtils';

const DEFAULT_CONVERSATION_PAGE_LIMIT = 20;
const DEFAULT_MESSAGES_PAGE_LIMIT = 30;
const CONVERSATION_LIST_LOADING_TIMEOUT_MS = 8000;
const VALID_CONVERSATION_FILTERS = new Set(['all', 'unread', 'read']);

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
  console.debug('[TeamInbox]', ...args);
};

const recordInboxDebugEvent = (setInboxDebugInfo, lastEvent, extra = {}) => {
  if (typeof setInboxDebugInfo !== 'function') return;

  setInboxDebugInfo({
    lastEvent: String(lastEvent || 'idle').trim() || 'idle',
    lastEventAt: new Date().toISOString(),
    source: String(extra?.source || 'data').trim() || 'data',
    conversationId: String(extra?.conversationId || '').trim(),
    messageId: String(extra?.messageId || '').trim(),
    details: String(extra?.details || '').trim()
  });
};

const createMediaPipelineRequestId = () => {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `media-${Date.now()}-${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '-');
};

const normalizeMessagePageMeta = (meta = {}, fallbackLimit = DEFAULT_MESSAGES_PAGE_LIMIT) => ({
  limit: Number(meta?.limit || fallbackLimit) || fallbackLimit,
  hasMore: Boolean(meta?.hasMore),
  nextCursor: String(meta?.nextCursor || '').trim() || null
});

const normalizeConversationListFilter = (value = 'all') => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return VALID_CONVERSATION_FILTERS.has(normalizedValue) ? normalizedValue : 'all';
};

const buildConversationListQuerySignature = ({
  search = '',
  filter = 'all',
  limit = DEFAULT_CONVERSATION_PAGE_LIMIT
}) =>
  [
    String(search || '').trim().toLowerCase(),
    normalizeConversationListFilter(filter),
    Math.max(1, Math.min(Number(limit || DEFAULT_CONVERSATION_PAGE_LIMIT) || DEFAULT_CONVERSATION_PAGE_LIMIT, 200))
  ].join('::');

export const createInboxDataActions = ({
  currentUserId,
  normalizeConversation,
  setLoading,
  setConversations,
  setMessages,
  setMessagesLoading,
  setMessagesOlderLoading,
  setMessagesHasMore,
  setThreadCacheInfo,
  setInboxDebugInfo,
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
  conversationLoadPromiseMapRef,
  conversationPageMetaRef,
  conversationLoadRequestIdRef,
  threadCacheDisplaySourceRef,
  threadFreshSyncAtRef,
  setConversationPageMeta,
  setSidebarRefreshing,
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

  const normalizeConversationPageMeta = (meta = {}, querySignature = '') => {
    const limit = Number(
      meta?.limit || conversationPageMetaRef?.current?.limit || DEFAULT_CONVERSATION_PAGE_LIMIT
    );
    return {
      limit:
        Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : DEFAULT_CONVERSATION_PAGE_LIMIT,
      hasMore: Boolean(meta?.hasMore),
      nextCursor: String(meta?.nextCursor || '').trim() || null,
      exhausted: Boolean(meta?.exhausted),
      loaded: true,
      querySignature: String(querySignature || '').trim()
    };
  };

  const mergeConversationLists = (base = [], incoming = []) => {
    let nextConversations = Array.isArray(base) ? [...base] : [];
    (Array.isArray(incoming) ? incoming : []).forEach((conversation) => {
      nextConversations = upsertConversationInOrderedList(nextConversations, conversation);
    });
    return nextConversations;
  };

  const loadConversations = async ({
    silent = false,
    append = false,
    limit,
    search = '',
    filter = 'all'
  } = {}) => {
    let requestId = 0;
    let requestKey = '';
    let ownsConversationLoadPromise = false;
    const releaseLoadingGuard = silent
      ? () => true
      : startLoadingTimeoutGuard(
          () => {
            if (Number(conversationLoadRequestIdRef?.current || 0) === requestId) {
              setLoading(false);
            }
          },
          CONVERSATION_LIST_LOADING_TIMEOUT_MS
        );
    let previousPageMeta = {};
    try {
      const normalizedSearch = String(search || '').trim();
      const normalizedFilter = normalizeConversationListFilter(filter);
      const queryLimit =
        Number(limit || conversationPageMetaRef?.current?.limit || DEFAULT_CONVERSATION_PAGE_LIMIT) ||
        DEFAULT_CONVERSATION_PAGE_LIMIT;
      const querySignature = buildConversationListQuerySignature({
        search: normalizedSearch,
        filter: normalizedFilter,
        limit: queryLimit
      });
      const pageMeta = conversationPageMetaRef?.current || {};
      previousPageMeta = {
        ...(pageMeta || {})
      };
      const currentQuerySignature = String(pageMeta?.querySignature || '').trim();
      const isSameQuery = currentQuerySignature === querySignature;
      requestKey = `${querySignature}::append:${append ? '1' : '0'}`;
      const existingLoadPromise = conversationLoadPromiseMapRef?.current?.get(requestKey);

      if (existingLoadPromise) {
        if (silent && typeof setSidebarRefreshing === 'function') {
          setSidebarRefreshing(true);
        }
        if (!silent) setLoading(true);
        return existingLoadPromise;
      }

      if (append && !isSameQuery) {
        return false;
      }

      if (append && (!pageMeta.loaded || !isSameQuery)) {
        return false;
      }

      if (silent && typeof setSidebarRefreshing === 'function') {
        setSidebarRefreshing(true);
      }
      if (!silent) setLoading(true);
      if (!append) {
        const pendingMeta = {
          limit:
            Math.max(1, Math.min(queryLimit, 200)) || DEFAULT_CONVERSATION_PAGE_LIMIT,
          hasMore: false,
          nextCursor: null,
          loaded: false,
          querySignature
        };
        conversationPageMetaRef.current = pendingMeta;
        if (typeof setConversationPageMeta === 'function') {
          setConversationPageMeta(pendingMeta);
        }
      }

      requestId = Number(conversationLoadRequestIdRef?.current || 0) + 1;
      if (conversationLoadRequestIdRef) {
        conversationLoadRequestIdRef.current = requestId;
      }

      const loadPromise = (async () => {
        const currentCursor = String(pageMeta?.nextCursor || '').trim();
        const response = whatsappService.getConversationsPage
          ? await whatsappService.getConversationsPage({
              limit: queryLimit,
              scope: 'team',
              ...(append && currentCursor ? { cursor: currentCursor } : {}),
              ...(normalizedSearch ? { search: normalizedSearch } : {}),
              ...(normalizedFilter !== 'all' ? { filter: normalizedFilter } : {})
            })
          : {
              data: await whatsappService.getConversations(),
              meta: {
                limit: queryLimit,
                hasMore: false,
                nextCursor: null
              }
            };

        const currentQuerySignature = String(
          conversationPageMetaRef?.current?.querySignature || ''
        ).trim();
        if (append && currentQuerySignature !== querySignature) {
          return false;
        }
        if (!append && Number(conversationLoadRequestIdRef?.current || 0) !== requestId) {
          return false;
        }

        const incomingConversations = Array.isArray(response?.data)
          ? response.data.map(normalizeConversation)
          : [];
        const nextMeta = normalizeConversationPageMeta(response?.meta, querySignature);
        const responseHasMore =
          Boolean(nextMeta.hasMore) ||
          Boolean(nextMeta.nextCursor) ||
          incomingConversations.length >= queryLimit;
        const responseExhausted =
          Boolean(nextMeta.exhausted) ||
          (response?.ok !== false && !nextMeta.hasMore && !nextMeta.nextCursor);
        let shouldRestorePreviousMeta = false;

        setConversations((prev) => {
          const previousList = Array.isArray(prev) ? prev : [];
          const shouldPreservePreviousList =
            !append &&
            previousList.length > 0 &&
            (!response?.ok || incomingConversations.length === 0) &&
            isSameQuery;

          if (shouldPreservePreviousList) {
            shouldRestorePreviousMeta = true;
            console.warn('Team Inbox conversation refresh returned no rows; keeping the current list.', {
              querySignature,
              previousCount: previousList.length,
              responseOk: response?.ok !== false,
              responseError: response?.error || null
            });
            return previousList;
          }

          const merged = mergeConversationLists(
            append || (previousList.length && isSameQuery) ? previousList : [],
            incomingConversations
          );

          return merged.map((conversation) => {
            const conversationId = String(conversation?._id || conversation?.id || '').trim();
            const previous = previousList.find(
              (item) => String(item?._id || item?.id || '').trim() === conversationId
            );
            if (!previous) return conversation;

            return {
              ...conversation,
              lastMessageStatus: resolvePreferredMessageStatus(
                previous?.lastMessageStatus,
                conversation?.lastMessageStatus
              ),
              lastMessageFrom:
                String(conversation?.lastMessageFrom || '').trim() ||
                String(previous?.lastMessageFrom || '').trim(),
              lastMessageWhatsappMessageId:
                String(conversation?.lastMessageWhatsappMessageId || '').trim() ||
                String(previous?.lastMessageWhatsappMessageId || '').trim()
            };
          });
        });

        const effectiveMeta = shouldRestorePreviousMeta ? previousPageMeta : nextMeta;
        const normalizedEffectiveMeta = {
          ...effectiveMeta,
          hasMore: responseHasMore,
          exhausted: responseExhausted,
          totalPages: effectiveMeta.totalPages || null
        };
        conversationPageMetaRef.current = normalizedEffectiveMeta;
        if (typeof setConversationPageMeta === 'function') {
          setConversationPageMeta(normalizedEffectiveMeta);
        }

        if (!response?.ok) {
          console.warn('Team Inbox conversations loaded with a degraded response.', {
            querySignature,
            error: response?.error || 'unknown'
          });
        }

        return true;
      })();

      if (conversationLoadPromiseMapRef?.current) {
        conversationLoadPromiseMapRef.current.set(requestKey, loadPromise);
        ownsConversationLoadPromise = true;
      }

      return await loadPromise;
    } catch (error) {
      console.error('Failed to load conversations:', error);
      if (conversationLoadRequestIdRef && !append && Number(conversationLoadRequestIdRef.current || 0) === requestId) {
        const restoredMeta = {
          ...(conversationPageMetaRef?.current || {}),
          ...previousPageMeta
        };
        conversationPageMetaRef.current = restoredMeta;
        if (typeof setConversationPageMeta === 'function') {
          setConversationPageMeta(restoredMeta);
        }
      }
      return false;
    } finally {
      if (ownsConversationLoadPromise && conversationLoadPromiseMapRef?.current) {
        conversationLoadPromiseMapRef.current.delete(requestKey);
      }
      releaseLoadingGuard();
      const isCurrentRequest = Number(conversationLoadRequestIdRef?.current || 0) === requestId;
      if (silent && isCurrentRequest && typeof setSidebarRefreshing === 'function') {
        setSidebarRefreshing(false);
      }
      if (!silent && isCurrentRequest) setLoading(false);
    }
  };

  const loadMessages = async (targetConversationId, options = {}) => {
    const normalizedConversationId = String(targetConversationId || '').trim();
    const loadOlder = Boolean(options?.loadOlder);
    const forceRefresh = Boolean(options?.forceRefresh);
    const parsedPageLimit = Number(options?.limit);
    const pageLimit = Number.isFinite(parsedPageLimit)
      ? Math.max(20, Math.min(parsedPageLimit, 80))
      : DEFAULT_MESSAGES_PAGE_LIMIT;

    if (!normalizedConversationId) {
      traceTeamInbox('loadMessages:skip', { reason: 'missing_conversation_id' });
      recordInboxDebugEvent(setInboxDebugInfo, 'loadMessages:skip', {
        source: 'data',
        details: 'Missing conversation id'
      });
      activeMessagesConversationIdRef.current = '';
      messageLoadRequestIdRef.current += 1;
      setMessagesHasMore(false);
      setMessagesOlderLoading(false);
      setMessages([]);
      setMessagesLoading(false);
      if (typeof setThreadCacheInfo === 'function') {
        setThreadCacheInfo({
          source: 'unknown',
          isStale: false,
          updatedAt: null,
          messageCount: 0
        });
      }
      return false;
    }

    const previousConversationId = String(activeMessagesConversationIdRef.current || '').trim();
    const isConversationSwitch = previousConversationId !== normalizedConversationId;
    const nextRequestId = Number(messageLoadRequestIdRef.current || 0) + 1;
    const persistentCachedThread = forceRefresh
      ? null
      : readTeamInboxThreadCache({
          currentUserId,
          conversationId: normalizedConversationId,
          allowStale: true
        });
    const runtimeCachedMessages = forceRefresh
      ? null
      : messageCacheRef.current.get(normalizedConversationId);
    const cachedMessages = Array.isArray(runtimeCachedMessages)
      ? runtimeCachedMessages
      : Array.isArray(persistentCachedThread?.messages)
        ? persistentCachedThread.messages
        : null;
    const cachedMeta = normalizeMessagePageMeta(
      (forceRefresh ? null : messagePaginationCacheRef?.current?.get(normalizedConversationId)) ||
        persistentCachedThread?.meta,
      pageLimit
    );
    if (
      !forceRefresh &&
      !Array.isArray(runtimeCachedMessages) &&
      Array.isArray(persistentCachedThread?.messages)
    ) {
      messageCacheRef.current.set(normalizedConversationId, persistentCachedThread.messages);
      messagePaginationCacheRef?.current?.set(normalizedConversationId, cachedMeta);
    }

    if (typeof setThreadCacheInfo === 'function') {
      const cachedCount = Array.isArray(cachedMessages) ? cachedMessages.length : 0;
      if (
        cachedCount > 0 &&
        threadCacheDisplaySourceRef &&
        threadCacheDisplaySourceRef.current === 'unknown'
      ) {
        threadCacheDisplaySourceRef.current = 'cache';
      }
      setThreadCacheInfo({
        source:
          threadCacheDisplaySourceRef?.current === 'cache'
            ? 'cache'
            : Array.isArray(cachedMessages)
              ? 'cache'
              : 'network',
        isStale: Boolean(persistentCachedThread?.isStale),
        updatedAt: persistentCachedThread?.updatedAt || null,
        messageCount: cachedCount
      });
    }

    traceTeamInbox('loadMessages:start', {
      conversationId: normalizedConversationId,
      loadOlder,
      forceRefresh,
      requestId: nextRequestId,
      hasRuntimeCache: Array.isArray(runtimeCachedMessages),
      cachedCount: Array.isArray(cachedMessages) ? cachedMessages.length : 0,
      cachedHasMore: Boolean(cachedMeta.hasMore),
      cachedNextCursor: cachedMeta.nextCursor || null,
      previousConversationId
    });
    recordInboxDebugEvent(
      setInboxDebugInfo,
      loadOlder ? 'loadMessages:older:start' : 'loadMessages:start',
      {
        source: 'data',
        conversationId: normalizedConversationId,
        details: loadOlder ? 'Loading older messages' : 'Loading conversation messages'
      }
    );

    if (!loadOlder && isConversationSwitch && Array.isArray(cachedMessages)) {
      activeMessagesConversationIdRef.current = normalizedConversationId;
      setMessages(cachedMessages);
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
        scope: 'team',
        ...(loadOlder && cachedMeta.nextCursor ? { cursor: cachedMeta.nextCursor } : {})
      })
      .then((data) => {
        const activeConversationId = String(activeMessagesConversationIdRef.current || '').trim();
        if (loadOlder && activeConversationId !== normalizedConversationId) {
          return false;
        }

        const responseOk = Boolean(data?.ok !== false);
        const fetchedMessages = Array.isArray(data?.data) ? data.data : [];
        const fetchedMeta = normalizeMessagePageMeta(data?.meta, pageLimit);
        const currentCachedMessages = Array.isArray(
          messageCacheRef.current.get(normalizedConversationId)
        )
          ? messageCacheRef.current.get(normalizedConversationId)
          : [];
        const isStaleInitialResponse =
          !loadOlder && messageLoadRequestIdRef.current !== requestId;
        const shouldPreserveExistingMessages =
          !loadOlder &&
          currentCachedMessages.length > 0 &&
          (!responseOk || fetchedMessages.length === 0);

        if (isStaleInitialResponse && !shouldPreserveExistingMessages && fetchedMessages.length === 0) {
          return false;
        }

        const nextMessages = loadOlder
          ? mergeOrderedMessagesPreservingReplyContext(fetchedMessages, currentCachedMessages)
          : shouldPreserveExistingMessages
            ? currentCachedMessages
            : mergeOrderedMessagesPreservingReplyContext(currentCachedMessages, fetchedMessages);

        const shouldPreserveExistingPagination =
          !loadOlder &&
          (currentCachedMessages.length > fetchedMessages.length ||
            shouldPreserveExistingMessages ||
            !responseOk) &&
          messagePaginationCacheRef?.current?.has(normalizedConversationId);
        const nextMeta = shouldPreserveExistingPagination
          ? normalizeMessagePageMeta(
              messagePaginationCacheRef.current.get(normalizedConversationId),
              pageLimit
            )
          : fetchedMeta;

        traceTeamInbox('loadMessages:success', {
          conversationId: normalizedConversationId,
          loadOlder,
          requestId,
          fetchedCount: fetchedMessages.length,
          mergedCount: nextMessages.length,
          responseOk,
          hasMore: Boolean(nextMeta.hasMore),
          nextCursor: nextMeta.nextCursor || null
        });
        recordInboxDebugEvent(
          setInboxDebugInfo,
          loadOlder ? 'loadMessages:older:success' : 'loadMessages:success',
          {
            source: 'data',
            conversationId: normalizedConversationId,
            details: responseOk
              ? `${nextMessages.length} messages loaded`
              : 'Message fetch failed; preserved cached thread if available'
          }
        );

        messagePaginationCacheRef?.current?.set(normalizedConversationId, nextMeta);
        if (responseOk || nextMessages.length > 0 || currentCachedMessages.length > 0) {
          messageCacheRef.current.set(normalizedConversationId, nextMessages);
          writeTeamInboxThreadCache({
            currentUserId,
            conversationId: normalizedConversationId,
            messages: nextMessages,
            meta: nextMeta
          });
        }
        activeMessagesConversationIdRef.current = normalizedConversationId;
        setMessages(nextMessages);
        setMessagesHasMore(Boolean(nextMeta.hasMore));
        if (typeof setThreadCacheInfo === 'function') {
          const nextThreadSource =
            threadCacheDisplaySourceRef?.current === 'cache'
              ? 'cache'
              : responseOk
                ? 'fresh'
                : 'cache';
          if (threadCacheDisplaySourceRef) {
            threadCacheDisplaySourceRef.current = nextThreadSource;
          }
          if (responseOk && threadFreshSyncAtRef) {
            threadFreshSyncAtRef.current = Date.now();
          }
          setThreadCacheInfo({
            source: nextThreadSource,
            isStale: !responseOk,
            updatedAt: responseOk ? Date.now() : Date.now(),
            messageCount: nextMessages.length
          });
        }
        if (!responseOk) {
          console.warn('Team Inbox message refresh returned a degraded response.', {
            conversationId: normalizedConversationId,
            requestId,
            cachedCount: currentCachedMessages.length,
            fetchedCount: fetchedMessages.length,
            error: data?.error || null
          });
        }
        return true;
      })
      .catch((error) => {
        if (
          String(activeMessagesConversationIdRef.current || '').trim() === normalizedConversationId &&
          (!loadOlder ? messageLoadRequestIdRef.current === requestId : true)
        ) {
          console.error('Failed to load messages:', error);
        }
        traceTeamInbox('loadMessages:error', {
          conversationId: normalizedConversationId,
          loadOlder,
          requestId,
          message: String(error?.message || error || 'Unknown error')
        });
        recordInboxDebugEvent(
          setInboxDebugInfo,
          loadOlder ? 'loadMessages:older:error' : 'loadMessages:error',
          {
            source: 'data',
            conversationId: normalizedConversationId,
            details: String(error?.message || error || 'Unknown error')
          }
        );
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

  const loadConversationById = async (targetConversationId, { silent = true } = {}) => {
    const normalizedConversationId = String(targetConversationId || '').trim();
    if (!normalizedConversationId) return null;

    try {
      const response = await whatsappService.getConversation(normalizedConversationId);
      const rawConversation = response?.data || response || null;
      if (!rawConversation) return null;

      const normalizedConversation = normalizeConversation(rawConversation);
      const conversationIdValue = String(
        normalizedConversation?._id || normalizedConversation?.id || ''
      ).trim();
      if (!conversationIdValue) return null;

      setConversations((prev) => upsertConversationInOrderedList(prev, normalizedConversation));
      return normalizedConversation;
    } catch (error) {
      if (!silent) {
        console.error('Failed to load conversation by id:', error);
      }
      return null;
    }
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
    if (normalizedMimeType.startsWith('video/')) return 'video';
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

    const response = await axios.get(normalizedUrl, {
      responseType: 'blob',
      validateStatus: () => true
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const attachmentBlob = response.data;
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
    const overrideMessage = String(options?.messageOverride || '').trim();
    if ((!messageInput.trim() && !overrideMessage) || !selectedConversation || sendingMessage) return false;

    let optimisticId = null;
    let textToSend = '';
    const replyMetadata = buildReplyMetadata(options?.replyContext);
    try {
      setSendingMessage(true);
      const activeConversationId =
        getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
      textToSend = overrideMessage || messageInput.trim();
      optimisticId = `temp-${Date.now()}`;

      // Optimistic UI: show outgoing message instantly.
      if (!overrideMessage) {
        setMessageInput('');
      }
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
                ? {
                    ...message,
                    status:
                      ['delivered', 'read', 'failed'].includes(
                        String(message?.status || '').trim().toLowerCase()
                      )
                        ? String(message.status).trim().toLowerCase()
                        : 'sent'
                  }
                : message
            )
          );
        }
        return true;
      } else {
        setMessages((prev) => prev.filter((message) => message._id !== optimisticId));
        if (!overrideMessage) {
          setMessageInput(textToSend);
        }
        console.error('Failed to send message:', result?.error);
        notify(result?.error || 'Message send failed', 'error');
        return false;
      }
    } catch (error) {
      if (optimisticId) {
        setMessages((prev) => prev.filter((message) => message._id !== optimisticId));
      }
      if (textToSend && !String(options?.messageOverride || '').trim()) {
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
    if (!file || !selectedConversation || sendingMessage) {
      return { success: false, error: 'Attachment send is not available right now.' };
    }

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
      (mediaType === 'image'
        ? '[Image]'
        : mediaType === 'audio'
          ? '[Audio]'
          : mediaType === 'video'
            ? '[Video]'
            : '[Document]');
    const replyMetadata = buildReplyMetadata(options?.replyContext);
    const mediaPipelineRequestId =
      String(options?.mediaPipelineRequestId || '').trim() || createMediaPipelineRequestId();
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
        mediaPipelineRequestId,
        ...replyMetadata,
        attachment: {
          originalFileName: file.name,
          mimeType: file.type,
          bytes: Number(file.size || 0),
          fileCategory:
            mediaType === 'image'
              ? 'image'
              : mediaType === 'audio'
                ? 'audio'
                : 'document',
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
        {
          ...replyMetadata,
          mediaPipelineRequestId
        }
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Attachment send failed');
      }

      const sentMessage = result?.message || result?.data?.message;
      if (!sentMessage) {
        setMessages((prev) =>
          prev.map((message) =>
            message._id === optimisticId
              ? {
                  ...message,
                  status:
                    ['delivered', 'read', 'failed'].includes(
                      String(message?.status || '').trim().toLowerCase()
                    )
                      ? String(message.status).trim().toLowerCase()
                      : 'sent'
                }
              : message
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
                  replyTo: sentMessage?.replyTo || message?.replyTo,
                  replyToMessageId:
                    sentMessage?.replyToMessageId || message?.replyToMessageId || '',
                  whatsappContextMessageId:
                    sentMessage?.whatsappContextMessageId ||
                    message?.whatsappContextMessageId ||
                    '',
                  mediaPipelineRequestId:
                    sentMessage?.mediaPipelineRequestId ||
                    message?.mediaPipelineRequestId ||
                    mediaPipelineRequestId,
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
                ...replyMetadata,
                mediaPipelineRequestId:
                  sentMessage?.mediaPipelineRequestId || mediaPipelineRequestId
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
      return { success: true };
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
      const failureMessage = String(error?.message || 'Unable to send attachment').trim();
      const requestIdSuffix = mediaPipelineRequestId ? ` (ref: ${mediaPipelineRequestId})` : '';
      notify(`${failureMessage}${requestIdSuffix}`, 'error');
      return {
        success: false,
        error: failureMessage,
        mediaPipelineRequestId
      };
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
              ? {
                  ...message,
                  status:
                    ['delivered', 'read', 'failed'].includes(
                      String(message?.status || '').trim().toLowerCase()
                    )
                      ? String(message.status).trim().toLowerCase()
                      : 'sent'
                }
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
    const mediaPipelineRequestId = String(message?.mediaPipelineRequestId || '').trim();

    if (messageId.startsWith('temp-')) {
      setMessages((prev) => prev.filter((item) => String(item?._id || '') !== messageId));
      return;
    }

    const confirmed = await confirmWithFallback('Delete this attachment from this chat?');
    if (!confirmed) return;

    const result = await whatsappService.deleteAttachmentMessage(messageId, {
      mediaPipelineRequestId
    });
    if (!result?.success) {
      const failureMessage = String(result?.error || 'Failed to delete attachment').trim();
      const requestIdSuffix = mediaPipelineRequestId ? ` (ref: ${mediaPipelineRequestId})` : '';
      notify(`${failureMessage}${requestIdSuffix}`, 'error');
      return;
    }

    if (mediaPipelineRequestId) {
      notify(`Attachment deleted (ref: ${mediaPipelineRequestId})`, 'info');
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
    const mediaPipelineRequestId = String(message?.mediaPipelineRequestId || '').trim();
    if (!localFile) {
      notify(
        mediaPipelineRequestId
          ? `Attachment file is no longer available to retry (ref: ${mediaPipelineRequestId}).`
          : 'Attachment file is no longer available to retry.',
        'info'
      );
      return;
    }
    const rawText = String(message?.text || '').trim();
    const isPlaceholder = rawText === '[Image]' || rawText === '[Document]';
    const captionOverride = isPlaceholder ? '' : rawText;
    await sendAttachment(localFile, {
      captionOverride,
      replaceMessageId: message?._id,
      mediaPipelineRequestId: mediaPipelineRequestId || undefined
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
    loadConversationById,
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
