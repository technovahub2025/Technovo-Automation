import React, { useState, useEffect } from 'react';
import { Phone, Users, Clock, TrendingUp, Settings, BarChart3, Headphones, MessageSquare, ArrowLeft } from 'lucide-react';
import './InboundCalls.css';
import QueueMonitor from '../components/QueueMonitor';
import IVRConfig from '../components/IVRConfig';
import CallAnalytics from '../components/CallAnalytics';
import RoutingRules from '../components/RoutingRules';
import useSocket from '../hooks/useSocket';
import { apiService } from '../services/api';

const InboundCalls = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [realTimeData, setRealTimeData] = useState({
    activeCalls: 0,
    queueStatus: {},
    totalCalls: 0,
    avgWaitTime: 0
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today'); // Add period state

  // WebSocket connection for real-time updates
  const { socket, connected, error } = useSocket();

  useEffect(() => {
    fetchInitialData();
    
    if (socket && connected) {
      // Real backend events
      socket.on('calls_update', handleCallsUpdate);
      socket.on('stats_update', handleStatsUpdate);
      socket.on('health_update', handleHealthUpdate);
    }

    return () => {
      if (socket) {
        socket.off('calls_update', handleCallsUpdate);
        socket.off('stats_update', handleStatsUpdate);
        socket.off('health_update', handleHealthUpdate);
      }
    };
  }, [socket, connected]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      
      // Fetch analytics using existing apiService
      const analyticsData = await apiService.getInboundAnalytics(period);
      setAnalytics(analyticsData.data);

      // Fetch real-time metrics using existing apiService
      const queueData = await apiService.getQueueStatus();
      
      setRealTimeData(prev => ({
        ...prev,
        queueStatus: queueData.data
      }));

    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallsUpdate = (data) => {
    setRealTimeData(prev => ({
      ...prev,
      activeCalls: data.calls?.filter(c => ['initiated', 'ringing', 'in-progress'].includes(c.status)).length || 0
    }));
  };

  const handleStatsUpdate = (data) => {
    setRealTimeData(prev => ({
      ...prev,
      ...data
    }));
  };

  const handleHealthUpdate = (data) => {
    console.log('Health update received:', data);
    // Can be used to show backend health status
  };

  const handleBack = () => {
    // Navigate back to previous page or dashboard
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
            <h3>{analytics?.summary?.totalCalls || 0}</h3>
            <p>Total Calls Today</p>
            <span className="stat-change positive">
              <TrendingUp size={16} />
              +12% from yesterday
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Users className="icon" />
          </div>
          <div className="stat-content">
            <h3>{realTimeData.activeCalls}</h3>
            <p>Active Calls</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Clock className="icon" />
          </div>
          <div className="stat-content">
            <h3>{analytics?.summary?.avgDuration || 0}s</h3>
            <p>Average Duration</p>
            <span className="stat-change positive">
              <TrendingUp size={16} />
              +5s improvement
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-inbound">
            <Headphones className="icon" />
          </div>
          <div className="stat-content">
            <h3>{analytics?.summary?.successRate || 0}%</h3>
            <p>Success Rate</p>
            <span className="stat-change positive">
              <TrendingUp size={16} />
              Above target
            </span>
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <div className="queue-overview">
          <h3>Queue Status</h3>
          <div className="queue-list">
            {Object.entries(realTimeData.queueStatus || {}).map(([queueName, queue]) => (
              <div key={queueName} className="queue-item">
                <div className="queue-info">
                  <h4>{queueName.charAt(0).toUpperCase() + queueName.slice(1)}</h4>
                  <span className="queue-count">{queue.length} callers</span>
                </div>
                <div className="queue-status">
                  <span className={`status-indicator ${queue.length > 0 ? 'busy' : 'available'}`}></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-calls">
          <h3>Recent Calls</h3>
          <div className="call-list">
            {analytics?.recentCalls?.slice(0, 5).map(call => (
              <div key={call.callSid} className="call-item">
                <div className="call-info">
                  <span className="phone-number">{call.phoneNumber}</span>
                  <span className="call-status">{call.status}</span>
                </div>
                <div className="call-meta">
                  <span className="call-time">{new Date(call.createdAt).toLocaleTimeString()}</span>
                  <span className="call-duration">{call.duration}s</span>
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
      case 'analytics':
        return <CallAnalytics />;
      case 'routing':
        return <RoutingRules />;
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
      {/* Back Button - Voice Broadcast Style */}
      <button
        className="btn-link"
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: 0
        }}
        onClick={handleBack}
        aria-label="Back to Dashboard"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      <div className="inbound-header">
        <div className="header-content">
          <h1>Inbound Call Management</h1>
          <p>Manage IVR menus, queues, and call routing</p>
          <div className="connection-status">
            {connected ? (
              <span className="status-connected">🟢 Connected</span>
            ) : (
              <span className="status-disconnected">🔴 Disconnected</span>
            )}
            {error && <span className="status-error">Error: {error}</span>}
          </div>
        </div>
        <div className="header-actions">
          {/* Settings button removed */}
        </div>
      </div>

      <div className="inbound-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={18} />
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'queues' ? 'active' : ''}`}
          onClick={() => setActiveTab('queues')}
        >
          <Users size={18} />
          Queues
        </button>
        <button
          className={`tab-btn ${activeTab === 'ivr' ? 'active' : ''}`}
          onClick={() => setActiveTab('ivr')}
        >
          <MessageSquare size={18} />
          IVR Configuration
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <TrendingUp size={18} />
          Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'routing' ? 'active' : ''}`}
          onClick={() => setActiveTab('routing')}
        >
          <Settings size={18} />
          Routing Rules
        </button>
      </div>

      <div className="inbound-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default InboundCalls;
