import React, { useState, useEffect } from 'react';
import { Phone, ArrowLeft, Info, CheckCircle, AlertCircle, PhoneOutgoing, Mic, Database, Hash, Activity, Clock, Calendar, Users, FileText, Play, Pause, Square, Settings, Upload, Download, RefreshCw, BarChart3, Volume2 } from 'lucide-react';
import { useOutbound } from '../hooks/useOutbound';
import socketService from '../services/socketService';
import apiService from '../services/api';
import './OutboundCall.css';

const OutboundCall = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('quick');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [callSettings, setCallSettings] = useState({
    recordCall: true,
    maxDuration: 300,
    retryAttempts: 3,
    voice: 'ta-IN-PallaviNeural'
  });
  const [bulkCallData, setBulkCallData] = useState({
    contacts: '',
    template: '',
    scheduleTime: ''
  });
  const [liveCallStatus, setLiveCallStatus] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Use custom hook for data management
  const {
    callHistory,
    scheduledCalls,
    templates,
    contacts,
    loading: dataLoading,
    error: dataError,
    refreshAll,
    refreshCallHistory,
    refreshScheduledCalls
  } = useOutbound();

  // Initial data fetch
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // WebSocket real-time updates (following VoiceBroadcast pattern)
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => {
      console.log('✅ Outbound WebSocket connected');
    });

    // Listen for outbound call updates
    socket.on('outbound_call_update', (data) => {
      console.log('📞 Outbound call updated:', data);
      refreshCallHistory();
    });
    // Listen for call status changes
    socket.on('call_status_update', (data) => {
      console.log('📊 Call status updated:', data);
      if (liveCallStatus && data.callSid === liveCallStatus.callSid) {
        setLiveCallStatus(prev => ({
          ...prev,
          status: data.status
        }));
      }
      refreshCallHistory();
    });

    socket.on('disconnect', () => {
      console.log('❌ Outbound WebSocket disconnected');
    });

    // Cleanup on unmount - only remove listeners, keep socket connected
    return () => {
      socket.off('outbound_call_update');
      socket.off('call_status_update');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [refreshCallHistory, liveCallStatus]);

  // Load call settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('outboundCallSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setCallSettings(parsedSettings);
      } catch (err) {
        console.error('Failed to load saved call settings:', err);
      }
    }
  }, []);

  // Save call settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('outboundCallSettings', JSON.stringify(callSettings));
  }, [callSettings]);

  const handleMakeCall = async (e) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.makeOutboundCall(phoneNumber);
      const payload = response.data?.data || response.data || {};
      const callSid = payload.callSid || payload.call_sid;
      setResult(response.data);
      setLiveCallStatus({
        callSid,
        status: 'initiated',
        phoneNumber: phoneNumber,
        startTime: new Date().toISOString()
      });
      refreshCallHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate call. Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleCall = async (e) => {
    e.preventDefault();
    if (!phoneNumber || !scheduleDateTime) return;

    setLoading(true);
    try {
      const response = await apiService.scheduleOutboundCall({
        phoneNumber,
        scheduleTime: scheduleDateTime,
        template: selectedTemplate,
        settings: callSettings
      });
      setResult(response.data);
      refreshScheduledCalls();
      setPhoneNumber('');
      setScheduleDateTime('');
      setSelectedTemplate('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule call.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkCall = async (e) => {
    e.preventDefault();
    if (!bulkCallData.contacts || !bulkCallData.template) return;

    setLoading(true);
    try {
      const contactsList = bulkCallData.contacts.split('\n').filter(phone => phone.trim());
      const response = await apiService.bulkOutboundCall({
        contacts: contactsList,
        template: bulkCallData.template,
        scheduleTime: bulkCallData.scheduleTime,
        settings: callSettings
      });
      setResult(response.data);
      setBulkCallData({ contacts: '', template: '', scheduleTime: '' });

      // Refresh call history and scheduled calls
      if (bulkCallData.scheduleTime) {
        refreshScheduledCalls();
      } else {
        refreshCallHistory();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to initiate bulk calls.');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = async (callSid) => {
    try {
      await apiService.endCall(callSid);
      setLiveCallStatus(null);
      refreshCallHistory();
    } catch (err) {
      console.error('Failed to end call:', err);
    }
  };

  const handleCancelScheduledCall = async (callId) => {
    try {
      await apiService.cancelScheduledCall(callId);
      refreshScheduledCalls();
    } catch (err) {
      console.error('Failed to cancel scheduled call:', err);
    }
  };

  const renderQuickCall = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <PhoneOutgoing size={40} strokeWidth={1.5} />
          </div>

          <h2 className="call-title">Quick Calls</h2>

          <p className="call-subtitle">
            Initiate an automated AI voice call instantly
          </p>
        </div>

        <form onSubmit={handleMakeCall} className="call-form">
          <div className="form-grid">
            <div className="form-section">
              <div className="input-group-lg">
                <label htmlFor="phone" className="input-label">Phone Number</label>
                <div className="phone-input-wrapper">
                  <Hash size={20} className="phone-icon" />
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="phone-input"
                    required
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                <div className="phone-hint">
                  <Info size={14} />
                  <span>Must include country code (e.g., +1, +91)</span>
                </div>
              </div>

              <div className="template-selection">
                <label className="input-label">Call Template (Optional)</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="template-select"
                >
                  <option value="">Default Conversation</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-section">
              <div className="input-group-lg">
                <label className="input-label">Additional Options</label>
                <div className="options-grid">
                  <label className="option-item">
                    <input type="checkbox" defaultChecked />
                    <span>Record Call</span>
                  </label>
                  <label className="option-item">
                    <input type="checkbox" defaultChecked />
                    <span>Enable Analytics</span>
                  </label>
                  <label className="option-item">
                    <input type="checkbox" />
                    <span>Schedule Follow-up</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="action-grid">
            <button
              type="submit"
              className="call-button-lg"
              disabled={loading || !phoneNumber}
            >
              {loading ? (
                <>
                  <div className="spinner-ring" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Start Call Now</span>
                  <Phone size={20} fill="currentColor" />
                </>
              )}
            </button>

            <div className="secondary-actions">
              <button type="button" className="secondary-btn">
                <Settings size={16} />
                Advanced Settings
              </button>
              <button type="button" className="secondary-btn">
                <FileText size={16} />
                View Templates
              </button>
            </div>
          </div>
        </form>

        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon-box">
              <Mic size={18} />
            </div>
            <div className="feature-content">
              <span className="feature-title">AI Conversationalist</span>
              <span className="feature-description">Natural language processing for realistic conversations</span>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon-box">
              <Database size={18} />
            </div>
            <div className="feature-content">
              <span className="feature-title">Auto-Logging</span>
              <span className="feature-description">Automatic call recording and transcription</span>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon-box">
              <Phone size={18} />
            </div>
            <div className="feature-content">
              <span className="feature-title">High Quality Voice</span>
              <span className="feature-description">Crystal clear audio with advanced noise cancellation</span>
            </div>
          </div>
          <div className="feature-item">
            <div className="feature-icon-box">
              <Activity size={18} />
            </div>
            <div className="feature-content">
              <span className="feature-title">Real-time Analytics</span>
              <span className="feature-description">Live performance metrics and insights</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScheduleCall = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <Calendar size={40} strokeWidth={1.5} />
          </div>
          <h2>Schedule Outbound Call</h2>
          <p>Schedule calls for specific times.</p>
        </div>

        <form onSubmit={handleScheduleCall} className="call-form">
          <div className="input-group-lg">
            <label htmlFor="schedule-phone" className="input-label">Phone Number</label>
            <div className="phone-input-wrapper">
              <Hash size={20} className="phone-icon" />
              <input
                id="schedule-phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="phone-input"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group-lg">
            <label htmlFor="schedule-time" className="input-label">Schedule Time</label>
            <input
              id="schedule-time"
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              className="phone-input"
              required
              disabled={loading}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="template-selection">
            <label className="input-label">Call Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="template-select"
              required
            >
              <option value="">Select a template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.description}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="call-button-lg"
            disabled={loading || !phoneNumber || !scheduleDateTime}
          >
            {loading ? (
              <>
                <div className="spinner-ring" />
                <span>Scheduling...</span>
              </>
            ) : (
              <>
                <span>Schedule Call</span>
                <Calendar size={20} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  const renderBulkCall = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <Users size={40} strokeWidth={1.5} />
          </div>
          <h2>Bulk Outbound Calls</h2>
          <p>Send automated calls to multiple contacts.</p>
        </div>

        <form onSubmit={handleBulkCall} className="call-form">
          <div className="input-group-lg">
            <label htmlFor="bulk-contacts" className="input-label">Phone Numbers (one per line)</label>
            <textarea
              id="bulk-contacts"
              placeholder="+1234567890\n+0987654321\n+1122334455"
              value={bulkCallData.contacts}
              onChange={(e) => setBulkCallData({ ...bulkCallData, contacts: e.target.value })}
              className="bulk-textarea"
              rows={6}
              required
              disabled={loading}
            />
            <div className="phone-hint">
              <Info size={14} />
              <span>Enter phone numbers with country code, one per line</span>
            </div>
          </div>

          <div className="template-selection">
            <label className="input-label">Call Template</label>
            <select
              value={bulkCallData.template}
              onChange={(e) => setBulkCallData({ ...bulkCallData, template: e.target.value })}
              className="template-select"
              required
            >
              <option value="">Select a template</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} - {template.description}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group-lg">
            <label htmlFor="bulk-schedule" className="input-label">Schedule Time (Optional)</label>
            <input
              id="bulk-schedule"
              type="datetime-local"
              value={bulkCallData.scheduleTime}
              onChange={(e) => setBulkCallData({ ...bulkCallData, scheduleTime: e.target.value })}
              className="phone-input"
              disabled={loading}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <button
            type="submit"
            className="call-button-lg"
            disabled={loading || !bulkCallData.contacts || !bulkCallData.template}
          >
            {loading ? (
              <>
                <div className="spinner-ring" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Start Bulk Calls</span>
                <Users size={20} />
              </>
            )}
          </button>
        </form>

        <div className="bulk-actions">
          <button type="button" className="secondary-btn">
            <Upload size={16} />
            Upload CSV
          </button>
          <button type="button" className="secondary-btn">
            <Download size={16} />
            Download Template
          </button>
        </div>
      </div>
    </div>
  );

  const renderCallHistory = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <Clock size={40} strokeWidth={1.5} />
          </div>
          <h2>Call History</h2>
          <p>View recent outbound calls.</p>
        </div>

        <div className="history-table">
          <div className="table-header">
            <span>Phone Number</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Time</span>
            <span>Actions</span>
          </div>
          {callHistory.map(call => (
            <div key={call.callSid} className="table-row">
              <span className="phone-number">{call.phoneNumber}</span>
              <span className={`status ${call.status}`}>{call.status}</span>
              <span className="duration">{call.duration}s</span>
              <span className="time">{new Date(call.createdAt).toLocaleString()}</span>
              <span className="actions">
                <button className="action-btn">
                  <BarChart3 size={16} />
                </button>
                <button className="action-btn">
                  <Play size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>

        <button className="refresh-btn" onClick={refreshCallHistory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    </div>
  );

  const renderScheduledCalls = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <Calendar size={40} strokeWidth={1.5} />
          </div>
          <h2>Scheduled Calls</h2>
          <p>Manage upcoming scheduled calls.</p>
        </div>

        <div className="scheduled-list">
          {scheduledCalls.map(call => (
            <div key={call.id} className="scheduled-item">
              <div className="scheduled-info">
                <span className="scheduled-phone">{call.phoneNumber}</span>
                <span className="scheduled-time">
                  {new Date(call.scheduleTime).toLocaleString()}
                </span>
                <span className={`status ${call.status}`}>{call.status}</span>
              </div>
              <div className="scheduled-actions">
                <button className="action-btn edit">
                  <Calendar size={16} />
                </button>
                <button
                  className="action-btn cancel"
                  onClick={() => handleCancelScheduledCall(call.id)}
                >
                  <Square size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="call-card">
      <div className="card-content">
        <div className="call-header-outbound">
          <div className="icon-wrapper">
            <Settings size={40} strokeWidth={1.5} />
          </div>
          <h2>Call Settings</h2>
          <p>Configure outbound call preferences.</p>
        </div>

        <div className="settings-form">
          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={callSettings.recordCall}
                onChange={(e) => setCallSettings({ ...callSettings, recordCall: e.target.checked })}
              />
              Record Calls
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">Max Duration (seconds)</label>
            <input
              type="number"
              value={callSettings.maxDuration}
              onChange={(e) => setCallSettings({ ...callSettings, maxDuration: parseInt(e.target.value) })}
              className="setting-input"
              min="30"
              max="1800"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Retry Attempts</label>
            <input
              type="number"
              value={callSettings.retryAttempts}
              onChange={(e) => setCallSettings({ ...callSettings, retryAttempts: parseInt(e.target.value) })}
              className="setting-input"
              min="0"
              max="5"
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">Voice</label>
            <select
              value={callSettings.voice}
              onChange={(e) => setCallSettings({ ...callSettings, voice: e.target.value })}
              className="setting-select"
            >
              <option value="en-GB-SoniaNeural">Sonia (British English)</option>
              <option value="en-GB-RyanNeural">Ryan (British English)</option>
              <option value="ta-IN-PallaviNeural">Pallavi (Tamil)</option>
              <option value="ta-IN-ValluvarNeural">Valluvar (Tamil)</option>
            </select>
          </div>

          <button className="save-settings-btn">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="outbound-call">
      {/* Back Button - Voice Broadcast Style */}
      <button
        className="btn-link"
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: 0
        }}
        onClick={() => window.history.back()}
        aria-label="Back to Dashboard"
      >
        <ArrowLeft size={20} />
        Back to Dashboard
      </button>

      <div className="outbound-header">
        <div className="header-content">
          <h1>Outbound Call Management</h1>
          <p>Manage outbound calls, scheduling, and voice broadcasts</p>
          <div className="connection-status">
            <span className="status-connected">🟢 System Active</span>
          </div>
        </div>
        <div className="header-actions">
          {/* Settings button removed */}
        </div>
      </div>

      {/* Tab Navigation - Horizontal Bar */}
      <div className="outbound-tabs">
        <button
          className={`tab-btn ${activeTab === 'quick' ? 'active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          <PhoneOutgoing size={18} />
          Quick Call
        </button>
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={18} />
          Schedule
        </button>
        <button
          className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Users size={18} />
          Bulk Call
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={18} />
          History
        </button>
        <button
          className={`tab-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          <Calendar size={18} />
          Scheduled
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={18} />
          Settings
        </button>
      </div>

      {/* Live Call Status Banner */}
      {liveCallStatus && (
        <div className="live-call-banner">
          <div className="live-call-content">
            <div className="live-call-info">
              <div className="live-indicator">
                <div className="live-dot"></div>
                <span>Live Call</span>
              </div>
              <span className="live-number">{liveCallStatus.phoneNumber}</span>
              <span className="live-duration">
                {Math.floor((Date.now() - new Date(liveCallStatus.startTime)) / 1000)}s
              </span>
            </div>
            <div className="live-call-controls">
              <button className="call-control-btn mute">
                <Mic size={16} />
              </button>
              <button
                className="call-control-btn end"
                onClick={() => handleEndCall(liveCallStatus.callSid)}
              >
                <Phone size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="outbound-content">
        {activeTab === 'quick' && renderQuickCall()}
        {activeTab === 'schedule' && renderScheduleCall()}
        {activeTab === 'bulk' && renderBulkCall()}
        {activeTab === 'history' && renderCallHistory()}
        {activeTab === 'scheduled' && renderScheduledCalls()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Status Messages */}
      {result && (
        <div className="status-card success">
          <div className="status-icon">
            <CheckCircle size={24} />
          </div>
          <div className="status-content">
            <h3>Success</h3>
            <p>{result.message || 'Operation completed successfully'}</p>
            {(result.call_sid || result.data?.callSid || result.data?.call_sid) && (
              <span className="sid-badge">SID: {result.call_sid || result.data?.callSid || result.data?.call_sid}</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="status-card error">
          <div className="status-icon">
            <AlertCircle size={24} />
          </div>
          <div className="status-content">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundCall;


