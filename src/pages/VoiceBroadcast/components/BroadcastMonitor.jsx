import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Phone, CheckCircle, XCircle, Clock, Users, TrendingUp, Wifi, WifiOff, PhoneOff, Radio } from 'lucide-react';
import { broadcastAPI } from '../../../services/broadcastAPI';
import socketService from '../../../services/socketService';
import CallsTable from './CallsTable';
import './BroadcastMonitor.css';

const DEFAULT_STATS = {
  total: 0,
  queued: 0,
  calling: 0,
  answered: 0,
  completed: 0,
  failed: 0,
  opted_out: 0
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All Calls', stat: 'total' },
  { key: 'completed', label: 'Completed', stat: 'completed' },
  { key: 'failed', label: 'Failed', stat: 'failed' },
  { key: 'calling', label: 'In Progress', stat: 'calling' },
  { key: 'queued', label: 'Queued', stat: 'queued' },
  { key: 'opted_out', label: 'Opted Out', stat: 'opted_out' }
];

const FINAL_BROADCAST_STATUSES = new Set(['completed', 'failed', 'cancelled']);

const getCallId = (call = {}) => String(call._id || call.callId || '').trim();

const getErrorMessage = (error, fallback) => {
  const payload = error?.response?.data;
  const value = payload?.error || payload?.message || error?.message;
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  return fallback;
};

