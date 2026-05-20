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
  setSelectedConversation,
  selectedConversationId,
  isConversationSwitchRef,
  loadMessages,
  loadConversationById,
  conversationId,
  getUnreadCount,
  markAsRead,
  pendingConversationRouteSyncRef,
  getConversationDisplayName
}) => {
  const lastLoadedConversationIdRef = useRef('');
  const lastLoadedAtRef = useRef(0);
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

    const matchedConversation = (Array.isArray(conversations) ? conversations : []).find(
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

      if (
        typeof loadConversationById === 'function' &&
        pendingHydrationConversationIdRef.current !== routeConversationId
      ) {
        pendingHydrationConversationIdRef.current = routeConversationId;
        void Promise.resolve(loadConversationById(routeConversationId, { silent: true }))
          .then((hydratedConversation) => {
            const hydratedConversationId = getConversationId(hydratedConversation);
            if (hydratedConversationId !== routeConversationId) return;
            setSelectedConversation((current) => {
              const currentConversationId = getConversationId(current);
              if (currentConversationId !== routeConversationId) return current;
              return hydratedConversation || current;
            });
          })
          .finally(() => {
            if (pendingHydrationConversationIdRef.current === routeConversationId) {
              pendingHydrationConversationIdRef.current = '';
            }
          });
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

    const now = Date.now();
    const sameConversation = lastLoadedConversationIdRef.current === activeConversationId;
    if (sameConversation && now - lastLoadedAtRef.current < RELOAD_DEDUP_WINDOW_MS) {
      return;
    }

    lastLoadedConversationIdRef.current = activeConversationId;
    lastLoadedAtRef.current = now;

    if (isConversationSwitchRef) {
      isConversationSwitchRef.current = false;
    }

    if (typeof loadMessages === 'function') {
      loadMessages(activeConversationId);
    }

    if (
      typeof loadConversationById === 'function' &&
      pendingHydrationConversationIdRef.current !== activeConversationId
    ) {
      pendingHydrationConversationIdRef.current = activeConversationId;
      void Promise.resolve(loadConversationById(activeConversationId, { silent: true })).finally(
        () => {
          if (pendingHydrationConversationIdRef.current === activeConversationId) {
            pendingHydrationConversationIdRef.current = '';
          }
        }
      );
    }
  }, [isConversationSwitchRef, loadConversationById, loadMessages, selectedConversationId, setSelectedConversation]);
};
