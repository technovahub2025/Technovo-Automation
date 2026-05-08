import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Filter, Edit, Trash2, MessageCircle, Send, CheckSquare, Square, ChevronDown, ArrowUpDown, Upload, Download, X, FileText, Copy, ExternalLink, MoreVertical } from 'lucide-react';
import Papa from 'papaparse';
import { apiClient } from '../services/whatsappapi';
import WhatsAppOptInModal from '../components/WhatsAppOptInModal';
import WhatsAppConsentAuditModal from '../components/WhatsAppConsentAuditModal';
import { startLoadingTimeoutGuard } from '../utils/loadingGuard';
import { buildPublicWhatsAppOptInDemoUrl, buildWhatsAppOutreachState } from '../utils/whatsappOutreachNavigation';
import { getWhatsAppConversationState } from '../utils/whatsappContactState';
import {
    clearSidebarPageCache,
    readSidebarPageCache,
    resolveCacheUserId,
    writeSidebarPageCache
} from '../utils/sidebarPageCache';
import './Contacts.css';

const CONTACTS_LOADING_TIMEOUT_MS = 8000;
const CONTACTS_CACHE_TTL_MS = 10 * 60 * 1000;
const CONTACTS_CACHE_NAMESPACE = 'contacts-page:v2';
const CONTACTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const sanitizeContactForCache = (contact = {}) => ({
    _id: String(contact?._id || '').trim(),
    id: String(contact?.id || '').trim(),
    name: String(contact?.name || '').trim(),
    phone: String(contact?.phone || '').trim(),
    email: String(contact?.email || '').trim(),
    tags: Array.isArray(contact?.tags)
        ? contact.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 20)
        : [],
    isBlocked: Boolean(contact?.isBlocked),
    whatsappOptInStatus: String(contact?.whatsappOptInStatus || '').trim(),
    whatsappOptInAt: String(contact?.whatsappOptInAt || '').trim(),
    whatsappOptInSource: String(contact?.whatsappOptInSource || '').trim(),
    whatsappOptInScope: String(contact?.whatsappOptInScope || '').trim(),
    whatsappOptInTextSnapshot: String(contact?.whatsappOptInTextSnapshot || '').trim(),
    whatsappOptInProofType: String(contact?.whatsappOptInProofType || '').trim(),
    whatsappOptInProofId: String(contact?.whatsappOptInProofId || '').trim(),
    whatsappOptInProofUrl: String(contact?.whatsappOptInProofUrl || '').trim(),
    whatsappOptInCapturedBy: String(contact?.whatsappOptInCapturedBy || '').trim(),
    whatsappOptInPageUrl: String(contact?.whatsappOptInPageUrl || '').trim(),
    whatsappOptOutAt: String(contact?.whatsappOptOutAt || '').trim(),
    lastInboundMessageAt: String(contact?.lastInboundMessageAt || '').trim(),
    serviceWindowClosesAt: String(contact?.serviceWindowClosesAt || '').trim(),
    sourceType: String(contact?.sourceType || '').trim(),
    source: String(contact?.source || '').trim(),
    createdAt: String(contact?.createdAt || '').trim(),
    lastSeen: String(contact?.lastSeen || '').trim()
});

