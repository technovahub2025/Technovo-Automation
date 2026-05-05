import { useState, useCallback, useEffect, useRef } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';
import {
  normalizeInboundCall,
  normalizeQueueStatus,
  normalizeRoutingRules
} from '../utils/inboundNormalizers';

const normalizeAnalytics = (payload) => payload?.data || payload || null;

const mergeQueueStatus = (previous, incoming) => {
  const normalized = normalizeQueueStatus(incoming);
  if (!Object.keys(normalized).length) {
    if (incoming?.queueName) {
      const next = { ...previous };
      delete next[incoming.queueName];
      return next;
    }
    return previous;
  }

  const next = { ...previous };
  Object.entries(normalized).forEach(([queueName, callers]) => {
    if (!Array.isArray(callers) || callers.length === 0) {
      delete next[queueName];
      return;
    }
    next[queueName] = callers;
  });
  return next;
};

const normalizeInboundSnapshot = (payload = {}) => ({
  analytics: normalizeAnalytics(payload.overview || payload.analytics || null),
  queueStatus: normalizeQueueStatus(payload.queues || payload.queueStatus || {}),
  routingRules: normalizeRoutingRules(payload.routingRules || []),
  leadsSummary: payload.leadsSummary || { contactsUsed: 0, total: 0 },
  timestamp: payload.timestamp || new Date().toISOString()
});

const fetchInboundFallback = async (period) => {
  const [analyticsRes, queueRes] = await Promise.allSettled([
    apiService.getInboundAnalytics(period),
    apiService.getQueueStatus()
  ]);

  const analytics = analyticsRes.status === 'fulfilled'
    ? normalizeAnalytics(analyticsRes.value.data)
    : null;
  const queueStatus = queueRes.status === 'fulfilled'
    ? normalizeQueueStatus(queueRes.value.data)
    : {};

  const error = [
    analyticsRes.status === 'rejected'
      ? analyticsRes.reason?.response?.data?.error || analyticsRes.reason?.message || 'Failed to load analytics'
      : '',
    queueRes.status === 'rejected'
      ? queueRes.reason?.response?.data?.error || queueRes.reason?.message || 'Failed to load queue status'
      : ''
  ].filter(Boolean).join('; ');

  return {
    analytics,
    queueStatus,
    routingRules: [],
    leadsSummary: { contactsUsed: 0, total: 0 },
    error
  };
};

