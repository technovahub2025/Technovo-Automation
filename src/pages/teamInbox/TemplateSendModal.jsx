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
  templateVariableValues,
  templateHeaderVariableValues,
  templateHeaderMediaUrl,
  handleTemplateVariableChange,
  handleTemplateHeaderVariableChange,
  handleTemplateHeaderMediaUrlChange,
  templateModalMessage,
  templateModalMessageTone,
  handleSendTemplate
}) => {
  if (!showTemplateSendModal) return null;

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
                  return (
                    <option key={key} value={key}>
                      {template.name} ({language})
                    </option>
                  );
                })}
              </select>
            </label>

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
                disabled={templateSending || !selectedTemplateOption}
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
