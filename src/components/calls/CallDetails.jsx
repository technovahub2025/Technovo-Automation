import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Voicemail, 
  Clock, User, ArrowLeft, RefreshCw, AlertCircle,
  CheckCircle, XCircle, MessageSquare, Bot, 
  BarChart3, Calendar, FileText, Headphones, 
  Route, Layers, PlayCircle, PauseCircle, Wifi
} from 'lucide-react';
import apiService from '../../services/api';
import socketService from '../../services/socketService';
import './CallDetails.css';


const CallDetails = () => {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [callData, setCallData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [socketConnected, setSocketConnected] = useState(false);

  // Socket.IO event handlers for real-time updates
  useEffect(() => {
    fetchCallDetails();

    // Connect to Socket.IO
    socketService.connect();

    // Listen for call updates
    const handleCallUpdate = (data) => {
      if (data.callId === callId || data.callSid === callId) {
        console.log('📡 Real-time call update received:', data);
        fetchCallDetails(); // Refresh call details
      }
    };

    const handleCallDetailsUpdate = (data) => {
      if (data.callId === callId || data.callSid === callId) {
        console.log('📡 Call details update:', data);
        // Merge updated data with existing data
        setCallData(prev => prev ? { ...prev, ...data.data } : data.data);
      }
    };

    const handleIVRUpdate = (data) => {
      if (data.callId === callId || data.callSid === callId) {
        console.log('📡 IVR update received:', data);
        fetchCallDetails();
      }
    };

    const handleInboundUpdate = (data) => {
      if (data.callId === callId || data.callSid === callId) {
        console.log('📡 Inbound update received:', data);
        fetchCallDetails();
      }
    };

    const handleOutboundUpdate = (data) => {
      if (data.callId === callId || data.callSid === callId) {
        console.log('📡 Outbound update received:', data);
        fetchCallDetails();
      }
    };

    // Subscribe to events
    socketService.on('call_updated', handleCallUpdate);
    socketService.on('call_details_update', handleCallDetailsUpdate);
    socketService.on('ivr_call_details_update', handleIVRUpdate);
    socketService.on('inbound_call_details_update', handleInboundUpdate);
    socketService.on('outbound_call_details_update', handleOutboundUpdate);
    socketService.on('call_list_update', handleCallUpdate);

    // Connection status
    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    // Set initial connection status
    setSocketConnected(socketService.isConnected?.() || false);

    // Cleanup
    return () => {
      socketService.off('call_updated', handleCallUpdate);
      socketService.off('call_details_update', handleCallDetailsUpdate);
      socketService.off('ivr_call_details_update', handleIVRUpdate);
      socketService.off('inbound_call_details_update', handleInboundUpdate);
      socketService.off('outbound_call_details_update', handleOutboundUpdate);
      socketService.off('call_list_update', handleCallUpdate);
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
    };
  }, [callId]);


  const fetchCallDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getCallDetailsById(callId);
      setCallData(response.data.data);
    } catch (err) {
      console.error('Failed to fetch call details:', err);
      setError(err.message || 'Failed to load call details');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon success" />;
      case 'failed':
        return <XCircle className="status-icon error" />;
      case 'in-progress':
        return <PlayCircle className="status-icon active" />;
      case 'ringing':
        return <Phone className="status-icon ringing" />;
      default:
        return <AlertCircle className="status-icon warning" />;
    }
  };

  const getCallTypeIcon = (type) => {
    switch (type) {
      case 'inbound':
        return <PhoneIncoming className="type-icon inbound" />;
      case 'ivr':
        return <Route className="type-icon ivr" />;
      case 'outbound':
        return <PhoneOutgoing className="type-icon outbound" />;
      default:
        return <Phone className="type-icon" />;
    }
  };

  if (loading) {
    return (
      <div className="call-details loading">
        <div className="loading-spinner"></div>
        <p>Loading call details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="call-details error">
        <AlertCircle size={48} />
        <h3>Error Loading Call</h3>
        <p>{error}</p>
        <button onClick={fetchCallDetails} className="btn btn-primary">
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (!callData) {
    return (
      <div className="call-details empty">
        <Phone size={48} />
        <h3>Call Not Found</h3>
        <p>The requested call could not be found.</p>
        <button onClick={() => navigate('/calls')} className="btn btn-primary">
          View All Calls
        </button>
      </div>
    );
  }

  const { type, status, duration, phoneNumber, createdAt, updatedAt } = callData;

  return (
    <div className="call-details">
      {/* Header */}
      <div className="details-header">
        <button onClick={() => navigate(-1)} className="back-btn">
          <ArrowLeft size={20} />
          Back
        </button>
        
        <div className="header-content">
          <div className="call-type-badge">
            {getCallTypeIcon(type)}
            <span className="type-label">{type?.toUpperCase()}</span>
          </div>
          
          <h2>Call Details</h2>
          
          <div className="status-badge">
            {getStatusIcon(status)}
            <span className="status-label">{status}</span>
          </div>
        </div>

        <div className="header-actions">
          <div className={`socket-status ${socketConnected ? 'connected' : 'disconnected'}`} title={socketConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}>
            <Wifi size={16} />
            <span>{socketConnected ? 'Live' : 'Offline'}</span>
          </div>
          <button onClick={fetchCallDetails} className="refresh-btn">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>


      {/* Quick Info Cards */}
      <div className="quick-info">
        <div className="info-card">
          <Phone size={20} />
          <div>
            <label>Phone Number</label>
            <span>{phoneNumber || callData.from || callData.to || 'N/A'}</span>
          </div>
        </div>
        
        <div className="info-card">
          <Clock size={20} />
          <div>
            <label>Duration</label>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
        
        <div className="info-card">
          <Calendar size={20} />
          <div>
            <label>Started</label>
            <span>{formatDate(createdAt)}</span>
          </div>
        </div>
        
        <div className="info-card">
          <Calendar size={20} />
          <div>
            <label>Ended</label>
            <span>{formatDate(updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="details-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          <FileText size={16} />
          Overview
        </button>
        
        {type === 'ivr' && (
          <button 
            className={activeTab === 'ivr' ? 'active' : ''}
            onClick={() => setActiveTab('ivr')}
          >
            <Route size={16} />
            IVR Flow
          </button>
        )}
        
        {type === 'outbound' && (
          <button 
            className={activeTab === 'outbound' ? 'active' : ''}
            onClick={() => setActiveTab('outbound')}
          >
            <BarChart3 size={16} />
            Campaign
          </button>
        )}
        
        {(callData.conversation?.length > 0 || callData.aiMetrics) && (
          <button 
            className={activeTab === 'ai' ? 'active' : ''}
            onClick={() => setActiveTab('ai')}
          >
            <Bot size={16} />
            AI Interaction
          </button>
        )}
        
        {callData.voicemail && (
          <button 
            className={activeTab === 'voicemail' ? 'active' : ''}
            onClick={() => setActiveTab('voicemail')}
          >
            <Voicemail size={16} />
            Voicemail
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="section">
              <h3>Call Information</h3>
              <div className="info-grid">
                <div className="info-row">
                  <label>Call SID</label>
                  <span className="code">{callData.callSid}</span>
                </div>
                <div className="info-row">
                  <label>Direction</label>
                  <span>{callData.direction || type}</span>
                </div>
                <div className="info-row">
                  <label>Status</label>
                  <span className={`status ${status}`}>{status}</span>
                </div>
                <div className="info-row">
                  <label>Duration</label>
                  <span>{formatDuration(duration)}</span>
                </div>
                <div className="info-row">
                  <label>Outcome</label>
                  <span>{callData.outcome || 'N/A'}</span>
                </div>
                {callData.routing && (
                  <div className="info-row">
                    <label>Routing</label>
                    <span>{callData.routing}</span>
                  </div>
                )}
              </div>
            </div>

            {callData.queue && (
              <div className="section">
                <h3>Queue Information</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Queue Name</label>
                    <span>{callData.queue.name}</span>
                  </div>
                  <div className="info-row">
                    <label>Position</label>
                    <span>#{callData.queue.position}</span>
                  </div>
                  <div className="info-row">
                    <label>Wait Time</label>
                    <span>{formatDuration(callData.queue.waitTime)}</span>
                  </div>
                  {callData.queue.agentAssigned && (
                    <div className="info-row">
                      <label>Agent Assigned</label>
                      <span>{callData.queue.agentAssigned}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {callData.callback && (
              <div className="section">
                <h3>Callback Request</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Requested</label>
                    <span>{callData.callback.requested ? 'Yes' : 'No'}</span>
                  </div>
                  {callData.callback.phoneNumber && (
                    <div className="info-row">
                      <label>Callback Number</label>
                      <span>{callData.callback.phoneNumber}</span>
                    </div>
                  )}
                  {callData.callback.scheduledAt && (
                    <div className="info-row">
                      <label>Scheduled For</label>
                      <span>{formatDate(callData.callback.scheduledAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ivr' && callData.ivrMetrics && (
          <div className="ivr-tab">
            <div className="section">
              <h3>IVR Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <label>Menu Time</label>
                  <span>{formatDuration(callData.ivrMetrics.menuTime)}</span>
                </div>
                <div className="metric-card">
                  <label>Completion Status</label>
                  <span>{callData.ivrMetrics.completionStatus}</span>
                </div>
                {callData.ivrMetrics.transferPoint && (
                  <div className="metric-card">
                    <label>Transfer Point</label>
                    <span>{callData.ivrMetrics.transferPoint}</span>
                  </div>
                )}
                {callData.ivrMetrics.abandonPoint && (
                  <div className="metric-card">
                    <label>Abandon Point</label>
                    <span>{callData.ivrMetrics.abandonPoint}</span>
                  </div>
                )}
              </div>
            </div>

            {callData.ivrMetrics.nodePath?.length > 0 && (
              <div className="section">
                <h3>Node Path</h3>
                <div className="node-path">
                  {callData.ivrMetrics.nodePath.map((node, idx) => (
                    <div key={idx} className="node-item">
                      <div className="node-number">{idx + 1}</div>
                      <div className="node-info">
                        <span className="node-type">{node.type}</span>
                        <span className="node-id">{node.id}</span>
                      </div>
                      {idx < callData.ivrMetrics.nodePath.length - 1 && (
                        <div className="node-arrow">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {callData.ivrMetrics.selections?.length > 0 && (
              <div className="section">
                <h3>User Selections</h3>
                <div className="selections-list">
                  {callData.ivrMetrics.selections.map((selection, idx) => (
                    <div key={idx} className="selection-item">
                      <span className="selection-digit">Pressed: {selection.digit}</span>
                      <span className="selection-time">{formatDate(selection.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {callData.workflow && (
              <div className="section">
                <h3>Workflow Information</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Workflow Name</label>
                    <span>{callData.workflow.name}</span>
                  </div>
                  <div className="info-row">
                    <label>Prompt Key</label>
                    <span className="code">{callData.workflow.promptKey}</span>
                  </div>
                  <div className="info-row">
                    <label>Nodes</label>
                    <span>{callData.workflow.nodes}</span>
                  </div>
                  <div className="info-row">
                    <label>Edges</label>
                    <span>{callData.workflow.edges}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'outbound' && callData.broadcast && (
          <div className="outbound-tab">
            <div className="section">
              <h3>Campaign Information</h3>
              <div className="info-grid">
                <div className="info-row">
                  <label>Campaign Name</label>
                  <span>{callData.broadcast.name}</span>
                </div>
                <div className="info-row">
                  <label>Campaign Type</label>
                  <span>{callData.broadcast.campaignType}</span>
                </div>
                <div className="info-row">
                  <label>Campaign Status</label>
                  <span className={`status ${callData.broadcast.status}`}>
                    {callData.broadcast.status}
                  </span>
                </div>
                <div className="info-row">
                  <label>Total Recipients</label>
                  <span>{callData.broadcast.totalRecipients}</span>
                </div>
                <div className="info-row">
                  <label>Completed Calls</label>
                  <span>{callData.broadcast.completedCalls}</span>
                </div>
                <div className="info-row">
                  <label>Failed Calls</label>
                  <span>{callData.broadcast.failedCalls}</span>
                </div>
              </div>
            </div>

            {callData.recordingUrl && (
              <div className="section">
                <h3>Recording</h3>
                <audio controls src={callData.recordingUrl} className="audio-player">
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {callData.transcription && (
              <div className="section">
                <h3>Transcription</h3>
                <div className="transcription-box">
                  {callData.transcription}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="ai-tab">
            {callData.aiMetrics && (
              <div className="section">
                <h3>AI Metrics</h3>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <label>Total Exchanges</label>
                    <span>{callData.aiMetrics.totalExchanges || 0}</span>
                  </div>
                  <div className="metric-card">
                    <label>Avg Response Time</label>
                    <span>{callData.aiMetrics.avgResponseTime || 0}ms</span>
                  </div>
                  {callData.aiMetrics.intentMatchRate && (
                    <div className="metric-card">
                      <label>Intent Match Rate</label>
                      <span>{callData.aiMetrics.intentMatchRate}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {callData.conversation?.length > 0 && (
              <div className="section">
                <h3>Conversation Flow</h3>
                <div className="conversation-timeline">
                  {callData.conversation.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.type}`}>
                      <div className="message-header">
                        <span className="message-type">
                          {msg.type === 'user' ? <User size={14} /> : <Bot size={14} />}
                          {msg.type === 'user' ? 'User' : 'AI'}
                        </span>
                        <span className="message-time">{formatDate(msg.timestamp)}</span>
                      </div>
                      <div className="message-content">{msg.content || msg.text}</div>
                      {msg.intent && (
                        <div className="message-intent">Intent: {msg.intent}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'voicemail' && callData.voicemail && (
          <div className="voicemail-tab">
            <div className="section">
              <h3>Voicemail Details</h3>
              <div className="info-grid">
                <div className="info-row">
                  <label>Duration</label>
                  <span>{formatDuration(callData.voicemail.duration)}</span>
                </div>
                <div className="info-row">
                  <label>Received At</label>
                  <span>{formatDate(callData.voicemail.receivedAt)}</span>
                </div>
                <div className="info-row">
                  <label>Transcribed</label>
                  <span>{callData.voicemail.transcribed ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {callData.voicemail.url && (
              <div className="section">
                <h3>Recording</h3>
                <audio controls src={callData.voicemail.url} className="audio-player">
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {callData.voicemail.transcription && (
              <div className="section">
                <h3>Transcription</h3>
                <div className="transcription-box">
                  {callData.voicemail.transcription}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallDetails;
