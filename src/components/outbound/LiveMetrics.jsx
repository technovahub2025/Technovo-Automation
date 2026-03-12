import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import socketService from '../../services/socketService';

const MAX_POINTS = 20;

const LiveMetrics = ({ initialMetrics = null, isQuickCallLoading = false, alwaysVisible = false }) => {
  const [series, setSeries] = useState([]);
  const [latest, setLatest] = useState({ total: 0, initiated: 0, failed: 0, successRate: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [hasActiveCampaign, setHasActiveCampaign] = useState(false);

  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return undefined;

    const handleMetrics = (payload = {}) => {
      const point = {
        time: new Date(payload.timestamp || Date.now()).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        initiated: Number(payload.initiated || 0),
        failed: Number(payload.failed || 0),
        total: Number(payload.total || 0)
      };

      setLatest({
        total: point.total,
        initiated: point.initiated,
        failed: point.failed,
        successRate: Number(payload.successRate || 0)
      });

      // Quick call streams usually send initiated snapshots without a completion event.
      // Keep visibility tied to quickCallLoading for quick mode, and use completed flag for campaigns.
      const mode = String(payload?.mode || '').toLowerCase();
      setSeries((prev) => [...prev, point].slice(-MAX_POINTS));
      const isCompleted = Boolean(payload?.completed);
      const nextHasActiveCampaign = mode === 'quick' ? false : !isCompleted;
      setHasActiveCampaign(nextHasActiveCampaign);
      setIsVisible(alwaysVisible || isQuickCallLoading || nextHasActiveCampaign);
    };

    socket.on('outbound_metrics', handleMetrics);

    return () => {
      socket.off('outbound_metrics', handleMetrics);
    };
  }, [alwaysVisible, isQuickCallLoading]);

  useEffect(() => {
    setIsVisible(Boolean(alwaysVisible || isQuickCallLoading || hasActiveCampaign));
  }, [alwaysVisible, isQuickCallLoading, hasActiveCampaign]);

  const chartData = useMemo(() => series, [series]);
  const displayedLatest = useMemo(() => {
    const hasLiveData = series.length > 0;
    if (hasLiveData) return latest;
    if (!initialMetrics) return latest;
    return {
      total: Number(initialMetrics.total || 0),
      initiated: Number(initialMetrics.initiated || 0),
      failed: Number(initialMetrics.failed || 0),
      successRate: Number(initialMetrics.successRate || 0)
    };
  }, [series.length, latest, initialMetrics]);

  if (!isVisible) {
    return null;
  }

  return (
    <section className="outbound-card">
      <div className="outbound-section-head">
        <h3>Live Metrics</h3>
        <p>Realtime Exotel outbound metrics via unified socket channel.</p>
      </div>

      <div className="metrics-grid">
        <div>
          <h4>Total</h4>
          <p>{displayedLatest.total}</p>
        </div>
        <div>
          <h4>Initiated</h4>
          <p>{displayedLatest.initiated}</p>
        </div>
        <div>
          <h4>Failed</h4>
          <p>{displayedLatest.failed}</p>
        </div>
        <div>
          <h4>Success</h4>
          <p>{displayedLatest.successRate}%</p>
        </div>
      </div>

      <div className="metrics-chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="initiatedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="failedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="initiated" stroke="#2563eb" fill="url(#initiatedFill)" />
            <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="url(#failedFill)" />
          </AreaChart>
        </ResponsiveContainer>
        {!chartData.length && <p className="outbound-muted">No live points yet. Trigger a call to begin stream.</p>}
      </div>
    </section>
  );
};

export default LiveMetrics;
