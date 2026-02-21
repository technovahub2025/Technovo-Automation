import { useState, useCallback, useEffect } from 'react';
import apiService from '../services/api';
import socketService from '../services/socketService';

const normalizeAnalytics = (payload) => payload?.data || payload || null;

const normalizeQueueStatus = (raw) => {
  if (!raw || typeof raw !== 'object') return {};

  const normalized = {};
  Object.entries(raw).forEach(([queueName, queueValue]) => {
    if (Array.isArray(queueValue)) {
      normalized[queueName] = queueValue;
      return;
    }

    if (queueValue && Array.isArray(queueValue.calls)) {
      normalized[queueName] = queueValue.calls.map((caller) => ({
        ...caller,
        phoneNumber: caller.phoneNumber || caller.from || caller.callerNumber || '-'
      }));
    }
  });

  return normalized;
};

export const useInbound = () => {
  const [analytics, setAnalytics] = useState(null);
  const [queueStatus, setQueueStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const refreshAnalytics = useCallback(async (period = 'today', retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getInboundAnalytics(period);
      setAnalytics(normalizeAnalytics(response.data));
    } catch (err) {
      if (retryCount < 2 && (err.code === 'NETWORK_ERROR' || err.code === 'ECONNABORTED')) {
        setTimeout(() => refreshAnalytics(period, retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      setError(err.response?.data?.error || err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshQueueStatus = useCallback(async (retryCount = 0) => {
    try {
      setError(null);

      const response = await apiService.getQueueStatus();
      setQueueStatus(normalizeQueueStatus(response.data));
    } catch (err) {
      if (retryCount < 2 && (err.code === 'NETWORK_ERROR' || err.code === 'ECONNABORTED')) {
        setTimeout(() => refreshQueueStatus(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      setError(err.response?.data?.error || err.message || 'Failed to load queue status');
    }
  }, []);

  const refreshInbound = useCallback(async (period = 'today') => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsRes, queueRes] = await Promise.allSettled([
        apiService.getInboundAnalytics(period),
        apiService.getQueueStatus()
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(normalizeAnalytics(analyticsRes.value.data));
      } else {
        const errorMessage = analyticsRes.reason?.response?.data?.error ||
          analyticsRes.reason?.message ||
          'Failed to load analytics';
        setError(errorMessage);
      }

      if (queueRes.status === 'fulfilled') {
        setQueueStatus(normalizeQueueStatus(queueRes.value.data));
      } else {
        const errorMessage = queueRes.reason?.response?.data?.error ||
          queueRes.reason?.message ||
          'Failed to load queue status';
        setError((prev) => (prev ? `${prev}; ${errorMessage}` : errorMessage));
      }

      const socket = socketService.connect();
      if (socket && socketService.isConnected()) {
        socket.emit('inbound_data_refreshed', {
          period,
          timestamp: new Date().toISOString(),
          analyticsFetched: analyticsRes.status === 'fulfilled',
          queueStatusFetched: queueRes.status === 'fulfilled'
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const socket = socketService.connect();

    const updateSocketConnectionStatus = () => {
      setSocketConnected(socketService.isConnected());
    };

    updateSocketConnectionStatus();

    if (socket) {
      const handleInboundCallUpdate = () => refreshAnalytics();
      const handleQueueUpdate = () => refreshQueueStatus();
      const handleCallStatusUpdate = () => refreshInbound();

      socket.on('connect', updateSocketConnectionStatus);
      socket.on('disconnect', updateSocketConnectionStatus);
      socket.on('inbound_call_update', handleInboundCallUpdate);
      socket.on('queue_update', handleQueueUpdate);
      socket.on('call_status_update', handleCallStatusUpdate);

      return () => {
        socket.off('connect', updateSocketConnectionStatus);
        socket.off('disconnect', updateSocketConnectionStatus);
        socket.off('inbound_call_update', handleInboundCallUpdate);
        socket.off('queue_update', handleQueueUpdate);
        socket.off('call_status_update', handleCallStatusUpdate);
      };
    }

    return undefined;
  }, [refreshAnalytics, refreshQueueStatus, refreshInbound]);

  return {
    analytics,
    queueStatus,
    loading,
    error,
    socketConnected,
    refreshAnalytics,
    refreshQueueStatus,
    refreshInbound,
    setError
  };
};
