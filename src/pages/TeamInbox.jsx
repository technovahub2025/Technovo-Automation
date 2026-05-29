import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useContext,
  useDeferredValue,
  useCallback
} from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './TeamInbox.css';
import { googleCalendarService } from '../services/googleCalendarService';
import { apiClient } from '../services/whatsappapi';
import { crmService, getCrmUserRoster, subscribeCrmUserRoster } from '../services/crmService';
import { whatsappService } from '../services/whatsappService';
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
import { useConversationListEngine } from './teamInbox/useConversationListEngine';
import { useMessageListEngine } from './teamInbox/inbox/hooks/useMessageListEngine';
import useCrmRealtimeRefresh from '../hooks/useCrmRealtimeRefresh';
import { useStableCallback } from '../hooks/useStableCallback';
import {
  readTeamInboxBootstrapCache,
  writeTeamInboxBootstrapCache
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
  publishCrmContactSync
} from '../utils/crmSyncEvents';
import {
  formatConversationTime,
  buildGroupedMessages,
  formatMessageTime,
  getMessageKey
} from './teamInbox/teamInboxDisplayUtils';
import { resolvePreferredMessageStatus } from './teamInbox/replyMessageMergeUtils';
import { resolveAgentWorkspaceState, resolveWorkspaceManagementAccessState } from '../utils/agentAccess';

const TEAM_INBOX_DRAFTS_PREFIX = 'team-inbox:drafts:v1';
const THREAD_WINDOW_BUFFER_BEFORE = 140;
const THREAD_WINDOW_BUFFER_AFTER = 220;
const THREAD_WINDOW_MIN_FULL_SIZE = 320;

const ADMIN_INBOX_FILTER_OPTIONS = [
  { value: 'all', label: 'All Chats', countKeys: ['allChats'] },
  {
    value: 'unread',
    label: 'Unread',
    countKeys: ['unreadConversations', 'unreadChats', 'unread']
  },
  { value: 'unassigned', label: 'Unassigned', countKeys: ['unassignedChats'] },
  { value: 'assigned', label: 'Assigned Chats', countKeys: ['assignedChats'] },
  { value: 'my', label: 'My Chats', countKeys: ['myChats'] },
  { value: 'closed', label: 'Closed', countKeys: ['closedChats'] },
  {
    value: 'important',
    label: 'Important',
    countKeys: ['importantChats', 'important']
  },
  {
    value: 'followups',
    label: 'Followups',
    countKeys: ['followups']
  }
];

const AGENT_INBOX_FILTER_OPTIONS = [
  {
    value: 'unread',
    label: 'Unread',
    countKeys: ['unreadConversations', 'unreadChats', 'unread']
  },
  { value: 'my', label: 'My Chats', countKeys: ['myChats'] },
  {
    value: 'assigned-leads',
    label: 'Assigned Leads',
    countKeys: ['assignedLeads', 'assignedChats']
  },
  {
    value: 'followups',
    label: 'Followups',
    countKeys: ['followups']
  },
  { value: 'closed', label: 'Closed Chats', countKeys: ['closedChats'] }
];

const INBOX_VIEW_OPTIONS = new Set([
  'all',
  'unread',
  'my',
  'assigned',
  'assigned-leads',
  'unassigned',
  'closed',
  'important',
  'followups'
]);

const normalizeInboxViewOption = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return INBOX_VIEW_OPTIONS.has(normalized) ? normalized : '';
};

const resolveInboxViewLabel = (value = '') => {
  const normalized = normalizeInboxViewOption(value);
  if (normalized === 'assigned-leads') return 'assigned';
  if (normalized === 'followups') return 'followups';
  if (normalized === 'important') return 'important';
  return normalized;
};

const buildInboxFilterOptionsWithCounts = (options = [], getCount = () => 0) =>
  (Array.isArray(options) ? options : [])
    .map((option) => {
      const normalizedValue = String(option?.value || '').trim().toLowerCase();
      const count = Number(
        getCount(normalizedValue, Array.isArray(option?.countKeys) ? option.countKeys : [])
      );
      return {
        ...option,
        value: normalizedValue,
        count: Number.isFinite(count) && count > 0 ? count : 0
      };
    })
    .filter((option) => Boolean(option.value));

const ADMIN_INBOX_VIEW_VALUES = new Set([
  'all',
  'unread',
  'unassigned',
  'assigned',
  'my',
  'closed',
  'important',
  'followups'
]);

const AGENT_INBOX_VIEW_VALUES = new Set([
  'my',
  'unread',
  'assigned-leads',
  'followups',
  'closed'
]);
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

const isTeamInboxDebugVisible = () => {
  const allowDebugOverlay =
    Boolean(import.meta?.env?.DEV) ||
    String(import.meta?.env?.VITE_ENABLE_INBOX_DEBUG || '').trim().toLowerCase() === 'true';
  if (typeof window === 'undefined') {
    return false;
  }

  return allowDebugOverlay && String(window.localStorage.getItem('debugTeamInbox') || '').trim() === '1';
};

const formatInboxDebugTimestamp = (value) => {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
};

const resolveInitialInboxView = () => {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const requestedView = String(params.get('view') || '').trim().toLowerCase();
      if (normalizeInboxViewOption(requestedView)) {
        return requestedView;
      }
    } catch {
      // fall through to role-based default
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const storedUser = JSON.parse(window.localStorage.getItem('user') || 'null');
      if (resolveAgentWorkspaceState(storedUser || {})) {
        return 'my';
      }
    } catch {
      // fall through to default
    }
  }

  return 'all';
};

