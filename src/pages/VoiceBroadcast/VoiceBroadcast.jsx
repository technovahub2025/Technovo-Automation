import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Play, Users, Settings, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BroadcastForm from "../VoiceBroadcast/components/BroadcastForm";
import BroadcastList from "../VoiceBroadcast/components/BroadcastList";
import BroadcastMonitor from "../VoiceBroadcast/components/BroadcastMonitor";
import { broadcastAPI } from '../../services/broadcastAPI';
import { useBroadcast } from '../VoiceBroadcast/hooks/useBroadcast';
import socketService from '../../services/socketService';
import './VoiceBroadcast.css';

const VoiceBroadcast = () => {

  const [activeTab, setActiveTab] = useState('create');
  const [activeBroadcastId, setActiveBroadcastId] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState({ total: 0, active: 0 });

  // Initialize with safe defaults
  const { broadcasts = [], loading = false, error = null, refreshBroadcasts = () => { } } = useBroadcast() || {};
  const navigate = useNavigate();

  useEffect(() => {
    // Initial fetch
    if (refreshBroadcasts) {
      refreshBroadcasts();
    }

    const socket = socketService.connect();

    socket.on('connect', () => {
      console.log('Connected to dashboard socket');
    });

    socket.on('stats_update', (data) => {
      setRealtimeStats({
        total: data.totalCampaigns,
        active: data.activeCampaigns
      });
    });

    socket.on('broadcast_list_update', () => {
      if (refreshBroadcasts) refreshBroadcasts();
    });

    // Cleanup on unmount - only remove listeners, keep socket connected
    return () => {
      socket.off('stats_update');
      socket.off('broadcast_list_update');
      socket.off('connect');
    };
  }, [refreshBroadcasts]);

  // Sync initial stats from loaded broadcasts if socket hasn't updated yet
  useEffect(() => {
    if (broadcasts.length > 0 && realtimeStats.total === 0) {
      setRealtimeStats({
        total: broadcasts.length,
        active: broadcasts.filter(b => b.status === 'in_progress').length
      });
    }
  }, [broadcasts]);

  // Memoized handlers to prevent re-renders
  const handleBroadcastCreated = useCallback((broadcastId) => {
    setActiveBroadcastId(broadcastId);
    setActiveTab('monitor');
    refreshBroadcasts();
  }, [refreshBroadcasts]);

  const handleMonitorBroadcast = useCallback((broadcastId) => {
    setActiveBroadcastId(broadcastId);
    setActiveTab('monitor');
  }, []);

  const handleStopBroadcast = useCallback(async (broadcastId) => {
    if (!window.confirm('Are you sure you want to stop this broadcast?')) return;
    try {
      await broadcastAPI.cancelBroadcast(broadcastId);
      refreshBroadcasts();
    } catch (err) {
      console.error('Failed to stop broadcast:', err);
      alert('Failed to stop broadcast');
    }
  }, [refreshBroadcasts]);

  const handleDeleteBroadcast = useCallback(async (broadcastId) => {
    if (!window.confirm('Are you sure you want to delete this broadcast? This action cannot be undone.')) return;
    try {
      await broadcastAPI.deleteBroadcast(broadcastId);
      refreshBroadcasts();
    } catch (err) {
      console.error('Failed to delete broadcast:', err);
      alert('Failed to delete broadcast');
    }
  }, [refreshBroadcasts]);

  // Calculate stats from actual broadcast data
  const totalCampaigns = broadcasts.length;
  const activeCampaigns = broadcasts.filter(b => b.status === 'in_progress').length;

  const handleRefresh = useCallback(() => {
    refreshBroadcasts();
  }, [refreshBroadcasts]);
  return (
    <div className="voice-broadcast">
      {/* Back Button */}
      <button
        className="btn-link"
        style={{
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingLeft: 0
        }}
        onClick={() => navigate('/voice-automation')}
        aria-label="Back to Voice Automation"
      >
        <ArrowLeft size={20} />
        Back to Voice Automation
      </button>

      {/* Header */}
      <div className="broadcast-header">
        <div className="header-content">
          <h1>Voice Broadcast</h1>
          <p className="subtitle">
            Send automated voice messages to multiple contacts
          </p>
        </div>

        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-value-voice">{totalCampaigns}</span>
            <span className="stat-label">Total Campaigns</span>
          </div>
          <div className="stat-card">
            <span className="stat-value-voice">{activeCampaigns}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="compliance-notice" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        <div>
          <strong>Compliance Requirements:</strong>
          <p>
            Broadcasts include automated call disclaimer. Only call opt-in users.
            DND numbers are automatically filtered. Recipients can press 9 to opt-out.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="broadcast-tabs" role="tablist" aria-label="Broadcast tabs">
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
          role="tab"
          aria-selected={activeTab === 'create'}
        >
          <Upload size={18} aria-hidden="true" />
          Create Broadcast
        </button>

        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
          role="tab"
          aria-selected={activeTab === 'list'}
        >
          <Users size={18} aria-hidden="true" />
          All Campaigns
        </button>

        {activeBroadcastId && (
          <button
            className={`tab ${activeTab === 'monitor' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitor')}
            role="tab"
            aria-selected={activeTab === 'monitor'}
          >
            <Play size={18} aria-hidden="true" />
            Monitor
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="broadcast-content">
        {activeTab === 'create' && (
          <BroadcastForm onBroadcastCreated={handleBroadcastCreated} />
        )}

        {activeTab === 'list' && (
          <BroadcastList
            broadcasts={broadcasts || []}
            loading={loading}
            onMonitor={handleMonitorBroadcast}
            onStop={handleStopBroadcast}
            onDelete={handleDeleteBroadcast}
            onRefresh={refreshBroadcasts}
          />
        )}

        {activeTab === 'monitor' && activeBroadcastId && (
          <BroadcastMonitor
            broadcastId={activeBroadcastId}
            onBroadcastUpdated={handleRefresh}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceBroadcast;