import React, { memo } from 'react';
import { LineChart, Trash } from 'lucide-react';
import './BroadcastCard.css';

const BroadcastCard = ({
  broadcast,
  selectionMode,
  selectedCampaigns,
  onCheckboxChange,
  getSuccessPercentage,
  getReadPercentage,
  getRepliedPercentage,
  getStatusClass,
  onPauseBroadcast,
  onResumeBroadcast,
  onCancelBroadcast,
  onDeleteClick,
  onViewAnalytics
}) => {
  const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const getProgressClass = (percentage) => {
    if (percentage === 0) return 'zero';
    if (percentage >= 80) return 'high';
    if (percentage >= 40) return 'medium';
    return 'low';
  };

  const getDisplayDateTime = (currentBroadcast) => {
    const dateValue =
      currentBroadcast.scheduledAt ||
      currentBroadcast.startedAt ||
      currentBroadcast.createdAt;

    if (!dateValue) return '-';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString();
  };

  const getMetricTooltip = (metricType, currentBroadcast) => {
    const stats = currentBroadcast?.stats || {};
    const sent = toNumber(stats.sent);
    const delivered = Math.max(toNumber(stats.delivered), toNumber(stats.read));
    const read = toNumber(stats.read);
    const replied = toNumber(stats.replied);

    if (metricType === 'successful') {
      return {
        title: 'Successful',
        lines: [
          { label: 'Sent', value: sent },
          { label: 'Delivered', value: delivered }
        ]
      };
    }
    if (metricType === 'read') {
      return {
        title: 'Read',
        lines: [
          { label: 'Read', value: read },
          { label: 'Sent', value: sent }
        ]
      };
    }
    if (metricType === 'replied') {
      return {
        title: 'Replied',
        lines: [
          { label: 'Replied', value: replied },
          { label: 'Sent', value: sent }
        ]
      };
    }
    return { title: '', lines: [] };
  };

  const renderProgressCircle = (percentage, tooltip = { title: '', lines: [] }) => {
    const progressClass = getProgressClass(percentage);
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="progress-indicator metric-hover" aria-label={tooltip?.title || 'Metric details'} tabIndex={0}>
        <svg className={`progress-circle ${progressClass}`} width="48" height="48">
          <circle
            className="progress-background"
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="6"
          />
          <circle
            className={`progress-fill ${progressClass}`}
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 24 24)"
          />
          <text
            x="24"
            y="24"
            textAnchor="middle"
            dy="0.3em"
            className="progress-text"
            fontSize="6"
            fontWeight="400"
          >
            {percentage}%
          </text>
        </svg>
        <div className="metric-hover-card" role="tooltip">
          <div className="metric-hover-title">{tooltip?.title || 'Metric'}</div>
          {(tooltip?.lines || []).map((line) => (
            <div key={line.label} className="metric-hover-row">
              <span>{line.label}</span>
              <strong>{line.value}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <tr>
      {selectionMode && (
        <td className="checkbox-column">
          <input
            type="checkbox"
            checked={selectedCampaigns.includes(broadcast._id)}
            onChange={(e) => onCheckboxChange(broadcast._id, e)}
          />
        </td>
      )}

      <td>{broadcast.name}</td>

      <td>{getDisplayDateTime(broadcast)}</td>

      <td>{renderProgressCircle(getSuccessPercentage(broadcast), getMetricTooltip('successful', broadcast))}</td>

      <td>{renderProgressCircle(getReadPercentage(broadcast), getMetricTooltip('read', broadcast))}</td>

      <td>{renderProgressCircle(getRepliedPercentage(broadcast), getMetricTooltip('replied', broadcast))}</td>

      <td>
        {broadcast.recipientCount || broadcast.recipients?.length || 0} Contact{(broadcast.recipientCount || broadcast.recipients?.length || 0) !== 1 ? 's' : ''}
      </td>

      <td>
        {broadcast.stats?.failed || 0} Contact{(broadcast.stats?.failed || 0) !== 1 ? 's' : ''}
      </td>

      <td>
        <span className={`badge ${getStatusClass(broadcast.status)}`}>{broadcast.status}</span>
      </td>

      <td>
        <div className="action-buttons">
          <button className="action-btn" title="View Analytics" onClick={() => onViewAnalytics?.(broadcast)}>
            <LineChart size={10} />
          </button>

          <button className="action-btn delete-btn" title="Delete Campaign" onClick={() => onDeleteClick?.(broadcast)}>
            <Trash size={10} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const areEqual = (prevProps, nextProps) => {
  const prev = prevProps.broadcast || {};
  const next = nextProps.broadcast || {};
  const prevStats = prev.stats || {};
  const nextStats = next.stats || {};

  return (
    prev._id === next._id &&
    prev.status === next.status &&
    prev.name === next.name &&
    prev.scheduledAt === next.scheduledAt &&
    prev.startedAt === next.startedAt &&
    prev.createdAt === next.createdAt &&
    prev.recipientCount === next.recipientCount &&
    prevStats.sent === nextStats.sent &&
    prevStats.delivered === nextStats.delivered &&
    prevStats.read === nextStats.read &&
    prevStats.replied === nextStats.replied &&
    prevStats.failed === nextStats.failed &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.selectedCampaigns.includes(prev._id) === nextProps.selectedCampaigns.includes(next._id)
  );
};

export default memo(BroadcastCard, areEqual);
