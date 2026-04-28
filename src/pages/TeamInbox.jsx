import React, { useState, useEffect, useRef, useContext } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './TeamInbox.css';
import { googleCalendarService } from '../services/googleCalendarService';
import { apiClient } from '../services/whatsappapi';
import { AuthContext } from './authcontext'
import TemplateSendModal from './teamInbox/TemplateSendModal';
import ContactInfoPanel from './teamInbox/ContactInfoPanel';
import WhatsAppOptInModal from '../components/WhatsAppOptInModal';
import WhatsAppConsentAuditModal from '../components/WhatsAppConsentAuditModal';
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
  readTeamInboxBootstrapCache,
  writeTeamInboxBootstrapCache,
  writeTeamInboxThreadCache
} from './teamInbox/teamInboxSessionCache';
import {
  requestTeamInboxNotificationPermission,
  TEAM_INBOX_NOTIFICATION_OPEN_EVENT,
  TEAM_INBOX_NOTIFICATION_MODE_CHANGED_EVENT,
  getTeamInboxNotificationMode
} from './teamInbox/teamInboxNotificationUtils';
import { getWhatsAppOutreachTargetFromLocationState } from '../utils/whatsappOutreachNavigation';
import { getWhatsAppConversationState } from '../utils/whatsappContactState';
import {
  addCrmContactSyncListener,
  isCrmContactSyncForContact,
  publishCrmContactSync
} from '../utils/crmSyncEvents';
import {
  formatConversationTime,
  filterConversations,
  buildGroupedMessages,
  formatMessageTime,
  getMessageKey
} from './teamInbox/teamInboxDisplayUtils';

const TEAM_INBOX_DRAFTS_PREFIX = 'team-inbox:drafts:v1';

const getTeamInboxDraftStorageKey = (currentUserId) => {
  const normalizedUserId = String(currentUserId || '').trim();
  if (!normalizedUserId) return '';
  return `${TEAM_INBOX_DRAFTS_PREFIX}:${normalizedUserId}`;
};

const readTeamInboxDrafts = (currentUserId) => {
  const key = getTeamInboxDraftStorageKey(currentUserId);
  if (!key || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeTeamInboxDrafts = (currentUserId, draftsByConversation = {}) => {
  const key = getTeamInboxDraftStorageKey(currentUserId);
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(draftsByConversation));
  } catch {
    // no-op
  }
};

