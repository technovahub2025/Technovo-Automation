import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Play, Users, Settings, AlertCircle } from 'lucide-react';
import BroadcastForm from "../VoiceBroadcast/components/BroadcastForm";
import BroadcastList from "../VoiceBroadcast/components/BroadcastList";
import BroadcastMonitor from "../VoiceBroadcast/components/BroadcastMonitor";
import { broadcastAPI } from '../../services/broadcastAPI';
import { useBroadcast } from '../VoiceBroadcast/hooks/useBroadcast';
import socketService from '../../services/socketService';
import apiService from '../../services/api';
import './VoiceBroadcast.css';

const VoiceBroadcast = () => {

  const [activeTab, setActiveTab] = useState('create');
  const [activeBroadcastId, setActiveBroadcastId] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState({ total: 0, active: 0 });
  const [healthStatus, setHealthStatus] = useState({
    backend: false,
    ai: false
  });

  // Initialize with safe defaults
  const {
    broadcasts = [],
    loading = false,
    error = null,
    summary,
    query,
    searchInput,
    pagination,
    selectedIds,
    autoRefresh,
    setAutoRefresh,
    refreshBroadcasts = () => { },
    updateQuery = () => { },
    updateSearch = () => { },
    resetFilters = () => { },
    saveFilters = () => { },
    toggleSelected = () => { },
    setAllVisibleSelected = () => { },
    clearSelection = () => { },
    bulkCancel = () => { },
    bulkDelete = () => { }
  } = useBroadcast() || {};

  useEffect(() => {
    // Initial fetch
    if (refreshBroadcasts) {
      refreshBroadcasts();
    }

    const checkHealth = async () => {
      try {
        const [backendHealth, aiHealth] = await Promise.all([
          apiService.checkBackendHealth(),
          apiService.checkAIHealth()
        ]);

        setHealthStatus({
          backend: backendHealth?.data?.status === 'online',
          ai: aiHealth?.data?.status === 'healthy'
        });
      } catch (err) {
        console.error('Failed to fetch voice service health', err);
      }
    };

    checkHealth();

    const socket = socketService.connect();

    const handleConnect = () => {
      console.log('Connected to dashboard socket');
    };

    const handleStatsUpdate = (data) => {
      setRealtimeStats({
        total: data.totalCampaigns,
        active: data.activeCampaigns
      });
    };

    const handleBroadcastListUpdate = () => {
      if (refreshBroadcasts) refreshBroadcasts();
    };

    const handleHealthUpdate = (data = {}) => {
      setHealthStatus({
        backend: Boolean(data.backend),
        ai: Boolean(data.ai)
      });
    };

    socket.on('connect', handleConnect);
    socket.on('stats_update', handleStatsUpdate);
    socket.on('broadcast_list_update', handleBroadcastListUpdate);
    socket.on('health_update', handleHealthUpdate);

    // Cleanup on unmount - only remove listeners, keep socket connected
    return () => {
      socket.off('connect', handleConnect);
      socket.off('stats_update', handleStatsUpdate);
      socket.off('broadcast_list_update', handleBroadcastListUpdate);
      socket.off('health_update', handleHealthUpdate);
    };
  }, [refreshBroadcasts]);

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
  const totalCampaigns = realtimeStats.total || pagination?.total || broadcasts.length;
  const activeCampaigns = realtimeStats.active || summary?.active || broadcasts.filter(b => b.status === 'in_progress').length;

  const handleRefresh = useCallback(() => {
    refreshBroadcasts();
  }, [refreshBroadcasts]);
  return (
    <div className="voice-broadcast">
      {/* Header */}
      <div className="broadcast-header">
        <div className="header-content">
          <h1>Voice Broadcast</h1>
          <p className="subtitle">
            Send automated voice messages to multiple contacts
          </p>
          <div className="voice-health-status">
            <div className={`voice-status-badge ${healthStatus.backend ? 'online' : 'offline'}`}>
              <span className="voice-pulse-dot" aria-hidden="true" />
              Backend: {healthStatus.backend ? 'Online' : 'Offline'}
            </div>
            <div className={`voice-status-badge ${healthStatus.ai ? 'online' : 'offline'}`}>
              <span className="voice-pulse-dot" aria-hidden="true" />
              AI Service: {healthStatus.ai ? 'Healthy' : 'Unhealthy'}
            </div>
          </div>
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
      <div className={`broadcast-content ${activeTab === 'monitor' ? 'monitor-content' : ''}`}>
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
            summary={summary}
            query={query}
            searchInput={searchInput}
            pagination={pagination}
            selectedIds={selectedIds}
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            onQueryChange={updateQuery}
            onSearchChange={updateSearch}
            onResetFilters={resetFilters}
            onSaveFilters={saveFilters}
            onToggleSelected={toggleSelected}
            onToggleAllVisible={setAllVisibleSelected}
            onClearSelection={clearSelection}
            onBulkStop={bulkCancel}
            onBulkDelete={bulkDelete}
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
