import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Clock, Phone, AlertCircle } from 'lucide-react';
import apiService from '../services/api';
import './QueueMonitor.css';

const toTimestamp = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getWaitSeconds = (queuedAt) => {
  const queuedAtMs = toTimestamp(queuedAt);
  if (queuedAtMs === null) return 0;
  return Math.max(0, Math.floor((Date.now() - queuedAtMs) / 1000));
};

const normalizeQueueData = (raw) => {
  if (!raw || typeof raw !== 'object') return {};

  const normalized = {};
  Object.entries(raw).forEach(([queueName, queueValue]) => {
    const calls = Array.isArray(queueValue)
      ? queueValue
      : queueValue && Array.isArray(queueValue.calls)
        ? queueValue.calls
        : null;

    if (!calls) return;

    normalized[queueName] = calls
      .map((caller, index) => ({
        ...caller,
        callSid: caller?.callSid || caller?.id || `${queueName}-call-${index}`,
        phoneNumber: caller?.phoneNumber || caller?.from || caller?.callerNumber || '-',
        queuedAt: caller?.queuedAt || caller?.createdAt || null,
        position: Number.isFinite(Number(caller?.position)) ? Number(caller.position) : index + 1
      }))
      .sort((a, b) => {
        const aPosition = Number.isFinite(Number(a.position)) ? Number(a.position) : Number.MAX_SAFE_INTEGER;
        const bPosition = Number.isFinite(Number(b.position)) ? Number(b.position) : Number.MAX_SAFE_INTEGER;
        if (aPosition !== bPosition) return aPosition - bPosition;

        const aTime = toTimestamp(a.queuedAt);
        const bTime = toTimestamp(b.queuedAt);
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return aTime - bTime;
      });
  });

  return normalized;
};

const normalizeAnalyticsQueue = (payload) => {
  const source = payload?.data?.queue || payload?.queue || {};

  return {
    avgWaitTime: Number.isFinite(Number(source?.avgWaitTime)) ? Number(source.avgWaitTime) : null,
    maxWaitTime: Number.isFinite(Number(source?.maxWaitTime)) ? Number(source.maxWaitTime) : null,
    abandonRate: Number.isFinite(Number(source?.abandonRate)) ? Number(source.abandonRate) : null
  };
};

