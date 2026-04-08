import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const useTeamInboxViewEffects = ({
  inboxMenuRef,
  messageMenuRef,
  filterMenuRef,
  emojiPickerRef,
  setShowSelectMenu,
  setShowMessageSelectMenu,
  setShowFilterMenu,
  setShowEmojiPicker,
  messageInputRef,
  messageInput,
  setMessageInput,
  realtimeResyncTimerRef,
  selectedConversationRef,
  loadMessages,
  chatMessagesRef,
  isConversationSwitchRef,
  messages,
  messagesLoading,
  messagesOlderLoading
}) => {
  const wasOlderMessagesLoadingRef = useRef(false);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (inboxMenuRef.current && !inboxMenuRef.current.contains(event.target)) {
        setShowSelectMenu(false);
      }
      if (messageMenuRef.current && !messageMenuRef.current.contains(event.target)) {
        setShowMessageSelectMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [
    inboxMenuRef,
    messageMenuRef,
    filterMenuRef,
    emojiPickerRef,
    setShowSelectMenu,
    setShowMessageSelectMenu,
    setShowFilterMenu,
    setShowEmojiPicker
  ]);

  const handleEmojiInsert = useCallback(
    (emoji) => {
      const inputEl = messageInputRef.current;
      if (!inputEl) {
        setMessageInput((prev) => `${prev}${emoji}`);
        return;
      }

      const start = inputEl.selectionStart ?? messageInput.length;
      const end = inputEl.selectionEnd ?? messageInput.length;
      const next = `${messageInput.slice(0, start)}${emoji}${messageInput.slice(end)}`;
      setMessageInput(next);

      requestAnimationFrame(() => {
        inputEl.focus();
        const cursor = start + emoji.length;
        inputEl.setSelectionRange(cursor, cursor);
      });
    },
    [messageInputRef, messageInput, setMessageInput]
  );

  const scheduleRealtimeResync = useCallback(
    (targetConversationId) => {
      if (!targetConversationId) return;
      if (realtimeResyncTimerRef.current) {
        clearTimeout(realtimeResyncTimerRef.current);
        realtimeResyncTimerRef.current = null;
      }

      realtimeResyncTimerRef.current = setTimeout(() => {
        const activeConversation = selectedConversationRef.current;
        if (!activeConversation) return;
        if (String(activeConversation._id) !== String(targetConversationId)) return;
        loadMessages(activeConversation._id);
      }, 180);
    },
    [realtimeResyncTimerRef, selectedConversationRef, loadMessages]
  );

  const scrollToBottom = useCallback(
    (behavior = 'smooth') => {
      const chatContainer = chatMessagesRef.current;
      if (!chatContainer) return;

      if (behavior === 'auto') {
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
      }

      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior
      });
    },
    [chatMessagesRef]
  );

  useLayoutEffect(() => {
    if (messagesOlderLoading) {
      wasOlderMessagesLoadingRef.current = true;
      return;
    }

    if (wasOlderMessagesLoadingRef.current) {
      wasOlderMessagesLoadingRef.current = false;
      return;
    }

    if (isConversationSwitchRef.current) {
      if (messagesLoading) {
        return;
      }

      scrollToBottom('auto');
      isConversationSwitchRef.current = false;
      return;
    }

    if (!messagesLoading) {
      scrollToBottom('smooth');
    }
  }, [messages, messagesLoading, messagesOlderLoading, scrollToBottom, isConversationSwitchRef]);

  return {
    handleEmojiInsert,
    scheduleRealtimeResync
  };
};
