import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { VOICE_OPTIONS } from '../../config/api.config';
import useCampaigns from '../../hooks/useCampaigns';

const CampaignCreationForm = ({ onSuccess, onCancel }) => {
  const { createCampaign, uploadContacts, loading, error } = useCampaigns();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    voiceId: VOICE_OPTIONS.BRITISH_ENGLISH[0].value,
    message: '',
    maxConcurrentCalls: 5,
    retryAttempts: 2,
    retryDelay: 300, // seconds
    scheduledAt: '',
  });

  const [contactFile, setContactFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  /**
   * Handle form field changes
   */
  const handleChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value,
    }));

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  }, [validationErrors]);

  /**
   * Handle contact file selection
   */
  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setValidationErrors(prev => ({
        ...prev,
        contactFile: 'Only CSV files are supported',
      }));
      return;
    }

    setContactFile(file);
    setValidationErrors(prev => {
      const updated = { ...prev };
      delete updated.contactFile;
      return updated;
    });
  }, []);

  /**
   * Validate form data
   */
  const validateForm = useCallback(() => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Campaign name is required';
    }

    if (!formData.message.trim()) {
      errors.message = 'Message content is required';
    }

    if (formData.maxConcurrentCalls < 1 || formData.maxConcurrentCalls > 20) {
      errors.maxConcurrentCalls = 'Concurrent calls must be between 1 and 20';
    }

    if (formData.retryAttempts < 0 || formData.retryAttempts > 5) {
      errors.retryAttempts = 'Retry attempts must be between 0 and 5';
    }

    if (!contactFile) {
      errors.contactFile = 'Contact list is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, contactFile]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setUploadProgress({ stage: 'creating', progress: 0 });

      // Create campaign
      const campaign = await createCampaign({
        ...formData,
        status: 'draft',
      });

      setUploadProgress({ stage: 'uploading', progress: 30 });

      // Upload contacts
      const uploadResult = await uploadContacts(campaign._id, contactFile, Papa);

      setUploadProgress({ stage: 'complete', progress: 100 });

      if (onSuccess) {
        onSuccess({
          campaign,
          uploadResult,
        });
      }
    } catch (err) {
      setUploadProgress(null);
      console.error('Campaign creation error:', err);
    }
  }, [formData, contactFile, validateForm, createCampaign, uploadContacts, onSuccess]);

  /**
   * Get all voice options
   */
  const allVoiceOptions = [
    ...VOICE_OPTIONS.TAMIL.map(v => ({ ...v, category: 'Tamil' })),
    ...VOICE_OPTIONS.BRITISH_ENGLISH.map(v => ({ ...v, category: 'British English' })),
  ];

  return (
    <div className="campaign-creation-form">
      <h2>Create New Campaign</h2>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {uploadProgress && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress.progress}%` }}
              role="progressbar"
              aria-valuenow={uploadProgress.progress}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
          <p>{uploadProgress.stage === 'creating' && 'Creating campaign...'}
             {uploadProgress.stage === 'uploading' && 'Uploading contacts...'}
             {uploadProgress.stage === 'complete' && 'Complete!'}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Campaign Name */}
        <div className="form-group">
          <label htmlFor="name">
            Campaign Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={validationErrors.name ? 'input-error' : ''}
            placeholder="e.g., Q1 Product Launch"
            disabled={loading}
            aria-required="true"
            aria-invalid={!!validationErrors.name}
            aria-describedby={validationErrors.name ? 'name-error' : undefined}
          />
          {validationErrors.name && (
            <span id="name-error" className="error-message" role="alert">
              {validationErrors.name}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional campaign description"
            rows="3"
            disabled={loading}
          />
        </div>

        {/* Voice Selection */}
        <div className="form-group">
          <label htmlFor="voiceId">
            Voice <span className="required">*</span>
          </label>
          <select
            id="voiceId"
            name="voiceId"
            value={formData.voiceId}
            onChange={handleChange}
            disabled={loading}
            aria-required="true"
          >
            {allVoiceOptions.map(voice => (
              <option key={voice.value} value={voice.value}>
                {voice.category} - {voice.label}
              </option>
            ))}
          </select>
        </div>

        {/* Message Content */}
        <div className="form-group">
          <label htmlFor="message">
            Message <span className="required">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            className={validationErrors.message ? 'input-error' : ''}
            placeholder="Enter the message to be spoken during the call"
            rows="5"
            disabled={loading}
            aria-required="true"
            aria-invalid={!!validationErrors.message}
            aria-describedby={validationErrors.message ? 'message-error' : undefined}
          />
          {validationErrors.message && (
            <span id="message-error" className="error-message" role="alert">
              {validationErrors.message}
            </span>
          )}
          <small className="helper-text">
            This message will be converted to speech using Edge TTS
          </small>
        </div>

        {/* Advanced Settings */}
        <div className="form-section">
          <h3>Advanced Settings</h3>

          <div className="form-row">
            {/* Max Concurrent Calls */}
            <div className="form-group">
              <label htmlFor="maxConcurrentCalls">
                Max Concurrent Calls
              </label>
              <input
                type="number"
                id="maxConcurrentCalls"
                name="maxConcurrentCalls"
                value={formData.maxConcurrentCalls}
                onChange={handleChange}
                min="1"
                max="20"
                className={validationErrors.maxConcurrentCalls ? 'input-error' : ''}
                disabled={loading}
                aria-invalid={!!validationErrors.maxConcurrentCalls}
                aria-describedby={validationErrors.maxConcurrentCalls ? 'concurrent-error' : undefined}
              />
              {validationErrors.maxConcurrentCalls && (
                <span id="concurrent-error" className="error-message" role="alert">
                  {validationErrors.maxConcurrentCalls}
                </span>
              )}
            </div>

            {/* Retry Attempts */}
            <div className="form-group">
              <label htmlFor="retryAttempts">
                Retry Attempts
              </label>
              <input
                type="number"
                id="retryAttempts"
                name="retryAttempts"
                value={formData.retryAttempts}
                onChange={handleChange}
                min="0"
                max="5"
                className={validationErrors.retryAttempts ? 'input-error' : ''}
                disabled={loading}
                aria-invalid={!!validationErrors.retryAttempts}
              />
              {validationErrors.retryAttempts && (
                <span className="error-message" role="alert">
                  {validationErrors.retryAttempts}
                </span>
              )}
            </div>

            {/* Retry Delay */}
            <div className="form-group">
              <label htmlFor="retryDelay">
                Retry Delay (seconds)
              </label>
              <input
                type="number"
                id="retryDelay"
                name="retryDelay"
                value={formData.retryDelay}
                onChange={handleChange}
                min="60"
                max="3600"
                step="60"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Contact List Upload */}
        <div className="form-group">
          <label htmlFor="contactFile">
            Contact List (CSV) <span className="required">*</span>
          </label>
          <input
            type="file"
            id="contactFile"
            accept=".csv"
            onChange={handleFileChange}
            className={validationErrors.contactFile ? 'input-error' : ''}
            disabled={loading}
            aria-required="true"
            aria-invalid={!!validationErrors.contactFile}
            aria-describedby="file-help"
          />
          {validationErrors.contactFile && (
            <span className="error-message" role="alert">
              {validationErrors.contactFile}
            </span>
          )}
          <small id="file-help" className="helper-text">
            CSV must include columns: phone, name (other custom fields are optional)
          </small>
        </div>

        {/* Schedule (Optional) */}
        <div className="form-group">
          <label htmlFor="scheduledAt">
            Schedule For (Optional)
          </label>
          <input
            type="datetime-local"
            id="scheduledAt"
            name="scheduledAt"
            value={formData.scheduledAt}
            onChange={handleChange}
            disabled={loading}
          />
          <small className="helper-text">
            Leave empty to create as draft
          </small>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || uploadProgress !== null}
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignCreationForm;