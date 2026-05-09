import React from 'react';

const TemplateSendModal = ({
  showTemplateSendModal,
  closeTemplateSendModal,
  templateSending,
  templateLoading,
  selectedTemplateKey,
  handleTemplateSelectionChange,
  templateOptions,
  getTemplateCompositeKey,
  getTemplateLanguageCode,
  extractTemplateVariableCount,
  extractTemplateHeaderVariableCount,
  getTemplateHeaderFormat,
  templateRequiresHeaderMedia,
  selectedTemplateOption,
  manualTemplateName,
  templateVariableValues,
  templateHeaderVariableValues,
  templateHeaderMediaUrl,
  selectedTemplateCategory,
  contactMarketingTemplateAllowed,
  getTemplateCategory,
  handleTemplateVariableChange,
  handleTemplateHeaderVariableChange,
  handleTemplateHeaderMediaUrlChange,
  handleManualTemplateNameChange,
  templateModalMessage,
  templateModalMessageTone,
  handleSendTemplate
}) => {
  if (!showTemplateSendModal) return null;
  const canSendMarketingTemplate = Boolean(contactMarketingTemplateAllowed);
  const selectedTemplateIsMarketing = selectedTemplateCategory === 'marketing';
  const getCategoryLabel = (category = '') => {
    const normalized = String(category || '').trim().toLowerCase();
    if (normalized === 'marketing') return 'Marketing';
    if (normalized === 'service') return 'Service';
    return 'Other';
  };
  const getCategoryTone = (category = '') => {
    const normalized = String(category || '').trim().toLowerCase();
    if (normalized === 'marketing') return 'warning';
    if (normalized === 'service') return 'success';
    return 'neutral';
  };
  const getCategoryBadgeStyle = (category = '', compact = false) => {
    const normalized = String(category || '').trim().toLowerCase();
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '999px',
      fontSize: compact ? '0.72rem' : '0.78rem',
      fontWeight: 700,
      letterSpacing: '0.02em',
      lineHeight: 1,
      padding: compact ? '0.28rem 0.55rem' : '0.35rem 0.7rem',
      border: '1px solid transparent',
      whiteSpace: 'nowrap'
    };

    if (normalized === 'marketing') {
      return {
        ...base,
        color: '#92400e',
        background: '#fef3c7',
        borderColor: '#f59e0b'
      };
    }

    if (normalized === 'service') {
      return {
        ...base,
        color: '#166534',
        background: '#dcfce7',
        borderColor: '#22c55e'
      };
    }

    return {
      ...base,
      color: '#334155',
      background: '#e2e8f0',
      borderColor: '#cbd5e1'
    };
  };
  const renderCategoryBadge = (category = '', compact = false) => {
    const label = getCategoryLabel(category);
    const tone = getCategoryTone(category);
    return (
      <span
        className={`template-category-badge template-category-badge--${tone} ${
          compact ? 'is-compact' : ''
        }`.trim()}
        style={getCategoryBadgeStyle(category, compact)}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="template-send-modal-overlay" onClick={closeTemplateSendModal}>
      <div className="template-send-modal" onClick={(e) => e.stopPropagation()}>
        <div className="template-send-modal-header">
          <h3>Send Template</h3>
          <button
            type="button"
            className="template-send-close-btn"
            onClick={closeTemplateSendModal}
            disabled={templateSending}
          >
            Close
          </button>
        </div>

        {templateLoading ? (
          <div className="template-send-loading">Loading templates...</div>
        ) : (
          <>
            <label className="template-send-field">
              <span>Template</span>
              <select
                value={selectedTemplateKey}
                onChange={(event) => handleTemplateSelectionChange(event.target.value)}
                disabled={templateSending || templateOptions.length === 0}
              >
                {templateOptions.length === 0 && <option value="">No template available</option>}
                {templateOptions.map((template) => {
                  const key = getTemplateCompositeKey(template);
                  const language = getTemplateLanguageCode(template);
                  const category = getTemplateCategory(template);
                  const isMarketingTemplate = category === 'marketing';
                  const isDisabled = isMarketingTemplate && !canSendMarketingTemplate;
                  return (
                    <option key={key} value={key} disabled={isDisabled}>
                      {template.name} ({language}) - {getCategoryLabel(category)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="template-send-field">
              <span>Or template name directly</span>
              <input
                type="text"
                value={manualTemplateName || ''}
                onChange={(event) => handleManualTemplateNameChange(event.target.value)}
                placeholder="dhanya_welcome_v1"
                disabled={templateSending}
              />
              <small style={{ color: '#64748b' }}>
                Use this when the approved template is not present in the synced list yet.
              </small>
            </label>

            {selectedTemplateOption ? (
              <div
                className="template-send-selected-summary"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  margin: '0.25rem 0 0.5rem',
                  padding: '0.75rem 0.85rem',
                  borderRadius: '0.9rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}
              >
                <div
                  className="template-send-selected-summary-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <strong>{selectedTemplateOption.name || 'Selected template'}</strong>
                  {renderCategoryBadge(selectedTemplateCategory)}
                </div>
                <span
                  className="template-send-selected-summary-meta"
                  style={{
                    color: '#64748b',
                    fontSize: '0.85rem'
                  }}
                >
                  {getTemplateLanguageCode(selectedTemplateOption)}
                  {selectedTemplateIsMarketing ? ' · Requires marketing opt-in' : ' · Service template'}
                </span>
              </div>
            ) : null}

            <div
              className="template-send-category-legend"
              aria-label="Template category legend"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'center',
                marginTop: '-0.25rem',
                marginBottom: '0.25rem'
              }}
            >
              {renderCategoryBadge('service', true)}
              {renderCategoryBadge('marketing', true)}
            </div>

            {!canSendMarketingTemplate && !selectedTemplateIsMarketing ? (
              <div className="template-send-feedback template-send-feedback--info">
                Marketing templates are hidden because this contact is not eligible for marketing sends.
                Service templates can still be sent.
              </div>
            ) : null}

            {selectedTemplateIsMarketing && !canSendMarketingTemplate ? (
              <div className="template-send-feedback template-send-feedback--error">
                This contact is not eligible for marketing sends. Choose a service template instead.
              </div>
            ) : null}

            {extractTemplateVariableCount(selectedTemplateOption) > 0 && (
              <div className="template-send-variables">
                <h4>Template Variables</h4>
                <div className="template-send-variable-list">
                  {Array.from({ length: extractTemplateVariableCount(selectedTemplateOption) }, (_, index) => (
                    <label key={`template-variable-${index}`} className="template-send-field">
                      <span>{`Variable ${index + 1}`}</span>
                      <input
                        type="text"
                        value={templateVariableValues[index] || ''}
                        onChange={(event) => handleTemplateVariableChange(index, event.target.value)}
                        placeholder={`Enter value for {{${index + 1}}}`}
                        disabled={templateSending}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {extractTemplateHeaderVariableCount(selectedTemplateOption) > 0 && (
              <div className="template-send-variables">
                <h4>Header Variables</h4>
                <div className="template-send-variable-list">
                  {Array.from(
                    { length: extractTemplateHeaderVariableCount(selectedTemplateOption) },
                    (_, index) => (
                      <label key={`template-header-variable-${index}`} className="template-send-field">
                        <span>{`Header Variable ${index + 1}`}</span>
                        <input
                          type="text"
                          value={templateHeaderVariableValues[index] || ''}
                          onChange={(event) =>
                            handleTemplateHeaderVariableChange(index, event.target.value)
                          }
                          placeholder={`Enter header value for {{${index + 1}}}`}
                          disabled={templateSending}
                        />
                      </label>
                    )
                  )}
                </div>
              </div>
            )}

            {templateRequiresHeaderMedia(selectedTemplateOption) && (
              <label className="template-send-field">
                <span>{`${getTemplateHeaderFormat(selectedTemplateOption).toLowerCase()} Header URL`}</span>
                <input
                  type="url"
                  value={templateHeaderMediaUrl || ''}
                  onChange={(event) => handleTemplateHeaderMediaUrlChange(event.target.value)}
                  placeholder={`Enter ${getTemplateHeaderFormat(selectedTemplateOption).toLowerCase()} URL`}
                  disabled={templateSending}
                />
              </label>
            )}

            {templateModalMessage && (
              <div className={`template-send-feedback template-send-feedback--${templateModalMessageTone}`}>
                {templateModalMessage}
              </div>
            )}

            <div className="template-send-actions">
              <button
                type="button"
                className="template-send-cancel-btn"
                onClick={closeTemplateSendModal}
                disabled={templateSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="template-send-send-btn"
                onClick={handleSendTemplate}
                disabled={
                  templateSending ||
                  (!selectedTemplateOption && !String(manualTemplateName || '').trim()) ||
                  (selectedTemplateIsMarketing && !canSendMarketingTemplate)
                }
              >
                {templateSending ? 'Sending...' : 'Send Template'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TemplateSendModal;
