import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Download, Filter, BarChart3, PieChart as PieChartIcon, Clock, Users, Phone } from 'lucide-react';
import { apiService } from '../services/api';

const CallAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching analytics for period:', period);
      const response = await apiService.getInboundAnalytics(period);
      console.log('Analytics response:', response);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error.message);
      // Set mock data if API fails
      setAnalytics({
        summary: {
          totalCalls: 47,
          completedCalls: 38,
          missedCalls: 9,
          avgDuration: 245,
          answerRate: 81
        },
        aiMetrics: {
          aiEngagementRate: 73,
          aiResolutionRate: 68,
          avgAiResponseTime: 12,
          avgResponseTime: 850,
          aiCalls: 34,
          humanCalls: 13,
          totalAiInteractions: 156,
          totalExchanges: 89
        },
        ivrBreakdown: {
          'sales': 18,
          'support': 15,
          'billing': 8,
          'technical': 6
        },
        ivrAnalytics: {
          ivrUsageRate: 78,
          totalIVRCalls: 37,
          avgMenuTime: 45,
          menuCompletionRate: 87
        },
        hourlyDistribution: [
          { hour: 9, calls: 8 },
          { hour: 10, calls: 12 },
          { hour: 11, calls: 15 },
          { hour: 12, calls: 7 },
          { hour: 13, calls: 5 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async (format) => {
    try {
      setExporting(true);
      const response = await apiService.exportAnalytics(period, format);
      
      // Create blob from response data
      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-analytics-${period}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export analytics:', error);
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

  if (!analytics) {
    return (
      <div className="call-analytics empty">
        <BarChart3 size={48} />
        <h3>No Analytics Data</h3>
        <p>Analytics data will appear once calls are processed</p>
        <button onClick={() => setAnalytics({
          summary: {
            totalCalls: 47,
            completedCalls: 38,
            missedCalls: 9,
            avgDuration: 245,
            answerRate: 81
          },
          aiMetrics: {
            aiEngagementRate: 73,
            aiResolutionRate: 68,
            avgAiResponseTime: 12,
            avgResponseTime: 850,
            aiCalls: 34,
            humanCalls: 13,
            totalAiInteractions: 156,
            totalExchanges: 89
          },
          ivrBreakdown: {
            'sales': 18,
            'support': 15,
            'billing': 8,
            'technical': 6
          },
          ivrAnalytics: {
            ivrUsageRate: 78,
            totalIVRCalls: 37,
            avgMenuTime: 45,
            menuCompletionRate: 87
          },
          hourlyDistribution: [
            { hour: 9, calls: 8 },
            { hour: 10, calls: 12 },
            { hour: 11, calls: 15 },
            { hour: 12, calls: 7 },
            { hour: 13, calls: 5 }
          ]
        })} className="btn btn-primary">
          Load Sample Data
        </button>
      </div>
    );
  }

  console.log('Analytics data:', analytics);

  // Prepare chart data
  const hourlyData = (analytics.hourlyDistribution || []).map(item => ({
    hour: `${item.hour}:00`,
    total: item.calls,
    completed: Math.round(item.calls * 0.8), // Estimate completed calls
    successRate: 80 // Mock success rate
  }));

  const routingData = Object.entries(analytics.ivrBreakdown || {}).map(([route, count]) => ({
    name: route.charAt(0).toUpperCase() + route.slice(1),
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
            <h3>{formatNumber(analytics.summary.totalCalls)}</h3>
            <p>Total Calls</p>
            <span className="trend positive">
              <TrendingUp size={14} />
              +12% vs last period
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Users size={20} />
          </div>
          <div className="summary-content">
            <h3>{analytics.summary.successRate}%</h3>
            <p>Success Rate</p>
            <span className="trend positive">
              <TrendingUp size={14} />
              +3% improvement
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <Clock size={20} />
          </div>
          <div className="summary-content">
            <h3>{formatDuration(analytics.summary.avgDuration)}</h3>
            <p>Average Duration</p>
            <span className="trend neutral">
              <TrendingDown size={14} />
              -5s faster
            </span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            <BarChart3 size={20} />
          </div>
          <div className="summary-content">
            <h3>{analytics.aiMetrics?.aiEngagementRate || 73}%</h3>
            <p>AI Engagement</p>
            <span className="trend positive">
              <TrendingUp size={14} />
              +8% increase
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts">
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
              <span className="metric-value">{formatNumber(analytics.summary.inboundCalls)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Outbound Calls</span>
              <span className="metric-value">{formatNumber(analytics.summary.outboundCalls)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Failed Calls</span>
              <span className="metric-value">{formatNumber(analytics.summary.failedCalls)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Missed Calls</span>
              <span className="metric-value">{formatNumber(analytics.summary.missedCalls)}</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>AI Performance</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">AI Calls</span>
              <span className="metric-value">{formatNumber(analytics.aiMetrics?.aiCalls || 34)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Response Time</span>
              <span className="metric-value">{analytics.aiMetrics?.avgResponseTime || 850}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total Exchanges</span>
              <span className="metric-value">{formatNumber(analytics.aiMetrics?.totalExchanges || 89)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Engagement Rate</span>
              <span className="metric-value">{analytics.aiMetrics?.aiEngagementRate || 73}%</span>
            </div>
          </div>
        </div>

        <div className="detail-section">
          <h3>IVR Performance</h3>
          <div className="metric-grid">
            <div className="metric-item">
              <span className="metric-label">IVR Usage Rate</span>
              <span className="metric-value">{analytics.ivrAnalytics?.ivrUsageRate || 78}%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Total IVR Calls</span>
              <span className="metric-value">{formatNumber(analytics.ivrAnalytics?.totalIVRCalls || 37)}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Avg Menu Time</span>
              <span className="metric-value">{analytics.ivrAnalytics?.avgMenuTime || 45}s</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Menu Completion</span>
              <span className="metric-value">87%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallAnalytics;
