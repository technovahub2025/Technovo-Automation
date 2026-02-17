import React from 'react';
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

  const renderProgressCircle = (percentage) => {
    const progressClass = getProgressClass(percentage);
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div className="progress-indicator">
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
            fontSize="10"
            fontWeight="600"
          >
            {percentage}%
          </text>
        </svg>
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

      <td>{renderProgressCircle(getSuccessPercentage(broadcast))}</td>

      <td>{renderProgressCircle(getReadPercentage(broadcast))}</td>

      <td>{renderProgressCircle(getRepliedPercentage(broadcast))}</td>

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

export default BroadcastCard;
