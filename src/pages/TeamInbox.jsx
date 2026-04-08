import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './TeamInbox.css';
import { googleCalendarService } from '../services/googleCalendarService';
import { AuthContext } from './authcontext'
import TemplateSendModal from './teamInbox/TemplateSendModal';
import ContactInfoPanel from './teamInbox/ContactInfoPanel';
import ConversationSidebar from './teamInbox/ConversationSidebar';
import ChatArea from './teamInbox/ChatArea';
import { useTemplateSendModal } from './teamInbox/useTemplateSendModal';
import { createContactCrmActions } from './teamInbox/contactCrmActions';
import { createMeetIntegrationActions } from './teamInbox/meetIntegrationActions';
import { createInboxDataActions } from './teamInbox/inboxDataActions';
import { createInboxSelectionActions } from './teamInbox/inboxSelectionActions';
import { createTeamInboxUiHandlers } from './teamInbox/teamInboxUiHandlers';
import { useMeetOAuthEffects } from './teamInbox/useMeetOAuthEffects';
import { useInboxRealtimeEffects } from './teamInbox/useInboxRealtimeEffects';
import { useConversationSelectionEffects } from './teamInbox/useConversationSelectionEffects';
import { useTeamInboxContactEffects } from './teamInbox/useTeamInboxContactEffects';
import { useTeamInboxViewEffects } from './teamInbox/useTeamInboxViewEffects';
import { useTeamInboxBoundUtils } from './teamInbox/useTeamInboxBoundUtils';
import {
  requestTeamInboxNotificationPermission,
  TEAM_INBOX_NOTIFICATION_OPEN_EVENT,
  TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
  getTeamInboxNotificationMode
} from './teamInbox/teamInboxNotificationUtils';
import {
  formatConversationTime,
  filterConversations,
  buildGroupedMessages,
  formatMessageTime,
  getMessageKey
} from './teamInbox/teamInboxDisplayUtils';

