import React, { useState, useCallback, useMemo } from 'react';
import { useCallbacks, useVoicemail } from '../../../hooks/useCallbacksVoicemail';
import './CallbacksVoicemailManager.css';

const CallbacksVoicemailManager = () => {
  const {
    callbacks,
    createCallback,
    completeCallback,
    deleteCallback,
    loading: callbacksLoading,
    error: callbacksError,
  } = useCallbacks();

  const {
    voicemails,
    markAsRead,
    deleteVoicemail,
    getTranscription,
    loading: voicemailLoading,
    error: voicemailError,
  } = useVoicemail();

  const [activeTab, setActiveTab] = useState('callbacks');
  const [showCreateCallback, setShowCreateCallback] = useState(false);
  const [selectedVoicemail, setSelectedVoicemail] = useState(null);
  const [playingVoicemail, setPlayingVoicemail] = useState(null);
  const [callbackForm, setCallbackForm] = useState({
    phoneNumber: '',
    customerName: '',
    notes: '',
    scheduledFor: '',
    priority: 'normal',
  });

  /**
   * Filter due callbacks
   */
  const dueCallbacks = useMemo(() => {
    return callbacks.filter(cb => {
      if (cb.status === 'completed') return false;
      const scheduledTime = new Date(cb.scheduledFor);
      return scheduledTime <= new Date();
    });
  }, [callbacks]);

  /**
   * Filter pending callbacks
   */
  const pendingCallbacks = useMemo(() => {
    return callbacks.filter(cb => {
      if (cb.status === 'completed') return false;
      const scheduledTime = new Date(cb.scheduledFor);
      return scheduledTime > new Date();
    });
  }, [callbacks]);

  /**
   * Filter unread voicemails
   */
  const unreadVoicemails = useMemo(() => {
    return voicemails.filter(vm => !vm.isRead);
  }, [voicemails]);

  /**
   * Handle callback form change
   */
  const handleCallbackFormChange = useCallback((field, value) => {
    setCallbackForm(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  /**
   * Handle create callback
   */
  const handleCreateCallback = useCallback(async (e) => {
    e.preventDefault();

    try {
      await createCallback(callbackForm);
      setCallbackForm({
        phoneNumber: '',
        customerName: '',
        notes: '',
        scheduledFor: '',
        priority: 'normal',
      });
      setShowCreateCallback(false);
    } catch (err) {
      console.error('Failed to create callback:', err);
    }
  }, [callbackForm, createCallback]);

  /**
   * Handle complete callback
   */
  const handleCompleteCallback = useCallback(async (callbackId) => {
    try {
      await completeCallback(callbackId);
    } catch (err) {
      console.error('Failed to complete callback:', err);
    }
  }, [completeCallback]);

  /**
   * Handle delete callback
   */
  const handleDeleteCallback = useCallback(async (callbackId) => {
    if (!window.confirm('Are you sure you want to delete this callback?')) {
      return;
    }

    try {
      await deleteCallback(callbackId);
    } catch (err) {
      console.error('Failed to delete callback:', err);
    }
  }, [deleteCallback]);

  /**
   * Handle voicemail playback
   */
  const handlePlayVoicemail = useCallback((voicemail) => {
    setPlayingVoicemail(voicemail._id);
    setSelectedVoicemail(voicemail);

    if (!voicemail.isRead) {
      markAsRead(voicemail._id);
    }
  }, [markAsRead]);

  /**
   * Handle delete voicemail
   */
  const handleDeleteVoicemail = useCallback(async (voicemailId) => {
    if (!window.confirm('Are you sure you want to delete this voicemail?')) {
      return;
    }

    try {
      await deleteVoicemail(voicemailId);
      if (selectedVoicemail?._id === voicemailId) {
        setSelectedVoicemail(null);
        setPlayingVoicemail(null);
      }
    } catch (err) {
      console.error('Failed to delete voicemail:', err);
    }
  }, [deleteVoicemail, selectedVoicemail]);

  /**
   * Load transcription
   */
  const handleLoadTranscription = useCallback(async (voicemailId) => {
    try {
      const transcription = await getTranscription(voicemailId);
      setSelectedVoicemail(prev => prev?._id === voicemailId
        ? { ...prev, transcription }
        : prev
      );
    } catch (err) {
      console.error('Failed to load transcription:', err);
    }
  }, [getTranscription]);

  /**
   * Format date/time
   */
  const formatDateTime = (date) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  /**
   * Format duration
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Get priority color
   */
  const getPriorityColor = (priority) => {
    const colors = {
      high: 'red',
      normal: 'blue',
      low: 'gray',
    };
    return colors[priority] || 'blue';
  };

  return (
    <div className="callbacks-voicemail-manager">
      <div className="manager-header">
        <h1>Callbacks & Voicemail</h1>
        
        <div className="header-stats">
          <div className="stat-badge callbacks">
            <span className="stat-value">{dueCallbacks.length}</span>
            <span className="stat-label">Due Callbacks</span>
          </div>
          <div className="stat-badge voicemail">
            <span className="stat-value">{unreadVoicemails.length}</span>
            <span className="stat-label">Unread Voicemails</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'callbacks' ? 'active' : ''}`}
          onClick={() => setActiveTab('callbacks')}
        >
          Callbacks
          {dueCallbacks.length > 0 && (
            <span className="badge">{dueCallbacks.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'voicemail' ? 'active' : ''}`}
          onClick={() => setActiveTab('voicemail')}
        >
          Voicemail
          {unreadVoicemails.length > 0 && (
            <span className="badge">{unreadVoicemails.length}</span>
          )}
        </button>
      </div>

      {/* Callbacks Tab */}
      {activeTab === 'callbacks' && (
        <div className="callbacks-section">
          {/* Callbacks error display removed */}

          <div className="section-header">
            <h2>Scheduled Callbacks</h2>
            <button
              onClick={() => setShowCreateCallback(true)}
              className="btn btn-primary"
            >
              Schedule Callback
            </button>
          </div>

          {/* Create Callback Form */}
          {showCreateCallback && (
            <div className="callback-form-card">
              <h3>Schedule New Callback</h3>
              <form onSubmit={handleCreateCallback}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="callback-phone">
                      Phone Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      id="callback-phone"
                      value={callbackForm.phoneNumber}
                      onChange={(e) => handleCallbackFormChange('phoneNumber', e.target.value)}
                      placeholder="+1234567890"
                      required
                      disabled={callbacksLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="callback-name">Customer Name</label>
                    <input
                      type="text"
                      id="callback-name"
                      value={callbackForm.customerName}
                      onChange={(e) => handleCallbackFormChange('customerName', e.target.value)}
                      placeholder="John Doe"
                      disabled={callbacksLoading}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="callback-scheduled">
                      Scheduled For <span className="required">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      id="callback-scheduled"
                      value={callbackForm.scheduledFor}
                      onChange={(e) => handleCallbackFormChange('scheduledFor', e.target.value)}
                      required
                      disabled={callbacksLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="callback-priority">Priority</label>
                    <select
                      id="callback-priority"
                      value={callbackForm.priority}
                      onChange={(e) => handleCallbackFormChange('priority', e.target.value)}
                      disabled={callbacksLoading}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="callback-notes">Notes</label>
                  <textarea
                    id="callback-notes"
                    value={callbackForm.notes}
                    onChange={(e) => handleCallbackFormChange('notes', e.target.value)}
                    placeholder="Additional notes about this callback..."
                    rows="3"
                    disabled={callbacksLoading}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateCallback(false)}
                    className="btn btn-secondary"
                    disabled={callbacksLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={callbacksLoading}
                  >
                    {callbacksLoading ? 'Scheduling...' : 'Schedule Callback'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Due Callbacks */}
          {dueCallbacks.length > 0 && (
            <div className="callbacks-list">
              <h3 className="list-title">Due Now ({dueCallbacks.length})</h3>
              {dueCallbacks.map(callback => (
                <div key={callback._id} className="callback-card due">
                  <div className="callback-header">
                    <div className="callback-info">
                      <div className="phone-number">{callback.phoneNumber}</div>
                      {callback.customerName && (
                        <div className="customer-name">{callback.customerName}</div>
                      )}
                    </div>
                    <span className={`priority-badge priority-${getPriorityColor(callback.priority)}`}>
                      {callback.priority}
                    </span>
                  </div>

                  <div className="callback-body">
                    <div className="callback-time">
                      <strong>Scheduled:</strong> {formatDateTime(callback.scheduledFor)}
                    </div>
                    {callback.notes && (
                      <div className="callback-notes">{callback.notes}</div>
                    )}
                  </div>

                  <div className="callback-actions">
                    <button
                      onClick={() => handleCompleteCallback(callback._id)}
                      className="btn btn-sm btn-success"
                      disabled={callbacksLoading}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => handleDeleteCallback(callback._id)}
                      className="btn btn-sm btn-danger"
                      disabled={callbacksLoading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Callbacks */}
          {pendingCallbacks.length > 0 && (
            <div className="callbacks-list">
              <h3 className="list-title">Upcoming ({pendingCallbacks.length})</h3>
              {pendingCallbacks.map(callback => (
                <div key={callback._id} className="callback-card">
                  <div className="callback-header">
                    <div className="callback-info">
                      <div className="phone-number">{callback.phoneNumber}</div>
                      {callback.customerName && (
                        <div className="customer-name">{callback.customerName}</div>
                      )}
                    </div>
                    <span className={`priority-badge priority-${getPriorityColor(callback.priority)}`}>
                      {callback.priority}
                    </span>
                  </div>

                  <div className="callback-body">
                    <div className="callback-time">
                      <strong>Scheduled:</strong> {formatDateTime(callback.scheduledFor)}
                    </div>
                    {callback.notes && (
                      <div className="callback-notes">{callback.notes}</div>
                    )}
                  </div>

                  <div className="callback-actions">
                    <button
                      onClick={() => handleDeleteCallback(callback._id)}
                      className="btn btn-sm btn-danger"
                      disabled={callbacksLoading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {callbacks.length === 0 && !showCreateCallback && (
            <div className="empty-state">
              <p>No scheduled callbacks</p>
            </div>
          )}
        </div>
      )}

      {/* Voicemail Tab */}
      {activeTab === 'voicemail' && (
        <div className="voicemail-section">
          {/* Voicemail error display removed */}

          <h2>Voicemails</h2>

          {voicemails.length === 0 ? (
            <div className="empty-state">
              <p>No voicemails</p>
            </div>
          ) : (
            <div className="voicemail-container">
              {/* Voicemail List */}
              <div className="voicemail-list">
                {voicemails.map(voicemail => (
                  <div
                    key={voicemail._id}
                    className={`voicemail-item ${!voicemail.isRead ? 'unread' : ''} ${selectedVoicemail?._id === voicemail._id ? 'selected' : ''}`}
                    onClick={() => handlePlayVoicemail(voicemail)}
                  >
                    <div className="voicemail-header">
                      <div className="caller-info">
                        <div className="caller-number">{voicemail.from}</div>
                        {voicemail.callerName && (
                          <div className="caller-name">{voicemail.callerName}</div>
                        )}
                      </div>
                      {!voicemail.isRead && (
                        <span className="unread-badge">New</span>
                      )}
                    </div>

                    <div className="voicemail-meta">
                      <span className="voicemail-time">{formatDateTime(voicemail.receivedAt)}</span>
                      <span className="voicemail-duration">{formatDuration(voicemail.duration)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Voicemail Player */}
              {selectedVoicemail && (
                <div className="voicemail-player">
                  <div className="player-header">
                    <h3>Voicemail Details</h3>
                    <button
                      onClick={() => handleDeleteVoicemail(selectedVoicemail._id)}
                      className="btn btn-sm btn-danger"
                      disabled={voicemailLoading}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="player-info">
                    <div className="info-item">
                      <strong>From:</strong> {selectedVoicemail.from}
                    </div>
                    {selectedVoicemail.callerName && (
                      <div className="info-item">
                        <strong>Name:</strong> {selectedVoicemail.callerName}
                      </div>
                    )}
                    <div className="info-item">
                      <strong>Received:</strong> {formatDateTime(selectedVoicemail.receivedAt)}
                    </div>
                    <div className="info-item">
                      <strong>Duration:</strong> {formatDuration(selectedVoicemail.duration)}
                    </div>
                  </div>

                  {selectedVoicemail.audioUrl && (
                    <div className="audio-player">
                      <audio controls src={selectedVoicemail.audioUrl}>
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}

                  {/* Transcription */}
                  <div className="transcription-section">
                    <div className="section-header">
                      <h4>Transcription</h4>
                      {!selectedVoicemail.transcription && selectedVoicemail.transcriptionStatus !== 'completed' && (
                        <button
                          onClick={() => handleLoadTranscription(selectedVoicemail._id)}
                          className="btn btn-sm btn-secondary"
                          disabled={voicemailLoading}
                        >
                          Load Transcription
                        </button>
                      )}
                    </div>

                    {selectedVoicemail.transcription ? (
                      <div className="transcription-content">
                        <p>{selectedVoicemail.transcription}</p>
                      </div>
                    ) : selectedVoicemail.transcriptionStatus === 'processing' ? (
                      <p className="transcription-status">Transcription in progress...</p>
                    ) : (
                      <p className="transcription-status">No transcription available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CallbacksVoicemailManager;