const TeamInbox = () => {

  const location = useLocation();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useContext(AuthContext);
  const initialConversationPageLimit = 20;
  const {
    conversations,
    setConversations,
    upsertConversation,
    patchConversation,
    conversationByIdMap,
    conversationLookupMap
  } = useConversationListEngine([]);
  const {
    messages,
    setMessages,
    appendMessageUnique,
    upsertMessage,
    patchMessage,
    removeMessage
  } = useMessageListEngine([]);
  const [conversationPageMeta, setConversationPageMeta] = useState({
    limit: initialConversationPageLimit,
    hasMore: false,
    nextCursor: null,
    previousCursor: null,
    exhausted: false,
    loaded: false,
    querySignature: ''
  });
  const [conversationLoadingMore, setConversationLoadingMore] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesOlderLoading, setMessagesOlderLoading] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [threadCacheInfo, setThreadCacheInfo] = useState({
    source: 'unknown',
    isStale: false,
    updatedAt: null,
    messageCount: 0
  });
  const [inboxDebugInfo, setInboxDebugInfo] = useState({
    lastEvent: 'idle',
    lastEventAt: null,
    source: 'ui',
    reason: '',
    conversationId: '',
    messageId: '',
    details: ''
  });
  const [pendingTemplateTarget, setPendingTemplateTarget] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [userPresenceMap, setUserPresenceMap] = useState({});
  const [conversationTypingState, setConversationTypingState] = useState({});
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [conversationFilter, setConversationFilter] = useState(() => {
    const initialFilter = String(searchParams.get('filter') || 'all').trim().toLowerCase();
    return ['all', 'unread', 'read'].includes(initialFilter) ? initialFilter : 'all';
  });
  const [inboxView, setInboxView] = useState(() => {
    return resolveInitialInboxView();
  });
  const [agentRoster, setAgentRoster] = useState([]);
  const [inboxOverview, setInboxOverview] = useState({});
  const [selectedForDeletion, setSelectedForDeletion] = useState([]);
  const [bulkAssignTarget, setBulkAssignTarget] = useState('');
  const [bulkAssignBusy, setBulkAssignBusy] = useState(false);
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
  const [leadStageOptions, setLeadStageOptions] = useState([]);
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
  const [inboxNotifications, setInboxNotifications] = useState([]);
  const [showInboxNotificationsMenu, setShowInboxNotificationsMenu] = useState(false);
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
  const [leadScoringSettings, setLeadScoringSettings] = useState(null);
  const [leadScoringSettingsLoading, setLeadScoringSettingsLoading] = useState(false);
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
  const messageLoadAbortControllerRef = useRef(null);
  const conversationLoadRequestIdRef = useRef(0);
  const messageCacheRef = useRef(new Map());
  const messagePaginationCacheRef = useRef(new Map());
  const messageLoadPromiseMapRef = useRef(new Map());
  const threadWindowTrimmedRef = useRef(false);
  const conversationLoadPromiseMapRef = useRef(new Map());
  const threadAutoLoadAttemptRef = useRef('');
  const threadCacheDisplaySourceRef = useRef('unknown');
  const threadFreshSyncAtRef = useRef(0);
  const conversationPageMetaRef = useRef({
    limit: initialConversationPageLimit,
    hasMore: false,
    nextCursor: null,
    previousCursor: null,
    exhausted: false,
    loaded: false,
    querySignature: ''
  });
  const restoredBootstrapCacheUserRef = useRef('');
  const conversationQueryInitializedRef = useRef(false);
  const consumedTemplateOpenNonceRef = useRef('');
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
  const currentUserDisplayName = String(
    user?.displayName ||
      user?.fullName ||
      user?.name ||
      user?.username ||
      user?.email ||
      storedUser?.displayName ||
      storedUser?.fullName ||
      storedUser?.name ||
      storedUser?.username ||
      storedUser?.email ||
      ''
  ).trim();
  const currentUserInternalRole = String(
    user?.companyRole || user?.role || storedUser?.companyRole || storedUser?.role || ''
  )
    .trim()
    .toLowerCase();
  const currentCompanyId = user?.companyId || storedUser?.companyId || localStorage.getItem('companyId') || null;
  const workspaceAccessSource = Object.keys(user || {}).length ? user : (storedUser || {});
  const isAdminWorkspace = resolveWorkspaceManagementAccessState(workspaceAccessSource);
  const isAgentWorkspace = !isAdminWorkspace && resolveAgentWorkspaceState(workspaceAccessSource);
  const currentViewerInternalRole = isAgentWorkspace ? 'agent' : 'admin';
  const isAgentInbox = isAgentWorkspace;
  const isAdminInbox = !isAgentInbox;
  const isAgentRestricted = isAgentWorkspace;
  const canAssignChats = !isAgentRestricted;
  const inboxFilterOptions = isAgentInbox ? AGENT_INBOX_FILTER_OPTIONS : ADMIN_INBOX_FILTER_OPTIONS;
  const inboxFilterTitle = isAgentInbox ? 'Agent Inbox Filters' : 'Admin Inbox Filters';
  const inboxFilterDescription = isAgentInbox
    ? 'My work queue and channel filters'
    : 'Workspace-wide queue and channel filters';
  const inboxWorkspaceLabel = isAgentInbox ? 'Agent workspace' : 'Admin workspace';
  const inboxWorkspaceHint = isAgentInbox ? 'Assigned queue only' : 'Full inbox access';
  const inboxFilterSummary = isAgentInbox
    ? 'My Chats, Assigned Leads, Followups, Closed Chats'
    : 'All Chats, Unassigned, Assigned Chats, My Chats, Closed, Important, Followups';
  const inboxChannelNote = isAgentInbox
    ? 'Assigned conversations only, with follow-up and closure controls.'
    : 'Workspace-wide queue with reassignment, follow-up, and priority monitoring.';
  const assignableAgents = useMemo(
    () =>
      (Array.isArray(agentRoster) ? agentRoster : []).filter((agent) => {
        if (!agent || typeof agent !== 'object') return false;
        return agent?.isEnabled !== false;
      }),
    [agentRoster]
  );
  const normalizeInboxAgentRecord = useCallback((agent = {}) => {
    const agentId = String(agent?.id || agent?._id || agent?.userId || '').trim();
    if (!agentId) return null;

    const companyRole = String(agent?.companyRole || agent?.role || '').trim().toLowerCase();
    const displayName = String(
      agent?.displayName ||
        agent?.name ||
        agent?.username ||
        agent?.fullName ||
        agent?.email ||
        agentId
    ).trim();

    return {
      _id: agentId,
      id: agentId,
      userId: agentId,
      name: displayName,
      displayName,
      email: String(agent?.email || '').trim(),
      role: String(agent?.displayRole || (companyRole === 'admin' ? 'Admin' : 'Agent')).trim() || 'Agent',
      companyRole: companyRole || 'user',
      isEnabled: typeof agent?.isEnabled === 'boolean' ? agent.isEnabled : true,
      source: String(agent?.source || '').trim(),
      connected: agent?.connected !== false,
      lastSeenAt: String(agent?.lastSeenAt || '').trim()
    };
  }, []);
  const mergeInboxAgentRoster = useCallback(
    (baseList = [], incomingList = []) => {
      const merged = new Map();

      const addRecord = (record) => {
        const normalized = normalizeInboxAgentRecord(record);
        if (!normalized) return;

        const previous = merged.get(normalized.id);
        merged.set(normalized.id, {
          ...(previous || {}),
          ...normalized,
          isEnabled:
            typeof normalized.isEnabled === 'boolean'
              ? normalized.isEnabled
              : previous?.isEnabled !== false,
          connected:
            typeof normalized.connected === 'boolean'
              ? normalized.connected
              : previous?.connected !== false || false
        });
      };

      (Array.isArray(baseList) ? baseList : []).forEach(addRecord);
      (Array.isArray(incomingList) ? incomingList : []).forEach(addRecord);
      return Array.from(merged.values());
    },
    [normalizeInboxAgentRecord]
  );
  const currentWorkspaceAssigneeId = String(currentUserId || '').trim();
  const inboxStatusView = inboxView === 'archived' ? 'archived' : '';
  const inboxAssignedTo = isAgentRestricted && currentWorkspaceAssigneeId ? currentWorkspaceAssigneeId : '';
  const routeOutreachTarget = getWhatsAppOutreachTargetFromLocationState(location.state);
  const requestedConversationFilter = String(searchParams.get('filter') || 'all').trim().toLowerCase();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedConversationSearchTerm = String(deferredSearchTerm || '').trim();
  const normalizedConversationFilter = ['all', 'unread', 'read'].includes(
    String(conversationFilter || 'all').trim().toLowerCase()
  )
    ? String(conversationFilter || 'all').trim().toLowerCase()
    : 'all';
  const isInboxDebugVisible = isTeamInboxDebugVisible();
  const {
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
  } = useTeamInboxBoundUtils(contactNameMap, leadStageOptions);
  const activeConversationId = String(getConversationIdValue(selectedConversation) || '').trim();
  const permittedInboxViewValues = isAgentInbox ? AGENT_INBOX_VIEW_VALUES : ADMIN_INBOX_VIEW_VALUES;

  useEffect(() => {
    setConversationDrafts(readTeamInboxDrafts(currentUserId));
    draftRestoreConversationIdRef.current = '';
  }, [currentUserId, normalizeConversation]);

  useEffect(() => {
    if (!selectedConversation) return;

    const currentConversationId = String(getConversationIdValue(selectedConversation) || '').trim();
    if (!currentConversationId) return;

    const nextSelectedConversation = enrichConversationIdentity(selectedConversation, conversations);
    const nextConversationId = String(getConversationIdValue(nextSelectedConversation) || '').trim();
    if (!nextConversationId || nextConversationId === currentConversationId) return;

    setSelectedConversation(nextSelectedConversation);
  }, [
    conversations,
    enrichConversationIdentity,
    getConversationIdValue,
    selectedConversation,
    setSelectedConversation
  ]);

  useEffect(() => {
    let cancelled = false;
    crmService.getPipelineStages().then((result) => {
      if (cancelled) return;
      if (result?.success === false) return;

      const nextStages = Array.isArray(result?.data?.stages) && result.data.stages.length
        ? result.data.stages.map((stage, index) => ({
            value: String(stage?.key || '').trim().toLowerCase(),
            label: String(stage?.label || '').trim() || String(stage?.key || '').trim() || `Stage ${index + 1}`
          }))
        : [];
      setLeadStageOptions(nextStages);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeTeamInboxDrafts(currentUserId, conversationDrafts);
  }, [conversationDrafts, currentUserId]);

  useEffect(() => {
    let cancelled = false;

    const loadLeadScoringSettings = async () => {
      if (!String(currentUserId || '').trim()) {
        setLeadScoringSettings(null);
        return;
      }

      try {
        setLeadScoringSettingsLoading(true);
        const result = await apiClient.getLeadScoringSettings();
        if (cancelled) return;
        if (result?.success === false) {
          setLeadScoringSettings(null);
          return;
        }
        setLeadScoringSettings(result?.data || result || null);
      } catch {
        if (!cancelled) {
          setLeadScoringSettings(null);
        }
      } finally {
        if (!cancelled) {
          setLeadScoringSettingsLoading(false);
        }
      }
    };

    loadLeadScoringSettings();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!canAssignChats) {
      setAgentRoster([]);
      return undefined;
    }

    let cancelled = false;

    const loadWorkspaceAgentRoster = async () => {
      try {
        const result = await getCrmUserRoster({ preferWebSocket: true });
        const users = Array.isArray(result?.data) ? result.data : [];
        if (cancelled) return;
        setAgentRoster((previous) => mergeInboxAgentRoster(previous, users));
      } catch {
        if (!cancelled) {
          setAgentRoster([]);
        }
      }
    };

    loadWorkspaceAgentRoster();

    const unsubscribe = subscribeCrmUserRoster((payload = {}) => {
      if (cancelled) return;
      setAgentRoster((previous) => mergeInboxAgentRoster(previous, payload?.users || []));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [canAssignChats, mergeInboxAgentRoster]);

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
      if (messageInput) {
        setMessageInput((prev) => (prev ? '' : prev));
      }
      return;
    }
    if (draftRestoreConversationIdRef.current === activeConversationId) return;
    const restoredDraft = String(conversationDrafts?.[activeConversationId] || '');
    if (restoredDraft === messageInput) {
      draftRestoreConversationIdRef.current = activeConversationId;
      return;
    }
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
  const showTeamInboxActionFeedback = useCallback((message, tone = 'info') => {
    const nextMessage = String(message || '').trim();
    if (!nextMessage) return;
    setInboxNotifications((previous) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message: nextMessage,
        tone: String(tone || 'info').trim() || 'info',
        createdAt: new Date().toISOString(),
        source: 'inbox-action'
      },
      ...previous
    ].slice(0, 5));
    setTeamInboxActionFeedback({
      message: nextMessage,
      tone: String(tone || 'info').trim() || 'info'
    });
  }, []);
  const confirmTeamInboxAction = useCallback(
    async (message) => window.confirm(String(message || '').trim()),
    []
  );

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

      const matchingConversation =
        conversationLookupMap.get(nextConversationId) || conversationByIdMap.get(nextConversationId);

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
  }, [conversationByIdMap, conversationLookupMap, navigate]);

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
    getTemplateCategory,
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

  const groupedMessages = useMemo(() => buildGroupedMessages(messages), [messages]);
  const latestInboundMessageAtFromThread = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) return null;

    let latestTime = 0;
    for (const message of messages) {
      if (String(message?.sender || '').trim().toLowerCase() !== 'contact') continue;
      const candidate = new Date(
        message?.whatsappTimestamp || message?.timestamp || message?.createdAt
      );
      const candidateTime = candidate.getTime();
      if (Number.isNaN(candidateTime)) continue;
      if (candidateTime > latestTime) {
        latestTime = candidateTime;
      }
    }

    return latestTime ? new Date(latestTime).toISOString() : null;
  }, [messages]);

  const whatsappStateContactSource = {
    ...(selectedConversation?.contactId && typeof selectedConversation.contactId === 'object'
      ? selectedConversation.contactId
      : {}),
    ...(selectedConversation?.contactId && typeof selectedConversation.contactId !== 'object'
      ? { _id: selectedConversation.contactId }
      : {}),
    ...(selectedConversation?.contactName ? { name: selectedConversation.contactName } : {}),
    ...(selectedConversation?.contactPhone ? { phone: selectedConversation.contactPhone } : {}),
    ...(selectedConversation?.whatsappOptInStatus
      ? { whatsappOptInStatus: selectedConversation.whatsappOptInStatus }
      : {}),
    ...(selectedConversation?.whatsappOptInScope
      ? { whatsappOptInScope: selectedConversation.whatsappOptInScope }
      : {}),
    ...(selectedConversation?.serviceWindowClosesAt
      ? { serviceWindowClosesAt: selectedConversation.serviceWindowClosesAt }
      : {}),
    ...(selectedConversation?.lastInboundMessageAt
      ? { lastInboundMessageAt: selectedConversation.lastInboundMessageAt }
      : {}),
    ...(latestInboundMessageAtFromThread
      ? { lastInboundMessageAt: latestInboundMessageAtFromThread }
      : {})
  };

  const selectedWhatsAppState = getWhatsAppConversationState(whatsappStateContactSource);

  const refreshInboxOverview = useCallback(async ({ skipCache = false } = {}) => {
    try {
      const result = await whatsappService.getInboxOverview({
        view: inboxView,
        ...(skipCache ? { skipCache: true } : {})
      });
      if (result?.success === false) {
        return false;
      }
      setInboxOverview(result?.data && typeof result.data === 'object' ? result.data : {});
      return true;
    } catch (error) {
      console.error('Failed to refresh inbox overview:', error);
      return false;
    }
  }, [inboxView]);

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
    handleAssignConversation,
    handleSetConversationImportant,
    handleCloseConversation,
    handleReopenConversation,
    handleAddInternalNote,
    handleCreateFollowupTask,
    handleConversationLeadStatusChange,
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
    currentUserId,
    toIsoFromDateTimeLocalInput,
    toDateTimeLocalInputValue,
    refreshInboxOverview,
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
  const selectedContactCrmId = String(getContactIdFromConversation(selectedConversation) || '').trim();

  useCrmRealtimeRefresh({
    currentUserId,
    contactId: selectedContactCrmId,
    enabled: Boolean(showContactInfo && selectedContactCrmId),
    onRefresh: () => {
      const resolvedContactId = String(selectedContactCrmId || '').trim();
      if (!resolvedContactId) return;
      loadCrmActivitiesForContact({ contactId: resolvedContactId, silent: true });
      loadCrmDocumentsForContact({ contactId: resolvedContactId, silent: true });
    }
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
    threadCacheDisplaySourceRef.current = 'unknown';
    threadFreshSyncAtRef.current = 0;
  }, [selectedConversation]);

  useEffect(() => {
    if (activeConversationId) return;

    activeMessagesConversationIdRef.current = '';
    threadWindowTrimmedRef.current = false;
    messageLoadRequestIdRef.current += 1;
    threadCacheDisplaySourceRef.current = 'unknown';
    threadFreshSyncAtRef.current = 0;
    setMessagesHasMore(false);
    setMessagesOlderLoading(false);
    setMessagesLoading(false);
    setMessages([]);
    setThreadCacheInfo({
      source: 'unknown',
      isStale: false,
      updatedAt: null,
      messageCount: 0
    });
    setInboxDebugInfo({
      lastEvent: 'selection_cleared',
      lastEventAt: new Date().toISOString(),
      source: 'ui',
      reason: 'selection_cleared',
      conversationId: '',
      messageId: '',
      details: 'No active conversation selected'
    });
  }, [activeConversationId]);

  useEffect(() => {
    const activeMessagesConversationId = String(
      activeMessagesConversationIdRef.current || ''
    ).trim();

    if (!activeMessagesConversationId) {
      return;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return;
    }

    if (threadWindowTrimmedRef.current) return;

    messageCacheRef.current.set(activeMessagesConversationId, messages);
  }, [messages]);

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
    loadConversationById,
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
    currentUserDisplayName,
    currentUserInternalRole: currentViewerInternalRole,
    normalizeConversation,
    selectedWhatsAppState,
    setLoading,
    setConversations,
    setMessages,
    setMessagesLoading,
    selectedConversation,
    messages,
    sendingMessage,
    messageInput,
    setSendingMessage,
    setMessageInput,
    appendMessageUnique,
    upsertMessage,
    patchMessage,
    removeMessage,
    getConversationIdValue,
    conversationId,
    isRealName,
    getPhoneLookupKeys,
    setContactNameMap,
    activeMessagesConversationIdRef,
    messageLoadRequestIdRef,
    messageLoadAbortControllerRef,
    messageCacheRef,
    messagePaginationCacheRef,
    messageLoadPromiseMapRef,
    conversationLoadPromiseMapRef,
    conversationPageMetaRef,
    conversationLoadRequestIdRef,
    threadCacheDisplaySourceRef,
    threadFreshSyncAtRef,
    setConversationPageMeta,
    setMessagesOlderLoading,
    setMessagesHasMore,
    setThreadCacheInfo,
    setInboxDebugInfo,
    notifyActionFeedback: showTeamInboxActionFeedback,
    confirmAction: confirmTeamInboxAction
  });
  const loadConversationsStable = useStableCallback(loadConversations);
  const loadConversationByIdStable = useStableCallback(loadConversationById);
  const loadMessagesStable = useStableCallback(loadMessages);
  const sendMessageStable = useStableCallback(sendMessage);
  const sendReactionStable = useStableCallback(sendReaction);
  const sendAttachmentStable = useStableCallback(sendAttachment);
  const openAttachmentStable = useStableCallback(openAttachment);
  const deleteMessageStable = useStableCallback(deleteMessage);
  const retryAttachmentStable = useStableCallback(retryAttachment);
  const markAsReadStable = useStableCallback(markAsRead);
  const loadContactsStable = useStableCallback(loadContacts);

  const handleComposerSendMessage = useCallback(
    async (options = {}) => {
      if (!selectedConversation) return false;

      if (selectedWhatsAppState?.optedOut) {
        setTeamInboxActionFeedback(
          'This contact has opted out. Restore consent before sending a WhatsApp message.',
          'error'
        );
        return false;
      }

      if (!selectedWhatsAppState?.freeformAllowed) {
        setTeamInboxActionFeedback(
          'The 24-hour window is closed. Use an approved template to continue this chat.',
          'error'
        );
        if (typeof openTemplateSendModal === 'function') {
          openTemplateSendModal();
        }
        return false;
      }

      return sendMessageStable(options);
    },
    [
      openTemplateSendModal,
      selectedConversation,
      selectedWhatsAppState,
      sendMessageStable,
      setTeamInboxActionFeedback
    ]
  );

  useEffect(() => {
    const activeId = String(getConversationIdValue(selectedConversation) || '').trim();
    if (!activeId) return;
    if (messagesLoading || messagesOlderLoading) return;
    if (messageLoadPromiseMapRef.current?.has(activeId)) return;
    if (threadAutoLoadAttemptRef.current === activeId) return;

    const timer = window.setTimeout(() => {
      if (String(getConversationIdValue(selectedConversationRef.current) || '').trim() !== activeId) {
        return;
      }
      threadAutoLoadAttemptRef.current = activeId;
      void Promise.resolve(
        loadMessagesStable(activeId, {
          reason: 'selection_load',
          forceRefresh: false,
          limit: 20
        })
      ).then((didLoad) => {
        if (didLoad === false && threadAutoLoadAttemptRef.current === activeId) {
          threadAutoLoadAttemptRef.current = '';
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    loadMessagesStable,
    messagesLoading,
    messagesOlderLoading,
    activeConversationId
  ]);

  useEffect(() => {
    const activeId = String(getConversationIdValue(selectedConversation) || '').trim();
    if (!activeId) {
      threadAutoLoadAttemptRef.current = '';
    }
  }, [activeConversationId]);

  const loadScopedConversations = useCallback(
    async (options = {}) =>
      loadConversationsStable({
        ...options,
        reason: String(options?.reason || 'unknown').trim() || 'unknown',
        search: normalizedConversationSearchTerm,
        filter: normalizedConversationFilter,
        view: inboxView,
        status: inboxStatusView,
        ...(inboxAssignedTo ? { assignedTo: inboxAssignedTo } : {})
      }),
    [
      loadConversationsStable,
      normalizedConversationSearchTerm,
      normalizedConversationFilter,
      inboxView,
      inboxStatusView,
      inboxAssignedTo,
      isAgentRestricted,
      currentWorkspaceAssigneeId
    ]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return undefined;
    }

    const handleBroadcastRefreshRequested = () => {
      void loadScopedConversations({
        silent: true,
        append: false,
        reason: 'broadcast_sent',
        skipCache: true
      });
      void refreshInboxOverview({ skipCache: true });
    };

    window.addEventListener('teamInbox:refreshRequested', handleBroadcastRefreshRequested);
    return () => {
      window.removeEventListener('teamInbox:refreshRequested', handleBroadcastRefreshRequested);
    };
  }, [loadScopedConversations, refreshInboxOverview]);

  const loadMoreConversations = useCallback(async () => {
    const nextCursor = String(conversationPageMeta?.nextCursor || '').trim();
    if (!conversationPageMeta.hasMore || conversationLoadingMore || !nextCursor) {
      return false;
    }

    setConversationLoadingMore(true);
    try {
      return await loadScopedConversations({
        silent: true,
        append: true,
        cursor: nextCursor,
        reason: 'sidebar_scroll'
      });
    } finally {
      setConversationLoadingMore(false);
    }
  }, [
    conversationPageMeta?.hasMore,
    conversationPageMeta?.nextCursor,
    conversationLoadingMore,
    loadScopedConversations
  ]);

  useEffect(() => {
    const normalizedUserId = String(currentUserId || '').trim();
    if (!normalizedUserId || wsConnected) return undefined;

    let disposed = false;
    const poll = async () => {
      if (disposed) return;
      await loadScopedConversations({
        silent: true,
        append: false,
        reason: 'ws_fallback_poll',
        skipCache: true
      });
      await refreshInboxOverview({ skipCache: true });
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [currentUserId, wsConnected, loadScopedConversations, refreshInboxOverview]);

  useEffect(() => {
    const normalizedUserId = String(currentUserId || '').trim();
    if (!normalizedUserId) return;

    void loadScopedConversations({
      silent: true,
      append: false,
      reason: 'initial_bootstrap'
    }).catch(() => undefined);
  }, [currentUserId, loadScopedConversations]);

  useEffect(() => {
    const normalizedUserId = String(currentUserId || '').trim();
    if (!normalizedUserId) return;
    void refreshInboxOverview();
  }, [refreshInboxOverview, currentUserId]);

  useEffect(() => {
    const querySignature = `${normalizedConversationSearchTerm.toLowerCase()}::${normalizedConversationFilter}::${String(inboxView || '').trim().toLowerCase()}::${inboxStatusView}::${inboxAssignedTo}`;
    if (!conversationQueryInitializedRef.current) {
      conversationQueryInitializedRef.current = true;
      conversationPageMetaRef.current = {
        ...(conversationPageMetaRef.current || {}),
        querySignature
      };
      return;
    }

    if (String(conversationPageMetaRef.current?.querySignature || '').trim() === querySignature) {
      return;
    }

    setConversationLoadingMore(false);
    void loadScopedConversations({ silent: true, append: false, reason: 'query_change' });
  }, [
    normalizedConversationSearchTerm,
    normalizedConversationFilter,
    inboxView,
    inboxStatusView,
    inboxAssignedTo,
    loadScopedConversations
  ]);

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
    loadMessages: loadMessagesStable,
    chatMessagesRef,
    isConversationSwitchRef,
    threadFreshSyncAtRef,
    messages,
    messagesLoading,
    messagesOlderLoading
  });

  const handleVisibleMessageWindowChange = useCallback(
    ({ visibleMessageKeys = [] } = {}) => {
      const activeId = String(activeMessagesConversationIdRef.current || '').trim();
      if (!activeId) return;

      const fullThreadMessages = messageCacheRef.current.get(activeId);
      if (!Array.isArray(fullThreadMessages) || fullThreadMessages.length < THREAD_WINDOW_MIN_FULL_SIZE) {
        threadWindowTrimmedRef.current = false;
        return;
      }

      const normalizedVisibleKeys = Array.from(
        new Set(
          (Array.isArray(visibleMessageKeys) ? visibleMessageKeys : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );

      if (normalizedVisibleKeys.length === 0) return;

      const keyToIndex = new Map();
      fullThreadMessages.forEach((message, index) => {
        const messageKey = String(getMessageKey(message, index)).trim();
        if (messageKey && !keyToIndex.has(messageKey)) {
          keyToIndex.set(messageKey, index);
        }
      });

      const visibleIndices = normalizedVisibleKeys
        .map((key) => keyToIndex.get(key))
        .filter((index) => Number.isInteger(index) && index >= 0);

      if (visibleIndices.length === 0) return;

      const firstVisibleIndex = Math.min(...visibleIndices);
      const lastVisibleIndex = Math.max(...visibleIndices);
      const startIndex = Math.max(0, firstVisibleIndex - THREAD_WINDOW_BUFFER_BEFORE);
      const endIndex = Math.min(
        fullThreadMessages.length - 1,
        lastVisibleIndex + THREAD_WINDOW_BUFFER_AFTER
      );

      if (startIndex === 0 && endIndex >= fullThreadMessages.length - 1) {
        threadWindowTrimmedRef.current = false;
        return;
      }

      const nextWindow = fullThreadMessages.slice(startIndex, endIndex + 1);
      if (nextWindow.length === 0) return;

      const currentWindow = Array.isArray(messages) ? messages : [];
      const sameWindow =
        currentWindow.length === nextWindow.length &&
        currentWindow.every(
          (message, index) =>
            String(message?._id || message?.id || message?.whatsappMessageId || '').trim() ===
            String(
              nextWindow[index]?._id ||
                nextWindow[index]?.id ||
                nextWindow[index]?.whatsappMessageId ||
                ''
            ).trim()
        );
      threadWindowTrimmedRef.current = nextWindow.length < fullThreadMessages.length;
      if (sameWindow) return;

      setMessages(nextWindow);
    },
    [messages, setMessages]
  );

  useConversationSelectionEffects({
    locationState: location.state,
    conversations,
    conversationLookupMap,
    setSelectedConversation,
    selectedConversationId: activeConversationId,
    isConversationSwitchRef,
    loadConversationById: loadConversationByIdStable,
    conversationId,
    getUnreadCount,
    markAsRead: markAsReadStable,
    pendingConversationRouteSyncRef,
    getConversationDisplayName
  });

  useInboxRealtimeEffects({
    currentUserId,
    currentCompanyId,
    activeConversationId,
    setWsConnected,
    hasBootstrapCache: Boolean(
      readTeamInboxBootstrapCache({
        currentUserId,
        allowStale: true
      })
    ),
    loadConversations: loadScopedConversations,
    loadContacts: loadContactsStable,
    hasRealContactName,
    setConversations,
    setMessages,
    appendMessageUnique,
    upsertMessage,
    patchMessage,
    removeMessage,
    markAsRead: markAsReadStable,
    scheduleRealtimeResync,
    setSelectedConversation,
    applyLeadScoreUpdateToConversation,
    realtimeResyncTimerRef,
    setUserPresenceMap,
    setConversationTypingState,
    setInboxDebugInfo,
    notifyActionFeedback: showTeamInboxActionFeedback,
    refreshInboxOverview,
    threadFreshSyncAtRef,
    conversationLookupMap,
    upsertConversation,
    patchConversation
  });
  const {
    deleteCurrentConversation,
    deleteConversationEntry,
    toggleSelectForDeletion,
    deleteSelectedChats,
    assignConversationById,
    bulkAssignSelectedChats,
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
    confirmAction: confirmTeamInboxAction,
    refreshInboxOverview,
    bulkAssignBusy,
    setBulkAssignBusy,
    setBulkAssignTarget
  });

  const filteredConversations = useMemo(() => {
    if (!isAgentRestricted) {
      return conversations;
    }

    return (Array.isArray(conversations) ? conversations : []).filter((conversation) => {
      const assigneeId = String(
        conversation?.assignedTo?._id ||
          conversation?.assignedTo?.id ||
          conversation?.assignedTo ||
          conversation?.agentId ||
          conversation?.ownerId ||
          ''
      ).trim();
      return !currentWorkspaceAssigneeId || assigneeId === currentWorkspaceAssigneeId;
    });
  }, [conversations, isAgentRestricted, currentWorkspaceAssigneeId]);

  const sidebarConversations = filteredConversations;

  filteredConversationsRef.current = filteredConversations;

  const filteredConversationIndexById = useMemo(() => {
    const map = new Map();
    (Array.isArray(filteredConversations) ? filteredConversations : []).forEach((conversation, index) => {
      const conversationId = String(getConversationIdValue(conversation) || '').trim();
      if (conversationId && !map.has(conversationId)) {
        map.set(conversationId, index);
      }
    });
    return map;
  }, [filteredConversations, getConversationIdValue]);

  const handleMessageInputChange = (nextValue) => {
    const normalizedValue = String(nextValue || '');
    setMessageInput(normalizedValue);
    if (!activeConversationId) return;
    setConversationDrafts((prev) => ({
      ...prev,
      [activeConversationId]: normalizedValue
    }));
  };

  const handleSendOptInPrompt = async () => {
    if (!selectedConversation) {
      setContactInfoMessage('No conversation selected.');
      setContactInfoMessageTone('error');
      return;
    }

    if (selectedWhatsAppState?.optedOut) {
      setContactInfoMessage('This contact has opted out. Restore consent before sending any WhatsApp prompt.');
      setContactInfoMessageTone('error');
      return;
    }

    if (!selectedWhatsAppState?.freeformAllowed) {
      setContactInfoMessage('The 24-hour window is closed. Send an approved template first.');
      setContactInfoMessageTone('error');
      return;
    }

    const optInKeyword = 'INTERESTED';
    const brandName = import.meta.env.VITE_BRAND_NAME || 'Technovohub';
    const promptMessage = `Reply ${optInKeyword} to receive WhatsApp updates from ${brandName}. Reply STOP anytime to opt out.`;

    try {
      setContactInfoActionBusy(true);
      const sent = await sendMessageStable({ messageOverride: promptMessage });
      if (sent) {
        setContactInfoMessage('Opt-in prompt sent.');
        setContactInfoMessageTone('success');
      } else {
        setContactInfoMessage('Unable to send opt-in prompt.');
        setContactInfoMessageTone('error');
      }
    } finally {
      setContactInfoActionBusy(false);
    }
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
    markAsRead: markAsReadStable,
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
        handleComposerSendMessage();
        return;
      }

      if (!event.altKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
        return;
      }

      const safeConversations = Array.isArray(filteredConversationsRef.current)
        ? filteredConversationsRef.current
        : [];
      if (!safeConversations.length) return;

      const currentIndex = filteredConversationIndexById.get(activeConversationId) ?? -1;
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
  }, [
    activeConversationId,
    filteredConversationIndexById,
    handleSelectConversation,
    messageInput,
    handleComposerSendMessage,
    sendingMessage
  ]);

  const getInboxOverviewCount = (viewKey, countKeys = []) => {
    const normalizedKey = String(viewKey || '').trim().toLowerCase();
    const countKeyCandidates = [
      ...countKeys,
      normalizedKey,
      `${normalizedKey}Chats`,
      `${normalizedKey}Count`
    ];

    for (const key of countKeyCandidates) {
      const nextCount = inboxOverview?.[key];
      if (Number.isFinite(Number(nextCount))) {
        return Number(nextCount);
      }
    }

    return 0;
  };

  const inboxFilterOptionsWithCounts = useMemo(
    () => buildInboxFilterOptionsWithCounts(inboxFilterOptions, getInboxOverviewCount),
    [inboxFilterOptions, inboxOverview]
  );

  const inboxTopMetrics = [
    {
      label: 'Active queue',
      value: isAgentInbox ? getInboxOverviewCount('my', ['myChats']) : getInboxOverviewCount('all', ['allChats']),
      note: isAgentInbox ? 'Your assigned workload' : 'Workspace total'
    },
    {
      label: 'Unread',
      value: getInboxOverviewCount('unread', ['unreadConversations', 'unreadChats']),
      note: 'Needs attention'
    },
    {
      label: 'Assigned',
      value: getInboxOverviewCount('assigned', ['assignedChats']),
      note: 'Tracked in real time'
    },
    {
      label: 'Closed',
      value: getInboxOverviewCount('closed', ['closedChats']),
      note: 'Resolved conversations'
    }
  ];

  const handleInboxViewChange = useCallback(
    (nextView) => {
      const normalizedView = String(nextView || '').trim().toLowerCase() || (isAgentInbox ? 'my' : 'all');
      setInboxView(normalizedView);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('view', normalizedView);
      setSearchParams(nextParams, { replace: true });
    },
    [isAgentInbox, searchParams, setSearchParams, setInboxView]
  );

  const toggleInboxNotificationsMenu = useCallback(() => {
    setShowInboxNotificationsMenu((current) => !current);
  }, []);

  useEffect(() => {
    const requestedView = String(searchParams.get('view') || '').trim().toLowerCase();
    const normalizedCurrentView = String(inboxView || '').trim().toLowerCase();
    const nextDefaultView = isAgentInbox ? 'my' : 'all';

    if (!requestedView) {
      if (normalizedCurrentView !== nextDefaultView) {
        handleInboxViewChange(nextDefaultView);
      }
      return;
    }

    if (permittedInboxViewValues.has(requestedView)) {
      return;
    }

    handleInboxViewChange(nextDefaultView);
  }, [
    handleInboxViewChange,
    inboxView,
    isAgentInbox,
    permittedInboxViewValues,
    searchParams
  ]);

  return (
    <div className="team-inbox-shell">
      <div className="inbox-container">
        <div className="inbox-workspace-layout">
          <div className="inbox-main-layout">
            <ConversationSidebar
              wsConnected={wsConnected}
              loadingMoreConversations={conversationLoadingMore}
              hasMoreConversations={
                Boolean(conversationPageMeta.hasMore) ||
                Boolean(conversationPageMeta.nextCursor)
              }
              conversationListExhausted={
                Boolean(conversationPageMeta.loaded) &&
                Boolean(conversationPageMeta.exhausted) &&
                Array.isArray(sidebarConversations) &&
                sidebarConversations.length > 0
              }
              filterMenuRef={filterMenuRef}
              inboxMenuRef={inboxMenuRef}
              showFilterMenu={showFilterMenu}
              showSelectMenu={showSelectMenu}
              showSelectMode={showSelectMode}
              selectedForDeletion={selectedForDeletion}
              bulkAssignTarget={bulkAssignTarget}
              bulkAssignBusy={bulkAssignBusy}
              loading={loading}
              filteredConversations={sidebarConversations}
              selectedConversation={selectedConversation}
              searchTerm={searchTerm}
              searchInputRef={sidebarSearchInputRef}
              onSearchTermChange={setSearchTerm}
              onToggleFilterMenu={handleToggleFilterMenu}
              onSelectFilter={handleSelectConversationFilter}
              onToggleSelectMenu={handleToggleInboxMenu}
              showInboxNotificationsMenu={showInboxNotificationsMenu}
              onToggleInboxNotificationsMenu={toggleInboxNotificationsMenu}
              onToggleSelectMode={handleToggleConversationSelectMode}
              onDeleteSelectedChats={deleteSelectedChats}
              onBulkAssignSelectedChats={bulkAssignSelectedChats}
              onDeleteConversation={deleteConversationEntry}
              onResolveSelection={handleResolveConversationSelection}
              onAssignConversation={assignConversationById}
              onConversationClick={handleSelectConversation}
              onToggleSelectForDeletion={toggleSelectForDeletion}
              onLoadMoreConversations={loadMoreConversations}
              getUnreadCount={getUnreadCount}
              getConversationAvatarText={getConversationAvatarText}
              getConversationDisplayName={getConversationDisplayName}
              formatConversationTime={formatConversationTime}
              canAssignChats={!isAgentRestricted}
              availableAgents={assignableAgents}
              currentUserId={currentUserId}
              setBulkAssignTarget={setBulkAssignTarget}
              inboxView={inboxView}
              inboxFilterOptions={inboxFilterOptionsWithCounts}
              onInboxViewChange={handleInboxViewChange}
              inboxFilterTitle={inboxFilterTitle}
              inboxFilterDescription={inboxFilterDescription}
              inboxWorkspaceLabel={inboxWorkspaceLabel}
              inboxWorkspaceHint={inboxWorkspaceHint}
              inboxNotifications={inboxNotifications}
              onClearInboxNotifications={() => setInboxNotifications([])}
            />

            <ChatArea
              selectedConversation={selectedConversation}
              currentThreadConversationId={String(activeMessagesConversationIdRef.current || '').trim()}
              currentViewerUserId={currentUserId}
              currentViewerInternalRole={currentViewerInternalRole}
              currentViewerDisplayName={currentUserDisplayName}
              messages={messages}
              messagesLoading={messagesLoading}
              hasOlderMessages={messagesHasMore}
              threadCacheInfo={threadCacheInfo}
              inboxDebugInfo={inboxDebugInfo}
              isInboxDebugVisible={isInboxDebugVisible}
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
              typingState={conversationTypingState}
              userPresenceMap={userPresenceMap}
              onToggleMessageMenu={handleToggleMessageMenu}
              onToggleMessageSelectMode={handleToggleMessageSelectionMode}
              onDeleteConversation={handleDeleteCurrentConversationFromMenu}
              onOpenContactInformation={handleOpenContactInformation}
              onOpenTemplateSendModal={openTemplateSendModal}
              onToggleConversationImportant={handleSetConversationImportant}
              onCloseConversation={handleCloseConversation}
              onToggleMessageSelection={toggleMessageSelection}
              deleteSelectedMessages={deleteSelectedMessages}
              onMessageInputChange={handleMessageInputChange}
              onSendMessage={handleComposerSendMessage}
              onReactToMessage={sendReactionStable}
              onSendAttachment={sendAttachmentStable}
              selectedConversationLatestInboundMessageAt={latestInboundMessageAtFromThread}
              onOpenAttachment={openAttachmentStable}
              onDeleteMessage={deleteMessageStable}
              onRetryAttachment={retryAttachmentStable}
              onLoadOlderMessages={() =>
                activeConversationId
                  ? loadMessagesStable(activeConversationId, { loadOlder: true, reason: 'older_scroll' })
                  : false
              }
              onVisibleMessageWindowChange={handleVisibleMessageWindowChange}
              onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
              onEmojiInsert={handleEmojiInsert}
              getMessageKey={getMessageKey}
              formatMessageTime={formatMessageTime}
            />
          </div>

          <ContactInfoPanel
            selectedConversation={selectedConversation}
            showContactInfo={showContactInfo}
            setShowContactInfo={setShowContactInfo}
            deriveLeadStatus={deriveLeadStatus}
            getConversationLeadScore={getConversationLeadScore}
            getLeadStageValue={getLeadStageValue}
            handleLeadStageChange={handleLeadStageChange}
            contactInfoActionBusy={contactInfoActionBusy}
            currentUserId={currentUserId}
            currentCompanyId={currentCompanyId}
            whatsappMessagingState={selectedWhatsAppState}
            leadScoringSettings={leadScoringSettings}
            leadScoringSettingsLoading={leadScoringSettingsLoading}
            leadStageOptions={leadStageOptions}
            availableAgents={assignableAgents}
            canAssignChats={!isAgentRestricted}
            handleAssignConversation={handleAssignConversation}
            handleSetConversationImportant={handleSetConversationImportant}
            handleCloseConversation={handleCloseConversation}
            handleReopenConversation={handleReopenConversation}
            handleConversationLeadStatusChange={handleConversationLeadStatusChange}
            openTemplateSendModal={openTemplateSendModal}
            onSendOptInPrompt={handleSendOptInPrompt}
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
        </div>

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
          getTemplateCategory={getTemplateCategory}
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
    </div>
  );
};
export default TeamInbox;                                                                                                  
