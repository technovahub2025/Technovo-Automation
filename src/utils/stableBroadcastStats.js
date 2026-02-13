/**
 * Stabilizes broadcast statistics by preventing rapid fluctuations
 * Addresses the issue where numbers increase/decrease due to competing update mechanisms
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
  debounceTimer: null
};

/**
 * Validates and normalizes broadcast stats to ensure logical consistency
 */
export const validateBroadcastStats = (broadcasts) => {
  if (!Array.isArray(broadcasts)) return [];
  
  return broadcasts.map(broadcast => {
    const stats = broadcast.stats || {};
    const recipientCount = broadcast.recipientCount || broadcast.recipients?.length || 0;
    
    // Use backend stats directly but ensure logical consistency
    // Don't use Math.min() which can cause decreases
    let sent = Math.min(stats.sent || 0, recipientCount);
    let delivered = Math.min(stats.delivered || 0, sent);
    let read = Math.min(stats.read || 0, delivered);
    let replied = Math.min(stats.replied || 0, read);
    let failed = Math.min(stats.failed || 0, sent);
    
    // Only log if there are meaningful changes
    const hasChanges = 
      stats.sent !== sent ||
      stats.delivered !== delivered ||
      stats.read !== read ||
      stats.replied !== replied ||
      stats.failed !== failed;
    
    if (hasChanges) {
      console.log(`🔧 Normalizing stats for "${broadcast.name}":`, {
        original: stats,
        normalized: { sent, delivered, read, replied, failed },
        recipientCount
      });
    }
    
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
  console.log('🔍 calculateStableOverviewStats called with', broadcasts.length, 'broadcasts');
  
  // Validate and normalize broadcast data first
  const validatedBroadcasts = validateBroadcastStats(broadcasts);
  
  console.log('🔍 Validated broadcasts:', validatedBroadcasts.length);
  
  const stats = validatedBroadcasts.reduce((acc, broadcast, index) => {
    const broadcastStats = broadcast.stats || {};
    
    const sent = broadcastStats.sent || 0;
    const delivered = broadcastStats.delivered || 0;
    const read = broadcastStats.read || 0;
    const replied = broadcastStats.replied || 0;
    const failed = broadcastStats.failed || 0;
    
    console.log(`📊 Broadcast ${index + 1} "${broadcast.name}":`, {
      sent, delivered, read, replied, failed,
      status: broadcast.status,
      recipients: broadcast.recipientCount || broadcast.recipients?.length || 0
    });
    
    return {
      sent: acc.sent + sent,
      delivered: acc.delivered + delivered,
      read: acc.read + read,
      replied: acc.replied + replied,
      sending: acc.sending + (broadcast.status === 'sending' ? broadcast.recipientCount || 0 : 0),
      failed: acc.failed + failed,
      processing: acc.processing + (broadcast.status === 'processing' ? 1 : 0),
      queued: acc.queued + (broadcast.status === 'scheduled' ? 1 : 0),
    };
  }, {
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    sending: 0,
    failed: 0,
    processing: 0,
    queued: 0,
  });

  console.log('🔍 Final stable overview stats:', stats);
  console.log('📊 Read count breakdown:', {
    totalRead: stats.read,
    broadcastsWithRead: validatedBroadcasts.filter(b => (b.stats?.read || 0) > 0).length,
    totalBroadcasts: validatedBroadcasts.length
  });
  
  // Update cache
  statsCache.data = stats;
  statsCache.timestamp = Date.now();
  
  return stats;
};

// Debounced version for frequent updates
const debouncedCalculateStableOverviewStats = debounce(calculateStableOverviewStats, 500);

/**
 * Gets cached stats if they're recent enough, otherwise calculates new ones
 */
export const getCachedOverviewStats = (broadcasts, maxAge = 2000) => {
  const now = Date.now();
  
  if (statsCache.data && statsCache.timestamp && (now - statsCache.timestamp) < maxAge) {
    console.log('📋 Using cached stats (age:', now - statsCache.timestamp, 'ms)');
    return statsCache.data;
  }
  
  console.log('🔄 Cache expired or empty, calculating new stats');
  return calculateStableOverviewStats(broadcasts);
};

/**
 * Clears the stats cache (useful for manual refreshes)
 */
export const clearStatsCache = () => {
  console.log('🗑️  Clearing stats cache');
  statsCache.data = null;
  statsCache.timestamp = null;
  if (statsCache.debounceTimer) {
    clearTimeout(statsCache.debounceTimer);
    statsCache.debounceTimer = null;
  }
};
