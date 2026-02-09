import React, { useState } from 'react';
import { X, TrendingUp, Users, MessageCircle, CheckCircle, Eye, AlertCircle } from 'lucide-react';
import './BroadcastAnalyticsModal.css';

const BroadcastAnalyticsModal = ({ isOpen, onClose, broadcast }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !broadcast) return null;

  const stats = broadcast.stats || {};
  const totalRecipients = broadcast.recipientCount || broadcast.recipients?.length || 0;

  // Calculate percentages
  const deliveryRate = totalRecipients > 0 ? Math.round((stats.delivered / totalRecipients) * 100) : 0;
  const readRate = totalRecipients > 0 ? Math.round((stats.read / totalRecipients) * 100) : 0;
  const replyRate = totalRecipients > 0 ? Math.round((stats.replied / totalRecipients) * 100) : 0;
  const failureRate = totalRecipients > 0 ? Math.round((stats.failed / totalRecipients) * 100) : 0;

  // Pie chart data
  const pieData = [
    { label: 'Delivered', value: stats.delivered, color: '#10b981' },
    { label: 'Read', value: stats.read, color: '#3b82f6' },
    { label: 'Failed', value: stats.failed, color: '#ef4444' },
    { label: 'Pending', value: totalRecipients - stats.delivered - stats.failed, color: '#6b7280' }
  ].filter(item => item.value > 0);

  // Bar chart data
  const barData = [
    { label: 'Sent', value: stats.sent, color: '#8b5cf6' },
    { label: 'Delivered', value: stats.delivered, color: '#10b981' },
    { label: 'Read', value: stats.read, color: '#3b82f6' },
    { label: 'Replied', value: stats.replied, color: '#f59e0b' },
    { label: 'Failed', value: stats.failed, color: '#ef4444' }
  ];

  const renderPieChart = () => {
    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="no-data">No data available</div>;

    let currentAngle = -90; // Start from top

    return (
      <div className="pie-chart-container">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {pieData.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            
            const x1 = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
            const y1 = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);
            
            currentAngle += angle;
            
            const x2 = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
            const y2 = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            return (
              <g key={index}>
                <path
                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={100 + 50 * Math.cos(((currentAngle - angle/2) * Math.PI) / 180)}
                  y={100 + 50 * Math.sin(((currentAngle - angle/2) * Math.PI) / 180)}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {percentage.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
        <div className="pie-legend">
          {pieData.map((item, index) => (
            <div key={index} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: item.color }}></div>
              <span className="legend-label">{item.label}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    const maxValue = Math.max(...barData.map(item => item.value));
    if (maxValue === 0) return <div className="no-data">No data available</div>;

    return (
      <div className="bar-chart-container">
        <div className="bar-chart">
          {barData.map((item, index) => {
            const height = maxValue > 0 ? (item.value / maxValue) * 150 : 0;
            return (
              <div key={index} className="bar-wrapper">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${height}px`,
                    backgroundColor: item.color 
                  }}
                >
                  <span className="bar-value">{item.value}</span>
                </div>
                <span className="bar-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-modal-overlay">
      <div className="analytics-modal">
        <div className="analytics-header">
          <h2>
            <TrendingUp size={20} />
            Campaign Analytics
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="campaign-info">
          <h3>{broadcast.name}</h3>
          <p>Status: <span className={`badge ${broadcast.status}`}>{broadcast.status}</span></p>
          <p>Total Recipients: {totalRecipients}</p>
          {broadcast.scheduledAt && (
            <p>Scheduled: {new Date(broadcast.scheduledAt).toLocaleString()}</p>
          )}
        </div>

        <div className="analytics-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            Charts
          </button>
          <button 
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
        </div>

        <div className="analytics-content">
          {activeTab === 'overview' && (
            <div className="overview-grid">
              <div className="metric-card">
                <div className="metric-icon sent">
                  <MessageCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.sent}</h4>
                  <p>Total Sent</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon delivered">
                  <CheckCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.delivered}</h4>
                  <p>Delivered ({deliveryRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon read">
                  <Eye size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.read}</h4>
                  <p>Read ({readRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon replied">
                  <Users size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.replied}</h4>
                  <p>Replied ({replyRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon failed">
                  <AlertCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.failed}</h4>
                  <p>Failed ({failureRate}%)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'charts' && (
            <div className="charts-grid">
              <div className="chart-card">
                <h4>Delivery Status Distribution</h4>
                {renderPieChart()}
              </div>

              <div className="chart-card">
                <h4>Message Metrics Comparison</h4>
                {renderBarChart()}
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="details-grid">
              <div className="detail-card">
                <h4>Message Performance</h4>
                <div className="detail-row">
                  <span>Delivery Rate:</span>
                  <span>{deliveryRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Read Rate:</span>
                  <span>{readRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Reply Rate:</span>
                  <span>{replyRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Failure Rate:</span>
                  <span>{failureRate}%</span>
                </div>
              </div>

              <div className="detail-card">
                <h4>Campaign Details</h4>
                <div className="detail-row">
                  <span>Message Type:</span>
                  <span>{broadcast.messageType || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span>Template:</span>
                  <span>{broadcast.templateName || 'Custom Message'}</span>
                </div>
                <div className="detail-row">
                  <span>Created:</span>
                  <span>{new Date(broadcast.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span>Last Updated:</span>
                  <span>{new Date(broadcast.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastAnalyticsModal;
