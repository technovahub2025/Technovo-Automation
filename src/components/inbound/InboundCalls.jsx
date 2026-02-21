import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Phone, Users, Clock, Headphones, ArrowLeft } from 'lucide-react';
import './InboundCalls.css';
import QueueMonitor from '../QueueMonitor';
import IVRConfig from './ivr/IVRMenuConfig';
import RoutingRules from '../RoutingRules';
import LeadsPage from '../../pages/LeadsPage';
import useSocket from '../../hooks/useSocket';
import { useInbound } from '../../hooks/useInbound';

const ACTIVE_CALL_STATUSES = new Set(['initiated', 'ringing', 'in-progress']);

const toTimestamp = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getQueueEntries = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((caller, index) => ({
      ...caller,
      callSid: caller?.callSid || caller?.id || `queue-call-${index}`,
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
};

const normalizeQueuePayload = (incoming) => {
  const payload = incoming?.queueStatus || incoming || {};
  if (!payload || typeof payload !== 'object') return {};

  const normalized = {};
  Object.entries(payload).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      normalized[name] = getQueueEntries(value);
      return;
    }

    if (value && Array.isArray(value.calls)) {
      normalized[name] = getQueueEntries(value.calls);
    }
  });

  return normalized;
};

const mergeQueuePayload = (previous, incoming) => {
  const nextPayload = normalizeQueuePayload(incoming);
  if (!Object.keys(nextPayload).length) return previous;
  return { ...previous, ...nextPayload };
};

const formatDuration = (seconds) => {
  const total = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
};

