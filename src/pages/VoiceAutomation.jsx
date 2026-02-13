import React, { useState, useEffect } from 'react';
import { Phone, Mic, Settings, Users, BarChart3, Activity, PhoneCall, Bot, FileText, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import socketService from '../services/socketService';
import './VoiceAutomation.css';

const VoiceAutomation = () => {
  //const VITE_API_URL_ROUTE='/api/message/bulknode'
  const navigate = useNavigate();
  const [activeCalls, setActiveCalls] = useState([]);
  const [callStats, setCallStats] = useState(null);
  const [healthStatus, setHealthStatus] = useState({
    backend: false,
    ai: false
  });
  const [loading, setLoading] = useState(true);


  // Fetch active calls
  const fetchActiveCalls = async () => {
    try {
      const response = await apiService.getActiveCalls();
      setActiveCalls(response.data.calls || []);
    } catch (error) {
      console.error('Failed to fetch active calls:', error);
    }
  };

  // Fetch call statistics
  const fetchCallStats = async () => {
    try {
      const response = await apiService.getCallStats();
      setCallStats(response.data);
    } catch (error) {
      console.error('Failed to fetch call stats:', error);
    }
  };

  // Check system health
  const checkHealth = async () => {
    try {
      const [backendHealth, aiHealth] = await Promise.all([
        apiService.checkBackendHealth(),
        apiService.checkAIHealth()
      ]);

      setHealthStatus({
        backend: backendHealth.data.status === 'online',
        ai: aiHealth.data.status === 'healthy'
      });
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Initial data load
    checkHealth();
    fetchActiveCalls();
    fetchCallStats();

    // Connect to Socket.io server using shared service
    const socket = socketService.connect();

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    // Listen for active calls updates
    socket.on('calls_update', (data) => {
      console.log('📞 Active calls updated:', data);
      setActiveCalls(data.calls || []);
    });

    // Listen for stats updates
    socket.on('stats_update', (data) => {
      console.log('📊 Stats updated:', data);
      setCallStats(data);
    });

    // Listen for health updates
    socket.on('health_update', (data) => {
      console.log('🏥 Health updated:', data);
      setHealthStatus({
        backend: data.backend,
        ai: data.ai
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    // Cleanup on unmount - only remove listeners, keep socket connected
    return () => {
      socket.off('calls_update');
      socket.off('stats_update');
      socket.off('health_update');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div className="voice-automation">
      <h2>Voice Automation</h2>
      <p className="subtitle">
        Setup AI voice calls, auto responses, and call workflows
      </p>

      {/* System Health Status */}
      <div className="health-status">
        <div className={`status-badge ${healthStatus.backend ? 'online' : 'offline'}`}>
          Backend: {healthStatus.backend ? '🟢 Online' : '🔴 Offline'}
        </div>
        <div className={`status-badge ${healthStatus.ai ? 'online' : 'offline'}`}>
          AI Service: {healthStatus.ai ? '🟢 Healthy' : '🔴 Unhealthy'}
        </div>
        <div className="status-badge">
          Active Calls: {activeCalls.length}
        </div>
      </div>

      {/* Voice Cards */}
      <div className="voice-cards">
        <div className="voice-card">
          <PhoneCall size={28} />
          <h4>Inbound Calls</h4>
          <p>Manage IVR menus, queues, and call routing with advanced features.</p>
          <button
            className="card-button"
            onClick={() => navigate('/voice-automation/inbound')}
          >
            Configure
          </button>
        </div>

        <div className="voice-card">
          <Mic size={28} />
          <h4>Outbound Calls</h4>
          <p>Trigger automated voice calls for reminders or follow-ups.</p>
          <button
            className="card-button"
            onClick={() => navigate('/voice-automation/outbound')}
          >
            Make Call
          </button>
        </div>

        <div className="voice-card">
          <PhoneCall size={28} />
          <h4>Voice Broadcast</h4>
          <p style={{ height: "40px" }}>Send bulk voice messages to multiple contacts.</p>
          <button
            className="card-button"
            onClick={() => navigate('/voice-broadcast')}
          >
            Start Broadcast
          </button>
        </div>

        <div className="voice-card">
          <BarChart3 size={28} />
          <h4>Call Logs & Analytics</h4>
          <p style={{ height: "40px" }}>View detailed call history, statistics, and exported data.</p>
          <button
            className="card-button"
            onClick={() => navigate('/voice-automation/history')}
          >
            View Logs
          </button>
        </div>
      </div>

      {/* Active Calls Section */}
      {activeCalls.length > 0 && (
        <div className="active-calls-section">
          <h3>Active Calls</h3>
          <div className="calls-list">
            {activeCalls.map((call, index) => (
              <div key={call.call_sid || `call-${index}`} className="call-item">
                <div className="call-info">
                  <span className="call-sid">{call.call_sid}</span>
                  <span className="call-status">
                    {call.connected ? '🟢 Connected' : '🔴 Disconnected'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Statistics */}
      {callStats && (
        <div className="stats-section">
          <h3>Today's Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card-voice">
              <h4>{callStats.totalCalls || 0}</h4>
              <p>Total Calls</p>
            </div>
            <div className="stat-card-voice">
              <h4>{callStats.avgDuration || 0}s</h4>
              <p>Avg Duration</p>
            </div>
            <div className="stat-card-voice">
              <h4>{callStats.successRate || 0}%</h4>
              <p>Success Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading voice automation...</p>
        </div>
      )}

      {/* Voice Broadcast Section */}
      {/* Removed modal to use dedicated page instead */}
    </div>
  );
};

export default VoiceAutomation;