const BroadcastMonitor = ({ broadcastId, onBroadcastUpdated }) => {
  const [broadcast, setBroadcast] = useState(null);
  const [calls, setCalls] = useState([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [callsLoading, setCallsLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const [callsError, setCallsError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [callPagination, setCallPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  const socketRef = useRef(null);
  const statusRequestRef = useRef(0);
  const callsRequestRef = useRef(0);
  const updateBufferRef = useRef(new Map());
  const flushTimerRef = useRef(null);
  const reconcileTimerRef = useRef(null);
  const queryRef = useRef({ selectedStatus, callPagination });

  const stats = useMemo(() => ({
    ...DEFAULT_STATS,
    ...(broadcast?.stats || {})
  }), [broadcast?.stats]);

  const progress = useMemo(() => {
    if (!stats.total) return 0;
    return Math.min(100, Math.max(0, ((stats.completed + stats.failed + stats.opted_out) / stats.total) * 100));
  }, [stats.completed, stats.failed, stats.opted_out, stats.total]);

  const successRate = useMemo(() => {
    const resolved = stats.completed + stats.failed;
    return resolved > 0 ? Math.round((stats.completed / resolved) * 100) : 0;
  }, [stats.completed, stats.failed]);

  const remaining = useMemo(() => (
    Math.max(0, stats.total - stats.completed - stats.failed - stats.opted_out)
  ), [stats.completed, stats.failed, stats.opted_out, stats.total]);

  const statCards = useMemo(() => [
    { key: 'total', label: 'Total Contacts', value: stats.total, icon: Users },
    { key: 'calling', label: 'Calling', value: stats.calling, icon: Phone },
    { key: 'completed', label: 'Completed', value: stats.completed, icon: CheckCircle },
    { key: 'failed', label: 'Failed', value: stats.failed, icon: XCircle },
    { key: 'queued', label: 'Queued', value: stats.queued, icon: Clock },
    { key: 'rate', label: 'Success Rate', value: `${successRate}%`, icon: TrendingUp },
    { key: 'opted-out', label: 'Opted Out', value: stats.opted_out, icon: PhoneOff }
  ], [stats, successRate]);

  const normalizeCall = useCallback((call = {}) => {
    const callId = getCallId(call);
    return {
      ...call,
      _id: callId,
      contact: call.contact || {
        phone: call.phone || '',
        name: call.name || 'Unknown'
      }
    };
  }, []);

  const shouldShowCall = useCallback((call = {}, status = selectedStatus) => (
    status === 'all' || call.status === status
  ), [selectedStatus]);

  const getStatusColor = useCallback((status) => {
    const colors = {
      queued: '#64748b',
      claiming: '#64748b',
      calling: '#2563eb',
      ringing: '#2563eb',
      in_progress: '#2563eb',
      answered: '#2563eb',
      completed: '#059669',
      failed: '#dc2626',
      busy: '#dc2626',
      no_answer: '#dc2626',
      cancelled: '#dc2626',
      opted_out: '#d97706'
    };
    return colors[status] || '#64748b';
  }, []);

  const fetchBroadcastStatus = useCallback(async ({ silent = false } = {}) => {
    const requestId = statusRequestRef.current + 1;
    statusRequestRef.current = requestId;

    try {
      if (!silent) setStatusLoading(true);
      setStatusError(null);
      const response = await broadcastAPI.getBroadcastStatus(broadcastId);
      if (requestId !== statusRequestRef.current) return;
      setBroadcast(response.data.broadcast);
      setConnectionStatus((prev) => (prev === 'connected' ? prev : 'connected'));
    } catch (error) {
      if (requestId !== statusRequestRef.current) return;
      setStatusError(getErrorMessage(error, 'Failed to load broadcast status'));
      console.error('Failed to load broadcast status:', error);
    } finally {
      if (requestId === statusRequestRef.current && !silent) setStatusLoading(false);
    }
  }, [broadcastId]);

  const fetchBroadcastCalls = useCallback(async ({ silent = false } = {}) => {
    const requestId = callsRequestRef.current + 1;
    callsRequestRef.current = requestId;

    const params = {
      page: queryRef.current.callPagination.page,
      limit: queryRef.current.callPagination.limit
    };
    if (queryRef.current.selectedStatus !== 'all') {
      params.status = queryRef.current.selectedStatus;
    }

    try {
      if (!silent) setCallsLoading(true);
      setCallsError(null);
      const response = await broadcastAPI.getBroadcastCalls(broadcastId, params);
      if (requestId !== callsRequestRef.current) return;
      setCalls((response.data.calls || []).map(normalizeCall));
      setCallPagination((prev) => ({
        ...prev,
        ...(response.data.pagination || {})
      }));
    } catch (error) {
      if (requestId !== callsRequestRef.current) return;
      setCallsError(getErrorMessage(error, 'Failed to load broadcast calls'));
      console.error('Failed to load broadcast calls:', error);
    } finally {
      if (requestId === callsRequestRef.current && !silent) setCallsLoading(false);
    }
  }, [broadcastId, normalizeCall]);

  const scheduleReconcileFetch = useCallback((delayMs = 700) => {
    if (reconcileTimerRef.current) {
      clearTimeout(reconcileTimerRef.current);
    }

    reconcileTimerRef.current = setTimeout(() => {
      fetchBroadcastStatus({ silent: true });
      fetchBroadcastCalls({ silent: true });
      onBroadcastUpdated?.();
    }, delayMs);
  }, [fetchBroadcastCalls, fetchBroadcastStatus, onBroadcastUpdated]);

  const flushBufferedUpdates = useCallback(() => {
    flushTimerRef.current = null;
    const buffered = Array.from(updateBufferRef.current.values()).map(normalizeCall);
    updateBufferRef.current.clear();
    if (buffered.length === 0) return;

    const { selectedStatus: activeStatus, callPagination: activePagination } = queryRef.current;

    setCalls((prev) => {
      const byId = new Map(prev.map((call) => [getCallId(call), call]));

      buffered.forEach((incoming) => {
        const callId = getCallId(incoming);
        if (!callId) return;

        if (!shouldShowCall(incoming, activeStatus)) {
          byId.delete(callId);
          return;
        }

        const existing = byId.get(callId);
        if (existing) {
          byId.set(callId, {
            ...existing,
            ...incoming,
            contact: {
              ...(existing.contact || {}),
              ...(incoming.contact || {})
            }
          });
          return;
        }

        if (activePagination.page === 1) {
          byId.set(callId, incoming);
        }
      });

      return Array.from(byId.values())
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, activePagination.limit);
    });
  }, [normalizeCall, shouldShowCall]);

  const queueCallUpdates = useCallback((updates = []) => {
    updates.forEach((call) => {
      const normalized = normalizeCall(call);
      const callId = getCallId(normalized);
      if (callId) updateBufferRef.current.set(callId, normalized);
    });

    if (flushTimerRef.current) return;
    const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 50));
    flushTimerRef.current = schedule(flushBufferedUpdates);
  }, [flushBufferedUpdates, normalizeCall]);

  const applyBroadcastPatch = useCallback((data = {}) => {
    const payloadBroadcast = data?.broadcast || data?.data?.broadcast || null;
    const targetId = String(payloadBroadcast?._id || payloadBroadcast?.id || data?.broadcastId || '').trim();
    if (targetId && targetId !== String(broadcastId || '').trim()) return;

    setConnectionStatus('connected');
    setBroadcast((prev) => ({
      ...(prev || {}),
      ...(payloadBroadcast || {}),
      status: payloadBroadcast?.status || data.status || prev?.status,
      stats: payloadBroadcast?.stats || data.stats || prev?.stats || DEFAULT_STATS
    }));
  }, [broadcastId]);

  useEffect(() => {
    queryRef.current = {
      selectedStatus,
      callPagination: {
        page: callPagination.page,
        limit: callPagination.limit,
        total: callPagination.total,
        pages: callPagination.pages
      }
    };
  }, [callPagination.limit, callPagination.page, callPagination.pages, callPagination.total, selectedStatus]);

  useEffect(() => {
    setBroadcast(null);
    setCalls([]);
    setSelectedStatus('all');
    setCallPagination({ page: 1, limit: 50, total: 0, pages: 1 });
    fetchBroadcastStatus();
  }, [broadcastId, fetchBroadcastStatus]);

  useEffect(() => {
    fetchBroadcastCalls();
  }, [broadcastId, selectedStatus, callPagination.page, callPagination.limit, fetchBroadcastCalls]);

  useEffect(() => {
    const socket = socketService.connect();
    if (!socket || typeof socket.on !== 'function') {
      setConnectionStatus('error');
      return undefined;
    }

    socketRef.current = socket;

    const handleConnect = () => {
      setConnectionStatus('connected');
      socket.emit('join_broadcast', broadcastId);
      scheduleReconcileFetch(250);
    };
    const handleDisconnect = () => setConnectionStatus('reconnecting');
    const handleConnectError = (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'error'));
    };
    const handleBroadcastUpdate = (data = {}) => {
      applyBroadcastPatch(data);
      const payloadBroadcast = data?.broadcast || data?.data?.broadcast || null;
      const status = payloadBroadcast?.status || data.status;
      if (FINAL_BROADCAST_STATUSES.has(status)) {
        scheduleReconcileFetch(350);
      }
    };
    const handleCallUpdate = (data = {}) => {
      const targetId = String(data?.broadcastId || '').trim();
      if (targetId && targetId !== String(broadcastId || '').trim()) return;
      setConnectionStatus('connected');
      queueCallUpdates([data]);
    };
    const handleBatchUpdate = (data = {}) => {
      const targetId = String(data?.broadcastId || '').trim();
      if (targetId && targetId !== String(broadcastId || '').trim()) return;
      setConnectionStatus('connected');
      queueCallUpdates(data.calls || []);
    };
    const handleCallsCreated = (data = {}) => {
      const targetId = String(data?.broadcastId || '').trim();
      if (targetId && targetId !== String(broadcastId || '').trim()) return;
      scheduleReconcileFetch(350);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('broadcast_updated', handleBroadcastUpdate);
    socket.on('broadcast_update', handleBroadcastUpdate);
    socket.on('call_update', handleCallUpdate);
    socket.on('batch_update', handleBatchUpdate);
    socket.on('calls_created', handleCallsCreated);
    socket.emit('join_broadcast', broadcastId);
    setConnectionStatus(socket.connected ? 'connected' : 'connecting');

    return () => {
      if (typeof socket.emit === 'function') socket.emit('leave_broadcast', broadcastId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('broadcast_updated', handleBroadcastUpdate);
      socket.off('broadcast_update', handleBroadcastUpdate);
      socket.off('call_update', handleCallUpdate);
      socket.off('batch_update', handleBatchUpdate);
      socket.off('calls_created', handleCallsCreated);
      socketRef.current = null;
    };
  }, [applyBroadcastPatch, broadcastId, queueCallUpdates, scheduleReconcileFetch]);

  useEffect(() => () => {
    if (flushTimerRef.current) {
      const cancel = window.cancelAnimationFrame || window.clearTimeout;
      cancel(flushTimerRef.current);
    }
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
  }, []);

  const handleCancelBroadcast = async () => {
    if (!window.confirm('Are you sure you want to cancel this broadcast?')) return;

    try {
      await broadcastAPI.cancelBroadcast(broadcastId);
      await fetchBroadcastStatus({ silent: true });
      scheduleReconcileFetch(100);
    } catch (error) {
      console.error('Failed to cancel broadcast:', error);
      alert('Failed to cancel broadcast');
    }
  };

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setCallPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page) => {
    setCallPagination((prev) => ({ ...prev, page }));
  };

  const handleLimitChange = (limit) => {
    setCallPagination((prev) => ({ ...prev, page: 1, limit }));
  };

  if (statusLoading && !broadcast) {
    return (
      <div className="monitor-loading voice-broadcast__loading">
        <div className="spinner-large voice-broadcast__spinner voice-broadcast__spinner--large" />
        <p>Loading broadcast data...</p>
      </div>
    );
  }

  if (statusError && !broadcast) {
    return (
      <div className="monitor-error voice-broadcast__error-state">
        <XCircle size={42} />
        <h3>{statusError}</h3>
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="monitor-error voice-broadcast__error-state">
        <XCircle size={42} />
        <h3>Broadcast not found</h3>
      </div>
    );
  }

  return (
    <div className="voice-broadcast__monitor">
      <div className="monitor-header voice-broadcast__monitor-header">
        <div className="header-info voice-broadcast__monitor-info">
          <div className="monitor-title-row voice-broadcast__monitor-title-row">
            <Radio size={22} aria-hidden="true" />
            <h2>{broadcast.name}</h2>
          </div>
          <div className="header-badges voice-broadcast__monitor-badges">
            <span className={`status-badge status-${broadcast.status} voice-broadcast__status-pill voice-broadcast__status-pill--${broadcast.status}`}>
              {String(broadcast.status || '').replace('_', ' ')}
            </span>
            <div className={`connection-status voice-broadcast__connection-status ${connectionStatus}`}>
              {connectionStatus === 'connected' ? <Wifi size={15} /> : <WifiOff size={15} />}
              <span>
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
                    ? 'Connecting'
                    : 'Connection Error'}
              </span>
            </div>
          </div>
        </div>

        <div className="monitor-actions voice-broadcast__monitor-actions">
          {broadcast.status === 'in_progress' && (
            <button type="button" className="btn btn-danger voice-broadcast__button voice-broadcast__button--danger" onClick={handleCancelBroadcast}>
              Cancel Broadcast
            </button>
          )}
        </div>
      </div>

      <div className="progress-section voice-broadcast__progress-section">
        <div className="progress-meta voice-broadcast__progress-meta">
          <span>{Math.round(progress)}% complete</span>
          <span>{stats.completed} completed - {stats.failed} failed - {remaining} remaining</span>
        </div>
        <div className="progress-bar voice-broadcast__progress-bar" aria-label="Broadcast progress">
          <div className="progress-fill voice-broadcast__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="stats-grid-voice voice-broadcast__stats-grid">
        {statCards.map((card) => (
          <div className={`stat-card stat-card-${card.key} voice-broadcast__stat-card voice-broadcast__stat-card--${card.key}`} key={card.key}>
            <div className={`stat-icon-broadcast icon-${card.key} voice-broadcast__stat-icon voice-broadcast__stat-icon--${card.key}`}>
              {React.createElement(card.icon, { size: 22 })}
            </div>
            <div className="stat-content voice-broadcast__stat-content">
              <span className="stat-value voice-broadcast__stat-value">{card.value}</span>
              <span className="stat-label voice-broadcast__stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="filter-tabs voice-broadcast__filter-tabs">
        {STATUS_FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.key}
            className={`filter-tab voice-broadcast__filter-tab ${selectedStatus === filter.key ? 'active' : ''}`}
            onClick={() => handleStatusChange(filter.key)}
          >
            {filter.label} ({stats[filter.stat] || 0})
          </button>
        ))}
      </div>

      <CallsTable
        calls={calls}
        getStatusColor={getStatusColor}
        maxRetries={broadcast?.config?.maxRetries || 2}
        pagination={callPagination}
        loading={callsLoading}
        error={callsError}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </div>
  );
};

export default BroadcastMonitor;
