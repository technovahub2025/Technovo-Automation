export const createTeamInboxUiHandlers = ({
  selectedConversation,
  setSelectedConversation,
  navigate,
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
    const conversationIdValue = String(conversation?._id || '').trim();
    if (!conversationIdValue) return;
    if (pendingConversationRouteSyncRef) {
      pendingConversationRouteSyncRef.current = conversationIdValue;
    }
    const activeConversationId = String(
      selectedConversation?._id || selectedConversation?.id || ''
    ).trim();
    if (activeConversationId !== conversationIdValue) {
      setSelectedConversation(conversation);
    }
    navigate(`/inbox/${conversationIdValue}`);
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
