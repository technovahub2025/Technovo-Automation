import { useEffect, useRef } from 'react';

const REALTIME_RESYNC_DEBOUNCE_MS = 250;
const REALTIME_RESYNC_COOLDOWN_MS = 1200;
const THREAD_FRESH_SYNC_SUPPRESSION_MS = 5000;

const getConversationId = (conversation) =>
  String(conversation?._id || conversation?.id || '').trim();

const insertEmojiAtCursor = (inputElement, currentValue, emoji) => {
  const safeValue = String(currentValue || '');
  const safeEmoji = String(emoji || '');

  if (!safeEmoji) {
    return safeValue;
  }

  const start = Number.isFinite(inputElement?.selectionStart) ? inputElement.selectionStart : safeValue.length;
  const end = Number.isFinite(inputElement?.selectionEnd) ? inputElement.selectionEnd : safeValue.length;

  return `${safeValue.slice(0, start)}${safeEmoji}${safeValue.slice(end)}`;
};

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
  threadFreshSyncAtRef,
  messages,
  messagesLoading,
  messagesOlderLoading
}) => {
  const lastRealtimeResyncAtRef = useRef(0);
  const lastRealtimeResyncConversationIdRef = useRef('');

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      const isInside = (ref) => Boolean(ref?.current && target && ref.current.contains(target));

      if (!isInside(inboxMenuRef)) setShowSelectMenu(false);
      if (!isInside(messageMenuRef)) setShowMessageSelectMenu(false);
      if (!isInside(filterMenuRef)) setShowFilterMenu(false);
      if (!isInside(emojiPickerRef)) setShowEmojiPicker(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    emojiPickerRef,
    filterMenuRef,
    inboxMenuRef,
    messageMenuRef,
    setShowEmojiPicker,
    setShowFilterMenu,
    setShowMessageSelectMenu,
    setShowSelectMenu
  ]);

  useEffect(() => {
    if (!chatMessagesRef?.current) return undefined;
    const el = chatMessagesRef.current;

    const handleScroll = () => {
      const shouldKeepPinned =
        el.scrollHeight - el.scrollTop - el.clientHeight < 160 || messagesLoading || messagesOlderLoading;
      if (!shouldKeepPinned) return;
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [chatMessagesRef, messagesLoading, messagesOlderLoading]);

  const scheduleRealtimeResync = (conversationId) => {
    const normalizedConversationId = getConversationId({ _id: conversationId });
    if (!normalizedConversationId) return;

    if (realtimeResyncTimerRef?.current) {
      clearTimeout(realtimeResyncTimerRef.current);
      realtimeResyncTimerRef.current = null;
    }

    const now = Date.now();
    const sameConversation =
      lastRealtimeResyncConversationIdRef.current === normalizedConversationId;
    if (sameConversation && now - lastRealtimeResyncAtRef.current < REALTIME_RESYNC_COOLDOWN_MS) {
      return;
    }

    realtimeResyncTimerRef.current = window.setTimeout(() => {
      realtimeResyncTimerRef.current = null;

      const activeConversationId = getConversationId(selectedConversationRef?.current);
      if (activeConversationId !== normalizedConversationId) {
        return;
      }

      const lastFreshSyncAt = Number(threadFreshSyncAtRef?.current || 0) || 0;
      if (lastFreshSyncAt && now - lastFreshSyncAt < THREAD_FRESH_SYNC_SUPPRESSION_MS) {
        return;
      }

      lastRealtimeResyncConversationIdRef.current = normalizedConversationId;
      lastRealtimeResyncAtRef.current = Date.now();

      if (typeof isConversationSwitchRef !== 'undefined' && isConversationSwitchRef?.current) {
        isConversationSwitchRef.current = false;
      }

      if (typeof loadMessages === 'function') {
        loadMessages(normalizedConversationId, {
          reason: 'realtime_resync',
          forceRefresh: false
        });
      }
    }, REALTIME_RESYNC_DEBOUNCE_MS);
  };

  const handleEmojiInsert = (emoji) => {
    const inputElement = messageInputRef?.current;
    const nextValue = insertEmojiAtCursor(inputElement, messageInput, emoji);
    setMessageInput(nextValue);

    if (!inputElement) return;

    window.requestAnimationFrame(() => {
      try {
        inputElement.focus();
        const start = Number.isFinite(inputElement.selectionStart)
          ? inputElement.selectionStart
          : nextValue.length;
        const caret = start + String(emoji || '').length;
        inputElement.setSelectionRange(caret, caret);
      } catch {
        // Ignore selection errors on non-text inputs.
      }
    });
  };

  useEffect(() => {
    const timerRef = realtimeResyncTimerRef;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [realtimeResyncTimerRef]);

  useEffect(() => {
    const hasMessages = Array.isArray(messages) && messages.length > 0;
    if (!hasMessages) return;
    void messages;
  }, [messages]);

  return {
    handleEmojiInsert,
    scheduleRealtimeResync
  };
};
