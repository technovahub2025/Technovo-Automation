import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Plus, Phone, Globe, Eye, Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
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
  const [variableExamples, setVariableExamples] = useState({
    1: 'Ravi',
    2: 'ORD1234',
    3: '10 Feb 2026',
    4: '',
    5: ''
  });

  // Initialize with empty strings to avoid undefined issues
  const [initializedExamples, setInitializedExamples] = useState(false);
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

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setTemplateData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setTemplateData(prev => ({
        ...prev,
        [field]: value
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
    if (templateData.content.buttons.length < 2) {
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

  const validateTemplate = () => {
    if (!templateData.name.trim()) {
      return 'Template name is required';
    }
    if (!templateData.content.body.trim()) {
      return 'Body content is required';
    }
    if (templateData.content.header.type === 'image' && !templateData.content.header.mediaUrl) {
      return 'Header image is required when image type is selected';
    }
    return null;
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

  const updateVariableExample = (varNumber, value) => {
    setVariableExamples(prev => ({
      ...prev,
      [varNumber]: value
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

  const handleSubmit = async () => {
    const validationError = validateTemplate();
    if (validationError) {
      alert(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

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
          type: button.type === 'quick_reply' ? 'QUICK_REPLY' : 'URL',
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
          setVariableExamples({
            1: 'Ravi',
            2: 'ORD1234',
            3: '10 Feb 2026',
            4: '',
            5: ''
          });
          setSubmitStatus(null);
        }, 3000);
      } else {
        setSubmitStatus('error');
        alert(response.error || 'Failed to submit template');
      }
    } catch (error) {
      console.error('Failed to submit template:', error);
      setSubmitStatus('error');
      alert('Failed to submit template. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPreview = () => {
    return (
      <div className="template-preview">
        <div className="preview-header">
          <h3>Template Preview</h3>
        </div>
        <div className="preview-content">
          <div className="whatsapp-message">
            {templateData.content.header.type !== 'none' && (
              <div className="message-header">
                {templateData.content.header.type === 'image' && imagePreview && (
                  <img src={imagePreview} alt="Header" className="header-image" />
                )}
                {templateData.content.header.type === 'text' && templateData.content.header.text && (
                  <div className="header-text">{templateData.content.header.text}</div>
                )}
              </div>
            )}
            
            {templateData.content.body && (
              <div className="message-body">
                {templateData.content.body}
              </div>
            )}
            
            {templateData.content.footer && (
              <div className="message-footer">
                {templateData.content.footer}
              </div>
            )}
            
            {templateData.content.buttons.length > 0 && (
              <div className="message-buttons">
                {templateData.content.buttons.map((button, index) => (
                  <button key={index} className="message-button">
                    {button.text || `Button ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
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
              </div>
              
              {/* Variable Adding Section */}
              <div className="variables-section">
                <h4>Variables</h4>
                <p className="variables-hint">
                  Add variables to personalize your messages. Use {'{{1}}'}, {'{{2}}'}, etc. in your message.
                </p>
                <div className="variables-grid">
                  <div className="variable-item">
                    <label>Variable 1:</label>
                    <input
                      type="text"
                      placeholder="e.g., Customer Name"
                      value={variableExamples[1] || ''}
                      onChange={(e) => updateVariableExample(1, e.target.value)}
                    />
                  </div>
                  <div className="variable-item">
                    <label>Variable 2:</label>
                    <input
                      type="text"
                      placeholder="e.g., Order ID"
                      value={variableExamples[2] || ''}
                      onChange={(e) => updateVariableExample(2, e.target.value)}
                    />
                  </div>
                  <div className="variable-item">
                    <label>Variable 3:</label>
                    <input
                      type="text"
                      placeholder="e.g., Delivery Date"
                      value={variableExamples[3] || ''}
                      onChange={(e) => updateVariableExample(3, e.target.value)}
                    />
                  </div>
                  <div className="variable-item">
                    <label>Variable 4:</label>
                    <input
                      type="text"
                      placeholder="e.g., Product Name"
                      value={variableExamples[4] || ''}
                      onChange={(e) => updateVariableExample(4, e.target.value)}
                    />
                  </div>
                  <div className="variable-item">
                    <label>Variable 5:</label>
                    <input
                      type="text"
                      placeholder="e.g., Amount"
                      value={variableExamples[5] || ''}
                      onChange={(e) => updateVariableExample(5, e.target.value)}
                    />
                  </div>
                </div>
                <div className="quick-insert-buttons">
                  <button 
                    type="button" 
                    className="variable-btn"
                    onClick={() => insertVariable('{{1}}')}
                  >
                    Insert {'{{1}}'}
                  </button>
                  <button 
                    type="button" 
                    className="variable-btn"
                    onClick={() => insertVariable('{{2}}')}
                  >
                    Insert {'{{2}}'}
                  </button>
                  <button 
                    type="button" 
                    className="variable-btn"
                    onClick={() => insertVariable('{{3}}')}
                  >
                    Insert {'{{3}}'}
                  </button>
                  <button 
                    type="button" 
                    className="variable-btn"
                    onClick={() => insertVariable('{{4}}')}
                  >
                    Insert {'{{4}}'}
                  </button>
                  <button 
                    type="button" 
                    className="variable-btn"
                    onClick={() => insertVariable('{{5}}')}
                  >
                    Insert {'{{5}}'}
                  </button>
                </div>
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
              
              {templateData.content.buttons.length < 2 && (
                <button type="button" className="add-button" onClick={addButton}>
                  <Plus size={16} />
                  Add Button
                </button>
              )}
            </div>
          </div>

          {/* Submit Section */}
          <div className="form-section">
            <div className="submit-actions">
              <button
                type="button"
                className="submit-button"
                onClick={handleSubmit}
                disabled={isSubmitting}
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
                  Failed to submit template. Please try again.
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
