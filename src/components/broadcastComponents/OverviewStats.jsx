import React from 'react';
import {
  Check,
  CheckCheck,
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
  
  const getIconProps = (color = iconColor) => ({ size: 16, color, strokeWidth: 2 });
  
  // Ensure stats is defined to prevent undefined errors
  const safeStats = stats || {};
  
  const statCards = [
    {
      value: safeStats.sent || 0,
      label: 'Sent',
      icon: Check,
      bgColor: bgColor
    },
    {
      value: safeStats.delivered || 0,
      label: 'Delivered',
      icon: CheckCheck,
      bgColor: bgColor,
      iconColor: '#6b7280'
    },
    {
      value: safeStats.read || 0,
      label: 'Read',
      icon: CheckCheck,
      bgColor: bgColor,
      iconColor: '#3b82f6'
    },
    {
      value: safeStats.replied || 0,
      label: 'Replied',
      icon: MessageSquare,
      bgColor: bgColor
    },
    {
      value: safeStats.sending || 0,
      label: 'Sending',
      icon: Send,
      bgColor: bgColor
    },
    {
      value: safeStats.failed || 0,
      label: 'Failed',
      icon: X,
      bgColor: '#fef2f2'
    },
    {
      value: safeStats.processing || 0,
      label: 'Processing',
      icon: RefreshCw,
      bgColor: bgColor
    },
    {
      value: safeStats.queued || 0,
      label: 'Queued',
      icon: Clock,
      bgColor: bgColor
    }
  ];

  return (
    <div className="overview-section">
      <div className="overview-header">
        <h3 className="overview-title">Overview</h3>
      </div>
      <div className="overview-stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-content">
              <div className="stat-icon-wrapper">
                <stat.icon {...getIconProps(stat.iconColor)} />
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
