import React, { useState } from 'react';
import { FileText, Send, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { broadcastAPI } from '../../../services/broadcastAPI';
import MessageTemplateEditor from './MessageTemplateEditor';
import ContactUploader from './ContactUploader';
import VoiceSelector from './VoiceSelector';
import './BroadcastForm.css';

const BroadcastForm = ({ onBroadcastCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    messageTemplate: '',
    voice: {
      provider: 'edge',
      voiceId: 'en-GB-SoniaNeural',
      language: 'en-GB'
    },
    contacts: [],
    maxConcurrent: 50,
    batchSize: 25,
    dispatchIntervalMs: 1000,
    maxRetries: 2,
    compliance: {
      disclaimerText: 'This is an automated call from',
      optOutEnabled: true,
      dndRespect: true
    }
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    setValidationErrors(prev => ({ ...prev, [field]: null }));
  };

  const handleVoiceChange = (voiceConfig) => {
    setFormData(prev => ({
      ...prev,
      voice: voiceConfig
    }));
  };

  const handleContactsUploaded = (contacts) => {
    setFormData(prev => ({
      ...prev,
      contacts
    }));
    setValidationErrors(prev => ({ ...prev, contacts: null }));
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Campaign name is required';
    }

    if (!formData.messageTemplate.trim()) {
      errors.messageTemplate = 'Message template is required';
    }

    if (formData.messageTemplate.length > 1000) {
      errors.messageTemplate = 'Message too long (max 1000 characters)';
    }

    if (!formData.contacts || formData.contacts.length === 0) {
      errors.contacts = 'Please upload at least one contact';
    }

    if (formData.contacts.length > 10000) {
      errors.contacts = 'Maximum 10,000 contacts per broadcast';
    }

    if (formData.maxConcurrent < 1 || formData.maxConcurrent > 100) {
      errors.maxConcurrent = 'Concurrent calls must be between 1 and 100';
    }

    if (formData.batchSize < 1 || formData.batchSize > formData.maxConcurrent) {
      errors.batchSize = 'Batch size must be at least 1 and no more than max concurrent calls';
    }

    if (formData.dispatchIntervalMs < 250 || formData.dispatchIntervalMs > 10000) {
      errors.dispatchIntervalMs = 'Dispatch interval must be between 250ms and 10000ms';
    }

    // Validate template variables
    const templateVars = (formData.messageTemplate.match(/{{([^}]+)}}/g) || [])
      .map(v => v.replace(/[{}]/g, '').trim());

    if (templateVars.length > 0 && formData.contacts.length > 0) {
      const firstContact = formData.contacts[0];
      const availableFields = ['name', 'phone', ...Object.keys(firstContact.customFields || {})];

      const missingVars = templateVars.filter(v => !availableFields.includes(v));
      if (missingVars.length > 0) {
        errors.messageTemplate = `Missing fields in CSV: ${missingVars.join(', ')}`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Backend will handle createdBy from authentication
      const response = await broadcastAPI.startBroadcast(formData);

      setSubmitResult({
        success: true,
        message: `Broadcast "${formData.name}" started successfully!`,
        broadcastId: response.data.broadcast.id
      });

      // Notify parent component
      if (onBroadcastCreated) {
        onBroadcastCreated(response.data.broadcast.id);
      }

      // Reset form after delay
      setTimeout(() => {
        resetForm();
      }, 2000);

    } catch (error) {
      setSubmitResult({
        success: false,
        message: error.response?.data?.error || 'Failed to start broadcast'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      messageTemplate: '',
      voice: {
        provider: 'edge',
        voiceId: 'en-GB-SoniaNeural',
        language: 'en-GB'
      },
      contacts: [],
      maxConcurrent: 50,
      batchSize: 25,
      dispatchIntervalMs: 1000,
      maxRetries: 2,
      compliance: {
        disclaimerText: 'This is an automated call from',
        optOutEnabled: true,
        dndRespect: true
      }
    });
    setValidationErrors({});
    setSubmitResult(null);
  };

  return (
    <div className="broadcast-form voice-broadcast__form">
      <form onSubmit={handleSubmit}>
        <div className="broadcast-form-primary voice-broadcast__form-main">
          <div className="broadcast-field-card voice-broadcast__field-card">
            <label className="form-label voice-broadcast__label">
              <FileText size={18} />
              Campaign Name
            </label>
            <input
              type="text"
              className="form-input voice-broadcast__input"
              placeholder="Diwali Offer 2024"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={isSubmitting}
            />
            {validationErrors.name && (
              <span className="error-text">{validationErrors.name}</span>
            )}
          </div>

          <div className="broadcast-field-card voice-broadcast__field-card">
            <MessageTemplateEditor
              value={formData.messageTemplate}
              onChange={(value) => handleInputChange('messageTemplate', value)}
              error={validationErrors.messageTemplate}
              disabled={isSubmitting}
              contacts={formData.contacts}
              language={formData.voice.language}
            />
          </div>
        </div>

        <div className="broadcast-form-side voice-broadcast__form-side">
          <div className="broadcast-side-panel voice-broadcast__panel">
            <VoiceSelector
              selected={formData.voice}
              onChange={handleVoiceChange}
              disabled={isSubmitting}
            />
          </div>

          <div className="broadcast-side-panel voice-broadcast__panel">
            <ContactUploader
              contacts={formData.contacts}
              onContactsUploaded={handleContactsUploaded}
              error={validationErrors.contacts}
              disabled={isSubmitting}
            />
          </div>

          <div className="broadcast-side-panel broadcast-settings-panel voice-broadcast__panel voice-broadcast__settings-panel">
            <div className="form-section collapsible voice-broadcast__section voice-broadcast__section--collapsible">
              <details>
                <summary>
                  <span className="settings-summary-title voice-broadcast__settings-summary-title">
                    <Settings size={18} />
                    Advanced Settings
                  </span>
                  <span className="settings-summary-meta voice-broadcast__settings-summary-meta">
                    {formData.maxConcurrent} concurrent / {formData.batchSize} batch
                  </span>
                </summary>

                <div className="settings-grid voice-broadcast__settings-grid">
                  <div className="setting-item voice-broadcast__setting">
                    <label>Max Concurrent Calls</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.maxConcurrent}
                      onChange={(e) => {
                        const maxConcurrent = parseInt(e.target.value, 10) || 1;
                        handleInputChange('maxConcurrent', maxConcurrent);
                        if (formData.batchSize > maxConcurrent) {
                          handleInputChange('batchSize', maxConcurrent);
                        }
                      }}
                      disabled={isSubmitting}
                    />
                    <small>Maximum simultaneous calls (1-100)</small>
                    {validationErrors.maxConcurrent && (
                      <small className="error-text">{validationErrors.maxConcurrent}</small>
                    )}
                  </div>

                  <div className="setting-item voice-broadcast__setting">
                    <label>Batch Size</label>
                    <input
                      type="number"
                      min="1"
                      max={formData.maxConcurrent}
                      value={formData.batchSize}
                      onChange={(e) => handleInputChange('batchSize', parseInt(e.target.value, 10) || 1)}
                      disabled={isSubmitting}
                    />
                    <small>Calls claimed per dispatch batch</small>
                    {validationErrors.batchSize && (
                      <small className="error-text voice-broadcast__error-text">{validationErrors.batchSize}</small>
                    )}
                  </div>

                  <div className="setting-item voice-broadcast__setting">
                    <label>Dispatch Interval</label>
                    <input
                      type="number"
                      min="250"
                      max="10000"
                      step="250"
                      value={formData.dispatchIntervalMs}
                      onChange={(e) => handleInputChange('dispatchIntervalMs', parseInt(e.target.value, 10) || 1000)}
                      disabled={isSubmitting}
                    />
                    <small>Delay between batches in milliseconds</small>
                    {validationErrors.dispatchIntervalMs && (
                      <small className="error-text voice-broadcast__error-text">{validationErrors.dispatchIntervalMs}</small>
                    )}
                  </div>

                  <div className="setting-item voice-broadcast__setting">
                    <label>Max Retries</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={formData.maxRetries}
                      onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value, 10) || 0)}
                      disabled={isSubmitting}
                    />
                    <small>Retry failed calls (0-5)</small>
                  </div>

                  <div className="setting-item full voice-broadcast__setting voice-broadcast__setting--full">
                    <label>Compliance Disclaimer</label>
                    <input
                      type="text"
                      value={formData.compliance.disclaimerText}
                      onChange={(e) => handleInputChange('compliance', {
                        ...formData.compliance,
                        disclaimerText: e.target.value
                      })}
                      disabled={isSubmitting}
                    />
                    <small>Played before main message</small>
                  </div>

                  <div className="setting-item checkbox voice-broadcast__setting voice-broadcast__setting--checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.compliance.dndRespect}
                        onChange={(e) => handleInputChange('compliance', {
                          ...formData.compliance,
                          dndRespect: e.target.checked
                        })}
                        disabled={isSubmitting}
                      />
                      Respect DND Registry
                    </label>
                  </div>

                  <div className="setting-item checkbox voice-broadcast__setting voice-broadcast__setting--checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.compliance.optOutEnabled}
                        onChange={(e) => handleInputChange('compliance', {
                          ...formData.compliance,
                          optOutEnabled: e.target.checked
                        })}
                        disabled={isSubmitting}
                      />
                      Enable Opt-Out (Press 9)
                    </label>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="broadcast-form-footer voice-broadcast__form-footer">
          {submitResult && (
            <div className={`submit-result voice-broadcast__result ${submitResult.success ? 'success' : 'error'}`}>
              {submitResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <span>{submitResult.message}</span>
            </div>
          )}

          <div className="form-actions voice-broadcast__actions">
            <button
              type="button"
              className="btn btn-secondary voice-broadcast__button voice-broadcast__button--secondary"
              onClick={resetForm}
              disabled={isSubmitting}
            >
              Reset
            </button>

            <button
              type="submit"
              className="btn btn-primary voice-broadcast__button voice-broadcast__button--primary"
              disabled={isSubmitting || formData.contacts.length === 0}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-small voice-broadcast__spinner voice-broadcast__spinner--small" />
                  Starting...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Start Broadcast ({formData.contacts.length} contacts)
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BroadcastForm;
