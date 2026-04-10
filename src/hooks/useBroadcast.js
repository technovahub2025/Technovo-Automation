import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/whatsappapi';
import webSocketService from '../services/websocketService';
import apiService from '../services/api';
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from '../utils/sidebarPageCache';

const BROADCAST_PAGE_CACHE_NAMESPACE = 'broadcast-page';
const BROADCAST_PAGE_CACHE_TTL_MS = 10 * 60 * 1000;

const dedupeTemplatesById = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item?._id || item?.id || item?.name || '').trim();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const sanitizeBroadcastTemplateForCache = (template = {}) => ({
  _id: String(template?._id || '').trim(),
  id: String(template?.id || '').trim(),
  name: String(template?.name || '').trim(),
  type: String(template?.type || '').trim(),
  language: String(template?.language || '').trim(),
  category: String(template?.category || '').trim(),
  status: String(template?.status || '').trim(),
  message: String(template?.message || '').trim(),
  templateContent: String(template?.templateContent || '').trim(),
  content:
    template?.content && typeof template.content === 'object'
      ? {
          body: String(template.content.body || '').trim(),
          text: String(template.content.text || '').trim()
        }
      : null,
  components: Array.isArray(template?.components)
    ? template.components
        .map((component) => ({
          type: String(component?.type || '').trim(),
          text: String(component?.text || '').trim()
        }))
        .filter((component) => component.type || component.text)
    : []
});

const sanitizeBroadcastForCache = (broadcast = {}) => ({
  _id: String(broadcast?._id || '').trim(),
  id: String(broadcast?.id || '').trim(),
  name: String(broadcast?.name || '').trim(),
  status: String(broadcast?.status || '').trim(),
  messageType: String(broadcast?.messageType || '').trim(),
  templateName: String(broadcast?.templateName || '').trim(),
  language: String(broadcast?.language || '').trim(),
  createdAt: String(broadcast?.createdAt || '').trim(),
  scheduledAt: String(broadcast?.scheduledAt || '').trim(),
  completedAt: String(broadcast?.completedAt || '').trim(),
  recipientCount:
    Number.isFinite(Number(broadcast?.recipientCount)) && Number(broadcast.recipientCount) >= 0
      ? Number(broadcast.recipientCount)
      : 0,
  stats:
    broadcast?.stats && typeof broadcast.stats === 'object'
      ? {
          sent: Number(broadcast.stats.sent || 0) || 0,
          delivered: Number(broadcast.stats.delivered || 0) || 0,
          read: Number(broadcast.stats.read || 0) || 0,
          replied: Number(broadcast.stats.replied || 0) || 0,
          failed: Number(broadcast.stats.failed || 0) || 0
        }
      : {},
  recipients: Array.isArray(broadcast?.recipients)
    ? broadcast.recipients
        .slice(0, 20)
        .map((recipient) => ({
          phone: String(recipient?.phone || '').trim(),
          name: String(recipient?.name || '').trim()
        }))
        .filter((recipient) => recipient.phone || recipient.name)
    : []
});

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
  const [wsConnected, setWsConnected] = useState(false);
  const loadRequestSeqRef = useRef(0);
  const latestAppliedSeqRef = useRef(0);
  const currentUserId = resolveCacheUserId();
  const broadcastPageCacheRef = useRef(null);

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

  const persistBroadcastPageCache = useCallback((patch = {}) => {
    const previousCache = broadcastPageCacheRef.current || {};
    const nextCache = {
      broadcasts: Array.isArray(patch.broadcasts)
        ? patch.broadcasts
            .map(sanitizeBroadcastForCache)
            .filter((item) => item._id || item.id || item.name)
        : Array.isArray(previousCache.broadcasts)
          ? previousCache.broadcasts
          : [],
      templates: Array.isArray(patch.templates)
        ? patch.templates
            .map(sanitizeBroadcastTemplateForCache)
            .filter((item) => item._id || item.id || item.name)
        : Array.isArray(previousCache.templates)
          ? previousCache.templates
          : [],
      officialTemplates: Array.isArray(patch.officialTemplates)
        ? patch.officialTemplates
            .map(sanitizeBroadcastTemplateForCache)
            .filter((item) => item._id || item.id || item.name)
        : Array.isArray(previousCache.officialTemplates)
          ? previousCache.officialTemplates
          : [],
      lastUpdated:
        patch.lastUpdated instanceof Date
          ? patch.lastUpdated.toISOString()
          : String(patch.lastUpdated || previousCache.lastUpdated || '').trim()
    };

    broadcastPageCacheRef.current = nextCache;
    writeSidebarPageCache(BROADCAST_PAGE_CACHE_NAMESPACE, nextCache, {
      currentUserId,
      ttlMs: BROADCAST_PAGE_CACHE_TTL_MS
    });
  }, [currentUserId]);

