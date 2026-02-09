import React from 'react';
import {
  Check,
  Eye,
  MessageSquare,
  Send,
  X,
  RefreshCw,
  Clock
} from 'lucide-react';
import './OverviewStats.css';

const OverviewStats = ({ stats }) => {
  const iconColor = '#6b7280'; // Simple light black color
  const bgColor = '#f3f4f6'; // Light gray background
  
  const iconProps = { size: 16, color: iconColor, strokeWidth: 2 };
  
  const statCards = [
    {
      value: stats.sent || 0,
      label: 'Sent',
      icon: Check,
      bgColor: bgColor
    },
    {
      value: stats.delivered || 0,
      label: 'Delivered',
      icon: Check,
      bgColor: bgColor
    },
    {
      value: stats.read || 0,
      label: 'Read',
      icon: Eye,
      bgColor: bgColor
    },
    {
      value: stats.replied || 0,
      label: 'Replied',
      icon: MessageSquare,
      bgColor: bgColor
    },
    {
      value: stats.sending || 0,
      label: 'Sending',
      icon: Send,
      bgColor: bgColor
    },
    {
      value: stats.failed || 0,
      label: 'Failed',
      icon: X,
      bgColor: '#fef2f2'
    },
    {
      value: stats.processing || 0,
      label: 'Processing',
      icon: RefreshCw,
      bgColor: bgColor
    },
    {
      value: stats.queued || 0,
      label: 'Queued',
      icon: Clock,
      bgColor: bgColor
    }
  ];

  return (
    <div className="overview-section">
      <h3 className="overview-title">Overview</h3>
      <div className="overview-stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-content">
              <div className="stat-icon-wrapper">
                <stat.icon {...iconProps} />
              </div>
              <div className="stat-value">
                {stat.value.toLocaleString()}
              </div>
              <div className="stat-label-row">
                <span className="stat-label">{stat.label}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OverviewStats;
