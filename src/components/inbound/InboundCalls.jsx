import React, { useState, useEffect } from 'react';
import { Phone, Users, Clock, TrendingUp, Settings, BarChart3, Headphones, MessageSquare, ArrowLeft, ClipboardList } from 'lucide-react';
import './InboundCalls.css';
import QueueMonitor from '../QueueMonitor';
import IVRConfig from './ivr/IVRMenuConfig';
import CallAnalytics from '../CallAnalytics';
import RoutingRules from '../RoutingRules';
import LeadsPage from '../../pages/LeadsPage'; // Import LeadsPage
import useSocket from '../../hooks/useSocket';
import { useInbound } from '../../hooks/useInbound';

const InboundCalls = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [realTimeData, setRealTimeData] = useState({
    activeCalls: 0,
    queueStatus: {},
    totalCalls: 0,
    avgWaitTime: 0
  });
  const [period, setPeriod] = useState('today');

  // Use custom hook for data management
  const { analytics, queueStatus, loading, error, refreshInbound } = useInbound();

  // WebSocket connection for real-time updates
  const { socket, connected, error: socketError } = useSocket();

  useEffect(() => {
    // Initial data fetch
    refreshInbound(period);

    if (socket && connected) {
      // Real backend events
      socket.on('calls_update', handleCallsUpdate);
      socket.on('stats_update', handleStatsUpdate);
      socket.on('health_update', handleHealthUpdate);
      socket.on('queue_update', handleQueueUpdate);
    }

    return () => {
      if (socket) {
        socket.off('calls_update', handleCallsUpdate);
        socket.off('stats_update', handleStatsUpdate);
        socket.off('health_update', handleHealthUpdate);
        socket.off('queue_update', handleQueueUpdate);
      }
    };
  }, [socket, connected, period, refreshInbound]);

  // Update realTimeData when queueStatus from hook changes
  useEffect(() => {
    if (queueStatus) {
      setRealTimeData(prev => ({
        ...prev,
        queueStatus
      }));
    }
  }, [queueStatus]);

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

  const handleQueueUpdate = (data) => {
    console.log('Queue update received:', data);
    setRealTimeData(prev => ({
      ...prev,
      queueStatus: data.queueStatus || data
    }));
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
      {/* Navigation Breadcrumb */}
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
          <div className="connected-badge">
            <span className="pulse-dot"></span>
            Connected
          </div>
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
          className={`tab-link ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
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
