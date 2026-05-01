import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Phone, CheckCircle, XCircle, Clock, Users, TrendingUp, Wifi, WifiOff, PhoneOff } from 'lucide-react';
import { broadcastAPI } from '../../../services/broadcastAPI';
import webSocketService from '../../../services/websocketService';
import CallsTable from './CallsTable';
import StatsChart from './StatsChart';
import './BroadcastMonitor.css';

const BroadcastMonitor = ({ broadcastId }) => {
  const [broadcast, setBroadcast] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const socketRef = useRef(null);

  const loadBroadcastData = useCallback(async () => {
    try {
      setLoading(true);

      const [broadcastData, callsData] = await Promise.all([
        broadcastAPI.getBroadcastStatus(broadcastId),
        broadcastAPI.getBroadcastCalls(broadcastId)
      ]);

      setBroadcast(broadcastData.data.broadcast);
      setCalls(callsData.data.calls);
      setConnectionStatus((prev) => (prev === 'connected' ? prev : 'connected'));
    } catch (error) {
      console.error('Failed to load broadcast data:', error);
    } finally {
      setLoading(false);
    }
  }, [broadcastId]);

  const handleConnect = useCallback(() => {
    setConnectionStatus('connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectionStatus('reconnecting');
  }, []);

  const handleConnectError = useCallback((error) => {
    console.error('WebSocket connection error:', error);
    setConnectionStatus((prev) => (prev === 'connected' ? 'connected' : 'error'));
  }, []);

  const handleBroadcastUpdate = useCallback((data = {}) => {
    const payloadBroadcast = data?.broadcast || data?.data?.broadcast || null;
    const targetId = String(payloadBroadcast?._id || payloadBroadcast?.id || data?.broadcastId || '').trim();
    if (targetId && targetId !== String(broadcastId || '').trim()) {
      return;
    }

    console.log('Broadcast update:', data);
    setConnectionStatus('connected');

    if (payloadBroadcast) {
      setBroadcast((prev) => ({
        ...(prev || {}),
        ...payloadBroadcast,
        stats: payloadBroadcast.stats || prev?.stats || {}
      }));
    } else {
      loadBroadcastData();
    }
  }, [broadcastId, loadBroadcastData]);

  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.off('connect', handleConnect);
      socketRef.current.off('disconnect', handleDisconnect);
      socketRef.current.off('connect_error', handleConnectError);
      socketRef.current.off('broadcast_updated', handleBroadcastUpdate);
      socketRef.current.off('broadcast_update', handleBroadcastUpdate);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [handleBroadcastUpdate, handleConnect, handleConnectError, handleDisconnect]);

  const connectWebSocket = useCallback(() => {
    const socket = webSocketService.connect(String(broadcastId || 'broadcast-monitor'));
    if (!socket) {
      setConnectionStatus('error');
      return;
    }

    socketRef.current = socket;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('broadcast_updated', handleBroadcastUpdate);
    socket.on('broadcast_update', handleBroadcastUpdate);

    setConnectionStatus(webSocketService.isConnected() ? 'connected' : 'connecting');
  }, [broadcastId, handleBroadcastUpdate, handleConnect, handleConnectError, handleDisconnect]);

  useEffect(() => {
    loadBroadcastData();
    connectWebSocket();

    return () => {
      cleanupSocket();
    };
  }, [broadcastId, cleanupSocket, connectWebSocket, loadBroadcastData]);

  const handleCancelBroadcast = async () => {
    if (!window.confirm('Are you sure you want to cancel this broadcast?')) {
      return;
    }

    try {
      await broadcastAPI.cancelBroadcast(broadcastId);
      loadBroadcastData();
    } catch (error) {
      console.error('Failed to cancel broadcast:', error);
      alert('Failed to cancel broadcast');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      queued: '#94a3b8',
      calling: '#3b82f6',
      answered: '#2563eb',
      completed: '#22c55e',
      failed: '#ef4444',
      opted_out: '#f59e0b'
    };
    return colors[status] || '#64748b';
  };

  const calculateProgress = () => {
    if (!broadcast || !broadcast.stats) return 0;
    const { total, completed, failed } = broadcast.stats;
    if (!total || total === 0) return 0;
    return ((completed + failed) / total) * 100;
  };

  const getFilteredCalls = () => {
    if (selectedStatus === 'all') return calls;
    return calls.filter(call => call.status === selectedStatus);
  };

  if (loading) {
    return (
      <div className="monitor-loading">
        <div className="spinner-large" />
        <p>Loading broadcast data...</p>
      </div>
    );
  }

  if (!broadcast) {
    return (
      <div className="monitor-error">
        <XCircle size={48} />
        <h3>Broadcast not found</h3>
      </div>
    );
  }

  return (
    <div className="broadcast-monitor">
      {/* Header */}
      <div className="monitor-header">
        <div className="header-info">
          <h2>{broadcast.name}</h2>
          <div className="header-badges">
            <span className={`status-badge status-${broadcast.status}`}>
              {broadcast.status.replace('_', ' ')}
            </span>
            {/* Connection Status Indicator */}
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi size={16} />
                  <span>Connected</span>
                </>
              ) : connectionStatus === 'reconnecting' || connectionStatus === 'connecting' ? (
                <>
                  <Wifi size={16} />
                  <span>Connecting...</span>
                </>
              ) : connectionStatus === 'error' ? (
                <>
                  <WifiOff size={16} />
                  <span>Connection Error</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>

        {broadcast.status === 'in_progress' && (
          <button
            className="btn btn-danger"
            onClick={handleCancelBroadcast}
          >
            Cancel Broadcast
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
        <span className="progress-text">
          {Math.round(calculateProgress())}% Complete
        </span>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid-voice">
        <div className="stat-card stat-card-total">
          <div className="stat-icon-broadcast icon-total">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.total}</span>
            <span className="stat-label">Total Contacts</span>
          </div>
        </div>

        <div className="stat-card stat-card-calling">
          <div className="stat-icon-broadcast icon-calling">
            <Phone size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.calling}</span>
            <span className="stat-label">Calling</span>
          </div>
        </div>

        <div className="stat-card stat-card-completed">
          <div className="stat-icon-broadcast icon-completed">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.completed}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>

        <div className="stat-card stat-card-failed">
          <div className="stat-icon-broadcast icon-failed">
            <XCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>

        <div className="stat-card stat-card-queued">
          <div className="stat-icon-broadcast icon-queued">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.queued}</span>
            <span className="stat-label">Queued</span>
          </div>
        </div>

        <div className="stat-card stat-card-rate">
          <div className="stat-icon-broadcast icon-rate">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">
              {broadcast.stats.completed > 0
                ? Math.round((broadcast.stats.completed / (broadcast.stats.completed + broadcast.stats.failed)) * 100)
                : 0}%
            </span>
            <span className="stat-label">Success Rate</span>
          </div>
        </div>

        <div className="stat-card stat-card-opted-out">
          <div className="stat-icon-broadcast icon-opted-out">
            <PhoneOff size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{broadcast.stats.opted_out || 0}</span>
            <span className="stat-label">Opted Out</span>
          </div>
        </div>
      </div>

      {/* Stats Chart */}
      <StatsChart broadcast={broadcast} />

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${selectedStatus === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('all')}
        >
          All Calls ({calls.length})
        </button>
        <button
          className={`filter-tab ${selectedStatus === 'completed' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('completed')}
        >
          Completed ({broadcast.stats.completed})
        </button>
        <button
          className={`filter-tab ${selectedStatus === 'failed' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('failed')}
        >
          Failed ({broadcast.stats.failed})
        </button>
        <button
          className={`filter-tab ${selectedStatus === 'calling' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('calling')}
        >
          In Progress ({broadcast.stats.calling})
        </button>
        <button
          className={`filter-tab ${selectedStatus === 'opted_out' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('opted_out')}
        >
          Opted Out ({broadcast.stats.opted_out || 0})
        </button>
      </div>

      {/* Calls Table */}
      <CallsTable
        calls={getFilteredCalls()}
        getStatusColor={getStatusColor}
        maxRetries={broadcast?.config?.maxRetries || 2}
      />
    </div>
  );
};

export default BroadcastMonitor;
