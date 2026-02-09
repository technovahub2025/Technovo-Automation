import React from 'react';
import { CheckCircle, X, Users, Send, AlertCircle, Clock, Calendar, MessageSquare, TrendingUp } from 'lucide-react';
import './BroadcastResultsPopup.css';

const BroadcastResultsPopup = ({ 
  isOpen, 
  onClose, 
  results, 
  broadcastName,
  isSending = false 
}) => {
  if (!isOpen) return null;

  const successRate = results?.total_sent > 0 
    ? ((results.successful / results.total_sent) * 100).toFixed(1)
    : 0;

  const failedCount = (results?.total_sent || 0) - (results?.successful || 0);

  return (
    <div className="popup-overlay">
      <div className="popup-container">
        <div className="popup-header">
          <div className="popup-title">
            {isSending ? (
              <>
                <Clock className="animate-spin" size={24} />
                <span>Sending Broadcast...</span>
              </>
            ) : (
              <>
                <CheckCircle size={24} className={successRate >= 90 ? 'success' : 'warning'} />
                <span>Campaign Results</span>
              </>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          {/* Campaign Details */}
          <div className="campaign-details">
            <div className="campaign-header">
              <h3>{broadcastName || 'Untitled Campaign'}</h3>
              <div className="campaign-meta">
                <div className="meta-item">
                  <Calendar size={16} />
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="meta-item">
                  <Clock size={16} />
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div className="campaign-summary">
              <div className="summary-item">
                <MessageSquare size={20} />
                <div className="summary-content">
                  <div className="summary-label">Message Type</div>
                  <div className="summary-value">Template Message</div>
                </div>
              </div>
              <div className="summary-item">
                <TrendingUp size={20} />
                <div className="summary-content">
                  <div className="summary-label">Performance</div>
                  <div className="summary-value">{successRate}% Success Rate</div>
                </div>
              </div>
            </div>
          </div>

          {isSending ? (
            <div className="sending-status">
              <div className="spinner"></div>
              <p>Your broadcast is being sent...</p>
              <p className="sub-text">This may take a few moments</p>
            </div>
          ) : (
            <>
              <div className="results-stats">
                <div className="stat-card total">
                  <div className="stat-icon">
                    <Users size={20} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{results?.total_sent || 0}</span>
                    <span className="stat-label">Total Sent</span>
                  </div>
                </div>

                <div className="stat-card success">
                  <div className="stat-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{results?.successful || 0}</span>
                    <span className="stat-label">Delivered</span>
                  </div>
                </div>

                <div className="stat-card failed">
                  <div className="stat-icon">
                    <AlertCircle size={20} />
                  </div>
                  <div className="stat-details">
                    <span className="stat-value">{failedCount}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                </div>
              </div>

              <div className="success-rate">
                <div className="rate-bar">
                  <div 
                    className="rate-fill" 
                    style={{ width: `${successRate}%` }}
                  ></div>
                </div>
                <span className="rate-text">{successRate}% Success Rate</span>
              </div>

              {/* Campaign Insights */}
              <div className="campaign-insights">
                <h4>Campaign Insights</h4>
                <div className="insights-grid">
                  <div className="insight-item">
                    <div className="insight-label">Delivery Time</div>
                    <div className="insight-value">~2 minutes</div>
                  </div>
                  <div className="insight-item">
                    <div className="insight-label">Peak Delivery</div>
                    <div className="insight-value">12:30 PM</div>
                  </div>
                  <div className="insight-item">
                    <div className="insight-label">Read Rate</div>
                    <div className="insight-value">76%</div>
                  </div>
                </div>
              </div>

              {results?.errors && results.errors.length > 0 && (
                <div className="errors-section">
                  <h4>Errors ({results.errors.length})</h4>
                  <div className="error-list">
                    {results.errors.slice(0, 5).map((error, index) => (
                      <div key={index} className="error-item">
                        <AlertCircle size={14} />
                        <span>{error}</span>
                      </div>
                    ))}
                    {results.errors.length > 5 && (
                      <p className="more-errors">...and {results.errors.length - 5} more errors</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="popup-footer">
          {isSending ? (
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => {
                onClose();
                // Navigate to campaigns overview if needed
                window.location.reload();
              }}>
                View Campaigns
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastResultsPopup;
