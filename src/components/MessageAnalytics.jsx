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
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import './MessageAnalytics.css';

const MessageAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMessageAnalytics();
  }, [timeRange]);

  const fetchMessageAnalytics = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockData = {
        overview: {
          totalMessages: 15420,
          messagesSent: 12500,
          messagesDelivered: 11800,
          messagesRead: 9200,
          failedMessages: 700,
          activeConversations: 342
        },
        dailyTrends: [
          { date: 'Mon', sent: 1800, delivered: 1650, read: 1300, conversations: 45 },
          { date: 'Tue', sent: 2200, delivered: 2050, read: 1650, conversations: 52 },
          { date: 'Wed', sent: 1900, delivered: 1780, read: 1400, conversations: 48 },
          { date: 'Thu', sent: 2400, delivered: 2250, read: 1800, conversations: 58 },
          { date: 'Fri', sent: 2800, delivered: 2650, read: 2100, conversations: 62 },
          { date: 'Sat', sent: 2100, delivered: 1950, read: 1550, conversations: 41 },
          { date: 'Sun', sent: 2200, delivered: 2050, read: 1600, conversations: 36 }
        ],
        hourlyActivity: [
          { hour: '8AM', messages: 450, conversations: 12 },
          { hour: '9AM', messages: 680, conversations: 18 },
          { hour: '10AM', messages: 890, conversations: 22 },
          { hour: '11AM', messages: 1200, conversations: 28 },
          { hour: '12PM', messages: 950, conversations: 20 },
          { hour: '1PM', messages: 780, conversations: 16 },
          { hour: '2PM', messages: 1100, conversations: 25 },
          { hour: '3PM', messages: 1350, conversations: 32 },
          { hour: '4PM', messages: 1450, conversations: 35 },
          { hour: '5PM', messages: 1200, conversations: 28 },
          { hour: '6PM', messages: 890, conversations: 20 },
          { hour: '7PM', messages: 650, conversations: 15 }
        ],
        messageTypes: [
          { name: 'Template Messages', value: 8500, color: '#3b82f6' },
          { name: 'Custom Messages', value: 4000, color: '#2563eb' },
          { name: 'Media Messages', value: 2900, color: '#f59e0b' },
          { name: 'Interactive Messages', value: 20, color: '#8b5cf6' }
        ],
        performanceMetrics: {
          avgDeliveryTime: '1.2 minutes',
          avgReadTime: '8.5 minutes',
          peakHour: '3 PM - 4 PM',
          bestDay: 'Friday',
          deliveryRate: '94.4%',
          readRate: '73.6%'
        }
      };
      
      setTimeout(() => {
        setAnalyticsData(mockData);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching message analytics:', error);
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMessageAnalytics();
    setRefreshing(false);
  };

  const deliveryRate = analyticsData ? 
    ((analyticsData.overview.messagesDelivered / analyticsData.overview.messagesSent) * 100).toFixed(1) : 0;
  const readRate = analyticsData ? 
    ((analyticsData.overview.messagesRead / analyticsData.overview.messagesSent) * 100).toFixed(1) : 0;

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
        <div className="metric-card total">
          <div className="metric-icon">
            <MessageSquare size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.totalMessages.toLocaleString()}</div>
            <div className="metric-label">Total Messages</div>
            <div className="metric-change positive">+12.5%</div>
          </div>
        </div>

        <div className="metric-card sent">
          <div className="metric-icon">
            <Send size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesSent.toLocaleString()}</div>
            <div className="metric-label">Messages Sent</div>
            <div className="metric-change positive">+8.3%</div>
          </div>
        </div>

        <div className="metric-card delivered">
          <div className="metric-icon">
            <CheckCircle size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesDelivered.toLocaleString()}</div>
            <div className="metric-label">Delivered ({deliveryRate}%)</div>
            <div className="metric-change positive">+5.2%</div>
          </div>
        </div>

        <div className="metric-card read">
          <div className="metric-icon">
            <Users size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.messagesRead.toLocaleString()}</div>
            <div className="metric-label">Read ({readRate}%)</div>
            <div className="metric-change negative">-2.1%</div>
          </div>
        </div>

        <div className="metric-card conversations">
          <div className="metric-icon">
            <MessageSquare size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analyticsData.overview.activeConversations}</div>
            <div className="metric-label">Active Conversations</div>
            <div className="metric-change positive">+15.7%</div>
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
            <PieChart>
              <Pie
                data={analyticsData.messageTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analyticsData.messageTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
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
              <div className="metric-title">Avg Read Time</div>
              <div className="metric-value">{analyticsData.performanceMetrics.avgReadTime}</div>
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
              <div className="metric-title">Best Day</div>
              <div className="metric-value">{analyticsData.performanceMetrics.bestDay}</div>
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
