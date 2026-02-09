import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/whatsappapi';
import webSocketService from '../services/websocketService';

export const useBroadcast = () => {
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [messageType, setMessageType] = useState('template');
  const [officialTemplates, setOfficialTemplates] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [language, setLanguage] = useState('en_US');
  const [templateFilter, setTemplateFilter] = useState('all');
  const [broadcasts, setBroadcasts] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [showNewBroadcastPopup, setShowNewBroadcastPopup] = useState(false);
  const [showBroadcastTypeChoice, setShowBroadcastTypeChoice] = useState(false);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState([]);
  const [showDropdown, setShowDropdown] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState('latest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // Template variables
  const [templateVariables, setTemplateVariables] = useState([]);
  const [fileVariables, setFileVariables] = useState([]);
  const [selectedLocalTemplate, setSelectedLocalTemplate] = useState('');

  // Campaign name
  const [broadcastName, setBroadcastName] = useState('');

// API functions
  const loadTemplates = useCallback(async () => {
    try {
      const result = await apiClient.getTemplates();
      const responseData = result?.data?.data ?? result?.data ?? [];
      const allTemplates = Array.isArray(responseData) ? responseData : [];
      const customTemplates = allTemplates.filter((t) => t.type === 'custom');
      setTemplates(customTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  const loadBroadcasts = useCallback(async () => {
    try {
      const result = await apiClient.getBroadcasts();
      const responseData = result?.data?.data ?? result?.data ?? [];
      setBroadcasts(Array.isArray(responseData) ? responseData : []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load broadcasts:', error);
    }
  }, []);

  const syncTemplates = useCallback(async () => {
    try {
      console.log('Syncing templates from Meta WhatsApp Business Manager...');
      const response = await apiClient.syncTemplates();
      const responseData = response?.data?.data ?? response?.data ?? [];
      const templates = Array.isArray(responseData) ? responseData : [];

      console.log('Meta templates response:', response);
      console.log('Processed Meta templates:', templates);

      setOfficialTemplates(templates);
      console.log('Meta templates synced successfully');

      const templateStatuses = templates.map(t => ({ name: t.name, status: t.status }));
      console.log('Meta template statuses:', templateStatuses);

    } catch (error) {
      console.error('Failed to sync Meta templates:', error);
      console.error('Error response:', error.response?.data);
      setOfficialTemplates([]);
    }
  }, []);

  

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    console.log('WebSocket message received:', data);
  }, []);

  // Handle broadcast stats updates
  const handleBroadcastStatsUpdate = useCallback((data) => {
    console.log('Broadcast stats updated via WebSocket:', data);

    if (data.broadcastId && data.stats) {
      console.log('Looking for broadcast with ID:', data.broadcastId);

      // Ensure we have a string ID for comparison
      const targetId = String(data.broadcastId);

      setBroadcasts(prevBroadcasts => {
        const updatedBroadcasts = prevBroadcasts.map(broadcast => {
          // Convert both IDs to strings for reliable comparison
          const broadcastId = String(broadcast._id || '');

          console.log('Comparing:', {
            frontendId: broadcastId,
            backendId: targetId,
            match: broadcastId === targetId
          });

          if (broadcastId === targetId) {
            console.log('Found matching broadcast, updating stats');

            // Ensure data consistency - delivered should never exceed recipients
            const currentRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;
            const updatedStats = { ...data.stats };

            // Fix data inconsistency
            if (updatedStats.delivered > currentRecipients && currentRecipients > 0) {
              console.log('Fixing data inconsistency:', {
                delivered: updatedStats.delivered,
                recipients: currentRecipients,
                issue: 'delivered > recipients'
              });
              updatedStats.delivered = currentRecipients;
            }

            return {
              ...broadcast,
              stats: updatedStats
            };
          }
          return broadcast;
        });

        // Log the changes for debugging
        const changedBroadcast = updatedBroadcasts.find(b =>
          String(b._id) === targetId
        );

        if (changedBroadcast) {
          console.log('Updated broadcast:', {
            id: changedBroadcast._id,
            name: changedBroadcast.name,
            stats: changedBroadcast.stats
          });
        } else {
          console.log('No matching broadcast found for ID:', targetId);
          console.log('Available broadcast IDs:', prevBroadcasts.map(b => ({
            id: String(b._id),
            name: b.name
          })));
        }

        return updatedBroadcasts;
      });
    }
  }, []);

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback((data) => {
    console.log('Message status update via WebSocket:', data);

    // When message status changes, reload broadcasts to get updated stats
    if (data.status === 'delivered' || data.status === 'read') {
      console.log('Reloading broadcasts due to message status change...');
      setTimeout(() => {
        loadBroadcasts();
      }, 1000);
    }
  }, [loadBroadcasts]);

  const parseDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // Load initial data and setup WebSocket
  useEffect(() => {
    let isCancelled = false;
    loadTemplates();
    loadBroadcasts();

    // Setup WebSocket for real-time updates
    const setupWebSocket = async () => {
      try {
        console.log('Attempting to connect WebSocket...');
        await webSocketService.connect('broadcast-user', handleWebSocketMessage);

        if (isCancelled) return undefined;

        const handleConnected = (data) => {
          console.log('WebSocket connected event:', data);
        };

        const handleDisconnected = (data) => {
          console.log('WebSocket disconnected event:', data);
        };

        const handleError = (data) => {
          console.log('WebSocket error event:', data);
        };

        // Listen for all events to debug
        webSocketService.on('connected', handleConnected);
        webSocketService.on('disconnected', handleDisconnected);
        webSocketService.on('error', handleError);

        // Listen for broadcast stat updates
        webSocketService.on('broadcast_stats_updated', handleBroadcastStatsUpdate);
        webSocketService.on('message_status', handleMessageStatusUpdate);

        console.log('WebSocket connected for real-time broadcast updates');
        console.log('WebSocket connection status:', webSocketService.getConnectionState());

        // Test connection by sending a ping
        setTimeout(() => {
          if (webSocketService.isConnected()) {
            console.log('Testing WebSocket connection...');
            webSocketService.send({ type: 'ping', test: true });
          } else {
            console.log('WebSocket not connected after setup');
          }
        }, 2000);

        return () => {
          webSocketService.off('connected', handleConnected);
          webSocketService.off('disconnected', handleDisconnected);
          webSocketService.off('error', handleError);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        console.log('WebSocket will retry connection automatically...');
        return undefined;
      }
    };

    let cleanupEvents = null;
    setupWebSocket().then((cleanup) => {
      cleanupEvents = cleanup;
    });

    // Cleanup on unmount
    return () => {
      isCancelled = true;
      if (cleanupEvents) cleanupEvents();
      webSocketService.off('broadcast_stats_updated', handleBroadcastStatsUpdate);
      webSocketService.off('message_status', handleMessageStatusUpdate);
    };
  }, [handleBroadcastStatsUpdate, handleMessageStatusUpdate, handleWebSocketMessage, loadBroadcasts, loadTemplates]);

// Auto-refresh broadcast stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'overview') {
        loadBroadcasts();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab, loadBroadcasts]);

  // Fetch official templates when template mode is selected
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        console.log('🔄 Fetching official templates from Meta...');
        const response = await apiClient.getTemplates();
        const responseData = response?.data?.data ?? response?.data ?? [];
        const templates = Array.isArray(responseData) ? responseData : [];

        console.log('📋 Meta official templates response:', response);
        console.log('📋 Processed Meta official templates:', templates);

        setOfficialTemplates(templates);

        const templateStatuses = templates.map(t => ({ name: t.name, status: t.status }));
        console.log('📊 Meta official template statuses:', templateStatuses);

      } catch (error) {
        console.error('❌ Failed to fetch Meta templates:', error);
        console.error('❌ Error response:', error.response?.data);
        setOfficialTemplates([]);
      }
    };

    if (messageType === 'template') {
      fetchTemplates();
    }
  }, [messageType]);

  // Close dropdowns when clicking outside
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

  // Utility functions
  const formatLastUpdated = () => {
    const now = new Date();
    const diff = now - lastUpdated;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes} min ago`;
    if (hours < 24) return `Updated ${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `Updated ${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getSuccessPercentage = (broadcast) => {
    const deliveredRaw = broadcast.stats?.delivered || 0;
    const read = broadcast.stats?.read || 0;
    const delivered = Math.max(deliveredRaw, read);
    const sent = broadcast.stats?.sent || 0;

    console.log(`???? Success Rate Calculation for "${broadcast.name}":`, {
      delivered,
      deliveredRaw,
      read,
      sent,
      stats: broadcast.stats
    });

    if (sent === 0) return 0;

    let successRate = (delivered / sent) * 100;

    if (successRate > 100) {
      console.log('???? Success rate > 100%, capping at 100:', {
        delivered,
        sent,
        originalRate: successRate
      });
      successRate = 100;
    }

    const finalRate = Math.round(successRate);
    console.log(`???? Final success rate: ${finalRate}%`);

    return finalRate;
  };

  const getReadPercentage = (broadcast) => {
    const read = broadcast.stats?.read || 0;
    const sent = broadcast.stats?.sent || 0;
    const totalRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;
    const delivered = broadcast.stats?.delivered || 0;

    console.log(`???? Read Rate Calculation for "${broadcast.name}":`, {
      read,
      sent,
      totalRecipients,
      delivered,
      stats: broadcast.stats
    });

    // Use sent count as primary base, fallback to total recipients, then delivered
    const base = sent || totalRecipients || delivered;
    if (base === 0) return 0;
    
    // Additional validation: read should never exceed sent
    const validRead = Math.min(read, sent || base);
    let readRate = (validRead / base) * 100;

    if (readRate > 100) {
      console.log('???? Read rate > 100%, capping at 100:', {
        read,
        validRead,
        sent,
        base,
        originalRate: readRate
      });
      readRate = 100;
    }

    const finalRate = Math.round(readRate);
    console.log(`???? Final read rate: ${finalRate}% (read: ${validRead}, base: ${base})`);

    return finalRate;
  };

  const getRepliedPercentage = (broadcast) => {
    const sent = broadcast.stats?.sent || 0;
    const replied = broadcast.stats?.replied || 0;
    const totalRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;

    console.log(`???? Replied Rate Calculation for "${broadcast.name}":`, {
      sent,
      replied,
      totalRecipients,
      stats: broadcast.stats
    });

    const base = sent || totalRecipients;
    if (base === 0) return 0;

    let repliedRate = (replied / base) * 100;

    if (repliedRate > 100) {
      console.log('???? Replied rate > 100%, capping at 100:', {
        replied,
        base,
        originalRate: repliedRate
      });
      repliedRate = 100;
    }

    const finalRate = Math.round(repliedRate);
    console.log(`???? Final replied rate: ${finalRate}%`);

    return finalRate;
  };

  const getOverviewStats = () => {
    const stats = broadcasts.reduce((acc, broadcast) => {
      const broadcastStats = broadcast.stats || {};
      return {
        sent: acc.sent + (broadcastStats.sent || 0),
        delivered: acc.delivered + (broadcastStats.delivered || 0),
        read: acc.read + (broadcastStats.read || 0),
        replied: acc.replied + (broadcastStats.replied || 0),
        sending: acc.sending + (broadcast.status === 'sending' ? broadcast.recipientCount || 0 : 0),
        failed: acc.failed + (broadcastStats.failed || 0),
        processing: acc.processing + (broadcast.status === 'processing' ? 1 : 0),
        queued: acc.queued + (broadcast.status === 'scheduled' ? 1 : 0),
      };
    }, {
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      sending: 0,
      failed: 0,
      processing: 0,
      queued: 0,
    });

    return stats;
  };

  const getSortByLabel = () => {
    if (searchTerm) {
      return 'Search';
    }

    const sortLabels = {
      'latest': 'Latest',
      'today': 'Today',
      'yesterday': 'Yesterday',
      'last7days': 'Last 7 days',
      'last1month': 'Last 1 month',
      'createdAt': 'Latest',
      'name': 'Name',
      'status': 'Status',
      'recipientCount': 'Recipients'
    };

    return sortLabels[dateFilter] || sortLabels[sortBy] || 'Latest';
  };

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

  const extractTemplateVariables = (content) => {
    if (!content || typeof content !== 'string') {
      setTemplateVariables([]);
      return;
    }

    const numberedVars = content.match(/\{\{\d+\}\}/g) || [];
    const namedVars = content.match(/\{var\d+\}/g) || [];

    const uniqueVars = [...new Set([...numberedVars, ...namedVars])];
    setTemplateVariables(uniqueVars);
  };

  // Filter and sort broadcasts
  const getFilteredAndSortedBroadcasts = () => {
    let filtered = [...broadcasts];

    if (searchTerm) {
      filtered = filtered.filter((broadcast) =>
        broadcast.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        broadcast.status?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((broadcast) => broadcast.status === statusFilter);
    }

    if (startDate || endDate) {
      filtered = filtered.filter((b) => {
        const campaignDate = new Date(b.createdAt || b.scheduledAt || 0);
        const start = parseDateValue(startDate);
        const end = parseDateValue(endDate);
        if (end) {
          end.setHours(23, 59, 59, 999);
        }

        if (start && campaignDate < start) return false;
        if (end && campaignDate > end) return false;
        return true;
      });
    }

    if (dateFilter && dateFilter !== 'latest') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((b) => {
        const campaignDate = new Date(b.createdAt || b.scheduledAt || 0);

        switch (dateFilter) {
          case 'today':
            return campaignDate >= today;
          case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return campaignDate >= yesterday && campaignDate < today;
          }
          case 'last7days': {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return campaignDate >= sevenDaysAgo;
          }
          case 'last1month': {
            const oneMonthAgo = new Date(today);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            return campaignDate >= oneMonthAgo;
          }
          default:
            return true;
        }
      });
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

  // Download campaigns as CSV
  const downloadAllCampaigns = () => {
    const csvHeaders = ['Campaign Name', 'Status', 'Scheduled Time', 'Recipients', 'Sent', 'Delivered', 'Read'];
    const csvData = broadcasts.map(broadcast => [
      broadcast.name || '',
      broadcast.status || '',
      broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : 'Immediate',
      broadcast.recipientCount || broadcast.recipients?.length || 0,
      broadcast.stats?.sent || 0,
      broadcast.stats?.delivered || 0,
      broadcast.stats?.read || 0
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all_campaigns_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Return all state and functions
  return {
    // State
    activeTab, setActiveTab,
    messageType, setMessageType,
    officialTemplates, setOfficialTemplates,
    templates, setTemplates,
    templateName, setTemplateName,
    language, setLanguage,
    templateFilter, setTemplateFilter,
    broadcasts, setBroadcasts,
    recipients, setRecipients,
    uploadedFile, setUploadedFile,
    isSending, setIsSending,
    sendResults, setSendResults,
    showResultsPopup, setShowResultsPopup,
    showNewBroadcastPopup, setShowNewBroadcastPopup,
    showBroadcastTypeChoice, setShowBroadcastTypeChoice,
    showCsvPreview, setShowCsvPreview,
    customMessage, setCustomMessage,
    scheduledTime, setScheduledTime,
    selectedCampaigns, setSelectedCampaigns,
    showDropdown, setShowDropdown,
    showDeleteModal, setShowDeleteModal,
    selectionMode, setSelectionMode,
    lastUpdated, setLastUpdated,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    showFilterDropdown, setShowFilterDropdown,
    showSortDropdown, setShowSortDropdown,
    dateFilter, setDateFilter,
    startDate, setStartDate,
    endDate, setEndDate,
    selectedPeriod, setSelectedPeriod,
    templateVariables, setTemplateVariables,
    fileVariables, setFileVariables,
    selectedLocalTemplate, setSelectedLocalTemplate,
    broadcastName, setBroadcastName,

    // Functions
    loadTemplates,
    loadBroadcasts,
    syncTemplates,
    formatLastUpdated,
    getSuccessPercentage,
    getReadPercentage,
    getRepliedPercentage,
    getOverviewStats,
    getSortByLabel,
    getStatusClass,
    extractTemplateVariables,
    getFilteredAndSortedBroadcasts,
    downloadAllCampaigns
  };
};
