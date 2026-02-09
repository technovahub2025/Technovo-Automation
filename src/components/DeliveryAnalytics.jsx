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
  ResponsiveContainer 
} from 'recharts';
import { CheckCircle, Clock, Users, Send, TrendingUp, Calendar, Filter, Download } from 'lucide-react';
import './DeliveryAnalytics.css';

const DeliveryAnalytics = ({ broadcastId, onClose }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchDeliveryAnalytics();
  }, [broadcastId, timeRange]);

  const fetchDeliveryAnalytics = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockData = {
        overview: {
          totalSent: 1250,
          delivered: 1180,
          read: 950,
          failed: 70,
          pending: 50
        },
        timeline: [
          { time: '10:00', sent: 200, delivered: 180, read: 150 },
          { time: '11:00', sent: 350, delivered: 320, read: 280 },
          { time: '12:00', sent: 500, delivered: 480, read: 420 },
          { time: '13:00', sent: 800, delivered: 750, read: 650 },
          { time: '14:00', sent: 1000, delivered: 950, read: 800 },
          { time: '15:00', sent: 1250, delivered: 1180, read: 950 }
        ],
        statusBreakdown: [
          { name: 'Delivered', value: 1180, color: '#2563eb' },
          { name: 'Read', value: 950, color: '#3b82f6' },
          { name: 'Failed', value: 70, color: '#ef4444' },
          { name: 'Pending', value: 50, color: '#f59e0b' }
        ],
        hourlyDelivery: [
          { hour: '10 AM', rate: 90 },
          { hour: '11 AM', rate: 91 },
          { hour: '12 PM', rate: 96 },
          { hour: '1 PM', rate: 94 },
          { hour: '2 PM', rate: 95 },
          { hour: '3 PM', rate: 94 }
        ]
      };
      
      setTimeout(() => {
        setAnalyticsData(mockData);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  const deliveryRate = analyticsData ? 
    ((analyticsData.overview.delivered / analyticsData.overview.totalSent) * 100).toFixed(1) : 0;
  const readRate = analyticsData ? 
    ((analyticsData.overview.read / analyticsData.overview.totalSent) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Loading delivery analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="analytics-error">
        <p>Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="delivery-analytics">
      <div className="analytics-header">
        <div className="header-title">
          <h2>Delivery Analytics</h2>
          <div className="time-selector">
            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
        <div className="header-actions">
          <button className="export-btn">
            <Download size={16} />
            Export Report
          </button>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="overview-cards">
        <div className="stat-card sent">
          <div className="stat-icon">
            <Send size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{analyticsData.overview.totalSent.toLocaleString()}</div>
            <div className="stat-label">Total Sent</div>
          </div>
        </div>

        <div className="stat-card delivered">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{analyticsData.overview.delivered.toLocaleString()}</div>
            <div className="stat-label">Delivered ({deliveryRate}%)</div>
          </div>
        </div>

        <div className="stat-card read">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{analyticsData.overview.read.toLocaleString()}</div>
            <div className="stat-label">Read ({readRate}%)</div>
          </div>
        </div>

        <div className="stat-card failed">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{analyticsData.overview.failed.toLocaleString()}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Delivery Timeline */}
        <div className="chart-container">
          <h3>Delivery Timeline</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="delivered" stroke="#2563eb" strokeWidth={2} />
              <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="chart-container">
          <h3>Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.statusBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analyticsData.statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Delivery Rate */}
        <div className="chart-container full-width">
          <h3>Hourly Delivery Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.hourlyDelivery}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rate" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* WhatsApp-style Status Indicators */}
      <div className="status-indicators">
        <h3>Message Status (WhatsApp Style)</h3>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-icon single-tick">✓</div>
            <div className="status-info">
              <div className="status-title">Sent</div>
              <div className="status-count">{analyticsData.overview.totalSent.toLocaleString()}</div>
            </div>
          </div>
          <div className="status-item">
            <div className="status-icon double-tick">✓✓</div>
            <div className="status-info">
              <div className="status-title">Delivered</div>
              <div className="status-count">{analyticsData.overview.delivered.toLocaleString()}</div>
            </div>
          </div>
          <div className="status-item">
            <div className="status-icon double-tick blue">✓✓</div>
            <div className="status-info">
              <div className="status-title">Read</div>
              <div className="status-count">{analyticsData.overview.read.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryAnalytics;
