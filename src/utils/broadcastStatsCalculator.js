/**
 * Correctly calculates broadcast overview statistics
 * Fixes the double-counting issue in the original implementation
 */

export const calculateCorrectOverviewStats = (broadcasts) => {
  console.log('🔍 calculateCorrectOverviewStats called with broadcasts:', broadcasts);
  
  const stats = broadcasts.reduce((acc, broadcast) => {
    const broadcastStats = broadcast.stats || {};
    console.log(`🔍 Processing broadcast "${broadcast.name}":`, {
      stats: broadcastStats,
      delivered: broadcastStats.delivered,
      sent: broadcastStats.sent,
      read: broadcastStats.read
    });
    
    const sent = broadcastStats.sent || 0;
    const delivered = broadcastStats.delivered || 0;
    const read = broadcastStats.read || 0;
    const replied = broadcastStats.replied || 0;
    const failed = broadcastStats.failed || 0;
    
    // IMPORTANT FIX: Use the actual delivered count, not the corrected one
    // The delivered count should represent actual deliveries, not be inflated by reads
    // Read messages are a subset of delivered messages, not additional deliveries
    
    // Only use delivered count as-is - don't inflate it to match read count
    const actualDelivered = delivered;
    
    // Log if there's a logical inconsistency for debugging, but don't fix it in the calculation
    if (read > actualDelivered) {
      console.log(`⚠️  Logical inconsistency detected for "${broadcast.name}":`, {
        delivered: actualDelivered,
        read: read,
        note: 'Read count exceeds delivered count - this indicates backend data issue'
      });
    }
    
    return {
      sent: acc.sent + sent,
      delivered: acc.delivered + actualDelivered,
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

  console.log('🔍 Final corrected overview stats:', stats);
  return stats;
};

/**
 * Alternative function that ensures logical consistency without double-counting
 * This version ensures delivered >= read but doesn't inflate both counts
 */
export const calculateConsistentOverviewStats = (broadcasts) => {
  console.log('🔍 calculateConsistentOverviewStats called with broadcasts:', broadcasts);
  
  const stats = broadcasts.reduce((acc, broadcast) => {
    const broadcastStats = broadcast.stats || {};
    
    const sent = broadcastStats.sent || 0;
    const delivered = broadcastStats.delivered || 0;
    const read = broadcastStats.read || 0;
    const replied = broadcastStats.replied || 0;
    const failed = broadcastStats.failed || 0;
    
    // Ensure logical consistency: delivered should be >= read
    // But only adjust delivered if it's genuinely underreported
    let finalDelivered = delivered;
    let finalRead = read;
    
    if (read > delivered) {
      // If read > delivered, it means delivered is underreported
      // Set delivered to match read, but don't add read again
      finalDelivered = read;
      finalRead = read; // Keep read as-is since we're using it for delivered
      
      console.log(`🔧 Adjusting delivered count for "${broadcast.name}":`, {
        originalDelivered: delivered,
        read: read,
        adjustedDelivered: finalDelivered,
        reason: 'Read count cannot exceed delivered count'
      });
    }
    
    return {
      sent: acc.sent + sent,
      delivered: acc.delivered + finalDelivered,
      read: acc.read + finalRead,
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

  console.log('🔍 Final consistent overview stats:', stats);
  return stats;
};
