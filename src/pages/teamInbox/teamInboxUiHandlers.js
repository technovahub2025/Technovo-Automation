export const createTeamInboxUiHandlers = ({
  selectedConversation,
  setSelectedConversation,
  navigate,
  startTransition,
  getUnreadCount,
  markAsRead,
  setShowFilterMenu,
  setShowSelectMenu,
  setShowMessageSelectMenu,
  setConversationFilter,
  setShowSelectMode,
  setSelectedForDeletion,
  setShowMessageSelectMode,
  setSelectedMessagesForDeletion,
  deleteCurrentConversation,
  setContactInfoMessage,
  setContactInfoMessageTone,
  setInternalNoteDraft,
  setShowContactInfo,
  pendingConversationRouteSyncRef
}) => {
  const handleSelectConversation = (conversation) => {
    const conversationIdValue = String(
      conversation?.conversationId ||
        conversation?.conversation_id ||
        conversation?.threadConversationId ||
        conversation?._id ||
        conversation?.id ||
        ''
    ).trim();
    if (!conversationIdValue) return;
    if (pendingConversationRouteSyncRef) {
      pendingConversationRouteSyncRef.current = conversationIdValue;
    }
    const activeConversationId = String(
      selectedConversation?.conversationId ||
        selectedConversation?.conversation_id ||
        selectedConversation?.threadConversationId ||
        selectedConversation?._id ||
        selectedConversation?.id ||
        ''
    ).trim();
    if (activeConversationId !== conversationIdValue) {
      setSelectedConversation(conversation);
    }

    const commitNavigation = () => {
      navigate(`/inbox/${conversationIdValue}`);
    };

    if (typeof startTransition === 'function') {
      startTransition(commitNavigation);
    } else {
      commitNavigation();
    }
    if (getUnreadCount(conversation) > 0) {
      markAsRead(conversationIdValue);
    }
  };

  const handleToggleFilterMenu = () => {
    setShowFilterMenu((prev) => !prev);
    setShowSelectMenu(false);
    setShowMessageSelectMenu(false);
  };

  const handleSelectConversationFilter = (nextFilter) => {
    setConversationFilter(nextFilter);
    setShowFilterMenu(false);
  };

  const handleToggleInboxMenu = () => {
    setShowSelectMenu((prev) => !prev);
    setShowFilterMenu(false);
    setShowMessageSelectMenu(false);
  };

  const handleToggleConversationSelectMode = () => {
    setShowSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedForDeletion([]);
      }
      return next;
    });
    setShowSelectMenu(false);
  };

  const handleResolveConversationSelection = () => {
    setShowSelectMode(false);
    setSelectedForDeletion([]);
  };

  const handleToggleMessageMenu = () => {
    setShowMessageSelectMenu((prev) => !prev);
    setShowSelectMenu(false);
    setShowFilterMenu(false);
  };

  const handleToggleMessageSelectionMode = () => {
    setShowMessageSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedMessagesForDeletion([]);
      }
      return next;
    });
    setShowMessageSelectMenu(false);
  };

  const handleDeleteCurrentConversationFromMenu = () => {
    setShowMessageSelectMenu(false);
    deleteCurrentConversation();
  };

  const handleOpenContactInformation = () => {
    setShowMessageSelectMenu(false);
    setContactInfoMessage('');
    setContactInfoMessageTone('info');
    setInternalNoteDraft(String(selectedConversation?.contactId?.notes || '').trim());
    setShowContactInfo(true);
  };

  return {
    handleSelectConversation,
    handleToggleFilterMenu,
    handleSelectConversationFilter,
    handleToggleInboxMenu,
    handleToggleConversationSelectMode,
    handleResolveConversationSelection,
    handleToggleMessageMenu,
    handleToggleMessageSelectionMode,
    handleDeleteCurrentConversationFromMenu,
    handleOpenContactInformation
  };
};
