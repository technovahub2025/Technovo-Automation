import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Activity,
  AlertCircle,
  Bot,
  Calendar,
  Download,
  Filter,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  Radio,
  RefreshCw,
  Search,
  Timer,
  TrendingUp,
  UserCheck,
  Voicemail
} from 'lucide-react';
import apiService from '../../../services/api';
import './CallAnalytics.css';

const CHANNELS = [
  { key: 'voiceBroadcast', label: 'Voice Broadcast', color: '#7c3aed' },
  { key: 'inboundIvr', label: 'Inbound/IVR', color: '#2563eb' },
  { key: 'outbound', label: 'Outbound', color: '#10b981' }
];

const STATUS_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#2563eb', '#7c3aed', '#06b6d4', '#64748b'];
const TREND_LEGEND_PAYLOAD = [
  { value: 'Total', dataKey: 'total', type: 'line', color: '#2563eb' },
  { value: 'Completed', dataKey: 'completed', type: 'square', color: '#10b981' },
  { value: 'Failed', dataKey: 'failed', type: 'square', color: '#ef4444' },
  { value: 'Success %', dataKey: 'successRate', type: 'line', color: '#f59e0b' }
];
const CHANNEL_LEGEND_PAYLOAD = [
  { value: 'Total', dataKey: 'total', type: 'square', color: '#2563eb' },
  { value: 'Active', dataKey: 'active', type: 'square', color: '#f59e0b' },
  { value: 'Failed', dataKey: 'failed', type: 'square', color: '#ef4444' }
];
const DAILY_LEGEND_PAYLOAD = [
  { value: 'Voice Broadcast', dataKey: 'voiceBroadcast', type: 'line', color: '#7c3aed' },
  { value: 'Inbound/IVR', dataKey: 'inboundIvr', type: 'line', color: '#2563eb' },
  { value: 'Outbound', dataKey: 'outbound', type: 'line', color: '#10b981' }
];
const ANALYTICS_FALLBACK_MS = Number(import.meta.env.VITE_ANALYTICS_SOCKET_TIMEOUT_MS || 7000);
const MAX_TREND_POINTS = 240;
const MAX_RECENT_ROWS = 500;

const EMPTY_CHANNEL = {
  total: 0,
  active: 0,
  completed: 0,
  failed: 0,
  missed: 0,
  avgDuration: 0,
  successRate: 0
};

const toNumber = (value) => Number(value || 0);

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(toNumber(value));

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(toNumber(seconds)));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const normalizeType = (value) => {
  const type = String(value || '').toLowerCase();
  if (['voicebroadcast', 'voice_broadcast', 'voice-broadcast', 'broadcast'].includes(type)) return 'voiceBroadcast';
  if (['outbound', 'outbound_call', 'outbound-local', 'outbound_quickcalls', 'quickcall', 'quick_call'].includes(type)) return 'outbound';
  if (['inboundivr', 'inbound_ivr', 'inbound-ivr', 'ivr', 'inbound', 'incoming'].includes(type)) return 'inboundIvr';
  return value || 'unknown';
};

const formatCallTypeLabel = (value) => {
  const type = normalizeType(value);
  if (type === 'voiceBroadcast') return 'Voice Broadcast';
  if (type === 'inboundIvr') return 'Inbound/IVR';
  if (type === 'outbound') return 'Outbound';
  return String(type || 'Unknown');
};

