/**
 * Campaign list state is intentionally centralized here so table controls,
 * socket patches, and selection do not force parent re-renders.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { broadcastAPI } from '../../../services/broadcastAPI';
import socketService from '../../../services/socketService';

const FILTER_STORAGE_KEY = 'voice-broadcast:all-campaigns:filters:v1';

const defaultQuery = {
  page: 1,
  limit: 25,
  search: '',
  status: 'all',
  sort: 'newest'
};

const readSavedQuery = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || 'null');
    return parsed && typeof parsed === 'object'
      ? { ...defaultQuery, ...parsed, page: 1 }
      : defaultQuery;
  } catch {
    return defaultQuery;
  }
};

const getCampaignId = (campaign = {}) =>
  String(campaign._id || campaign.id || campaign.broadcastId || '').trim();

const getErrorMessage = (err, fallback) => {
  const payload = err?.response?.data;
  const value = payload?.error || payload?.message || err?.message;
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  return fallback;
};

const normalizeCampaign = (campaign = {}) => ({
  ...campaign,
  _id: campaign._id || campaign.id,
  id: campaign.id || campaign._id,
  stats: {
    total: 0,
    queued: 0,
    calling: 0,
    completed: 0,
    failed: 0,
    opted_out: 0,
    ...(campaign.stats || {})
  },
  progressRate: Number(campaign.progressRate || 0),
  successRate: Number(campaign.successRate || 0)
});

export const useBroadcast = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [summary, setSummary] = useState({
    active: 0,
    completed: 0,
    failed: 0,
    avgSuccessRate: 0,
    runningNow: 0
  });
  const [query, setQuery] = useState(readSavedQuery);
  const [searchInput, setSearchInput] = useState(() => readSavedQuery().search || '');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 1
  });
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const queryRef = useRef(query);
  const searchTimerRef = useRef(null);

  const refreshBroadcasts = useCallback(async (overrides = {}, options = {}) => {
    const nextQuery = {
      ...queryRef.current,
      ...overrides
    };

    if (options.updateQuery !== false) {
      queryRef.current = nextQuery;
      setQuery(nextQuery);
    }

    try {
      if (!options.silent) setLoading(true);
      setError(null);
      const response = await broadcastAPI.listBroadcasts(nextQuery);
      const responseData = response.data || {};
      const campaigns = responseData.campaigns || responseData.broadcasts || [];
      setBroadcasts(campaigns.map(normalizeCampaign));
      setSummary({
        active: responseData.summary?.active || 0,
        completed: responseData.summary?.completed || 0,
        failed: responseData.summary?.failed || 0,
        avgSuccessRate: responseData.summary?.avgSuccessRate || 0,
        runningNow: responseData.summary?.runningNow || 0
      });
      setPagination((prev) => ({
        ...prev,
        ...(responseData.pagination || {}),
        total: responseData.total ?? responseData.pagination?.total ?? prev.total
      }));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load broadcasts'));
      console.error('Refresh broadcasts error:', err);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  const updateQuery = useCallback((patch = {}) => {
    const nextQuery = {
      ...queryRef.current,
      ...patch
    };
    refreshBroadcasts(nextQuery);
  }, [refreshBroadcasts]);

  const updateSearch = useCallback((value) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      updateQuery({ search: value.trim(), page: 1 });
    }, 400);
  }, [updateQuery]);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    localStorage.removeItem(FILTER_STORAGE_KEY);
    refreshBroadcasts(defaultQuery);
  }, [refreshBroadcasts]);

  const saveFilters = useCallback(() => {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      search: queryRef.current.search,
      status: queryRef.current.status,
      sort: queryRef.current.sort,
      limit: queryRef.current.limit
    }));
  }, []);

  const upsertBroadcast = useCallback((broadcastPatch = {}) => {
    const targetId = getCampaignId(broadcastPatch);
    if (!targetId) return;

    setBroadcasts((prev) =>
      prev.map((broadcast) => {
        if (getCampaignId(broadcast) !== targetId) return broadcast;
        const stats = {
          ...(broadcast.stats || {}),
          ...(broadcastPatch.stats || {})
        };
        const completed = Number(stats.completed || 0);
        const failed = Number(stats.failed || 0);
        const total = Number(stats.total || 0);

        return normalizeCampaign({
          ...broadcast,
          status: broadcastPatch.status || broadcast.status,
          stats,
          progressRate: total > 0 ? ((completed + failed + Number(stats.opted_out || 0)) / total) * 100 : broadcast.progressRate,
          successRate: completed + failed > 0 ? (completed / (completed + failed)) * 100 : broadcast.successRate
        });
      })
    );
  }, []);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllVisibleSelected = useCallback((checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      broadcasts.forEach((campaign) => {
        const id = getCampaignId(campaign);
        if (!id) return;
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }, [broadcasts]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const bulkCancel = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await broadcastAPI.bulkCancelBroadcasts(ids);
    clearSelection();
    refreshBroadcasts({}, { updateQuery: false });
  }, [clearSelection, refreshBroadcasts, selectedIds]);

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await broadcastAPI.bulkDeleteBroadcasts(ids);
    clearSelection();
    refreshBroadcasts({}, { updateQuery: false });
  }, [clearSelection, refreshBroadcasts, selectedIds]);

  const getBroadcastById = useCallback(
    (broadcastId) => broadcasts.find((b) => getCampaignId(b) === String(broadcastId)),
    [broadcasts]
  );

  const getActiveBroadcasts = useCallback(() => {
    return broadcasts.filter((b) => ['queued', 'in_progress'].includes(b.status));
  }, [broadcasts]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    const socket = socketService.connect();
    const handleBroadcastUpdate = (data = {}) => {
      upsertBroadcast(data.broadcast || {
        _id: data.broadcastId,
        id: data.broadcastId,
        status: data.status,
        stats: data.stats
      });
    };

    socket.on('broadcast_update', handleBroadcastUpdate);
    return () => {
      socket.off('broadcast_update', handleBroadcastUpdate);
    };
  }, [upsertBroadcast]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      refreshBroadcasts({}, { updateQuery: false, silent: true });
    }, 15000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshBroadcasts]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return {
    broadcasts,
    setBroadcasts,
    summary,
    query,
    searchInput,
    loading,
    error,
    pagination,
    selectedIds,
    autoRefresh,
    setAutoRefresh,
    refreshBroadcasts,
    updateQuery,
    updateSearch,
    resetFilters,
    saveFilters,
    upsertBroadcast,
    toggleSelected,
    setAllVisibleSelected,
    clearSelection,
    bulkCancel,
    bulkDelete,
    getBroadcastById,
    getActiveBroadcasts
  };
};