const sanitizeContactsCache = (contacts = []) =>
    (Array.isArray(contacts) ? contacts : []).map(sanitizeContactForCache).filter((contact) => (
        contact._id || contact.id || contact.phone
    ));

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
    sort: 'sort'
};

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
    sortOption
}) => {
    const params = new URLSearchParams();
    const normalizedSearch = String(searchTerm || '').trim();
    const normalizedFilter = String(lastActiveFilter || 'all').trim() || 'all';
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

const Contacts = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialRouteStateRef = useRef(null);
    if (!initialRouteStateRef.current) {
        initialRouteStateRef.current = readContactsRouteState(searchParams);
    }
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(initialRouteStateRef.current.searchTerm);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', tags: '', status: 'Unknown' });
    const [selectionMode, setSelectionMode] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [lastActiveFilter, setLastActiveFilter] = useState(initialRouteStateRef.current.lastActiveFilter);
    const [sortOption, setSortOption] = useState(initialRouteStateRef.current.sortOption);
    const [showImportModal, setShowImportModal] = useState(false);
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
    const [currentPage, setCurrentPage] = useState(initialRouteStateRef.current.currentPage);
    const [pageSize, setPageSize] = useState(initialRouteStateRef.current.pageSize);
    const fileInputRef = useRef(null);
    const currentUserId = resolveCacheUserId();

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

    const persistContactsCache = useCallback((nextContacts) => {
        writeSidebarPageCache(
            CONTACTS_CACHE_NAMESPACE,
            { contacts: sanitizeContactsCache(nextContacts) },
            {
                currentUserId,
                ttlMs: CONTACTS_CACHE_TTL_MS
            }
        );
    }, [currentUserId]);

    const loadContacts = useCallback(async ({ silent = false } = {}) => {
        const releaseLoadingGuard = startLoadingTimeoutGuard(
            () => {
                if (!silent) setLoading(false);
            },
            CONTACTS_LOADING_TIMEOUT_MS
        );
        try {
            if (!silent) setLoading(true);
            const result = await apiClient.getContacts();
            const contactsData = result.data?.data || result.data || [];
            const nextContacts = Array.isArray(contactsData) ? contactsData : [];
            setContacts(nextContacts);
            persistContactsCache(nextContacts);
        } catch (error) {
            console.error('Failed to load contacts:', error);
            if (!silent) {
                setContacts([]);
            }
        } finally {
            releaseLoadingGuard();
            if (!silent) setLoading(false);
        }
    }, [persistContactsCache]);

    useEffect(() => {
        const cachedContacts = readSidebarPageCache(CONTACTS_CACHE_NAMESPACE, {
            currentUserId,
            allowStale: true
        });

        if (Array.isArray(cachedContacts?.data?.contacts)) {
            setContacts(cachedContacts.data.contacts);
            setLoading(false);
            loadContacts({ silent: true });
            return;
        }

        loadContacts();
    }, [currentUserId, loadContacts]);

    useEffect(() => {
        const routeState = readContactsRouteState(searchParams);
        setCurrentPage(routeState.currentPage);
        setPageSize(routeState.pageSize);
        setSearchTerm(routeState.searchTerm);
        setLastActiveFilter(routeState.lastActiveFilter);
        setSortOption(routeState.sortOption);
    }, [searchParams]);

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
                tags: newContact.tags ? newContact.tags.split(',').map(tag => tag.trim()) : [],
                whatsappOptInStatus: 'unknown',
                isBlocked: false
            };
            
            const result = await apiClient.createContact(contactData);
            if (result?.data?.success === false) {
                throw new Error(result?.data?.error || 'Failed to add contact');
            }

            await loadContacts({ silent: true });
            setNewContact({ name: '', phone: '', email: '', tags: '', status: 'Unknown' });
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
            setNewContact({ name: '', phone: '', email: '', tags: '', status: 'Unknown' });
            setShowEditModal(false);
            showNotification('Contact updated successfully!');
        } catch (error) {
            showNotification('Failed to update contact: ' + error.message, 'error');
        }
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingContact(null);
        setNewContact({ name: '', phone: '', email: '', tags: '', status: 'Unknown' });
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
            const allContactIds = paginatedContacts.map(contact => contact._id);
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
        setPageSize(parsedSize);
        setCurrentPage(1);
    };

    const handleSearchTermChange = (value) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleLastActiveFilterChange = (value) => {
        setLastActiveFilter(value);
        setCurrentPage(1);
    };

    const handleSortOptionChange = (value) => {
        setSortOption(value);
        setCurrentPage(1);
    };

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
                clearSidebarPageCache(CONTACTS_CACHE_NAMESPACE, { currentUserId });
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

    const getAllContacts = () => {
        // Show only database contacts
        let allContacts = contacts.map(c => ({
            ...c,
            sourceType: normalizeSourceType(c),
            lastActive: c.lastContactAt || c.lastContact || c.lastInboundMessageAt || c.updatedAt || c.createdAt,
            whatsappState: getWhatsAppConversationState(c),
            optInStatus: getWhatsAppOptInStatus(c)
        }));
        
        // Apply search filter
        if (searchTerm) {
            allContacts = allContacts.filter(contact =>
                contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                contact.phone?.includes(searchTerm) ||
                contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply last active filter
        if (lastActiveFilter !== 'all') {
            const now = new Date();
            allContacts = allContacts.filter(contact => {
                if (!contact.lastActive) return false;
                
                const lastActiveDate = new Date(contact.lastActive);
                const diffMs = now - lastActiveDate;
                const diffDays = Math.floor(diffMs / 86400000);
                
                switch (lastActiveFilter) {
                    case '1day':
                        return diffDays <= 1;
                    case '2days':
                        return diffDays <= 2;
                    case '1week':
                        return diffDays <= 7;
                    case '1month':
                        return diffDays <= 30;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        switch (sortOption) {
            case 'name-asc':
                allContacts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'name-desc':
                allContacts.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
                break;
            case 'last-active-asc':
                allContacts.sort((a, b) => {
                    if (!a.lastActive) return 1;
                    if (!b.lastActive) return -1;
                    return new Date(a.lastActive) - new Date(b.lastActive);
                });
                break;
            case 'last-active-desc':
                allContacts.sort((a, b) => {
                    if (!a.lastActive) return 1;
                    if (!b.lastActive) return -1;
                    return new Date(b.lastActive) - new Date(a.lastActive);
                });
                break;
            default:
                break;
        }
        
        return allContacts;
    };

    const filteredContacts = useMemo(() => getAllContacts(), [
        contacts,
        searchTerm,
        lastActiveFilter,
        sortOption
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
    const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
    const compactPagination = totalPages > 7;
    const paginatedContacts = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * pageSize;
        return filteredContacts.slice(startIndex, startIndex + pageSize);
    }, [filteredContacts, safeCurrentPage, pageSize]);

    useEffect(() => {
        setCurrentPage((current) => {
            if (filteredContacts.length === 0) return 1;
            return Math.min(Math.max(current, 1), Math.max(1, totalPages));
        });
    }, [filteredContacts.length, totalPages]);

    useEffect(() => {
        const nextParams = buildContactsRouteSearchParams({
            currentPage: safeCurrentPage,
            pageSize,
            searchTerm,
            lastActiveFilter,
            sortOption
        });
        const currentSerialized = searchParams.toString();
        const nextSerialized = nextParams.toString();
        if (currentSerialized !== nextSerialized) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [safeCurrentPage, lastActiveFilter, pageSize, searchParams, searchTerm, setSearchParams, sortOption]);

    return (
        <div className="contacts-page">
            <div className="page-header">
                <div>
                    <h2>Contacts ({loading ? '...' : filteredContacts.length})</h2>
                    <p>Manage your customer database</p>
                </div>
                <div className="header-actions">
                    {selectionMode ? (
                        <>
                            {selectedContacts.size > 0 && (
                                <button 
                                    className="secondary-btn delete-selected" 
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 size={18} />
                                    Delete Selected ({selectedContacts.size})
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
                            <button className="secondary-btn" onClick={() => setShowImportModal(true)}>
                                <Upload size={18} />
                                Import
                            </button>
                            <button className="primary-btn" onClick={() => setShowAddModal(true)}>
                                <UserPlus size={18} />
                                Add Contact
                            </button>
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
                {!selectionMode && (
                    <button 
                        className="secondary-btn select-contacts-btn" 
                        onClick={() => setSelectionMode(true)}
                    >
                        <CheckSquare size={18} />
                        Select Contacts
                    </button>
                )}
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
                ) : filteredContacts.length > 0 ? (
                    <>
                    <table className="contacts-table contacts-desktop-table">
                        <thead>
                            <tr>
                                {selectionMode && (
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={paginatedContacts.length > 0 && paginatedContacts.every((contact) => selectedContacts.has(contact._id))}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                )}
                                <th className="name-col">Name</th>
                                <th className="phone-col">Phone Number</th>
                                <th className="tags-col">Tags</th>
                                <th className="consent-col">Opt-in</th>
                                <th className="origin-col">Origin</th>
                                <th className="messaging-col">Send State</th>
                                <th className="last-active-col">Last Active</th>
                                {!selectionMode && <th className="actions-col">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedContacts.map((contact, index) => (
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
                                    <td className="last-active-col">{formatLastActive(contact.lastActive)}</td>
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
                        {paginatedContacts.map((contact, index) => (
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
                                        <span className="contact-mobile-card__label">Last Active</span>
                                        <span className="contact-mobile-card__value">{formatLastActive(contact.lastActive)}</span>
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
                                    {Math.min(safeCurrentPage * pageSize, filteredContacts.length)}
                                </span>{' '}
                                of{' '}
                                <span className="contacts-pagination__strong">
                                    {filteredContacts.length}
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
                                {searchTerm || lastActiveFilter !== 'all'
                                    ? 'Your search or filters are hiding every contact right now.'
                                    : 'Start by adding your first contact to build your database.'}
                            </p>
                                    {(searchTerm || lastActiveFilter !== 'all') && (
                                <button
                                    className="secondary-btn"
                                    onClick={() => {
                                        handleSearchTermChange('');
                                        handleLastActiveFilterChange('all');
                                        handleSortOptionChange('name-asc');
                                    }}
                                >
                                    Reset Filters
                                </button>
                            )}
                            {!searchTerm && lastActiveFilter === 'all' && (
                                <button className="primary-btn" onClick={() => setShowAddModal(true)}>
                                    <UserPlus size={18} />
                                    Add Your First Contact
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Contact Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-contact-title">
                        <div className="modal-header">
                            <h3 id="add-contact-title">Add New Contact</h3>
                            <button className="close-btn" type="button" aria-label="Close add contact dialog" onClick={() => setShowAddModal(false)}>{"\u00D7"}</button>
                        </div>
                        <div className="modal-body">
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
                            <button className="secondary-btn" onClick={() => setShowAddModal(false)}>
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
        </div>
    );
};

export default Contacts;
