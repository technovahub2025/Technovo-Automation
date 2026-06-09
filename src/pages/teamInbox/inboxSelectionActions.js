import { whatsappService } from '../../services/whatsappService';
import {
  removeConversationByIdFromOrderedList,
  patchConversationsByIds
} from './teamInboxUtils';

const getConversationId = (conversation = {}) =>
  String(
    conversation?.conversationId ||
      conversation?.conversation_id ||
      conversation?.threadConversationId ||
      conversation?._id ||
      conversation?.id ||
      ''
  ).trim();

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
  confirmAction,
  refreshInboxOverview,
  setInboxView,
  isAgentRestricted = false,
  bulkAssignBusy = false,
  setBulkAssignBusy,
  setBulkAssignTarget
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

  const refreshInboxOverviewSafely = async () => {
    if (typeof refreshInboxOverview !== 'function') return;
    try {
      await refreshInboxOverview();
    } catch (error) {
      console.warn('Team Inbox overview refresh failed after assignment:', error);
    }
  };

  const applyConversationAssignmentLocally = (conversationIds = [], patch = {}) => {
    const conversationIdSet = new Set(
      (Array.isArray(conversationIds) ? conversationIds : [])
        .map((conversationId) => String(conversationId || '').trim())
        .filter(Boolean)
    );

    if (conversationIdSet.size === 0) return;

    const patchConversation = (conversation = {}) => {
      const conversationId = getConversationId(conversation);
      if (!conversationIdSet.has(conversationId)) return conversation;

      return {
        ...conversation,
        ...patch,
        ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
        ...(patch.assignedAgent !== undefined ? { assignedAgent: patch.assignedAgent } : {}),
        ...(patch.assignedToId !== undefined ? { assignedToId: patch.assignedToId } : {})
      };
    };

    setConversations((prev) => patchConversationsByIds(prev, conversationIds, patchConversation));

    if (selectedConversation && conversationIdSet.has(getConversationId(selectedConversation))) {
      setSelectedConversation((prev) => patchConversation(prev));
    }
  };

  const deleteConversationEntry = async (conversation) => {
    const targetConversation = conversation || selectedConversation;
    if (!targetConversation) return;
    const targetConversationId = getConversationId(targetConversation);
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

        setConversations((prev) => removeConversationByIdFromOrderedList(prev, targetConversationId));

        if (getConversationId(selectedConversation) === targetConversationId) {
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

        setConversations((prev) => {
          let next = Array.isArray(prev) ? [...prev] : [];
          selectedForDeletion.forEach((conversationId) => {
            next = removeConversationByIdFromOrderedList(next, conversationId);
          });
          return next;
        });

        if (selectedConversation && selectedForDeletion.includes(getConversationId(selectedConversation))) {
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

  const assignConversationById = async (conversationId, assignedTo) => {
    const normalizedConversationId = getConversationId({ _id: conversationId });
    const nextAssignedTo = String(assignedTo || '').trim();

    if (!normalizedConversationId || !nextAssignedTo) {
      notify('Please choose an agent to assign this chat.', 'info');
      return false;
    }

    try {
      const result = await whatsappService.assignConversation(normalizedConversationId, nextAssignedTo);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to assign conversation.');
      }

      applyConversationAssignmentLocally([normalizedConversationId], {
        assignedTo: nextAssignedTo,
        assignedAgent: nextAssignedTo,
        assignedToId: nextAssignedTo
      });
      await refreshInboxOverviewSafely();
      notify('Conversation assigned successfully.', 'success');
      return true;
    } catch (error) {
      console.error('Failed to assign conversation:', error);
      notify(error?.message || 'Failed to assign conversation', 'error');
      return false;
    }
  };

  const bulkAssignSelectedChats = async (assignedTo) => {
    if (bulkAssignBusy) return false;
    if (selectedForDeletion.length === 0) {
      notify('Please select chats to reassign', 'info');
      return false;
    }

    const nextAssignedTo = String(assignedTo || '').trim();
    if (!nextAssignedTo) {
      notify('Please choose an agent to reassign the selected chats.', 'info');
      return false;
    }

    if (
      !(await confirmWithFallback(
        `Assign ${selectedForDeletion.length} selected chat(s) to this agent?`
      ))
    ) {
      return false;
    }

    try {
      if (typeof setBulkAssignBusy === 'function') {
        setBulkAssignBusy(true);
      }

      const result = await whatsappService.bulkAssignConversations(selectedForDeletion, nextAssignedTo);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to bulk assign conversations.');
      }

      applyConversationAssignmentLocally(selectedForDeletion, {
        assignedTo: nextAssignedTo,
        assignedAgent: nextAssignedTo,
        assignedToId: nextAssignedTo
      });

      if (!isAgentRestricted && typeof setInboxView === 'function') {
        setInboxView('all');
      }

      setSelectedForDeletion([]);
      setShowSelectMode(false);
      if (typeof setBulkAssignTarget === 'function') {
        setBulkAssignTarget('');
      }
      await refreshInboxOverviewSafely();
      notify('Selected chats reassigned successfully.', 'success');
      return true;
    } catch (error) {
      console.error('Failed to bulk assign conversations:', error);
      notify(error?.message || 'Failed to bulk assign selected chats', 'error');
      return false;
    } finally {
      if (typeof setBulkAssignBusy === 'function') {
        setBulkAssignBusy(false);
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
    assignConversationById,
    bulkAssignSelectedChats,
    toggleMessageSelection,
    deleteSelectedMessages
  };
};
