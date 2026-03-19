import React, { useEffect, useState } from "react";
import apiService from "../services/api";
import "./Analytics.css";
import "../styles/theme.css";

const Analytics = () => {
  const [voiceStats, setVoiceStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const res = await apiService.getVoiceTodayStats();
        if (mounted) {
          setVoiceStats(res?.data?.data || res?.data || null);
        }
      } catch (err) {
        if (mounted) setVoiceStats(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="nx-page analytics-page">
      <header className="nx-page__header">
        <h1 className="nx-title">Analytics</h1>
        <p className="nx-subtitle">Track WhatsApp, voice, and campaign performance.</p>
      </header>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Voice Usage</h3>
          {loading ? (
            <p className="muted">Loading...</p>
          ) : voiceStats ? (
            <div className="metric">
              <span>Total Calls Today</span>
              <strong>{voiceStats.totalCalls || 0}</strong>
            </div>
          ) : (
            <div className="empty-state">No voice analytics available.</div>
          )}
        </div>

        <div className="analytics-card">
          <h3>WhatsApp Usage</h3>
          <div className="empty-state">No WhatsApp usage data available.</div>
        </div>

        <div className="analytics-card">
          <h3>Campaign Success</h3>
          <div className="empty-state">Campaign analytics will appear here.</div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
