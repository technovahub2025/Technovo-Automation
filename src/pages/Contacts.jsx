import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Filter, Edit, Trash2, MessageCircle, Send, CheckSquare, Square, ChevronDown, ArrowUpDown, Upload, Download, X, FileText, Copy, ExternalLink } from 'lucide-react';
import { apiClient } from '../services/whatsappapi';
import WhatsAppOptInModal from '../components/WhatsAppOptInModal';
import WhatsAppConsentAuditModal from '../components/WhatsAppConsentAuditModal';
import { startLoadingTimeoutGuard } from '../utils/loadingGuard';
import { buildPublicWhatsAppOptInDemoUrl, buildWhatsAppOutreachState } from '../utils/whatsappOutreachNavigation';
import { getWhatsAppConversationState } from '../utils/whatsappContactState';
import {
    readSidebarPageCache,
    resolveCacheUserId,
    writeSidebarPageCache
} from '../utils/sidebarPageCache';
import './Contacts.css';

const CONTACTS_LOADING_TIMEOUT_MS = 8000;
const CONTACTS_CACHE_TTL_MS = 10 * 60 * 1000;
const CONTACTS_CACHE_NAMESPACE = 'contacts-page';

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

const Contacts = () => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', tags: '', status: 'Unknown' });
    const [selectionMode, setSelectionMode] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [lastActiveFilter, setLastActiveFilter] = useState('all');
    const [sortOption, setSortOption] = useState('name-asc');
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
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
    }, [currentUserId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFilterDropdown && !event.target.closest('.filter-dropdown')) {
                setShowFilterDropdown(false);
            }
            if (showSortDropdown && !event.target.closest('.sort-dropdown')) {
                setShowSortDropdown(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showFilterDropdown, showSortDropdown]);

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
        if (!newContact.phone) {
            showNotification('Phone number is required', 'error');
            return;
        }

        try {
            const contactData = {
                ...newContact,
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
        const whatsappState = getWhatsAppConversationState(contact);
        setEditingContact(contact);
        setNewContact({
            name: contact.name || '',
            phone: contact.phone || '',
            tags: Array.isArray(contact.tags) ? contact.tags.join(', ') : '',
            status:
                whatsappState.normalizedOptInStatus === 'opted_out'
                    ? 'Opted-out'
                    : whatsappState.normalizedOptInStatus === 'opted_in'
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
            const existingWhatsappState = getWhatsAppConversationState(editingContact);
            const nextWhatsappOptInStatus =
                newContact.status === 'Opted-out'
                    ? 'opted_out'
                    : newContact.status === 'Opted-in'
                        ? 'opted_in'
                        : 'unknown';

            if (
                nextWhatsappOptInStatus === 'opted_in' &&
                existingWhatsappState.normalizedOptInStatus !== 'opted_in'
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
                phone: newContact.phone,
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
            const allContactIds = displayedContacts.map(contact => contact._id);
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
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins} mins ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${diffDays} days ago`;
    };

    const normalizeSourceType = (contact) => {
        const raw = (contact?.sourceType || contact?.source || '').toString().toLowerCase();
        if (raw === 'incoming_message' || raw === 'message' || raw === 'conversation') return 'incoming_message';
        if (raw === 'imported' || raw === 'import') return 'imported';
        if (raw === 'public_opt_in' || raw === 'landing_page' || raw === 'qr_page' || raw === 'contacts_share') return 'public_opt_in';
        if (raw === 'meta_lead_ads' || raw === 'meta_lead') return 'meta_lead_ads';
        return 'manual';
    };

    const sourceLabelMap = {
        manual: 'User Created',
        imported: 'CSV Import',
        incoming_message: 'Message',
        public_opt_in: 'Public Opt-In',
        meta_lead_ads: 'Meta Lead Ad'
    };

    // Import functions
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImportFile(file);
            parseCSVFile(file);
        }
    };

    const parseCSVFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                showNotification('CSV file must contain at least a header row and one data row', 'error');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const data = lines.slice(1).map((line, index) => {
                const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
                const row = { lineNumber: index + 2 };
                headers.forEach((header, i) => {
                    row[header] = values[i] || '';
                });
                return row;
            });

            setImportPreview(data.slice(0, 5)); // Show first 5 rows for preview
            setImportStep('mapping');
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
        if (importPreview.length === 0) return [];
        return Object.keys(importPreview[0]).filter(key => key !== 'lineNumber');
    };

    const getMappedContacts = () => {
        return importPreview.map(row => {
            const contact = {};
            
            // Map fields based on user selection
            Object.keys(importMapping).forEach(field => {
                const sourceField = importMapping[field];
                if (sourceField && row[sourceField] !== undefined) {
                    switch (field) {
                        case 'name':
                            // Combine first and last name if available
                            const firstName = row[sourceField] || '';
                            const lastNameField = importMapping['lastName'];
                            const lastName = lastNameField ? (row[lastNameField] || '') : '';
                            contact[field] = [firstName, lastName].filter(Boolean).join(' ').trim();
                            break;
                        case 'phone':
                            // Clean phone number
                            let phone = row[sourceField] || '';
                            phone = phone.replace(/[^0-9+]/g, '');
                            if (!phone.startsWith('+') && phone.length > 0) {
                                phone = '+' + phone;
                            }
                            contact[field] = phone;
                            break;
                        case 'email':
                            contact[field] = row[sourceField] || '';
                            break;
                        case 'tags':
                            // Split tags by comma
                            const tags = row[sourceField] || '';
                            contact[field] = tags.split(',').map(tag => tag.trim()).filter(Boolean);
                            break;
                        case 'status':
                            contact[field] = row[sourceField] || 'Opted-in';
                            break;
                        case 'listName':
                            contact[field] = row[sourceField] || '';
                            break;
                        default:
                            // Handle custom attributes
                            if (field.startsWith('custom_attribute_')) {
                                contact[field] = row[sourceField] || '';
                            }
                            break;
                    }
                }
            });

            return contact;
        }).filter(contact => contact.phone); // Only include contacts with phone numbers
    };

    const handleImportContacts = async () => {
        const mappedContacts = getMappedContacts();
        
        if (mappedContacts.length === 0) {
            showNotification('No valid contacts to import', 'error');
            return;
        }

        try {
            setLoading(true);
            const result = await apiClient.importContacts(mappedContacts);
            
            if (result.data.success) {
                showNotification(`Successfully imported ${mappedContacts.length} contacts!`);
                setShowImportModal(false);
                setImportFile(null);
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
        const csvContent = `First Name,Last Name,WhatsApp Number,Email,Status,List Name,Tags,custom_attribute_1,custom_attribute_2,custom_attribute_3
John,Doe,+1234567890,john@example.com,Opted-in,Main List,"VIP, Lead",Custom1,Custom2,Custom3
Jane,Smith,+9876543210,jane@example.com,Opted-in,Secondary List,"Regular, Support",Value1,Value2,Value3`;
        
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
        setImportPreview([]);
        setImportMapping({});
        setImportStep('upload');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getAllContacts = () => {
        // Show only database contacts
        let allContacts = contacts.map(c => ({
            ...c,
            sourceType: normalizeSourceType(c),
            lastActive: c.lastContact,
            whatsappState: getWhatsAppConversationState(c)
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

    const displayedContacts = getAllContacts();
    return (
        <div className="contacts-page">
            <div className="page-header">
                <div>
                    <h2>Contacts ({displayedContacts.length})</h2>
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
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-dropdown">
                    <button 
                        className="icon-btn" 
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        title="Filter by last active"
                    >
                        <Filter size={18} />
                    </button>
                    {showFilterDropdown && (
                        <div className="filter-menu">
                            <div className="filter-section">
                                <h4>Last Active</h4>
                                <div className="filter-options">
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="all"
                                            checked={lastActiveFilter === 'all'}
                                            onChange={(e) => setLastActiveFilter(e.target.value)}
                                        />
                                        All Time
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1day"
                                            checked={lastActiveFilter === '1day'}
                                            onChange={(e) => setLastActiveFilter(e.target.value)}
                                        />
                                        Last 1 Day
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="2days"
                                            checked={lastActiveFilter === '2days'}
                                            onChange={(e) => setLastActiveFilter(e.target.value)}
                                        />
                                        Last 2 Days
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1week"
                                            checked={lastActiveFilter === '1week'}
                                            onChange={(e) => setLastActiveFilter(e.target.value)}
                                        />
                                        Last 1 Week
                                    </label>
                                    <label className="filter-option">
                                        <input
                                            type="radio"
                                            name="lastActive"
                                            value="1month"
                                            checked={lastActiveFilter === '1month'}
                                            onChange={(e) => setLastActiveFilter(e.target.value)}
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
                    >
                        <ArrowUpDown size={18} />
                    </button>
                    {showSortDropdown && (
                        <div className="sort-menu">
                            <div className="sort-section">
                                <h4>Sort By</h4>
                                <div className="sort-options">
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="name-asc"
                                            checked={sortOption === 'name-asc'}
                                            onChange={(e) => setSortOption(e.target.value)}
                                        />
                                        Name (A-Z)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="name-desc"
                                            checked={sortOption === 'name-desc'}
                                            onChange={(e) => setSortOption(e.target.value)}
                                        />
                                        Name (Z-A)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="last-active-asc"
                                            checked={sortOption === 'last-active-asc'}
                                            onChange={(e) => setSortOption(e.target.value)}
                                        />
                                        Last Active (Oldest First)
                                    </label>
                                    <label className="sort-option">
                                        <input
                                            type="radio"
                                            name="sort"
                                            value="last-active-desc"
                                            checked={sortOption === 'last-active-desc'}
                                            onChange={(e) => setSortOption(e.target.value)}
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
                        {Array.from({ length: 6 }, (_, index) => (
                            <div key={`contacts-skeleton-${index}`} className="contacts-skeleton-row" />
                        ))}
                    </div>
                ) : displayedContacts.length > 0 ? (
                    <table className="contacts-table">
                        <thead>
                            <tr>
                                {selectionMode && (
                                    <th>
                                        <input 
                                            type="checkbox" 
                                            checked={displayedContacts.length > 0 && selectedContacts.size === displayedContacts.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                        />
                                    </th>
                                )}
                                <th>Name</th>
                                <th>Phone Number</th>
                                <th>Tags</th>
                                <th>Status</th>
                                <th>Source</th>
                                <th>Last Active</th>
                                {!selectionMode && <th className="actions-col">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {displayedContacts.map((contact, index) => (
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
                                    <td>
                                        <div className="contact-name-cell">
                                            <span className="contact-name">{contact.name}</span>
                                            {contact.email && <span className="contact-email">{contact.email}</span>}
                                        </div>
                                    </td>
                                    <td>{contact.phone}</td>
                                    <td>
                                        {contact.tags && contact.tags.length > 0 ? (
                                            contact.tags.map((tag, tagIndex) => (
                                                <span key={tagIndex} className="tag blue">{tag}</span>
                                            ))
                                        ) : (
                                            <span className="tag gray">No tags</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="whatsapp-contact-status">
                                            <span className={`badge whatsapp-contact-badge whatsapp-contact-badge--${contact.whatsappState?.badgeTone || 'template-only'}`}>
                                                {contact.whatsappState?.statusLabel || 'Template Only'}
                                            </span>
                                            {contact.whatsappOptInSource ? (
                                                <span className="whatsapp-contact-audit">
                                                    {contact.whatsappOptInSource}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`source-badge ${contact.sourceType || 'manual'}`}>
                                            {sourceLabelMap[contact.sourceType || 'manual'] || 'Manual'}
                                        </span>
                                    </td>
                                    <td>{formatLastActive(contact.lastActive)}</td>
                                    {!selectionMode && (
                                        <td className="actions-col">
                                            <div className="action-buttons">
                                                <button
                                                    className="action-btn"
                                                    title="Message"
                                                    onClick={() => handleMessage(contact)}
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                                <button
                                                    className="action-btn action-btn--template"
                                                    title="Send Template"
                                                    onClick={() => handleStartWhatsAppTemplate(contact)}
                                                    disabled={contact.whatsappState?.optedOut}
                                                >
                                                    <Send size={16} />
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    title="View Consent Audit"
                                                    onClick={() => openConsentAuditModal(contact)}
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    title="Copy Public Opt-In Link"
                                                    onClick={() => copyPublicOptInLink(contact)}
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    className="action-btn"
                                                    title="Open Public Opt-In Page"
                                                    onClick={() => openPublicOptInLink(contact)}
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                                {contact.whatsappState?.optedOut ? (
                                                    <button
                                                        className="action-btn"
                                                        title="Mark Opted In"
                                                        onClick={() => openWhatsAppOptInModal(contact)}
                                                    >
                                                        <CheckSquare size={16} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="action-btn"
                                                        title="Mark Opted Out"
                                                        onClick={() => handleMarkWhatsAppOptOut(contact)}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    className="action-btn"
                                                    title="Edit"
                                                    onClick={() => handleEditContact(contact)}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    title="Delete"
                                                    onClick={() => handleDeleteContact(contact)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="no-contacts">
                        <div className="no-contacts-content">
                            <UserPlus size={48} />
                            <h3>No contacts found</h3>
                            <p>
                                {searchTerm ? 'Try adjusting your search terms' : 'Start by adding your first contact'}
                            </p>
                            {!searchTerm && (
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
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add New Contact</h3>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
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
                                New contacts start with WhatsApp status as <strong>Unknown</strong>. Capture proof with
                                <strong> Mark Opted In</strong> after consent is collected.
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
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Edit Contact</h3>
                            <button className="close-btn" onClick={handleCloseEditModal}>×</button>
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
                                <label>Tags</label>
                                <input
                                    type="text"
                                    value={newContact.tags}
                                    onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                                    placeholder="VIP, Lead, Support (comma separated)"
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={newContact.status || 'Unknown'}
                                    onChange={(e) => handleEditContactStatusChange(e.target.value)}
                                >
                                    <option value="Unknown">Unknown</option>
                                    <option
                                        value="Opted-in"
                                        disabled={newContact.status !== 'Opted-in'}
                                    >
                                        Opted-in
                                    </option>
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
                    <div className="modal import-modal">
                        <div className="modal-header">
                            <h3>Import Contacts</h3>
                            <button className="close-btn" onClick={resetImport}>×</button>
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
                                            <li><strong>Status</strong> - Opted-in, Opted-out, or Unknown</li>
                                            <li><strong>List Name</strong> - Contact list name (optional)</li>
                                            <li><strong>Tags</strong> - Comma-separated tags (optional)</li>
                                            <li><strong>custom_attribute_1,2,3</strong> - Custom fields (optional)</li>
                                        </ul>
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
                                                    <td>Status</td>
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
