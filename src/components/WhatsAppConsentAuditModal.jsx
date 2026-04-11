import React from 'react';
import '../styles/whatsappConsentAuditModal.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const renderValue = (value) => {
  const text = String(value || '').trim();
  return text || '-';
};

const metadataEntries = (metadata) =>
  metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '')
    : [];

const WhatsAppConsentAuditModal = ({
  open,
  onClose,
  loading = false,
  error = '',
  data = null,
  contactName = '',
  phone = '',
  onRefresh = null
}) => {
  if (!open) return null;

  const entries = metadataEntries(data?.whatsappOptInMetadata);

  return (
    <div className="modal-overlay whatsapp-consent-audit-overlay">
      <div className="modal whatsapp-consent-audit-modal">
        <div className="modal-header">
          <div>
            <h3>WhatsApp Consent Audit</h3>
            <p className="whatsapp-consent-audit-subtitle">
              {renderValue(contactName)}{phone ? ` · ${phone}` : ''}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body whatsapp-consent-audit-body">
          {loading ? (
            <div className="whatsapp-consent-audit-state">Loading consent audit...</div>
          ) : error ? (
            <div className="whatsapp-consent-audit-state whatsapp-consent-audit-state--error">{error}</div>
          ) : (
            <>
              <div className="whatsapp-consent-audit-grid">
                <div className="whatsapp-consent-audit-row">
                  <span>Status</span>
                  <strong>{renderValue(data?.whatsappOptInStatus)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Opt-in At</span>
                  <strong>{formatDateTime(data?.whatsappOptInAt)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Opt-in Source</span>
                  <strong>{renderValue(data?.whatsappOptInSource)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Scope</span>
                  <strong>{renderValue(data?.whatsappOptInScope)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Proof Type</span>
                  <strong>{renderValue(data?.whatsappOptInProofType)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Proof ID</span>
                  <strong>{renderValue(data?.whatsappOptInProofId)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Proof URL</span>
                  {data?.whatsappOptInProofUrl ? (
                    <a href={data.whatsappOptInProofUrl} target="_blank" rel="noreferrer">Open proof</a>
                  ) : (
                    <strong>-</strong>
                  )}
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Captured By</span>
                  <strong>{renderValue(data?.whatsappOptInCapturedBy)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Page URL</span>
                  {data?.whatsappOptInPageUrl ? (
                    <a href={data.whatsappOptInPageUrl} target="_blank" rel="noreferrer">Open page</a>
                  ) : (
                    <strong>-</strong>
                  )}
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>IP</span>
                  <strong>{renderValue(data?.whatsappOptInIp)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>User Agent</span>
                  <strong className="whatsapp-consent-audit-wrap">{renderValue(data?.whatsappOptInUserAgent)}</strong>
                </div>
                <div className="whatsapp-consent-audit-row">
                  <span>Opt-out At</span>
                  <strong>{formatDateTime(data?.whatsappOptOutAt)}</strong>
                </div>
              </div>

              <div className="whatsapp-consent-audit-section">
                <h4>Consent Text Snapshot</h4>
                <div className="whatsapp-consent-audit-note">{renderValue(data?.whatsappOptInTextSnapshot)}</div>
              </div>

              {entries.length ? (
                <div className="whatsapp-consent-audit-section">
                  <h4>Metadata</h4>
                  <div className="whatsapp-consent-audit-metadata">
                    {entries.map(([key, value]) => (
                      <div key={`consent-meta-${key}`} className="whatsapp-consent-audit-row">
                        <span>{key}</span>
                        <strong className="whatsapp-consent-audit-wrap">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="modal-footer whatsapp-consent-audit-footer">
          {typeof onRefresh === 'function' ? (
            <button className="secondary-btn" onClick={onRefresh} disabled={loading}>Refresh</button>
          ) : null}
          <button className="primary-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConsentAuditModal;