const formatQueueName = (queueName) =>
  queueName
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRelativeTime = (dateValue) => {
  const timestamp = toTimestamp(dateValue);
  if (timestamp === null) return '-';

  const secondsAgo = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (secondsAgo < 60) return `${secondsAgo}s ago`;

  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const InboundCalls = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [realTimeData, setRealTimeData] = useState({
    activeCalls: 0,
    queueStatus: {},
    totalCalls: 0,
    avgWaitTime: 0
  });
  const [period] = useState('today');

  const { analytics, queueStatus, loading, error, refreshInbound } = useInbound();
  const { socket, connected, error: socketError } = useSocket();

  const handleCallsUpdate = useCallback((data) => {
    const activeCalls = Array.isArray(data?.calls)
      ? data.calls.filter((call) => ACTIVE_CALL_STATUSES.has(call?.status)).length
      : 0;

    setRealTimeData((prev) => ({
      ...prev,
      activeCalls
    }));
  }, []);

  const handleStatsUpdate = useCallback((data) => {
    setRealTimeData((prev) => ({
      ...prev,
      ...data
    }));
  }, []);

  const handleQueueUpdate = useCallback((data) => {
    setRealTimeData((prev) => ({
      ...prev,
      queueStatus: mergeQueuePayload(prev.queueStatus, data)
    }));
  }, []);

  const handleHealthUpdate = useCallback(() => {}, []);

  useEffect(() => {
    refreshInbound(period);
  }, [period, refreshInbound]);

  useEffect(() => {
    if (!socket || !connected) return undefined;

    socket.on('calls_update', handleCallsUpdate);
    socket.on('stats_update', handleStatsUpdate);
    socket.on('health_update', handleHealthUpdate);
    socket.on('queue_update', handleQueueUpdate);

    return () => {
      socket.off('calls_update', handleCallsUpdate);
      socket.off('stats_update', handleStatsUpdate);
      socket.off('health_update', handleHealthUpdate);
      socket.off('queue_update', handleQueueUpdate);
    };
  }, [socket, connected, handleCallsUpdate, handleStatsUpdate, handleHealthUpdate, handleQueueUpdate]);

  useEffect(() => {
    if (!queueStatus) return;

    setRealTimeData((prev) => ({
      ...prev,
      queueStatus: mergeQueuePayload(prev.queueStatus, queueStatus)
    }));
  }, [queueStatus]);

  const activeCallsFromAnalytics = useMemo(() => {
    const recentCalls = Array.isArray(analytics?.recentCalls) ? analytics.recentCalls : [];
    return recentCalls.filter((call) => ACTIVE_CALL_STATUSES.has(call?.status)).length;
  }, [analytics]);

  const queueOverview = useMemo(() => {
    const items = Object.entries(realTimeData.queueStatus || {}).map(([queueName, queue]) => {
      const queueArray = getQueueEntries(queue);
      return {
        queueName,
        queueArray,
        count: queueArray.length
      };
    });

    const totalQueued = items.reduce((sum, item) => sum + item.count, 0);
    const busiestQueue = items.reduce(
      (maxItem, current) => (current.count > maxItem.count ? current : maxItem),
      { queueName: '-', count: 0 }
    );

    let waitTotal = 0;
    let waitCount = 0;

    items.forEach((item) => {
      item.queueArray.forEach((caller) => {
        const queuedTs = toTimestamp(caller?.queuedAt);
        if (queuedTs === null) return;
        waitTotal += Math.max(0, Math.floor((Date.now() - queuedTs) / 1000));
        waitCount += 1;
      });
    });

    const avgWaitTime = waitCount > 0 ? Math.floor(waitTotal / waitCount) : 0;

    return {
      items,
      totalQueued,
      busiestQueue,
      avgWaitTime
    };
  }, [realTimeData.queueStatus]);

  const totalCalls = analytics?.summary?.totalCalls || 0;
  const averageDuration = analytics?.summary?.avgDuration || 0;
  const successRate = analytics?.summary?.answerRate || analytics?.summary?.successRate || 0;
  const activeCalls = realTimeData.activeCalls || activeCallsFromAnalytics;
  const queueAvgWait = Number.isFinite(Number(analytics?.queue?.avgWaitTime)) && Number(analytics?.queue?.avgWaitTime) > 0
    ? Number(analytics.queue.avgWaitTime)
    : queueOverview.avgWaitTime;

  const recentCalls = Array.isArray(analytics?.recentCalls) ? analytics.recentCalls.slice(0, 6) : [];

  const handleBack = () => {
    window.history.back();
  };

  const renderOverview = () => (
    <div className="inbound-overview">
      <div className="stats-grid-inbound">
        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Phone className="icon" />
          </div>
          <div className="stat-content">
            <h3>{totalCalls}</h3>
            <p>Total Calls Today</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Users className="icon" />
          </div>
          <div className="stat-content">
            <h3>{activeCalls}</h3>
            <p>Active Calls</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Clock className="icon" />
          </div>
          <div className="stat-content">
            <h3>{formatDuration(averageDuration)}</h3>
            <p>Average Duration</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Headphones className="icon" />
          </div>
          <div className="stat-content">
            <h3>{successRate}%</h3>
            <p>Answer Rate</p>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="queue-overview">
          <h3>Queue Status</h3>
          <div className="queue-list">
            {queueOverview.items.length === 0 && (
              <div className="queue-item">
                <div className="queue-info">
                  <h4>No active queues</h4>
                  <span className="queue-count">Calls will appear here in real time</span>
                </div>
              </div>
            )}

            {queueOverview.items.map(({ queueName, queueArray, count }) => (
              <div key={queueName} className="queue-item">
                <div className="queue-info">
                  <h4>{formatQueueName(queueName)}</h4>
                  <span className="queue-count">{count} callers</span>
                </div>
                <div className="queue-status">
                  <span className={`status-indicator ${count > 0 ? 'busy' : 'available'}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="queue-item" style={{ marginTop: 12 }}>
            <div className="queue-info">
              <h4>Overview</h4>
              <span className="queue-count">
                {queueOverview.totalQueued} waiting, avg wait {formatDuration(queueAvgWait)}, busiest {formatQueueName(queueOverview.busiestQueue.queueName)}
              </span>
            </div>
          </div>
        </div>

        <div className="recent-calls">
          <h3>Recent Calls</h3>
          <div className="call-list">
            {recentCalls.length === 0 && (
              <div className="call-item">
                <div className="call-info">
                  <span className="phone-number">No recent inbound calls</span>
                </div>
              </div>
            )}

            {recentCalls.map((call, index) => (
              <div key={call.callSid || `recent-call-${index}`} className="call-item">
                <div className="call-info">
                  <span className="phone-number">{call.phoneNumber || call.from || '-'}</span>
                  <span className="call-status">{call.status || 'unknown'}</span>
                </div>
                <div className="call-meta">
                  <span className="call-time">{formatRelativeTime(call.createdAt)}</span>
                  <span className="call-duration">{formatDuration(call.duration || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'queues':
        return <QueueMonitor socket={socket} />;
      case 'ivr':
        return <IVRConfig />;
      case 'routing':
        return <RoutingRules />;
      case 'leads':
        return <LeadsPage />;
      default:
        return renderOverview();
    }
  };

  if (loading && !analytics) {
    return (
      <div className="inbound-calls loading">
        <div className="loading-spinner"></div>
        <p>Loading inbound call data...</p>
      </div>
    );
  }

  return (
    <div className="inbound-calls">
      <div className="breadcrumb-nav">
        <button onClick={handleBack} className="back-link-btn">
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>

      <div className="inbound-header-new">
        <div className="header-info">
          <h1>Inbound Call Management</h1>
          <p className="header-subtitle">Manage IVR menus, queues, and call routing</p>
          <div className={`connected-badge ${connected ? 'connected' : 'disconnected'}`}>
            <span className="pulse-dot"></span>
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          {(socketError || error) && (
            <p className="header-subtitle">
              {socketError || error}
            </p>
          )}
        </div>


      </div>

      <div className="inbound-tabs-new">
        <button
          className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-link ${activeTab === 'queues' ? 'active' : ''}`}
          onClick={() => setActiveTab('queues')}
        >
          Queues
        </button>
        <button
          className={`tab-link ${activeTab === 'ivr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ivr')}
        >
          IVR Configuration
        </button>
        <button
          className={`tab-link ${activeTab === 'routing' ? 'active' : ''}`}
          onClick={() => setActiveTab('routing')}
        >
          Routing Rules
        </button>
        <button
          className={`tab-link ${activeTab === 'leads' ? 'active' : ''}`}
          onClick={() => setActiveTab('leads')}
        >
          Leads
        </button>
      </div>

      <div className="inbound-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default InboundCalls;

