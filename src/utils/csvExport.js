export const escapeCsvCell = (value) => {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

export const CSV_EXPORT_EVENT_NAME = 'app:csv-export';
const CSV_ASYNC_CHUNK_SIZE = 1000;
const CSV_ASYNC_THRESHOLD = 1000;

const canUseBrowserDownload = () =>
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  window?.URL &&
  typeof window.URL.createObjectURL === 'function' &&
  typeof window.URL.revokeObjectURL === 'function' &&
  typeof document.createElement === 'function';

const triggerCsvDownload = (payload, filename) => {
  if (!canUseBrowserDownload()) return;

  const blob = new Blob(Array.isArray(payload) ? payload : [payload], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(link);
};

const yieldToMainThread = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    const setTimeoutFn =
      (typeof globalThis !== 'undefined' && typeof globalThis.setTimeout === 'function')
        ? globalThis.setTimeout.bind(globalThis)
        : setTimeout;
    setTimeoutFn(resolve, 0);
  });

const buildCsvMetadataBlock = (metadata = []) => {
  const lines = Array.isArray(metadata)
    ? metadata
        .filter((line) => Array.isArray(line) && line.length > 0)
        .map((line) => line.map(escapeCsvCell).join(','))
    : [];

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
};

const normalizeCsvRow = (row, rowMapper, index) => {
  const mappedRow = typeof rowMapper === 'function' ? rowMapper(row, index) : row;
  return Array.isArray(mappedRow) ? mappedRow : [];
};

const normalizeCsvSection = (section = {}) => ({
  title: String(section?.title || '').trim(),
  headers: Array.isArray(section?.headers) ? section.headers : [],
  rows: Array.isArray(section?.rows) ? section.rows : [],
  rowMapper: typeof section?.rowMapper === 'function' ? section.rowMapper : null
});

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

