import React from 'react';
import { Phone, Clock, User, CheckCircle, XCircle, Loader } from 'lucide-react';
import './CallsTable.css';

const CallsTable = ({ calls, getStatusColor }) => {
  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color="#10b981" />;
      case 'failed':
      case 'no_answer':
      case 'busy':
        return <XCircle size={16} color="#ef4444" />;
      case 'calling':
      case 'ringing':
      case 'in_progress':
        return <Loader size={16} color="#3b82f6" className="spinning" />;
      default:
        return <Clock size={16} color="#94a3b8" />;
    }
  };

  if (calls.length === 0) {
    return (
      <div className="calls-empty">
        <Phone size={48} />
        <h3>No calls to display</h3>
        <p>Calls will appear here once the broadcast starts</p>
      </div>
    );
  }

  return (
    <div className="calls-table-container">
      <div className="calls-count">
        Showing {calls.length} call{calls.length !== 1 ? 's' : ''}
      </div>

      <div className="calls-table-wrapper">
        <table className="calls-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Contact</th>
              <th>Phone</th>
              <th>Start Time</th>
              <th>Duration</th>
              <th>Attempts</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call._id} className={`call-row status-${call.status}`}>
                <td>
                  <div className="status-cell">
                    {getStatusIcon(call.status)}
                    <span
                      className="status-text"
                      style={{ color: getStatusColor(call.status) }}
                    >
                      {call.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="contact-cell">
                    <User size={14} />
                    {call.contact.name || 'Unknown'}
                  </div>
                </td>
                <td className="phone-cell">{call.contact.phone}</td>
                <td>{formatTime(call.startTime)}</td>
                <td>
                  <span className="duration-badge">
                    {formatDuration(call.duration)}
                  </span>
                </td>
                <td>
                  <span className="attempts-badge">
                    {call.attempts} / 2
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CallsTable;