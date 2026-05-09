import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, Copy, Gauge, Inbox, RefreshCw, Send } from 'lucide-react';
import AppToast from '../common/AppToast';
import './BroadcastQueueHealth.css';

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCount = (value) => toNumber(value).toLocaleString();

const formatAge = (value) => {
  const ms = Math.max(0, toNumber(value));
  if (!ms) return '0s';
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes < 60) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return minuteRemainder ? `${hours}h ${minuteRemainder}m` : `${hours}h`;
};

const QueueCard = ({ title, icon: Icon, data, accentClass }) => {
  const safeData = data || {};
  const waiting = formatCount(safeData.waiting);
  const active = formatCount(safeData.active);
  const delayed = formatCount(safeData.delayed);
  const age = formatAge(safeData.oldestWaitingAgeMs || safeData.oldestDelayedAgeMs);

  return (
    <div className={`broadcast-queue-health__queue ${accentClass || ''}`.trim()}>
      <div className="broadcast-queue-health__queue-head">
        <div className="broadcast-queue-health__queue-icon">
          <Icon size={16} />
        </div>
        <div>
          <h4>{title}</h4>
          <span>Oldest job age: {age}</span>
        </div>
      </div>

      <div className="broadcast-queue-health__queue-stats">
        <div>
          <span>Waiting</span>
          <strong>{waiting}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{active}</strong>
        </div>
        <div>
          <span>Delayed</span>
          <strong>{delayed}</strong>
        </div>
      </div>
    </div>
  );
};

const BroadcastQueueHealth = ({
  data,
  loading = false,
  error = null,
  updatedAt = null,
  shareUrl = ''
}) => {
  const safeData = data || {};
  const queues = safeData.queues || {};
  const rateLimit = safeData.rateLimit || null;
  const sendQueue = queues['broadcast-send'] || queues.broadcastSend || {};
  const inboxQueue = queues['broadcast-inbox-write'] || queues.broadcastInboxWrite || {};
  const lag = safeData.lag || {};
  const sendLag = lag['broadcast-send'] || lag.broadcastSend || {};
  const inboxLag = lag['broadcast-inbox-write'] || lag.broadcastInboxWrite || {};
  const limiterActive = rateLimit && rateLimit.enabled && rateLimit.ttlMs > 0;
  const sendWaitingCount = Number(sendQueue.waiting || 0);
  const inboxWaitingCount = Number(inboxQueue.waiting || 0);
  const sendOldestAgeMs = Number(sendLag.oldestWaitingAgeMs || sendLag.oldestDelayedAgeMs || 0);
  const inboxOldestAgeMs = Number(inboxLag.oldestWaitingAgeMs || inboxLag.oldestDelayedAgeMs || 0);
  const limiterCount = Number(rateLimit?.count || 0);
  const limiterMax = Number(rateLimit?.max || 0);
  const limiterUsage = limiterMax > 0 ? limiterCount / limiterMax : 0;
  const limiterTtlMs = Number(rateLimit?.ttlMs || 0);
  const hasPressure =
    Boolean(error) ||
    Boolean(loading) ||
    sendWaitingCount >= 25 ||
    inboxWaitingCount >= 25 ||
    sendOldestAgeMs >= 30000 ||
    inboxOldestAgeMs >= 30000 ||
    (limiterActive && (limiterUsage >= 0.9 || limiterTtlMs <= 10000));
  const statusTone = error ? 'error' : loading ? 'loading' : hasPressure ? 'warning' : 'healthy';
  const statusLabel = error
    ? 'Queue health unavailable'
    : loading
      ? 'Refreshing queue health'
      : hasPressure
        ? 'Queue pressure detected'
        : 'Queue health OK';

  const sendQueueData = {
    ...sendQueue,
    ...sendLag
  };

  const inboxQueueData = {
    ...inboxQueue,
    ...inboxLag
  };
  const [copyState, setCopyState] = useState('idle');
  const [toast, setToast] = useState(null);
  const [isExpanded, setIsExpanded] = useState(hasPressure);

  useEffect(() => {
    if (copyState !== 'error') return undefined;
    const timerId = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timerId);
  }, [copyState]);

  useEffect(() => {
    if (hasPressure) {
      setIsExpanded(true);
    }
  }, [hasPressure]);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timerId = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  const handleCopyShareUrl = async () => {
    const text = String(shareUrl || '').trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState('idle');
      setToast({ type: 'success', message: 'Queue link copied to clipboard.' });
    } catch (_error) {
      setCopyState('error');
      setToast({ type: 'error', message: 'Unable to copy queue link.' });
    }
  };

  const handleToggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <section className="broadcast-queue-health">
      <AppToast toast={toast} className="broadcast-queue-health__toast" />
      <div className="broadcast-queue-health__header">
        <div>
          <h3>Queue Health</h3>
          {isExpanded ? (
            <p>Broadcast throughput, inbox write lag, and sender throttling at a glance.</p>
          ) : (
            <button
              type="button"
              className={`broadcast-queue-health__status-chip broadcast-queue-health__status-chip--${statusTone}`}
              onClick={handleToggleExpanded}
              aria-expanded={isExpanded}
            >
              <span>{statusLabel}</span>
            </button>
          )}
        </div>

        <div className="broadcast-queue-health__meta">
          {shareUrl ? (
            <button
              type="button"
              className="broadcast-queue-health__share"
              onClick={handleCopyShareUrl}
            >
              <Copy size={14} />
              <span>{copyState === 'error' ? 'Copy failed' : 'Copy queue link'}</span>
            </button>
          ) : null}
          {loading ? (
            <span className="broadcast-queue-health__pill"><RefreshCw size={14} /> Refreshing</span>
          ) : null}
          {updatedAt ? (
            <span className="broadcast-queue-health__updated">
              Updated {new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="broadcast-queue-health__error">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      {isExpanded ? (
        <>
          <div className="broadcast-queue-health__grid">
            <QueueCard title="Broadcast Send Queue" icon={Send} data={sendQueueData} accentClass="accent-send" />
            <QueueCard title="Inbox Write Queue" icon={Inbox} data={inboxQueueData} accentClass="accent-inbox" />
          </div>

          <div className="broadcast-queue-health__footer">
            <div className="broadcast-queue-health__rate">
              <Gauge size={15} />
              <div>
                <strong>Rate limiter</strong>
                {limiterActive ? (
                  <span>
                    {formatCount(rateLimit.count)} / {formatCount(rateLimit.max)} used, resets in {formatAge(rateLimit.ttlMs)}
                  </span>
                ) : (
                  <span>Not currently throttled</span>
                )}
              </div>
            </div>

            <div className="broadcast-queue-health__footer-note">
              <Clock3 size={14} />
              <span>
                Oldest waiting job ages show whether broadcasts are backing up faster than workers can drain them.
              </span>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
};

export default BroadcastQueueHealth;
