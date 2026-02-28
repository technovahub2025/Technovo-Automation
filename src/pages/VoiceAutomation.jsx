import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, BarChart3, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import socketService from '../services/socketService';
import './VoiceAutomation.css';

const VoiceAutomation = () => {
  const navigate = useNavigate();
  const [activeCalls, setActiveCalls] = useState([]);
  const [callStats, setCallStats] = useState(null);
  const [healthStatus, setHealthStatus] = useState({
    backend: false,
    ai: false
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  const formatCallTime = useCallback((call = {}) => {
    const sourceTime = call?.startTime || call?.createdAt;
    if (!sourceTime) return null;
    const date = new Date(sourceTime);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const normalizeStats = useCallback((payload = {}) => {
    const summary = payload?.summary || payload || {};

    const totalCalls = Number(summary?.totalCalls);
    const avgDuration = Number(summary?.avgDuration);
    const successRate = Number(summary?.successRate);

    return {
      totalCalls: Number.isFinite(totalCalls) ? totalCalls : 0,
      avgDuration: Number.isFinite(avgDuration) ? Math.round(avgDuration) : 0,
      successRate: Number.isFinite(successRate) ? successRate : 0
    };
  }, []);

  const mergeStats = useCallback(
    (incoming = {}) => {
      const next = normalizeStats(incoming);
      setCallStats((prev) => {
        if (!prev) return next;

        return {
          totalCalls: Number.isFinite(next.totalCalls) ? next.totalCalls : prev.totalCalls,
          avgDuration: Number.isFinite(next.avgDuration) ? next.avgDuration : prev.avgDuration,
          successRate: Number.isFinite(next.successRate) ? next.successRate : prev.successRate
        };
      });
      setLastUpdated(new Date().toISOString());
    },
    [normalizeStats]
  );

  const fetchActiveCalls = useCallback(async () => {
    try {
      const response = await apiService.getActiveCalls();
      const calls = response?.data?.calls || [];

      if (isMountedRef.current) {
        setActiveCalls(Array.isArray(calls) ? calls : []);
      }
    } catch (error) {
      console.error('Failed to fetch active calls:', error);
    }
  }, []);

  const fetchCallStats = useCallback(async () => {
    try {
      const unifiedResponse = await apiService.getVoiceTodayStats();
      const unifiedData = unifiedResponse?.data?.data || {};
      const unifiedSummary = unifiedData?.summary || {};
      const normalizedUnified = normalizeStats(unifiedSummary);

      if (isMountedRef.current) {
        setCallStats(normalizedUnified);
        setLastUpdated(new Date().toISOString());
      }
      return;
    } catch (unifiedError) {
      console.warn('Unified voice stats fetch failed, trying analytics fallback:', unifiedError?.message || unifiedError);
    }

    try {
      const analyticsResponse = await apiService.getInboundAnalytics('today', {
        callType: 'all',
        status: 'all'
      });

      const analyticsData = analyticsResponse?.data?.data || analyticsResponse?.data || {};
      const normalized = normalizeStats(analyticsData?.summary || {});

      if (isMountedRef.current) {
        setCallStats(normalized);
        setLastUpdated(new Date().toISOString());
      }
    } catch (error) {
      console.warn('Primary analytics stats fetch failed, using legacy stats fallback:', error?.message || error);
      try {
        const response = await apiService.getCallStats();
        if (isMountedRef.current) {
          mergeStats(response?.data || {});
        }
      } catch (fallbackError) {
        console.error('Failed to fetch call stats:', fallbackError);
      }
    }
  }, [mergeStats, normalizeStats]);

  const checkHealth = useCallback(async () => {
    const [backendHealth, aiHealth] = await Promise.allSettled([
      apiService.checkBackendHealth(),
      apiService.checkAIHealth()
    ]);

    const backendOk =
      backendHealth.status === 'fulfilled' &&
      (backendHealth.value?.data?.status === 'online' || backendHealth.value?.data?.status === 'ok');

    const aiOk = aiHealth.status === 'fulfilled' && aiHealth.value?.data?.status === 'healthy';

    if (backendHealth.status === 'rejected') {
      console.warn('Backend health check failed:', backendHealth.reason?.message || backendHealth.reason);
    }

    if (aiHealth.status === 'rejected') {
      console.warn('AI health check failed:', aiHealth.reason?.message || aiHealth.reason);
    }

    if (isMountedRef.current) {
      setHealthStatus({
        backend: backendOk,
        ai: aiOk
      });
    }
  }, []);

  const scheduleStatsRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      fetchCallStats();
      fetchActiveCalls();
    }, 350);
  }, [fetchActiveCalls, fetchCallStats]);

  useEffect(() => {
    isMountedRef.current = true;

    const initialize = async () => {
      await Promise.allSettled([checkHealth(), fetchActiveCalls(), fetchCallStats()]);

      if (isMountedRef.current) {
        setLoading(false);
      }
    };

    initialize();

    const socket = socketService.connect();

    const handleConnect = () => {
      console.log('WebSocket connected');
      socket.emit('join_analytics_room', {
        period: 'today',
        callType: 'all',
        status: 'all'
      });
      socket.emit('request_call_analytics', {
        period: 'today',
        callType: 'all',
        status: 'all',
        reason: 'voice_automation_dashboard'
      });
      socket.emit('subscribe_calls');
    };

    const handleDisconnect = () => {
      console.log('WebSocket disconnected');
    };

    const handleCallsUpdate = (data) => {
      const calls = data?.calls || [];
      setActiveCalls(Array.isArray(calls) ? calls : []);
    };

    const handleStatsUpdate = (data) => {
      mergeStats(data || {});
    };

    const handleAnalyticsUpdate = (data) => {
      const snapshot = data?.analytics || data?.data || data;
      if (!snapshot) return;
      mergeStats(snapshot?.summary || snapshot);
    };

    const handleCallEvent = (data) => {
      if (['call_started', 'call_ended', 'call_updated'].includes(data?.type)) {
        scheduleStatsRefresh();
      }
    };

    const handleOutboundUpdate = () => {
      scheduleStatsRefresh();
    };

    const handleInboundUpdate = () => {
      scheduleStatsRefresh();
    };

    const handleBroadcastUpdate = () => {
      scheduleStatsRefresh();
    };

    const handleHealthUpdate = (data) => {
      setHealthStatus({
        backend: Boolean(data?.backend),
        ai: Boolean(data?.ai)
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('calls_update', handleCallsUpdate);
    socket.on('stats_update', handleStatsUpdate);
    socket.on('call_analytics_update', handleAnalyticsUpdate);
    socket.on('call_event', handleCallEvent);
    socket.on('outbound_call_update', handleOutboundUpdate);
    socket.on('inbound_call_update', handleInboundUpdate);
    socket.on('broadcast_update', handleBroadcastUpdate);
    socket.on('call_status_update', handleOutboundUpdate);
    socket.on('health_update', handleHealthUpdate);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      isMountedRef.current = false;

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('calls_update', handleCallsUpdate);
      socket.off('stats_update', handleStatsUpdate);
      socket.off('call_analytics_update', handleAnalyticsUpdate);
      socket.off('call_event', handleCallEvent);
      socket.off('outbound_call_update', handleOutboundUpdate);
      socket.off('inbound_call_update', handleInboundUpdate);
      socket.off('broadcast_update', handleBroadcastUpdate);
      socket.off('call_status_update', handleOutboundUpdate);
      socket.off('health_update', handleHealthUpdate);
      socket.emit('leave_analytics_room');
      socket.emit('unsubscribe_calls');
    };
  }, [checkHealth, fetchActiveCalls, fetchCallStats, mergeStats, scheduleStatsRefresh]);

  return (
    <div className="voice-automation">
      <h2>Voice Automation</h2>
      <p className="subtitle">Setup AI voice calls, auto responses, and call workflows</p>

      <div className="health-status">
        <div className={`status-badge ${healthStatus.backend ? 'online' : 'offline'}`}>
          {healthStatus.backend && <span className="pulse-dot"></span>}
          Backend: {healthStatus.backend ? 'Online' : 'Offline'}
        </div>
        <div className={`status-badge ${healthStatus.ai ? 'online' : 'offline'}`}>
          {healthStatus.ai && <span className="pulse-dot"></span>}
          AI Service: {healthStatus.ai ? 'Healthy' : 'Unhealthy'}
        </div>
        <div className="status-badge">Active Calls: {activeCalls.length}</div>
      </div>

      <div className="voice-cards">
        <div className="voice-card">
          <PhoneCall size={28} />
          <h4>Inbound Calls</h4>
          <p>Manage IVR menus, queues, and call routing with advanced features.</p>
          <button className="card-button" onClick={() => navigate('/voice-automation/inbound')}>
            Configure
          </button>
        </div>

        <div className="voice-card">
          <Mic size={28} />
          <h4>Outbound Calls</h4>
          <p>Trigger automated voice calls for reminders or follow-ups.</p>
          <button className="card-button" onClick={() => navigate('/voice-automation/outbound')}>
            Make Call
          </button>
        </div>

        <div className="voice-card">
          <PhoneCall size={28} />
          <h4>Voice Broadcast</h4>
          <p style={{ height: '40px' }}>Send bulk voice messages to multiple contacts.</p>
          <button className="card-button" onClick={() => navigate('/voice-broadcast')}>
            Start Broadcast
          </button>
        </div>

        <div className="voice-card">
          <BarChart3 size={28} />
          <h4>Call Analytics</h4>
          <p style={{ height: '40px' }}>View detailed call history, statistics, and exported data.</p>
          <button className="card-button" onClick={() => navigate('/voice-automation/history')}>
            View Logs
          </button>
        </div>
      </div>

      {activeCalls.length > 0 && (
        <div className="active-calls-section">
          <h3>Active Calls</h3>
          <div className="calls-list">
            {activeCalls.map((call, index) => (
              <div key={call.call_sid || call.callSid || `call-${index}`} className="call-item minimal">
                <span className="call-time">{formatCallTime(call) ? `Started ${formatCallTime(call)}` : 'Live now'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {callStats && (
        <div className="stats-section">
          <h3>Today's Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card-voice stat-total">
              <h4>{callStats.totalCalls || 0}</h4>
              <p>Total Calls</p>
            </div>
            <div className="stat-card-voice stat-duration">
              <h4>{callStats.avgDuration || 0}s</h4>
              <p>Avg Duration</p>
            </div>
            <div className="stat-card-voice stat-success">
              <h4>{callStats.successRate || 0}%</h4>
              <p>Success Rate</p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading voice automation...</p>
        </div>
      )}
    </div>
  );
};

export default VoiceAutomation;
