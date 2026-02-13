import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Download, Filter, BarChart3, PieChart as PieChartIcon, Clock, Users, Phone, Activity } from 'lucide-react';
import apiService from '../services/api';
import './CallAnalytics.css';

const CallAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [realTimeData, setRealTimeData] = useState({
    activeExecutions: 0,
    totalExecutionsToday: 0,
    averageExecutionTime: 0,
    successRate: 0,
    nodeTypeDistribution: {},
    lastUpdate: null
  });
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  const previousDataRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = apiService.initializeSocket();
    socketRef.current = socket;

    // Socket event listeners
    const handleWorkflowStats = (data) => {
      console.log('📊 Real-time IVR stats:', data);
      const newRealTimeData = {
        activeExecutions: data.activeExecutions || 0,
        totalExecutionsToday: data.totalExecutionsToday || 0,
        averageExecutionTime: data.averageExecutionTime || 0,
        successRate: data.successRate || 0,
        nodeTypeDistribution: data.nodeTypeDistribution || {},
        lastUpdate: data.timestamp
      };
      setRealTimeData(newRealTimeData);
      setSocketConnected(true);
    };

    const handleWorkflowUpdate = (data) => {
      console.log('🔄 IVR workflow update:', data);
      // Keep metrics DB-backed: socket events only trigger refresh.
      if (data?.event) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          fetchAnalytics();
        }, 300);
      }
    };

    const handleConnect = () => {
      setSocketConnected(true);
      console.log('✅ Socket connected for analytics');
      // Request current stats
      socket.emit('request_ivr_stats');
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      console.log('❌ Socket disconnected');
    };

    socket.on('ivr_workflow_stats', handleWorkflowStats);
    socket.on('ivr_workflow_update', handleWorkflowUpdate);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Fetch initial analytics and request real-time stats
    fetchAnalytics();
    
    // Request stats periodically
    const statsInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('request_ivr_stats');
      }
    }, 30000); // Every 30 seconds
    
    // Clear any cached data on mount
    if (typeof window !== 'undefined' && window.caches) {
      window.caches.keys().then(names => {
        names.forEach(name => {
          window.caches.delete(name);
        });
      });
    }

    // Cleanup
    return () => {
      if (statsInterval) clearInterval(statsInterval);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      socket.off('ivr_workflow_stats', handleWorkflowStats);
      socket.off('ivr_workflow_update', handleWorkflowUpdate);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching analytics for period:', period);
      const response = await apiService.getInboundAnalytics(period);
      console.log('Analytics response:', response);
      setAnalytics(response.data);
      
      // Store previous data for trend calculations
      if (response.data && previousDataRef.current) {
        previousDataRef.current = { ...response.data };
      } else if (response.data) {
        previousDataRef.current = { ...response.data };
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error.message);
      // Don't set mock data - just show error state
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async (format) => {
    try {
      setExporting(true);
      console.log(`📥 Exporting analytics as ${format} for period: ${period}`);
      const response = await apiService.exportAnalytics(period, format);
      console.log('Export response:', response);
      
      // Handle different response types
      let data, type;
      if (format === 'csv') {
        data = response.data;
        type = 'text/csv';
      } else {
        // For Excel, check if response is already a blob or needs conversion
        data = response.data instanceof Blob ? response.data : new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
      
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-analytics-${period}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`✅ Successfully exported ${format} file`);
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (loading) {
    return (
      <div className="call-analytics loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="call-analytics empty">
        <BarChart3 size={48} />
        <h3>Error Loading Analytics</h3>
        <p>{error}</p>
        <button onClick={fetchAnalytics} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!analytics && !socketConnected) {
    return (
      <div className="call-analytics empty">
        <BarChart3 size={48} />
        <h3>No Analytics Data</h3>
        <p>Waiting for real-time data connection...</p>
        <div className="connection-status">
          <Activity className={socketConnected ? 'connected' : 'disconnected'} size={16} />
          <span>{socketConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
        <button onClick={fetchAnalytics} className="btn btn-primary">
          Retry Connection
        </button>
      </div>
    );
  }

  // Calculate dynamic trends based on real data
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, direction: 'neutral' };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  // Get real-time or API data with fallbacks
  const getTotalCalls = () => {
    // Always prefer real-time data for today when socket is connected
    if (period === 'today' && socketConnected) {
      console.log('📊 Using real-time total executions:', realTimeData.totalExecutionsToday);
      return realTimeData.totalExecutionsToday || 0;
    }
    console.log('📊 Using API total calls:', analytics?.summary?.totalCalls || 0);
    return analytics?.summary?.totalCalls || 0;
  };

  const getSuccessRate = () => {
    if (period === 'today' && realTimeData.successRate > 0) {
      return realTimeData.successRate;
    }
    return analytics?.summary?.successRate || 0;
  };

  const getAvgDuration = () => {
    if (period === 'today' && realTimeData.averageExecutionTime > 0) {
      return realTimeData.averageExecutionTime;
    }
    return analytics?.summary?.avgDuration || 0;
  };

  const getAIEngagement = () => {
    // Calculate from real-time node distribution
    const totalNodes = Object.values(realTimeData.nodeTypeDistribution).reduce((sum, count) => sum + count, 0);
    const aiNodes = (realTimeData.nodeTypeDistribution['ai_assistant'] || 0) + 
                   (realTimeData.nodeTypeDistribution['ai_response'] || 0);
    return totalNodes > 0 ? Math.round((aiNodes / totalNodes) * 100) : 
           analytics?.aiMetrics?.aiEngagementRate || 0;
  };

  const totalCalls = getTotalCalls();
  const successRate = getSuccessRate();
  const avgDuration = getAvgDuration();
  const aiEngagement = getAIEngagement();

  // Calculate trends
  const totalCallsTrend = calculateTrend(totalCalls, previousDataRef.current?.summary?.totalCalls);
  const successRateTrend = calculateTrend(successRate, previousDataRef.current?.summary?.successRate);
  const durationTrend = calculateTrend(avgDuration, previousDataRef.current?.summary?.avgDuration);
  const aiEngagementTrend = calculateTrend(aiEngagement, previousDataRef.current?.aiMetrics?.aiEngagementRate);

  // Prepare chart data
  const hourlyData = (analytics?.hourlyDistribution || []).map(item => ({
    hour: `${item.hour}:00`,
    total: item.calls || 0,
    completed: item.completed || Math.round((item.calls || 0) * 0.8), // Use real completed data if available
    successRate: item.calls > 0 ? Math.round(((item.completed || Math.round(item.calls * 0.8)) / item.calls) * 100) : 0
  }));

  const routingData = Object.entries(realTimeData.nodeTypeDistribution || analytics.ivrBreakdown || {}).map(([route, count]) => ({
    name: route.charAt(0).toUpperCase() + route.slice(1).replace(/_/g, ' '),
    value: count
  }));

  const dailyData = analytics.dailyBreakdown ? Object.entries(analytics.dailyBreakdown).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString(),
    total: data.total,
    completed: data.completed,
    duration: Math.round(data.duration / 60) // Convert to minutes
  })) : [];

  return (
    <div className="call-analytics">
      <div className="analytics-header">
        <div className="header-left">
          <h2>Call Analytics</h2>
          <div className="period-selector">
            <Calendar size={16} />
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
        <div className="header-actions">
          <div className="connection-indicator">
            <Activity className={socketConnected ? 'connected' : 'disconnected'} size={16} />
            <span>{socketConnected ? 'Live' : 'Offline'}</span>
          </div>
          <div className="export-buttons">
            <button
              className="btn btn-secondary"
              onClick={() => exportAnalytics('csv')}
              disabled={exporting}
            >
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => exportAnalytics('xlsx')}
              disabled={exporting}
            >
              <Download size={16} />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card">
          <div className="summary-icon">
            <Phone size={20} />
          </div>
          <div className="summary-content">
            <h3>{formatNumber(totalCalls)}</h3>
            <p>Total Calls</p>
            <span className={`trend ${totalCallsTrend.direction}`}>
              {totalCallsTrend.direction === 'up' && <TrendingUp size={14} />}
              {totalCallsTrend.direction === 'down' && <TrendingDown size={14} />}
              {totalCallsTrend.value > 0 ? `+${totalCallsTrend.value}%` : 'No change'}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Users size={20} />
          </div>
          <div className="summary-content">
            <h3>{successRate}%</h3>
            <p>Success Rate</p>
            <span className={`trend ${successRateTrend.direction}`}>
              {successRateTrend.direction === 'up' && <TrendingUp size={14} />}
              {successRateTrend.direction === 'down' && <TrendingDown size={14} />}
              {successRateTrend.value > 0 ? `+${successRateTrend.value}%` : 'No change'}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Clock size={20} />
          </div>
          <div className="summary-content">
            <h3>{formatDuration(avgDuration)}</h3>
            <p>Average Duration</p>
            <span className={`trend ${durationTrend.direction}`}>
              {durationTrend.direction === 'up' && <TrendingUp size={14} />}
              {durationTrend.direction === 'down' && <TrendingDown size={14} />}
              {durationTrend.value > 0 ? `${durationTrend.direction === 'up' ? '+' : '-'}${durationTrend.value}s` : 'No change'}
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <BarChart3 size={20} />
          </div>
          <div className="summary-content">
            <h3>{aiEngagement}%</h3>
            <p>AI Engagement</p>
            <span className={`trend ${aiEngagementTrend.direction}`}>
              {aiEngagementTrend.direction === 'up' && <TrendingUp size={14} />}
              {aiEngagementTrend.direction === 'down' && <TrendingDown size={14} />}
              {aiEngagementTrend.value > 0 ? `+${aiEngagementTrend.value}%` : 'No change'}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts">
        {/* Real-time Status */}
        <div className="chart-card">
          <h3>Real-Time Status</h3>
          <div className="real-time-status">
            <div className="status-item">
              <span className="status-label">Connection:</span>
              <span className={`status-value ${socketConnected ? 'connected' : 'disconnected'}`}>
                {socketConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Active IVR Workflows:</span>
              <span className="status-value">{realTimeData.activeExecutions}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Last Update:</span>
              <span className="status-value">
                {realTimeData.lastUpdate ? 
                  new Date(realTimeData.lastUpdate).toLocaleTimeString() : 
                  'No data'
                }
              </span>
            </div>
          </div>
        </div>
        {/* Hourly Call Volume */}
        <div className="chart-card">
          <h3>Hourly Call Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total Calls" />
              <Bar dataKey="completed" fill="#10b981" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* IVR Routing Breakdown */}
        <div className="chart-card">
          <h3>IVR Routing Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={routingData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {routingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        {dailyData.length > 0 && (
          <div className="chart-card full-width">
            <h3>Daily Call Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total Calls" />
                <Line type="monotone" dataKey="completed" stroke="#10b981" name="Completed" />
                <Line type="monotone" dataKey="duration" stroke="#f59e0b" name="Duration (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Metrics */}
      <div className="analytics-details">
        <div className="detail-section">
          <h3>Call Distribution</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">Inbound Calls</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.inboundCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Outbound Calls</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.outboundCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Failed Calls</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.failedCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Missed Calls</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.missedCalls || 0)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>AI Performance</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">AI Calls</span>
              <span className="metric-value">{formatNumber(analytics?.aiMetrics?.aiCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Response Time</span>
              <span className="metric-value">{analytics?.aiMetrics?.avgResponseTime || 0}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total Exchanges</span>
              <span className="metric-value">{formatNumber(analytics?.aiMetrics?.totalExchanges || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Engagement Rate</span>
              <span className="metric-value">{analytics?.aiMetrics?.aiEngagementRate || 0}%</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>IVR Performance</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">IVR Usage Rate</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.ivrUsageRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total IVR Calls</span>
              <span className="metric-value">{formatNumber(analytics?.ivrAnalytics?.totalIVRCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Menu Time</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.avgMenuTime || 0}s</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Menu Completion</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.menuCompletionRate || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallAnalytics;
