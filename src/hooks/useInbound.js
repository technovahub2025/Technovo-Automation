import { useState, useCallback, useEffect, useRef } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';
import {
  normalizeInboundCall,
  normalizeQueueStatus,
  normalizeRoutingRules
} from '../utils/inboundNormalizers';
import {
  readSidebarPageCache,
  resolveCacheUserId,
  writeSidebarPageCache
} from '../utils/sidebarPageCache';

const INBOUND_PAGE_CACHE_NAMESPACE = 'inbound-page';
const INBOUND_PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

const unwrapAnalyticsPayload = (payload) => {
  let current = payload;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      break;
    }

    if (current.analytics && typeof current.analytics === 'object') {
      current = current.analytics;
      continue;
    }

    if (current.overview && typeof current.overview === 'object') {
      current = current.overview;
      continue;
    }

    if (current.data && typeof current.data === 'object' && !Array.isArray(current.data)) {
      current = current.data;
      continue;
    }

    break;
  }

  return current || null;
};

const normalizeAnalytics = (payload) => unwrapAnalyticsPayload(payload);

const buildInboundCachePayload = (period, snapshot) => ({
  period,
  analytics: snapshot.analytics,
  queueStatus: snapshot.queueStatus,
  routingRules: snapshot.routingRules,
  leadsSummary: snapshot.leadsSummary,
  timestamp: snapshot.timestamp
});

const hydrateInboundSnapshot = (payload = {}) => normalizeInboundSnapshot(payload);

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
  analytics: normalizeAnalytics(payload.overview || payload.analytics || payload.data || null),
  queueStatus: normalizeQueueStatus(payload.queues || payload.queueStatus || {}),
  routingRules: normalizeRoutingRules(payload.routingRules || []),
  leadsSummary: payload.leadsSummary || { contactsUsed: 0, total: 0 },
  timestamp: payload.timestamp || new Date().toISOString()
});

const fetchInboundFallback = async (period) => {
  const [analyticsRes, queueRes, routingRes] = await Promise.allSettled([
    apiService.getInboundAnalytics(period, { skipSocket: true }),
    apiService.getQueueStatus(),
    apiService.getRoutingRules()
  ]);

  const analytics = analyticsRes.status === 'fulfilled'
    ? normalizeAnalytics(analyticsRes.value.data)
    : null;
  const queueStatus = queueRes.status === 'fulfilled'
    ? normalizeQueueStatus(queueRes.value.data)
    : {};
  const routingRules = routingRes.status === 'fulfilled'
    ? normalizeRoutingRules(
        routingRes.value?.data?.routingRules ||
        routingRes.value?.data?.rules ||
        routingRes.value?.data ||
        []
      )
    : [];

  const error = [
    analyticsRes.status === 'rejected'
      ? analyticsRes.reason?.response?.data?.error || analyticsRes.reason?.message || 'Failed to load analytics'
      : '',
    queueRes.status === 'rejected'
      ? queueRes.reason?.response?.data?.error || queueRes.reason?.message || 'Failed to load queue status'
      : '',
    routingRes.status === 'rejected'
      ? routingRes.reason?.response?.data?.error || routingRes.reason?.message || 'Failed to load routing rules'
      : ''
  ].filter(Boolean).join('; ');

  return {
    analytics,
    queueStatus,
    routingRules,
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
  const hasHydratedSnapshotRef = useRef(false);

  const applySnapshot = useCallback((payload = {}, { persist = true } = {}) => {
    const snapshot = normalizeInboundSnapshot(payload);
    setAnalytics(snapshot.analytics);
    setQueueStatus(snapshot.queueStatus);
    setRoutingRules(snapshot.routingRules);
    setLeadsSummary(snapshot.leadsSummary);
    setError(null);
    hasHydratedSnapshotRef.current = true;

    if (persist) {
      writeSidebarPageCache(
        INBOUND_PAGE_CACHE_NAMESPACE,
        buildInboundCachePayload(period, snapshot),
        {
          currentUserId: resolveCacheUserId(),
          ttlMs: INBOUND_PAGE_CACHE_TTL_MS
        }
      );
    }
  }, [period]);

  useEffect(() => {
    const cachedInboundPage = readSidebarPageCache(
      INBOUND_PAGE_CACHE_NAMESPACE,
      {
        currentUserId: resolveCacheUserId(),
        allowStale: true
      }
    );

    if (!cachedInboundPage?.data || cachedInboundPage.data.period !== period) {
      hasHydratedSnapshotRef.current = false;
      return;
    }

    const snapshot = hydrateInboundSnapshot(cachedInboundPage.data);
    setAnalytics(snapshot.analytics);
    setQueueStatus(snapshot.queueStatus);
    setRoutingRules(snapshot.routingRules);
    setLeadsSummary(snapshot.leadsSummary);
    setError(null);
    setLoading(false);
    hasHydratedSnapshotRef.current = true;
  }, [period]);

  const refreshInbound = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const shouldShowLoading = !hasHydratedSnapshotRef.current;
    if (shouldShowLoading) {
      setLoading(true);
    }

    const fallbackPromise = fetchInboundFallback(period)
      .then((fallback) => {
        if (!mountedRef.current || requestSeq !== requestSeqRef.current) return;
        if (fallback.analytics || Object.keys(fallback.queueStatus || {}).length || (fallback.routingRules || []).length) {
          applySnapshot(fallback);
        } else {
          hasHydratedSnapshotRef.current = true;
        }
        setError(fallback.error || null);
        setLoading(false);
      })
      .catch((fallbackError) => {
        if (!mountedRef.current || requestSeq !== requestSeqRef.current) return;
        setError(fallbackError?.message || 'Failed to load inbound snapshot');
        setLoading(false);
      });

    await fallbackPromise;
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
      if (payload.overview || payload.analytics) {
        setAnalytics(normalizeAnalytics(payload.overview || payload.analytics));
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
      socket.emit('inbound:subscribe', { period }, (response = {}) => {
        if (!mountedRef.current) return;
        if (response?.success !== false && (response?.overview || response?.analytics || response?.queues || response?.queueStatus)) {
          applySnapshot(response);
          setLoading(false);
        }
      });
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
            socket.emit('inbound:subscribe', { period }, (response = {}) => {
              if (!mountedRef.current) return;
              if (response?.success !== false && (response?.overview || response?.analytics || response?.queues || response?.queueStatus)) {
                applySnapshot(response);
                setLoading(false);
              }
            });
          }
        }, 0);
      } else if (typeof socket.connect === 'function') {
        socket.connect();
      }
    }

    refreshInbound().catch(() => {});

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
  }, [applySnapshot, period, refreshInbound]);

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
