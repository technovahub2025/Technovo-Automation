import { useEffect, useRef } from 'react';

const RELOAD_DEDUP_WINDOW_MS = 1200;

const getConversationId = (conversation) =>
  String(conversation?._id || conversation?.id || '').trim();

export const useConversationSelectionEffects = ({
  locationState,
  conversations,
  setSelectedConversation,
  selectedConversationId,
  isConversationSwitchRef,
  loadMessages,
  conversationId,
  getUnreadCount,
  markAsRead,
  pendingConversationRouteSyncRef,
  getConversationDisplayName
}) => {
  const lastLoadedConversationIdRef = useRef('');
  const lastLoadedAtRef = useRef(0);

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
      (conversation) => getConversationId(conversation) === routeConversationId
    );

    if (!matchedConversation) return;

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
  }, [
    conversationId,
    conversations,
    getUnreadCount,
    isConversationSwitchRef,
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
  }, [isConversationSwitchRef, loadMessages, selectedConversationId]);
};
