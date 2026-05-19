import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Loader2, RefreshCw, ScanLine, Sparkles, Upload, X } from 'lucide-react';
import { apiClient } from '../../services/whatsappapi';
import './BusinessCardScannerModal.css';

const createEmptyDraft = () => ({
  name: '',
  phone: '',
  email: '',
  companyName: '',
  designation: '',
  tags: ''
});

const normalizeDraft = (value = {}) => ({
  name: String(value?.name || '').trim(),
  phone: String(value?.phone || '').trim(),
  email: String(value?.email || '').trim(),
  companyName: String(value?.companyName || '').trim(),
  designation: String(value?.designation || '').trim(),
  tags: Array.isArray(value?.tags) ? value.tags.join(', ') : String(value?.tags || '').trim()
});

const formatDuplicateLabel = (duplicate = {}) => {
  const parts = [];
  if (duplicate?.name) parts.push(duplicate.name);
  if (duplicate?.phone) parts.push(duplicate.phone);
  if (duplicate?.email) parts.push(duplicate.email);
  return parts.join(' • ') || 'Existing contact';
};

const BusinessCardScannerModal = ({
  open,
  onClose,
  onFillForm,
  onSave,
  seedContact = {}
}) => {
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const progressTimerRef = useRef(null);
  const objectUrlRef = useRef('');

  const [scanState, setScanState] = useState('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState('');
  const [rawText, setRawText] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(createEmptyDraft());

  const parsedTags = useMemo(
    () =>
      String(draft.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    [draft.tags]
  );

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const resetState = () => {
    clearProgressTimer();
    setScanState('idle');
    setScanProgress(0);
    setError('');
    setRawText('');
    setDuplicates([]);
    setSelectedFileName('');
    setSaving(false);
    setDraft(normalizeDraft(seedContact));
  };

  useEffect(() => {
    if (!open) {
      resetState();
    } else {
      setDraft(normalizeDraft(seedContact));
      setError('');
      setRawText('');
      setDuplicates([]);
      setScanState('idle');
      setScanProgress(0);
      setSaving(false);
    }
    return () => clearProgressTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedContact]);

  useEffect(() => {
    return () => {
      clearProgressTimer();
      if (objectUrlRef.current) {
        window.URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, []);

  const startProgressAnimation = () => {
    clearProgressTimer();
    setScanProgress(8);
    progressTimerRef.current = window.setInterval(() => {
      setScanProgress((current) => {
        if (current >= 88) {
          if (progressTimerRef.current) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }
          return 88;
        }
        return Math.min(current + (current < 40 ? 7 : 4), 88);
      });
    }, 180);
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (objectUrlRef.current) {
      window.URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }

    setSelectedFileName(file.name || 'business-card-image');
    objectUrlRef.current = window.URL.createObjectURL(file);
    setPreviewUrl(objectUrlRef.current);
    setError('');
    setRawText('');
    setDuplicates([]);
    setScanState('scanning');
    setScanProgress(0);
    startProgressAnimation();

    try {
      const response = await apiClient.scanContactCard(file);
      const payload = response?.data?.data || response?.data || {};
      const contact = payload?.contact || {};

      setDraft({
        name: String(contact?.name || '').trim(),
        phone: String(contact?.phone || '').trim(),
        email: String(contact?.email || '').trim(),
        companyName: String(contact?.companyName || '').trim(),
        designation: String(contact?.designation || '').trim(),
        tags: String(contact?.tags || '').trim()
      });
      setDuplicates(Array.isArray(payload?.duplicates) ? payload.duplicates : []);
      setRawText(String(payload?.rawText || '').trim());
      setScanState('done');
      setScanProgress(100);
    } catch (scanError) {
      setError(scanError?.response?.data?.error || scanError?.message || 'Failed to scan business card.');
      setScanState('error');
      setScanProgress(0);
    } finally {
      clearProgressTimer();
    }
  };

  const triggerUpload = () => uploadInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  const handleFillForm = () => {
    if (typeof onFillForm === 'function') {
      onFillForm({
        ...draft,
        tags: parsedTags
      });
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleSave = async () => {
    if (typeof onSave !== 'function') return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...draft,
        tags: parsedTags
      });
      onClose();
      resetState();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const hasContactData = Boolean(
    draft.name ||
      draft.phone ||
      draft.email ||
      draft.companyName ||
      draft.designation ||
      draft.tags
  );

  if (!open) return null;

  return (
    <div className="bc-scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="bc-scanner-title">
      <div className="bc-scanner-modal">
        <div className="bc-scanner-header">
          <div>
            <div className="bc-scanner-kicker">
              <Sparkles size={14} />
              Instant business card OCR
            </div>
            <h3 id="bc-scanner-title">Scan business card</h3>
            <p>Upload a card photo or use your phone camera. We’ll extract contact details and let you review everything before saving.</p>
          </div>
          <button type="button" className="bc-scanner-close" onClick={onClose} aria-label="Close scanner">
            <X size={18} />
          </button>
        </div>

        <div className="bc-scanner-body">
          <div className="bc-scanner-upload-panel">
            <div className="bc-scanner-dropzone">
              {previewUrl ? (
                <img src={previewUrl} alt="Business card preview" className="bc-scanner-preview" />
              ) : (
                <div className="bc-scanner-placeholder">
                  <ScanLine size={28} />
                  <strong>Drop or capture a business card</strong>
                  <span>JPG, PNG, WEBP and other common image formats are supported.</span>
                </div>
              )}
            </div>

            <div className="bc-scanner-actions">
              <button type="button" className="secondary-btn" onClick={triggerUpload}>
                <Upload size={16} />
                Upload image
              </button>
              <button type="button" className="secondary-btn" onClick={triggerCamera}>
                <Camera size={16} />
                Use camera
              </button>
              <button type="button" className="ghost-btn" onClick={resetState} disabled={scanState === 'scanning'}>
                <RefreshCw size={16} />
                Reset
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelected}
              className="bc-scanner-hidden-input"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="bc-scanner-hidden-input"
            />

            <div className="bc-scanner-progress-card">
              <div className="bc-scanner-progress-row">
                <span>
                  {scanState === 'scanning'
                    ? 'Scanning card...'
                    : scanState === 'done'
                      ? 'Scan complete'
                      : scanState === 'error'
                        ? 'Scan failed'
                        : 'Waiting for an image'}
                </span>
                <strong>{scanProgress}%</strong>
              </div>
              <div className="bc-scanner-progress-bar">
                <div className={`bc-scanner-progress-fill ${scanState}`} style={{ width: `${scanProgress}%` }} />
              </div>
              <p>
                {scanState === 'scanning'
                  ? 'Preprocessing image and extracting text with OCR.'
                  : scanState === 'done'
                    ? 'Review the extracted fields and save when ready.'
                    : scanState === 'error'
                      ? 'Try a sharper image or stronger lighting.'
                      : 'Take a straight-on photo for best accuracy.'}
              </p>
            </div>
          </div>

          <div className="bc-scanner-form-panel">
            <div className="bc-scanner-form-grid">
              <label className="bc-scanner-field">
                <span>Full Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Jane Doe"
                />
              </label>
              <label className="bc-scanner-field">
                <span>Mobile Number</span>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+1 555 123 4567"
                />
              </label>
              <label className="bc-scanner-field bc-scanner-field--wide">
                <span>Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@company.com"
                />
              </label>
              <label className="bc-scanner-field">
                <span>Company Name</span>
                <input
                  type="text"
                  value={draft.companyName}
                  onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
                  placeholder="Acme Inc."
                />
              </label>
              <label className="bc-scanner-field">
                <span>Designation</span>
                <input
                  type="text"
                  value={draft.designation}
                  onChange={(event) => setDraft((current) => ({ ...current, designation: event.target.value }))}
                  placeholder="Sales Director"
                />
              </label>
              <label className="bc-scanner-field bc-scanner-field--wide">
                <span>Tags</span>
                <input
                  type="text"
                  value={draft.tags}
                  onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="Lead, VIP, Trade Show"
                />
              </label>
            </div>

            {duplicates.length > 0 && (
              <div className="bc-scanner-warning">
                <div className="bc-scanner-warning-title">
                  <AlertTriangle size={16} />
                  Possible duplicates found
                </div>
                <ul>
                  {duplicates.slice(0, 4).map((duplicate) => (
                    <li key={duplicate._id || formatDuplicateLabel(duplicate)}>
                      <strong>{formatDuplicateLabel(duplicate)}</strong>
                      {Array.isArray(duplicate.matchReasons) && duplicate.matchReasons.length > 0 ? (
                        <span>{duplicate.matchReasons.join(' + ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rawText ? (
              <details className="bc-scanner-raw-text">
                <summary>OCR text</summary>
                <pre>{rawText}</pre>
              </details>
            ) : null}

            {error ? (
              <div className="bc-scanner-error">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="bc-scanner-footer">
              <button type="button" className="secondary-btn" onClick={handleFillForm} disabled={!hasContactData}>
                Fill contact form
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handleSave}
                disabled={saving || !draft.phone}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="bc-scanner-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save contact
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCardScannerModal;
