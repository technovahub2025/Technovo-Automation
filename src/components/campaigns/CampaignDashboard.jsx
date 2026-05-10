import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useCampaigns from '../../hooks/useCampaigns';
import useCampaignCalls from '../../hooks/useCampaignCalls';
import { CAMPAIGN_STATUS } from '../../config/api.config';

const CampaignDashboard = ({ campaignId }) => {
  const {
    activeCampaign,
    campaignStats,
    fetchCampaign,
    fetchCampaignStats,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    loading,
    error,
  } = useCampaigns();

  const { calls, activeCalls, getCallStats } = useCampaignCalls(campaignId);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  /**
   * Load campaign data
   */
  useEffect(() => {
    if (campaignId) {
      fetchCampaign(campaignId);
      fetchCampaignStats(campaignId);
    }
  }, [campaignId, fetchCampaign, fetchCampaignStats]);

  /**
   * Auto-refresh statistics every 5 seconds
   */
  useEffect(() => {
    if (!autoRefresh || !campaignId) return;

    const interval = setInterval(() => {
      fetchCampaignStats(campaignId);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, campaignId, fetchCampaignStats]);

  /**
   * Handle campaign actions
   */
  const handleStart = useCallback(async () => {
    setActionLoading('start');
    try {
      await startCampaign(campaignId);
    } catch (err) {
      console.error('Failed to start campaign:', err);
    } finally {
      setActionLoading(null);
    }
  }, [campaignId, startCampaign]);

  const handlePause = useCallback(async () => {
    setActionLoading('pause');
    try {
      await pauseCampaign(campaignId);
    } catch (err) {
      console.error('Failed to pause campaign:', err);
    } finally {
      setActionLoading(null);
    }
  }, [campaignId, pauseCampaign]);

  const handleResume = useCallback(async () => {
    setActionLoading('resume');
    try {
      await resumeCampaign(campaignId);
    } catch (err) {
      console.error('Failed to resume campaign:', err);
    } finally {
      setActionLoading(null);
    }
  }, [campaignId, resumeCampaign]);

  const handleStop = useCallback(async () => {
    if (!window.confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
      return;
    }

    setActionLoading('stop');
    try {
      await stopCampaign(campaignId);
    } catch (err) {
      console.error('Failed to stop campaign:', err);
    } finally {
      setActionLoading(null);
    }
  }, [campaignId, stopCampaign]);

  /**
   * Get current statistics
   */
  const stats = useMemo(() => {
    const campaignStatData = campaignStats[campaignId] || {};
    const callStatData = getCallStats();

    return {
      totalContacts: campaignStatData.totalContacts || 0,
      contacted: campaignStatData.contacted || 0,
      remaining: campaignStatData.remaining || 0,
      successful: callStatData.completed || 0,
      failed: callStatData.failed || 0,
      noAnswer: callStatData.noAnswer || 0,
      busy: callStatData.busy || 0,
      voicemail: callStatData.voicemail || 0,
      activeCalls: activeCalls.length,
      avgDuration: callStatData.avgDuration || 0,
      successRate: campaignStatData.contacted > 0
        ? Math.round((callStatData.completed / campaignStatData.contacted) * 100)
        : 0,
    };
  }, [campaignStats, campaignId, getCallStats, activeCalls]);

  /**
   * Calculate progress percentage
   */
  const progressPercent = useMemo(() => {
    if (!stats.totalContacts) return 0;
    return Math.round((stats.contacted / stats.totalContacts) * 100);
  }, [stats]);

  /**
   * Format duration
   */
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status) => {
    const colors = {
      [CAMPAIGN_STATUS.DRAFT]: 'gray',
      [CAMPAIGN_STATUS.SCHEDULED]: 'blue',
      [CAMPAIGN_STATUS.RUNNING]: 'green',
      [CAMPAIGN_STATUS.PAUSED]: 'yellow',
      [CAMPAIGN_STATUS.COMPLETED]: 'purple',
      [CAMPAIGN_STATUS.STOPPED]: 'red',
    };
    return colors[status] || 'gray';
  };

  if (loading && !activeCampaign) {
    return (
      <div className="campaign-dashboard loading">
        <div className="spinner" role="status">
          <span className="sr-only">Loading campaign...</span>
        </div>
      </div>
    );
  }

  if (!activeCampaign) {
    return (
      <div className="campaign-dashboard error">
        <p>Campaign not found</p>
      </div>
    );
  }

  return (
    <div className="campaign-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="campaign-info">
          <h1>{activeCampaign.name}</h1>
          <span 
            className={`status-badge status-${getStatusColor(activeCampaign.status)}`}
            role="status"
          >
            {activeCampaign.status}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="campaign-actions">
          {activeCampaign.status === CAMPAIGN_STATUS.DRAFT && (
            <button
              onClick={handleStart}
              disabled={actionLoading !== null}
              className="btn btn-primary"
              aria-label="Start campaign"
            >
              {actionLoading === 'start' ? 'Starting...' : 'Start Campaign'}
            </button>
          )}

          {activeCampaign.status === CAMPAIGN_STATUS.RUNNING && (
            <>
              <button
                onClick={handlePause}
                disabled={actionLoading !== null}
                className="btn btn-warning"
                aria-label="Pause campaign"
              >
                {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
              </button>
              <button
                onClick={handleStop}
                disabled={actionLoading !== null}
                className="btn btn-danger"
                aria-label="Stop campaign"
              >
                {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
              </button>
            </>
          )}

          {activeCampaign.status === CAMPAIGN_STATUS.PAUSED && (
            <>
              <button
                onClick={handleResume}
                disabled={actionLoading !== null}
                className="btn btn-success"
                aria-label="Resume campaign"
              >
                {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
              </button>
              <button
                onClick={handleStop}
                disabled={actionLoading !== null}
                className="btn btn-danger"
                aria-label="Stop campaign"
              >
                {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Progress: {stats.contacted} / {stats.totalContacts}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2c0-4.97-4.03-9-9-9v2c3.87 0 7 3.13 7 7zm-4 0h2c0-2.76-2.24-5-5-5v2c1.66 0 3 1.34 3 3z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeCalls}</div>
            <div className="stat-label">Active Calls</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.successful}</div>
            <div className="stat-label">Successful</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon failed">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.noAnswer}</div>
            <div className="stat-label">No Answer</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.voicemail}</div>
            <div className="stat-label">Voicemail</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-value">{formatDuration(stats.avgDuration)}</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      </div>

      {/* Recent Calls Table */}
      <div className="recent-calls-section">
        <div className="section-header">
          <h2>Recent Calls</h2>
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
        </div>

        <div className="calls-table-container">
          <table className="calls-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {calls.slice(0, 20).map(call => (
                <tr key={call.callId}>
                  <td>{call.contactName || 'Unknown'}</td>
                  <td>{call.phoneNumber}</td>
                  <td>
                    <span className={`status-badge status-${call.status}`}>
                      {call.status}
                    </span>
                  </td>
                  <td>{call.duration ? formatDuration(call.duration) : '-'}</td>
                  <td>{new Date(call.updatedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {calls.length === 0 && (
            <div className="empty-state">
              <p>No calls yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignDashboard;