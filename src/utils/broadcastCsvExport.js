import { formatVoiceDateTime } from './voiceTime';

const toSafeNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateTime = (value) => {
  if (!value) return '';
  return formatVoiceDateTime(value);
};

export const BROADCAST_CAMPAIGN_EXPORT_HEADERS = [
  'Campaign Name',
  'Campaign Id',
  'Status',
  'Created By',
  'Created By Id',
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
  'Audience Mode',
  'Audience Source',
  'Audience Type',
  'Audience Group',
  'Audience Snapshot',
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
  const audienceSource = broadcast?.audienceSource || {};
  const audienceSnapshot = broadcast?.audienceSnapshot || {};
  const audienceMode = String(audienceSnapshot?.mode || audienceSource?.mode || '').trim();
  const audienceLabel = String(audienceSource?.label || audienceSnapshot?.label || '').trim();
  const audienceType = String(audienceSource?.type || audienceSnapshot?.sourceType || '').trim();
  const audienceSegmentName = String(audienceSnapshot?.segmentName || audienceSource?.segmentName || '').trim();
  const audienceSnapshotText = JSON.stringify(
    {
      mode: audienceMode,
      label: audienceLabel,
      sourceType: audienceType,
      segmentId: String(audienceSnapshot?.segmentId || audienceSource?.segmentId || '').trim(),
      segmentName: audienceSegmentName,
      recipientCount: toSafeNumber(audienceSnapshot?.recipientCount || audienceSource?.recipientCount || recipients),
      selectedContactCount: toSafeNumber(
        audienceSnapshot?.selectedContactCount || audienceSource?.selectedContactCount || 0
      ),
      uploadedFileName: String(
        audienceSnapshot?.uploadedFileName || audienceSource?.uploadedFileName || ''
      ).trim()
    }
  );

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
  const createdBy = String(broadcast?.createdBy || broadcast?.createdByEmail || '').trim();
  const createdById = String(broadcast?.createdById || '').trim();

  return [
    broadcast?.name || '',
    broadcast?._id || broadcast?.id || '',
    broadcast?.status || '',
    createdBy,
    createdById,
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
    audienceMode,
    audienceLabel,
    audienceType,
    audienceSegmentName,
    audienceSnapshotText,
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
