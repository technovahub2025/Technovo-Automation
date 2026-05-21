import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, X, Plus, Send, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { whatsappService } from '../services/whatsappService';
import whatsappLogo from '../assets/WhatsApp.svg.webp';
import './WhatsAppTemplateCreator.css';

const WhatsAppTemplateCreator = ({ initialTemplate = null }) => {
  const navigate = useNavigate();

  const getReadableErrorMessage = (value, fallback = 'Unknown error') => {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return (
        value.error?.message ||
        value.error ||
        value.message ||
        value.error_user_msg ||
        fallback
      );
    }
    return String(value);
  };

  const buildFriendlySubmitErrorMessage = (actualError) => {
    const reason = getReadableErrorMessage(actualError, 'The template could not be submitted.');
    return `Template submission failed.\n\nReason: ${reason}\n\nThis may happen because of wrong input, a server issue, or a Meta WhatsApp approval/API issue. Kindly reach out to customer service if you need help.`;
  };

  const prepareMetaTemplateText = (value) => {
    const normalized = String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/^\n+|\n+$/g, '');
    if (!normalized) return { text: '', examples: [] };

    const placeholderExamples = [];
    let placeholderIndex = 1;
    const hasExplicitPlaceholders = /\{\{\d+\}\}/.test(normalized);
    if (hasExplicitPlaceholders) {
      return { text: normalized, examples: [] };
    }

    const metaBodyPattern = /(?:https?:\/\/[^\s]+|www\.[^\s]+|\+?\d[\d\s().-]{7,}\d)/g;
    const text = normalized.replace(metaBodyPattern, (match) => {
      placeholderExamples.push(match.trim());
      const placeholder = `{{${placeholderIndex}}}`;
      placeholderIndex += 1;
      return placeholder;
    });

    return { text, examples: placeholderExamples };
  };

  const getTemplateBodyText = (template = {}) => {
    if (template?.content?.body) return template.content.body;
    if (template?.message) return template.message;
    const bodyComponent = Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').trim().toUpperCase() === 'BODY')
      : null;
    return bodyComponent?.text || '';
  };

  const getTemplateHeader = (template = {}) => {
    const contentHeader = template?.content?.header;
    if (contentHeader && typeof contentHeader === 'object') {
      return {
        type: String(contentHeader.type || 'text').toLowerCase(),
        text: String(contentHeader.text || ''),
        mediaUrl: String(contentHeader.mediaUrl || '')
      };
    }

    const headerComponent = Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').trim().toUpperCase() === 'HEADER')
      : null;

    return {
      type: String(headerComponent?.format || 'text').toLowerCase(),
      text: String(headerComponent?.text || ''),
      mediaUrl: String(headerComponent?.example?.header_handle?.[0] || '')
    };
  };

  const getTemplateFooterText = (template = {}) => {
    if (template?.content?.footer) return template.content.footer;
    const footerComponent = Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').trim().toUpperCase() === 'FOOTER')
      : null;
    return footerComponent?.text || '';
  };

  const getTemplateButtons = (template = {}) => {
    if (Array.isArray(template?.content?.buttons)) return template.content.buttons;
    const buttonsComponent = Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').trim().toUpperCase() === 'BUTTONS')
      : null;
    return Array.isArray(buttonsComponent?.buttons) ? buttonsComponent.buttons : [];
  };

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
  const [openGuideSections, setOpenGuideSections] = useState({
    rules: false,
    dosDonts: false,
    quickFacts: false,
    checklist: false
  });
  const [variableType, setVariableType] = useState('number');
  const [variableExamples, setVariableExamples] = useState({});
  const editingTemplateId = initialTemplate?._id || initialTemplate?.id || '';
  const isEditingTemplate = Boolean(editingTemplateId);

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

  const guideRules = [
    ['Name', 'Lowercase a-z, numbers 0-9, underscores _ only'],
    ['Body', 'Max 1,024 chars (550 for Marketing)'],
    ['Header', 'Max 60 chars; 1 variable max'],
    ['Footer', 'Max 60 chars, no variables, no emojis'],
    ['Variables', 'Sequential {{1}}, {{2}}...'],
    ['Emojis', 'Max 10 total, body only'],
    ['Buttons', '3 Quick Reply OR 2 CTA (1 Phone + 1 URL)'],
    ['URLs', 'Valid HTTPS matching Business Manager domain'],
    ['Categories', 'Authentication / Utility / Marketing (be honest)']
  ];

  const guideDosDonts = [
    ['Pick correct category (Marketing is not Utility)', 'Submit marketing content as Utility'],
    ['Use sequential {{1}}, {{2}}, {{3}}', 'Skip numbers, like {{1}}, {{3}}'],
    ['Keep placeholder order consistent', 'Reuse the wrong sample for a different placeholder'],
    ['Use valid HTTPS URLs matching your domain', 'Use shortened or masked URLs'],
    ['Keep footer static text only', 'Put variables or emojis in footer'],
    ['Use max 10 emojis in body only', 'Use emojis in header, footer, or CTA buttons'],
    ['Use 3 Quick Reply OR 2 CTA buttons', 'Mix Quick Reply and CTA together'],
    ['Keep text compact with max 2 empty lines', 'Use more than 2 consecutive line breaks']
  ];

  const guideChecklist = [
    'Correct category selected',
    'Template name: lowercase + underscores',
    'Variables: {{1}}, {{2}}, {{3}} (no skipping)',
    'Body under 1,024 chars (550 for Marketing)',
    'Footer: under 60 chars, no variables, no emojis',
    'Max 10 emojis total (body only)',
    'Buttons: 3 Quick Reply OR 2 CTA (1 Phone + 1 URL)',
    'All URLs valid HTTPS + match domain',
    'No payment/Aadhaar/passport requests',
    'Max 2 empty lines'
  ];

  const toggleGuideSection = (section) => {
    setOpenGuideSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  };

  const normalizeTemplateName = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

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

  useEffect(() => {
    if (!initialTemplate) return;

    const bodyText = getTemplateBodyText(initialTemplate);
    const preparedBody = prepareMetaTemplateText(bodyText);
    const header = getTemplateHeader(initialTemplate);
    const footerText = getTemplateFooterText(initialTemplate);
    const buttons = getTemplateButtons(initialTemplate);

    setTemplateData({
      name: String(initialTemplate.name || ''),
      category: String(initialTemplate.category || 'marketing').toLowerCase(),
      language: String(initialTemplate.language || 'en_US'),
      content: {
        header: {
          type: header.type || 'text',
          text: header.text || '',
          mediaUrl: header.mediaUrl || ''
        },
        body: bodyText || '',
        footer: footerText || '',
        buttons
      }
    });

    const nextExamples = {};
    if (Array.isArray(initialTemplate.variables) && initialTemplate.variables.length > 0) {
      initialTemplate.variables.forEach((variable, index) => {
        const example = String(variable?.example || '').trim();
        if (example) {
          nextExamples[index + 1] = example;
        }
      });
    }
    if (Object.keys(nextExamples).length === 0 && preparedBody.examples.length > 0) {
      preparedBody.examples.forEach((example, index) => {
        if (example) {
          nextExamples[index + 1] = example;
        }
      });
    }
    setVariableExamples(nextExamples);
    setImagePreview(header.mediaUrl || '');
    setHeaderImage(null);
    setSubmitStatus(null);
  }, [initialTemplate]);

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

  const renderMultilinePreviewText = (rawText) => {
    const prepared = prepareMetaTemplateText(rawText);
    const text = String(prepared.text || '').replace(/\{\{(\d+)\}\}/g, (_, number) => {
      const explicitValue = variableExamples[Number(number)];
      const autoValue = prepared.examples[Number(number) - 1];
      return explicitValue && String(explicitValue).trim()
        ? String(explicitValue).trim()
        : autoValue && String(autoValue).trim()
          ? String(autoValue).trim()
          : `{{${number}}}`;
    });
    if (!text) return '';

    return String(text)
      .split('\n')
      .map((line, index) => (
        <React.Fragment key={`${index}-${line}`}>
          {index > 0 && <br />}
          {line || '\u00A0'}
        </React.Fragment>
      ));
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
    } else if (!/^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/.test(templateData.name)) {
      errors.name = 'Use lowercase letters, numbers, and underscores only, and do not start or end with underscore.';
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
      const validationMessage = Object.values(errors)[0];
      setSubmitStatus('error');
      console.error('Template validation failed:', validationMessage);
      window.alert(buildFriendlySubmitErrorMessage(validationMessage));
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const preparedBody = prepareMetaTemplateText(templateData.content.body);
      const sanitizedBody = preparedBody.text;
      const sanitizedHeaderText = prepareMetaTemplateText(templateData.content.header.text).text;
      const sanitizedFooter = prepareMetaTemplateText(templateData.content.footer).text;
      const editorPayload = {
        name: templateData.name,
        category: templateData.category,
        language: templateData.language,
        content: {
          header: {
            type: templateData.content.header.type,
            text: sanitizedHeaderText,
            mediaUrl: templateData.content.header.mediaUrl || ''
          },
          body: sanitizedBody,
          footer: sanitizedFooter,
          buttons: templateData.content.buttons
        },
        components: [],
        variables: []
      };

      // Convert to Meta API format for consistency
      const metaFormatData = {
        name: templateData.name,
        category: templateData.category.toUpperCase(),
        language: templateData.language,
        components: []
      };

      // Add body component
      if (sanitizedBody) {
        const bodyComponent = {
          type: "BODY",
          text: sanitizedBody
        };
        
        // Add examples if variables are present
        const variableNumbers = extractVariableNumbers(sanitizedBody);
        if (variableNumbers.length > 0) {
          // Use the actual variable examples from the state
          const exampleValues = variableNumbers.map((num, index) =>
            variableExamples[num] ||
            preparedBody.examples[index] ||
            `Example ${num}`
          );
          
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
      } else if (templateData.content.header.type === 'text' && sanitizedHeaderText) {
        metaFormatData.components.push({
          type: "HEADER",
          format: "TEXT",
          text: sanitizedHeaderText
        });
      }

      // Add footer component if present
      if (sanitizedFooter) {
        metaFormatData.components.push({
          type: "FOOTER",
          text: sanitizedFooter
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

      editorPayload.components = metaFormatData.components;
      editorPayload.variables = detectedVariables.map((number, index) => ({
        name: `var${number}`,
        example: variableExamples[number] || preparedBody.examples[index] || `Example ${number}`,
        required: false
      }));

      console.log('Submitting template in Meta format:', JSON.stringify(metaFormatData, null, 2));

      const response = isEditingTemplate && editingTemplateId
        ? await whatsappService.updateTemplate(editingTemplateId, editorPayload)
        : await whatsappService.createTemplate(metaFormatData);

      if (response.success) {
        setSubmitStatus('success');
        if (isEditingTemplate) {
          setTimeout(() => {
            navigate('/templates');
          }, 1200);
          return;
        }

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
        const backendMessage =
          response?.error ||
          response?.message ||
          response?.details?.error?.message ||
          response?.details?.message ||
          'The server rejected the template submission.';
        setSubmitStatus('error');
        console.error('Template submission failed:', response);
        window.alert(buildFriendlySubmitErrorMessage(backendMessage));
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'The template could not be submitted.';
      console.error('Failed to submit template:', error);
      setSubmitStatus('error');
      window.alert(buildFriendlySubmitErrorMessage(errorMessage));
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
                      <div className="template-header-text">{renderMultilinePreviewText(templateData.content.header.text)}</div>
                    )}
                  </div>
                )}

                <div className="template-msg-body">
                  {templateData.content.body
                    ? renderMultilinePreviewText(templateData.content.body)
                    : 'Type message body to preview'}
                </div>

                {templateData.content.footer && (
                  <div className="template-msg-footer">{renderMultilinePreviewText(templateData.content.footer)}</div>
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

  const renderTemplateGuide = () => (
    <div className="template-guide-card">
      <div className="template-guide-label">
        <strong>WhatsApp Template Guide</strong>
      </div>

      <div className="template-guide-accordion">
        <section className="template-guide-section">
          <button
            type="button"
            className="template-guide-toggle"
            onClick={() => toggleGuideSection('rules')}
            aria-expanded={openGuideSections.rules}
          >
            <span>Rules, checklist, and approval tips</span>
            <ChevronDown
              size={18}
              className={`template-guide-chevron${openGuideSections.rules ? ' open' : ''}`}
              aria-hidden="true"
            />
          </button>
          {openGuideSections.rules && (
            <div className="template-guide-content">
              <div className="template-guide-table-wrap">
                <table className="template-guide-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Rule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guideRules.map(([section, rule]) => (
                      <tr key={section}>
                        <td>{section}</td>
                        <td>{rule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="template-guide-section">
          <button
            type="button"
            className="template-guide-toggle"
            onClick={() => toggleGuideSection('dosDonts')}
            aria-expanded={openGuideSections.dosDonts}
          >
            <span>Do's / Don'ts</span>
            <ChevronDown
              size={18}
              className={`template-guide-chevron${openGuideSections.dosDonts ? ' open' : ''}`}
              aria-hidden="true"
            />
          </button>
          {openGuideSections.dosDonts && (
            <div className="template-guide-content">
              <div className="template-guide-table-wrap">
                <table className="template-guide-table">
                  <thead>
                    <tr>
                      <th>Do</th>
                      <th>Don't</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guideDosDonts.map(([doText, dontText]) => (
                      <tr key={doText}>
                        <td>{doText}</td>
                        <td>{dontText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="template-guide-section">
          <button
            type="button"
            className="template-guide-toggle"
            onClick={() => toggleGuideSection('quickFacts')}
            aria-expanded={openGuideSections.quickFacts}
          >
            <span>Quick Facts</span>
            <ChevronDown
              size={18}
              className={`template-guide-chevron${openGuideSections.quickFacts ? ' open' : ''}`}
              aria-hidden="true"
            />
          </button>
          {openGuideSections.quickFacts && (
            <div className="template-guide-content">
              <div className="template-guide-facts">
                <div><span>Approval Time</span><strong>15 min - 24-72 hrs</strong></div>
                <div><span>Success Rate</span><strong>99% when rules are followed</strong></div>
                <div><span>Top Rejection</span><strong>Wrong category</strong></div>
              </div>
            </div>
          )}
        </section>

        <section className="template-guide-section">
          <button
            type="button"
            className="template-guide-toggle"
            onClick={() => toggleGuideSection('checklist')}
            aria-expanded={openGuideSections.checklist}
          >
            <span>Pre-Submit Checklist</span>
            <ChevronDown
              size={18}
              className={`template-guide-chevron${openGuideSections.checklist ? ' open' : ''}`}
              aria-hidden="true"
            />
          </button>
          {openGuideSections.checklist && (
            <div className="template-guide-content">
              <ul className="template-guide-checklist">
                {guideChecklist.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">☐</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );

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
                      className="template-remove-button"
                      onClick={() => removeButton(index)}
                      aria-label={`Remove button ${index + 1}`}
                    >
                      <span className="template-remove-symbol" aria-hidden="true">&times;</span>
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
                <button type="button" className="template-add-button" onClick={addButton}>
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
                className="template-submit-button"
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
                    {isEditingTemplate ? 'Save Changes' : 'Submit for Approval'}
                  </>
                )}
              </button>
              
              {submitStatus === 'success' && (
                <div className="status-message success">
                  <CheckCircle size={20} />
                  {isEditingTemplate
                    ? 'Template updated successfully.'
                    : 'Template submitted successfully! It will be reviewed by WhatsApp.'}
                </div>
              )}
              
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="creator-preview">
          {renderPreview()}
          {renderTemplateGuide()}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTemplateCreator;
