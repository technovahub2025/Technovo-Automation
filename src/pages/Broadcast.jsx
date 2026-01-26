import React, { useState, useEffect } from 'react';
import {
  Plus,
  Clock,
  CheckCircle,
  Calendar,
  Users,
  FileText,
  Upload,
  Send,
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
} from 'lucide-react';

import { api } from '../services/api';
import './Broadcast.css';
import '../styles/whatsapp.css';
import '../styles/message-preview.css';
import whatsappLogo from '../assets/WhatsApp.svg.webp';

const Broadcast = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [messageType, setMessageType] = useState('template');

  const [officialTemplates, setOfficialTemplates] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [templateName, setTemplateName] = useState('');
  const [language, setLanguage] = useState('en_US');

  const [broadcasts, setBroadcasts] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);

  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);

  const [customMessage, setCustomMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // Search / filter / sort
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Local template
  const [selectedLocalTemplate, setSelectedLocalTemplate] = useState('');

  // Campaign name
  const [broadcastName, setBroadcastName] = useState('');

  // Variables
  const [templateVariables, setTemplateVariables] = useState([]);
  const [fileVariables, setFileVariables] = useState([]);

  // ✅ Load templates + broadcasts once
  useEffect(() => {
    loadTemplates();
    loadBroadcasts();
  }, []);

  // ✅ Fetch official templates only when template mode
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await api.getTemplates();
        setOfficialTemplates(
          Array.isArray(response.data) ? response.data : response.data.data || []
        );
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        setOfficialTemplates([]);
      }
    };

    if (messageType === 'template') {
      fetchTemplates();
    }
  }, [messageType]);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowDropdown(null);
      }
      if (showFilterDropdown && !event.target.closest('.filter-dropdown')) {
        setShowFilterDropdown(false);
      }
      if (showSortDropdown && !event.target.closest('.sort-dropdown')) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showFilterDropdown, showSortDropdown]);

  const loadTemplates = async () => {
    try {
      const result = await api.getTemplates();
      const allTemplates = result.data.data || [];
      const customTemplates = allTemplates.filter((t) => t.type === 'custom');
      setTemplates(customTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadBroadcasts = async () => {
    try {
      const result = await api.getBroadcasts();
      setBroadcasts(result.data.data || []);
    } catch (error) {
      console.error('Failed to load broadcasts:', error);
    }
  };

  // ✅ Filter & Sort
  const getFilteredAndSortedBroadcasts = () => {
    let filtered = [...broadcasts];

    if (searchTerm) {
      filtered = filtered.filter((b) =>
        b.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => b.status === statusFilter);
    }

    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'createdAt' || sortBy === 'scheduledAt' || sortBy === 'completedAt') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (sortOrder === 'asc') return aValue > bValue ? 1 : -1;
      return aValue < bValue ? 1 : -1;
    });

    return filtered;
  };

  // ✅ Pagination
  const filteredBroadcasts = getFilteredAndSortedBroadcasts();
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBroadcasts = filteredBroadcasts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBroadcasts.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getStatusClass = (status) => {
    switch (status) {
      case 'draft':
        return 'draft';
      case 'scheduled':
        return 'scheduled';
      case 'sending':
        return 'ongoing';
      case 'completed':
        return 'success';
      case 'paused':
        return 'paused';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'draft';
    }
  };

  // ✅ Sync stats
  const syncAllBroadcastStats = async () => {
    try {
      const completedBroadcasts = broadcasts.filter((b) => b.status === 'completed');
      for (const broadcast of completedBroadcasts) {
        try {
          await api.syncBroadcastStats(broadcast._id);
        } catch (error) {
          console.warn(`Failed to sync stats for ${broadcast._id}`, error);
        }
      }
      await loadBroadcasts();
    } catch (error) {
      console.error('Failed to sync broadcast stats:', error);
    }
  };

  // ✅ Dropdown actions
  const handleDropdownToggle = (campaignId, event) => {
    event.stopPropagation();
    setShowDropdown(showDropdown === campaignId ? null : campaignId);
  };

  const handleSelectCampaign = () => {
    setSelectionMode(true);
    setSelectedCampaigns([]);
    setShowDropdown(null);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedCampaigns([]);
  };

  const handleCheckboxChange = (campaignId, event) => {
    event.stopPropagation();
    if (event.target.checked) {
      setSelectedCampaigns((prev) => [...prev, campaignId]);
    } else {
      setSelectedCampaigns((prev) => prev.filter((id) => id !== campaignId));
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allIds = currentBroadcasts.map((b) => b._id);
      setSelectedCampaigns(allIds);
    } else {
      setSelectedCampaigns([]);
    }
  };

  const handleDeleteClick = (campaign) => {
    setSelectedCampaigns([campaign._id]);
    setShowDeleteModal(true);
    setShowDropdown(null);
  };

  const handleBulkDelete = () => {
    if (selectedCampaigns.length === 0) return;
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedCampaigns.length === 0) return;

    try {
      await Promise.all(selectedCampaigns.map((id) => api.deleteBroadcast(id)));
      setBroadcasts((prev) => prev.filter((b) => !selectedCampaigns.includes(b._id)));

      setShowDeleteModal(false);
      setSelectedCampaigns([]);
      setSelectionMode(false);
    } catch (error) {
      console.error('Failed to delete campaigns:', error);
      alert('Failed to delete campaigns. Please try again.');
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  // Handle local template selection
  const handleLocalTemplateSelect = (templateName) => {
    setSelectedLocalTemplate(templateName);
    
    if (templateName) {
      const selectedTemplate = templates.find(t => t.name === templateName);
      if (selectedTemplate) {
        // Handle both string content and object content
        let contentString = '';
        if (typeof selectedTemplate.content === 'string') {
          contentString = selectedTemplate.content;
        } else if (selectedTemplate.content && selectedTemplate.content.body) {
          contentString = selectedTemplate.content.body;
        } else if (selectedTemplate.components) {
          // Extract text from components if available
          const bodyComponent = selectedTemplate.components.find(comp => comp.type === 'BODY');
          if (bodyComponent && bodyComponent.text) {
            contentString = bodyComponent.text;
          }
        }
        
        setCustomMessage(contentString);
        // Extract variables from the content string
        extractTemplateVariables(contentString);
      }
    } else {
      setCustomMessage('');
      setTemplateVariables([]);
    }
  };

  // Handle template name change
  const handleTemplateNameChange = (e) => {
    const selectedTemplateName = e.target.value;
    setTemplateName(selectedTemplateName);
    
    // Find the selected template
    const selectedTemplate = officialTemplates.find(t => t.name === selectedTemplateName);
    
    if (selectedTemplate) {
      // If template has content, extract variables from it
      if (selectedTemplate.content?.body) {
        extractTemplateVariables(selectedTemplate.content.body);
      } else if (selectedTemplate.components) {
        // Try to find the BODY component
        const bodyComponent = selectedTemplate.components.find(
          comp => comp.type === 'BODY' && comp.text
        );
        if (bodyComponent) {
          extractTemplateVariables(bodyComponent.text);
        }
      }
    } else {
      // Reset variables if no template is selected
      setTemplateVariables([]);
    }
  };

  // ✅ Variables Extract / Match
  const extractTemplateVariables = (content) => {
    if (!content || typeof content !== 'string') {
      setTemplateVariables([]);
      return;
    }

    // Support both {{1}} and {var1} formats like the Python reference
    const numberedVars = content.match(/\{\{\d+\}\}/g) || [];
    const namedVars = content.match(/\{var\d+\}/g) || [];

    const uniqueVars = [...new Set([...numberedVars, ...namedVars])];
    setTemplateVariables(uniqueVars);
  };

  // ✅ Upload CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result.split(',')[1];

      try {
        const result = await api.uploadCSV({ csvData: base64Data });

        if (result.data.success) {
          const recipientsWithFullData = result.data.csvData || result.data.recipients || [];
          setRecipients(recipientsWithFullData);

          if (recipientsWithFullData.length > 0) {
            const firstRecipient = recipientsWithFullData[0];
            const fileVarKeys = Object.keys(firstRecipient).filter(
              (key) => key.toLowerCase().startsWith('var') && firstRecipient[key] != null
            );

            setFileVariables(fileVarKeys);
          }
        } else {
          alert('Failed to process CSV: ' + (result.data.error || result.data.message));
        }
      } catch (error) {
        alert('Failed to upload CSV: ' + error.message);
      }
    };

    reader.readAsDataURL(file);
  };

  // ✅ Create broadcast (Scheduled)
  const createBroadcast = async () => {
    if (!broadcastName || !recipients.length) {
      alert('Please provide a campaign name and upload recipients');
      return;
    }

    try {
      const payload = {
        name: broadcastName,
        messageType,
        recipients,
        ...(messageType === 'template' ? { templateName, language } : { customMessage }),
        ...(scheduledTime ? { scheduledAt: scheduledTime } : {}),
      };

      const result = await api.createBroadcast(payload);

      if (result.data.success) {
        alert(scheduledTime ? 'Broadcast scheduled successfully!' : 'Broadcast created successfully!');
        await loadBroadcasts();

        setBroadcastName('');
        setTemplateName('');
        setCustomMessage('');
        setScheduledTime('');
      } else {
        alert('Failed: ' + (result.data.error || result.data.message));
      }
    } catch (error) {
      alert('Failed to create broadcast: ' + error.message);
    }
  };

  // ✅ Send scheduled broadcast now
  const executeBroadcast = async (broadcastId) => {
    try {
      const result = await api.sendBroadcast(broadcastId);
      if (result.data.success) {
        alert('Broadcast sent successfully!');
        await loadBroadcasts();
      } else {
        alert('Failed to send broadcast: ' + (result.data.error || result.data.message));
      }
    } catch (error) {
      alert('Failed to send broadcast: ' + error.message);
    }
  };

  // ✅ Send immediately (bulk) - matching Python reference functionality
  const handleSendBroadcast = async () => {
    if (!recipients.length) {
      alert('Please upload a CSV file with recipients');
      return;
    }

    setIsSending(true);

    try {
      // Process recipients with variables like Python reference
      const processedRecipients = recipients.map(recipient => {
        const processedRecipient = {
          phone: recipient.phone,
          variables: recipient.variables || []
        };
        
        // Include full data for named variable processing
        processedRecipient.data = recipient.data || recipient;
        
        return processedRecipient;
      });

      const payload = {
        messageType,
        recipients: processedRecipients,
        ...(messageType === 'template' ? { templateName, language } : { customMessage }),
      };

      const result = await api.sendBulkMessages(payload);
      setSendResults(result.data);

      if (result.data.success) {
        alert(`Campaign sent! ${result.data.successful || result.data.total_sent || 0} delivered.`);
      } else {
        alert('Failed to send: ' + (result.data.error || result.data.message));
      }
    } catch (error) {
      alert('Failed to send campaign: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  // ✅ Preview helpers
  const getTemplatePreview = () => {
    if (!templateName) return 'Select a template';

    const templateMessages = {
      hello_world: 'Hello World! This is a sample template message.',
      welcome_message: 'Welcome {{1}}! Thank you for joining our service.',
      promotion: 'Hi {{1}}, get {{2}} off on your next purchase! Use code: {{3}}',
    };

    return templateMessages[templateName] || `Template: ${templateName}`;
  };

  const getMessagePreview = () => {
    if (!customMessage) return 'Enter your custom message';
    return customMessage;
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getCurrentPhoneTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="broadcast-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>Broadcasts</h2>
          <p>Manage your bulk message campaigns</p>
        </div>

        {activeTab === 'overview' && (
          <button className="primary-btn" onClick={() => setActiveTab('schedule')}>
            <Plus size={18} />
            New Broadcast
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="broadcast-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule Broadcast
        </button>
      </div>

      {/* ✅ Main UI */}
      {activeTab === 'overview' ? (
        <>
          {/* Stats */}
          <div className="broadcast-stats">
            <div className="stat-box">
              <span className="label">Total Campaigns</span>
              <span className="value">{broadcasts.length}</span>
            </div>
            <div className="stat-box">
              <span className="label">Total Sent</span>
              <span className="value">{broadcasts.reduce((sum, b) => sum + (b.stats?.sent || 0), 0)}</span>
            </div>
            <div className="stat-box">
              <span className="label">Total Delivered</span>
              <span className="value">
                {broadcasts.reduce((sum, b) => sum + (b.stats?.delivered || 0), 0)}
              </span>
            </div>
            <div className="stat-box">
              <span className="label">Total Read</span>
              <span className="value">{broadcasts.reduce((sum, b) => sum + (b.stats?.read || 0), 0)}</span>
            </div>
          </div>

          {/* History */}
          <div className="history-section">
            <div className="section-header">
              <h3>Recent Campaigns</h3>

              <div className="bulk-actions">
                {selectionMode ? (
                  <div className="selection-mode-actions">
                    <span className="selected-count">
                      {selectedCampaigns.length} campaign{selectedCampaigns.length !== 1 ? 's' : ''} selected
                    </span>

                    <button className="bulk-delete-btn" onClick={handleBulkDelete} disabled={selectedCampaigns.length === 0}>
                      <Trash2 size={14} />
                      Delete Selected
                    </button>

                    <button className="exit-selection-btn" onClick={handleExitSelectionMode}>
                      Exit Selection
                    </button>
                  </div>
                ) : (
                  <button className="select-campaign-btn" onClick={handleSelectCampaign}>
                    <Users size={16} />
                    Select Campaign
                  </button>
                )}

                <button className="sync-btn" onClick={syncAllBroadcastStats} title="Sync all broadcast stats from team inbox">
                  <RefreshCw size={16} />
                  Sync Stats
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="campaign-controls">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="filter-dropdown">
                <button className="icon-btn" onClick={() => setShowFilterDropdown(!showFilterDropdown)} title="Filter campaigns">
                  <Filter size={18} />
                </button>

                {showFilterDropdown && (
                  <div className="filter-menu">
                    <div className="filter-section">
                      <h4>Status</h4>
                      <div className="filter-options">
                        {['all', 'scheduled', 'sending', 'completed'].map((status) => (
                          <label className="filter-option" key={status}>
                            <input
                              type="radio"
                              name="status"
                              value={status}
                              checked={statusFilter === status}
                              onChange={(e) => setStatusFilter(e.target.value)}
                            />
                            {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="sort-dropdown">
                <button className="icon-btn" onClick={() => setShowSortDropdown(!showSortDropdown)} title="Sort campaigns">
                  <ArrowUpDown size={18} />
                </button>

                {showSortDropdown && (
                  <div className="sort-menu">
                    <div className="sort-section">
                      <h4>Sort By</h4>
                      <div className="sort-options">
                        {[
                          { value: 'createdAt', label: 'Created Date' },
                          { value: 'name', label: 'Name' },
                          { value: 'status', label: 'Status' },
                          { value: 'recipientCount', label: 'Recipients' },
                        ].map((opt) => (
                          <label className="sort-option" key={opt.value}>
                            <input type="radio" name="sort" value={opt.value} checked={sortBy === opt.value} onChange={(e) => setSortBy(e.target.value)} />
                            {opt.label}
                          </label>
                        ))}
                      </div>

                      <div style={{ paddingTop: 8 }}>
                        <button
                          className="icon-btn"
                          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                          title="Toggle sort order"
                        >
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            {broadcasts.length > 0 ? (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      {selectionMode && (
                        <th className="checkbox-column">
                          <input
                            type="checkbox"
                            onChange={handleSelectAll}
                            checked={currentBroadcasts.length > 0 && selectedCampaigns.length === currentBroadcasts.length}
                          />
                        </th>
                      )}
                      <th>Campaign Name</th>
                      <th>Status</th>
                      <th>Scheduled Time</th>
                      <th>Recipients</th>
                      <th>Sent</th>
                      <th>Read</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {currentBroadcasts.map((broadcast) => (
                      <tr key={broadcast._id}>
                        {selectionMode && (
                          <td className="checkbox-column">
                            <input
                              type="checkbox"
                              checked={selectedCampaigns.includes(broadcast._id)}
                              onChange={(e) => handleCheckboxChange(broadcast._id, e)}
                            />
                          </td>
                        )}

                        <td>{broadcast.name}</td>

                        <td>
                          <span className={`badge ${getStatusClass(broadcast.status)}`}>{broadcast.status}</span>
                        </td>

                        <td>
                          {broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toLocaleString() : 'Immediate'}
                        </td>

                        <td>{broadcast.recipientCount || broadcast.recipients?.length || 0}</td>
                        <td>{broadcast.stats?.sent || 0}</td>

                        <td>
                          <span className={`read-count ${broadcast.stats?.read > 0 ? 'has-reads' : ''}`}>
                            {broadcast.stats?.read || 0}
                          </span>
                        </td>

                        <td>
                          <div className="action-buttons">
                            {broadcast.status === 'scheduled' && (
                              <button className="action-btn" title="Send Now" onClick={() => executeBroadcast(broadcast._id)}>
                                <Send size={14} />
                              </button>
                            )}

                            <div className="broadcast-container dropdown-container">
                              <button className="action-btn" title="More options" onClick={(e) => handleDropdownToggle(broadcast._id, e)}>
                                <MoreHorizontal size={14} />
                              </button>

                              {showDropdown === broadcast._id && (
                                <div className="dropdown-menu">
                                  <button className="dropdown-item delete" onClick={() => handleDeleteClick(broadcast)}>
                                    <Trash2 size={14} />
                                    Delete Campaign
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {broadcasts.length > itemsPerPage && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, broadcasts.length)} of {broadcasts.length} campaigns
                    </div>

                    <div className="pagination-controls">
                      <button className="pagination-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <div className="pagination-info-text">Page {currentPage} of {totalPages}</div>

                      <button className="pagination-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="no-campaigns">
                <div className="no-campaigns-content">
                  <FileText size={48} />
                  <h3>No campaigns found</h3>
                  <p>Start by creating your first broadcast campaign</p>
                  <button className="primary-btn" onClick={() => setActiveTab('schedule')}>
                    <Plus size={18} />
                    Create Campaign
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ✅ Schedule UI (only once) */
        <div className="schedule-form-container">
          <div className="campaign-config-wrapper">
            <div className="form-section">
              <h3>Configure WhatsApp Campaign</h3>

              <div className="form-group">
                <label>Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Diwali Promo 2024"
                  value={broadcastName}
                  onChange={(e) => setBroadcastName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Message Type</label>
                <div className="message-type-options">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="message_type"
                      value="template"
                      checked={messageType === 'template'}
                      onChange={(e) => setMessageType(e.target.value)}
                    />
                    <span>
                      <CheckCircle size={14} /> WhatsApp Template
                    </span>
                  </label>

                  <label className="radio-option">
                    <input
                      type="radio"
                      name="message_type"
                      value="text"
                      checked={messageType === 'text'}
                      onChange={(e) => setMessageType(e.target.value)}
                    />
                    <span>
                      <FileText size={14} /> Custom Text Message
                    </span>
                  </label>
                </div>
              </div>

              {messageType === 'template' ? (
                <>
                  <div className="form-group">
                    <label>
                      <CheckCircle size={16} /> Template Name
                    </label>

                    <select value={templateName} onChange={handleTemplateNameChange}>
                      <option value="">Select template...</option>
                      {officialTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name} ({template.language}) - {template.status}
                        </option>
                      ))}
                    </select>

                    <small>These are your approved templates from WhatsApp Business Manager</small>
                  </div>

                  <div className="form-group">
                    <label>Language Code</label>
                    <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en_US" />
                    <small>Must match the template's approved language</small>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>
                      <FileText size={16} /> Custom Message
                    </label>

                    <div className="whatsapp-message-input">
                      <textarea
                        placeholder="Type your message here..."
                        value={customMessage}
                        onChange={(e) => {
                          if (e.target.value.length <= 1000) setCustomMessage(e.target.value);
                        }}
                        rows={4}
                        className="message-textarea"
                        maxLength={1000}
                      />

                      <div className="message-input-footer">
                        <span className="char-count">{customMessage.length}/1000</span>
                        <div className="message-actions">
                          <span className="action-icon">😊</span>
                          <span className="action-icon">📎</span>
                        </div>
                      </div>
                    </div>

                    <small>
                      Use {'{var1}'}, {'{var2}'} or {'{{1}}'}, {'{{2}}'} for variables from CSV.
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Or use saved local template:</label>
                    <div className="template-selector">
                      <select
                        value={selectedLocalTemplate}
                        onChange={(e) => handleLocalTemplateSelect(e.target.value)}
                        className="template-dropdown"
                      >
                        <option value="">Select message template...</option>
                        {templates.map((template) => (
                          <option key={template._id || template.name} value={template.name}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <small>These are custom message templates</small>
                  </div>
                </>
              )}

              {/* CSV Upload */}
              <div className="form-group">
                <label>
                  <Upload size={16} /> Upload Recipients CSV
                </label>

                <div className="csv-upload-area">
                  <input type="file" accept=".csv" onChange={handleFileUpload} id="csv-upload" className="csv-input" />

                  <label htmlFor="csv-upload" className="csv-upload-label">
                    <div className="upload-content">
                      <div className="upload-icon">📄</div>
                      <div className="upload-text">
                        <p>Click to upload</p>
                        <span>CSV files only</span>
                      </div>
                    </div>
                  </label>
                </div>

                <small>Format: phone,var1,var2,var3...</small>
              </div>

              {/* Schedule Time */}
              <div className="form-group">
                <label>
                  <Calendar size={16} /> Schedule Time (Optional)
                </label>

                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />

                <small>Leave empty to send immediately</small>
              </div>

              {/* File Info */}
              {uploadedFile && (
                <div className="file-info-card">
                  <div className="file-details">
                    <div className="file-icon">📊</div>

                    <div className="file-info">
                      <p className="file-name">{uploadedFile.name}</p>
                      <p className="file-stats">{recipients.length} recipients found</p>

                      {fileVariables.length > 0 && (
                        <p className="variables-info">
                          ✅ {fileVariables.length} variables detected: {fileVariables.join(', ')}
                        </p>
                      )}
                    </div>

                    <button
                      className="remove-file"
                      onClick={() => {
                        setUploadedFile(null);
                        setRecipients([]);
                        setFileVariables([]);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="form-actions">
                <button className="secondary-btn" onClick={() => setActiveTab('overview')}>
                  Cancel
                </button>

                {scheduledTime ? (
                  <button className="primary-btn" onClick={createBroadcast} disabled={!recipients.length}>
                    <Calendar size={16} />
                    Schedule Campaign
                  </button>
                ) : (
                  <button className="primary-btn" onClick={handleSendBroadcast} disabled={isSending || !recipients.length}>
                    {isSending ? (
                      <>
                        <Clock size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Campaign
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Results */}
              {sendResults && (
                <div className="results-section">
                  <h4>Campaign Results</h4>

                  <div className="result-stats">
                    <div className="stat">
                      <span className="label">Total Sent:</span>
                      <span className="value">{sendResults.total_sent}</span>
                    </div>

                    <div className="stat">
                      <span className="label">Successful:</span>
                      <span className="value success">{sendResults.successful}</span>
                    </div>

                    <div className="stat">
                      <span className="label">Failed:</span>
                      <span className="value failed">
                        {(sendResults.total_sent || 0) - (sendResults.successful || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="preview-section">
              <h3>Message Preview</h3>

              <div className="phone-mockup">
                <div className="phone-header">
                  <span className="phone-time">{getCurrentPhoneTime()}</span>
                  <div className="phone-icons">
                    <span className="network-icon">📶</span>
                    <span className="signal-bars">📶</span>
                    <span className="battery">🔋</span>
                  </div>
                </div>

                <div className="chat-header">
                  <div className="chat-header-left">
                    <span className="back-arrow">←</span>

                    <div className="contact-info">
                      <div className="contact-avatar">
                        <img src={whatsappLogo} alt="WhatsApp Business" className="contact-avatar-img" />
                      </div>

                      <div className="contact-details">
                        <div className="contact-name">
                          WhatsApp Business <span className="verified-badge">✓</span>
                        </div>
                        <div className="contact-status">Online</div>
                      </div>
                    </div>
                  </div>

                  <div className="chat-header-right">
                    <span className="menu-icon">⋮</span>
                  </div>
                </div>

                <div className="chat-container">
                  <div className="date-separator">
                    <span className="date-text">Today</span>
                  </div>

                  <div className="message-bubble sent">
                    {messageType === 'template' ? (
                      templateName ? (
                        <p className="template-content">{getTemplatePreview()}</p>
                      ) : (
                        <p className="placeholder-text">Select a template to preview</p>
                      )
                    ) : customMessage ? (
                      <p className="custom-content">{getMessagePreview()}</p>
                    ) : (
                      <p className="placeholder-text">Enter your custom message to preview</p>
                    )}

                    {recipients.length > 0 && (
                      <div className="recipient-preview">
                        <small>📱 Sending to {recipients.length} recipient(s)</small>
                      </div>
                    )}

                    <div className="message-meta">
                      <span className="msg-time">{getCurrentTime()}</span>
                      <span className="message-status">
                        <span className="checkmark">✓</span>
                        <span className="checkmark">✓</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="chat-input">
                  <div className="input-container">
                    <span className="emoji-icon">😊</span>
                    <input type="text" className="message-input" placeholder="Type a message" readOnly />
                    <span className="attachment-icon">📎</span>
                    <span className="camera-icon">📷</span>
                    <span className="mic-icon">🎤</span>
                  </div>
                </div>
              </div>

              <div className="preview-info">
                {messageType === 'template' ? (
                  <div className="info-badge official">WhatsApp Template</div>
                ) : (
                  <div className="info-badge custom">
                    <FileText size={12} />
                    Custom Text Message
                  </div>
                )}

                <div className="preview-stats">
                  <span className="stat-item">
                    <Users size={12} />
                    {recipients.length} recipients
                  </span>
                  <span className="stat-item">
                    <FileText size={12} />
                    {messageType === 'template' ? 'Template' : 'Custom'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedCampaigns.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Delete Campaign{selectedCampaigns.length > 1 ? 's' : ''}</h3>
              <button className="modal-close" onClick={handleDeleteCancel}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                {selectedCampaigns.length > 1 ? 'these campaigns' : 'this campaign'}?
              </p>

              <div className="campaign-info">
                {selectedCampaigns.length === 1 ? (
                  <>
                    <strong>{broadcasts.find((b) => b._id === selectedCampaigns[0])?.name}</strong>
                    <p>Status: {broadcasts.find((b) => b._id === selectedCampaigns[0])?.status}</p>
                    <p>
                      Recipients:{' '}
                      {broadcasts.find((b) => b._id === selectedCampaigns[0])?.recipientCount ||
                        broadcasts.find((b) => b._id === selectedCampaigns[0])?.recipients?.length ||
                        0}
                    </p>
                  </>
                ) : (
                  <>
                    <strong>{selectedCampaigns.length} campaigns selected</strong>
                    <p>This will permanently delete all selected campaigns and their data.</p>
                  </>
                )}
              </div>

              <p className="warning-text">This action cannot be undone.</p>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleDeleteCancel}>
                Cancel
              </button>
              <button className="btn-delete" onClick={handleDeleteConfirm}>
                Delete {selectedCampaigns.length > 1 ? 'All' : 'Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Broadcast;
