import React from 'react';
import {
  Check,
  Eye,
  MessageSquare,
  Send,
  X,
  RefreshCw,
  Clock,
  RotateCcw
} from 'lucide-react';
import './OverviewStats.css';

const OverviewStats = ({ stats, onManualRefresh }) => {
  const iconColor = '#6b7280'; // Simple light black color
  const bgColor = '#f3f4f6'; // Light gray background
  
  const iconProps = { size: 16, color: iconColor, strokeWidth: 2 };
  
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
      icon: Check,
      bgColor: bgColor
    },
    {
      value: safeStats.read || 0,
      label: 'Read',
      icon: Eye,
      bgColor: bgColor
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
        {onManualRefresh && (
          <button 
            className="manual-refresh-btn"
            onClick={onManualRefresh}
            title="Manually refresh statistics"
          >
            <RotateCcw size={16} color={iconColor} />
          </button>
        )}
      </div>
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
