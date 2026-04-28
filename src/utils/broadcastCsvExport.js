const toSafeNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const BROADCAST_CAMPAIGN_EXPORT_HEADERS = [
  'Campaign Name',
  'Campaign Id',
  'Status',
  'Created Time',
  'Scheduled Time',
  'Recipients',
  'Sent',
  'Delivered',
  'Read',
  'Failed',
  'Success Rate (%)',
  'Read Rate (%)',
  'Suppressed',
  'Deferred',
  'Retried',
  'Quiet Hours Enabled',
  'Quiet Hours Window',
  'Quiet Hours Timezone',
  'Quiet Hours Action',
  'Retry Enabled',
  'Retry Max Attempts',
  'Retry Backoff (sec)',
  'Respect Opt-Out',
  'Suppression List Count'
];

export const mapBroadcastToCampaignExportRow = (broadcast = {}) => {
  const stats = broadcast?.stats || {};
  const sent = toSafeNumber(stats.sent);
  const delivered = toSafeNumber(stats.delivered);
  const read = toSafeNumber(stats.read);
  const failed = toSafeNumber(stats.failed);
  const recipients = toSafeNumber(broadcast?.recipientCount || broadcast?.recipients?.length || 0);
  const successRate = sent > 0 ? ((Math.max(delivered, read) / sent) * 100).toFixed(1) : '0.0';
  const readRate = sent > 0 ? ((read / sent) * 100).toFixed(1) : '0.0';

  const retrySummary = broadcast?.retrySummary || {};
  const reliability = retrySummary?.analytics || {};
  const suppressed = toSafeNumber(reliability.suppressed);
  const deferred = toSafeNumber(reliability.deferred);
  const retried = toSafeNumber(reliability.retried);

  const deliveryPolicy = retrySummary?.deliveryPolicy || broadcast?.deliveryPolicy || {};
  const quietHours = deliveryPolicy?.quietHours || {};
  const quietHoursEnabled = Boolean(quietHours.enabled);
  const quietHoursWindow = quietHoursEnabled
    ? `${toSafeNumber(quietHours.startHour)}:00-${toSafeNumber(quietHours.endHour)}:00`
    : '';

  const retryPolicy = retrySummary?.retryPolicy || broadcast?.retryPolicy || {};
  const compliancePolicy = retrySummary?.compliancePolicy || broadcast?.compliancePolicy || {};
  const suppressionListCount = toSafeNumber(
    compliancePolicy?.suppressionListCount ||
    (Array.isArray(compliancePolicy?.suppressionList) ? compliancePolicy.suppressionList.length : 0)
  );

  return [
    broadcast?.name || '',
    broadcast?._id || broadcast?.id || '',
    broadcast?.status || '',
    formatDateTime(broadcast?.createdAt),
    formatDateTime(broadcast?.scheduledAt) || 'Immediate',
    recipients,
    sent,
    delivered,
    read,
    failed,
    successRate,
    readRate,
    suppressed,
    deferred,
    retried,
    quietHoursEnabled ? 'Yes' : 'No',
    quietHoursWindow,
    quietHours?.timezone || '',
    deliveryPolicy?.outsideWindowAction || '',
    retryPolicy?.enabled ? 'Yes' : 'No',
    toSafeNumber(retryPolicy?.maxAttempts),
    toSafeNumber(retryPolicy?.backoffSeconds),
    compliancePolicy?.respectOptOut ? 'Yes' : 'No',
    suppressionListCount
  ];
};

export const mapBroadcastsToCampaignExportRows = (broadcasts = []) =>
  (Array.isArray(broadcasts) ? broadcasts : []).map(mapBroadcastToCampaignExportRow);
