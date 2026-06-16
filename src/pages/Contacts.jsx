import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Filter, Edit, Trash2, MessageCircle, Send, CheckSquare, Square, ChevronDown, ArrowUpDown, Upload, Download, X, FileText, Copy, ExternalLink, MoreVertical, ScanLine, Users } from 'lucide-react';
import Papa from 'papaparse';
import { apiClient } from '../services/whatsappapi';
import { AuthContext } from './authcontext';
import { crmService, subscribeCrmUserRoster } from '../services/crmService';
import socketService from '../services/socketService';
import WhatsAppOptInModal from '../components/WhatsAppOptInModal';
import WhatsAppConsentAuditModal from '../components/WhatsAppConsentAuditModal';
import BusinessCardScannerModal from '../components/contacts/BusinessCardScannerModal';
import CrmContactDrawer from '../components/crm/CrmContactDrawer';
import { startLoadingTimeoutGuard } from '../utils/loadingGuard';
import { buildPublicWhatsAppOptInDemoUrl, buildWhatsAppOutreachState } from '../utils/whatsappOutreachNavigation';
import { getWhatsAppConversationState } from '../utils/whatsappContactState';
import { resolveWorkspaceManagementAccessState } from '../utils/agentAccess';
import { toAppPath } from '../utils/appRouteBase';
import './Contacts.css';

const CONTACTS_LOADING_TIMEOUT_MS = 8000;
const CONTACTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const CONTACT_LEAD_STATUS_OPTIONS = [
    { value: 'new_lead', label: 'New Lead' },
    { value: 'interested', label: 'Interested' },
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'proposal_sent', label: 'Proposal Sent' },
    { value: 'converted', label: 'Converted' },
    { value: 'closed', label: 'Closed' }
];
const CONTACT_LEAD_STATUS_LABELS = CONTACT_LEAD_STATUS_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
}, {});

const createWhatsAppOptInDraft = (contact = {}) => ({
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
        const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
        return String(
            storedUser?.name ||
            storedUser?.fullName ||
            storedUser?.email ||
            storedUser?.username ||
            'contacts_ui'
        ).trim();
    } catch {
        return 'contacts_ui';
    }
};

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;
const CONTACTS_ROUTE_QUERY_KEYS = {
    page: 'page',
    pageSize: 'pageSize',
    search: 'search',
    activeFilter: 'activeFilter',
    leadStatus: 'leadStatus',
    sort: 'sort'
};

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createContactFormDraft = (contact = {}) => ({
    name: String(contact?.name || '').trim(),
    phone: String(contact?.phone || '').trim(),
    email: String(contact?.email || '').trim(),
    companyName: String(contact?.companyName || '').trim(),
    designation: String(contact?.designation || '').trim(),
    tags: Array.isArray(contact?.tags) ? contact.tags.join(', ') : String(contact?.tags || '').trim(),
    status: String(contact?.status || 'Unknown').trim() || 'Unknown'
});

const readContactsRouteState = (searchParams) => {
    const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams();
    return {
        currentPage: parsePositiveInteger(params.get(CONTACTS_ROUTE_QUERY_KEYS.page), 1),
        pageSize: CONTACTS_PAGE_SIZE_OPTIONS.includes(Number(params.get(CONTACTS_ROUTE_QUERY_KEYS.pageSize)))
            ? Number(params.get(CONTACTS_ROUTE_QUERY_KEYS.pageSize))
            : 10,
        searchTerm: String(params.get(CONTACTS_ROUTE_QUERY_KEYS.search) || '').trim(),
        lastActiveFilter: String(params.get(CONTACTS_ROUTE_QUERY_KEYS.activeFilter) || 'all').trim() || 'all',
        sortOption: String(params.get(CONTACTS_ROUTE_QUERY_KEYS.sort) || 'name-asc').trim() || 'name-asc'
    };
};

const buildContactsRouteSearchParams = ({
    currentPage,
    pageSize,
    searchTerm,
    lastActiveFilter,
    leadStatusFilter,
    sortOption
}) => {
    const params = new URLSearchParams();
    const normalizedSearch = String(searchTerm || '').trim();
    const normalizedFilter = String(lastActiveFilter || 'all').trim() || 'all';
    const normalizedLeadStatus = String(leadStatusFilter || 'all').trim().toLowerCase() || 'all';
    const normalizedSort = String(sortOption || 'name-asc').trim() || 'name-asc';

    if (currentPage && Number(currentPage) > 1) {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.page, String(currentPage));
    }
    if (pageSize && Number(pageSize) !== 10) {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.pageSize, String(pageSize));
    }
    if (normalizedSearch) {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.search, normalizedSearch);
    }
    if (normalizedFilter !== 'all') {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.activeFilter, normalizedFilter);
    }
    if (normalizedLeadStatus !== 'all') {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.leadStatus, normalizedLeadStatus);
    }
    if (normalizedSort !== 'name-asc') {
        params.set(CONTACTS_ROUTE_QUERY_KEYS.sort, normalizedSort);
    }

    return params;
};

const normalizeImportedPhone = (value = '') => {
    const cleaned = String(value || '').replace(/[^0-9+]/g, '');
    if (!cleaned) return '';
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
};

const isValidImportedPhone = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
};

const buildContactsRequestSignature = ({
    currentPage = 1,
    pageSize = 10,
    searchTerm = '',
    lastActiveFilter = 'all',
    leadStatusFilter = 'all',
    sortOption = 'name-asc'
}) =>
    [
        Number(currentPage) || 1,
        Number(pageSize) || 10,
        String(searchTerm || '').trim().toLowerCase(),
        String(lastActiveFilter || 'all').trim().toLowerCase() || 'all',
        String(leadStatusFilter || 'all').trim().toLowerCase() || 'all',
        String(sortOption || 'name-asc').trim().toLowerCase() || 'name-asc'
    ].join('|');

const formatLeadStatusLabel = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return CONTACT_LEAD_STATUS_LABELS[normalized] || normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'New Lead';
};

const CONTACT_LEAD_STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All Leads' },
    ...CONTACT_LEAD_STATUS_OPTIONS
];

const GENERIC_OWNER_LABELS = new Set([
    'admin',
    'agent',
    'team member',
    'unknown',
    'unknown user',
    'unassigned'
]);

const isMeaningfulOwnerLabel = (value = '') => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    if (/^[0-9a-f]{24}$/i.test(normalized)) return false;
    if (/^\d{8,}$/.test(normalized)) return false;
    return !GENERIC_OWNER_LABELS.has(normalized.toLowerCase());
};

const formatOwnerLabel = (contact = {}, rosterMap = new Map()) => {
    const rawValue = String(
        contact?.assignedTo ||
        contact?.ownerId ||
        contact?.assignedAgent ||
        contact?.assignedToDisplay ||
        ''
    ).trim();
    if (!rawValue) return 'Unassigned';
    const rosterLabel = String(rosterMap.get(rawValue) || '').trim();
    const directLabel = String(
        contact?.assignedToName || contact?.assignedAgentName || contact?.ownerName || ''
    ).trim();
    if (isMeaningfulOwnerLabel(rosterLabel)) return rosterLabel;
    if (isMeaningfulOwnerLabel(directLabel)) return directLabel;
    return 'Unassigned';
};

const getContactPhoneIdentityKey = (contact = {}) => {
    const phoneDigits = String(contact?.phoneDigits || contact?.phone || '').replace(/\D/g, '');
    const phoneKey = String(contact?.phoneKey || phoneDigits || contact?.phone || '').replace(/\D/g, '');
    return phoneKey.length > 10 ? phoneKey.slice(-10) : phoneKey || phoneDigits;
};

const dedupeContactsByPhoneIdentity = (contacts = []) => {
    const grouped = new Map();
    (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
        const companyKey = String(contact?.companyId || '').trim();
        const phoneKey = getContactPhoneIdentityKey(contact);
        const fallbackKey = String(contact?._id || '').trim();
        const dedupeKey = `${companyKey || 'no-company'}:${phoneKey || fallbackKey}`;
        if (!grouped.has(dedupeKey)) {
            grouped.set(dedupeKey, []);
        }
        grouped.get(dedupeKey).push(contact);
    });

    return Array.from(grouped.values()).map((members) => {
        const sorted = members
            .slice()
            .sort((left, right) => {
                const leftCreated = new Date(left?.createdAt || 0).getTime() || 0;
                const rightCreated = new Date(right?.createdAt || 0).getTime() || 0;
                const leftUpdated = new Date(left?.updatedAt || 0).getTime() || 0;
                const rightUpdated = new Date(right?.updatedAt || 0).getTime() || 0;
                return leftCreated - rightCreated || leftUpdated - rightUpdated || String(left?._id || '').localeCompare(String(right?._id || ''));
            });
        const keeper = sorted[0] || {};
        const latestByField = (field) =>
            members
                .slice()
                .sort((left, right) => {
                    const leftTime = new Date(left?.updatedAt || left?.lastContact || left?.createdAt || 0).getTime() || 0;
                    const rightTime = new Date(right?.updatedAt || right?.lastContact || right?.createdAt || 0).getTime() || 0;
                    return rightTime - leftTime;
                })
                .map((member) => member?.[field])
                .find((value) => value !== undefined && value !== null && String(value).trim() !== '');

        return {
            ...keeper,
            name: String(latestByField('name') || keeper.name || '').trim(),
            email: String(latestByField('email') || keeper.email || '').trim(),
            phone: String(keeper.phone || latestByField('phone') || '').trim(),
            phoneDigits: String(keeper.phoneDigits || keeper.phone || latestByField('phoneDigits') || '').replace(/\D/g, ''),
            phoneKey: getContactPhoneIdentityKey(keeper),
            tags: Array.from(
                new Set(
                    members.flatMap((member) => Array.isArray(member?.tags) ? member.tags : [])
                        .map((tag) => String(tag || '').trim())
                        .filter(Boolean)
                )
            ),
            leadStatus: String(latestByField('leadStatus') || keeper.leadStatus || '').trim(),
            status: String(latestByField('status') || keeper.status || '').trim(),
            source: String(latestByField('source') || keeper.source || '').trim(),
            sourceType: String(latestByField('sourceType') || keeper.sourceType || '').trim(),
            ownerId: String(latestByField('ownerId') || keeper.ownerId || '').trim(),
            assignedTo: String(latestByField('assignedTo') || keeper.assignedTo || '').trim(),
            assignedAgent: String(latestByField('assignedAgent') || keeper.assignedAgent || '').trim(),
            createdAt: keeper.createdAt || null,
            updatedAt: latestByField('updatedAt') || keeper.updatedAt || null
        };
    });
};