// API functions
  const loadTemplates = useCallback(async () => {
    try {
      const result = await apiClient.getTemplates();
      const responseData = result?.data?.data ?? result?.data ?? [];
      const allTemplates = Array.isArray(responseData) ? responseData : [];
      const customTemplates = allTemplates.filter((t) => t.type === 'custom');
      setTemplates(customTemplates);
      persistBroadcastPageCache({ templates: customTemplates });
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, [persistBroadcastPageCache]);

  const loadBroadcasts = useCallback(async () => {
    const requestSeq = ++loadRequestSeqRef.current;
    try {
      const result = await apiClient.getBroadcasts();
      const responseData = result?.data?.data ?? result?.data ?? [];
      const broadcastsData = Array.isArray(responseData) ? responseData : [];
      // Ignore stale responses that arrive after a newer request already updated UI
      if (requestSeq < latestAppliedSeqRef.current) {
        return;
      }
      latestAppliedSeqRef.current = requestSeq;
      setBroadcasts(broadcastsData);
      const nextUpdatedAt = new Date();
      setLastUpdated(nextUpdatedAt);
      persistBroadcastPageCache({
        broadcasts: broadcastsData,
        lastUpdated: nextUpdatedAt
      });
    } catch (error) {
      console.error('Failed to load broadcasts:', error);
    }
  }, [persistBroadcastPageCache]);

  const syncTemplates = useCallback(async () => {
    try {
      const response = await apiClient.syncTemplates();
      const responseData = response?.data?.data ?? response?.data ?? [];
      const templates = Array.isArray(responseData) ? responseData : [];

      setOfficialTemplates(templates);
      persistBroadcastPageCache({ officialTemplates: templates });

    } catch (error) {
      console.error('Failed to sync Meta templates:', error);
      console.error('Error response:', error.response?.data);
      setOfficialTemplates([]);
    }
  }, [persistBroadcastPageCache]);

  

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(() => {}, []);

  // Handle broadcast stats updates
  const handleBroadcastStatsUpdate = useCallback((data) => {
    if (data.broadcastId && data.stats) {
      const targetId = String(data.broadcastId);

      setBroadcasts(prevBroadcasts => {
        const updatedBroadcasts = prevBroadcasts.map(broadcast => {
          const broadcastId = String(broadcast._id || '');

          if (broadcastId === targetId) {
            const currentRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;
            const updatedStats = { ...data.stats };

            if (updatedStats.delivered > currentRecipients && currentRecipients > 0) {
              updatedStats.delivered = currentRecipients;
            }

            return {
              ...broadcast,
              stats: updatedStats
            };
          }
          return broadcast;
        });

        return updatedBroadcasts;
      });
    }
  }, []);

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback((data) => {
    const status = String(data?.status || '').toLowerCase();
    const previousStatus = String(data?.previousStatus || '').toLowerCase();
    const targetId = data?.broadcastId ? String(data.broadcastId) : '';

    if (targetId && ['delivered', 'read', 'failed'].includes(status)) {
      setBroadcasts((prevBroadcasts) =>
        prevBroadcasts.map((broadcast) => {
          if (String(broadcast?._id || '') !== targetId) return broadcast;
          const toNumber = (value) => {
            const parsed = Number(value || 0);
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
          };
          const stats = { ...(broadcast.stats || {}) };

          if (status === 'delivered' && previousStatus === 'sent') {
            stats.delivered = toNumber(stats.delivered) + 1;
          } else if (status === 'read' && previousStatus !== 'read') {
            stats.read = toNumber(stats.read) + 1;
            if (previousStatus !== 'delivered') {
              stats.delivered = toNumber(stats.delivered) + 1;
            }
          } else if (status === 'failed' && previousStatus !== 'failed') {
            stats.failed = toNumber(stats.failed) + 1;
            if (previousStatus === 'sent') {
              stats.sent = Math.max(0, toNumber(stats.sent) - 1);
            }
          }

          stats.delivered = Math.max(toNumber(stats.delivered), toNumber(stats.read));
          return { ...broadcast, stats };
        })
      );

      // fast backend reconciliation
      setTimeout(() => loadBroadcasts(), 120);
      return;
    }

    // Fallback for payloads without broadcastId
    if (['delivered', 'read', 'failed', 'sent'].includes(status)) {
      setTimeout(() => loadBroadcasts(), 180);
    }
  }, [loadBroadcasts]);

  const parseDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getPeriodDateRange = (period) => {
    if (!period) return { start: null, end: null };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    switch (period) {
      case 'today':
        return { start: todayStart, end: todayEnd };
      case 'yesterday': {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 1);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      case 'last7days': {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 6);
        return { start, end: todayEnd };
      }
      case 'last30days':
      case 'last1month': {
        const start = new Date(todayStart);
        start.setDate(start.getDate() - 29);
        return { start, end: todayEnd };
      }
      case 'last3months': {
        const start = new Date(todayStart);
        start.setMonth(start.getMonth() - 3);
        return { start, end: todayEnd };
      }
      case 'last6months': {
        const start = new Date(todayStart);
        start.setMonth(start.getMonth() - 6);
        return { start, end: todayEnd };
      }
      case 'lastyear': {
        const start = new Date(todayStart);
        start.setFullYear(start.getFullYear() - 1);
        return { start, end: todayEnd };
      }
      default:
        return { start: null, end: null };
    }
  };

  // Load initial data and setup WebSocket
  useEffect(() => {
    let isCancelled = false;
    const cachedBroadcastPage = readSidebarPageCache(BROADCAST_PAGE_CACHE_NAMESPACE, {
      currentUserId,
      allowStale: true
    });

    if (cachedBroadcastPage?.data) {
      broadcastPageCacheRef.current = cachedBroadcastPage.data;

      if (Array.isArray(cachedBroadcastPage.data.broadcasts)) {
        setBroadcasts(cachedBroadcastPage.data.broadcasts);
      }
      if (Array.isArray(cachedBroadcastPage.data.templates)) {
        setTemplates(cachedBroadcastPage.data.templates);
      }
      if (Array.isArray(cachedBroadcastPage.data.officialTemplates)) {
        setOfficialTemplates(cachedBroadcastPage.data.officialTemplates);
      }
      if (cachedBroadcastPage.data.lastUpdated) {
        const parsedLastUpdated = new Date(cachedBroadcastPage.data.lastUpdated);
        if (!Number.isNaN(parsedLastUpdated.getTime())) {
          setLastUpdated(parsedLastUpdated);
        }
      }
    }

    loadTemplates();
    loadBroadcasts();

    // Setup WebSocket for real-time updates
    const setupWebSocket = async () => {
      try {
        await webSocketService.connect(currentUserId || 'broadcast-user', handleWebSocketMessage);
        setWsConnected(webSocketService.isConnected());

        if (isCancelled) return undefined;

        const handleConnected = () => setWsConnected(true);
        const handleDisconnected = () => setWsConnected(false);
        const handleError = () => setWsConnected(false);

        webSocketService.on('connected', handleConnected);
        webSocketService.on('disconnected', handleDisconnected);
        webSocketService.on('error', handleError);

        webSocketService.on('broadcast_stats_updated', handleBroadcastStatsUpdate);
        webSocketService.on('message_status', handleMessageStatusUpdate);

        return () => {
          webSocketService.off('connected', handleConnected);
          webSocketService.off('disconnected', handleDisconnected);
          webSocketService.off('error', handleError);
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setWsConnected(false);
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
      setWsConnected(false);
    };
  }, [currentUserId, handleBroadcastStatsUpdate, handleMessageStatusUpdate, handleWebSocketMessage, loadBroadcasts, loadTemplates]);

  // Fallback polling only when websocket is unavailable.
  useEffect(() => {
    if (wsConnected) return undefined;

    const hasActiveBroadcasts = broadcasts.some((b) =>
      ['scheduled', 'sending', 'processing'].includes(String(b?.status || '').toLowerCase())
    );

    const intervalMs = hasActiveBroadcasts ? 2500 : 5000;

    const interval = setInterval(() => {
      if (activeTab !== 'overview') return;
      if (document.hidden) return;
      loadBroadcasts();
    }, intervalMs);

    // Refresh immediately when tab becomes visible/focused
    const handleVisibility = () => {
      if (!document.hidden && activeTab === 'overview') {
        loadBroadcasts();
      }
    };

    const handleFocus = () => {
      if (activeTab === 'overview') {
        loadBroadcasts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeTab, broadcasts, loadBroadcasts, wsConnected]);

  // Fetch official templates when template mode is selected
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await apiClient.getTemplates();
        const responseData = response?.data?.data ?? response?.data ?? [];
        const templates = Array.isArray(responseData) ? responseData : [];

        setOfficialTemplates(templates);
        persistBroadcastPageCache({ officialTemplates: templates });

      } catch (error) {
        console.error('❌ Failed to fetch Meta templates:', error);
        console.error('❌ Error response:', error.response?.data);
        setOfficialTemplates([]);
      }
    };

    if (messageType === 'template') {
      fetchTemplates();
    }
  }, [messageType, persistBroadcastPageCache]);

  useEffect(() => {
    if (!broadcasts.length && !templates.length && !officialTemplates.length) {
      return;
    }
    persistBroadcastPageCache({
      broadcasts,
      templates,
      officialTemplates,
      lastUpdated
    });
  }, [broadcasts, templates, officialTemplates, lastUpdated, persistBroadcastPageCache]);

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
  const toNonNegative = (value) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
  };
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
    const deliveredRaw = toNonNegative(broadcast.stats?.delivered);
    const read = toNonNegative(broadcast.stats?.read);
    const delivered = Math.max(deliveredRaw, read);
    const sent = toNonNegative(broadcast.stats?.sent);

    if (sent === 0) return 0;

    let successRate = (delivered / sent) * 100;
    if (successRate > 100) successRate = 100;

    return Math.round(successRate);
  };

  const getReadPercentage = (broadcast) => {
    const read = toNonNegative(broadcast.stats?.read);
    const sent = toNonNegative(broadcast.stats?.sent);
    const totalRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;
    const delivered = toNonNegative(broadcast.stats?.delivered);

    const base = sent || totalRecipients || delivered;
    if (base === 0) return 0;

    const validRead = Math.min(read, sent || base);
    let readRate = (validRead / base) * 100;
    if (readRate > 100) readRate = 100;

    return Math.round(readRate);
  };

  const getRepliedPercentage = (broadcast) => {
    const sent = toNonNegative(broadcast.stats?.sent);
    const replied = toNonNegative(broadcast.stats?.replied);
    const totalRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;

    const base = sent || totalRecipients;
    if (base === 0) return 0;

    let repliedRate = (replied / base) * 100;
    if (repliedRate > 100) repliedRate = 100;

    return Math.round(repliedRate);
  };

  const getOverviewStats = () => {
    const stats = broadcasts.reduce((acc, broadcast) => {
      const broadcastStats = broadcast.stats || {};

      const sent = toNonNegative(broadcastStats.sent);
      const delivered = toNonNegative(broadcastStats.delivered);
      const read = toNonNegative(broadcastStats.read);
      const replied = toNonNegative(broadcastStats.replied);
      const failed = toNonNegative(broadcastStats.failed);

      const correctedDelivered = Math.max(delivered, read);

      return {
        sent: acc.sent + sent,
        delivered: acc.delivered + correctedDelivered,
        read: acc.read + read,
        replied: acc.replied + replied,
        sending: acc.sending + (broadcast.status === 'sending' ? broadcast.recipientCount || 0 : 0),
        failed: acc.failed + failed,
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

    const parsedStartDate = parseDateValue(startDate);
    const parsedEndDate = parseDateValue(endDate);
    const periodRange = getPeriodDateRange(selectedPeriod);
    const effectiveStart = parsedStartDate || periodRange.start;
    const effectiveEnd = parsedEndDate || periodRange.end;

    if (effectiveStart || effectiveEnd) {
      filtered = filtered.filter((b) => {
        const campaignDate = new Date(b.createdAt || b.scheduledAt || 0);
        const start = effectiveStart;
        const end = effectiveEnd ? new Date(effectiveEnd) : null;
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
  const downloadAllCampaigns = (campaigns = broadcasts) => {
    const exportRows = Array.isArray(campaigns) ? campaigns : broadcasts;
    const csvHeaders = ['Campaign Name', 'Status', 'Scheduled Time', 'Recipients', 'Sent', 'Delivered', 'Read'];
    const csvData = exportRows.map(broadcast => [
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
    link.setAttribute('download', `campaigns_export_${new Date().toISOString().split('T')[0]}.csv`);
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

export const useExotelOutbound = () => {
  const [quickCallLoading, setQuickCallLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [overview, setOverview] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState('');

  const quickCall = useCallback(async ({
    provider,
    to,
    from,
    templateId,
    customMessage,
    voiceId,
    voice,
    workflowId,
    scheduleType,
    scheduledAt,
    recurrence,
    timezone,
    allowedWindowStart,
    allowedWindowEnd
  }) => {
    setQuickCallLoading(true);
    setError('');
    try {
      const response = await apiService.quickOutboundCall({
        provider,
        to,
        from,
        templateId,
        customMessage,
        message: customMessage,
        voiceId,
        voice,
        workflowId,
        scheduleType,
        scheduledAt,
        recurrence,
        timezone,
        allowedWindowStart,
        allowedWindowEnd
      });
      setLastResponse(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Quick call failed';
      setError(message);
      throw err;
    } finally {
      setQuickCallLoading(false);
    }
  }, []);

  const launchBulkCampaign = useCallback(async ({
    provider,
    campaignName,
    numbers,
    from,
    csvData,
    maxConcurrent,
    customMessage,
    voiceId,
    voice,
    templateId,
    workflowId,
    scheduleType,
    scheduledAt,
    recurrence,
    timezone,
    allowedWindowStart,
    allowedWindowEnd
  }) => {
    setBulkLoading(true);
    setError('');
    try {
      const response = await apiService.launchOutboundBulkCampaign({
        provider,
        campaignName,
        numbers,
        from,
        csvData,
        maxConcurrent,
        customMessage,
        message: customMessage,
        voiceId,
        voice,
        templateId,
        workflowId,
        scheduleType,
        scheduledAt,
        recurrence,
        timezone,
        allowedWindowStart,
        allowedWindowEnd
      });
      setLastResponse(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Bulk campaign failed';
      setError(message);
      throw err;
    } finally {
      setBulkLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError('');
    try {
      const response = await apiService.getOutboundOverview();
      setOverview(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load outbound overview';
      setError(message);
      throw err;
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setError('');
    try {
      const response = await apiService.getOutboundTemplates();
      const list = Array.isArray(response?.data?.templates) ? response.data.templates : [];
      setTemplates(dedupeTemplatesById(list));
      return list;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load templates';
      setError(message);
      throw err;
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async (params = { limit: 20 }) => {
    setError('');
    try {
      const response = await apiService.getOutboundCampaigns(params);
      const list = Array.isArray(response?.data?.campaigns) ? response.data.campaigns : [];
      setCampaigns(list);
      return list;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load campaigns';
      setError(message);
      throw err;
    }
  }, []);

  const fetchWorkflows = useCallback(async () => {
    setError('');
    try {
      const response = await apiService.getIVRMenus({ limit: 100 });
      const list = Array.isArray(response?.data?.ivrMenus) ? response.data.ivrMenus : [];
      setWorkflows(list);
      return list;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to load IVR workflows';
      setError(message);
      throw err;
    }
  }, []);

  const createTemplate = useCallback(async ({ name, script }) => {
    setTemplateSaving(true);
    setError('');
    try {
      const response = await apiService.createOutboundTemplate({ name, script });
      const created = response?.data?.template || null;
      if (created) {
        setTemplates((prev) => dedupeTemplatesById([created, ...prev]));
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to create template';
      setError(message);
      throw err;
    } finally {
      setTemplateSaving(false);
    }
  }, []);

  const updateTemplate = useCallback(async (templateId, { name, script }) => {
    setTemplateSaving(true);
    setError('');
    try {
      const response = await apiService.updateOutboundTemplate(templateId, { name, script });
      const updated = response?.data?.template || null;
      if (updated?._id) {
        setTemplates((prev) =>
          dedupeTemplatesById(prev.map((item) => (
            String(item?._id) === String(updated._id) ? updated : item
          )))
        );
      }
      return updated;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to update template';
      setError(message);
      throw err;
    } finally {
      setTemplateSaving(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (templateId) => {
    setError('');
    try {
      await apiService.deleteOutboundTemplate(templateId);
      setTemplates((prev) => prev.filter((item) => String(item?._id) !== String(templateId)));
      return true;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Failed to delete template';
      setError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    const socket = apiService.initializeSocket();
    if (!socket) return undefined;

    const handleOutboundMetrics = (payload = {}) => {
      setOverview((prev) => {
        const previous = prev && typeof prev === 'object' ? prev : {};
        const previousToday = previous.today && typeof previous.today === 'object' ? previous.today : {};

        return {
          ...previous,
          today: {
            ...previousToday,
            total: Number(payload?.total ?? previousToday.total ?? 0),
            initiated: Number(payload?.initiated ?? previousToday.initiated ?? 0),
            failed: Number(payload?.failed ?? previousToday.failed ?? 0),
            successRate: Number(payload?.successRate ?? previousToday.successRate ?? 0),
            lastUpdate: payload?.timestamp || new Date().toISOString(),
            mode: payload?.mode || previousToday.mode || '',
            campaignName: payload?.campaignName || previousToday.campaignName || '',
            progress: Number(payload?.progress ?? previousToday.progress ?? 0),
            completed: Boolean(payload?.completed ?? previousToday.completed ?? false)
          }
        };
      });
    };

    const handleTemplateUpdate = (payload = {}) => {
      const action = String(payload?.action || '').toLowerCase();

      if ((action === 'created' || action === 'updated') && payload?.template?._id) {
        setTemplates((prev) => {
          const next = prev.filter((item) => String(item?._id) !== String(payload.template._id));
          return dedupeTemplatesById([payload.template, ...next]);
        });
        return;
      }

      if (action === 'deleted' && payload?.templateId) {
        setTemplates((prev) =>
          prev.filter((item) => String(item?._id) !== String(payload.templateId))
        );
      }
    };

    const handleCampaignUpdate = (payload = {}) => {
      const incomingCampaign = payload?.campaign;
      if (!incomingCampaign?._id) {
        return;
      }

      setCampaigns((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        const index = next.findIndex((item) => String(item?._id) === String(incomingCampaign._id));
        if (index >= 0) {
          next[index] = {
            ...next[index],
            ...incomingCampaign,
            metrics: {
              ...(next[index]?.metrics || {}),
              ...(incomingCampaign?.metrics || {})
            },
            contactSummary: {
              ...(next[index]?.contactSummary || {}),
              ...(incomingCampaign?.contactSummary || {})
            },
            schedule: {
              ...(next[index]?.schedule || {}),
              ...(incomingCampaign?.schedule || {})
            }
          };
        } else {
          next.unshift(incomingCampaign);
        }

        return next
          .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0))
          .slice(0, 20);
      });
    };

    socket.on('outbound_metrics', handleOutboundMetrics);
    socket.on('outbound_template_update', handleTemplateUpdate);
    socket.on('campaign_update', handleCampaignUpdate);

    return () => {
      socket.off('outbound_metrics', handleOutboundMetrics);
      socket.off('outbound_template_update', handleTemplateUpdate);
      socket.off('campaign_update', handleCampaignUpdate);
    };
  }, []);

  return {
    quickCallLoading,
    bulkLoading,
    overviewLoading,
    templatesLoading,
    templateSaving,
    lastResponse,
    overview,
    templates,
    campaigns,
    workflows,
    error,
    quickCall,
    launchBulkCampaign,
    fetchOverview,
    fetchTemplates,
    fetchCampaigns,
    fetchWorkflows,
    createTemplate,
    updateTemplate,
    deleteTemplate
  };
};

export const useCampaignAutomation = () => {
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [abTestLoading, setAbTestLoading] = useState(false);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [scheduleResponse, setScheduleResponse] = useState(null);
  const [retryStats, setRetryStats] = useState(null);
  const [abTestResults, setAbTestResults] = useState(null);
  const [rotationStats, setRotationStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = apiService.initializeSocket();
    if (!socket) return undefined;

    const handleCampaignUpdate = (payload) => {
      setScheduleResponse((prev) => ({ ...(prev || {}), liveUpdate: payload }));
    };

    const handleRetryStats = (payload) => {
      setRetryStats(payload);
    };

    const handleAbTestResults = (payload) => {
      setAbTestResults(payload);
    };

    socket.on('campaign_update', handleCampaignUpdate);
    socket.on('retry_stats', handleRetryStats);
    socket.on('abtest_results', handleAbTestResults);

    return () => {
      socket.off('campaign_update', handleCampaignUpdate);
      socket.off('retry_stats', handleRetryStats);
      socket.off('abtest_results', handleAbTestResults);
    };
  }, []);

  const scheduleCampaign = useCallback(async (payload) => {
    setScheduleLoading(true);
    setError('');
    try {
      const response = await apiService.scheduleOutboundCampaign(payload);
      setScheduleResponse(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Scheduling failed';
      setError(message);
      throw err;
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const triggerRetry = useCallback(async () => {
    setRetryLoading(true);
    setError('');
    try {
      const response = await apiService.retryOutboundCampaign();
      setRetryStats(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Retry execution failed';
      setError(message);
      throw err;
    } finally {
      setRetryLoading(false);
    }
  }, []);

  const createABTest = useCallback(async (payload) => {
    setAbTestLoading(true);
    setError('');
    try {
      const response = await apiService.createOutboundABTest(payload);
      setAbTestResults(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'A/B test failed';
      setError(message);
      throw err;
    } finally {
      setAbTestLoading(false);
    }
  }, []);

  const loadRotationStats = useCallback(async () => {
    setRotationLoading(true);
    setError('');
    try {
      const response = await apiService.getOutboundRotationStats();
      setRotationStats(response?.data || null);
      return response?.data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Number rotation load failed';
      setError(message);
      throw err;
    } finally {
      setRotationLoading(false);
    }
  }, []);

  return {
    scheduleLoading,
    retryLoading,
    abTestLoading,
    rotationLoading,
    scheduleResponse,
    retryStats,
    abTestResults,
    rotationStats,
    error,
    scheduleCampaign,
    triggerRetry,
    createABTest,
    loadRotationStats
  };
};






