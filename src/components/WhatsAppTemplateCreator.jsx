import React, { useState, useRef, useMemo } from 'react';
import { Upload, X, Plus, Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import whatsappLogo from '../assets/WhatsApp.svg.webp';
import './WhatsAppTemplateCreator.css';

const WhatsAppTemplateCreator = () => {
  const [templateData, setTemplateData] = useState({
    name: '',
    category: 'marketing',
    language: 'en_US',
    content: {
      header: {
        type: 'text',
        text: '',
        mediaUrl: ''
      },
      body: '',
      footer: '',
      buttons: []
    }
  });

  const [headerImage, setHeaderImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [variableType, setVariableType] = useState('number');
  const [variableExamples, setVariableExamples] = useState({});

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const categories = [
    { value: 'marketing', label: 'Marketing' },
    { value: 'utility', label: 'Utility' },
    { value: 'authentication', label: 'Authentication' }
  ];

  const languages = [
    { value: 'en_US', label: 'English (US)' },
    { value: 'en_GB', label: 'English (UK)' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'hi', label: 'Hindi' }
  ];

  const headerTypes = [
    { value: 'none', label: 'None' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'document', label: 'Document' }
  ];

  const buttonTypes = [
    { value: 'quick_reply', label: 'Quick Reply' },
    { value: 'url', label: 'Call to Action' },
    { value: 'phone_number', label: 'Phone Number' }
  ];

  const normalizeTemplateName = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

  const handleInputChange = (field, value) => {
    const normalizedValue = field === 'name' ? normalizeTemplateName(value) : value;
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setTemplateData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: normalizedValue
        }
      }));
    } else {
      setTemplateData(prev => ({
        ...prev,
        [field]: normalizedValue
      }));
    }
  };

  const handleContentChange = (field, value) => {
    setTemplateData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        [field]: value
      }
    }));
  };

  const handleHeaderChange = (field, value) => {
    setTemplateData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        header: {
          ...prev.content.header,
          [field]: value
        }
      }
    }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setHeaderImage(file);
        handleHeaderChange('mediaUrl', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setHeaderImage(null);
    handleHeaderChange('mediaUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addButton = () => {
    if (templateData.content.buttons.length < 10) {
      const newButton = {
        type: 'quick_reply',
        text: '',
        url: '',
        phoneNumber: ''
      };
      setTemplateData(prev => ({
        ...prev,
        content: {
          ...prev.content,
          buttons: [...prev.content.buttons, newButton]
        }
      }));
    }
  };

  const updateButton = (index, field, value) => {
    setTemplateData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        buttons: prev.content.buttons.map((button, i) => 
          i === index ? { ...button, [field]: value } : button
        )
      }
    }));
  };

  const removeButton = (index) => {
    setTemplateData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        buttons: prev.content.buttons.filter((_, i) => i !== index)
      }
    }));
  };

  const extractVariableNumbers = (text) => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return [];
    
    const numbers = matches.map(match => {
      const num = match.match(/\{\{(\d+)\}\}/)[1];
      return parseInt(num);
    });
    
    // Get unique numbers and sort them
    return [...new Set(numbers)].sort((a, b) => a - b);
  };

  const detectedVariables = useMemo(
    () => extractVariableNumbers(templateData.content.body || ''),
    [templateData.content.body]
  );

  const updateVariableExample = (varNumber, value) => {
    setVariableExamples(prev => ({
      ...prev,
      [varNumber]: value
    }));
  };

  const ensureVariableExample = (varNumber) => {
    setVariableExamples((prev) => ({
      ...prev,
      [varNumber]: prev[varNumber] ?? ''
    }));
  };

  const insertVariable = (variable) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = templateData.content.body || '';
      const newText = text.substring(0, start) + variable + text.substring(end);
      
      handleContentChange('body', newText);
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const insertNextVariable = () => {
    const current = detectedVariables;
    const nextNumber = current.length > 0 ? Math.max(...current) + 1 : 1;
    ensureVariableExample(nextNumber);
    insertVariable(`{{${nextNumber}}}`);
  };

  const applyInlineFormatting = (wrapper) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateData.content.body || '';
    const selected = text.substring(start, end) || 'text';
    const formatted = `${wrapper}${selected}${wrapper}`;
    const newText = text.substring(0, start) + formatted + text.substring(end);
    handleContentChange('body', newText);
    setTimeout(() => {
      textarea.focus();
      const cursor = start + formatted.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const insertEmoji = () => {
    insertVariable('🙂');
  };

  const insertEmojiNormalized = () => {
    insertVariable('🙂');
  };

  const renderPreviewText = (rawText) => {
    if (!rawText) return '';
    return rawText.replace(/\{\{(\d+)\}\}/g, (_, number) => {
      const value = variableExamples[Number(number)];
      return value && String(value).trim() ? String(value).trim() : `{{${number}}}`;
    });
  };

  const getSequentialMissingNumbers = (numbers) => {
    if (!numbers.length) return [];
    const max = Math.max(...numbers);
    const missing = [];
    for (let i = 1; i <= max; i += 1) {
      if (!numbers.includes(i)) missing.push(i);
    }
    return missing;
  };

  const containsInvalidBraceVariable = (text) => {
    if (!text) return false;
    const doubleBraceTokens = text.match(/\{\{[^}]+\}\}/g) || [];
    const hasInvalidDoubleBrace = doubleBraceTokens.some((token) => !/^\{\{\d+\}\}$/.test(token));
    if (hasInvalidDoubleBrace) return true;

    // Remove valid placeholders, then any leftover brace means malformed token exists
    const textWithoutValidPlaceholders = text.replace(/\{\{\d+\}\}/g, '');
    return /[{}]/.test(textWithoutValidPlaceholders);
  };

  const validateTemplateRules = () => {
    const errors = {};
    const body = (templateData.content.body || '').trim();
    const footer = (templateData.content.footer || '').trim();
    const headerText = (templateData.content.header.text || '').trim();
    const vars = detectedVariables;
    const missingNumbers = getSequentialMissingNumbers(vars);

    if (!templateData.name.trim()) {
      errors.name = 'Template name is required.';
    } else if (!/^[a-z0-9_]+$/.test(templateData.name)) {
      errors.name = 'Use lowercase letters, numbers and underscore only.';
    }
    if (!templateData.category) {
      errors.category = 'Category is required.';
    }
    if (!templateData.language) {
      errors.language = 'Language is required.';
    }

    if (!body) {
      errors.body = 'Body content is required.';
    } else if (containsInvalidBraceVariable(body)) {
      errors.body = 'Variables must use numeric format: {{1}}, {{2}}.';
    } else if (/^\s*\{\{\d+\}\}/.test(body)) {
      errors.body = 'Variable cannot be at the start of body.';
    } else if (/\{\{\d+\}\}\s*$/.test(body)) {
      errors.body = 'Variable cannot be at the end of body.';
    } else if (missingNumbers.length > 0) {
      errors.body = `Variables must be sequential. Missing ${missingNumbers.map((n) => `{{${n}}}`).join(', ')}.`;
    }

    if (vars.length > 0) {
      const firstMissingSample = vars.find((num) => !String(variableExamples[num] || '').trim());
      if (firstMissingSample) {
        errors.variableSamples = `Sample value is required for {{${firstMissingSample}}}.`;
      }
    }

    if (templateData.content.header.type === 'image' && !templateData.content.header.mediaUrl) {
      errors.header = 'Header image is required when image type is image.';
    } else if (templateData.content.header.type === 'text' && headerText) {
      if (headerText.length > 60) {
        errors.header = 'Header text must be 60 characters or fewer.';
      } else if (containsInvalidBraceVariable(headerText)) {
        errors.header = 'Header variables must use {{1}} format.';
      }
    }

    if (footer.length > 60) {
      errors.footer = 'Footer must be 60 characters or fewer.';
    } else if (/\{\{(\d+)\}\}/.test(footer)) {
      errors.footer = 'Footer cannot contain variables.';
    }

    const quickReplyCount = templateData.content.buttons.filter((btn) => btn.type === 'quick_reply').length;
    if (quickReplyCount > 3) {
      errors.buttons = 'Maximum 3 quick reply buttons are allowed.';
    } else {
      const invalidButton = templateData.content.buttons.find((btn) => {
        if (!btn.text?.trim()) return true;
        if (btn.type === 'url' && !btn.url?.trim()) return true;
        if (btn.type === 'phone_number' && !btn.phoneNumber?.trim()) return true;
        return false;
      });
      if (invalidButton) {
        errors.buttons = 'Complete all button fields (text and URL/phone where applicable).';
      }
    }

    return errors;
  };

  const validationErrors = useMemo(
    () => validateTemplateRules(),
    [templateData, variableExamples, detectedVariables]
  );

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const handleSubmit = async () => {
    const errors = validateTemplateRules();
    if (Object.keys(errors).length > 0) {
      setSubmitStatus('error');
      setSubmitError(Object.values(errors)[0]);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitError('');

    try {
      // Convert to Meta API format for consistency
      const metaFormatData = {
        name: templateData.name,
        category: templateData.category.toUpperCase(),
        language: templateData.language,
        components: []
      };

      // Add body component
      if (templateData.content.body) {
        const bodyComponent = {
          type: "BODY",
          text: templateData.content.body
        };
        
        // Add examples if variables are present
        const variableNumbers = extractVariableNumbers(templateData.content.body);
        if (variableNumbers.length > 0) {
          // Use the actual variable examples from the state
          const exampleValues = variableNumbers.map(num => variableExamples[num] || `Example ${num}`);
          
          bodyComponent.example = {
            body_text: [exampleValues]
          };
        }
        
        metaFormatData.components.push(bodyComponent);
      }

      // Add header component if present
      if (templateData.content.header.type !== 'none' && templateData.content.header.type !== 'text') {
        metaFormatData.components.push({
          type: "HEADER",
          format: templateData.content.header.type.toUpperCase(),
          example: templateData.content.header.type === 'image' ? {
            header_handle: ["example"]
          } : undefined
        });
      } else if (templateData.content.header.type === 'text' && templateData.content.header.text) {
        metaFormatData.components.push({
          type: "HEADER",
          format: "TEXT",
          text: templateData.content.header.text
        });
      }

      // Add footer component if present
      if (templateData.content.footer) {
        metaFormatData.components.push({
          type: "FOOTER",
          text: templateData.content.footer
        });
      }

      // Add buttons component if present
      if (templateData.content.buttons.length > 0) {
        const buttons = templateData.content.buttons.map(button => ({
          type:
            button.type === 'quick_reply'
              ? 'QUICK_REPLY'
              : button.type === 'phone_number'
              ? 'PHONE_NUMBER'
              : 'URL',
          text: button.text,
          ...(button.type === 'url' && { url: button.url }),
          ...(button.type === 'phone_number' && { phone_number: button.phoneNumber })
        }));

        metaFormatData.components.push({
          type: "BUTTONS",
          buttons: buttons
        });
      }

      console.log('Submitting template in Meta format:', JSON.stringify(metaFormatData, null, 2));

      const response = await whatsappService.createTemplate(metaFormatData);

      if (response.success) {
        setSubmitStatus('success');
        // Reset form after successful submission
        setTimeout(() => {
          setTemplateData({
            name: '',
            category: 'marketing',
            language: 'en_US',
            content: {
              header: {
                type: 'text',
                text: '',
                mediaUrl: ''
              },
              body: '',
              footer: '',
              buttons: []
            }
          });
          setImagePreview('');
          setHeaderImage(null);
          setVariableExamples({});
          setSubmitStatus(null);
        }, 3000);
      } else {
        setSubmitStatus('error');
        const backendMessage = response.error || response.message || 'Failed to submit template';
        setSubmitError(backendMessage);
      }
    } catch (error) {
      console.error('Failed to submit template:', error);
      setSubmitStatus('error');
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to submit template. Please try again.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPreview = () => {
    const phoneTime = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false
    });
    const msgTime = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return (
      <div className="template-preview-card">
        <div className="template-preview-title">
          <h3>Template Preview</h3>
        </div>
        <div className="template-preview-content">
          <div className="template-phone-mockup">
            <div className="template-phone-header">
              <span className="template-phone-time">{phoneTime}</span>
              <div className="template-phone-icons">
                <span>📶</span>
                <span>📶</span>
                <span>🔋</span>
              </div>
            </div>

            <div className="template-chat-header">
              <div className="template-chat-header-left">
                <span className="template-back-arrow">←</span>
                <div className="template-contact-info">
                  <div className="template-contact-avatar">
                    <img src={whatsappLogo} alt="WhatsApp Business" className="template-contact-avatar-img" />
                  </div>
                  <div className="template-contact-details">
                    <div className="template-contact-name">WhatsApp Business <span>✓</span></div>
                    <div className="template-contact-status">Online</div>
                  </div>
                </div>
              </div>
              <div className="template-chat-header-right">⋮</div>
            </div>

            <div className="template-chat-container">
              <div className="template-date-separator">
                <span>Today</span>
              </div>

              <div className="template-message-bubble sent">
                {templateData.content.header.type !== 'none' && (
                  <div className="template-msg-header">
                    {templateData.content.header.type === 'image' && imagePreview && (
                      <img src={imagePreview} alt="Header" className="template-header-image" />
                    )}
                    {templateData.content.header.type === 'text' && templateData.content.header.text && (
                      <div className="template-header-text">{renderPreviewText(templateData.content.header.text)}</div>
                    )}
                  </div>
                )}

                <div className="template-msg-body">
                  {templateData.content.body
                    ? renderPreviewText(templateData.content.body)
                    : 'Type message body to preview'}
                </div>

                {templateData.content.footer && (
                  <div className="template-msg-footer">{renderPreviewText(templateData.content.footer)}</div>
                )}

                {templateData.content.buttons.length > 0 && (
                  <div className="template-msg-buttons">
                    {templateData.content.buttons.map((button, index) => (
                      <button key={index} className="template-msg-button" type="button">
                        {renderPreviewText(button.text) || `Button ${index + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="template-msg-meta">
                  <span>{msgTime}</span>
                  <span>✓✓</span>
                </div>
              </div>
            </div>

            <div className="template-chat-input">
              <span>😊</span>
              <input type="text" placeholder="Type a message" readOnly />
              <span>📎</span>
              <span>📷</span>
              <span>🎤</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="template-creator">
      <div className="creator-header">
        <h2>Create WhatsApp Template</h2>
        <p>Design your message template with support for images, buttons, and more</p>
      </div>

      <div className="creator-layout">
        <div className="creator-form">
          {/* Basic Information */}
          <div className="form-section">
            <h3>Basic Information</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Template Name *</label>
                <input
                  type="text"
                  value={templateData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter template name"
                  maxLength="512"
                />
                {validationErrors.name && <p className="field-error">{validationErrors.name}</p>}
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <select
                  value={templateData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {validationErrors.category && <p className="field-error">{validationErrors.category}</p>}
              </div>
              
              <div className="form-group">
                <label>Language *</label>
                <select
                  value={templateData.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                >
                  {languages.map(lang => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
                {validationErrors.language && <p className="field-error">{validationErrors.language}</p>}
              </div>
            </div>
          </div>

          {/* Header Section */}
          <div className="form-section">
            <h3>Header (Optional)</h3>
            <div className="form-group">
              <label>Header Type</label>
              <select
                value={templateData.content.header.type}
                onChange={(e) => handleHeaderChange('type', e.target.value)}
              >
                {headerTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {validationErrors.header && <p className="field-error">{validationErrors.header}</p>}
            </div>

            {templateData.content.header.type === 'text' && (
              <div className="form-group">
                <label>Header Text</label>
                <input
                  type="text"
                  value={templateData.content.header.text}
                  onChange={(e) => handleHeaderChange('text', e.target.value)}
                  placeholder="Enter header text"
                  maxLength="60"
                />
              </div>
            )}

            {templateData.content.header.type === 'image' && (
              <div className="form-group">
                <label>Header Image</label>
                <div className="image-upload">
                  {imagePreview ? (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Header preview" />
                      <button type="button" className="remove-image" onClick={removeImage}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="upload-area">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="upload-button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={20} />
                        <span>Upload Image</span>
                      </button>
                      <p className="upload-hint">
                        Supported formats: JPG, PNG, GIF (Max 5MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Body Section */}
          <div className="form-section">
            <h3>Body Content *</h3>
            <div className="body-content-wrapper">
              <div className="variable-top-row">
                <div className="form-group variable-type-group">
                  <label>Type of variable</label>
                  <select value={variableType} onChange={(e) => setVariableType(e.target.value)}>
                    <option value="number">Number</option>
                    <option value="name">Name</option>
                  </select>
                </div>
                <button type="button" className="add-variable-link" onClick={insertNextVariable}>
                  <Plus size={14} />
                  Add variable
                </button>
              </div>

              <div className="form-group">
                <textarea
                  ref={textareaRef}
                  value={templateData.content.body}
                  onChange={(e) => handleContentChange('body', e.target.value)}
                  placeholder="Enter your message content here..."
                  rows="6"
                  maxLength="1024"
                />
                <div className="char-count">
                  {templateData.content.body.length}/1024 characters
                </div>
                {validationErrors.body && <p className="field-error">{validationErrors.body}</p>}
                <div className="formatting-toolbar">
                  <button type="button" onClick={insertEmojiNormalized} title="Emoji">🙂</button>
                  <button type="button" onClick={() => applyInlineFormatting('*')} title="Bold"><strong>B</strong></button>
                  <button type="button" onClick={() => applyInlineFormatting('_')} title="Italic"><em>I</em></button>
                  <button type="button" onClick={() => applyInlineFormatting('~')} title="Strikethrough"><span style={{ textDecoration: 'line-through' }}>S</span></button>
                  <button type="button" onClick={() => applyInlineFormatting('`')} title="Monospace"><code>{'</>'}</code></button>
                  <button type="button" className="inline-add-variable" onClick={insertNextVariable}>
                    <Plus size={14} /> Add variable
                  </button>
                </div>
              </div>
              
              <div className="variables-section">
                <h4>Variable samples</h4>
                <p className="variables-hint">
                  Variables are detected from body placeholders and sent to Meta for review.
                </p>
                {detectedVariables.length === 0 && (
                  <div className="no-variables">No variables detected in body yet.</div>
                )}
                {detectedVariables.length > 0 && (
                  <div className="variables-grid">
                    {detectedVariables.map((num) => (
                      <div className="variable-item" key={num}>
                        <label>{`{{${num}}}`}</label>
                        <input
                          type="text"
                          placeholder={variableType === 'name' ? 'Sample name' : `Sample value ${num}`}
                          value={variableExamples[num] || ''}
                          onChange={(e) => updateVariableExample(num, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {validationErrors.variableSamples && <p className="field-error">{validationErrors.variableSamples}</p>}
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="form-section">
            <h3>Footer (Optional)</h3>
            <div className="form-group">
              <input
                type="text"
                value={templateData.content.footer}
                onChange={(e) => handleContentChange('footer', e.target.value)}
                placeholder="Enter footer text"
                maxLength="60"
              />
              {validationErrors.footer && <p className="field-error">{validationErrors.footer}</p>}
            </div>
          </div>

          {/* Buttons Section */}
          <div className="form-section">
            <h3>Buttons (Optional)</h3>
            <div className="buttons-container">
              {templateData.content.buttons.map((button, index) => (
                <div key={index} className="button-config">
                  <div className="button-header">
                    <span>Button {index + 1}</span>
                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => removeButton(index)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Button Type</label>
                      <select
                        value={button.type}
                        onChange={(e) => updateButton(index, 'type', e.target.value)}
                      >
                        {buttonTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Button Text</label>
                      <input
                        type="text"
                        value={button.text}
                        onChange={(e) => updateButton(index, 'text', e.target.value)}
                        placeholder="Enter button text"
                        maxLength="20"
                      />
                    </div>
                    
                    {button.type === 'url' && (
                      <div className="form-group">
                        <label>Website URL</label>
                        <input
                          type="url"
                          value={button.url}
                          onChange={(e) => updateButton(index, 'url', e.target.value)}
                          placeholder="https://example.com"
                        />
                      </div>
                    )}
                    
                    {button.type === 'phone_number' && (
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input
                          type="tel"
                          value={button.phoneNumber}
                          onChange={(e) => updateButton(index, 'phoneNumber', e.target.value)}
                          placeholder="+1234567890"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {templateData.content.buttons.length < 10 && (
                <button type="button" className="add-button" onClick={addButton}>
                  <Plus size={16} />
                  Add Button
                </button>
              )}
              {validationErrors.buttons && <p className="field-error">{validationErrors.buttons}</p>}
            </div>
          </div>

          {/* Submit Section */}
          <div className="form-section">
            <div className="submit-actions">
              <button
                type="button"
                className="submit-button"
                onClick={handleSubmit}
                disabled={isSubmitting || hasValidationErrors}
              >
                {isSubmitting ? (
                  <>
                    <Clock size={20} className="spinning" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Submit for Approval
                  </>
                )}
              </button>
              
              {submitStatus === 'success' && (
                <div className="status-message success">
                  <CheckCircle size={20} />
                  Template submitted successfully! It will be reviewed by WhatsApp.
                </div>
              )}
              
              {submitStatus === 'error' && (
                <div className="status-message error">
                  <AlertCircle size={20} />
                  {submitError || 'Failed to submit template. Please try again.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="creator-preview">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTemplateCreator;
