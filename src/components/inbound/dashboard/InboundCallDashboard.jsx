import React, { useState, useMemo } from 'react';
import useInboundCalls from '../../../hooks/useInboundCalls';
import './InboundCallDashboard.css';

const InboundCallDashboard = () => {
  const {
    activeCalls,
    callQueue,
    callHistory,
    transferCall,
    hangupCall,
    getQueueStats,
    loading,
    error,
  } = useInboundCalls();

  const [selectedCall, setSelectedCall] = useState(null);
  const [transferDestination, setTransferDestination] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);

  /**
   * Get queue statistics
   */
  const queueStats = useMemo(() => getQueueStats(), [getQueueStats]);

  /**
   * Format duration for display
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Format wait time with human-readable text
   */
  const formatWaitTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  /**
   * Handle call transfer
   */
  const handleTransfer = async (callId) => {
    setSelectedCall(callId);
    setShowTransferModal(true);
  };

  /**
   * Confirm transfer
   */
  const confirmTransfer = async () => {
    if (!selectedCall || !transferDestination) return;

    try {
      await transferCall(selectedCall, transferDestination);
      setShowTransferModal(false);
      setSelectedCall(null);
      setTransferDestination('');
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  /**
   * Handle call hangup
   */
  const handleHangup = async (callId) => {
    if (!window.confirm('Are you sure you want to end this call?')) {
      return;
    }

    try {
      await hangupCall(callId);
    } catch (err) {
      console.error('Hangup failed:', err);
    }
  };

  /**
   * Get call duration
   */
  const getCallDuration = (call) => {
    if (!call.answeredAt) return 'Ringing';
    
    const duration = Math.floor((Date.now() - new Date(call.answeredAt).getTime()) / 1000);
    return formatDuration(duration);
  };

  /**
   * Get priority badge color
   */
  const getPriorityColor = (priority) => {
    const colors = {
      vip: 'red',
      high: 'orange',
      normal: 'blue',
      low: 'gray',
    };
    return colors[priority] || 'gray';
  };

  return (
    <div className="inbound-call-dashboard">
      <div className="dashboard-header">
        <h1>Inbound Call Center</h1>
        <div className="header-stats">
          <div className="stat-badge active">
            <span className="stat-value">{activeCalls.length}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-badge queued">
            <span className="stat-value">{callQueue.length}</span>
            <span className="stat-label">In Queue</span>
          </div>
        </div>
      </div>

      {/* Error display removed */}

      {/* Active Calls Section */}
      <section className="calls-section">
        <h2>Active Calls ({activeCalls.length})</h2>
        
        {activeCalls.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
            </svg>
            <p>No active calls</p>
          </div>
        ) : (
          <div className="calls-grid">
            {activeCalls.map(call => (
              <div key={call._id} className="call-card active-call">
                <div className="call-header">
                  <div className="caller-info">
                    <div className="caller-number">{call.from}</div>
                    {call.callerName && (
                      <div className="caller-name">{call.callerName}</div>
                    )}
                  </div>
                  <div className="call-status">
                    <span className={`status-indicator ${call.status}`} />
                    <span className="status-text">{call.status}</span>
                  </div>
                </div>

                <div className="call-details">
                  <div className="detail-item">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{getCallDuration(call)}</span>
                  </div>
                  {call.answeredBy && (
                    <div className="detail-item">
                      <span className="detail-label">Agent:</span>
                      <span className="detail-value">{call.answeredBy}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Line:</span>
                    <span className="detail-value">{call.to}</span>
                  </div>
                </div>

                <div className="call-actions">
                  <button
                    onClick={() => handleTransfer(call._id)}
                    className="btn btn-sm btn-primary"
                    aria-label={`Transfer call from ${call.from}`}
                  >
                    Transfer
                  </button>
                  <button
                    onClick={() => handleHangup(call._id)}
                    className="btn btn-sm btn-danger"
                    aria-label={`End call from ${call.from}`}
                  >
                    Hang Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Call Queue Section */}
      <section className="queue-section">
        <div className="section-header">
          <h2>Call Queue ({callQueue.length})</h2>
          
          {callQueue.length > 0 && (
            <div className="queue-stats">
              <div className="queue-stat">
                <span className="stat-label">Avg Wait:</span>
                <span className="stat-value">{formatWaitTime(queueStats.avgWaitTime)}</span>
              </div>
              <div className="queue-stat">
                <span className="stat-label">Longest:</span>
                <span className="stat-value">{formatWaitTime(queueStats.longestWait)}</span>
              </div>
              {queueStats.priorityCalls > 0 && (
                <div className="queue-stat priority">
                  <span className="stat-label">Priority:</span>
                  <span className="stat-value">{queueStats.priorityCalls}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {callQueue.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p>Queue is empty</p>
          </div>
        ) : (
          <div className="queue-table-container">
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Caller</th>
                  <th>Priority</th>
                  <th>Wait Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {callQueue.map((caller, index) => (
                  <tr key={caller.callId} className={caller.priority === 'vip' ? 'priority-vip' : ''}>
                    <td className="position-cell">
                      <span className="position-badge">{caller.position || index + 1}</span>
                    </td>
                    <td>
                      <div className="caller-info">
                        <div className="caller-number">{caller.from}</div>
                        {caller.callerName && (
                          <div className="caller-name">{caller.callerName}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`priority-badge priority-${getPriorityColor(caller.priority)}`}>
                        {caller.priority || 'normal'}
                      </span>
                    </td>
                    <td className="wait-time-cell">
                      <span className={caller.waitTime > 120 ? 'wait-time-warning' : ''}>
                        {formatWaitTime(caller.waitTime)}
                      </span>
                    </td>
                    <td>
                      <span className="status-text">Waiting</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Call History */}
      <section className="history-section">
        <h2>Recent Calls</h2>
        
        {callHistory.length === 0 ? (
          <div className="empty-state">
            <p>No recent calls</p>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Caller</th>
                  <th>Agent</th>
                  <th>Duration</th>
                  <th>Disposition</th>
                </tr>
              </thead>
              <tbody>
                {callHistory.slice(0, 10).map(call => (
                  <tr key={call._id}>
                    <td>{new Date(call.endedAt).toLocaleTimeString()}</td>
                    <td>{call.from}</td>
                    <td>{call.answeredBy || 'N/A'}</td>
                    <td>{call.duration ? formatDuration(call.duration) : 'N/A'}</td>
                    <td>
                      <span className={`disposition-badge disposition-${call.disposition}`}>
                        {call.disposition || 'completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="transfer-modal-title">
            <div className="modal-header">
              <h3 id="transfer-modal-title">Transfer Call</h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="modal-close"
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="transfer-destination">Transfer to:</label>
                <select
                  id="transfer-destination"
                  value={transferDestination}
                  onChange={(e) => setTransferDestination(e.target.value)}
                  className="form-control"
                >
                  <option value="">Select destination</option>
                  <option value="sales">Sales Department</option>
                  <option value="support">Support Department</option>
                  <option value="billing">Billing Department</option>
                  <option value="manager">Manager</option>
                  <option value="ai-assistant">AI Assistant</option>
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={() => setShowTransferModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmTransfer}
                className="btn btn-primary"
                disabled={!transferDestination}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboundCallDashboard;