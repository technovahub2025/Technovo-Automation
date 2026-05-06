import React from 'react';
import './Modal.css';

const formatReasonLabel = (reason = '') => {
  const normalized = String(reason || '').trim().toLowerCase();
  if (normalized === 'opted_out') return 'Opted Out';
  if (normalized === 'missing_marketing_opt_in') return 'Missing Marketing Opt-In';
  if (normalized === 'freeform_window_closed') return '24h Window Closed';
  if (normalized === 'missing_contact') return 'Missing Contact';
  if (normalized === 'invalid_phone') return 'Invalid Phone';
  return normalized ? normalized.replace(/_/g, ' ') : 'Unknown';
};

const BroadcastAudienceValidationModal = ({
  open,
  validation,
  onClose,
  onProceed
}) => {
  if (!open || !validation) return null;

  const summary = validation?.summary || {};
  const invalidRecipients = Array.isArray(validation?.invalidRecipients)
    ? validation.invalidRecipients
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--wide broadcast-validation-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Broadcast Audience Validation</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="broadcast-validation-summary">
          <div className="broadcast-validation-stat">
            <span>Eligible</span>
            <strong>{summary.eligible || 0}</strong>
          </div>
          <div className="broadcast-validation-stat">
            <span>Invalid</span>
            <strong>{summary.invalid || 0}</strong>
          </div>
          <div className="broadcast-validation-stat">
            <span>Opted Out</span>
            <strong>{summary.optedOut || 0}</strong>
          </div>
          <div className="broadcast-validation-stat">
            <span>Missing Opt-In</span>
            <strong>{summary.missingMarketingOptIn || 0}</strong>
          </div>
        </div>

        {!validation?.canProceed ? (
          <div className="broadcast-validation-banner broadcast-validation-banner--error">
            {summary.missingMarketingOptIn > 0
              ? 'This is a marketing template, but the selected contacts do not have WhatsApp marketing opt-in or a recent customer interaction.'
              : 'No eligible recipients found. Fix the audience and try again.'}
          </div>
        ) : (summary.invalid || 0) > 0 ? (
          <div className="broadcast-validation-banner broadcast-validation-banner--warning">
            {summary.eligible || 0} recipients are eligible and {summary.invalid || 0} will be marked failed in the broadcast report.
          </div>
        ) : (
          <div className="broadcast-validation-banner broadcast-validation-banner--success">
            All recipients are eligible for this broadcast.
          </div>
        )}

        {invalidRecipients.length > 0 ? (
          <div className="broadcast-validation-table-wrap">
            <table className="broadcast-validation-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Reason</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {invalidRecipients.slice(0, 50).map((item, index) => (
                  <tr key={`${item.phone || 'missing'}-${item.reason || 'unknown'}-${index}`}>
                    <td>{item.phone || '-'}</td>
                    <td>{formatReasonLabel(item.reason)}</td>
                    <td>{item.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invalidRecipients.length > 50 ? (
              <p className="broadcast-validation-more">
                Showing first 50 invalid recipients. Total invalid: {invalidRecipients.length}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="primary-btn" onClick={onProceed}>
            Continue with Selected Audience
          </button>
        </div>
      </div>
    </div>
  );
};

export default BroadcastAudienceValidationModal;
