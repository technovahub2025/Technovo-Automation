import { useEffect, useLayoutEffect, useRef } from 'react';
import { findConversationByContactIdentity } from './teamInboxIdentityUtils.js';

export const useConversationSelectionEffects = ({
  locationState,
  conversations,
  setSelectedConversation,
  selectedConversation,
  isConversationSwitchRef,
  loadMessages,
  conversationId,
  getUnreadCount,
  markAsRead,
  pendingConversationRouteSyncRef,
  getConversationDisplayName
}) => {
  const callbacksRef = useRef({
    loadMessages,
    getUnreadCount,
    markAsRead
  });
  const preloadedRouteConversationIdRef = useRef('');
  const selectedConversationId = String(
    selectedConversation?._id || selectedConversation?.id || ''
  ).trim();

  useEffect(() => {
    callbacksRef.current = {
      loadMessages,
      getUnreadCount,
      markAsRead
    };
  }, [loadMessages, getUnreadCount, markAsRead]);

  useEffect(() => {
    const normalizedConversationId = String(conversationId || '').trim();
    if (!normalizedConversationId) {
      preloadedRouteConversationIdRef.current = '';
      return;
    }
    if (selectedConversationId) return;
    if (preloadedRouteConversationIdRef.current === normalizedConversationId) return;

    preloadedRouteConversationIdRef.current = normalizedConversationId;
    callbacksRef.current.loadMessages(normalizedConversationId);
  }, [conversationId, selectedConversationId]);

  useEffect(() => {
    if ((locationState?.phoneNumber || locationState?.contactName) && conversations.length > 0) {
      const targetConversation = findConversationByContactIdentity({
        conversations,
        phoneNumber: locationState?.phoneNumber || locationState?.normalizedPhoneNumber,
        contactName: locationState?.contactName,
        getConversationDisplayName
      });

      if (targetConversation) {
        setSelectedConversation(targetConversation);
      } else {
        console.log(
          'No conversation found for contact handoff:',
          locationState?.phoneNumber || locationState?.contactName || ''
        );
      }
    }
  }, [locationState, conversations, setSelectedConversation, getConversationDisplayName]);

  useLayoutEffect(() => {
    if (!selectedConversationId) return;
    isConversationSwitchRef.current = true;
    callbacksRef.current.loadMessages(selectedConversationId);
  }, [selectedConversationId, isConversationSwitchRef]);

  useEffect(() => {
    if (!conversationId || !conversations.length) return;
    const normalizedConversationId = String(conversationId || '').trim();
    const pendingConversationId = String(
      pendingConversationRouteSyncRef?.current || ''
    ).trim();

    if (pendingConversationId && pendingConversationId !== normalizedConversationId) {
      return;
    }

    const targetConversation = conversations.find(
      (conversation) => String(conversation._id) === normalizedConversationId
    );

    if (targetConversation && selectedConversationId !== normalizedConversationId) {
      setSelectedConversation(targetConversation);
      if (callbacksRef.current.getUnreadCount(targetConversation) > 0) {
        callbacksRef.current.markAsRead(targetConversation._id);
      }
    }

    if (pendingConversationId && pendingConversationId === normalizedConversationId) {
      pendingConversationRouteSyncRef.current = '';
    }
  }, [
    conversationId,
    conversations,
    pendingConversationRouteSyncRef,
    selectedConversationId,
    setSelectedConversation
  ]);
};