const formatStatusLabel = (value) => String(value || 'unknown')
  .replace(/_/g, '-')
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getChannel = (analytics, key) => {
  if (key !== 'inboundIvr') return analytics?.channels?.[key] || EMPTY_CHANNEL;
  const combined = analytics?.channels?.inboundIvr;
  if (combined) return combined;

  const inbound = analytics?.channels?.inbound || EMPTY_CHANNEL;
  const ivr = analytics?.channels?.ivr || EMPTY_CHANNEL;
  const total = toNumber(inbound.total) + toNumber(ivr.total);
  const active = toNumber(inbound.active) + toNumber(ivr.active);
  const completed = toNumber(inbound.completed) + toNumber(ivr.completed);
  const failed = toNumber(inbound.failed) + toNumber(ivr.failed);
  const missed = toNumber(inbound.missed) + toNumber(ivr.missed);
  const totalDuration = toNumber(inbound.totalDuration) + toNumber(ivr.totalDuration);

  return {
    total,
    active,
    completed,
    failed,
    missed,
    totalDuration,
    avgDuration: total > 0 ? Math.round(totalDuration / total) : 0,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
};

const downloadCsv = (filename, sections) => {
  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
  };

  const lines = [];
  sections.forEach((section, index) => {
    if (index > 0) lines.push('');
    lines.push(section.title);
    lines.push(section.headers.map(escapeCsv).join(','));
    section.rows.forEach((row) => lines.push(row.map(escapeCsv).join(',')));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
};

const CallAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [filters, setFilters] = useState({ callType: 'all', status: 'all', searchQuery: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTrendSeries, setActiveTrendSeries] = useState(null);
  const [activeChannelSeries, setActiveChannelSeries] = useState(null);
  const [activeDailySeries, setActiveDailySeries] = useState(null);
  const socketRef = useRef(null);
  const requestKeyRef = useRef('');
  const fulfilledKeyRef = useRef('');
  const hasSnapshotRef = useRef(false);

  const requestPayload = useMemo(() => ({
    period,
    callType: filters.callType,
    status: filters.status
  }), [period, filters.callType, filters.status]);

  const applySnapshot = useCallback((payload = {}) => {
    const snapshot = payload?.analytics || payload?.data || payload;
    if (!snapshot || typeof snapshot !== 'object') return;
    hasSnapshotRef.current = true;
    setAnalytics(snapshot);
    setLastUpdated(payload?.timestamp || snapshot.generatedAt || new Date().toISOString());
    setLoading(false);
    setError('');
  }, []);

  const fetchFallback = useCallback(async (payload = requestPayload) => {
    try {
      setLoading(true);
      const fallbackKey = JSON.stringify(payload);
      const queryParams = new URLSearchParams({
        period: payload.period,
        callType: payload.callType,
        status: payload.status
      }).toString();
      const response = await apiService.get(`/api/analytics/inbound?${queryParams}`);
      if (requestKeyRef.current !== fallbackKey) return;
      fulfilledKeyRef.current = fallbackKey;
      applySnapshot(response?.data?.data || response?.data);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load call analytics');
      setLoading(false);
    }
  }, [applySnapshot, requestPayload]);

  useEffect(() => {
    const socket = apiService.initializeSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      setSocketConnected(true);
      socket.emit('join_analytics_room', requestPayload);
      socket.emit('request_call_analytics', { ...requestPayload, reason: 'connect' });
    };
    const handleDisconnect = () => setSocketConnected(false);
    const handleSnapshot = (payload) => {
      const matchesPeriod = String(payload?.period || period) === String(period);
      const matchesType = String(payload?.callType || filters.callType || 'all') === String(filters.callType);
      const matchesStatus = String(payload?.status || filters.status || 'all') === String(filters.status);
      if (!matchesPeriod || !matchesType || !matchesStatus) return;
      fulfilledKeyRef.current = JSON.stringify(requestPayload);
      applySnapshot(payload);
    };

    if (socket) {
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('call_analytics_update', handleSnapshot);
      socket.on('analytics_update', handleSnapshot);

      if (socket.connected) setSocketConnected(true);
      else setSocketConnected(false);
    }

    return () => {
      if (!socket) return;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('call_analytics_update', handleSnapshot);
      socket.off('analytics_update', handleSnapshot);
      socket.emit('leave_analytics_room');
    };
  }, [applySnapshot, filters.callType, filters.status, period, requestPayload]);

  useEffect(() => {
    const socket = socketRef.current;
    const key = JSON.stringify(requestPayload);
    requestKeyRef.current = key;
    fulfilledKeyRef.current = '';
    setError('');
    if (!hasSnapshotRef.current) setLoading(true);

    if (socket?.connected) {
      socket.emit('join_analytics_room', requestPayload);
      socket.emit('request_call_analytics', { ...requestPayload, reason: 'view_change' });
    }

    const fallbackTimer = setTimeout(() => {
      if (requestKeyRef.current === key && fulfilledKeyRef.current !== key) {
        fetchFallback(requestPayload);
      }
    }, ANALYTICS_FALLBACK_MS);

    return () => clearTimeout(fallbackTimer);
  }, [fetchFallback, requestPayload]);

  const summary = analytics?.summary || {};

  const filteredCalls = useMemo(() => {
    const search = filters.searchQuery.trim().toLowerCase();
    const activeStatuses = new Set(['initiated', 'ringing', 'answered', 'in-progress', 'calling', 'queued', 'claiming', 'in_progress']);
    const failedStatuses = new Set(['failed', 'busy', 'no-answer', 'no_answer', 'cancelled', 'canceled']);
    const missedStatuses = new Set(['missed', 'busy', 'no-answer', 'no_answer', 'abandoned']);
    return (analytics?.recentCalls || []).filter((call) => {
      const type = normalizeType(call.type || call.callType);
      const status = String(call.status || '').toLowerCase();
      const matchesType = filters.callType === 'all' || type === filters.callType;
      const matchesStatus =
        filters.status === 'all' ||
        status === filters.status ||
        (filters.status === 'active' && activeStatuses.has(status)) ||
        (filters.status === 'failed' && failedStatuses.has(status)) ||
        (filters.status === 'missed' && missedStatuses.has(status));
      const matchesSearch = !search ||
        String(call.phoneNumber || call.phone || '').toLowerCase().includes(search) ||
        String(call.callSid || call.id || '').toLowerCase().includes(search) ||
        String(call.campaignName || '').toLowerCase().includes(search);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [analytics?.recentCalls, filters]);

  const lifoCalls = useMemo(() => [...filteredCalls].sort((a, b) => {
    const firstTime = new Date(a.createdAt || 0).getTime();
    const secondTime = new Date(b.createdAt || 0).getTime();
    return secondTime - firstTime;
  }).slice(0, MAX_RECENT_ROWS), [filteredCalls]);

  const channelData = useMemo(() => CHANNELS.map((channel) => {
    const metrics = getChannel(analytics, channel.key);
    return {
      ...channel,
      total: toNumber(metrics.total),
      active: toNumber(metrics.active),
      completed: toNumber(metrics.completed),
      failed: toNumber(metrics.failed),
      successRate: toNumber(metrics.successRate)
    };
  }), [analytics]);

  const statusData = useMemo(() => Object.entries(analytics?.statusBreakdown || {})
    .map(([name, value], index) => ({
      name: formatStatusLabel(name),
      value: toNumber(value),
      color: STATUS_COLORS[index % STATUS_COLORS.length]
    }))
    .filter((item) => item.value > 0), [analytics?.statusBreakdown]);

  const trendData = useMemo(() => (analytics?.hourlyDistribution || []).map((row) => ({
    hour: `${String(row.hour).padStart(2, '0')}:00`,
    total: toNumber(row.total || row.calls),
    completed: toNumber(row.completed),
    failed: toNumber(row.failed),
    voiceBroadcast: toNumber(row.voiceBroadcast),
    inboundIvr: toNumber(row.inboundIvr || (toNumber(row.inbound) + toNumber(row.ivr))),
    outbound: toNumber(row.outbound),
    successRate: toNumber(row.successRate)
  })).slice(-MAX_TREND_POINTS), [analytics?.hourlyDistribution]);

  const dailyData = useMemo(() => Object.entries(analytics?.dailyBreakdown || {})
    .sort(([firstDate], [secondDate]) => new Date(firstDate).getTime() - new Date(secondDate).getTime())
    .map(([date, row]) => ({
      rawDate: date,
      date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      total: toNumber(row.total),
      completed: toNumber(row.completed),
      failed: toNumber(row.failed),
      voiceBroadcast: toNumber(row.voiceBroadcast),
      inboundIvr: toNumber(row.inboundIvr || (toNumber(row.inbound) + toNumber(row.ivr))),
      outbound: toNumber(row.outbound),
      successRate: toNumber(row.successRate)
    })), [analytics?.dailyBreakdown]);

  const hasTrendData = trendData.some((row) => row.total > 0);
  const hasDailyData = dailyData.some((row) => row.total > 0);
  const hasChannelData = channelData.some((row) => row.total > 0);
  const shouldShowTrendSeries = useCallback((dataKey) => !activeTrendSeries || activeTrendSeries === dataKey, [activeTrendSeries]);
  const shouldShowChannelSeries = useCallback((dataKey) => !activeChannelSeries || activeChannelSeries === dataKey, [activeChannelSeries]);
  const shouldShowDailySeries = useCallback((dataKey) => !activeDailySeries || activeDailySeries === dataKey, [activeDailySeries]);
  const handleTrendLegendClick = useCallback((entry = {}) => {
    const dataKey = entry.dataKey || entry.payload?.dataKey;
    if (!dataKey) return;
    setActiveTrendSeries((current) => (current === dataKey ? null : dataKey));
  }, []);
  const handleChannelLegendClick = useCallback((entry = {}) => {
    const dataKey = entry.dataKey || entry.payload?.dataKey;
    if (!dataKey) return;
    setActiveChannelSeries((current) => (current === dataKey ? null : dataKey));
  }, []);
  const handleDailyLegendClick = useCallback((entry = {}) => {
    const dataKey = entry.dataKey || entry.payload?.dataKey;
    if (!dataKey) return;
    setActiveDailySeries((current) => (current === dataKey ? null : dataKey));
  }, []);

  const exportAnalytics = () => {
    try {
      setExporting(true);
      const exportedAt = new Date().toISOString();
      downloadCsv(`call-analytics-${period}.csv`, [
        {
          title: 'Summary',
          headers: ['Metric', 'Value'],
          rows: [
            ['Exported At', exportedAt],
            ['Live Snapshot At', lastUpdated || analytics?.generatedAt || ''],
            ['Period', period],
            ['Filter Type', filters.callType === 'all' ? 'All Types' : formatCallTypeLabel(filters.callType)],
            ['Filter Status', filters.status],
            ['Search Query', filters.searchQuery],
            ['Total Calls', summary.totalCalls || 0],
            ['Active Calls', summary.activeCalls || 0],
            ['Completed Calls', summary.completedCalls || 0],
            ['Failed Calls', summary.failedCalls || 0],
            ['Missed Calls', summary.missedCalls || 0],
            ['Success Rate', `${summary.successRate || 0}%`],
            ['Average Duration Seconds', summary.avgDuration || 0]
          ]
        },
        {
          title: 'Channel Breakdown',
          headers: ['Channel', 'Total', 'Active', 'Completed', 'Failed', 'Missed', 'Average Duration', 'Success Rate'],
          rows: channelData.map((row) => [
            row.label,
            row.total,
            row.active,
            row.completed,
            row.failed,
            getChannel(analytics, row.key).missed || 0,
            getChannel(analytics, row.key).avgDuration || 0,
            `${row.successRate}%`
          ])
        },
        {
          title: 'Hourly Trend',
          headers: ['Hour', 'Total', 'Completed', 'Failed', 'Voice Broadcast', 'Inbound/IVR', 'Outbound', 'Success Rate'],
          rows: trendData.map((row) => [
            row.hour,
            row.total,
            row.completed,
            row.failed,
            row.voiceBroadcast,
            row.inboundIvr,
            row.outbound,
            `${row.successRate}%`
          ])
        },
        {
          title: 'Daily Breakdown',
          headers: ['Date', 'Total', 'Completed', 'Failed', 'Voice Broadcast', 'Inbound/IVR', 'Outbound', 'Success Rate'],
          rows: dailyData.map((row) => [
            row.rawDate,
            row.total,
            row.completed,
            row.failed,
            row.voiceBroadcast,
            row.inboundIvr,
            row.outbound,
            `${row.successRate || 0}%`
          ])
        },
        {
          title: 'Status Mix',
          headers: ['Status', 'Count'],
          rows: statusData.map((row) => [row.name, row.value])
        },
        {
          title: 'Recent Calls',
          headers: ['Call ID', 'Phone Number', 'Type', 'Status', 'Duration Seconds', 'Campaign', 'Created At'],
          rows: lifoCalls.map((call) => [
            call.callSid || call.id || '',
            call.phoneNumber || call.phone || '',
            formatCallTypeLabel(call.type || call.callType),
            call.status || '',
            call.duration || 0,
            call.campaignName || '',
            call.createdAt ? new Date(call.createdAt).toISOString() : ''
          ])
        }
      ]);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="call-analytics loading-state">
        <RefreshCw className="spin" size={28} />
        <span>Loading realtime analytics...</span>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="call-analytics loading-state">
        <AlertCircle size={32} />
        <strong>Unable to load call analytics</strong>
        <span>{error}</span>
        <button type="button" className="btn btn-primary" onClick={fetchFallback}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="call-analytics">
      <div className="analytics-header">
        <div className="header-left">
          <h2>Call Analytics</h2>
          <div className="period-selector">
            <Calendar size={16} />
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <span className="last-updated">Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'N/A'}</span>
        </div>
        <div className="header-actions">
          <div className={`analytics-live-status ${socketConnected ? 'connected' : 'disconnected'}`}>
            <span className="analytics-live-dot" />
            <span>{socketConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setShowFilters((value) => !value)}>
            <Filter size={16} /> Filters
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportAnalytics} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <label>
            <span>Call Type</span>
            <select value={filters.callType} onChange={(event) => setFilters((prev) => ({ ...prev, callType: event.target.value }))}>
              <option value="all">All Types</option>
              <option value="voiceBroadcast">Voice Broadcast</option>
              <option value="inboundIvr">Inbound/IVR</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="missed">Missed</option>
            </select>
          </label>
          <label className="search-filter">
            <span>Search</span>
            <div className="search-input">
              <Search size={16} />
              <input
                value={filters.searchQuery}
                placeholder="Phone, Call ID, Campaign"
                onChange={(event) => setFilters((prev) => ({ ...prev, searchQuery: event.target.value }))}
              />
            </div>
          </label>
          <button type="button" className="btn btn-text" onClick={() => setFilters({ callType: 'all', status: 'all', searchQuery: '' })}>
            Clear Filters
          </button>
        </div>
      )}

      <div className="analytics-summary">
        <MetricCard tone="primary" icon={PhoneCall} label="Total Live Data" value={formatNumber(summary.totalCalls)} />
        <MetricCard tone="info" icon={Activity} label="Active Calls" value={formatNumber(summary.activeCalls)} />
        <MetricCard tone="success" icon={UserCheck} label="Success Rate" value={`${summary.successRate || 0}%`} />
        <MetricCard tone="warning" icon={Timer} label="Avg Duration" value={formatDuration(summary.avgDuration)} />
        <MetricCard tone="danger" icon={PhoneMissed} label="Missed / Failed" value={`${formatNumber(summary.missedCalls)} / ${formatNumber(summary.failedCalls)}`} />
        <MetricCard tone="purple" icon={Radio} label="Broadcast Calls" value={formatNumber(summary.broadcastCalls)} />
      </div>

      <div className="channel-strip">
        {CHANNELS.map((channel) => {
          const metrics = getChannel(analytics, channel.key);
          return (
            <section className="channel-panel" key={channel.key} style={{ '--accent': channel.color }}>
              <div>
                <span className="channel-label">{channel.label}</span>
                <strong>{formatNumber(metrics.total)}</strong>
              </div>
              <div className="channel-stats">
                <span>Active {formatNumber(metrics.active)}</span>
                <span>Done {formatNumber(metrics.completed)}</span>
                <span>Failed {formatNumber(metrics.failed)}</span>
                <span>{metrics.successRate || 0}% success</span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="analytics-charts">
        <section className="chart-card trading-chart">
          <div className="section-heading">
            <h3><TrendingUp size={18} /> Realtime Call Trend</h3>
            <span>{period}</span>
          </div>
          {hasTrendData ? (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="callVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} stroke="#64748b" />
                <Tooltip />
                <Legend payload={TREND_LEGEND_PAYLOAD} onClick={handleTrendLegendClick} />
                {shouldShowTrendSeries('total') && (
                  <Area yAxisId="left" type="monotone" dataKey="total" name="Total" stroke="#2563eb" fill="url(#callVolumeGradient)" strokeWidth={2} />
                )}
                {shouldShowTrendSeries('completed') && (
                  <Bar yAxisId="left" dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                )}
                {shouldShowTrendSeries('failed') && (
                  <Bar yAxisId="left" dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                )}
                {shouldShowTrendSeries('successRate') && (
                  <Line yAxisId="right" type="monotone" dataKey="successRate" name="Success %" stroke="#f59e0b" strokeWidth={2} dot={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No realtime trend data for this filter." />}
        </section>

        <section className="chart-card">
          <div className="section-heading">
            <h3><Activity size={18} /> Channel Volume</h3>
          </div>
          {hasChannelData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} stroke="#64748b" />
                <Tooltip />
                <Legend payload={CHANNEL_LEGEND_PAYLOAD} onClick={handleChannelLegendClick} />
                {shouldShowChannelSeries('total') && (
                  <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                )}
                {shouldShowChannelSeries('active') && (
                  <Bar dataKey="active" name="Active" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                )}
                {shouldShowChannelSeries('failed') && (
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No channel data for this filter." />}
        </section>

        <section className="chart-card">
          <div className="section-heading">
            <h3><Bot size={18} /> Status Mix</h3>
          </div>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={104} paddingAngle={2}>
                  {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart text="No status data for this filter." />}
        </section>

        {hasDailyData && (
          <section className="chart-card full-width">
            <div className="section-heading">
              <h3><Calendar size={18} /> Daily Breakdown</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} stroke="#64748b" />
                <Tooltip />
                <Legend payload={DAILY_LEGEND_PAYLOAD} onClick={handleDailyLegendClick} />
                {shouldShowDailySeries('voiceBroadcast') && (
                  <Area type="monotone" dataKey="voiceBroadcast" name="Voice Broadcast" stackId="1" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.35} />
                )}
                {shouldShowDailySeries('inboundIvr') && (
                  <Area type="monotone" dataKey="inboundIvr" name="Inbound/IVR" stackId="1" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
                )}
                {shouldShowDailySeries('outbound') && (
                  <Area type="monotone" dataKey="outbound" name="Outbound" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </section>
        )}
      </div>

      <div className="operations-grid">
        <section className="analytics-section">
          <h3><PhoneIncoming size={18} /> Inbound/IVR Metrics</h3>
          <div className="analytics-grid four-col">
            <StatBox label="Inbound/IVR" value={formatNumber(getChannel(analytics, 'inboundIvr').total)} />
            <StatBox label="Active" value={formatNumber(getChannel(analytics, 'inboundIvr').active)} />
            <StatBox label="Containment" value={`${analytics?.ivr?.containmentRate || 0}%`} />
            <StatBox label="Avg Wait" value={formatDuration(analytics?.queue?.avgWaitTime)} />
          </div>
        </section>
        <section className="analytics-section">
          <h3><Voicemail size={18} /> Queue / Follow-up</h3>
          <div className="analytics-grid four-col">
            <StatBox label="Voicemails" value={formatNumber(summary.voicemails)} />
            <StatBox label="Callbacks" value={formatNumber(summary.callbacks || analytics?.queue?.scheduledCallbacks)} />
            <StatBox label="Service Level" value={`${analytics?.queue?.serviceLevel || 0}%`} />
            <StatBox label="Abandon Rate" value={`${analytics?.queue?.abandonRate || 0}%`} />
          </div>
        </section>
      </div>

      <section className="calls-table-section">
        <div className="section-heading">
          <h3>Recent Calls ({filteredCalls.length})</h3>
          <span className="table-order-note">Newest first</span>
          {error && <span className="inline-error">{error}</span>}
        </div>
        {filteredCalls.length > 0 ? (
          <div className="calls-table-container">
            <table className="calls-table">
              <thead>
                <tr>
                  <th>Call ID</th>
                  <th>Phone</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Campaign</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {lifoCalls.map((call) => {
                  const type = normalizeType(call.type || call.callType);
                  return (
                    <tr key={`${call.source || 'call'}-${call.id || call.callSid}`}>
                      <td className="call-id">{String(call.callSid || call.id || '').slice(-10) || '-'}</td>
                      <td>{call.phoneNumber || call.phone || '-'}</td>
                      <td><span className={`badge ${type}`}>{formatCallTypeLabel(type)}</span></td>
                      <td><span className={`badge ${String(call.status || 'unknown').toLowerCase()}`}>{call.status || 'unknown'}</span></td>
                      <td>{call.campaignName || '-'}</td>
                      <td>{formatDuration(call.duration)}</td>
                      <td>{call.createdAt ? new Date(call.createdAt).toLocaleString() : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="chart-empty-state">No calls match this filter.</div>
        )}
      </section>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, tone }) => (
  <section className={`summary-card ${tone}`}>
    <div className="summary-icon"><Icon size={20} /></div>
    <div className="summary-content">
      <h3>{value}</h3>
      <p>{label}</p>
    </div>
  </section>
);

const StatBox = ({ label, value }) => (
  <div className="stat-box">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);

const EmptyChart = ({ text }) => <div className="chart-empty-state">{text}</div>;

export default CallAnalytics;
