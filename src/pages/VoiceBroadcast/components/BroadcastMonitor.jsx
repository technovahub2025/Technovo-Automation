import React, { useState, useEffect, useRef } from 'react';
import { Activity, Phone, CheckCircle, XCircle, Clock, Users, TrendingUp, Wifi, WifiOff, PhoneOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { broadcastAPI } from '../../../services/broadcastAPI';
import CallsTable from './CallsTable';
import StatsChart from './StatsChart';
import './BroadcastMonitor.css';

const resolveSocketUrl = () => {
  const configuredSocket = import.meta.env.VITE_SOCKET_URL || '';
  const configuredAdminApi = import.meta.env.VITE_API_ADMIN_URL || '';
  const configuredApiBase = import.meta.env.VITE_API_BASE_URL || '';
  const configuredApi = import.meta.env.VITE_API_URL || '';
  return (
    configuredSocket ||
    configuredAdminApi ||
    (configuredApiBase ? configuredApiBase.replace(/\/api\/?$/, '') : '') ||
    (configuredApi ? configuredApi.replace(/\/api\/?$/, '') : window.location.origin)
  );
};

const resolveSocketAuth = () => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
  const token = localStorage.getItem(tokenKey) || localStorage.getItem('authToken') || localStorage.getItem('token');
  return token ? { token } : undefined;
};

const BroadcastMonitor = ({ broadcastId }) => {
  const [broadcast, setBroadcast] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio('/notification.mp3'));

  useEffect(() => {
    loadBroadcastData();
    connectWebSocket();

    return () => {
      cleanupSocket();
    };
  }, [broadcastId]);

  const cleanupSocket = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_broadcast', broadcastId);
      socketRef.current.off('connect');
      socketRef.current.off('broadcast_update');
      socketRef.current.off('call_update');
      socketRef.current.off('disconnect');
      socketRef.current.off('connect_error');
      socketRef.current.off('reconnect');
      socketRef.current.off('reconnect_attempt');
      socketRef.current.off('reconnect_error');
      socketRef.current.io?.off('reconnect');
      socketRef.current.io?.off('reconnect_attempt');
      socketRef.current.io?.off('reconnect_error');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const loadBroadcastData = async () => {
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
  };

  const connectWebSocket = () => {
    if (socketRef.current?.connected) return;

    const socket = io(resolveSocketUrl(), {
      auth: resolveSocketAuth(),
      transports: ['websocket', 'polling'],
      withCredentials: String(import.meta.env.VITE_SOCKET_WITH_CREDENTIALS || import.meta.env.VITE_API_WITH_CREDENTIALS || 'false').toLowerCase() === 'true',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      socket.emit('join_broadcast', broadcastId);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (reason === 'io client disconnect') return;
      setConnectionStatus('reconnecting');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      if (String(error?.message || '').toLowerCase().includes('unauthorized')) {
        // Keep UI stable when REST polling works but socket auth fails transiently.
        setConnectionStatus((prev) => (prev === 'connected' ? prev : 'error'));
        return;
      }
      // Ignore transient transport errors after a successful connection.
      if (socket.connected) {
        setConnectionStatus('connected');
        return;
      }
      setConnectionStatus(prev => (prev === 'connected' ? 'connected' : 'error'));
    });

    socket.on('broadcast_update', (data) => {
      console.log('Broadcast update:', data);
      setConnectionStatus('connected');
      setBroadcast(prev => ({
        ...prev,
        status: data.status,
        stats: data.stats || prev.stats
      }));
    });

    socket.on('call_update', (data) => {
      console.log('Call update:', data);
      setConnectionStatus('connected');

      setCalls(prev => {
        const index = prev.findIndex(c => c._id === data.callId || c.callSid === data.callSid);

        if (index !== -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: data.status,
            duration: data.duration || updated[index].duration,
            attempts: data.attempts ?? updated[index].attempts,
            callSid: data.callSid || updated[index].callSid
          };
          return updated;
        } else {
          // New call not in list - fetch full list
          loadBroadcastData();
          return prev;
        }
      });

      // Play notification for completed calls
      if (data.status === 'completed') {
        audioRef.current.play().catch(() => { });
      }
    });

    socket.io.on('reconnect_attempt', () => {
      setConnectionStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setConnectionStatus('connected');
      socket.emit('join_broadcast', broadcastId);
    });

    socket.io.on('reconnect_error', () => {
      setConnectionStatus(prev => (prev === 'connected' ? 'connected' : 'error'));
    });

    socketRef.current = socket;
  };

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