const formatQueueName = (queueName) =>
  queueName
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const QueueMonitor = ({ socket }) => {
  const [queues, setQueues] = useState({});
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [analyticsQueueStats, setAnalyticsQueueStats] = useState({
    avgWaitTime: null,
    maxWaitTime: null,
    abandonRate: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchQueueData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      setError('');

      const [queueResponse, analyticsResponse] = await Promise.allSettled([
        apiService.getQueueStatus(),
        apiService.getInboundAnalytics('today')
      ]);

      if (queueResponse.status === 'fulfilled') {
        setQueues(normalizeQueueData(queueResponse.value?.data));
      } else {
        const queueError = queueResponse.reason?.response?.data?.error || queueResponse.reason?.message || 'Failed to load queue data';
        setError((prev) => (prev ? `${prev}; ${queueError}` : queueError));
      }

      if (analyticsResponse.status === 'fulfilled') {
        setAnalyticsQueueStats(normalizeAnalyticsQueue(analyticsResponse.value?.data));
      }
    } catch (fetchError) {
      setError(fetchError?.response?.data?.error || fetchError?.message || 'Failed to load queue data');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);


  const handleQueueUpdate = useCallback((data) => {
    const normalized = normalizeQueueData(data?.queueStatus || data);

    if (!Object.keys(normalized).length) {
      fetchQueueData({ silent: true });
      return;
    }

    setQueues((prev) => ({ ...prev, ...normalized }));
  }, [fetchQueueData]);

  const handleCallerJoined = useCallback((data) => {
    if (!data?.queueName) return;

    const normalizedCaller = {
      callSid: data?.caller?.callSid || data?.callSid || `${data.queueName}-${Date.now()}`,
      phoneNumber: data?.caller?.phoneNumber || data?.caller?.from || data?.caller?.callerNumber || '-',
      queuedAt: data?.caller?.queuedAt || data?.caller?.createdAt || new Date().toISOString(),
      position: Number.isFinite(Number(data?.position)) ? Number(data.position) : null,
      ...(data?.caller || {})
    };

    setQueues((prev) => {
      const currentQueue = Array.isArray(prev[data.queueName]) ? prev[data.queueName] : [];
      const dedupedQueue = currentQueue.filter((entry) => entry.callSid !== normalizedCaller.callSid);
      const nextQueue = normalizeQueueData({ [data.queueName]: [...dedupedQueue, normalizedCaller] })[data.queueName] || [];

      return {
        ...prev,
        [data.queueName]: nextQueue
      };
    });
  }, []);

  const handleCallerLeft = useCallback((data) => {
    if (!data?.queueName || !data?.callSid) return;

    setQueues((prev) => ({
      ...prev,
      [data.queueName]: (prev[data.queueName] || []).filter((caller) => caller.callSid !== data.callSid)
    }));
  }, []);

  useEffect(() => {
    fetchQueueData({ silent: false });
  }, [fetchQueueData]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('queue_update', handleQueueUpdate);
    socket.on('caller_joined_queue', handleCallerJoined);
    socket.on('caller_left_queue', handleCallerLeft);

    return () => {
      socket.off('queue_update', handleQueueUpdate);
      socket.off('caller_joined_queue', handleCallerJoined);
      socket.off('caller_left_queue', handleCallerLeft);
    };
  }, [socket, handleQueueUpdate, handleCallerJoined, handleCallerLeft]);

  useEffect(() => {
    if (selectedQueue && !Object.prototype.hasOwnProperty.call(queues, selectedQueue)) {
      setSelectedQueue(null);
    }
  }, [queues, selectedQueue]);

  const realTimeStats = useMemo(() => {
    let totalInQueue = 0;
    let totalWaitTime = 0;
    let longestWait = 0;
    let callerCount = 0;

    Object.values(queues).forEach((queue) => {
      if (!Array.isArray(queue)) return;

      totalInQueue += queue.length;
      queue.forEach((caller) => {
        const waitTime = getWaitSeconds(caller?.queuedAt);
        totalWaitTime += waitTime;
        longestWait = Math.max(longestWait, waitTime);
        callerCount += 1;
      });
    });

    const avgWaitTime = callerCount > 0 ? Math.floor(totalWaitTime / callerCount) : 0;

    return {
      totalInQueue,
      avgWaitTime:
        Number.isFinite(analyticsQueueStats.avgWaitTime) && analyticsQueueStats.avgWaitTime !== null
          ? Math.max(0, Math.floor(analyticsQueueStats.avgWaitTime))
          : avgWaitTime,
      longestWait:
        Number.isFinite(analyticsQueueStats.maxWaitTime) && analyticsQueueStats.maxWaitTime !== null
          ? Math.max(longestWait, Math.floor(analyticsQueueStats.maxWaitTime))
          : longestWait,
      abandonmentRate:
        Number.isFinite(analyticsQueueStats.abandonRate) && analyticsQueueStats.abandonRate !== null
          ? Math.max(0, Number(analyticsQueueStats.abandonRate.toFixed(1)))
          : 0
    };
  }, [queues, analyticsQueueStats]);

  const formatWaitTime = (seconds) => {
    const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
    if (safeSeconds < 60) return `${safeSeconds}s`;

    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getQueueHealth = (queue) => {
    const length = queue.length;
    if (length === 0) return { status: 'empty', color: '#10b981', label: 'Available' };
    if (length <= 3) return { status: 'light', color: '#f59e0b', label: 'Light Load' };
    if (length <= 7) return { status: 'moderate', color: '#f97316', label: 'Moderate Load' };
    return { status: 'heavy', color: '#ef4444', label: 'Heavy Load' };
  };

  return (
    <div className="queue-monitor">
      <div className="queue-header">
        <h2>Queue Monitor</h2>
        <div className="queue-stats">
          <div className="stat-item">
            <Users size={16} />
            <span>{realTimeStats.totalInQueue} in queue</span>
          </div>
          <div className="stat-item">
            <Clock size={16} />
            <span>Avg wait: {formatWaitTime(realTimeStats.avgWaitTime)}</span>
          </div>
          <div className="stat-item">
            <Clock size={16} />
            <span>Longest wait: {formatWaitTime(realTimeStats.longestWait)}</span>
          </div>
          <div className="stat-item">
            <AlertCircle size={16} />
            <span>{realTimeStats.abandonmentRate}% abandonment</span>
          </div>
        </div>
      </div>


      {error && (
        <div className="empty-state" style={{ marginBottom: 16 }}>
          <AlertCircle size={32} />
          <h3>Queue data issue</h3>
          <p>{error}</p>
        </div>
      )}

      <div className="queue-grid">
        {Object.entries(queues).map(([queueName, queue]) => {
          const queueArray = Array.isArray(queue) ? queue : [];
          const health = getQueueHealth(queueArray);
          const isSelected = selectedQueue === queueName;

          return (
            <div
              key={queueName}
              className={`queue-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedQueue(isSelected ? null : queueName)}
            >
              <div className="queue-card-header">
                <div className="queue-title">
                  <h3>{formatQueueName(queueName)}</h3>
                  <span className="queue-badge" style={{ backgroundColor: health.color }}>
                    {health.label}
                  </span>
                </div>
                <div className="queue-metrics">
                  <div className="metric">
                    <Users size={14} />
                    <span>{queueArray.length}</span>
                  </div>
                  <div className="metric">
                    <Clock size={14} />
                    <span>
                      {queueArray.length > 0
                        ? formatWaitTime(Math.max(...queueArray.map((caller) => getWaitSeconds(caller?.queuedAt))))
                        : '0s'}
                    </span>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="queue-details">
                  <div className="queue-callers">
                    {queueArray.length === 0 ? (
                      <div className="empty-queue">
                        <Phone size={24} />
                        <p>No callers in queue</p>
                      </div>
                    ) : (
                      queueArray.map((caller, index) => {
                        const waitTime = getWaitSeconds(caller?.queuedAt);
                        return (
                          <div key={caller.callSid || `${queueName}-caller-${index}`} className="caller-item">
                            <div className="caller-info">
                              <div className="caller-position">#{caller?.position || index + 1}</div>
                              <div className="caller-details">
                                <span className="caller-phone">{caller.phoneNumber || '-'}</span>
                                <span className="caller-wait">Waiting {formatWaitTime(waitTime)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(queues).length === 0 && !loading && (
        <div className="empty-state">
          <Users size={48} />
          <h3>No Active Queues</h3>
          <p>Queue data will appear when calls are received</p>
        </div>
      )}
    </div>
  );
};

export default QueueMonitor;

