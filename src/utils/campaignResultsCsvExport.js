import { toIsoTimestamp } from './csvExport.js';

export const CAMPAIGN_RESULTS_EXPORT_HEADERS = [
  'broadcastId',
  'phone',
  'status',
  'messageId',
  'error',
  'timestamp',
  'waStatus',
  'recipientId'
];

export const mapCampaignResultToExportRow = (result = {}, { broadcastId = '', fallbackTimestamp = '' } = {}) => {
  const messageId = result?.response?.messages?.[0]?.id || result?.messageId || '';
  const timestamp =
    toIsoTimestamp(result?.timestamp) ||
    toIsoTimestamp(result?.createdAt) ||
    fallbackTimestamp ||
    new Date().toISOString();

  return [
    broadcastId,
    result?.phone || '',
    result?.success ? 'success' : 'failed',
    messageId,
    result?.success ? '' : (result?.error || 'Failed'),
    timestamp,
    result?.status || '',
    result?.recipientId || result?.contactId || ''
  ];
};

export const mapCampaignResultsToExportRows = (results = [], options = {}) =>
  (Array.isArray(results) ? results : []).map((result) => mapCampaignResultToExportRow(result, options));
