export const mergeBroadcastProgress = (broadcast, incomingStats = {}) => {
  const stats = { ...broadcast.stats, ...incomingStats };
  const total = Number(broadcast.recipientCount || broadcast.recipients?.length || 0);
  for (const key of ["sent", "delivered", "read", "replied", "failed"]) {
    const value = Number(stats[key] || 0);
    stats[key] = Number.isFinite(value) ? Math.max(0, value) : 0;
    if (total > 0) stats[key] = Math.min(total, stats[key]);
  }
  const sent = stats.sent;
  const base = total || sent || stats.delivered || stats.read || stats.replied || stats.failed;
  const percentage = (count) => base ? Math.min(100, Math.round(count / base * 100)) : 0;
  return {
    ...broadcast,
    stats,
    sentCount: sent,
    successfulPercentage: percentage(Math.max(sent, stats.delivered, stats.read)),
    readPercentage: percentage(Math.max(stats.read, stats.replied)),
    repliedPercentage: percentage(stats.replied),
  };
};