export const useInbound = (period = 'today') => {
  const [analytics, setAnalytics] = useState(null);
  const [queueStatus, setQueueStatus] = useState({});
  const [routingRules, setRoutingRules] = useState([]);
  const [leadsSummary, setLeadsSummary] = useState({ contactsUsed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const pendingSnapshotRef = useRef(false);
  const mountedRef = useRef(false);
  const requestSeqRef = useRef(0);

  const applySnapshot = useCallback((payload = {}) => {
    const snapshot = normalizeInboundSnapshot(payload);
    setAnalytics(snapshot.analytics);
    setQueueStatus(snapshot.queueStatus);
    setRoutingRules(snapshot.routingRules);
    setLeadsSummary(snapshot.leadsSummary);
    setError(null);
  }, []);

  const refreshInbound = useCallback(async () => {
    const socket = socketService.connect();
    if (pendingSnapshotRef.current) return;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    if (!socket) {
      setLoading(true);
      const fallback = await fetchInboundFallback(period);
      if (!mountedRef.current || requestSeq !== requestSeqRef.current) return;
      setAnalytics(fallback.analytics);
      setQueueStatus(fallback.queueStatus);
      setError(fallback.error || null);
      setLoading(false);
      return;
    }

    pendingSnapshotRef.current = true;
    setLoading(true);

    const fallbackAfterFailure = async (message = '') => {
      const fallback = await fetchInboundFallback(period);
      if (!mountedRef.current || requestSeq !== requestSeqRef.current) return;
      setAnalytics(fallback.analytics);
      setQueueStatus(fallback.queueStatus);
      setError(message || fallback.error || null);
      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      if (!pendingSnapshotRef.current) return;
      pendingSnapshotRef.current = false;
      fallbackAfterFailure('Inbound socket snapshot timed out');
    }, 7000);

    socket.emit('inbound:subscribe', { period }, async (response = {}) => {
      window.clearTimeout(timeoutId);
      pendingSnapshotRef.current = false;
      if (!mountedRef.current || requestSeq !== requestSeqRef.current) return;

      if (response?.success !== false && (response?.overview || response?.queues || response?.queueStatus)) {
        applySnapshot(response);
        setLoading(false);
        return;
      }

      await fallbackAfterFailure(response?.error || 'Failed to load inbound snapshot');
    });
  }, [applySnapshot, period]);

  useEffect(() => {
    mountedRef.current = true;
    const socket = socketService.connect();

    const updateSocketConnectionStatus = () => {
      setSocketConnected(socketService.isConnected());
    };

    const handleSnapshot = (payload) => {
      applySnapshot(payload);
      setLoading(false);
    };

    const handleCallUpdate = (payload = {}) => {
      if (payload.overview) {
        setAnalytics(normalizeAnalytics(payload.overview));
      } else if (payload.summary || payload.recentCalls) {
        setAnalytics((prev) => ({
          ...(prev || {}),
          ...payload,
          recentCalls: Array.isArray(payload.recentCalls)
            ? payload.recentCalls.map((call, index) => normalizeInboundCall(call, `recent-${index}`))
            : prev?.recentCalls
        }));
      }
    };

    const handleQueueUpdate = (payload = {}) => {
      setQueueStatus((prev) => mergeQueueStatus(prev, payload));
    };

    const handleRoutingRulesUpdate = (payload = {}) => {
      const rules = normalizeRoutingRules(payload.routingRules || payload.rules || []);
      if (rules.length || Array.isArray(payload.routingRules) || Array.isArray(payload.rules)) {
        setRoutingRules(rules);
      }
    };

    const handleLeadUpdate = (payload = {}) => {
      if (payload.action === 'created') {
        setLeadsSummary((prev) => ({
          contactsUsed: Number(prev.contactsUsed || prev.total || 0) + 1,
          total: Number(prev.total || prev.contactsUsed || 0) + 1
        }));
      }
    };

    const handleConnect = () => {
      updateSocketConnectionStatus();
      refreshInbound();
    };

    updateSocketConnectionStatus();

    if (socket) {
      socket.on('connect', handleConnect);
      socket.on('disconnect', updateSocketConnectionStatus);
      socket.on('inbound:snapshot', handleSnapshot);
      socket.on('inbound:call:update', handleCallUpdate);
      socket.on('inbound:queue:update', handleQueueUpdate);
      socket.on('inbound:routing_rules:update', handleRoutingRulesUpdate);
      socket.on('routing_rules:changed', handleRoutingRulesUpdate);
      socket.on('inbound_lead_update', handleLeadUpdate);

      if (socket.connected || socketService.isConnected()) {
        window.setTimeout(() => {
          if (mountedRef.current) {
            refreshInbound();
          }
        }, 0);
      } else if (typeof socket.connect === 'function') {
        socket.connect();
      }
    }

    return () => {
      mountedRef.current = false;
      pendingSnapshotRef.current = false;
      if (!socket) return;
      socket.emit('inbound:unsubscribe');
      socket.off('connect', handleConnect);
      socket.off('disconnect', updateSocketConnectionStatus);
      socket.off('inbound:snapshot', handleSnapshot);
      socket.off('inbound:call:update', handleCallUpdate);
      socket.off('inbound:queue:update', handleQueueUpdate);
      socket.off('inbound:routing_rules:update', handleRoutingRulesUpdate);
      socket.off('routing_rules:changed', handleRoutingRulesUpdate);
      socket.off('inbound_lead_update', handleLeadUpdate);
    };
  }, [applySnapshot, refreshInbound]);

  return {
    analytics,
    queueStatus,
    routingRules,
    leadsSummary,
    loading,
    error,
    socketConnected,
    refreshInbound,
    setError
  };
};