const TeamInbox = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesOlderLoading, setMessagesOlderLoading] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [sidebarRefreshing, setSidebarRefreshing] = useState(false);
  const [pendingTemplateTarget, setPendingTemplateTarget] = useState(null);
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
  const [conversationDrafts, setConversationDrafts] = useState({});
  const [showWhatsAppOptInModal, setShowWhatsAppOptInModal] = useState(false);
  const [whatsAppOptInDraft, setWhatsAppOptInDraft] = useState({
    source: 'manual',
    scope: 'marketing',
    proofType: '',
    proofId: '',
    proofUrl: '',
    pageUrl: '',
    consentText:
      'I agree to receive WhatsApp updates from Technovohub and can reply STOP anytime to opt out.'
  });
  const [whatsAppOptInError, setWhatsAppOptInError] = useState('');
  const [showWhatsAppConsentAuditModal, setShowWhatsAppConsentAuditModal] = useState(false);
  const [whatsAppConsentAuditLoading, setWhatsAppConsentAuditLoading] = useState(false);
  const [whatsAppConsentAuditError, setWhatsAppConsentAuditError] = useState('');
  const [whatsAppConsentAuditData, setWhatsAppConsentAuditData] = useState(null);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const inboxMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const messageInputRef = useRef(null);
  const sidebarSearchInputRef = useRef(null);
  const googleOAuthPopupRef = useRef(null);
  const isConversationSwitchRef = useRef(false);
  const realtimeResyncTimerRef = useRef(null);
  const selectedConversationRef = useRef(null);
  const pendingConversationRouteSyncRef = useRef('');
  const activeMessagesConversationIdRef = useRef('');
  const filteredConversationsRef = useRef([]);
  const draftRestoreConversationIdRef = useRef('');
  const messageLoadRequestIdRef = useRef(0);
  const messageCacheRef = useRef(new Map());
  const messagePaginationCacheRef = useRef(new Map());
  const messageLoadPromiseMapRef = useRef(new Map());
  const restoredBootstrapCacheUserRef = useRef('');
  const consumedTemplateOpenNonceRef = useRef('');
  const lastPanelCrmSyncAtRef = useRef(0);
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
  const routeOutreachTarget = getWhatsAppOutreachTargetFromLocationState(location.state);
  const requestedConversationFilter = String(searchParams.get('filter') || 'all').trim().toLowerCase();
  const activeConversationId = String(selectedConversation?._id || '').trim();
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

  useEffect(() => {
    setConversationDrafts(readTeamInboxDrafts(currentUserId));
    draftRestoreConversationIdRef.current = '';
  }, [currentUserId, normalizeConversation]);

  useEffect(() => {
    writeTeamInboxDrafts(currentUserId, conversationDrafts);
  }, [conversationDrafts, currentUserId]);

  useEffect(() => {
    if (!activeConversationId) return;
    setConversationDrafts((prev) => {
      const currentDraft = String(prev?.[activeConversationId] || '');
      if (currentDraft === messageInput) return prev;
      return {
        ...prev,
        [activeConversationId]: messageInput
      };
    });
  }, [activeConversationId, messageInput]);

  useEffect(() => {
    if (!activeConversationId) {
      draftRestoreConversationIdRef.current = '';
      if (messageInput) setMessageInput('');
      return;
    }
    if (draftRestoreConversationIdRef.current === activeConversationId) return;
    const restoredDraft = String(conversationDrafts?.[activeConversationId] || '');
    setMessageInput(restoredDraft);
    draftRestoreConversationIdRef.current = activeConversationId;
  }, [activeConversationId, conversationDrafts, messageInput]);

  useEffect(() => {
    if (!['all', 'unread', 'read'].includes(requestedConversationFilter)) return;
    setConversationFilter(requestedConversationFilter);
  }, [requestedConversationFilter]);

  useEffect(() => {
    const desiredFilter = String(conversationFilter || 'all').trim().toLowerCase();
    if (!['all', 'unread', 'read'].includes(desiredFilter)) return;

    const currentFilter = String(searchParams.get('filter') || 'all').trim().toLowerCase();
    if (currentFilter === desiredFilter) return;

    const nextParams = new URLSearchParams(searchParams);
    if (desiredFilter === 'all') {
      nextParams.delete('filter');
    } else {
      nextParams.set('filter', desiredFilter);
    }
    setSearchParams(nextParams, { replace: true });
  }, [conversationFilter, searchParams, setSearchParams]);

  useEffect(() => {
    const normalizedUserId = String(currentUserId || '').trim();
    if (!normalizedUserId) return;
    if (restoredBootstrapCacheUserRef.current === normalizedUserId) return;

    const cachedBootstrap = readTeamInboxBootstrapCache({
      currentUserId: normalizedUserId,
      allowStale: true
    });

    restoredBootstrapCacheUserRef.current = normalizedUserId;
    if (!cachedBootstrap) return;

    const cachedConversations = Array.isArray(cachedBootstrap.conversations)
      ? cachedBootstrap.conversations.map(normalizeConversation)
      : [];
    const cachedContactNameMap =
      cachedBootstrap.contactNameMap && typeof cachedBootstrap.contactNameMap === 'object'
        ? cachedBootstrap.contactNameMap
        : {};

    setConversations(cachedConversations);
    setContactNameMap(cachedContactNameMap);
    setLoading(false);
  }, [currentUserId, normalizeConversation]);
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

  const applyWhatsAppContactUpdateLocally = (contactUpdate = {}) => {
    const normalizedContactId = String(
      contactUpdate?._id || contactUpdate?.id || ''
    ).trim();
    if (!normalizedContactId) return;

    const mergeConversation = (conversation) => {
      const conversationContactId = String(
        conversation?.contactId?._id || conversation?.contactId?.id || conversation?.contactId || ''
      ).trim();
      if (!conversationContactId || conversationContactId !== normalizedContactId) {
        return conversation;
      }

      const currentContact =
        conversation?.contactId && typeof conversation.contactId === 'object'
          ? conversation.contactId
          : {};

      return normalizeConversation({
        ...conversation,
        contactId: {
          ...currentContact,
          ...contactUpdate
        },
        contactName:
          String(contactUpdate?.name || '').trim() || conversation?.contactName || ''
      });
    };

    setConversations((prev) => prev.map(mergeConversation));
    setSelectedConversation((prev) => (prev ? mergeConversation(prev) : prev));
  };

  const buildWhatsAppOptInDraft = (contact = {}) => ({
    source: String(contact?.whatsappOptInSource || '').trim() || 'manual',
    scope: String(contact?.whatsappOptInScope || '').trim() || 'marketing',
    proofType: String(contact?.whatsappOptInProofType || '').trim(),
    proofId: String(contact?.whatsappOptInProofId || '').trim(),
    proofUrl: String(contact?.whatsappOptInProofUrl || '').trim(),
    pageUrl: String(contact?.whatsappOptInPageUrl || '').trim(),
    consentText:
      String(contact?.whatsappOptInTextSnapshot || '').trim() ||
      'I agree to receive WhatsApp updates from Technovohub and can reply STOP anytime to opt out.'
  });

  const getCapturedByLabel = () => {
    try {
      const parsedUser = JSON.parse(localStorage.getItem('user') || 'null');
      return String(
        user?.name ||
          user?.fullName ||
          user?.email ||
          parsedUser?.name ||
          parsedUser?.fullName ||
          parsedUser?.email ||
          'team_inbox'
      ).trim();
    } catch {
      return 'team_inbox';
    }
  };

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
    templateTarget: pendingTemplateTarget,
    conversationId,
    onMissingContactPhone: (message) => {
      setContactInfoMessage(message);
      setContactInfoMessageTone('error');
    },
    onTemplateSent: (message, result) => {
      setContactInfoMessage(message);
      setContactInfoMessageTone('success');
      const nextConversationId = String(result?.conversationId || '').trim();
      if (nextConversationId) {
        pendingConversationRouteSyncRef.current = nextConversationId;
        navigate(`/inbox/${nextConversationId}`);
      }
    },
    onTemplateModalClosed: () => {
      setPendingTemplateTarget(null);
    }
  });

  useEffect(() => {
    const shouldOpenTemplateModal = Boolean(location.state?.openTemplateSendModal);
    if (!shouldOpenTemplateModal || !routeOutreachTarget?.contactPhone) return;

    const routeNonce =
      String(location.state?.whatsappOutreachNonce || '').trim() ||
      `${routeOutreachTarget.contactPhone}::${routeOutreachTarget.contactId || ''}`;

    if (consumedTemplateOpenNonceRef.current === routeNonce) return;

    consumedTemplateOpenNonceRef.current = routeNonce;
    setPendingTemplateTarget(routeOutreachTarget);
  }, [location.state, routeOutreachTarget]);

  useEffect(() => {
    if (!pendingTemplateTarget?.contactPhone) return;
    if (showTemplateSendModal) return;
    openTemplateSendModal();
  }, [openTemplateSendModal, pendingTemplateTarget, showTemplateSendModal]);

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
    setContactNameMap,
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
    const unsubscribe = addCrmContactSyncListener((payload) => {
      if (!showContactInfo) return;
      const selectedContactId = getContactIdFromConversation(selectedConversation);
      if (!isCrmContactSyncForContact(payload, selectedContactId)) return;

      const now = Date.now();
      if (now - lastPanelCrmSyncAtRef.current < 900) return;
      lastPanelCrmSyncAtRef.current = now;

      const resolvedContactId = String(selectedContactId || '').trim();
      if (!resolvedContactId) return;
      loadCrmActivitiesForContact({ contactId: resolvedContactId, silent: true });
    });

    return () => {
      unsubscribe();
    };
  }, [
    getContactIdFromConversation,
    loadCrmActivitiesForContact,
    selectedConversation,
    showContactInfo
  ]);

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
    setMessagesHasMore(false);
    setMessagesOlderLoading(false);
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

    const nextMeta = messagePaginationCacheRef.current.get(activeMessagesConversationId);
    writeTeamInboxThreadCache({
      currentUserId,
      conversationId: activeMessagesConversationId,
      messages,
      meta: nextMeta
    });
  }, [currentUserId, messages]);

  useEffect(() => {
    if (!String(currentUserId || '').trim()) return;
    if (!conversations.length && !Object.keys(contactNameMap || {}).length) return;

    writeTeamInboxBootstrapCache({
      currentUserId,
      conversations,
      contactNameMap
    });
  }, [contactNameMap, conversations, currentUserId]);

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
    currentUserId,
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
    messagePaginationCacheRef,
    messageLoadPromiseMapRef,
    setSidebarRefreshing,
    setMessagesOlderLoading,
    setMessagesHasMore,
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
    messagesLoading,
    messagesOlderLoading
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
    hasBootstrapCache: Boolean(
      readTeamInboxBootstrapCache({
        currentUserId,
        allowStale: true
      })
    ),
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
    setSidebarRefreshing,
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
  filteredConversationsRef.current = filteredConversations;

  const handleMessageInputChange = (nextValue) => {
    const normalizedValue = String(nextValue || '');
    setMessageInput(normalizedValue);
    if (!activeConversationId) return;
    setConversationDrafts((prev) => ({
      ...prev,
      [activeConversationId]: normalizedValue
    }));
  };

  const groupedMessages = buildGroupedMessages(messages);
  const selectedWhatsAppState =
    selectedConversation?.contactId && typeof selectedConversation.contactId === 'object'
      ? getWhatsAppConversationState(selectedConversation.contactId)
      : {
          normalizedOptInStatus: 'unknown',
          serviceWindowClosesAt: null,
          serviceWindowOpen: true,
          freeformAllowed: true,
          templateOnly: false,
          optedOut: false,
          marketingTemplateAllowed: true,
          statusLabel: '24h Open',
          badgeTone: 'service-open'
        };

  const openSelectedConversationOptInModal = () => {
    const activeContact =
      selectedConversation?.contactId && typeof selectedConversation.contactId === 'object'
        ? selectedConversation.contactId
        : {};
    setWhatsAppOptInDraft(buildWhatsAppOptInDraft(activeContact));
    setWhatsAppOptInError('');
    setShowWhatsAppOptInModal(true);
  };

  const handleMarkSelectedConversationOptIn = async () => {
    const contactId = String(getContactIdFromConversation(selectedConversation) || '').trim();
    if (!contactId) {
      setContactInfoMessage('No contact found for this conversation.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setContactInfoActionBusy(true);
      setWhatsAppOptInError('');
      const result = await apiClient.markContactWhatsAppOptIn(contactId, {
        ...whatsAppOptInDraft,
        capturedBy: getCapturedByLabel()
      });
      const updatedContact = result?.data?.data?.contact || result?.data?.contact || null;
      if (updatedContact) {
        applyWhatsAppContactUpdateLocally(updatedContact);
      }
      await loadCrmActivitiesForContact({ contactId, silent: true });
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: 'whatsapp_opt_in'
      });
      setContactInfoMessage('WhatsApp opt-in updated.');
      setContactInfoMessageTone('success');
      setShowWhatsAppOptInModal(false);
    } catch (error) {
      const nextError =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update WhatsApp opt-in.';
      setContactInfoMessage(nextError);
      setContactInfoMessageTone('error');
      setWhatsAppOptInError(nextError);
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleMarkSelectedConversationOptOut = async () => {
    const contactId = String(getContactIdFromConversation(selectedConversation) || '').trim();
    if (!contactId) {
      setContactInfoMessage('No contact found for this conversation.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setContactInfoActionBusy(true);
      const result = await apiClient.markContactWhatsAppOptOut(contactId, {
        source: 'team_inbox'
      });
      const updatedContact = result?.data?.data?.contact || result?.data?.contact || null;
      if (updatedContact) {
        applyWhatsAppContactUpdateLocally(updatedContact);
      }
      await loadCrmActivitiesForContact({ contactId, silent: true });
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: 'whatsapp_opt_out'
      });
      setContactInfoMessage('WhatsApp opt-out updated.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to update WhatsApp opt-out.');
      setContactInfoMessageTone('error');
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const loadSelectedConversationConsentAudit = async () => {
    const contactId = String(getContactIdFromConversation(selectedConversation) || '').trim();
    if (!contactId) {
      setWhatsAppConsentAuditError('No contact found for this conversation.');
      return;
    }

    try {
      setWhatsAppConsentAuditLoading(true);
      setWhatsAppConsentAuditError('');
      const result = await apiClient.getContactWhatsAppConsentAudit(contactId);
      setWhatsAppConsentAuditData(result?.data?.data || null);
    } catch (error) {
      setWhatsAppConsentAuditError(
        error?.response?.data?.error || error?.message || 'Failed to load consent audit.'
      );
    } finally {
      setWhatsAppConsentAuditLoading(false);
    }
  };

  const openSelectedConversationConsentAudit = async () => {
    setShowWhatsAppConsentAuditModal(true);
    setWhatsAppConsentAuditData(null);
    await loadSelectedConversationConsentAudit();
  };

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

  useEffect(() => {
    const isTypingElement = (element) => {
      if (!element) return false;
      const tagName = String(element.tagName || '').toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
      return Boolean(element.isContentEditable);
    };

    const handleKeyboardShortcut = (event) => {
      const activeElement = document.activeElement;
      const isTyping = isTypingElement(activeElement);
      const withModifier = event.ctrlKey || event.metaKey;

      if (withModifier && String(event.key || '').toLowerCase() === 'k') {
        event.preventDefault();
        sidebarSearchInputRef.current?.focus();
        sidebarSearchInputRef.current?.select?.();
        return;
      }

      if (!withModifier && !event.altKey && event.key === '/' && !isTyping) {
        event.preventDefault();
        sidebarSearchInputRef.current?.focus();
        return;
      }

      if (withModifier && event.key === 'Enter') {
        if (!activeConversationId) return;
        const trimmedInput = String(messageInput || '').trim();
        if (!trimmedInput || sendingMessage) return;
        event.preventDefault();
        sendMessage();
        return;
      }

      if (!event.altKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
        return;
      }

      const safeConversations = Array.isArray(filteredConversationsRef.current)
        ? filteredConversationsRef.current
        : [];
      if (!safeConversations.length) return;

      const currentIndex = safeConversations.findIndex(
        (conversation) => String(conversation?._id || '').trim() === activeConversationId
      );
      const fallbackIndex = currentIndex < 0 ? 0 : currentIndex;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = Math.min(
        safeConversations.length - 1,
        Math.max(0, fallbackIndex + direction)
      );

      if (nextIndex === fallbackIndex && currentIndex >= 0) return;
      event.preventDefault();
      handleSelectConversation(safeConversations[nextIndex]);
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [activeConversationId, handleSelectConversation, messageInput, sendMessage, sendingMessage]);


  return (

    <div className="inbox-container">
      <ConversationSidebar
        wsConnected={wsConnected}
        refreshing={sidebarRefreshing}
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
        searchInputRef={sidebarSearchInputRef}
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
        hasOlderMessages={messagesHasMore}
        olderMessagesLoading={messagesOlderLoading}
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
        whatsappMessagingState={selectedWhatsAppState}
        onToggleMessageMenu={handleToggleMessageMenu}
        onToggleMessageSelectMode={handleToggleMessageSelectionMode}
        onDeleteConversation={handleDeleteCurrentConversationFromMenu}
        onOpenContactInformation={handleOpenContactInformation}
        onOpenTemplateSendModal={openTemplateSendModal}
        onToggleMessageSelection={toggleMessageSelection}
        deleteSelectedMessages={deleteSelectedMessages}
        onMessageInputChange={handleMessageInputChange}
        onSendMessage={sendMessage}
        onReactToMessage={sendReaction}
        onSendAttachment={sendAttachment}
        onOpenAttachment={openAttachment}
        onDeleteMessage={deleteMessage}
        onRetryAttachment={retryAttachment}
        onLoadOlderMessages={() =>
          selectedConversation ? loadMessages(selectedConversation._id, { loadOlder: true }) : false
        }
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
        whatsappMessagingState={selectedWhatsAppState}
        leadStageOptions={leadStageOptions}
        openTemplateSendModal={openTemplateSendModal}
        onMarkWhatsAppOptIn={handleMarkSelectedConversationOptIn}
        onOpenWhatsAppOptInModal={openSelectedConversationOptInModal}
        onMarkWhatsAppOptOut={handleMarkSelectedConversationOptOut}
        onViewWhatsAppConsentAudit={openSelectedConversationConsentAudit}
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
      <WhatsAppOptInModal
        open={showWhatsAppOptInModal}
        phone={selectedConversation?.contactPhone || ''}
        contactName={selectedConversation?.contactId?.name || selectedConversation?.contactName || ''}
        form={whatsAppOptInDraft}
        onChange={setWhatsAppOptInDraft}
        onClose={() => {
          if (contactInfoActionBusy) return;
          setShowWhatsAppOptInModal(false);
          setWhatsAppOptInError('');
        }}
        onSubmit={handleMarkSelectedConversationOptIn}
        submitting={contactInfoActionBusy}
        error={whatsAppOptInError}
      />
      <WhatsAppConsentAuditModal
        open={showWhatsAppConsentAuditModal}
        onClose={() => {
          if (whatsAppConsentAuditLoading) return;
          setShowWhatsAppConsentAuditModal(false);
          setWhatsAppConsentAuditError('');
          setWhatsAppConsentAuditData(null);
        }}
        loading={whatsAppConsentAuditLoading}
        error={whatsAppConsentAuditError}
        data={whatsAppConsentAuditData}
        contactName={selectedConversation?.contactId?.name || selectedConversation?.contactName || ''}
        phone={selectedConversation?.contactPhone || ''}
        onRefresh={loadSelectedConversationConsentAudit}
      />
    </div>
  );
};
export default TeamInbox;                                                                                                  