const TeamInbox = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [conversationFilter, setConversationFilter] = useState('all');
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);
  const [showSelectMode, setShowSelectMode] = useState(false);
  const [showMessageSelectMenu, setShowMessageSelectMenu] = useState(false);
  const [showMessageSelectMode, setShowMessageSelectMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessagesForDeletion, setSelectedMessagesForDeletion] = useState([]);
  const [contactNameMap, setContactNameMap] = useState({});
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [contactInfoActionBusy, setContactInfoActionBusy] = useState(false);
  const [contactInfoMessage, setContactInfoMessage] = useState('');
  const [contactInfoMessageTone, setContactInfoMessageTone] = useState('info');
  const [internalNoteDraft, setInternalNoteDraft] = useState('');
  const [internalNoteSaving, setInternalNoteSaving] = useState(false);
  const [leadFollowUpDraft, setLeadFollowUpDraft] = useState('');
  const [leadFollowUpSaving, setLeadFollowUpSaving] = useState(false);
  const [crmTaskTitleDraft, setCrmTaskTitleDraft] = useState('');
  const [crmTaskDueDraft, setCrmTaskDueDraft] = useState('');
  const [crmTaskPriorityDraft, setCrmTaskPriorityDraft] = useState('medium');
  const [crmTaskCreating, setCrmTaskCreating] = useState(false);
  const [meetTokenDraft, setMeetTokenDraft] = useState('');
  const [meetTitleDraft, setMeetTitleDraft] = useState('');
  const [meetStartDraft, setMeetStartDraft] = useState('');
  const [meetEndDraft, setMeetEndDraft] = useState('');
  const [meetCreating, setMeetCreating] = useState(false);
  const [meetSending, setMeetSending] = useState(false);
  const [meetTemplateSending, setMeetTemplateSending] = useState(false);
  const [meetCreateFollowUpTask, setMeetCreateFollowUpTask] = useState(false);
  const [meetFollowUpTitleDraft, setMeetFollowUpTitleDraft] = useState('');
  const [meetFollowUpDueDraft, setMeetFollowUpDueDraft] = useState('');
  const [meetFollowUpPriorityDraft, setMeetFollowUpPriorityDraft] = useState('medium');
  const [meetLink, setMeetLink] = useState('');
  const [meetAuthConfigured, setMeetAuthConfigured] = useState(false);
  const [meetAuthStatusLoading, setMeetAuthStatusLoading] = useState(false);
  const [meetConnecting, setMeetConnecting] = useState(false);
  const [meetDisconnecting, setMeetDisconnecting] = useState(false);
  const [crmActivities, setCrmActivities] = useState([]);
  const [crmActivitiesLoading, setCrmActivitiesLoading] = useState(false);
  const [crmDocuments, setCrmDocuments] = useState([]);
  const [crmDocumentsLoading, setCrmDocumentsLoading] = useState(false);
  const [crmDocumentUploading, setCrmDocumentUploading] = useState(false);
  const [crmDocumentTypeDraft, setCrmDocumentTypeDraft] = useState('other');
  const [notificationMode, setNotificationMode] = useState(() => getTeamInboxNotificationMode());
  const [teamInboxActionFeedback, setTeamInboxActionFeedback] = useState(null);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const inboxMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const messageInputRef = useRef(null);
  const googleOAuthPopupRef = useRef(null);
  const isConversationSwitchRef = useRef(false);
  const realtimeResyncTimerRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const pendingConversationRouteSyncRef = useRef('');
  const activeMessagesConversationIdRef = useRef('');
  const messageLoadRequestIdRef = useRef(0);
  const messageCacheRef = useRef(new Map());
  const messageLoadPromiseMapRef = useRef(new Map());
  const commonEmojis = [
    '\u{1F44D}',
    '\u2764\uFE0F',
    '\u{1F602}',
    '\u{1F62E}',
    '\u{1F622}',
    '\u{1F64F}',
    '\u{1F60A}',
    '\u{1F525}',
    '\u{1F389}',
    '\u2705',
    '\u{1F44F}',
    '\u{1F680}'
  ];
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
  const currentUserId = user?.id || user?._id || storedUser?.id || storedUser?._id || localStorage.getItem('userId') || null;
  const showTeamInboxActionFeedback = (message, tone = 'info') => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) return;
    setTeamInboxActionFeedback({
      message: nextMessage,
      tone: String(tone || 'info').trim() || 'info'
    });
  };
  const confirmTeamInboxAction = async (message) =>
    window.confirm(String(message || '').trim());

  useEffect(() => {
    const handleNotificationModeChange = (event) => {
      setNotificationMode(String(event?.detail?.mode || getTeamInboxNotificationMode()));
    };

    window.addEventListener(
      TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
      handleNotificationModeChange
    );

    return () => {
      window.removeEventListener(
        TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
        handleNotificationModeChange
      );
    };
  }, []);

  useEffect(() => {
    if (!teamInboxActionFeedback) return undefined;
    const timer = window.setTimeout(() => {
      setTeamInboxActionFeedback(null);
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [teamInboxActionFeedback]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return undefined;
    }

    if (Notification.permission !== 'default') {
      return undefined;
    }

    if (sessionStorage.getItem('teamInboxNotificationPermissionAttempted') === 'true') {
      return undefined;
    }

    let isDisposed = false;

    const handleFirstUserActivation = () => {
      if (isDisposed) return;
      sessionStorage.setItem('teamInboxNotificationPermissionAttempted', 'true');

      requestTeamInboxNotificationPermission({ requireUserActivation: true }).catch((error) => {
        console.error('Failed to prepare Team Inbox system notifications:', error);
      });

      window.removeEventListener('pointerdown', handleFirstUserActivation, true);
      window.removeEventListener('keydown', handleFirstUserActivation, true);
    };

    window.addEventListener('pointerdown', handleFirstUserActivation, true);
    window.addEventListener('keydown', handleFirstUserActivation, true);

    return () => {
      isDisposed = true;
      window.removeEventListener('pointerdown', handleFirstUserActivation, true);
      window.removeEventListener('keydown', handleFirstUserActivation, true);
    };
  }, []);

  useEffect(() => {
    if (!meetAuthConfigured) return;
    if (!String(meetTokenDraft || '').trim()) return;
    setMeetTokenDraft('');
  }, [meetAuthConfigured, meetTokenDraft]);

  useEffect(() => {
    const handleOpenConversationFromNotification = (event) => {
      const nextConversationId = String(event?.detail?.conversationId || '').trim();
      const nextPath = String(event?.detail?.path || '').trim();
      if (!nextConversationId) return;
      pendingConversationRouteSyncRef.current = nextConversationId;

      const matchingConversation = conversations.find(
        (conversation) => String(conversation?._id || '').trim() === nextConversationId
      );

      if (matchingConversation) {
        setSelectedConversation(matchingConversation);
      }

      navigate(nextPath || `/inbox/${nextConversationId}`);
    };

    window.addEventListener(
      TEAM_INBOX_NOTIFICATION_OPEN_EVENT,
      handleOpenConversationFromNotification
    );

    return () => {
      window.removeEventListener(
        TEAM_INBOX_NOTIFICATION_OPEN_EVENT,
        handleOpenConversationFromNotification
      );
    };
  }, [conversations, navigate]);



  const appendMessageUnique = (incomingMessage) => {

    if (!incomingMessage) return;

    setMessages(prev => {

      const exists = prev.some(msg => {

        if (incomingMessage._id && msg._id) return msg._id === incomingMessage._id;

        if (incomingMessage.whatsappMessageId && msg.whatsappMessageId) {

          return msg.whatsappMessageId === incomingMessage.whatsappMessageId;

        }

        return false;

      });

      return exists ? prev : [...prev, incomingMessage];

    });

  };

  const {
    leadStageOptions,
    getUnreadCount,
    normalizeConversation,
    normalizePhone,
    getPhoneLookupKeys,
    isRealName,
    getMappedContactName,
    hasRealContactName,
    getConversationDisplayName,
    enrichConversationIdentity,
    getConversationAvatarText,
    getConversationIdValue,
    toDateTimeLocalInputValue,
    toIsoFromDateTimeLocalInput,
    formatDateTimeForActivity,
    applyLeadScoreUpdateToConversation,
    getConversationLeadScore,
    getContactIdFromConversation,
    getContactTagsRaw,
    deriveLeadStatus,
    getLeadStageValue,
    getCrmActivityLabel,
    getCrmActivityDescription
  } = useTeamInboxBoundUtils(contactNameMap);

  const {
    showTemplateSendModal,
    templateLoading,
    templateSending,
    templateOptions,
    selectedTemplateKey,
    templateVariableValues,
    templateHeaderVariableValues,
    templateHeaderMediaUrl,
    templateModalMessage,
    templateModalMessageTone,
    selectedTemplateOption,
    getTemplateCompositeKey,
    getTemplateLanguageCode,
    extractTemplateVariableCount,
    extractTemplateHeaderVariableCount,
    getTemplateHeaderFormat,
    templateRequiresHeaderMedia,
    openTemplateSendModal,
    closeTemplateSendModal,
    handleTemplateSelectionChange,
    handleTemplateVariableChange,
    handleTemplateHeaderVariableChange,
    handleTemplateHeaderMediaUrlChange,
    handleSendTemplate
  } = useTemplateSendModal({
    selectedConversation,
    conversationId,
    onMissingContactPhone: (message) => {
      setContactInfoMessage(message);
      setContactInfoMessageTone('error');
    },
    onTemplateSent: (message) => {
      setContactInfoMessage(message);
      setContactInfoMessageTone('success');
    }
  });

  const {
    applyContactUpdateLocally,
    loadCrmActivitiesForContact,
    loadCrmDocumentsForContact,
    handleQualifyLead,
    handleUnqualifyLead,
    handleSaveInternalNote,
    handleLeadStageChange,
    handleSaveLeadFollowUp,
    handleCreateQuickTask,
    handleOpenCrmDocument,
    handleDownloadCrmDocument,
    handleDeleteCrmDocument,
    handleUploadCrmDocument
  } = createContactCrmActions({
    selectedConversation,
    setConversations,
    setSelectedConversation,
    setContactInfoActionBusy,
    setContactInfoMessage,
    setContactInfoMessageTone,
    internalNoteDraft,
    setInternalNoteDraft,
    setInternalNoteSaving,
    setCrmActivities,
    setCrmActivitiesLoading,
    setCrmDocuments,
    setCrmDocumentsLoading,
    setCrmDocumentUploading,
    setLeadFollowUpSaving,
    setLeadFollowUpDraft,
    setCrmTaskCreating,
    crmDocumentTypeDraft,
    crmTaskTitleDraft,
    crmTaskDueDraft,
    crmTaskPriorityDraft,
    setCrmTaskTitleDraft,
    setCrmTaskDueDraft,
    setCrmTaskPriorityDraft,
    leadFollowUpDraft,
    normalizePhone,
    getContactIdFromConversation,
    getContactTagsRaw,
    getConversationIdValue,
    toIsoFromDateTimeLocalInput,
    toDateTimeLocalInputValue,
    confirmAction: confirmTeamInboxAction
  });
  const {
    handleCreateMeetLink,
    handleCopyMeetLink,
    handleSendMeetLinkToContact,
    handleSendMeetTemplateToContact,
    loadMeetAuthStatus,
    handleDisconnectGoogleForMeet
  } = createMeetIntegrationActions({
    meetTokenDraft,
    meetTitleDraft,
    meetStartDraft,
    meetEndDraft,
    meetCreateFollowUpTask,
    meetFollowUpTitleDraft,
    meetFollowUpDueDraft,
    meetFollowUpPriorityDraft,
    meetLink,
    meetAuthConfigured,
    selectedConversation,
    conversationId,
    setConversations,
    setMeetCreating,
    setMeetLink,
    setMeetSending,
    setMeetTemplateSending,
    setMeetAuthConfigured,
    setMeetAuthStatusLoading,
    setMeetDisconnecting,
    setMeetTokenDraft,
    setContactInfoMessage,
    setContactInfoMessageTone,
    appendMessageUnique,
    applyContactUpdateLocally,
    loadCrmActivitiesForContact,
    getContactIdFromConversation,
    getConversationIdValue,
    toIsoFromDateTimeLocalInput,
    formatDateTimeForActivity,
    getTemplateLanguageCode,
    extractTemplateVariableCount
  });
  const handleConnectGoogleForMeet = async () => {
    try {
      setMeetConnecting(true);
      setContactInfoMessage('');
      const result = await googleCalendarService.getConnectAuthUrl(window.location.origin);
      if (result?.success === false || !result?.authUrl) {
        throw new Error(result?.error || 'Failed to start Google OAuth.');
      }

      googleOAuthPopupRef.current = window.open(
        result.authUrl,
        'google-calendar-oauth',
        'width=760,height=780,menubar=no,toolbar=no,status=no'
      );

      if (!googleOAuthPopupRef.current) {
        throw new Error('Popup was blocked. Allow popups for this site and try again.');
      }

      setContactInfoMessage('Complete Google sign-in in the popup to connect Calendar.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setMeetConnecting(false);
      setContactInfoMessage(error?.message || 'Unable to start Google OAuth.');
      setContactInfoMessageTone('error');
    }
  };

  useMeetOAuthEffects({
    showContactInfo,
    loadMeetAuthStatus,
    meetConnecting,
    setMeetConnecting,
    googleOAuthPopupRef,
    setContactInfoMessage,
    setContactInfoMessageTone
  });

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const activeConversationId = String(
      selectedConversation?._id || selectedConversation?.id || ''
    ).trim();

    if (activeConversationId) return;

    activeMessagesConversationIdRef.current = '';
    messageLoadRequestIdRef.current += 1;
    setMessagesLoading(false);
    setMessages([]);
  }, [selectedConversation?._id, selectedConversation?.id]);

  useEffect(() => {
    const activeMessagesConversationId = String(
      activeMessagesConversationIdRef.current || ''
    ).trim();

    if (!activeMessagesConversationId) {
      return;
    }

    messageCacheRef.current.set(
      activeMessagesConversationId,
      Array.isArray(messages) ? messages : []
    );
  }, [messages]);

  useTeamInboxContactEffects({
    selectedConversation,
    toDateTimeLocalInputValue,
    getContactIdFromConversation,
    loadCrmActivitiesForContact,
    loadCrmDocumentsForContact,
    setShowContactInfo,
    setContactInfoMessage,
    setContactInfoMessageTone,
    setInternalNoteDraft,
    setLeadFollowUpDraft,
    setCrmTaskTitleDraft,
    setCrmTaskDueDraft,
    setCrmTaskPriorityDraft,
    setCrmDocumentTypeDraft,
    setCrmDocuments,
    setCrmDocumentsLoading,
    setCrmDocumentUploading,
    setMeetTokenDraft,
    setMeetTitleDraft,
    setMeetStartDraft,
    setMeetEndDraft,
    setMeetSending,
    setMeetTemplateSending,
    setMeetCreateFollowUpTask,
    setMeetFollowUpTitleDraft,
    setMeetFollowUpDueDraft,
    setMeetFollowUpPriorityDraft,
    setMeetLink,
    setCrmActivities,
    setCrmActivitiesLoading
  });

  const {
    loadConversations,
    loadMessages,
    sendMessage,
    sendReaction,
    sendAttachment,
    openAttachment,
    deleteMessage,
    retryAttachment,
    markAsRead,
    loadContacts
  } = createInboxDataActions({
    normalizeConversation,
    setLoading,
    setConversations,
    setMessages,
    setMessagesLoading,
    selectedConversation,
    sendingMessage,
    messageInput,
    setSendingMessage,
    setMessageInput,
    appendMessageUnique,
    getConversationIdValue,
    conversationId,
    isRealName,
    getPhoneLookupKeys,
    setContactNameMap,
    activeMessagesConversationIdRef,
    messageLoadRequestIdRef,
    messageCacheRef,
    messageLoadPromiseMapRef,
    notifyActionFeedback: showTeamInboxActionFeedback,
    confirmAction: confirmTeamInboxAction
  });
  const { handleEmojiInsert, scheduleRealtimeResync } = useTeamInboxViewEffects({
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
    messagesLoading
  });
  useConversationSelectionEffects({
    locationState: location.state,
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
  });

  useInboxRealtimeEffects({
    currentUserId,
    notificationMode,
    setWsConnected,
    loadConversations,
    loadContacts,
    hasRealContactName,
    getMappedContactName,
    setConversations,
    enrichConversationIdentity,
    selectedConversationRef,
    getUnreadCount,
    setMessages,
    appendMessageUnique,
    markAsRead,
    scheduleRealtimeResync,
    loadMessages,
    setSelectedConversation,
    applyLeadScoreUpdateToConversation,
    realtimeResyncTimerRef
  });
  const {
    deleteCurrentConversation,
    deleteConversationEntry,
    toggleSelectForDeletion,
    deleteSelectedChats,
    toggleMessageSelection,
    deleteSelectedMessages
  } = createInboxSelectionActions({
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
    notifyActionFeedback: showTeamInboxActionFeedback,
    confirmAction: confirmTeamInboxAction
  });

  const filteredConversations = filterConversations({
    conversations,
    searchTerm,
    conversationFilter,
    getUnreadCount,
    getConversationDisplayName
  });

  const groupedMessages = buildGroupedMessages(messages);

  const {
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
  } = createTeamInboxUiHandlers({
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
  });


  return (

    <div className="inbox-container">
      <ConversationSidebar
        wsConnected={wsConnected}
        filterMenuRef={filterMenuRef}
        inboxMenuRef={inboxMenuRef}
        showFilterMenu={showFilterMenu}
        showSelectMenu={showSelectMenu}
        showSelectMode={showSelectMode}
        selectedForDeletion={selectedForDeletion}
        loading={loading}
        filteredConversations={filteredConversations}
        selectedConversation={selectedConversation}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onToggleFilterMenu={handleToggleFilterMenu}
        onSelectFilter={handleSelectConversationFilter}
        onToggleSelectMenu={handleToggleInboxMenu}
        onToggleSelectMode={handleToggleConversationSelectMode}
        onDeleteSelectedChats={deleteSelectedChats}
        onDeleteConversation={deleteConversationEntry}
        onResolveSelection={handleResolveConversationSelection}
        onConversationClick={handleSelectConversation}
        onToggleSelectForDeletion={toggleSelectForDeletion}
        getUnreadCount={getUnreadCount}
        getConversationAvatarText={getConversationAvatarText}
        getConversationDisplayName={getConversationDisplayName}
        formatConversationTime={formatConversationTime}
      />

      <ChatArea
        selectedConversation={selectedConversation}
        messages={messages}
        messagesLoading={messagesLoading}
        getConversationAvatarText={getConversationAvatarText}
        getConversationDisplayName={getConversationDisplayName}
        messageMenuRef={messageMenuRef}
        showMessageSelectMenu={showMessageSelectMenu}
        showMessageSelectMode={showMessageSelectMode}
        selectedMessagesForDeletion={selectedMessagesForDeletion}
        groupedMessages={groupedMessages}
        chatMessagesRef={chatMessagesRef}
        messagesEndRef={messagesEndRef}
        messageInputRef={messageInputRef}
        messageInput={messageInput}
        showEmojiPicker={showEmojiPicker}
        emojiPickerRef={emojiPickerRef}
        commonEmojis={commonEmojis}
        externalMessageActionFeedback={teamInboxActionFeedback}
        onClearExternalMessageActionFeedback={() => setTeamInboxActionFeedback(null)}
        sendingMessage={sendingMessage}
        onToggleMessageMenu={handleToggleMessageMenu}
        onToggleMessageSelectMode={handleToggleMessageSelectionMode}
        onDeleteConversation={handleDeleteCurrentConversationFromMenu}
        onOpenContactInformation={handleOpenContactInformation}
        onToggleMessageSelection={toggleMessageSelection}
        deleteSelectedMessages={deleteSelectedMessages}
        onMessageInputChange={setMessageInput}
        onSendMessage={sendMessage}
        onReactToMessage={sendReaction}
        onSendAttachment={sendAttachment}
        onOpenAttachment={openAttachment}
        onDeleteMessage={deleteMessage}
        onRetryAttachment={retryAttachment}
        onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
        onEmojiInsert={handleEmojiInsert}
        getMessageKey={getMessageKey}
        formatMessageTime={formatMessageTime}
      />
        <TemplateSendModal
          showTemplateSendModal={showTemplateSendModal}
          closeTemplateSendModal={closeTemplateSendModal}
          templateSending={templateSending}
          templateLoading={templateLoading}
          selectedTemplateKey={selectedTemplateKey}
          handleTemplateSelectionChange={handleTemplateSelectionChange}
          templateOptions={templateOptions}
          getTemplateCompositeKey={getTemplateCompositeKey}
          getTemplateLanguageCode={getTemplateLanguageCode}
          extractTemplateVariableCount={extractTemplateVariableCount}
          extractTemplateHeaderVariableCount={extractTemplateHeaderVariableCount}
          getTemplateHeaderFormat={getTemplateHeaderFormat}
          templateRequiresHeaderMedia={templateRequiresHeaderMedia}
          selectedTemplateOption={selectedTemplateOption}
          templateVariableValues={templateVariableValues}
          templateHeaderVariableValues={templateHeaderVariableValues}
          templateHeaderMediaUrl={templateHeaderMediaUrl}
          handleTemplateVariableChange={handleTemplateVariableChange}
          handleTemplateHeaderVariableChange={handleTemplateHeaderVariableChange}
          handleTemplateHeaderMediaUrlChange={handleTemplateHeaderMediaUrlChange}
          templateModalMessage={templateModalMessage}
          templateModalMessageTone={templateModalMessageTone}
          handleSendTemplate={handleSendTemplate}
        />
      <ContactInfoPanel
        selectedConversation={selectedConversation}
        showContactInfo={showContactInfo}
        setShowContactInfo={setShowContactInfo}
        deriveLeadStatus={deriveLeadStatus}
        getConversationLeadScore={getConversationLeadScore}
        getLeadStageValue={getLeadStageValue}
        handleLeadStageChange={handleLeadStageChange}
        contactInfoActionBusy={contactInfoActionBusy}
        leadStageOptions={leadStageOptions}
        openTemplateSendModal={openTemplateSendModal}
        templateLoading={templateLoading}
        templateSending={templateSending}
        handleQualifyLead={handleQualifyLead}
        handleUnqualifyLead={handleUnqualifyLead}
        leadFollowUpDraft={leadFollowUpDraft}
        setLeadFollowUpDraft={setLeadFollowUpDraft}
        handleSaveLeadFollowUp={handleSaveLeadFollowUp}
        leadFollowUpSaving={leadFollowUpSaving}
        crmTaskTitleDraft={crmTaskTitleDraft}
        setCrmTaskTitleDraft={setCrmTaskTitleDraft}
        crmTaskPriorityDraft={crmTaskPriorityDraft}
        setCrmTaskPriorityDraft={setCrmTaskPriorityDraft}
        crmTaskDueDraft={crmTaskDueDraft}
        setCrmTaskDueDraft={setCrmTaskDueDraft}
        handleCreateQuickTask={handleCreateQuickTask}
        crmTaskCreating={crmTaskCreating}
        meetTokenDraft={meetTokenDraft}
        setMeetTokenDraft={setMeetTokenDraft}
        meetAuthConfigured={meetAuthConfigured}
        meetAuthStatusLoading={meetAuthStatusLoading}
        meetConnecting={meetConnecting}
        meetDisconnecting={meetDisconnecting}
        handleDisconnectGoogleForMeet={handleDisconnectGoogleForMeet}
        handleConnectGoogleForMeet={handleConnectGoogleForMeet}
        meetTitleDraft={meetTitleDraft}
        setMeetTitleDraft={setMeetTitleDraft}
        meetStartDraft={meetStartDraft}
        setMeetStartDraft={setMeetStartDraft}
        meetEndDraft={meetEndDraft}
        setMeetEndDraft={setMeetEndDraft}
        meetCreateFollowUpTask={meetCreateFollowUpTask}
        setMeetCreateFollowUpTask={setMeetCreateFollowUpTask}
        meetFollowUpTitleDraft={meetFollowUpTitleDraft}
        setMeetFollowUpTitleDraft={setMeetFollowUpTitleDraft}
        meetFollowUpPriorityDraft={meetFollowUpPriorityDraft}
        setMeetFollowUpPriorityDraft={setMeetFollowUpPriorityDraft}
        meetFollowUpDueDraft={meetFollowUpDueDraft}
        setMeetFollowUpDueDraft={setMeetFollowUpDueDraft}
        handleCreateMeetLink={handleCreateMeetLink}
        meetCreating={meetCreating}
        meetLink={meetLink}
        handleCopyMeetLink={handleCopyMeetLink}
        meetSending={meetSending}
        meetTemplateSending={meetTemplateSending}
        handleSendMeetTemplateToContact={handleSendMeetTemplateToContact}
        sendingMessage={sendingMessage}
        handleSendMeetLinkToContact={handleSendMeetLinkToContact}
        crmActivitiesLoading={crmActivitiesLoading}
        crmActivities={crmActivities}
        crmDocumentsLoading={crmDocumentsLoading}
        crmDocuments={crmDocuments}
        crmDocumentUploading={crmDocumentUploading}
        crmDocumentTypeDraft={crmDocumentTypeDraft}
        setCrmDocumentTypeDraft={setCrmDocumentTypeDraft}
        handleUploadCrmDocument={handleUploadCrmDocument}
        handleOpenCrmDocument={handleOpenCrmDocument}
        handleDownloadCrmDocument={handleDownloadCrmDocument}
        handleDeleteCrmDocument={handleDeleteCrmDocument}
        getCrmActivityLabel={getCrmActivityLabel}
        getCrmActivityDescription={getCrmActivityDescription}
        formatDateTimeForActivity={formatDateTimeForActivity}
        internalNoteDraft={internalNoteDraft}
        setInternalNoteDraft={setInternalNoteDraft}
        handleSaveInternalNote={handleSaveInternalNote}
        internalNoteSaving={internalNoteSaving}
        contactInfoMessage={contactInfoMessage}
        contactInfoMessageTone={contactInfoMessageTone}
      />
    </div>
  );
};
export default TeamInbox;                                                                                                  
