import React from 'react';
import { Calendar, Users, Activity, Eye, Square, Trash2 } from 'lucide-react';
import './BroadcastList.css';

const BroadcastList = ({ broadcasts, loading, onMonitor, onStop, onDelete }) => {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#94a3b8',
      queued: '#f59e0b',
      in_progress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444'
    };
    return colors[status] || '#64748b';
  };

  const calculateSuccessRate = (stats) => {
    const total = stats.completed + stats.failed;
    if (total === 0) return 0;
    return Math.round((stats.completed / total) * 100);
  };

  if (loading) {
    return (
      <div className="list-loading">
        <div className="spinner-large" />
        <p>Loading campaigns...</p>
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <div className="list-empty">
        <Activity size={64} />
        <h3>No campaigns yet</h3>
        <p>Create your first voice broadcast campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="broadcast-list">
      <div className="list-header">
        <h3>{broadcasts.length} Campaign{broadcasts.length !== 1 ? 's' : ''}</h3>
      </div>

      <div className="broadcasts-grid">
        {broadcasts.map((broadcast) => (
          <div key={broadcast._id || broadcast.id} className="broadcast-card">
            <div className="card-header">
              <h4>{broadcast.name}</h4>
              <span
                className="status-badge"
                style={{ background: `${getStatusColor(broadcast.status)}20`, color: getStatusColor(broadcast.status) }}
              >
                {broadcast.status.replace('_', ' ')}
              </span>
            </div>

            <div className="card-stats">
              <div className="stat-item">
                <Users size={16} />
                <span>{broadcast.stats.total} contacts</span>
              </div>
              <div className="stat-item">
                <Activity size={16} />
                <span>{calculateSuccessRate(broadcast.stats)}% success</span>
              </div>
              <div className="stat-item">
                <Calendar size={16} />
                <span>{formatDate(broadcast.createdAt)}</span>
              </div>
            </div>

            <div className="card-progress">
              <div className="progress-info">
                <span className="progress-label">Progress</span>
                <span className="progress-value">
                  {broadcast.stats.completed + broadcast.stats.failed} / {broadcast.stats.total}
                </span>
              </div>
              <div className="progress-bar-mini">
                <div
                  className="progress-fill-mini"
                  style={{
                    width: `${((broadcast.stats.completed + broadcast.stats.failed) / broadcast.stats.total) * 100}%`
                  }}
                />
              </div>
            </div>

            <div className="card-details">
              <div className="detail-row">
                <span className="detail-label">Completed:</span>
                <span className="detail-value success">{broadcast.stats.completed}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Failed:</span>
                <span className="detail-value error">{broadcast.stats.failed}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Pending:</span>
                <span className="detail-value">{broadcast.stats.queued + broadcast.stats.calling}</span>
              </div>
            </div>

            <div className="card-actions" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {['in_progress', 'queued'].includes(broadcast.status) && (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => onMonitor(broadcast._id || broadcast.id)}
                  >
                    <Eye size={16} />
                    Monitor
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onStop(broadcast._id || broadcast.id)}
                    title="Stop Broadcast"
                  >
                    <Square size={16} fill="currentColor" />
                  </button>
                </>
              )}

              {['completed', 'cancelled'].includes(broadcast.status) && (
                <button
                  className="btn btn-secondary btn-block"
                  style={{ flex: 1 }}
                  onClick={() => onMonitor(broadcast._id || broadcast.id)}
                >
                  <Eye size={16} />
                  View Results
                </button>
              )}

              <button
                className="btn btn-icon-only text-danger"
                onClick={() => onDelete(broadcast._id || broadcast.id)}
                title="Delete Campaign"
                style={{ marginLeft: 'auto', padding: '8px' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BroadcastList;