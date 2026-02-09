import React, { useState, useEffect } from 'react';
import { Phone, Clock, User, MessageSquare } from 'lucide-react';
import apiService from '../services/api';
import './CallHistory.css';

const CallHistory = () => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    fetchCallHistory();
  }, []);

  const fetchCallHistory = async () => {
    try {
      const response = await apiService.getCallHistory();
      setCalls(response.data);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewCallDetails = async (callSid) => {
    try {
      const response = await apiService.getCallDetails(callSid);
      setSelectedCall(response.data);
    } catch (error) {
      console.error('Failed to fetch call details:', error);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="call-history loading">
        <div className="spinner"></div>
        <p>Loading call history...</p>
      </div>
    );
  }

  return (
    <div className="call-history">
      <h2>Call History</h2>
      <p className="subtitle">View all past voice automation calls</p>

      <div className="calls-grid">
        {calls.length === 0 ? (
          <div className="no-calls">
            <Phone size={48} />
            <h3>No calls yet</h3>
            <p>Make your first call to see it here</p>
          </div>
        ) : (
          calls.map((call) => (
            <div 
              key={call.callSid} 
              className="call-card"
              onClick={() => viewCallDetails(call.callSid)}
            >
              <div className="call-header">
                <div className={`call-direction ${call.direction}`}>
                  <Phone size={18} />
                  {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                </div>
                <div className={`call-status ${call.status}`}>
                  {call.status}
                </div>
              </div>

              <div className="call-details">
                <div className="detail-row">
                  <User size={16} />
                  <span>{call.phoneNumber}</span>
                </div>
                <div className="detail-row">
                  <Clock size={16} />
                  <span>{formatDate(call.startTime)}</span>
                </div>
                {call.duration > 0 && (
                  <div className="detail-row">
                    <Clock size={16} />
                    <span>Duration: {formatDuration(call.duration)}</span>
                  </div>
                )}
                {call.conversation?.length > 0 && (
                  <div className="detail-row">
                    <MessageSquare size={16} />
                    <span>{call.conversation.length} messages</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Call Details Modal */}
      {selectedCall && (
        <div className="modal-overlay" onClick={() => setSelectedCall(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Call Details</h3>
              <button onClick={() => setSelectedCall(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Information</h4>
                <p><strong>Call SID:</strong> {selectedCall.callSid}</p>
                <p><strong>Phone:</strong> {selectedCall.phoneNumber}</p>
                <p><strong>Direction:</strong> {selectedCall.direction}</p>
                <p><strong>Duration:</strong> {formatDuration(selectedCall.duration)}</p>
                <p><strong>Status:</strong> {selectedCall.status}</p>
              </div>

              {selectedCall.conversation?.length > 0 && (
                <div className="detail-section">
                  <h4>Conversation</h4>
                  <div className="conversation-list">
                    {selectedCall.conversation.map((msg, index) => (
                      <div key={index} className={`message ${msg.type}`}>
                        <div className="message-header">
                          {msg.type === 'user' ? '👤 User' : '🤖 AI'}
                        </div>
                        <div className="message-text">{msg.text}</div>
                        <div className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCall.aiMetrics && (
                <div className="detail-section">
                  <h4>AI Metrics</h4>
                  <div className="metrics-grid">
                    <div className="metric">
                      <span className="metric-label">Exchanges</span>
                      <span className="metric-value">
                        {selectedCall.aiMetrics.totalExchanges}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Avg Response</span>
                      <span className="metric-value">
                        {selectedCall.aiMetrics.avgResponseTime?.toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallHistory;