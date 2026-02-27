/**
 * Stabilizes broadcast statistics by preventing rapid fluctuations.
 * Uses input signature-aware cache so overview never shows stale counts.
 */

// Debounce function to prevent rapid successive updates
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Cache for storing stable stats to prevent fluctuations
let statsCache = {
  data: null,
  timestamp: null,
  debounceTimer: null,
  signature: ''
};

const getBroadcastsSignature = (broadcasts = []) => {
  if (!Array.isArray(broadcasts) || broadcasts.length === 0) return 'empty';
  return broadcasts
    .map((broadcast) => {
      const stats = broadcast?.stats || {};
      return [
        String(broadcast?._id || ''),
        String(broadcast?.updatedAt || broadcast?.completedAt || broadcast?.startedAt || broadcast?.createdAt || ''),
        Number(stats.sent || 0),
        Number(stats.delivered || 0),
        Number(stats.read || 0),
        Number(stats.replied || 0),
        Number(stats.failed || 0),
        String(broadcast?.status || '')
      ].join(':');
    })
    .join('|');
};

/**
 * Validates and normalizes broadcast stats to ensure logical consistency
 */
export const validateBroadcastStats = (broadcasts) => {
  if (!Array.isArray(broadcasts)) return [];

  return broadcasts.map((broadcast) => {
    const stats = broadcast.stats || {};
    const recipientCount = broadcast.recipientCount || broadcast.recipients?.length || 0;

    // read implies delivered; delivered/read should not exceed sent/recipients.
    const maxPossible = recipientCount > 0 ? recipientCount : Number(stats.sent || 0);
    const sent = Math.min(Number(stats.sent || 0), maxPossible);
    const delivered = Math.min(Math.max(Number(stats.delivered || 0), Number(stats.read || 0)), sent);
    const read = Math.min(Number(stats.read || 0), delivered);
    const replied = Math.min(Number(stats.replied || 0), read);
    const failed = Math.min(Number(stats.failed || 0), sent);

    return {
      ...broadcast,
      stats: {
        ...stats,
        sent,
        delivered,
        read,
        replied,
        failed
      }
    };
  });
};

/**
 * Calculates stable overview stats without debouncing for immediate results
 */
export const calculateStableOverviewStats = (broadcasts) => {
  const validatedBroadcasts = validateBroadcastStats(broadcasts || []);

  const stats = validatedBroadcasts.reduce(
    (acc, broadcast) => {
      const broadcastStats = broadcast.stats || {};

      const sent = Number(broadcastStats.sent || 0);
      const delivered = Number(broadcastStats.delivered || 0);
      const read = Number(broadcastStats.read || 0);
      const replied = Number(broadcastStats.replied || 0);
      const failed = Number(broadcastStats.failed || 0);
      const recipientCount = Number(broadcast.recipientCount || broadcast.recipients?.length || 0);
      const status = String(broadcast.status || '').toLowerCase();

      return {
        sent: acc.sent + sent,
        delivered: acc.delivered + delivered,
        read: acc.read + read,
        replied: acc.replied + replied,
        sending: acc.sending + (status === 'sending' ? recipientCount : 0),
        failed: acc.failed + failed,
        processing: acc.processing + (status === 'processing' ? 1 : 0),
        queued: acc.queued + (status === 'scheduled' ? 1 : 0)
      };
    },
    {
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      sending: 0,
      failed: 0,
      processing: 0,
      queued: 0
    }
  );

  // Update cache
  statsCache.data = stats;
  statsCache.timestamp = Date.now();

  return stats;
};

// Keep debounced function for compatibility with previous imports/usage.
const debouncedCalculateStableOverviewStats = debounce(calculateStableOverviewStats, 500);
void debouncedCalculateStableOverviewStats;

/**
 * Gets cached stats if they're recent enough and input data is unchanged,
 * otherwise calculates new ones.
 */
export const getCachedOverviewStats = (broadcasts, maxAge = 2000) => {
  const now = Date.now();
  const signature = getBroadcastsSignature(broadcasts);

  if (
    statsCache.data &&
    statsCache.timestamp &&
    statsCache.signature === signature &&
    now - statsCache.timestamp < maxAge
  ) {
    return statsCache.data;
  }

  const next = calculateStableOverviewStats(broadcasts);
  statsCache.signature = signature;
  return next;
};

/**
 * Clears the stats cache (useful for manual refreshes)
 */
export const clearStatsCache = () => {
  statsCache.data = null;
  statsCache.timestamp = null;
  statsCache.signature = '';
  if (statsCache.debounceTimer) {
    clearTimeout(statsCache.debounceTimer);
    statsCache.debounceTimer = null;
  }
};