export const downloadCsvAsync = async ({
  filename,
  headers,
  rows,
  metadata,
  includeBom = true,
  exportType = 'generic',
  onTelemetry,
  rowMapper,
  chunkSize = CSV_ASYNC_CHUNK_SIZE,
  onProgress
} = {}) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const resolvedFilename = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`;
  const blobParts = [];

  if (includeBom) {
    blobParts.push('\uFEFF');
  }

  const metadataBlock = buildCsvMetadataBlock(metadata);
  if (metadataBlock) {
    blobParts.push(metadataBlock);
  }

  const normalizedHeaders = Array.isArray(headers) ? headers : [];
  if (normalizedHeaders.length > 0) {
    blobParts.push(`${normalizedHeaders.join(',')}\n`);
  }

  const totalRows = sourceRows.length;
  if (totalRows > 0) {
    const safeChunkSize = Math.max(1, Number(chunkSize) || CSV_ASYNC_CHUNK_SIZE);
    for (let start = 0; start < totalRows; start += safeChunkSize) {
      const end = Math.min(start + safeChunkSize, totalRows);
      const chunkLines = [];

      for (let index = start; index < end; index += 1) {
        const row = normalizeCsvRow(sourceRows[index], rowMapper, index);
        chunkLines.push(row.map(escapeCsvCell).join(','));
      }

      if (chunkLines.length > 0) {
        blobParts.push(`${chunkLines.join('\n')}\n`);
      }

      if (typeof onProgress === 'function') {
        onProgress({
          processedRows: end,
          totalRows
        });
      }

      if (end < totalRows) {
        await yieldToMainThread();
      }
    }
  }

  const canDownload = canUseBrowserDownload();
  if (canDownload) {
    triggerCsvDownload(blobParts, resolvedFilename);
  }

  const telemetry = emitCsvExportTelemetry({
    filename: resolvedFilename,
    exportType,
    rowCount: totalRows,
    headerCount: normalizedHeaders.length,
    metadataCount: Array.isArray(metadata) ? metadata.length : 0
  });

  if (typeof onTelemetry === 'function') {
    onTelemetry(telemetry);
  }

  return telemetry;
};

export const downloadCsvSectionsAsync = async ({
  filename,
  sections,
  includeBom = true,
  exportType = 'generic',
  onTelemetry,
  chunkSize = CSV_ASYNC_CHUNK_SIZE,
  onProgress
} = {}) => {
  const normalizedSections = Array.isArray(sections)
    ? sections.map(normalizeCsvSection).filter((section) => (
        section.title || section.headers.length > 0 || section.rows.length > 0
      ))
    : [];

  const blobParts = [];
  if (includeBom) {
    blobParts.push('\uFEFF');
  }

  let totalRows = 0;
  let totalHeaders = 0;
  normalizedSections.forEach((section) => {
    totalRows += section.rows.length;
    totalHeaders += section.headers.length;
  });

  for (let sectionIndex = 0; sectionIndex < normalizedSections.length; sectionIndex += 1) {
    const section = normalizedSections[sectionIndex];

    if (sectionIndex > 0) {
      blobParts.push('\n');
    }

    if (section.title) {
      blobParts.push(`${section.title}\n`);
    }

    if (section.headers.length > 0) {
      blobParts.push(`${section.headers.join(',')}\n`);
    }

    const rowCount = section.rows.length;
    if (rowCount === 0) continue;

    const safeChunkSize = Math.max(1, Number(chunkSize) || CSV_ASYNC_CHUNK_SIZE);
    for (let start = 0; start < rowCount; start += safeChunkSize) {
      const end = Math.min(start + safeChunkSize, rowCount);
      const chunkLines = [];

      for (let index = start; index < end; index += 1) {
        const row = normalizeCsvRow(section.rows[index], section.rowMapper, index);
        chunkLines.push(row.map(escapeCsvCell).join(','));
      }

      if (chunkLines.length > 0) {
        blobParts.push(`${chunkLines.join('\n')}\n`);
      }

      if (typeof onProgress === 'function') {
        onProgress({
          sectionIndex,
          sectionTitle: section.title,
          processedRows: end,
          totalRows,
          sectionRowCount: rowCount
        });
      }

      if (end < rowCount) {
        await yieldToMainThread();
      }
    }
  }

  const resolvedFilename = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`;
  if (canUseBrowserDownload()) {
    triggerCsvDownload(blobParts, resolvedFilename);
  }

  const telemetry = emitCsvExportTelemetry({
    filename: resolvedFilename,
    exportType,
    rowCount: totalRows,
    headerCount: totalHeaders,
    metadataCount: 0
  });

  if (typeof onTelemetry === 'function') {
    onTelemetry(telemetry);
  }

  return telemetry;
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
  onTelemetry,
  rowMapper
} = {}) => {
  const rowCount = Array.isArray(rows) ? rows.length : 0;
  if (rowCount >= CSV_ASYNC_THRESHOLD) {
    return downloadCsvAsync({
      filename,
      headers,
      rows,
      metadata,
      includeBom,
      exportType,
      onTelemetry,
      rowMapper
    });
  }

  const normalizedRows = Array.isArray(rows)
    ? (typeof rowMapper === 'function' ? rows.map((row, index) => rowMapper(row, index)) : rows)
    : [];
  const csvContent = buildCsvContent({ headers, rows: normalizedRows, metadata });
  const payload = includeBom ? `\uFEFF${csvContent}` : csvContent;
  const resolvedFilename = filename || `export_${new Date().toISOString().slice(0, 10)}.csv`;
  triggerCsvDownload(payload, resolvedFilename);

  const telemetry = emitCsvExportTelemetry({
    filename: resolvedFilename,
    exportType,
    rowCount,
    headerCount: Array.isArray(headers) ? headers.length : 0,
    metadataCount: Array.isArray(metadata) ? metadata.length : 0
  });

  if (typeof onTelemetry === 'function') {
    onTelemetry(telemetry);
  }

  return telemetry;
};
