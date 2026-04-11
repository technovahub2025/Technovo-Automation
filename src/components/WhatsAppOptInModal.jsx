import React from 'react';
import '../styles/whatsappOptInModal.css';

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual confirmation' },
  { value: 'website_form', label: 'Website form' },
  { value: 'landing_page', label: 'Landing page' },
  { value: 'meta_lead_ads', label: 'Meta lead ads' },
  { value: 'keyword', label: 'Keyword reply' },
  { value: 'import', label: 'Imported proof' },
  { value: 'offline_form', label: 'Offline / paper form' }
];

const SCOPE_OPTIONS = [
  { value: 'marketing', label: 'Marketing only' },
  { value: 'service', label: 'Service / support only' },
  { value: 'both', label: 'Marketing and service' }
];

const PROOF_OPTIONS = [
  { value: 'form_submission', label: 'Form submission' },
  { value: 'lead_form', label: 'Lead form record' },
  { value: 'keyword_reply', label: 'Keyword reply' },
  { value: 'screenshot', label: 'Screenshot / attachment' },
  { value: 'crm_note', label: 'CRM note / operator note' },
  { value: 'import_record', label: 'Imported record' },
  { value: 'offline_form', label: 'Offline form' }
];

const updateFormField = (form, key, value) => ({
  ...form,
  [key]: value
});

const WhatsAppOptInModal = ({
  open,
  phone = '',
  contactName = '',
  form,
  onChange,
  onClose,
  onSubmit,
  submitting = false,
  error = ''
}) => {
  if (!open) return null;

  return (
    <div className="whatsapp-optin-modal-overlay" role="presentation">
      <div className="whatsapp-optin-modal" role="dialog" aria-modal="true" aria-labelledby="whatsapp-optin-title">
        <div className="whatsapp-optin-modal-header">
          <div>
            <h3 id="whatsapp-optin-title">Mark WhatsApp Opted In</h3>
            <p>
              Save consent proof before enabling marketing templates for
              {contactName ? ` ${contactName}` : ' this contact'}.
            </p>
          </div>
          <button type="button" className="whatsapp-optin-close-btn" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>

        <div className="whatsapp-optin-modal-body">
          <div className="whatsapp-optin-readonly-row">
            <span>Phone</span>
            <strong>{phone || '-'}</strong>
          </div>

          <div className="whatsapp-optin-grid">
            <label className="whatsapp-optin-field">
              <span>Consent Source</span>
              <select
                value={form?.source || 'manual'}
                onChange={(event) => onChange(updateFormField(form, 'source', event.target.value))}
                disabled={submitting}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={`optin-source-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="whatsapp-optin-field">
              <span>Consent Scope</span>
              <select
                value={form?.scope || 'marketing'}
                onChange={(event) => onChange(updateFormField(form, 'scope', event.target.value))}
                disabled={submitting}
              >
                {SCOPE_OPTIONS.map((option) => (
                  <option key={`optin-scope-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="whatsapp-optin-field">
              <span>Proof Type</span>
              <select
                value={form?.proofType || ''}
                onChange={(event) => onChange(updateFormField(form, 'proofType', event.target.value))}
                disabled={submitting}
              >
                <option value="">Select proof type</option>
                {PROOF_OPTIONS.map((option) => (
                  <option key={`optin-proof-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="whatsapp-optin-field">
              <span>Proof ID / Reference</span>
              <input
                type="text"
                value={form?.proofId || ''}
                onChange={(event) => onChange(updateFormField(form, 'proofId', event.target.value))}
                placeholder="Lead ID, form ID, note ref..."
                disabled={submitting}
              />
            </label>
          </div>

          <label className="whatsapp-optin-field">
            <span>Consent Text Snapshot</span>
            <textarea
              rows={4}
              value={form?.consentText || ''}
              onChange={(event) => onChange(updateFormField(form, 'consentText', event.target.value))}
              placeholder="Example: I agree to receive WhatsApp updates from Technovohub and can reply STOP anytime."
              disabled={submitting}
            />
          </label>

          <div className="whatsapp-optin-grid">
            <label className="whatsapp-optin-field">
              <span>Proof URL</span>
              <input
                type="url"
                value={form?.proofUrl || ''}
                onChange={(event) => onChange(updateFormField(form, 'proofUrl', event.target.value))}
                placeholder="https://..."
                disabled={submitting}
              />
            </label>

            <label className="whatsapp-optin-field">
              <span>Page URL</span>
              <input
                type="url"
                value={form?.pageUrl || ''}
                onChange={(event) => onChange(updateFormField(form, 'pageUrl', event.target.value))}
                placeholder="Landing page / form URL"
                disabled={submitting}
              />
            </label>
          </div>

          {error ? <div className="whatsapp-optin-error">{error}</div> : null}
        </div>

        <div className="whatsapp-optin-modal-footer">
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="primary-btn" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Opt-In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppOptInModal;