const Contacts = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useContext(AuthContext);
    const initialRouteStateRef = useRef(null);
    if (!initialRouteStateRef.current) {
        initialRouteStateRef.current = readContactsRouteState(searchParams);
    }
    const [contacts, setContacts] = useState([]);
    const [totalContacts, setTotalContacts] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(initialRouteStateRef.current.searchTerm);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialRouteStateRef.current.searchTerm);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [newContact, setNewContact] = useState(() => createContactFormDraft());
    const [selectionMode, setSelectionMode] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [lastActiveFilter, setLastActiveFilter] = useState(initialRouteStateRef.current.lastActiveFilter);
    const [leadStatusFilter, setLeadStatusFilter] = useState(
        String(searchParams.get(CONTACTS_ROUTE_QUERY_KEYS.leadStatus) || 'all').trim().toLowerCase() || 'all'
    );
    const [sortOption, setSortOption] = useState(initialRouteStateRef.current.sortOption);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showManageGroupsModal, setShowManageGroupsModal] = useState(false);
    const [manageGroups, setManageGroups] = useState([]);
    const [manageGroupsLoading, setManageGroupsLoading] = useState(false);
    const [manageGroupsError, setManageGroupsError] = useState('');
    const [manageGroupsSearch, setManageGroupsSearch] = useState('');
    const [showGroupEditorModal, setShowGroupEditorModal] = useState(false);
    const [groupEditorMode, setGroupEditorMode] = useState('create');
    const [groupEditorId, setGroupEditorId] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [groupContacts, setGroupContacts] = useState([]);
    const [groupContactsLoading, setGroupContactsLoading] = useState(false);
    const [groupContactsError, setGroupContactsError] = useState('');
    const [groupSaving, setGroupSaving] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importRows, setImportRows] = useState([]);
    const [importHeaders, setImportHeaders] = useState([]);
    const [importPreview, setImportPreview] = useState([]);
    const [importStep, setImportStep] = useState('upload');
    const [importMapping, setImportMapping] = useState({});
    const [optInModalOpen, setOptInModalOpen] = useState(false);
    const [optInTargetContact, setOptInTargetContact] = useState(null);
    const [optInDraft, setOptInDraft] = useState(createWhatsAppOptInDraft());
    const [optInSubmitting, setOptInSubmitting] = useState(false);
    const [optInError, setOptInError] = useState('');
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditTargetContact, setAuditTargetContact] = useState(null);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditError, setAuditError] = useState('');
    const [auditData, setAuditData] = useState(null);
    const [notification, setNotification] = useState(null);
    const [activeActionsMenuId, setActiveActionsMenuId] = useState(null);
    const [showBusinessCardScanner, setShowBusinessCardScanner] = useState(false);
    const [cardScannerSeedContact, setCardScannerSeedContact] = useState({});
    const [cardScannerContext, setCardScannerContext] = useState('standalone');
    const [crmUserRoster, setCrmUserRoster] = useState([]);
    const [bulkAssignTo, setBulkAssignTo] = useState('');
    const [bulkAssignReason, setBulkAssignReason] = useState('');
    const [crmMetrics, setCrmMetrics] = useState(null);
    const [crmMetricsLoading, setCrmMetricsLoading] = useState(false);
    const [crmSummaryPulseActive, setCrmSummaryPulseActive] = useState(false);
    const [crmDrawerOpen, setCrmDrawerOpen] = useState(false);
    const [crmDrawerContact, setCrmDrawerContact] = useState(null);
    const [currentPage, setCurrentPage] = useState(initialRouteStateRef.current.currentPage);
    const [pageSize, setPageSize] = useState(initialRouteStateRef.current.pageSize);
    const fileInputRef = useRef(null);
    const contactsSkipNextLoadKeyRef = useRef('');
    const contactsRequestSeqRef = useRef(0);
    const crmSummaryPulseTimerRef = useRef(null);
    const isAdminWorkspaceUser = resolveWorkspaceManagementAccessState(user);
    const canBulkManageContacts = isAdminWorkspaceUser;
    const canImportContacts = isAdminWorkspaceUser;
    const canExportContacts = isAdminWorkspaceUser;
    const canCreateContacts = true;
    const contactsPageSubtitle = isAdminWorkspaceUser
        ? 'Manage company contacts, ownership, pipeline stages, and follow-ups.'
        : 'Work your assigned leads, notes, tasks, and follow-ups.';
    const hasActiveLeadStatusFilter = leadStatusFilter !== 'all';
    const crmAssignableUsers = useMemo(() => {
        return (Array.isArray(crmUserRoster) ? crmUserRoster : [])
            .map((agent) => ({
                id: String(agent?._id || agent?.id || agent?.userId || '').trim(),
                label: String(agent?.displayName || agent?.name || agent?.label || agent?.email || '').trim()
            }))
            .filter((agent) => agent.id)
            .filter((agent, index, list) => list.findIndex((candidate) => candidate.id === agent.id) === index)
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [crmUserRoster]);

    const showNotification = useCallback((message, type = 'success') => {
        const nextMessage = String(message || '').trim();
        if (!nextMessage) return;
        setNotification({ message: nextMessage, type: String(type || 'success').trim() || 'success' });
    }, []);

    useEffect(() => {
        if (!notification?.message) return undefined;
        const timer = window.setTimeout(() => setNotification(null), 2800);
        return () => window.clearTimeout(timer);
    }, [notification]);

    useEffect(() => {
        if (!crmSummaryPulseActive) return undefined;
        const timer = window.setTimeout(() => setCrmSummaryPulseActive(false), 1200);
        return () => window.clearTimeout(timer);
    }, [crmSummaryPulseActive]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterDropdown && !event.target.closest('.filter-dropdown')) {
                setShowFilterDropdown(false);
            }
            if (showSortDropdown && !event.target.closest('.sort-dropdown')) {
                setShowSortDropdown(false);
            }
            if (!event.target.closest('.contact-actions-menu') && !event.target.closest('.contact-actions-trigger')) {
                setActiveActionsMenuId(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showFilterDropdown, showSortDropdown]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setActiveActionsMenuId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeCrmUserRoster((payload = {}) => {
            const nextUsers = Array.isArray(payload?.users)
                ? payload.users
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];
            setCrmUserRoster(nextUsers);
        });

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    const crmAgentRosterMap = useMemo(() => {
        const nextMap = new Map();
        (Array.isArray(crmUserRoster) ? crmUserRoster : []).forEach((agent) => {
            const label = String(agent?.name || agent?.fullName || agent?.username || agent?.email || '').trim();
            const keys = [
                agent?._id,
                agent?.id,
                agent?.userId,
                agent?.ownerId,
                agent?.assignedTo,
                agent?.agentId
            ]
                .map((value) => String(value || '').trim())
                .filter(Boolean);
            keys.forEach((key) => {
                if (!nextMap.has(key)) {
                    nextMap.set(key, label || key);
                }
            });
        });
        return nextMap;
    }, [crmUserRoster]);

    const loadContacts = useCallback(async ({ silent = false } = {}) => {
        const requestSeq = ++contactsRequestSeqRef.current;
        const requestKey = buildContactsRequestSignature({
            currentPage,
            pageSize,
            searchTerm: debouncedSearchTerm,
            lastActiveFilter,
            leadStatusFilter,
            sortOption
        });

        if (contactsSkipNextLoadKeyRef.current === requestKey) {
            contactsSkipNextLoadKeyRef.current = '';
            return;
        }

        const releaseLoadingGuard = startLoadingTimeoutGuard(
            () => {
                if (!silent && requestSeq === contactsRequestSeqRef.current) setLoading(false);
            },
            CONTACTS_LOADING_TIMEOUT_MS
        );

        try {
            if (!silent) setLoading(true);

            const response = await apiClient.getContacts({
                page: currentPage,
                pageSize,
                search: debouncedSearchTerm,
                activeFilter: lastActiveFilter,
                leadStatus: leadStatusFilter,
                sort: sortOption
            });
            const responseData = response?.data || {};
            const contactsData = Array.isArray(responseData?.data) ? responseData.data : [];
            const nextContacts = dedupeContactsByPhoneIdentity(contactsData);
            const nextMeta = responseData?.meta || {};
            const nextTotalCount = Number(
                nextMeta.totalCount ?? response?.headers?.['x-total-count'] ?? contactsData.length
            );
            const resolvedPage = Number(nextMeta.page || currentPage) || currentPage;
            const resolvedPageSize = Number(nextMeta.pageSize || pageSize) || pageSize;

            if (requestSeq !== contactsRequestSeqRef.current) {
                return;
            }

            setContacts(nextContacts);
            setTotalContacts(Number.isFinite(nextTotalCount) && nextTotalCount >= 0 ? nextTotalCount : nextContacts.length);

            if (resolvedPage !== currentPage) {
                contactsSkipNextLoadKeyRef.current = buildContactsRequestSignature({
                    currentPage: resolvedPage,
                    pageSize: resolvedPageSize,
                    searchTerm: debouncedSearchTerm,
                    lastActiveFilter,
                    leadStatusFilter,
                    sortOption
                });
                setCurrentPage(resolvedPage);
            }
        } catch (error) {
            if (requestSeq !== contactsRequestSeqRef.current) {
                return;
            }
            console.error('Failed to load contacts:', error);
            if (!silent) {
                setContacts([]);
                setTotalContacts(0);
            }
        } finally {
            releaseLoadingGuard();
            if (!silent && requestSeq === contactsRequestSeqRef.current) setLoading(false);
        }
    }, [
        currentPage,
        debouncedSearchTerm,
        lastActiveFilter,
        leadStatusFilter,
        pageSize,
        sortOption
    ]);

    const loadCrmMetrics = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setCrmMetricsLoading(true);
            const metricsResponse = await crmService.getMetrics();
            if (metricsResponse?.success === false) {
                throw new Error(metricsResponse?.error || 'Failed to load CRM metrics');
            }
            const metricsData = metricsResponse?.data || {};
            setCrmMetrics(metricsData);
        } catch (error) {
            if (!silent) {
                console.error('Failed to load CRM metrics:', error);
            }
            setCrmMetrics(null);
        } finally {
            if (!silent) setCrmMetricsLoading(false);
        }
    }, []);

    const loadManageGroups = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setManageGroupsLoading(true);
            setManageGroupsError('');
            const response = await apiClient.getAudienceSegments({});
            const nextGroups = Array.isArray(response?.data?.data)
                ? response.data.data
                : Array.isArray(response?.data)
                    ? response.data
                    : [];
            setManageGroups(nextGroups);
        } catch (error) {
            setManageGroups([]);
            setManageGroupsError(error?.response?.data?.error || error?.message || 'Failed to load saved groups.');
        } finally {
            if (!silent) setManageGroupsLoading(false);
        }
    }, []);

    const normalizeGroupContactDraft = useCallback((contact = {}) => ({
        contactId: String(contact?._id || contact?.id || contact?.contactId || '').trim(),
        phone: String(contact?.phone || '').trim(),
        name: String(contact?.name || '').trim(),
        sourceType: String(contact?.sourceType || 'manual').trim() || 'manual',
        whatsappOptInStatus: String(contact?.whatsappOptInStatus || contact?.optInStatus || 'unknown').trim() || 'unknown'
    }), []);

    const loadContactsForGroupEditor = useCallback(async (contactIds = []) => {
        const selectedIds = Array.from(new Set(
            (Array.isArray(contactIds) ? contactIds : [])
                .map((contactId) => String(contactId || '').trim())
                .filter(Boolean)
        ));

        if (!selectedIds.length) return [];

        const nextContactsMap = new Map();
        const visibleMap = new Map(
            (Array.isArray(contacts) ? contacts : []).map((contact) => [String(contact?._id || '').trim(), contact])
        );

        selectedIds.forEach((contactId) => {
            const match = visibleMap.get(contactId);
            if (match) {
                nextContactsMap.set(contactId, normalizeGroupContactDraft(match));
            }
        });

        const missingIds = selectedIds.filter((contactId) => !nextContactsMap.has(contactId));
        if (missingIds.length) {
            const fetchedContacts = await Promise.all(
                missingIds.map(async (contactId) => {
                    try {
                        const response = await apiClient.getContact(contactId);
                        return response?.data?.data || response?.data || null;
                    } catch {
                        return null;
                    }
                })
            );

            fetchedContacts.filter(Boolean).forEach((contact) => {
                const contactId = String(contact?._id || contact?.id || contact?.contactId || '').trim();
                if (!contactId) return;
                nextContactsMap.set(contactId, normalizeGroupContactDraft(contact));
            });
        }

        return selectedIds
            .map((contactId) => nextContactsMap.get(contactId))
            .filter((contact) => contact && contact.phone);
    }, [contacts, normalizeGroupContactDraft]);

    const resetGroupEditor = useCallback(() => {
        setGroupEditorMode('create');
        setGroupEditorId('');
        setGroupName('');
        setGroupDescription('');
        setGroupContacts([]);
        setGroupContactsLoading(false);
        setGroupContactsError('');
        setGroupSaving(false);
    }, []);

    const openGroupEditorForCreate = useCallback(async () => {
        if (selectedContacts.size === 0) {
            showNotification('Select at least one contact first.', 'error');
            return;
        }

        setGroupEditorMode('create');
        setGroupEditorId('');
        setGroupName('');
        setGroupDescription('');
        setGroupContactsError('');
        setGroupContactsLoading(true);
        setShowGroupEditorModal(true);

        try {
            const nextContacts = await loadContactsForGroupEditor(Array.from(selectedContacts));
            setGroupContacts(nextContacts);
            if (!nextContacts.length) {
                setGroupContactsError('Unable to load the selected contacts for this group.');
            }
        } catch (error) {
            setGroupContacts([]);
            setGroupContactsError(error?.message || 'Unable to load the selected contacts for this group.');
        } finally {
            setGroupContactsLoading(false);
        }
    }, [loadContactsForGroupEditor, selectedContacts, showNotification]);

    const openGroupEditorForEdit = useCallback(async (group = {}) => {
        const groupId = String(group?._id || group?.id || '').trim();
        if (!groupId) return;

        setGroupEditorMode('edit');
        setGroupEditorId(groupId);
        setGroupName(String(group?.name || '').trim());
        setGroupDescription(String(group?.description || '').trim());
        setGroupContactsError('');
        setGroupContactsLoading(true);
        setShowGroupEditorModal(true);

        try {
            const response = await apiClient.getAudienceSegmentContacts(groupId, { page: 1, pageSize: 100 });
            const payload = response?.data?.data || response?.data || {};
            const nextContacts = Array.isArray(payload?.contacts)
                ? payload.contacts
                : Array.isArray(payload)
                    ? payload
                    : [];
            setGroupContacts(nextContacts.map(normalizeGroupContactDraft));
            if (!nextContacts.length) {
                setGroupContactsError('This group has no saved contacts yet.');
            }
        } catch (error) {
            setGroupContacts([]);
            setGroupContactsError(error?.response?.data?.error || error?.message || 'Unable to load group contacts.');
        } finally {
            setGroupContactsLoading(false);
        }
    }, [normalizeGroupContactDraft]);

    const handleRemoveGroupEditorContact = useCallback((contactId) => {
        const nextContactId = String(contactId || '').trim();
        if (!nextContactId) return;
        setGroupContacts((current) => current.filter((contact) => String(contact?.contactId || '').trim() !== nextContactId));
    }, []);

    const closeGroupEditor = useCallback(() => {
        if (groupSaving) return;
        resetGroupEditor();
        setShowGroupEditorModal(false);
    }, [groupSaving, resetGroupEditor]);

    const handleSaveGroup = useCallback(async () => {
        const nextName = String(groupName || '').trim();
        if (!nextName) {
            showNotification('Group name is required.', 'error');
            return;
        }

        const contactIds = groupContacts
            .map((contact) => String(contact?.contactId || '').trim())
            .filter(Boolean);

        if (groupEditorMode === 'edit' && !groupEditorId) {
            showNotification('Group id is missing.', 'error');
            return;
        }

        if (contactIds.length === 0) {
            showNotification('Select at least one contact first.', 'error');
            return;
        }

        setGroupSaving(true);
        try {
            const payload = {
                id: groupEditorMode === 'edit' ? groupEditorId : undefined,
                name: nextName,
                description: String(groupDescription || '').trim(),
                contactIds
            };

            const response = await apiClient.createAudienceSegment(payload);
            if (response?.data?.success === false) {
                throw new Error(response?.data?.error || 'Failed to save group');
            }

            await loadManageGroups({ silent: true });
            showNotification(groupEditorMode === 'edit' ? 'Group updated successfully.' : 'Group saved successfully.');
            setShowGroupEditorModal(false);
            resetGroupEditor();
        } catch (error) {
            showNotification(error?.response?.data?.error || error?.message || 'Failed to save group.', 'error');
        } finally {
            setGroupSaving(false);
        }
    }, [groupContacts, groupDescription, groupEditorId, groupEditorMode, groupName, loadManageGroups, resetGroupEditor, showNotification]);

    const openManageGroupsModal = useCallback(() => {
        setManageGroupsSearch('');
        setManageGroupsError('');
        setShowManageGroupsModal(true);
    }, []);

    const closeManageGroupsModal = useCallback(() => {
        setShowManageGroupsModal(false);
        setManageGroupsSearch('');
        setManageGroupsError('');
    }, []);

    const handleSelectManageGroup = useCallback((group = {}) => {
    const groupId = String(group?._id || group?.id || '').trim();
    if (!groupId) return;
    setShowManageGroupsModal(false);
    navigate(
        toAppPath(
            `/broadcast/new/template?groupId=${encodeURIComponent(groupId)}&groupRun=${Date.now()}`,
        ),
    );
    }, [navigate]);

    const handleDeleteManageGroup = useCallback(async (group = {}) => {
        const groupId = String(group?._id || group?.id || '').trim();
        if (!groupId) return;
        const groupNameLabel = String(group?.name || 'this group').trim() || 'this group';
        if (!window.confirm(`Delete group "${groupNameLabel}"?`)) return;

        try {
            const response = await apiClient.deleteAudienceSegment(groupId);
            if (response?.data?.success === false) {
                throw new Error(response?.data?.error || 'Failed to delete group');
            }
            await loadManageGroups({ silent: true });
            showNotification(`Group "${groupNameLabel}" deleted successfully.`);
        } catch (error) {
            showNotification(error?.response?.data?.error || error?.message || 'Failed to delete group.', 'error');
        }
    }, [loadManageGroups, showNotification]);

    useEffect(() => {
        loadContacts();
    }, [loadContacts]);

    useEffect(() => {
        loadCrmMetrics();
    }, [loadCrmMetrics]);

    useEffect(() => {
        if (!showManageGroupsModal) return undefined;
        let isActive = true;

        const run = async () => {
            await loadManageGroups({ silent: false });
            if (!isActive) return;
        };

        void run();

        return () => {
            isActive = false;
        };
    }, [loadManageGroups, showManageGroupsModal]);

    useEffect(() => {
        socketService.connect(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_WS_URL);

        const handleCrmChanged = () => {
            if (crmSummaryPulseTimerRef.current) {
                window.clearTimeout(crmSummaryPulseTimerRef.current);
            }
            setCrmSummaryPulseActive(true);
            crmSummaryPulseTimerRef.current = window.setTimeout(() => {
                setCrmSummaryPulseActive(false);
                crmSummaryPulseTimerRef.current = null;
            }, 1200);
            void loadContacts({ silent: true });
            void loadCrmMetrics({ silent: true });
        };

        socketService.on('crm_changed', handleCrmChanged);
        return () => {
            socketService.off('crm_changed', handleCrmChanged);
            if (crmSummaryPulseTimerRef.current) {
                window.clearTimeout(crmSummaryPulseTimerRef.current);
                crmSummaryPulseTimerRef.current = null;
            }
        };
    }, [loadContacts, loadCrmMetrics]);

    useEffect(() => {
        const routeState = readContactsRouteState(searchParams);
        setCurrentPage(routeState.currentPage);
        setPageSize(routeState.pageSize);
        setSearchTerm(routeState.searchTerm);
        setDebouncedSearchTerm(routeState.searchTerm);
        setLastActiveFilter(routeState.lastActiveFilter);
        setLeadStatusFilter(String(searchParams.get(CONTACTS_ROUTE_QUERY_KEYS.leadStatus) || 'all').trim().toLowerCase() || 'all');
        setSortOption(routeState.sortOption);
    }, [searchParams]);

    useEffect(() => {
        const normalizedSearch = String(searchTerm || '').trim();
        if (!normalizedSearch) {
            setDebouncedSearchTerm('');
            return undefined;
        }

        const timer = window.setTimeout(() => {
            setDebouncedSearchTerm(normalizedSearch);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchTerm]);

    const copyPublicOptInLink = useCallback(async (contact) => {
        const link = buildPublicWhatsAppOptInDemoUrl(contact, {
            source: 'contacts_share',
            scope: 'marketing'
        });
        if (!link) {
            showNotification('Unable to generate public opt-in link.', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(link);
            showNotification('Public opt-in link copied successfully.');
        } catch {
            showNotification('Clipboard blocked. Open the opt-in page and copy the link manually.', 'error');
        }
    }, [showNotification]);

    const openPublicOptInLink = useCallback((contact) => {
        const link = buildPublicWhatsAppOptInDemoUrl(contact, {
            source: 'contacts_share',
            scope: 'marketing'
        });
        if (!link) {
            showNotification('Unable to generate public opt-in link.', 'error');
            return;
        }
        window.open(link, '_blank', 'noopener,noreferrer');
        showNotification('Public opt-in page opened in a new tab.');
    }, [showNotification]);

    const resetContactForm = useCallback((contact = {}) => {
        setNewContact(createContactFormDraft(contact));
    }, []);

    const openAddContactModal = useCallback((seedContact = {}) => {
        resetContactForm(seedContact);
        setEditingContact(null);
        setShowEditModal(false);
        setShowAddModal(true);
    }, [resetContactForm]);

    const openBusinessCardScanner = useCallback((seedContact = {}, context = 'standalone') => {
        setCardScannerContext(context);
        setCardScannerSeedContact(createContactFormDraft(seedContact));
        if (context === 'add') {
            setShowAddModal(true);
        }
        setShowBusinessCardScanner(true);
    }, []);

    const handleFillContactFromScan = useCallback((scannedContact = {}) => {
        const nextDraft = createContactFormDraft(scannedContact);
        setCardScannerSeedContact(nextDraft);
        setNewContact(nextDraft);
        if (cardScannerContext === 'standalone') {
            setShowAddModal(true);
        }
    }, [cardScannerContext]);

    const handleSaveScannedContact = useCallback(async (scannedContact = {}) => {
        const nextContact = {
            ...createContactFormDraft(scannedContact),
            status: 'Unknown'
        };
        const normalizedPhone = normalizeImportedPhone(nextContact.phone);
        if (!normalizedPhone) {
            throw new Error('Phone number is required');
        }
        if (!isValidImportedPhone(normalizedPhone)) {
            throw new Error(`Phone number must contain ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits.`);
        }

        const contactData = {
            name: nextContact.name,
            phone: normalizedPhone,
            email: nextContact.email,
            companyName: nextContact.companyName,
            designation: nextContact.designation,
            tags: nextContact.tags
                ? String(nextContact.tags).split(',').map((tag) => tag.trim()).filter(Boolean)
                : [],
            whatsappOptInStatus: 'unknown',
            isBlocked: false,
            source: 'business_card',
            sourceType: 'manual'
        };

        const result = await apiClient.createContact(contactData);
        if (result?.data?.success === false) {
            throw new Error(result?.data?.error || 'Failed to add contact');
        }

        await loadContacts({ silent: true });
        setShowAddModal(false);
        setShowEditModal(false);
        setEditingContact(null);
        resetContactForm();
        showNotification('Business card saved to Contacts.');
        return result;
    }, [loadContacts, resetContactForm, showNotification]);

    const handleAddContact = async () => {
        const normalizedPhone = normalizeImportedPhone(newContact.phone);
        if (!normalizedPhone) {
            showNotification('Phone number is required', 'error');
            return;
        }
        if (!isValidImportedPhone(normalizedPhone)) {
            showNotification(
                `Phone number must contain ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits.`,
                'error'
            );
            return;
        }

        try {
            const contactData = {
                ...newContact,
                phone: normalizedPhone,
                companyName: newContact.companyName,
                designation: newContact.designation,
                tags: newContact.tags ? newContact.tags.split(',').map(tag => tag.trim()) : [],
                whatsappOptInStatus: 'unknown',
                isBlocked: false
            };
            
            const result = await apiClient.createContact(contactData);
            if (result?.data?.success === false) {
                throw new Error(result?.data?.error || 'Failed to add contact');
            }

            await loadContacts({ silent: true });
            resetContactForm();
            setShowAddModal(false);
            showNotification('Contact added successfully!');
        } catch (error) {
            showNotification('Failed to add contact: ' + error.message, 'error');
        }
    };

    const handleEditContact = (contact) => {
        const optInStatus = getWhatsAppOptInStatus(contact);
        setEditingContact(contact);
        setNewContact({
            name: contact.name || '',
            phone: contact.phone || '',
            email: contact.email || '',
            companyName: contact.companyName || contact.customFields?.companyName || '',
            designation: contact.designation || contact.customFields?.designation || '',
            tags: Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
            status: optInStatus === 'opted-out'
                ? 'Opted-out'
                : optInStatus === 'opted-in'
                    ? 'Opted-in'
                    : 'Unknown'
        });
        setShowEditModal(true);
    };

    const handleEditContactStatusChange = (nextStatus) => {
        const currentStatus = newContact.status || 'Unknown';
        const normalizedCurrentStatus =
            currentStatus === 'Opted-in'
                ? 'opted_in'
                : currentStatus === 'Opted-out'
                    ? 'opted_out'
                    : 'unknown';

        if (nextStatus === 'Opted-in' && normalizedCurrentStatus !== 'opted_in') {
            if (!editingContact) {
                return;
            }

            openWhatsAppOptInModal({
                ...editingContact,
                phone: newContact.phone || editingContact.phone,
                name: newContact.name || editingContact.name
            });
            return;
        }

        setNewContact((prev) => ({ ...prev, status: nextStatus }));
    };

    const handleUpdateContact = async () => {
        if (!editingContact) return;
        
        try {
            const normalizedPhone = normalizeImportedPhone(newContact.phone);
            if (!normalizedPhone) {
                showNotification('Phone number is required', 'error');
                return;
            }
            if (!isValidImportedPhone(normalizedPhone)) {
                showNotification(
                    `Phone number must contain ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits.`,
                    'error'
                );
                return;
            }
            const existingOptInStatus = getWhatsAppOptInStatus(editingContact);
            const nextWhatsappOptInStatus =
                newContact.status === 'Opted-out'
                    ? 'opted_out'
                    : newContact.status === 'Opted-in'
                        ? 'opted_in'
                        : 'unknown';

            if (
                nextWhatsappOptInStatus === 'opted_in' &&
                existingOptInStatus !== 'opted-in'
            ) {
                openWhatsAppOptInModal({
                    ...editingContact,
                    phone: newContact.phone || editingContact.phone,
                    name: newContact.name || editingContact.name
                });
                return;
            }

            const contactData = {
                name: newContact.name,
                phone: normalizedPhone,
                email: newContact.email,
                companyName: newContact.companyName,
                designation: newContact.designation,
                tags: newContact.tags
                    ? newContact.tags.split(',').map(tag => tag.trim()).filter(Boolean)
                    : [],
                whatsappOptInStatus: nextWhatsappOptInStatus,
                isBlocked: newContact.status === 'Opted-out'
            };
            
            const result = await apiClient.updateContact(editingContact._id, contactData);
            if (result?.data?.success === false) {
                throw new Error(result?.data?.error || 'Failed to update contact');
            }

            await loadContacts({ silent: true });
            setEditingContact(null);
            resetContactForm();
            setShowEditModal(false);
            showNotification('Contact updated successfully!');
        } catch (error) {
            showNotification('Failed to update contact: ' + error.message, 'error');
        }
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingContact(null);
        resetContactForm();
    };

    const handleDeleteContact = async (contact) => {
        if (!window.confirm(`Are you sure you want to delete ${contact.name || contact.phone}?`)) {
            return;
        }

        try {
            const result = await apiClient.deleteContact(contact._id);
            if (result?.data?.success === false) {
                throw new Error(result?.data?.error || 'Failed to delete contact');
            }

            await loadContacts({ silent: true });
            showNotification('Contact deleted successfully!');
        } catch (error) {
            showNotification('Failed to delete contact: ' + error.message, 'error');
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const allContactIds = visibleContacts.map(contact => contact._id);
            setSelectedContacts(new Set(allContactIds));
        } else {
            setSelectedContacts(new Set());
        }
    };

    const handleSelectContact = (contactId, checked) => {
        const newSelected = new Set(selectedContacts);
        if (checked) {
            newSelected.add(contactId);
        } else {
            newSelected.delete(contactId);
        }
        setSelectedContacts(newSelected);
    };

    const handleBulkDelete = async () => {
        if (!canBulkManageContacts) {
            showNotification('Bulk delete is available for admins only.', 'error');
            return;
        }
        if (selectedContacts.size === 0) {
            showNotification('Please select at least one contact to delete', 'error');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete ${selectedContacts.size} contact(s)?`)) {
            return;
        }

        try {
            const deletePromises = Array.from(selectedContacts).map(contactId => 
                apiClient.deleteContact(contactId)
            );
            
            await Promise.all(deletePromises);
            await loadContacts({ silent: true });
            setSelectedContacts(new Set());
            showNotification(`${selectedContacts.size} contact(s) deleted successfully!`);
        } catch (error) {
            showNotification('Failed to delete some contacts: ' + error.message, 'error');
        }
    };

    const handleBulkAssign = async () => {
        if (!canBulkManageContacts) {
            showNotification('Bulk assignment is available for admins only.', 'error');
            return;
        }
        if (selectedContacts.size === 0) {
            showNotification('Please select at least one contact to assign', 'error');
            return;
        }
        if (!bulkAssignTo) {
            showNotification('Please choose an agent to assign the selected contacts', 'error');
            return;
        }

        const selectedAgentLabel = crmAgentRosterMap.get(bulkAssignTo) || bulkAssignTo;
        const normalizedReason = String(bulkAssignReason || '').trim();
        if (!window.confirm(`Assign ${selectedContacts.size} contact(s) to ${selectedAgentLabel}?`)) {
            return;
        }

        try {
            const result = await crmService.bulkUpdateContacts({
                action: 'assign',
                contactIds: Array.from(selectedContacts),
                ownerId: bulkAssignTo,
                reason: normalizedReason
            });

            if (result?.success === false || result?.data?.success === false) {
                throw new Error(result?.error || result?.data?.error || 'Failed to assign contacts');
            }

            await loadContacts({ silent: true });
            setSelectedContacts(new Set());
            setSelectionMode(false);
            setBulkAssignTo('');
            setBulkAssignReason('');
            showNotification(`${selectedContacts.size} contact(s) assigned successfully!`);
        } catch (error) {
            showNotification('Failed to assign selected contacts: ' + error.message, 'error');
        }
    };

    const handlePageChange = (nextPage) => {
        setCurrentPage((current) => {
            const safeTotalPages = Math.max(totalPages, 1);
            const parsedPage = Number(nextPage);
            const targetPage = Number.isFinite(parsedPage) ? parsedPage : current;
            return Math.max(1, Math.min(targetPage, safeTotalPages));
        });
    };

    const handlePageSizeChange = (nextSize) => {
        const parsedSize = Number(nextSize);
        if (!Number.isFinite(parsedSize) || parsedSize <= 0) return;
        const normalizedSearch = String(searchTerm || '').trim();
        if (normalizedSearch !== debouncedSearchTerm) {
            setDebouncedSearchTerm(normalizedSearch);
        }
        setPageSize(parsedSize);
        setCurrentPage(1);
    };

    const handleSearchTermChange = (value) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleLastActiveFilterChange = (value) => {
        const normalizedSearch = String(searchTerm || '').trim();
        if (normalizedSearch !== debouncedSearchTerm) {
            setDebouncedSearchTerm(normalizedSearch);
        }
        setLastActiveFilter(value);
        setCurrentPage(1);
    };

    const handleLeadStatusFilterChange = (value) => {
        const normalizedSearch = String(searchTerm || '').trim();
        if (normalizedSearch !== debouncedSearchTerm) {
            setDebouncedSearchTerm(normalizedSearch);
        }
        setLeadStatusFilter(String(value || 'all').trim().toLowerCase() || 'all');
        setCurrentPage(1);
    };

    const handleSortOptionChange = (value) => {
        const normalizedSearch = String(searchTerm || '').trim();
        if (normalizedSearch !== debouncedSearchTerm) {
            setDebouncedSearchTerm(normalizedSearch);
        }
        setSortOption(value);
        setCurrentPage(1);
    };

    const handleSummaryCardClick = useCallback((kind = 'contacts') => {
        const normalizedKind = String(kind || 'contacts').trim();
        switch (normalizedKind) {
            case 'followups':
                handleSearchTermChange('');
                handleLastActiveFilterChange('all');
                handleLeadStatusFilterChange('follow_up');
                break;
            case 'notes':
                handleSearchTermChange('');
                handleLastActiveFilterChange('all');
                handleLeadStatusFilterChange('interested');
                break;
            case 'overdue':
                handleSearchTermChange('');
                handleLastActiveFilterChange('all');
                handleLeadStatusFilterChange('proposal_sent');
                break;
            case 'pipeline':
                handleSearchTermChange('');
                handleLastActiveFilterChange('all');
                handleLeadStatusFilterChange('all');
                break;
            case 'contacts':
            default:
                handleSearchTermChange('');
                handleLastActiveFilterChange('all');
                handleLeadStatusFilterChange('all');
                handleSortOptionChange('name-asc');
                break;
        }
    }, [handleLastActiveFilterChange, handleLeadStatusFilterChange, handleSearchTermChange, handleSortOptionChange]);

    const handleMessage = (contact) => {
        navigate('/inbox', {
            state: buildWhatsAppOutreachState(contact)
        });
    };

    const handleStartWhatsAppTemplate = (contact) => {
        navigate('/inbox', {
            state: buildWhatsAppOutreachState(contact, {
                openTemplateSendModal: true
            })
        });
    };

    const openCrmDrawer = useCallback((contact = null) => {
        if (!contact?._id) return;
        setCrmDrawerContact(contact);
        setCrmDrawerOpen(true);
    }, []);

    const closeCrmDrawer = useCallback(() => {
        setCrmDrawerOpen(false);
        setCrmDrawerContact(null);
    }, []);

    const handleCrmContactUpdated = useCallback((updatedContact = {}) => {
        if (updatedContact && typeof updatedContact === 'object') {
            setCrmDrawerContact((current) => (current ? { ...current, ...updatedContact } : updatedContact));
        }
        void loadContacts({ silent: true });
    }, [loadContacts]);

    const openWhatsAppOptInModal = (contact) => {
        setOptInTargetContact(contact);
        setOptInDraft(createWhatsAppOptInDraft(contact));
        setOptInError('');
        setOptInModalOpen(true);
    };

    const closeWhatsAppOptInModal = () => {
        setOptInModalOpen(false);
        setOptInTargetContact(null);
        setOptInDraft(createWhatsAppOptInDraft());
        setOptInError('');
    };

    const handleMarkWhatsAppOptIn = async () => {
        if (!optInTargetContact?._id) return;
        try {
            setOptInSubmitting(true);
            setOptInError('');
            await apiClient.markContactWhatsAppOptIn(optInTargetContact._id, {
                ...optInDraft,
                capturedBy: getCapturedByLabel()
            });
            await loadContacts({ silent: true });
            closeWhatsAppOptInModal();
            showNotification('WhatsApp opt-in updated successfully.');
        } catch (error) {
            setOptInError(error?.response?.data?.error || error.message || 'Failed to update WhatsApp opt-in.');
        } finally {
            setOptInSubmitting(false);
        }
    };

    const handleMarkWhatsAppOptOut = async (contact) => {
        try {
            await apiClient.markContactWhatsAppOptOut(contact._id, { source: 'contacts_ui' });
            await loadContacts({ silent: true });
            showNotification('WhatsApp opt-out updated.');
        } catch (error) {
            showNotification('Failed to update WhatsApp opt-out: ' + error.message, 'error');
        }
    };

    const closeAuditModal = () => {
        setAuditModalOpen(false);
        setAuditTargetContact(null);
        setAuditData(null);
        setAuditError('');
    };

    const loadContactConsentAudit = async (contact) => {
        if (!contact?._id) return;
        try {
            setAuditLoading(true);
            setAuditError('');
            const result = await apiClient.getContactWhatsAppConsentAudit(contact._id);
            setAuditData(result?.data?.data || null);
        } catch (error) {
            setAuditError(error?.response?.data?.error || error.message || 'Failed to load consent audit.');
        } finally {
            setAuditLoading(false);
        }
    };

    const openConsentAuditModal = async (contact) => {
        setAuditTargetContact(contact);
        setAuditModalOpen(true);
        setAuditData(null);
        await loadContactConsentAudit(contact);
    };

    const formatLastActive = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return 'Never';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${Math.max(diffMins, 0)} ${diffMins === 1 ? 'min' : 'mins'} ago`;
        if (diffHours < 24) return `${Math.max(diffHours, 0)} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        return `${Math.max(diffDays, 0)} ${diffDays === 1 ? 'day' : 'days'} ago`;
    };

    const formatFollowupDate = (timestamp) => {
        if (!timestamp) return 'None';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return 'None';
        return date.toLocaleString();
    };

    const normalizeSourceType = (contact) => {
        const raw = (contact?.sourceType || contact?.source || '').toString().toLowerCase();
        if (raw === 'incoming_message' || raw === 'message' || raw === 'conversation') return 'incoming_message';
        if (raw === 'incoming_call' || raw === 'call') return 'incoming_call';
        if (raw === 'imported' || raw === 'import') return 'imported';
        if (raw === 'public_opt_in' || raw === 'landing_page' || raw === 'qr_page' || raw === 'contacts_share') return 'public_opt_in';
        if (raw === 'meta_lead_ads' || raw === 'meta_lead') return 'meta_lead_ads';
        return 'manual';
    };

    const sourceLabelMap = {
        manual: 'Manual',
        imported: 'CSV',
        incoming_message: 'Msg',
        incoming_call: 'Call',
        public_opt_in: 'Landing Page',
        meta_lead_ads: 'Lead Ad'
    };

    const getWhatsAppOptInStatus = (contact = {}) => {
        const normalized = String(contact?.whatsappOptInStatus || '')
            .trim()
            .toLowerCase()
            .replace(/[-\s]+/g, '_');
        if (normalized === 'opted_in') return 'opted-in';
        if (normalized === 'opted_out') return 'opted-out';
        const normalizedSource = String(contact?.whatsappOptInSource || contact?.source || '')
            .trim()
            .toLowerCase();
        const normalizedSourceType = String(contact?.sourceType || '').trim().toLowerCase();
        const hasConsentEvidence = Boolean(
            String(contact?.whatsappOptInAt || '').trim() ||
            String(contact?.whatsappOptInTextSnapshot || '').trim() ||
            String(contact?.whatsappOptInProofType || '').trim() ||
            String(contact?.whatsappOptInProofId || '').trim() ||
            String(contact?.whatsappOptInProofUrl || '').trim() ||
            String(contact?.whatsappOptInPageUrl || '').trim() ||
            ['landing_page', 'public_opt_in', 'website_form'].includes(normalizedSource)
        );
        if (hasConsentEvidence) return 'opted-in';
        if (['imported', 'csv_import'].includes(normalizedSourceType) && !contact?.isBlocked && !contact?.whatsappOptOutAt) {
            return 'opted-in';
        }
        return contact?.isBlocked || contact?.whatsappOptOutAt ? 'opted-out' : 'unknown';
    };

    const compactOptInStatusLabel = (status) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'opted-in') return 'Opted-in';
        if (normalized === 'opted-out') return 'Opted-out';
        return 'Unknown';
    };

    const compactMessagingStatusLabel = (label) => {
        const normalized = String(label || '').trim();
        if (normalized === 'Template Only') return 'Template Only';
        if (normalized === '24h Open') return 'Open Window';
        if (normalized === 'Opted Out') return 'Blocked';
        return normalized || 'Template Only';
    };

    const formatConsentSourceLabel = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return 'Unknown';
        const lookup = {
            manual: 'Manual',
            csv_import: 'CSV Import',
            import: 'CSV Import',
            landing_page: 'Landing Page',
            public_opt_in: 'Public Opt-in',
            form_submission: 'Form Submission',
            paper_form: 'Paper Form'
        };
        const mapped = lookup[normalized.toLowerCase()];
        if (mapped) return mapped;
        return normalized.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    };

    // Import functions
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImportFile(file);
            setImportRows([]);
            setImportHeaders([]);
            setImportPreview([]);
            setImportMapping({});
            parseCSVFile(file);
        }
    };

    const toggleContactActionsMenu = (contactId) => {
        setActiveActionsMenuId((currentId) => (currentId === contactId ? null : contactId));
    };

    const closeContactActionsMenu = () => {
        setActiveActionsMenuId(null);
    };

    const parseCSVFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            Papa.parse(text, {
                header: true,
                skipEmptyLines: 'greedy',
                transformHeader: (header) => String(header || '').trim(),
                complete: (results) => {
                    const headers = Array.isArray(results?.meta?.fields)
                        ? results.meta.fields.map((field) => String(field || '').trim()).filter(Boolean)
                        : [];
                    const rows = Array.isArray(results?.data)
                        ? results.data.filter((row) =>
                            row && typeof row === 'object' && Object.values(row).some((value) => String(value || '').trim())
                        )
                        : [];

                    if (headers.length < 2 || rows.length === 0) {
                        showNotification('CSV file must contain a header row and at least one data row', 'error');
                        return;
                    }

                    const normalizedRows = rows.map((row, index) => ({
                        lineNumber: index + 2,
                        ...row
                    }));

                    setImportHeaders(headers);
                    setImportRows(normalizedRows);
                    setImportPreview(normalizedRows.slice(0, 5));
                    setImportMapping(buildAutoImportMapping(headers));
                    setImportStep('mapping');
                },
                error: () => {
                    showNotification('Failed to parse CSV file. Please check the file format.', 'error');
                }
            });
        };
        reader.readAsText(file);
    };

    const handleMappingChange = (field, value) => {
        setImportMapping(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const getAvailableFields = () => {
        if (importHeaders.length > 0) return importHeaders;
        if (importPreview.length === 0) return [];
        return Object.keys(importPreview[0]).filter(key => key !== 'lineNumber');
    };

    const normalizeImportHeaderKey = (value = '') =>
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');

    const findImportHeader = (headers = [], ...aliases) => {
        const lookup = new Map(headers.map((header) => [normalizeImportHeaderKey(header), header]));
        for (const alias of aliases) {
            const match = lookup.get(normalizeImportHeaderKey(alias));
            if (match) return match;
        }
        return '';
    };

    const buildAutoImportMapping = (headers = []) => ({
        name: findImportHeader(headers, 'first name', 'firstname', 'full name', 'name'),
        lastName: findImportHeader(headers, 'last name', 'lastname', 'surname'),
        phone: findImportHeader(
            headers,
            'whatsapp number',
            'phone number',
            'phone',
            'mobile',
            'mobile number',
            'contact number'
        ),
        email: findImportHeader(headers, 'email', 'email address', 'emailaddress'),
        status: findImportHeader(headers, 'opt-in status', 'status', 'whatsapp opt-in status'),
        scope: findImportHeader(headers, 'consent scope', 'scope', 'whatsapp opt-in scope'),
        listName: findImportHeader(headers, 'list name', 'listname'),
        tags: findImportHeader(headers, 'tags', 'tag'),
        capturedBy: findImportHeader(headers, 'captured by', 'capturedby')
    });

    const normalizeImportStatusValue = (value = '') => {
        const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
        if (!normalized) return 'unknown';
        if (normalized === 'opted-in') return 'opted-in';
        if (normalized === 'opted-out') return 'opted-out';
        if (normalized === 'unknown') return 'unknown';
        return normalized;
    };

    const mapImportedRow = (row) => {
        const contact = {};

        Object.keys(importMapping).forEach(field => {
            const sourceField = importMapping[field];
            if (sourceField && row[sourceField] !== undefined) {
                switch (field) {
                    case 'name': {
                        const firstName = row[sourceField] || '';
                        const lastNameField = importMapping['lastName'];
                        const lastName = lastNameField ? (row[lastNameField] || '') : '';
                        contact[field] = [firstName, lastName].filter(Boolean).join(' ').trim();
                        break;
                    }
                    case 'phone': {
                        contact[field] = normalizeImportedPhone(row[sourceField] || '');
                        break;
                    }
                    case 'email':
                        contact[field] = row[sourceField] || '';
                        break;
                    case 'tags': {
                        const tags = row[sourceField] || '';
                        contact[field] = tags.split(',').map(tag => tag.trim()).filter(Boolean);
                        break;
                    }
                    case 'status':
                        contact[field] = row[sourceField] || 'Unknown';
                        break;
                    case 'scope':
                        contact[field] = row[sourceField] || '';
                        break;
                    case 'capturedBy':
                        contact[field] = row[sourceField] || '';
                        break;
                    case 'listName':
                        contact[field] = row[sourceField] || '';
                        break;
                    default:
                        if (field.startsWith('custom_attribute_')) {
                            contact[field] = row[sourceField] || '';
                        }
                        break;
                }
            }
        });

        const phone = String(contact.phone || '').trim();
        const validPhone = isValidImportedPhone(phone);
        const normalizedStatus = 'opted-in';
        const importedConsentReferenceId = `landing-page-import-${String(row.lineNumber || 'row').trim()}-${phone.slice(-4) || 'contact'}-${Date.now().toString(36)}`;

        if (validPhone) {
            contact.status = 'Opted-in';
            contact.whatsappOptInStatus = 'opted_in';
            contact.whatsappOptInSource = 'landing_page';
            contact.whatsappOptInScope = contact.scope || row[importMapping.scope] || 'marketing';
            contact.whatsappOptInTextSnapshot = 'Consent captured via website landing page during CSV import.';
            contact.whatsappOptInProofType = 'import_record';
            contact.whatsappOptInProofId = importedConsentReferenceId;
            contact.whatsappOptInCapturedBy = contact.capturedBy || row[importMapping.capturedBy] || 'csv_import';
            contact.whatsappOptInPageUrl = '';
            contact.whatsappOptInIp = '';
            contact.whatsappOptInUserAgent = '';
            contact.whatsappOptInMetadata = {
                importLineNumber: row.lineNumber || null,
                importSource: 'csv_import',
                consentSource: 'landing_page'
            };
        }

        return {
            lineNumber: row.lineNumber,
            contact: validPhone ? contact : null,
            status: normalizedStatus,
            invalidPhone: !validPhone,
            invalidPhoneMessage: phone
                ? `Phone number must contain ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits.`
                : 'Phone number is required.'
        };
    };

    const getImportAuditSummary = () => {
        const rows = importRows.map(mapImportedRow);
        const invalidRows = rows.filter((row) => row.invalidPhone);
        const optedInRows = rows.filter((row) => row.status === 'opted-in');

        return {
            rows,
            invalidRows,
            optedInCount: optedInRows.length
        };
    };

    const getMappedContacts = () =>
        importAudit.rows
            .filter((row) => !row.invalidPhone)
            .map((row) => row.contact)
            .filter((contact) => contact?.phone);

    const handleImportContacts = async () => {
        if (!canImportContacts) {
            showNotification('Import is available for admins only.', 'error');
            return;
        }
        const mappedContacts = getMappedContacts();
        
        if (mappedContacts.length === 0) {
            if (importAudit.invalidRows.length > 0) {
                showNotification(
                    `Import blocked: ${importAudit.invalidRows.length} row${importAudit.invalidRows.length === 1 ? ' has' : 's have'} invalid phone formatting.`,
                    'error'
                );
            } else {
                showNotification('No valid contacts to import', 'error');
            }
            return;
        }

        if (importAudit.invalidRows.length > 0) {
            showNotification(
                `Import blocked: ${importAudit.invalidRows.length} row${importAudit.invalidRows.length === 1 ? ' has' : 's have'} invalid phone formatting. Please fix them before uploading.`,
                'error'
            );
            return;
        }

        try {
            setLoading(true);
            const result = await apiClient.importContacts(mappedContacts);
        
            if (result.data.success) {
                const importErrors = Array.isArray(result.data?.results?.errors) ? result.data.results.errors : [];
                const errorSuffix = importErrors.length
                    ? ` ${importErrors.length} row${importErrors.length === 1 ? ' was' : 's were'} rejected by backend validation.`
                    : '';
                showNotification(`Successfully imported ${mappedContacts.length} contacts!${errorSuffix}`);
                setShowImportModal(false);
                setImportFile(null);
                setImportRows([]);
                setImportHeaders([]);
                setImportPreview([]);
                setImportMapping({});
                setImportStep('upload');
                await loadContacts({ silent: true });
            } else {
                showNotification('Import failed: ' + (result.data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showNotification('Import failed: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const downloadSampleCSV = () => {
        const csvContent = `First Name,Last Name,WhatsApp Number,Email,Status,Consent Scope,List Name,Tags,custom_attribute_1,custom_attribute_2,custom_attribute_3
John,Doe,+1234567890,john@example.com,Opted-in,marketing,Main List,"VIP, Lead",Custom1,Custom2,Custom3
Jane,Smith,+9876543210,jane@example.com,Opted-out,service,Secondary List,"Regular, Support",Value1,Value2,Value3`;
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contact_import_sample.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const downloadContactsExport = () => {
        const exportSource =
            canExportContacts && selectedContacts.size > 0
                ? visibleContacts.filter((contact) => selectedContacts.has(contact._id))
                : visibleContacts;
        const rows = exportSource.map((contact) => ({
            Name: contact?.name || '',
            Phone: contact?.phone || '',
            Email: contact?.email || '',
            'Lead Status': contact?.leadStatusLabel || formatLeadStatusLabel(contact?.leadStatus),
            'Assigned Agent': formatOwnerLabel(contact, crmAgentRosterMap),
            'Followup Date': contact?.followupAt || '',
            'Last Activity': contact?.lastActivity || '',
            Tags: Array.isArray(contact?.tags) ? contact.tags.join(', ') : String(contact?.tags || ''),
            'Opt-in Status': compactOptInStatusLabel(contact?.optInStatus),
            Origin: sourceLabelMap[contact?.sourceType || 'manual'] || 'Manual'
        }));
        const csv = Papa.unparse(rows);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'contacts_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const resetImport = () => {
        setShowImportModal(false);
        setImportFile(null);
        setImportRows([]);
        setImportHeaders([]);
        setImportPreview([]);
        setImportMapping({});
        setImportStep('upload');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const importAudit = useMemo(() => getImportAuditSummary(), [importRows, importMapping]);

    const visibleContacts = useMemo(() => contacts.map((contact) => {
        const followupAt = contact?.nextFollowUpAt || contact?.followupDate || null;
        const lastActivity = contact?.lastContactAt || contact?.lastContact || contact?.lastInboundMessageAt || contact?.updatedAt || contact?.createdAt;
        return {
            ...contact,
            sourceType: normalizeSourceType(contact),
            lastActivity,
            lastActive: lastActivity,
            followupAt,
            leadStatusNormalized: String(contact?.leadStatus || 'new_lead').trim().toLowerCase() || 'new_lead',
            leadStatusLabel: formatLeadStatusLabel(contact?.leadStatus),
            assignedAgentLabel: formatOwnerLabel(contact, crmAgentRosterMap),
            whatsappState: getWhatsAppConversationState(contact),
            optInStatus: getWhatsAppOptInStatus(contact)
        };
    }), [contacts]);

    const crmSummary = useMemo(() => {
        const now = Date.now();
        const notesCount = visibleContacts.filter((contact) => {
            const notes = String(contact?.notes || contact?.internalNotes || '').trim();
            return Boolean(notes);
        }).length;
        const followupsDueCount = visibleContacts.filter((contact) => {
            const dueValue = contact?.followupAt || contact?.followupDate || contact?.nextFollowUpAt;
            if (!dueValue) return false;
            const dueTime = new Date(dueValue).getTime();
            return Number.isFinite(dueTime) && dueTime <= now;
        }).length;
        const activePipelineCount = visibleContacts.filter((contact) => {
            const status = String(contact?.leadStatus || '').trim().toLowerCase();
            return status && status !== 'closed';
        }).length;

        return {
            visibleContacts: Number(totalContacts || 0),
            scopedContacts: Number(crmMetrics?.contacts?.total || totalContacts || 0),
            activePipelineCount,
            notesCount,
            followupsDueCount,
            openTasks: Number(crmMetrics?.tasks?.open || 0),
            overdueTasks: Number(crmMetrics?.tasks?.overdue || 0)
        };
    }, [crmMetrics, totalContacts, visibleContacts]);

    const totalPages = Math.max(1, Math.ceil(totalContacts / pageSize));
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
    const compactPagination = totalPages > 7;

    useEffect(() => {
        setCurrentPage((current) => {
            if (totalContacts === 0) return 1;
            return Math.min(Math.max(current, 1), Math.max(1, totalPages));
        });
    }, [totalContacts, totalPages]);

    useEffect(() => {
        const nextParams = buildContactsRouteSearchParams({
            currentPage: safeCurrentPage,
            pageSize,
            searchTerm: debouncedSearchTerm,
            lastActiveFilter,
            leadStatusFilter,
            sortOption
        });
        const currentSerialized = searchParams.toString();
        const nextSerialized = nextParams.toString();
        if (currentSerialized !== nextSerialized) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [debouncedSearchTerm, safeCurrentPage, lastActiveFilter, leadStatusFilter, pageSize, searchParams, setSearchParams, sortOption]);

    return (
        <div className="contacts-page">
            <div className="page-header">
                <div>
                    <h2>Contacts ({loading ? '...' : totalContacts})</h2>
                    <p>{contactsPageSubtitle}</p>
                </div>
                <div className="header-actions">
                    {selectionMode ? (
                        <>
                            {canBulkManageContacts && (
                                <div className="bulk-assign-toolbar">
                                    <div className="bulk-assign-toolbar__field">
                                        <select
                                            className="bulk-assign-select"
                                            value={bulkAssignTo}
                                            onChange={(e) => setBulkAssignTo(e.target.value)}
                                            aria-label="Assign selected contacts to agent"
                                        >
                                            <option value="">Assign to agent</option>
                                            {crmAssignableUsers.map((agent) => (
                                                <option key={agent.id} value={agent.id}>
                                                    {agent.label || agent.id}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="bulk-assign-toolbar__field">
                                        <textarea
                                            className="bulk-assign-note"
                                            rows="2"
                                            value={bulkAssignReason}
                                            onChange={(e) => setBulkAssignReason(e.target.value)}
                                            placeholder="Internal reason or handover note"
                                            aria-label="Internal reason or handover note"
                                        />
                                    </div>
                                    <button
                                        className="secondary-btn"
                                        onClick={handleBulkAssign}
                                        disabled={selectedContacts.size === 0 || !bulkAssignTo}
                                    >
                                        <Send size={18} />
                                        Assign Selected ({selectedContacts.size})
                                    </button>
                                </div>
                            )}
                            {canBulkManageContacts && selectedContacts.size > 0 && (
                                <button 
                                    className="secondary-btn delete-selected" 
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 size={18} />
                                    Delete Selected ({selectedContacts.size})
                                </button>
                            )}
                            {selectedContacts.size > 0 && (
                                <button
                                    className="secondary-btn"
                                    onClick={openGroupEditorForCreate}
                                >
                                    <Users size={18} />
                                    Save Group ({selectedContacts.size})
                                </button>
                            )}
                            <button 
                                className="secondary-btn" 
                                onClick={() => {
                                    setSelectionMode(false);
                                    setSelectedContacts(new Set());
                                }}
                            >
                                Exit Selection
                            </button>
                        </>
                    ) : (
                        <>
                            {canCreateContacts && (
                                <button className="secondary-btn" onClick={() => openBusinessCardScanner({}, 'standalone')}>
                                    <ScanLine size={18} />
                                    Scan Card
                                </button>
                            )}
                            {canImportContacts && (
                                <button className="secondary-btn" onClick={() => setShowImportModal(true)}>
                                    <Upload size={18} />
                                    Import
                                </button>
                            )}
                            {canExportContacts && (
                                <button className="secondary-btn" onClick={downloadContactsExport}>
                                    <Download size={18} />
                                    Export
                                </button>
                            )}
                            <button className="secondary-btn" onClick={openManageGroupsModal}>
                                <Users size={18} />
                                Manage Groups
                            </button>
                            {canCreateContacts && (
                                <button className="primary-btn" onClick={() => openAddContactModal()}>
                                    <UserPlus size={18} />
                                    Add Contact
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {notification?.message ? (
                <div className={`notification ${notification.type === 'error' ? 'error' : 'success'}`}>
                    {notification.message}
                </div>
            ) : null}

            <div className="contacts-controls">
                <div className="search-box">
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Search contacts..." 
                        aria-label="Search contacts"
                        value={searchTerm}
                        onChange={(e) => handleSearchTermChange(e.target.value)}
                    />
                </div>
                <div className="filter-dropdown">
                    <button 
                        className="icon-btn" 
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        title="Filter by last active"
                        aria-label="Filter by last active"
                        aria-haspopup="menu"
                        aria-expanded={showFilterDropdown}
                        aria-controls="contacts-filter-menu"
                    >
                        <Filter size={18} />
                    </button>
                    {showFilterDropdown && (
                        <div className="filter-menu" id="contacts-filter-menu">
                            <div className="filter-section">
                                <h4>Last Active</h4>
                                <div className="filter-options">
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="all"
                                            checked={lastActiveFilter === 'all'}
                                            onChange={(e) => handleLastActiveFilterChange(e.target.value)}
                                        />
                                        All Time
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1day"
                                            checked={lastActiveFilter === '1day'}
                                            onChange={(e) => handleLastActiveFilterChange(e.target.value)}
                                        />
                                        Last 1 Day
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="2days"
                                            checked={lastActiveFilter === '2days'}
                                            onChange={(e) => handleLastActiveFilterChange(e.target.value)}
                                        />
                                        Last 2 Days
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1week"
                                            checked={lastActiveFilter === '1week'}
                                            onChange={(e) => handleLastActiveFilterChange(e.target.value)}
                                        />
                                        Last 1 Week
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1month"
                                            checked={lastActiveFilter === '1month'}
                                            onChange={(e) => handleLastActiveFilterChange(e.target.value)}
                                        />
                                        Last 1 Month
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="sort-dropdown">
                    <button 
                        className="icon-btn" 
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        title="Sort contacts"
                        aria-label="Sort contacts"
                        aria-haspopup="menu"
                        aria-expanded={showSortDropdown}
                        aria-controls="contacts-sort-menu"
                    >
                        <ArrowUpDown size={18} />
                    </button>
                    {showSortDropdown && (
                        <div className="sort-menu" id="contacts-sort-menu">
                            <div className="sort-section">
                                <h4>Sort By</h4>
                                <div className="sort-options">
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="name-asc"
                                            checked={sortOption === 'name-asc'}
                                            onChange={(e) => handleSortOptionChange(e.target.value)}
                                        />
                                        Name (A-Z)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="name-desc"
                                            checked={sortOption === 'name-desc'}
                                            onChange={(e) => handleSortOptionChange(e.target.value)}
                                        />
                                        Name (Z-A)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="last-active-asc"
                                            checked={sortOption === 'last-active-asc'}
                                            onChange={(e) => handleSortOptionChange(e.target.value)}
                                        />
                                        Last Active (Oldest First)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="last-active-desc"
                                            checked={sortOption === 'last-active-desc'}
                                            onChange={(e) => handleSortOptionChange(e.target.value)}
                                        />
                                        Last Active (Recent First)
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {canBulkManageContacts && !selectionMode && (
                    <button 
                        className="secondary-btn select-contacts-btn" 
                        onClick={() => {
                            setSelectionMode(true);
                            setBulkAssignTo('');
                            setSelectedContacts(new Set());
                        }}
                    >
                        <CheckSquare size={18} />
                        Select Contacts
                    </button>
                )}
            </div>

            <div className="lead-status-filter-row" aria-label="Lead status filters">
                {CONTACT_LEAD_STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`crm-filter-chip${leadStatusFilter === option.value ? ' active' : ''}`}
                        onClick={() => handleLeadStatusFilterChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="crm-summary-strip" aria-label="CRM contact summary">
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('contacts')}
                >
                    <span className="crm-summary-card__label">Contacts</span>
                    <strong className="crm-summary-card__value">
                        {crmMetricsLoading ? '...' : crmSummary.visibleContacts}
                        <span className="crm-summary-card__value-divider">/</span>
                        <span className="crm-summary-card__value-total">{crmSummary.scopedContacts}</span>
                    </strong>
                    <span className="crm-summary-card__meta">Shown in list / total in scope</span>
                </button>
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('pipeline')}
                >
                    <span className="crm-summary-card__label">Active Pipeline</span>
                    <strong className="crm-summary-card__value">{crmSummary.activePipelineCount}</strong>
                    <span className="crm-summary-card__meta">Open leads in view</span>
                </button>
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('pipeline')}
                >
                    <span className="crm-summary-card__label">Open Tasks</span>
                    <strong className="crm-summary-card__value">{crmSummary.openTasks}</strong>
                    <span className="crm-summary-card__meta">Pending action items</span>
                </button>
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('overdue')}
                >
                    <span className="crm-summary-card__label">Overdue</span>
                    <strong className="crm-summary-card__value">{crmSummary.overdueTasks}</strong>
                    <span className="crm-summary-card__meta">Tasks past due</span>
                </button>
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('notes')}
                >
                    <span className="crm-summary-card__label">Notes</span>
                    <strong className="crm-summary-card__value">{crmSummary.notesCount}</strong>
                    <span className="crm-summary-card__meta">Contacts with internal notes</span>
                </button>
                <button
                    type="button"
                    className={`crm-summary-card${crmSummaryPulseActive ? ' crm-summary-card--pulse' : ''}`}
                    onClick={() => handleSummaryCardClick('followups')}
                >
                    <span className="crm-summary-card__label">Followups</span>
                    <strong className="crm-summary-card__value">{crmSummary.followupsDueCount}</strong>
                    <span className="crm-summary-card__meta">Due or overdue now</span>
                </button>
            </div>

            <div className="contacts-table-container">
                {loading ? (
                    <div className="contacts-skeleton">
                        <div className="contacts-loading-copy">
                            <div className="contacts-loading-title">Loading contacts</div>
                            <div className="contacts-loading-subtitle">Pulling the latest database entries and consent status.</div>
                        </div>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={`contacts-skeleton-${index}`} className="contacts-skeleton-row" />
                        ))}
                    </div>
                ) : visibleContacts.length > 0 ? (
                    <>
                    <table className="contacts-table contacts-desktop-table">
                        <thead>
                            <tr>
                                {selectionMode && (
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={visibleContacts.length > 0 && visibleContacts.every((contact) => selectedContacts.has(contact._id))}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                )}
                                <th className="name-col">Name</th>
                                <th className="phone-col">Phone Number</th>
                                <th className="tags-col">Tags</th>
                                <th className="lead-status-col">Lead Status</th>
                                <th className="assigned-col">Assigned Agent</th>
                                <th className="followup-col">Followup Date</th>
                                <th className="consent-col">Opt-in</th>
                                <th className="origin-col">Origin</th>
                                <th className="messaging-col">Send State</th>
                                <th className="last-active-col">Last Activity</th>
                                {!selectionMode && <th className="actions-col">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {visibleContacts.map((contact, index) => (
                                <tr key={contact._id || index}>
                                    {selectionMode && (
                                        <td>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedContacts.has(contact._id)}
                                                onChange={(e) => handleSelectContact(contact._id, e.target.checked)}
                                            />
                                        </td>
                                    )}
                                    <td className="name-col">
                                        <div className="contact-name-cell">
                                            <span className={`contact-name ${contact.name ? '' : 'contact-name--fallback'}`}>
                                                {contact.name || 'Unnamed contact'}
                                            </span>
                                            {contact.email && <span className="contact-email">{contact.email}</span>}
                                        </div>
                                    </td>
                                    <td className="phone-col">{contact.phone}</td>
                                    <td className="tags-col">
                                        {contact.tags && contact.tags.length > 0 ? (
                                            contact.tags.map((tag, tagIndex) => (
                                                <span key={tagIndex} className="tag blue">{tag}</span>
                                            ))
                                        ) : (
                                            <span className="tag gray">No tags</span>
                                        )}
                                    </td>
                                    <td className="lead-status-col">
                                        <span className={`badge crm-lead-badge crm-lead-badge--${contact.leadStatusNormalized || 'new_lead'}`}>
                                            {contact.leadStatusLabel || formatLeadStatusLabel(contact.leadStatus)}
                                        </span>
                                    </td>
                                    <td className="assigned-col">
                                        <span className="crm-assigned-agent">
                                            {formatOwnerLabel(contact, crmAgentRosterMap)}
                                        </span>
                                    </td>
                                    <td className="followup-col">
                                        <span className="crm-followup-date">
                                            {formatFollowupDate(contact.followupAt)}
                                        </span>
                                    </td>
                                    <td className="consent-col">
                                        <div className="whatsapp-contact-status">
                                            <span className={`badge whatsapp-contact-badge whatsapp-contact-badge--${contact.optInStatus || 'unknown'}`}>
                                                {compactOptInStatusLabel(contact.optInStatus)}
                                            </span>
                                            {contact.whatsappOptInSource ? (
                                                <span className="whatsapp-contact-audit">
                                                    Consent source: {formatConsentSourceLabel(contact.whatsappOptInSource)}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="origin-col">
                                        <span className={`source-badge ${contact.sourceType || 'manual'}`}>
                                            {sourceLabelMap[contact.sourceType || 'manual'] || 'Manual'}
                                        </span>
                                    </td>
                                    <td className="messaging-col">
                                        <span className={`badge whatsapp-contact-badge whatsapp-contact-badge--${contact.whatsappState?.badgeTone || 'template-only'}`}>
                                            {compactMessagingStatusLabel(contact.whatsappState?.statusLabel)}
                                        </span>
                                    </td>
                                    <td className="last-active-col">{formatLastActive(contact.lastActivity)}</td>
                                    {!selectionMode && (
                                        <td className="actions-col">
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn"
                                                    title="Message"
                                                    aria-label={`Message ${contact.name || contact.phone || 'contact'}`}
                                                    onClick={() => handleMessage(contact)}
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                                <button
                                                    className="action-btn action-btn--template"
                                                    title="Send Template"
                                                    aria-label={`Send WhatsApp template to ${contact.name || contact.phone || 'contact'}`}
                                                    onClick={() => handleStartWhatsAppTemplate(contact)}
                                                    disabled={contact.whatsappState?.optedOut}
                                                >
                                                    <Send size={16} />
                                                </button>
                                                <div className="contact-actions-menu-wrap">
                                                    <button
                                                        type="button"
                                                        className="action-btn contact-actions-trigger"
                                                        title="More actions"
                                                        aria-label={`More actions for ${contact.name || contact.phone || 'contact'}`}
                                                        onClick={() => toggleContactActionsMenu(contact._id || contact.phone || index)}
                                                        aria-haspopup="menu"
                                                        aria-expanded={activeActionsMenuId === (contact._id || contact.phone || index)}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {activeActionsMenuId === (contact._id || contact.phone || index) ? (
                                                        <div className="contact-actions-menu" role="menu" aria-label="Contact actions">
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    openConsentAuditModal(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <FileText size={15} />
                                                                <span>View Consent Audit</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    openCrmDrawer(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <ExternalLink size={15} />
                                                                <span>Open CRM Details</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    copyPublicOptInLink(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <Copy size={15} />
                                                                <span>Copy Public Opt-In Link</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    openPublicOptInLink(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <ExternalLink size={15} />
                                                                <span>Open Public Opt-In Page</span>
                                                            </button>
                                                            {contact.whatsappState?.optedOut ? (
                                                                <button
                                                                    type="button"
                                                                    className="contact-actions-menu__item"
                                                                    onClick={() => {
                                                                        closeContactActionsMenu();
                                                                        openWhatsAppOptInModal(contact);
                                                                    }}
                                                                    role="menuitem"
                                                                >
                                                                    <CheckSquare size={15} />
                                                                    <span>Mark Opted In</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="contact-actions-menu__item"
                                                                    onClick={() => {
                                                                        closeContactActionsMenu();
                                                                        handleMarkWhatsAppOptOut(contact);
                                                                    }}
                                                                    role="menuitem"
                                                                >
                                                                    <X size={15} />
                                                                    <span>Mark Opted Out</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    handleEditContact(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <Edit size={15} />
                                                                <span>Edit Contact</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item contact-actions-menu__item--danger"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    handleDeleteContact(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <Trash2 size={15} />
                                                                <span>Delete Contact</span>
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="contacts-mobile-cards">
                        {visibleContacts.map((contact, index) => (
                            <div key={`mobile-${contact._id || index}`} className="contact-mobile-card">
                                <div className="contact-mobile-card__top">
                                    <div className="contact-mobile-card__identity">
                                        <div className="contact-mobile-card__name-row">
                                            {selectionMode && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedContacts.has(contact._id)}
                                                    onChange={(e) => handleSelectContact(contact._id, e.target.checked)}
                                                />
                                            )}
                                            <span className={`contact-name ${contact.name ? '' : 'contact-name--fallback'}`}>
                                                {contact.name || 'Unnamed contact'}
                                            </span>
                                        </div>
                                        <div className="contact-mobile-card__phone">{contact.phone}</div>
                                        {contact.email && <div className="contact-mobile-card__email">{contact.email}</div>}
                                    </div>
                                    {!selectionMode && (
                                        <div className="contact-mobile-card__actions">
                                            <button
                                                className="action-btn"
                                                title="Message"
                                                aria-label={`Message ${contact.name || contact.phone || 'contact'}`}
                                                onClick={() => handleMessage(contact)}
                                            >
                                                <MessageCircle size={16} />
                                            </button>
                                            <button
                                                className="action-btn action-btn--template"
                                                title="Send Template"
                                                aria-label={`Send WhatsApp template to ${contact.name || contact.phone || 'contact'}`}
                                                onClick={() => handleStartWhatsAppTemplate(contact)}
                                                disabled={contact.whatsappState?.optedOut}
                                            >
                                                <Send size={16} />
                                            </button>
                                            <div className="contact-actions-menu-wrap">
                                                <button
                                                    type="button"
                                                    className="action-btn contact-actions-trigger"
                                                    title="More actions"
                                                    aria-label={`More actions for ${contact.name || contact.phone || 'contact'}`}
                                                    onClick={() => toggleContactActionsMenu(contact._id || contact.phone || index)}
                                                    aria-haspopup="menu"
                                                    aria-expanded={activeActionsMenuId === (contact._id || contact.phone || index)}
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                                {activeActionsMenuId === (contact._id || contact.phone || index) ? (
                                                    <div className="contact-actions-menu contact-actions-menu--mobile" role="menu" aria-label="Contact actions">
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                openConsentAuditModal(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <FileText size={15} />
                                                            <span>View Consent Audit</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                openCrmDrawer(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <ExternalLink size={15} />
                                                            <span>Open CRM Details</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                copyPublicOptInLink(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <Copy size={15} />
                                                            <span>Copy Public Opt-In Link</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                openPublicOptInLink(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <ExternalLink size={15} />
                                                            <span>Open Public Opt-In Page</span>
                                                        </button>
                                                        {contact.whatsappState?.optedOut ? (
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    openWhatsAppOptInModal(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <CheckSquare size={15} />
                                                                <span>Mark Opted In</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="contact-actions-menu__item"
                                                                onClick={() => {
                                                                    closeContactActionsMenu();
                                                                    handleMarkWhatsAppOptOut(contact);
                                                                }}
                                                                role="menuitem"
                                                            >
                                                                <X size={15} />
                                                                <span>Mark Opted Out</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                handleEditContact(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <Edit size={15} />
                                                            <span>Edit Contact</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="contact-actions-menu__item contact-actions-menu__item--danger"
                                                            onClick={() => {
                                                                closeContactActionsMenu();
                                                                handleDeleteContact(contact);
                                                            }}
                                                            role="menuitem"
                                                        >
                                                            <Trash2 size={15} />
                                                            <span>Delete Contact</span>
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="contact-mobile-card__meta">
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Lead Status</span>
                                        <span className={`badge crm-lead-badge crm-lead-badge--${contact.leadStatusNormalized || 'new_lead'}`}>
                                            {contact.leadStatusLabel || formatLeadStatusLabel(contact.leadStatus)}
                                        </span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Assigned Agent</span>
                                        <span className="contact-mobile-card__value">{formatOwnerLabel(contact, crmAgentRosterMap)}</span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Followup Date</span>
                                        <span className="contact-mobile-card__value">{formatFollowupDate(contact.followupAt)}</span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Opt-in</span>
                                        <span className={`badge whatsapp-contact-badge whatsapp-contact-badge--${contact.optInStatus || 'unknown'}`}>
                                            {compactOptInStatusLabel(contact.optInStatus)}
                                        </span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Origin</span>
                                        <span className={`source-badge ${contact.sourceType || 'manual'}`}>
                                            {sourceLabelMap[contact.sourceType || 'manual'] || 'Manual'}
                                        </span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Send State</span>
                                        <span className={`badge whatsapp-contact-badge whatsapp-contact-badge--${contact.whatsappState?.badgeTone || 'template-only'}`}>
                                            {compactMessagingStatusLabel(contact.whatsappState?.statusLabel)}
                                        </span>
                                    </div>
                                    <div className="contact-mobile-card__meta-row">
                                        <span className="contact-mobile-card__label">Last Activity</span>
                                        <span className="contact-mobile-card__value">{formatLastActive(contact.lastActivity)}</span>
                                    </div>
                                    {contact.tags && contact.tags.length > 0 ? (
                                        <div className="contact-mobile-card__tags">
                                            {contact.tags.map((tag, tagIndex) => (
                                                <span key={tagIndex} className="tag blue">{tag}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="contact-mobile-card__tags">
                                            <span className="tag gray">No tags</span>
                                        </div>
                                    )}
                                    {contact.whatsappOptInSource ? (
                                        <div className="contact-mobile-card__source-note">
                                            Consent source: {formatConsentSourceLabel(contact.whatsappOptInSource)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="contacts-pagination">
                            <div className="contacts-pagination__info">
                                Showing{' '}
                                <span className="contacts-pagination__range">
                                    {(safeCurrentPage - 1) * pageSize + 1}
                                    -
                                    {Math.min(safeCurrentPage * pageSize, totalContacts)}
                                </span>{' '}
                                of{' '}
                                <span className="contacts-pagination__strong">
                                    {totalContacts}
                                </span>
                            </div>
                            <div className="contacts-pagination__controls">
                                <div className="contacts-page-size">
                                    <label htmlFor="contacts-page-size">Contacts per page</label>
                                    <select
                                        id="contacts-page-size"
                                        className="contacts-page-size__select"
                                        value={pageSize}
                                        onChange={(e) => handlePageSizeChange(e.target.value)}
                                        aria-label="Contacts per page"
                                    >
                                        {CONTACTS_PAGE_SIZE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    className="contacts-pagination__btn"
                                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                                    disabled={safeCurrentPage <= 1}
                                >
                                    Prev
                                </button>
                                {compactPagination ? (
                                    <div className="contacts-pagination__compact">
                                        <span className="contacts-pagination__compact-label">
                                            Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <div className="contacts-pagination__pages">
                                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNo) => (
                                            <button
                                                key={pageNo}
                                                type="button"
                                                className={`contacts-pagination__page ${pageNo === safeCurrentPage ? 'active' : ''}`}
                                                onClick={() => handlePageChange(pageNo)}
                                            >
                                                {pageNo}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="contacts-pagination__btn"
                                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                                    disabled={safeCurrentPage >= totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="no-contacts">
                        <div className="no-contacts-content">
                            <div className="no-contacts-icon">
                                <UserPlus size={28} />
                            </div>
                            <h3>No contacts found</h3>
                            <p>
                                {searchTerm || lastActiveFilter !== 'all' || hasActiveLeadStatusFilter
                                    ? 'Your search or filters are hiding every contact right now.'
                                    : 'Start by adding your first contact to build your database.'}
                            </p>
                                    {(searchTerm || lastActiveFilter !== 'all' || hasActiveLeadStatusFilter) && (
                                <button
                                    className="secondary-btn"
                                    onClick={() => {
                                        handleSearchTermChange('');
                                        handleLastActiveFilterChange('all');
                                        handleLeadStatusFilterChange('all');
                                        handleSortOptionChange('name-asc');
                                    }}
                                >
                                    Reset Filters
                                </button>
                            )}
                            {!searchTerm && lastActiveFilter === 'all' && !hasActiveLeadStatusFilter && canCreateContacts && (
                                <button className="primary-btn" onClick={() => openAddContactModal()}>
                                    <UserPlus size={18} />
                                    Add Your First Contact
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showManageGroupsModal && (
                <div className="modal-overlay">
                    <div className="modal group-editor-modal" role="dialog" aria-modal="true" aria-labelledby="manage-groups-title">
                        <div className="modal-header">
                            <h3 id="manage-groups-title">Manage Groups</h3>
                            <button className="close-btn" type="button" aria-label="Close manage groups dialog" onClick={closeManageGroupsModal}>{"\u00D7"}</button>
                        </div>
                        <div className="modal-body">
                            <div className="group-editor-summary">
                                <strong>Saved audience groups</strong>
                                <span>Edit, delete, or reuse groups without changing the Broadcast group picker.</span>
                            </div>

                            <div className="group-editor-panel__content" style={{ padding: 0, borderTop: 'none' }}>
                                <div className="search-box" style={{ maxWidth: 'none', width: '100%', marginBottom: 14 }}>
                                    <Search size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search saved groups..."
                                        aria-label="Search saved groups"
                                        value={manageGroupsSearch}
                                        onChange={(e) => setManageGroupsSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            {manageGroupsError ? (
                                <div className="contacts-import-warning" role="status">
                                    <strong>Group load error</strong>
                                    <p>{manageGroupsError}</p>
                                </div>
                            ) : null}

                            <div className="group-editor-contact-list" style={{ maxHeight: '52vh' }}>
                                {manageGroupsLoading ? (
                                    <div className="segment-picker-empty">Loading groups...</div>
                                ) : (() => {
                                    const filteredGroups = manageGroups.filter((group) => {
                                        const term = String(manageGroupsSearch || '').trim().toLowerCase();
                                        if (!term) return true;
                                        return [
                                            group?.name,
                                            group?.description,
                                            group?.sourceType
                                        ].some((value) => String(value || '').toLowerCase().includes(term));
                                    });

                                    if (!filteredGroups.length) {
                                        return <div className="segment-picker-empty">No saved groups found.</div>;
                                    }

                                    return filteredGroups.map((group) => {
                                        const memberCount = Number(group?.recipientCount || group?.contacts?.length || 0);
                                        return (
                                            <div key={group?._id || group?.id || group?.name} className="group-editor-contact-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                                                    <div>
                                                        <strong>{group?.name || 'Unnamed group'}</strong>
                                                        <span>{String(group?.sourceType || 'manual').replace(/_/g, ' ')} Group</span>
                                                    </div>
                                                    <small>{memberCount.toLocaleString()} contacts</small>
                                                </div>
                                                <span>{group?.description || 'No description provided.'}</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                                                    <button type="button" className="secondary-btn" onClick={() => handleSelectManageGroup(group)}>
                                                        Use in Broadcast
                                                    </button>
                                                    <button type="button" className="secondary-btn" onClick={() => openGroupEditorForEdit(group)}>
                                                        Edit
                                                    </button>
                                                    <button type="button" className="secondary-btn delete-selected" onClick={() => handleDeleteManageGroup(group)}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer group-editor-modal__footer">
                            <button type="button" className="secondary-btn" onClick={closeManageGroupsModal}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGroupEditorModal && (
                <div className="modal-overlay">
                    <div className="modal group-editor-modal" role="dialog" aria-modal="true" aria-labelledby="group-editor-title">
                        <div className="modal-header">
                            <h3 id="group-editor-title">
                                {groupEditorMode === 'edit' ? 'Edit Group' : 'Save Group'}
                            </h3>
                            <button className="close-btn" type="button" aria-label="Close group editor dialog" onClick={closeGroupEditor}>{"\u00D7"}</button>
                        </div>
                        <div className="modal-body">
                            <div className="group-editor-summary">
                                <strong>
                                    {groupEditorMode === 'edit'
                                        ? 'Update the group name, description, or members.'
                                        : 'Save the selected contacts as a reusable group.'}
                                </strong>
                                <span>
                                    {groupEditorMode === 'edit'
                                        ? 'Changes will update the existing saved group.'
                                        : `${selectedContacts.size} selected contact(s) will be saved into a new group.`}
                                </span>
                            </div>

                            {groupContactsError ? (
                                <div className="contacts-import-warning" role="status">
                                    <strong>Group members</strong>
                                    <p>{groupContactsError}</p>
                                </div>
                            ) : null}

                            <details className="group-editor-panel" open>
                                <summary className="group-editor-panel__summary">
                                    <span>Selected Contacts</span>
                                    <span className="group-editor-panel__badge">
                                        {groupContactsLoading ? '...' : groupContacts.length}
                                    </span>
                                </summary>
                                <div className="group-editor-panel__content">
                                    {groupContactsLoading ? (
                                        <div className="segment-picker-empty">Loading contacts...</div>
                                    ) : groupContacts.length > 0 ? (
                                        <div className="group-editor-contact-list">
                                            {groupContacts.map((contact, index) => (
                                                <div key={contact.contactId || contact.phone || index} className="group-editor-contact-card">
                                                    <strong>{contact.name || 'Unnamed contact'}</strong>
                                                    <span>{contact.phone || 'No phone'}</span>
                                                    <small>{contact.sourceType || 'manual'} | {contact.whatsappOptInStatus || 'unknown'}</small>
                                                    <div style={{ marginTop: 8 }}>
                                                        <button
                                                            type="button"
                                                            className="secondary-btn delete-selected"
                                                            onClick={() => handleRemoveGroupEditorContact(contact.contactId)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="segment-picker-empty">No contacts loaded.</div>
                                    )}
                                </div>
                            </details>

                            <div className="form-group">
                                <label>Group Name *</label>
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder="Enter group name"
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    rows="4"
                                    value={groupDescription}
                                    onChange={(e) => setGroupDescription(e.target.value)}
                                    placeholder="Optional note about this group"
                                />
                            </div>
                        </div>
                        <div className="modal-footer group-editor-modal__footer">
                            <button type="button" className="secondary-btn" onClick={closeGroupEditor} disabled={groupSaving}>
                                Cancel
                            </button>
                            <button type="button" className="primary-btn" onClick={handleSaveGroup} disabled={groupSaving}>
                                {groupSaving ? 'Saving...' : (groupEditorMode === 'edit' ? 'Update Group' : 'Save Group')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
                        <div className="modal-header">
                            <h3 id="add-contact-title">Add New Contact</h3>
                            <button
                                className="close-btn"
                                type="button"
                                aria-label="Close add contact dialog"
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetContactForm();
                                }}
                            >
                                {"\u00D7"}
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="contacts-scanner-cta">
                                <div>
                                    <strong>Fast lane</strong>
                                    <span>Scan a business card to auto-fill this form in seconds.</span>
                                </div>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => openBusinessCardScanner(newContact, 'add')}
                                >
                                    <ScanLine size={16} />
                                    Scan business card
                                </button>
                            </div>
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                                    placeholder="Enter contact name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number *</label>
                                <input
                                    type="tel"
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                                    placeholder="+1234567890"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    value={newContact.companyName || ''}
                                    onChange={(e) => setNewContact({...newContact, companyName: e.target.value})}
                                    placeholder="Company name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Designation</label>
                                <input
                                    type="text"
                                    value={newContact.designation || ''}
                                    onChange={(e) => setNewContact({...newContact, designation: e.target.value})}
                                    placeholder="Sales Director"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tags</label>
                                <input
                                    type="text"
                                    value={newContact.tags}
                                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                                    placeholder="VIP, Lead, Support (comma separated)"
                                />
                            </div>
                            <div className="contacts-modal-note">
                                Imported contacts are saved as <strong>Opted-in</strong> with <strong>Landing Page</strong> consent proof.
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="secondary-btn"
                                onClick={() => {
                                    setShowAddModal(false);
                                    resetContactForm();
                                }}
                            >
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={handleAddContact}>
                                Add Contact
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Contact Modal */}
            {showEditModal && editingContact && (
                <div className="modal-overlay">
                    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-contact-title">
                        <div className="modal-header">
                            <h3 id="edit-contact-title">Edit Contact</h3>
                            <button className="close-btn" type="button" aria-label="Close edit contact dialog" onClick={handleCloseEditModal}>{"\u00D7"}</button>
                        </div>
                        <div className="modal-body">
                            <div className="contacts-scanner-cta">
                                <div>
                                    <strong>Sync from card</strong>
                                    <span>Capture a fresh scan and keep the edit draft in sync.</span>
                                </div>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => openBusinessCardScanner(newContact, 'edit')}
                                >
                                    <ScanLine size={16} />
                                    Scan business card
                                </button>
                            </div>
                            <div className="form-group">
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                                    placeholder="Enter contact name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number *</label>
                                <input
                                    type="tel"
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                                    placeholder="+1234567890"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Company Name</label>
                                <input
                                    type="text"
                                    value={newContact.companyName || ''}
                                    onChange={(e) => setNewContact({...newContact, companyName: e.target.value})}
                                    placeholder="Company name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Designation</label>
                                <input
                                    type="text"
                                    value={newContact.designation || ''}
                                    onChange={(e) => setNewContact({...newContact, designation: e.target.value})}
                                    placeholder="Sales Director"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tags</label>
                                <input
                                    type="text"
                                    value={newContact.tags}
                                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                                    placeholder="VIP, Lead, Support (comma separated)"
                                />
                            </div>
                            <div className="form-group">
                                <label>Opt-in Status</label>
                                <select
                                    value={newContact.status || 'Unknown'}
                                    onChange={(e) => handleEditContactStatusChange(e.target.value)}
                                >
                                    <option value="Unknown">Unknown</option>
                                    <option value="Opted-in">Opted-in</option>
                                    <option value="Opted-out">Opted-out</option>
                                </select>
                            </div>
                            {newContact.status !== 'Opted-in' ? (
                                <div className="contacts-modal-note">
                                    Marketing consent proof is required before marking a contact as
                                    <strong> Opted-in</strong>.
                                    <button
                                        type="button"
                                        className="contacts-inline-link"
                                        onClick={() =>
                                            openWhatsAppOptInModal({
                                                ...editingContact,
                                                phone: newContact.phone || editingContact.phone,
                                                name: newContact.name || editingContact.name
                                            })
                                        }
                                    >
                                        Capture opt-in proof
                                    </button>
                                </div>
                            ) : (
                                <div className="contacts-modal-note">
                                    Current proof source: <strong>{editingContact.whatsappOptInSource || 'Recorded'}</strong>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={handleCloseEditModal}>
                                Cancel
                            </button>
                            <button className="primary-btn" onClick={handleUpdateContact}>
                                Update Contact
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Contacts Modal */}
            {showImportModal && (
                <div className="modal-overlay">
                    <div className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-contacts-title">
                        <div className="modal-header">
                            <h3 id="import-contacts-title">Import Contacts</h3>
                            <button className="close-btn" type="button" aria-label="Close import contacts dialog" onClick={resetImport}>{"\u00D7"}</button>
                        </div>
                        <div className="modal-body">
                            {importStep === 'upload' && (
                                <div className="import-step">
                                    <div className="form-group">
                                        <label>Upload CSV File</label>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileSelect}
                                            className="file-input"
                                        />
                                        <div className="file-info">
                                            {importFile ? `Selected: ${importFile.name}` : 'No file selected'}
                                        </div>
                                    </div>
                                    <div className="csv-format-info">
                                        <h4>CSV Format Requirements</h4>
                                        <p>Your CSV file should include the following columns:</p>
                                        <ul>
                                            <li><strong>First Name</strong> - Contact's first name</li>
                                            <li><strong>Last Name</strong> - Contact's last name</li>
                                            <li><strong>WhatsApp Number</strong> - Phone number with country code</li>
                                            <li><strong>Email</strong> - Email address (optional)</li>
                                            <li><strong>Opt-in Status</strong> - CSV imports are automatically saved as opted-in with landing page consent proof.</li>
                                            <li><strong>Consent Scope</strong> - marketing, service, or both</li>
                                            <li><strong>List Name</strong> - Contact list name (optional)</li>
                                            <li><strong>Tags</strong> - Comma-separated tags (optional)</li>
                                            <li><strong>custom_attribute_1,2,3</strong> - Custom fields (optional)</li>
                                        </ul>
                                        <p className="contacts-modal-note">
                                            Tip: quoted values are supported, so tags like <strong>VIP, Lead</strong> will import correctly. Uploads only need a valid phone number; consent proof is generated automatically during import.
                                        </p>
                                        <button 
                                            className="secondary-btn download-sample-btn" 
                                            onClick={downloadSampleCSV}
                                        >
                                            <Download size={16} />
                                            Download Sample CSV
                                        </button>
                                    </div>
                                </div>
                            )}

                            {importStep === 'mapping' && (
                                <div className="import-step">
                                    <div className="mapping-header">
                                        <h4>Map Your Fields</h4>
                                        <p>Match your CSV columns to our contact fields:</p>
                                    </div>

                                    {importAudit.optedInCount > 0 && (
                                        <div className="contacts-import-warning" role="status" aria-live="polite">
                                            <strong>
                                                {importAudit.optedInCount} row{importAudit.optedInCount === 1 ? '' : 's'} in this file are marked Opted-in.
                                            </strong>
                                            <p>
                                                They will be stored as opted-in, with landing-page consent proof generated automatically.
                                            </p>
                                        </div>
                                    )}
                                    
                                    <div className="mapping-table-container">
                                        <table className="mapping-table">
                                            <thead>
                                                <tr>
                                                    <th>Our Field</th>
                                                    <th>Your CSV Column</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>Name *</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.name || ''}
                                                            onChange={(e) => handleMappingChange('name', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Last Name</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.lastName || ''}
                                                            onChange={(e) => handleMappingChange('lastName', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Phone Number *</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.phone || ''}
                                                            onChange={(e) => handleMappingChange('phone', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Email</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.email || ''}
                                                            onChange={(e) => handleMappingChange('email', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Opt-in Status</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.status || ''}
                                                            onChange={(e) => handleMappingChange('status', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Consent Scope</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.scope || ''}
                                                            onChange={(e) => handleMappingChange('scope', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Captured By</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.capturedBy || ''}
                                                            onChange={(e) => handleMappingChange('capturedBy', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Tags</td>
                                                    <td>
                                                        <select 
                                                            value={importMapping.tags || ''}
                                                            onChange={(e) => handleMappingChange('tags', e.target.value)}
                                                            className="mapping-select"
                                                        >
                                                            <option value="">Select column...</option>
                                                            {getAvailableFields().map(field => (
                                                                <option key={field} value={field}>{field}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {importPreview.length > 0 && (
                                        <div className="preview-section">
                                            <h4>Preview (First 5 rows)</h4>
                                            <div className="preview-table-container">
                                                <table className="preview-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Line</th>
                                                            {Object.keys(importPreview[0]).filter(key => key !== 'lineNumber').map(header => (
                                                                <th key={header}>{header}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importPreview.map((row, index) => (
                                                            <tr key={index}>
                                                                <td>{row.lineNumber}</td>
                                                                {Object.keys(importPreview[0]).filter(key => key !== 'lineNumber').map(header => (
                                                                    <td key={header}>{row[header] || ''}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {importStep === 'upload' && (
                                <>
                                    <button className="secondary-btn" onClick={resetImport}>
                                        Cancel
                                    </button>
                                </>
                            )}
                            {importStep === 'mapping' && (
                                <>
                                    <button className="secondary-btn" onClick={() => setImportStep('upload')}>
                                        Back
                                    </button>
                                    <button 
                                        className="primary-btn" 
                                        onClick={handleImportContacts}
                                        disabled={!importMapping.phone}
                                    >
                                        Import {getMappedContacts().length} Contacts
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <BusinessCardScannerModal
                open={showBusinessCardScanner}
                onClose={() => {
                    setShowBusinessCardScanner(false);
                    setCardScannerSeedContact({});
                    setCardScannerContext('standalone');
                }}
                seedContact={cardScannerSeedContact}
                onFillForm={handleFillContactFromScan}
                onSave={handleSaveScannedContact}
            />

            <WhatsAppOptInModal
                open={optInModalOpen}
                phone={optInTargetContact?.phone || ''}
                contactName={optInTargetContact?.name || ''}
                form={optInDraft}
                onChange={setOptInDraft}
                onClose={closeWhatsAppOptInModal}
                onSubmit={handleMarkWhatsAppOptIn}
                submitting={optInSubmitting}
                error={optInError}
            />
            <WhatsAppConsentAuditModal
                open={auditModalOpen}
                onClose={closeAuditModal}
                loading={auditLoading}
                error={auditError}
                data={auditData}
                contactName={auditTargetContact?.name || ''}
                phone={auditTargetContact?.phone || ''}
                onRefresh={() => loadContactConsentAudit(auditTargetContact)}
            />
            <CrmContactDrawer
                open={crmDrawerOpen}
                contactId={crmDrawerContact?._id || ''}
                initialContact={crmDrawerContact}
                currentUserId={String(user?.id || user?._id || '').trim()}
                onClose={closeCrmDrawer}
                onContactUpdated={handleCrmContactUpdated}
                onTaskMutation={() => void loadContacts({ silent: true })}
                onDealMutation={() => void loadContacts({ silent: true })}
                onStartWhatsApp={handleMessage}
            />
        </div>
    );
};

export default Contacts;
