import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Calendar, Download, Filter, BarChart3, Clock, Users, Phone, Activity,
  RefreshCw, Search, ArrowUpRight, ArrowDownRight, Minus, Target, Zap,
  PhoneIncoming, PhoneMissed, Voicemail, MessageSquare, Bot, UserCheck, AlertCircle, Eye, ArrowLeft
} from 'lucide-react';
import apiService from '../../../services/api';
import './CallAnalytics.css';


const CallAnalytics = () => {
  const navigate = useNavigate();
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
  
  // Production-level state
  const [filters, setFilters] = useState({
    callType: 'all',
    status: 'all',
    searchQuery: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {

    const socket = apiService.initializeSocket();
    if (!socket) return undefined;
    socketRef.current = socket;

    const handleWorkflowStats = (data) => {
      setRealTimeData({
        activeExecutions: data.activeExecutions || 0,
        totalExecutionsToday: data.totalExecutionsToday || 0,
        averageExecutionTime: data.averageExecutionTime || 0,
        successRate: data.successRate || 0,
        nodeTypeDistribution: data.nodeTypeDistribution || {},
        lastUpdate: data.timestamp
      });
      setSocketConnected(true);
    };

    const handleCallEvent = (data) => {
      // Real-time call events trigger data refresh
      if (data?.type === 'call_started' || data?.type === 'call_ended' || data?.type === 'call_updated') {
        fetchAnalytics();
      }
    };

    const handleAnalyticsUpdate = (data) => {
      const snapshot = data?.analytics || data?.data || null;
      if (!snapshot) return;

      setAnalytics(snapshot);
      setRealTimeData((prev) => ({
        ...prev,
        totalExecutionsToday: snapshot?.summary?.totalCalls || 0,
        averageExecutionTime: snapshot?.summary?.avgDuration || 0,
        successRate: snapshot?.summary?.successRate || 0,
        nodeTypeDistribution: snapshot?.ivrBreakdown || {},
        lastUpdate: data?.timestamp || new Date().toISOString()
      }));
    };

    // Handle call details updates from call details controller
    const handleCallDetailsUpdate = (data) => {
      console.log('📊 Analytics: Call details update received', data);
      // Refresh analytics when any call changes
      fetchAnalytics();
    };

    const handleInboundCallUpdate = (data) => {
      console.log('📊 Analytics: Inbound call update', data);
      fetchAnalytics();
    };

    const handleIVRCallUpdate = (data) => {
      console.log('📊 Analytics: IVR call update', data);
      fetchAnalytics();
    };

    const handleOutboundCallUpdate = (data) => {
      console.log('📊 Analytics: Outbound call update', data);
      fetchAnalytics();
    };

    const handleCallListUpdate = (data) => {
      console.log('📊 Analytics: Call list update', data);
      if (data?.action === 'refresh' || data?.action === 'add' || data?.action === 'update') {
        fetchAnalytics();
      }
    };


    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('request_ivr_stats');
      socket.emit('join_analytics_room', {
        period,
        callType: filters.callType,
        status: filters.status
      });
      socket.emit('request_call_analytics', {
        period,
        callType: filters.callType,
        status: filters.status,
        reason: 'connect'
      });
      socket.emit('subscribe_calls');
    };

    const handleDisconnect = () => setSocketConnected(false);

    socket.on('ivr_workflow_stats', handleWorkflowStats);
    socket.on('call_event', handleCallEvent);
    socket.on('analytics_update', handleAnalyticsUpdate);
    socket.on('call_analytics_update', handleAnalyticsUpdate);
    
    // Listen for call details updates
    socket.on('call_details_update', handleCallDetailsUpdate);
    socket.on('inbound_call_details_update', handleInboundCallUpdate);
    socket.on('ivr_call_details_update', handleIVRCallUpdate);
    socket.on('outbound_call_details_update', handleOutboundCallUpdate);
    socket.on('call_list_update', handleCallListUpdate);
    
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // If shared socket was already connected before this page mounted,
    // manually run connect flow so LIVE status and room subscriptions initialize.
    if (socket.connected) {
      handleConnect();
    } else {
      setSocketConnected(false);
    }

    // Initial fetch
    fetchAnalytics();

    return () => {

      socket.off('ivr_workflow_stats', handleWorkflowStats);
      socket.off('call_event', handleCallEvent);
      socket.off('analytics_update', handleAnalyticsUpdate);
      socket.off('call_analytics_update', handleAnalyticsUpdate);
      
      // Clean up call details listeners
      socket.off('call_details_update', handleCallDetailsUpdate);
      socket.off('inbound_call_details_update', handleInboundCallUpdate);
      socket.off('ivr_call_details_update', handleIVRCallUpdate);
      socket.off('outbound_call_details_update', handleOutboundCallUpdate);
      socket.off('call_list_update', handleCallListUpdate);
      
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.emit('leave_analytics_room');
      socket.emit('unsubscribe_calls');
    };


  }, [period, filters.callType, filters.status]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        callType: filters.callType,
        status: filters.status
      };
      const response = await apiService.getInboundAnalytics(period, params);
      const normalizedData = response?.data?.data || response?.data || null;
      setAnalytics(normalizedData);
      
      if (comparisonPeriod) {
        const compResponse = await apiService.getInboundAnalytics(comparisonPeriod);
        setComparisonData(compResponse?.data?.data || compResponse?.data || null);
      }
      
      if (normalizedData) previousDataRef.current = { ...normalizedData };
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [period, filters, comparisonPeriod]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ callType: 'all', status: 'all', searchQuery: '' });
  };

  const exportAnalytics = async (format) => {
    try {
      setExporting(true);
      const response = await apiService.exportAnalytics(period, format);
      const data = format === 'csv' ? response.data : new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-analytics-${period}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatNumber = (num) => num ? new Intl.NumberFormat().format(num) : '0';

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

  const getComparisonIndicator = (current, previous) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      color: change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#64748b'
    };
  };

  // Filter calls
  const filteredCalls = useMemo(() => {
    if (!analytics?.recentCalls) return [];
    return analytics.recentCalls.filter(call => {
      const matchesSearch = !filters.searchQuery || 
        call.phoneNumber?.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const matchesType = filters.callType === 'all' || call.type === filters.callType;
      const matchesStatus = filters.status === 'all' || call.status === filters.status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [analytics?.recentCalls, filters]);

  if (loading && !analytics) {
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
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const getTotalCalls = () => period === 'today' && socketConnected 
    ? realTimeData.totalExecutionsToday || 0 
    : analytics?.summary?.totalCalls || 0;

  const getSuccessRate = () => period === 'today' && realTimeData.successRate > 0
    ? realTimeData.successRate
    : analytics?.summary?.successRate || 0;

  const getAvgDuration = () => period === 'today' && realTimeData.averageExecutionTime > 0
    ? realTimeData.averageExecutionTime
    : analytics?.summary?.avgDuration || 0;

  const totalCalls = getTotalCalls();
  const successRate = getSuccessRate();
  const avgDuration = getAvgDuration();
  const aiEngagement = analytics?.aiMetrics?.aiEngagementRate || 0;

  const totalCallsComp = comparisonData ? getComparisonIndicator(totalCalls, comparisonData.summary?.totalCalls) : null;
  const successRateComp = comparisonData ? getComparisonIndicator(successRate, comparisonData.summary?.successRate) : null;

  const hourlyData = (analytics?.hourlyDistribution || []).map(item => ({
    hour: `${item.hour}:00`,
    total: item.calls || 0,
    completed: item.completed || 0,
    failed: item.failed || 0,
    successRate: item.calls > 0 ? Math.round((item.completed / item.calls) * 100) : 0
  }));

  const routingData = Object.entries(realTimeData.nodeTypeDistribution || analytics?.ivrBreakdown || {}).map(([route, count], index) => ({
    name: route.charAt(0).toUpperCase() + route.slice(1).replace(/_/g, ' '),
    value: count,
    color: COLORS[index % COLORS.length]
  }));

  const dailyData = analytics?.dailyBreakdown ? Object.entries(analytics.dailyBreakdown).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: data.total || 0,
    completed: data.completed || 0,
    failed: data.failed || 0
  })) : [];

  return (
    <div className="call-analytics">
      <div className="breadcrumb-nav">
        <button onClick={() => navigate('/voice-automation')} className="back-link-btn">
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>

      {/* Header */}
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
          {comparisonPeriod && (
            <div className="comparison-selector">
              <span>vs</span>
              <select value={comparisonPeriod} onChange={(e) => setComparisonPeriod(e.target.value || null)}>
                <option value="">None</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_week">Last Week</option>
                <option value="last_month">Last Month</option>
              </select>
            </div>
          )}
        </div>
        <div className="header-actions">
          <div className={`live-indicator ${socketConnected ? 'connected' : 'disconnected'}`} title="Real-time Connection Status">
            <span className="live-dot"></span>
            <span className="live-text">{socketConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>

          <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} />
            Filters
          </button>

          <button className="btn btn-secondary" onClick={() => exportAnalytics('csv')} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filter-group">
            <label>Call Type</label>
            <select value={filters.callType} onChange={(e) => handleFilterChange('callType', e.target.value)}>
              <option value="all">All Types</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
              <option value="ivr">IVR</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="missed">Missed</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Search</label>
            <input 
              type="text" 
              placeholder="Phone number or Call ID..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            />
          </div>
          <button className="btn btn-text" onClick={clearFilters}>Clear Filters</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card primary">
          <div className="summary-icon"><PhoneIncoming size={20} /></div>
          <div className="summary-content">
            <h3>{formatNumber(totalCalls)}</h3>
            <p>Total Calls</p>
            {totalCallsComp && (
              <span className={`trend ${totalCallsComp.direction}`} style={{ color: totalCallsComp.color }}>
                {totalCallsComp.direction === 'up' ? <ArrowUpRight size={14} /> : 
                 totalCallsComp.direction === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                {totalCallsComp.value}%
              </span>
            )}
          </div>
        </div>

        <div className="summary-card success">
          <div className="summary-icon"><UserCheck size={20} /></div>
          <div className="summary-content">
            <h3>{successRate}%</h3>
            <p>Success Rate</p>
            {successRateComp && (
              <span className={`trend ${successRateComp.direction}`} style={{ color: successRateComp.color }}>
                {successRateComp.direction === 'up' ? <ArrowUpRight size={14} /> : 
                 successRateComp.direction === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                {successRateComp.value}%
              </span>
            )}
          </div>
        </div>

        <div className="summary-card warning">
          <div className="summary-icon"><Clock size={20} /></div>
          <div className="summary-content">
            <h3>{formatDuration(avgDuration)}</h3>
            <p>Average Duration</p>
            <span className="trend neutral"><Target size={14} /> Target: 3m</span>
          </div>
        </div>

        <div className="summary-card info">
          <div className="summary-icon"><Bot size={20} /></div>
          <div className="summary-content">
            <h3>{aiEngagement}%</h3>
            <p>AI Engagement</p>
            <span className="trend positive"><Zap size={14} /> Automated</span>
          </div>
        </div>

        <div className="summary-card danger">
          <div className="summary-icon"><PhoneMissed size={20} /></div>
          <div className="summary-content">
            <h3>{formatNumber(analytics?.summary?.missedCalls || 0)}</h3>
            <p>Missed Calls</p>
            <span className="trend negative"><AlertCircle size={14} /> Action needed</span>
          </div>
        </div>

        <div className="summary-card purple">
          <div className="summary-icon"><Voicemail size={20} /></div>
          <div className="summary-content">
            <h3>{formatNumber(analytics?.summary?.voicemails || 0)}</h3>
            <p>Voicemails</p>
            <span className="trend neutral"><MessageSquare size={14} /> Pending</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts">
        {/* Hourly Volume */}

        <div className="chart-card large">
          <h3>Hourly Call Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="successRate" stroke="#f59e0b" name="Success %" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* IVR Routing */}
        <div className="chart-card">
          <h3>IVR Routing</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={routingData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                {routingData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        {dailyData.length > 0 && (
          <div className="chart-card full-width">
            <h3>Daily Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Users & Agents Section */}
      <div className="analytics-section">
        <h3><Users size={20} /> Users & Agents</h3>
        <div className="analytics-grid four-col">
          <div className="stat-box">
            <span className="stat-label">Total Agents</span>
            <span className="stat-value">{formatNumber(analytics?.users?.totalAgents || 0)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Active Now</span>
            <span className="stat-value">{formatNumber(analytics?.users?.activeAgents || 0)}</span>
          </div>

          <div className="stat-box">
            <span className="stat-label">Avg Handle Time</span>
            <span className="stat-value">{formatDuration(analytics?.users?.avgHandleTime || 0)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Agent Utilization</span>
            <span className="stat-value">{analytics?.users?.utilizationRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* IVR Deep Dive Section */}
      <div className="analytics-section">
        <h3><PhoneIncoming size={20} /> IVR Analytics</h3>
        <div className="analytics-grid four-col">
          <div className="stat-box">
            <span className="stat-label">IVR Containment</span>
            <span className="stat-value">{analytics?.ivr?.containmentRate || 0}%</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Menu Abandon</span>
            <span className="stat-value">{analytics?.ivr?.abandonRate || 0}%</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Avg IVR Time</span>
            <span className="stat-value">{formatDuration(analytics?.ivr?.avgIVRDuration || 0)}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Transfer Rate</span>
            <span className="stat-value">{analytics?.ivr?.transferRate || 0}%</span>
          </div>
        </div>
        <div className="ivr-flow-stats">
          <h4>IVR Flow Performance</h4>
          <div className="flow-grid">
            {(analytics?.ivr?.flows || []).map((flow, idx) => (
              <div key={idx} className="flow-item">
                <span className="flow-name">{flow.name}</span>
                <div className="flow-bar">
                  <div className="flow-fill" style={{ width: `${flow.usagePercent || 0}%` }}></div>
                </div>
                <span className="flow-value">{flow.usagePercent || 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comprehensive Metrics Grid */}
      <div className="analytics-details comprehensive">
        <div className="detail-section">
          <h3>Call Distribution</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">Inbound</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.inboundCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Outbound</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.outboundCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Failed</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.failedCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Missed</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.missedCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Voicemails</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.voicemails || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Callbacks</span>
              <span className="metric-value">{formatNumber(analytics?.summary?.callbacks || 0)}</span>
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
              <span className="metric-label">Response Time</span>
              <span className="metric-value">{analytics?.aiMetrics?.avgResponseTime || 0}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Exchanges</span>
              <span className="metric-value">{formatNumber(analytics?.aiMetrics?.totalExchanges || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Engagement</span>
              <span className="metric-value">{analytics?.aiMetrics?.aiEngagementRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Intent Match</span>
              <span className="metric-value">{analytics?.aiMetrics?.intentMatchRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Escalations</span>
              <span className="metric-value">{formatNumber(analytics?.aiMetrics?.escalations || 0)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>IVR Performance</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">Usage Rate</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.ivrUsageRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total IVR</span>
              <span className="metric-value">{formatNumber(analytics?.ivrAnalytics?.totalIVRCalls || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Menu Time</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.avgMenuTime || 0}s</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Completion</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.menuCompletionRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Drop-off Rate</span>
              <span className="metric-value">{analytics?.ivrAnalytics?.dropOffRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Repeat Calls</span>
              <span className="metric-value">{formatNumber(analytics?.ivrAnalytics?.repeatCalls || 0)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>Queue Metrics</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">Avg Wait Time</span>
              <span className="metric-value">{formatDuration(analytics?.queue?.avgWaitTime || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Max Wait Time</span>
              <span className="metric-value">{formatDuration(analytics?.queue?.maxWaitTime || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Service Level</span>
              <span className="metric-value">{analytics?.queue?.serviceLevel || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Abandon Rate</span>
              <span className="metric-value">{analytics?.queue?.abandonRate || 0}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Longest Queue</span>
              <span className="metric-value">{formatNumber(analytics?.queue?.longestQueue || 0)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Callbacks</span>
              <span className="metric-value">{formatNumber(analytics?.queue?.scheduledCallbacks || 0)}</span>
            </div>
          </div>
        </div>
      </div>


      {/* Recent Calls Table */}
      {filteredCalls.length > 0 && (
        <div className="calls-table-section">
          <h3>Recent Calls ({filteredCalls.length})</h3>
          <div className="calls-table-container">
            <table className="calls-table">
              <thead>
                <tr>
                  <th>Call ID</th>
                  <th>Phone Number</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.slice(0, 10).map(call => (
                  <tr key={call.callSid}>
                    <td className="call-id">{call.callSid?.slice(-8)}</td>
                    <td>{call.phoneNumber}</td>
                    <td><span className={`badge ${call.type}`}>{call.type}</span></td>
                    <td><span className={`badge ${call.status}`}>{call.status}</span></td>
                    <td>{formatDuration(call.duration)}</td>
                    <td>{new Date(call.createdAt).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-icon"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallAnalytics;
