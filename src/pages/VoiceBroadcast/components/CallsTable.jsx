import React, { memo, useMemo } from 'react';
import { Phone, Clock, User, CheckCircle, XCircle, Loader, PhoneOff, AlertCircle } from 'lucide-react';
import './CallsTable.css';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const formatDuration = (seconds) => {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getStatusIcon = (status) => {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} color="#059669" />;
    case 'failed':
    case 'no_answer':
    case 'busy':
    case 'cancelled':
      return <XCircle size={16} color="#dc2626" />;
    case 'opted_out':
      return <PhoneOff size={16} color="#d97706" />;
    case 'calling':
    case 'claiming':
    case 'ringing':
    case 'in_progress':
    case 'answered':
      return <Loader size={16} color="#2563eb" className="spinning" />;
    default:
      return <Clock size={16} color="#94a3b8" />;
  }
};

const stringifyCellValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value.message || value.error || '';
};

const CallRow = memo(({ call, getStatusColor, maxRetries }) => {
  const errorMessage = stringifyCellValue(call.twilioError?.message || call.error?.message || call.error);

  return (
    <tr className={`call-row status-${call.status}`}>
      <td>
        <div className="status-cell">
          {getStatusIcon(call.status)}
          <span className="status-text" style={{ color: getStatusColor(call.status) }}>
            {String(call.status || 'queued').replace('_', ' ')}
          </span>
        </div>
      </td>
      <td>
        <div className="contact-cell">
          <User size={14} />
          <span title={call.contact?.name || 'Unknown'}>{call.contact?.name || 'Unknown'}</span>
        </div>
      </td>
      <td>
        <span className="broadcast-phone-cell" title={call.contact?.phone || undefined}>
          {call.contact?.phone || '-'}
        </span>
      </td>
      <td>{formatTime(call.startTime || call.createdAt)}</td>
      <td>
        <span className="duration-badge">{formatDuration(call.duration)}</span>
      </td>
      <td>
        <span className="attempts-badge">{call.attempts || 0} / {maxRetries}</span>
      </td>
      <td className="error-cell" title={errorMessage || undefined}>
        {errorMessage || '-'}
      </td>
    </tr>
  );
});

CallRow.displayName = 'CallRow';

const CallsTable = ({ calls, getStatusColor, maxRetries = 2, pagination, loading, error, onPageChange, onLimitChange }) => {
  const total = pagination?.total || calls.length;
  const page = pagination?.page || 1;
  const pages = pagination?.pages || 1;
  const limit = pagination?.limit || 50;

  const pageLabel = useMemo(() => {
    if (!total) return 'No calls';
    const start = ((page - 1) * limit) + 1;
    const end = Math.min(total, (page - 1) * limit + calls.length);
    return `Showing ${start}-${end} of ${total} calls`;
  }, [calls.length, limit, page, total]);

  return (
    <div className="calls-table-container">
      <div className="calls-toolbar">
        <div className="calls-count">{pageLabel}</div>
        <label className="calls-page-size">
          Rows per page
          <select value={limit} onChange={(event) => onLimitChange?.(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="calls-inline-error" role="alert">
          <AlertCircle size={16} />
          {stringifyCellValue(error) || 'Failed to load broadcast calls'}
        </div>
      )}

      {loading && calls.length === 0 ? (
        <div className="calls-loading">
          <div className="spinner" />
          <span>Loading calls...</span>
        </div>
      ) : calls.length === 0 ? (
        <div className="calls-empty">
          <Phone size={42} />
          <h3>No calls to display</h3>
          <p>Calls matching the selected filter will appear here.</p>
        </div>
      ) : (
        <>
          <div className="calls-table-wrapper">
            <table className="calls-table">
              <colgroup>
                <col className="calls-col-status" />
                <col className="calls-col-contact" />
                <col className="calls-col-phone" />
                <col className="calls-col-start" />
                <col className="calls-col-duration" />
                <col className="calls-col-attempts" />
                <col className="calls-col-error" />
              </colgroup>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th>Attempts</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <CallRow
                    key={call._id}
                    call={call}
                    getStatusColor={getStatusColor}
                    maxRetries={maxRetries}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {loading && <div className="calls-refreshing">Refreshing calls...</div>}
        </>
      )}

      {total > 0 && (
        <div className="calls-pagination">
          <button
            type="button"
            className="btn btn-secondary calls-pagination-btn"
            disabled={page <= 1 || loading}
            aria-label="Previous page"
            title="Previous page"
            onClick={() => onPageChange?.(page - 1)}
          >
            <span className="calls-pagination-icon" aria-hidden="true">&lt;</span>
          </button>
          <span>Page {page} of {pages}</span>
          <button
            type="button"
            className="btn btn-secondary calls-pagination-btn"
            disabled={page >= pages || loading}
            aria-label="Next page"
            title="Next page"
            onClick={() => onPageChange?.(page + 1)}
          >
            <span className="calls-pagination-icon" aria-hidden="true">&gt;</span>
          </button>
        </div>
      )}

      {total > 0 && pages <= 1 && (
        <div className="calls-single-page-note">No more pages. Showing all calls on one page.</div>
      )}
    </div>
  );
};

export default memo(CallsTable);
