import React, { useEffect, useMemo, useState } from 'react';
import { Users, Clock, Phone, AlertCircle } from 'lucide-react';
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
  const source = raw?.queueStatus || raw?.queues || raw || {};
  if (!source || typeof source !== 'object') return {};

  if (source.name && Array.isArray(source.calls)) {
    return normalizeQueueData({ [source.name]: source.calls });
  }

  const normalized = {};
  Object.entries(source).forEach(([queueName, queueValue]) => {
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
  const source = payload?.data?.queue || payload?.queue || payload || {};

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

const QueueMonitor = ({ queues: inboundQueues = {}, analyticsQueueStats: inboundAnalyticsQueueStats = {}, loading = false }) => {
  const [queues, setQueues] = useState({});
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [analyticsQueueStats, setAnalyticsQueueStats] = useState({
    avgWaitTime: null,
    maxWaitTime: null,
    abandonRate: null
  });

  useEffect(() => {
    setQueues(normalizeQueueData(inboundQueues));
  }, [inboundQueues]);

  useEffect(() => {
    setAnalyticsQueueStats(normalizeAnalyticsQueue(inboundAnalyticsQueueStats));
  }, [inboundAnalyticsQueueStats]);

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
        Number.isFinite(analyticsQueueStats.avgWaitTime) && analyticsQueueStats.avgWaitTime !== null && (callerCount === 0 || Number(analyticsQueueStats.avgWaitTime) > 0)
          ? Math.max(0, Math.floor(analyticsQueueStats.avgWaitTime))
          : avgWaitTime,
      longestWait:
        Number.isFinite(analyticsQueueStats.maxWaitTime) && analyticsQueueStats.maxWaitTime !== null && (callerCount === 0 || Number(analyticsQueueStats.maxWaitTime) > 0)
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
