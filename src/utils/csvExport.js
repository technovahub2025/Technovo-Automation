export const escapeCsvCell = (value) => {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

export const CSV_EXPORT_EVENT_NAME = 'app:csv-export';

export const toIsoTimestamp = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

export const buildCsvContent = ({ headers = [], rows = [], metadata = [] } = {}) => {
  const metadataLines = Array.isArray(metadata)
    ? metadata
        .filter((line) => Array.isArray(line) && line.length > 0)
        .map((line) => line.map(escapeCsvCell).join(','))
    : [];

  const headerLine = Array.isArray(headers) && headers.length > 0 ? [headers.join(',')] : [];
  const rowLines = Array.isArray(rows)
    ? rows.map((row) => (Array.isArray(row) ? row.map(escapeCsvCell).join(',') : ''))
    : [];

  return [...metadataLines, ...headerLine, ...rowLines].join('\n');
};

export const emitCsvExportTelemetry = ({
  filename = '',
  exportType = 'generic',
  rowCount = 0,
  headerCount = 0,
  metadataCount = 0
} = {}) => {
  const payload = {
    filename: String(filename || ''),
    exportType: String(exportType || 'generic'),
    rowCount: Number(rowCount || 0),
    headerCount: Number(headerCount || 0),
    metadataCount: Number(metadataCount || 0),
    exportedAt: new Date().toISOString()
  };

  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof window.CustomEvent === 'function'
  ) {
    window.dispatchEvent(new window.CustomEvent(CSV_EXPORT_EVENT_NAME, { detail: payload }));
  }

  return payload;
};

export const downloadCsv = ({
  filename,
  headers,
  rows,
  metadata,
  includeBom = true,
  exportType = 'generic',
  onTelemetry
} = {}) => {
  const csvContent = buildCsvContent({ headers, rows, metadata });
  const payload = includeBom ? `\uFEFF${csvContent}` : csvContent;
  const resolvedFilename = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`;
  const canDownloadInBrowser =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    window?.URL &&
    typeof window.URL.createObjectURL === 'function' &&
    typeof window.URL.revokeObjectURL === 'function' &&
    typeof document.createElement === 'function';

  if (canDownloadInBrowser) {
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resolvedFilename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  const telemetry = emitCsvExportTelemetry({
    filename: resolvedFilename,
    exportType,
    rowCount: Array.isArray(rows) ? rows.length : 0,
    headerCount: Array.isArray(headers) ? headers.length : 0,
    metadataCount: Array.isArray(metadata) ? metadata.length : 0
  });

  if (typeof onTelemetry === 'function') {
    onTelemetry(telemetry);
  }

  return telemetry;
};
