import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  MessageSquare, 
  Send, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './MessageAnalytics.css';

const MessageAnalytics = ({ overviewData = {} }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const getWindowDays = () => {
    if (timeRange === '24h') return 1;
    if (timeRange === '30d') return 30;
    if (timeRange === '90d') return 90;
    return 7;
  };

  const formatDayKey = (date) => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDayLabel = (date, days) => {
    if (days <= 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const buildDailyBuckets = () => {
    const days = getWindowDays();
    const buckets = [];
    const bucketMap = new Map();

    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = formatDayKey(d);
      const bucket = {
        key,
        date: formatDayLabel(d, days),
        sent: 0,
        delivered: 0,
        read: 0,
        conversations: 0
      };
      buckets.push(bucket);
      bucketMap.set(key, bucket);
    }

    return { buckets, bucketMap };
  };

  const buildHourlyFromMessages = (messages = []) => {
    const hourMap = new Map();
    const conversationSetByHour = new Map();
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 11);

    const getHourKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;

    for (let i = 11; i >= 0; i -= 1) {
      const hour = new Date();
      hour.setMinutes(0, 0, 0);
      hour.setHours(hour.getHours() - i);
      const key = getHourKey(hour);
      hourMap.set(key, {
        hour: hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        messages: 0,
        conversations: 0
      });
      conversationSetByHour.set(key, new Set());
    }

    messages.forEach((msg) => {
      if (msg.sender !== 'agent' || !msg.timestamp) return;
      const ts = new Date(msg.timestamp);
      if (Number.isNaN(ts.getTime()) || ts < start) return;
      ts.setMinutes(0, 0, 0);
      const key = getHourKey(ts);
      if (!hourMap.has(key)) return;

      hourMap.get(key).messages += 1;
      if (msg.conversationId) {
        conversationSetByHour.get(key).add(String(msg.conversationId));
      }
    });

    return Array.from(hourMap.entries()).map(([key, value]) => ({
      ...value,
      conversations: conversationSetByHour.has(key) ? conversationSetByHour.get(key).size : 0
    }));
  };

  const buildDailyFromMessages = async () => {
    const { buckets, bucketMap } = buildDailyBuckets();
    const days = getWindowDays();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const conversations = await whatsappService.getConversations();
    const conversationIds = conversations
      .map((c) => c._id)
      .filter(Boolean)
      .slice(0, 200);

    if (conversationIds.length === 0) {
      return {
        dailyTrends: buckets.map((bucket) => ({
          date: bucket.date,
          sent: bucket.sent,
          delivered: bucket.delivered,
          read: bucket.read,
          conversations: bucket.conversations
        })),
        hourlyActivity: buildFallbackHourlyActivity()
      };
    }

    const messageLists = await Promise.all(conversationIds.map((id) => whatsappService.getMessages(id)));
    const allMessages = messageLists.flat();
    const conversationSetByDay = new Map();

    allMessages.forEach((msg) => {
      if (msg.sender !== 'agent' || !msg.timestamp) return;
      const ts = new Date(msg.timestamp);
      if (Number.isNaN(ts.getTime()) || ts < start) return;
      const key = formatDayKey(ts);
      const bucket = bucketMap.get(key);
      if (!bucket) return;

      bucket.sent += 1;
      if (msg.status === 'delivered' || msg.status === 'read') {
        bucket.delivered += 1;
      }
      if (msg.status === 'read') {
        bucket.read += 1;
      }

      if (!conversationSetByDay.has(key)) {
        conversationSetByDay.set(key, new Set());
      }
      if (msg.conversationId) {
        conversationSetByDay.get(key).add(String(msg.conversationId));
      }
    });

    const dailyTrends = buckets.map(({ key, ...rest }) => ({
      ...rest,
      conversations: conversationSetByDay.has(key) ? conversationSetByDay.get(key).size : 0
    }));

    return {
      dailyTrends,
      hourlyActivity: buildHourlyFromMessages(allMessages)
    };
  };

  const buildFallbackDailyTrends = () => {
    const { buckets } = buildDailyBuckets();
    return buckets.map((bucket) => ({
      date: bucket.date,
      sent: 0,
      delivered: 0,
      read: 0,
      conversations: 0
    }));
  };

  const buildFallbackHourlyActivity = () => {
    const buckets = [];
    for (let i = 11; i >= 0; i -= 1) {
      const hour = new Date();
      hour.setMinutes(0, 0, 0);
      hour.setHours(hour.getHours() - i);
      buckets.push({
        hour: hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        messages: 0,
        conversations: 0
      });
    }
    return buckets;
  };

  const fetchMessageAnalytics = async () => {
    setLoading(true);
    try {
      const backendDailyTrends = Array.isArray(overviewData.dailyTrends) ? overviewData.dailyTrends : [];
      const backendHourlyActivity = Array.isArray(overviewData.hourlyActivity) ? overviewData.hourlyActivity : [];
      const backendMessageTypes = Array.isArray(overviewData.messageTypes) ? overviewData.messageTypes : [];
      let resolvedDailyTrends = backendDailyTrends;
      let resolvedHourlyActivity = backendHourlyActivity;
      if (resolvedDailyTrends.length === 0) {
        try {
          const derived = await buildDailyFromMessages();
          resolvedDailyTrends = derived.dailyTrends || [];
          if (resolvedHourlyActivity.length === 0) {
            resolvedHourlyActivity = derived.hourlyActivity || [];
          }
        } catch (trendError) {
          console.error('Failed to build daily trends from messages:', trendError);
          resolvedDailyTrends = [];
        }
      }

      const sentCount = Number(overviewData.messagesSent || 0);
      const deliveredCount = Number(overviewData.messagesDelivered || 0);
      const readCount = Number(overviewData.messagesRead || 0);
      const calculatedDeliveryRate = sentCount > 0 ? `${((deliveredCount / sentCount) * 100).toFixed(1)}%` : '0%';
      const calculatedReadRate = sentCount > 0 ? `${((readCount / sentCount) * 100).toFixed(1)}%` : '0%';
      const peakHourData = resolvedHourlyActivity.reduce(
        (max, item) => (item.messages > max.messages ? item : max),
        { hour: 'N/A', messages: 0 }
      );
      const bestDayData = resolvedDailyTrends.reduce(
        (max, item) => (item.sent > max.sent ? item : max),
        { date: 'N/A', sent: 0 }
      );

      const normalizedData = {
        overview: {
          totalMessages: overviewData.totalMessages || sentCount || 0,
          messagesSent: sentCount,
          messagesDelivered: deliveredCount,
          messagesRead: readCount,
          failedMessages: overviewData.messagesFailed || 0,
          activeConversations: overviewData.activeConversations || 0
        },
        growth: {
          sentGrowth: 12.5,
          deliveredGrowth: 8.3,
          readRateGrowth: 5.2,
          failedGrowth: -2.1,
          activeConversationsGrowth: 15.7
        },
        dailyTrends: resolvedDailyTrends.length > 0 ? resolvedDailyTrends : buildFallbackDailyTrends(),
        hourlyActivity: resolvedHourlyActivity.length > 0 ? resolvedHourlyActivity : buildFallbackHourlyActivity(),
        messageTypes: backendMessageTypes.length > 0 ? backendMessageTypes : [
          { name: 'Text Messages', value: Number(overviewData.messagesSent || 0), color: '#3b82f6' },
          { name: 'Failed Messages', value: Number(overviewData.messagesFailed || 0), color: '#ef4444' }
        ],
        performanceMetrics: {
          avgDeliveryTime: overviewData.performanceMetrics?.avgDeliveryTime || overviewData.avgResponseTime || 'N/A',
          responseRate: overviewData.performanceMetrics?.responseRate || `${overviewData.responseRate || 0}%`,
          customerSatisfaction:
            overviewData.performanceMetrics?.customerSatisfaction || `${overviewData.customerSatisfaction || 0}/5`,
          avgReadTime: overviewData.performanceMetrics?.avgReadTime || 'N/A',
          peakHour: overviewData.performanceMetrics?.peakHour || (peakHourData.messages > 0 ? peakHourData.hour : 'N/A'),
          bestDay: overviewData.performanceMetrics?.bestDay || (bestDayData.sent > 0 ? bestDayData.date : 'N/A'),
          deliveryRate: overviewData.performanceMetrics?.deliveryRate || calculatedDeliveryRate,
          readRate: overviewData.performanceMetrics?.readRate || calculatedReadRate
        }
      };

      setAnalyticsData(normalizedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching message analytics:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMessageAnalytics();
    }, 0);

    return () => clearTimeout(timer);
  }, [timeRange, overviewData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessageAnalytics();
    setRefreshing(false);
  };

  const deliveryRate = analyticsData ? 
    ((analyticsData.overview.messagesDelivered / analyticsData.overview.messagesSent) * 100).toFixed(1) : 0;
  const readRate = analyticsData ? 
    ((analyticsData.overview.messagesRead / analyticsData.overview.messagesSent) * 100).toFixed(1) : 0;
  const formatGrowth = (value) => `${value > 0 ? '+' : ''}${value}%`;
  const messageTypesData = (analyticsData?.messageTypes || []).filter(
    (item) => Number(item?.value || 0) > 0
  );

  if (loading) {
    return (
      <div className="message-analytics-loading">
        <div className="spinner"></div>
        <p>Loading message analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="message-analytics-error">
        <p>Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="message-analytics">
      <div className="analytics-header">
        <div className="header-title">
          <h2>Message Analytics</h2>
          <div className="time-range-selector">
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
          <button className="export-btn">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="overview-cards">
        <div className="metric-card sent">
          <div className="metric-icon">
            <Send size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesSent.toLocaleString()}</div>
            <div className="metric-label">Messages Sent</div>
            <div className={`metric-change ${analyticsData.growth.sentGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatGrowth(analyticsData.growth.sentGrowth)}
            </div>
          </div>
        </div>

        <div className="metric-card delivered">
          <div className="metric-icon">
            <CheckCircle size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesDelivered.toLocaleString()}</div>
            <div className="metric-label">Delivered ({deliveryRate}%)</div>
            <div className={`metric-change ${analyticsData.growth.deliveredGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatGrowth(analyticsData.growth.deliveredGrowth)}
            </div>
          </div>
        </div>

        <div className="metric-card read">
          <div className="metric-icon">
            <Users size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesRead.toLocaleString()}</div>
            <div className="metric-label">Read ({readRate}%)</div>
            <div className={`metric-change ${analyticsData.growth.readRateGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatGrowth(analyticsData.growth.readRateGrowth)}
            </div>
          </div>
        </div>

        <div className="metric-card conversations">
          <div className="metric-icon">
            <AlertCircle size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.failedMessages.toLocaleString()}</div>
            <div className="metric-label">Failed</div>
            <div className={`metric-change ${analyticsData.growth.failedGrowth >= 0 ? 'positive' : 'negative'}`}>
              {formatGrowth(analyticsData.growth.failedGrowth)}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Daily Trends */}
        <div className="chart-container large">
          <h3>Daily Message Trends</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={analyticsData.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="sent" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
              <Area type="monotone" dataKey="delivered" stackId="1" stroke="#2563eb" fill="#2563eb" />
              <Area type="monotone" dataKey="read" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Message Types */}
        <div className="chart-container">
          <h3>Message Types</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <Pie
                data={messageTypesData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={95}
                fill="#8884d8"
                dataKey="value"
              >
                {messageTypesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value}`, `${name}`]} />
              <Legend formatter={(value, entry) => `${value}: ${entry?.payload?.value ?? 0}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Activity */}
        <div className="chart-container large">
          <h3>Hourly Activity</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={analyticsData.hourlyActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="messages" fill="#3b82f6" name="Messages" />
              <Bar dataKey="conversations" fill="#2563eb" name="Conversations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <h3>Performance Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-icon">
              <Clock size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Avg Delivery Time</div>
              <div className="metric-value">{analyticsData.performanceMetrics.avgDeliveryTime}</div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-icon">
              <Users size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Response Rate</div>
              <div className="metric-value">{analyticsData.performanceMetrics.responseRate}</div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-icon">
              <TrendingUp size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Peak Hour</div>
              <div className="metric-value">{analyticsData.performanceMetrics.peakHour}</div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-icon">
              <Calendar size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Customer Satisfaction</div>
              <div className="metric-value">{analyticsData.performanceMetrics.customerSatisfaction}</div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-icon">
              <CheckCircle size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Delivery Rate</div>
              <div className="metric-value">{analyticsData.performanceMetrics.deliveryRate}</div>
            </div>
          </div>
          <div className="metric-item">
            <div className="metric-icon">
              <MessageSquare size={20} />
            </div>
            <div className="metric-info">
              <div className="metric-title">Read Rate</div>
              <div className="metric-value">{analyticsData.performanceMetrics.readRate}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageAnalytics;
