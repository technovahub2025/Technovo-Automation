import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Filter, MoreHorizontal, Edit, Trash2, Phone, MessageCircle, CheckSquare, Square, ChevronDown, ArrowUpDown } from 'lucide-react';
import { apiClient } from '../services/whatsappapi';
import './Contacts.css';

const Contacts = () => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState([]);
    const [conversationContacts, setConversationContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', tags: '' });
    const [openActionMenu, setOpenActionMenu] = useState(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [lastActiveFilter, setLastActiveFilter] = useState('all');
    const [sortOption, setSortOption] = useState('name-asc');

    useEffect(() => {
        loadContacts();
        loadConversationContacts();
    }, []);

    useEffect(() => {
        filterContacts();
    }, [searchTerm, lastActiveFilter, sortOption]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openActionMenu && !event.target.closest('.action-dropdown')) {
                setOpenActionMenu(null);
            }
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
    }, [openActionMenu, showFilterDropdown, showSortDropdown]);

const loadContacts = async () => {
    try {
        const result = await apiClient.getContacts();
        console.log('Contacts API Response:', result); // Debug log
        // Handle different response structures
        const contactsData = result.data?.data || result.data || [];
        console.log('Processed Contacts:', contactsData); // Debug log
        setContacts(Array.isArray(contactsData) ? contactsData : []);
    } catch (error) {
        console.error('Failed to load contacts:', error);
        setContacts([]);
    } finally {
        setLoading(false);
    }
};

  const loadConversationContacts = async () => {
    try {
        const result = await apiClient.getConversationContacts();
        console.log('Conversation Contacts API Response:', result); // Debug log
        const conversationData = result.data?.data || result.data || [];
        setConversationContacts(Array.isArray(conversationData) ? conversationData : []);
    } catch (error) {
        console.error('Failed to load conversation contacts:', error);
        setConversationContacts([]);
    }
};

    const filterContacts = () => {
        // This will be used to filter based on search term and active tab
        // Implementation will be added below
    };

    const handleAddContact = async () => {
        if (!newContact.phone) {
            alert('Phone number is required');
            return;
        }

        try {
            const contactData = {
                ...newContact,
                tags: newContact.tags ? newContact.tags.split(',').map(tag => tag.trim()) : []
            };
            
            const result = await apiClient.createContact(contactData);
            if (result.data.success) {
                await loadContacts();
                setNewContact({ name: '', phone: '', email: '', tags: '' });
                setShowAddModal(false);
                alert('Contact added successfully!');
            }
        } catch (error) {
            alert('Failed to add contact: ' + error.message);
        }
    };

    const handleEditContact = (contact) => {
        setEditingContact(contact);
        setNewContact({
            name: contact.name || '',
            phone: contact.phone || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateContact = async () => {
        if (!editingContact) return;
        
        try {
            const contactData = {
                name: newContact.name,
                phone: newContact.phone
            };
            
            const result = await apiClient.updateContact(editingContact._id, contactData);
            if (result.data.success) {
                await loadContacts();
                setEditingContact(null);
                setNewContact({ name: '', phone: '' });
                setShowEditModal(false);
                alert('Contact updated successfully!');
            }
        } catch (error) {
            alert('Failed to update contact: ' + error.message);
        }
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingContact(null);
        setNewContact({ name: '', phone: '' });
    };

    const handleDeleteContact = async (contact) => {
        if (!window.confirm(`Are you sure you want to delete ${contact.name || contact.phone}?`)) {
            return;
        }

        try {
            const result = await apiClient.deleteContact(contact._id);
            if (result.data.success) {
                await loadContacts();
                alert('Contact deleted successfully!');
            }
        } catch (error) {
            alert('Failed to delete contact: ' + error.message);
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
            alert('Please select at least one contact to delete');
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
            await loadContacts();
            setSelectedContacts(new Set());
            alert(`${selectedContacts.size} contact(s) deleted successfully!`);
        } catch (error) {
            alert('Failed to delete some contacts: ' + error.message);
        }
    };

    const handleMessage = (contact) => {
        // Navigate to team inbox with the contact's phone number
        navigate('/inbox', { state: { phoneNumber: contact.phone, contactName: contact.name } });
        setOpenActionMenu(null); // Close menu after action
    };

    const handleActionMenuClick = (contactId, event) => {
        event.stopPropagation();
        setOpenActionMenu(openActionMenu === contactId ? null : contactId);
    };

    const handleActionClick = (action, contact) => {
        action(contact);
        setOpenActionMenu(null);
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

    const getAllContacts = () => {
        // Show only database contacts
        let allContacts = contacts.map(c => ({
            ...c,
            source: 'database',
            status: c.isBlocked ? 'Opted-out' : 'Opted-in',
            lastActive: c.lastContact
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
                            <button className="secondary-btn">Import</button>
                            <button className="primary-btn" onClick={() => setShowAddModal(true)}>
                                <UserPlus size={18} />
                                Add Contact
                            </button>
                        </>
                    )}
                </div>
            </div>

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
                    <div className="loading">Loading contacts...</div>
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
                                <th>Last Active</th>
                                {!selectionMode && <th>Actions</th>}
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
                                        <span className={`badge ${contact.status === 'Opted-in' ? 'active' : 'inactive'}`}>
                                            {contact.status}
                                        </span>
                                    </td>
                                    <td>{formatLastActive(contact.lastActive)}</td>
                                    {!selectionMode && (
                                        <td>
                                            <div className="action-buttons">
                                                <div className="action-dropdown">
                                                    <button 
                                                        className="action-btn" 
                                                        title="More"
                                                        onClick={(e) => handleActionMenuClick(contact._id, e)}
                                                    >
                                                        <MoreHorizontal size={16} />
                                                    </button>
                                                    {openActionMenu === contact._id && (
                                                        <div className="dropdown-menu">
                                                            <button 
                                                                className="dropdown-item" 
                                                                onClick={() => handleActionClick(handleEditContact, contact)}
                                                            >
                                                                <Edit size={14} />
                                                                Edit
                                                            </button>
                                                            <button 
                                                                className="dropdown-item delete" 
                                                                onClick={() => handleActionClick(handleDeleteContact, contact)}
                                                            >
                                                                <Trash2 size={14} />
                                                                Delete
                                                            </button>
                                                            <button 
                                                                className="dropdown-item" 
                                                                onClick={() => handleActionClick(() => {}, contact)}
                                                            >
                                                                <Phone size={14} />
                                                                Call
                                                            </button>
                                                            <button 
                                                                className="dropdown-item" 
                                                                onClick={() => handleActionClick(handleMessage, contact)}
                                                            >
                                                                <MessageCircle size={14} />
                                                                Message
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
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
        </div>
    );
};

export default Contacts;
