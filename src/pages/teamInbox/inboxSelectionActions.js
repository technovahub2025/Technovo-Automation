import { whatsappService } from '../../services/whatsappService';

export const createInboxSelectionActions = ({
  selectedConversation,
  selectedForDeletion,
  selectedMessagesForDeletion,
  messages,
  setConversations,
  setSelectedConversation,
  setMessages,
  setSelectedForDeletion,
  setShowSelectMode,
  setSelectedMessagesForDeletion,
  setShowMessageSelectMode,
  navigate,
  getMessageKey,
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

  const deleteConversationEntry = async (conversation) => {
    const targetConversation = conversation || selectedConversation;
    if (!targetConversation) return;
    const targetConversationId = String(targetConversation?._id || '').trim();
    if (!targetConversationId) return;
    const targetDisplayName =
      targetConversation.contactId?.name || targetConversation.contactPhone || 'this contact';

    if (
      await confirmWithFallback(
        `Are you sure you want to delete this conversation with ${targetDisplayName}?`
      )
    ) {
      try {
        await whatsappService.deleteConversation(targetConversationId);

        setConversations((prev) =>
          prev.filter((conversationItem) => conversationItem._id !== targetConversationId)
        );

        if (String(selectedConversation?._id || '').trim() === targetConversationId) {
          setSelectedConversation(null);
          setMessages([]);
          navigate('/inbox');
        }

        notify('Conversation deleted successfully!', 'success');
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        notify('Failed to delete conversation', 'error');
      }
    }
  };

  const deleteCurrentConversation = async () => {
    await deleteConversationEntry(selectedConversation);
  };

  const toggleSelectForDeletion = (conversationId) => {
    console.log('Toggling conversation:', conversationId);
    console.log('Current selected:', selectedForDeletion);

    setSelectedForDeletion((prev) => {
      const nextSelection = prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];

      console.log('New selection:', nextSelection);
      return nextSelection;
    });
  };

  const deleteSelectedChats = async () => {
    if (selectedForDeletion.length === 0) {
      notify('Please select chats to delete', 'info');
      return;
    }

    if (
      await confirmWithFallback(
        `Are you sure you want to delete ${selectedForDeletion.length} chat(s)?`
      )
    ) {
      try {
        await whatsappService.deleteSelectedConversations(selectedForDeletion);

        setConversations((prev) =>
          prev.filter((conversation) => !selectedForDeletion.includes(conversation._id))
        );

        if (selectedConversation && selectedForDeletion.includes(selectedConversation._id)) {
          setSelectedConversation(null);
          setMessages([]);
          navigate('/inbox');
        }

        setSelectedForDeletion([]);
        setShowSelectMode(false);
        notify('Selected chats deleted successfully!', 'success');
      } catch (error) {
        console.error('Failed to delete selected chats:', error);
        notify('Failed to delete selected chats', 'error');
      }
    }
  };

  const toggleMessageSelection = (messageId) => {
    console.log('Toggling message:', messageId);
    console.log('Current selected messages:', selectedMessagesForDeletion);

    setSelectedMessagesForDeletion((prev) => {
      const nextSelection = prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId];

      console.log('New message selection:', nextSelection);
      return nextSelection;
    });
  };

  const deleteSelectedMessages = async () => {
    console.log(
      'Attempting to delete selected messages. Selected count:',
      selectedMessagesForDeletion.length
    );

    if (selectedMessagesForDeletion.length === 0) {
      notify('Please select messages to delete', 'info');
      return;
    }

    if (
      await confirmWithFallback(
        `Are you sure you want to delete ${selectedMessagesForDeletion.length} message(s)?`
      )
    ) {
      try {
        const selectedSet = new Set(selectedMessagesForDeletion);
        const persistedMessageIds = messages
          .map((message, index) => ({ message, key: getMessageKey(message, index) }))
          .filter((item) => selectedSet.has(item.key) && item.message?._id)
          .map((item) => item.message._id);

        if (persistedMessageIds.length > 0) {
          await whatsappService.deleteSelectedMessages(persistedMessageIds);
        }

        setMessages((prev) =>
          prev.filter((message, index) => !selectedSet.has(getMessageKey(message, index)))
        );

        setSelectedMessagesForDeletion([]);
        setShowMessageSelectMode(false);
        notify('Selected messages deleted successfully!', 'success');
      } catch (error) {
        console.error('Failed to delete selected messages:', error);
        notify('Failed to delete selected messages', 'error');
      }
    }
  };

  return {
    deleteCurrentConversation,
    deleteConversationEntry,
    toggleSelectForDeletion,
    deleteSelectedChats,
    toggleMessageSelection,
    deleteSelectedMessages
  };
};
