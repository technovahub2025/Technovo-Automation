import { useEffect, useRef } from 'react';

const RELOAD_DEDUP_WINDOW_MS = 1200;

const getConversationId = (conversation) =>
  String(
    conversation?.conversationId ||
      conversation?.conversation_id ||
      conversation?.threadConversationId ||
      conversation?._id ||
      conversation?.id ||
      ''
  ).trim();

export const useConversationSelectionEffects = ({
  locationState,
  conversations,
  conversationLookupMap,
  setSelectedConversation,
  selectedConversationId,
  isConversationSwitchRef,
  loadConversationById,
  conversationId,
  getUnreadCount,
  markAsRead,
  pendingConversationRouteSyncRef,
  getConversationDisplayName
}) => {
  const lastLoadedConversationIdRef = useRef('');
  const pendingHydrationConversationIdRef = useRef('');

  useEffect(() => {
    void locationState;
    void getConversationDisplayName;
  }, [getConversationDisplayName, locationState]);

  useEffect(() => {
    const routeConversationId = String(conversationId || '').trim();
    if (!routeConversationId) return;

    const activeConversationId = String(selectedConversationId || '').trim();
    if (activeConversationId === routeConversationId) return;

    const matchedConversation =
      conversationLookupMap?.get(routeConversationId) ||
      (Array.isArray(conversations) ? conversations : []).find(
        (conversation) =>
          getConversationId(conversation) === routeConversationId ||
          String(conversation?.summaryId || '').trim() === routeConversationId
      );

    if (matchedConversation) {
      if (pendingConversationRouteSyncRef) {
        pendingConversationRouteSyncRef.current = routeConversationId;
      }
      if (isConversationSwitchRef) {
        isConversationSwitchRef.current = true;
      }

      setSelectedConversation(matchedConversation);

      if (typeof markAsRead === 'function' && getUnreadCount(matchedConversation) > 0) {
        markAsRead(routeConversationId);
      }

      return;
    }

    if (
      typeof loadConversationById !== 'function' ||
      pendingHydrationConversationIdRef.current === routeConversationId
    ) {
      return;
    }

    pendingHydrationConversationIdRef.current = routeConversationId;
    void Promise.resolve(loadConversationById(routeConversationId))
      .then((hydratedConversation) => {
        const hydratedConversationId = getConversationId(hydratedConversation);
        if (hydratedConversationId !== routeConversationId) return;

        if (pendingConversationRouteSyncRef) {
          pendingConversationRouteSyncRef.current = routeConversationId;
        }
        if (isConversationSwitchRef) {
          isConversationSwitchRef.current = true;
        }

        setSelectedConversation(hydratedConversation);

        if (typeof markAsRead === 'function' && getUnreadCount(hydratedConversation) > 0) {
          markAsRead(routeConversationId);
        }
      })
      .finally(() => {
        if (pendingHydrationConversationIdRef.current === routeConversationId) {
          pendingHydrationConversationIdRef.current = '';
        }
      });
  }, [
    conversationId,
    conversations,
    conversationLookupMap,
    getUnreadCount,
    isConversationSwitchRef,
    loadConversationById,
    markAsRead,
    pendingConversationRouteSyncRef,
    selectedConversationId,
    setSelectedConversation
  ]);

  useEffect(() => {
    const activeConversationId = String(selectedConversationId || '').trim();
    if (!activeConversationId) return;

    if (lastLoadedConversationIdRef.current === activeConversationId) {
      return;
    }

    lastLoadedConversationIdRef.current = activeConversationId;

    if (isConversationSwitchRef) {
      isConversationSwitchRef.current = false;
    }
  }, [isConversationSwitchRef, selectedConversationId]);
};
