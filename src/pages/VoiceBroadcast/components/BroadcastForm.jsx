import React, { useState } from 'react';
import { Upload, FileText, Mic, Send, X, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import Papa from 'papaparse';
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
      voiceId: 'en-IN-NeerjaNeural',
      language: 'en-IN'
    },
    contacts: [],
    maxConcurrent: 50,
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
  const [previewMode, setPreviewMode] = useState(false);

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
      const response = await broadcastAPI.startBroadcast(formData);

      setSubmitResult({
        success: true,
        message: `Broadcast "${formData.name}" started successfully!`,
        broadcastId: response.broadcast.id
      });

      // Notify parent component
      if (onBroadcastCreated) {
        onBroadcastCreated(response.broadcast.id);
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
        voiceId: 'en-IN-NeerjaNeural',
        language: 'en-IN'
      },
      contacts: [],
      maxConcurrent: 50,
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
    <div className="broadcast-form">
      <form onSubmit={handleSubmit}>
        {/* Campaign Name */}
        <div className="form-section">
          <label className="form-label">
            <FileText size={18} />
            Campaign Name
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Diwali Offer 2024"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={isSubmitting}
          />
          {validationErrors.name && (
            <span className="error-text">{validationErrors.name}</span>
          )}
        </div>

        {/* Message Template */}
        <MessageTemplateEditor
          value={formData.messageTemplate}
          onChange={(value) => handleInputChange('messageTemplate', value)}
          error={validationErrors.messageTemplate}
          disabled={isSubmitting}
          contacts={formData.contacts}
        />

        {/* Voice Selection */}
        <VoiceSelector
          selected={formData.voice}
          onChange={handleVoiceChange}
          disabled={isSubmitting}
        />

        {/* Contact Upload */}
        <ContactUploader
          contacts={formData.contacts}
          onContactsUploaded={handleContactsUploaded}
          error={validationErrors.contacts}
          disabled={isSubmitting}
        />

        {/* Advanced Settings */}
        <div className="form-section collapsible">
          <details>
            <summary>
              <Settings size={18} />
              Advanced Settings
            </summary>

            <div className="settings-grid">
              <div className="setting-item">
                <label>Max Concurrent Calls</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxConcurrent}
                  onChange={(e) => handleInputChange('maxConcurrent', parseInt(e.target.value))}
                  disabled={isSubmitting}
                />
                <small>Maximum simultaneous calls (1-100)</small>
              </div>

              <div className="setting-item">
                <label>Max Retries</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={formData.maxRetries}
                  onChange={(e) => handleInputChange('maxRetries', parseInt(e.target.value))}
                  disabled={isSubmitting}
                />
                <small>Retry failed calls (0-5)</small>
              </div>

              <div className="setting-item">
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

              <div className="setting-item checkbox">
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

              <div className="setting-item checkbox">
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

        {/* Submit Result */}
        {submitResult && (
          <div className={`submit-result ${submitResult.success ? 'success' : 'error'}`}>
            {submitResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span>{submitResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Reset
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || formData.contacts.length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="spinner-small" />
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
      </form>
    </div>
  );
};

export default BroadcastForm;