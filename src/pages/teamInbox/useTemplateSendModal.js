import { useEffect, useState } from 'react';
import { whatsappService } from '../../services/whatsappService';
import { getConversationIdValue } from './teamInboxUtils';

export const useTemplateSendModal = ({
  selectedConversation,
  templateTarget,
  conversationId,
  onMissingContactPhone,
  onTemplateSent,
  onTemplateModalClosed
}) => {
  const [showTemplateSendModal, setShowTemplateSendModal] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSending, setTemplateSending] = useState(false);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateVariableValues, setTemplateVariableValues] = useState([]);
  const [templateHeaderVariableValues, setTemplateHeaderVariableValues] = useState([]);
  const [templateHeaderMediaUrl, setTemplateHeaderMediaUrl] = useState('');
  const [templateModalMessage, setTemplateModalMessage] = useState('');
  const [templateModalMessageTone, setTemplateModalMessageTone] = useState('info');

  const brandLogoUrl = String(import.meta.env.VITE_BRAND_LOGO_URL || '').trim();
  const resolvedTemplateTarget =
    templateTarget?.contactPhone
      ? {
          contactPhone: String(templateTarget?.contactPhone || '').trim(),
          contactName: String(
            templateTarget?.contactName || templateTarget?.name || ''
          ).trim(),
          contactId: String(templateTarget?.contactId || '').trim()
        }
      : selectedConversation?.contactPhone
        ? {
            contactPhone: String(selectedConversation?.contactPhone || '').trim(),
            contactName: String(
              selectedConversation?.contactName ||
                selectedConversation?.name ||
                selectedConversation?.displayName ||
                ''
            ).trim(),
            contactId: String(
              selectedConversation?.contactId?._id ||
                selectedConversation?.contactId?.id ||
                selectedConversation?.contactId ||
                ''
            ).trim()
          }
        : null;

  const getTemplateCompositeKey = (template = {}) => {
    const name = String(template?.name || '').trim();
    const language = String(template?.language || template?.languageCode || 'en_US').trim() || 'en_US';
    return `${name}::${language}`;
  };

  const getTemplateLanguageCode = (template = {}) =>
    String(template?.language || template?.languageCode || 'en_US').trim() || 'en_US';

  const extractVariableCountFromText = (text = '') => {
    const matches = [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)];
    if (matches.length === 0) return 0;
    return matches.reduce((maxValue, match) => {
      const value = Number(match?.[1] || 0);
      return Number.isFinite(value) ? Math.max(maxValue, value) : maxValue;
    }, 0);
  };

  const getTemplateHeaderComponent = (template = {}) =>
    Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').toUpperCase() === 'HEADER') || null
      : null;

  const getTemplateHeaderFormat = (template = {}) =>
    String(getTemplateHeaderComponent(template)?.format || '').trim().toUpperCase();

  const templateRequiresHeaderMedia = (template = {}) =>
    ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(getTemplateHeaderFormat(template));

  const extractTemplateVariableCount = (template = {}) => {
    const contentBody =
      typeof template?.content === 'string'
        ? template.content
        : template?.content?.body || '';
    const bodyFromComponents = Array.isArray(template?.components)
      ? template.components.find((component) => String(component?.type || '').toUpperCase() === 'BODY')?.text || ''
      : '';
    const bodyText = String(contentBody || bodyFromComponents || '');
    return extractVariableCountFromText(bodyText);
  };

  const extractTemplateHeaderVariableCount = (template = {}) => {
    const headerComponent = getTemplateHeaderComponent(template);
    if (!headerComponent) return 0;
    if (templateRequiresHeaderMedia(template)) return 0;
    return extractVariableCountFromText(headerComponent?.text || '');
  };

  const selectedTemplateOption =
    templateOptions.find((template) => getTemplateCompositeKey(template) === selectedTemplateKey) || null;

  const getDefaultHeaderMediaUrl = (template = {}) => {
    if (!templateRequiresHeaderMedia(template)) return '';
    return brandLogoUrl;
  };

  const loadTemplateOptions = async () => {
    try {
      setTemplateLoading(true);
      setTemplateModalMessage('');
      const templates = await whatsappService.getTemplates();
      const rawTemplates = Array.isArray(templates) ? templates : [];
      const approvedTemplates = rawTemplates.filter((template) =>
        ['APPROVED', 'ACTIVE'].includes(String(template?.status || '').toUpperCase())
      );
      const usableTemplates = approvedTemplates.length > 0 ? approvedTemplates : rawTemplates;
      setTemplateOptions(usableTemplates);

      if (!usableTemplates.length) {
        setSelectedTemplateKey('');
        setTemplateVariableValues([]);
        setTemplateHeaderVariableValues([]);
        setTemplateHeaderMediaUrl('');
        setTemplateModalMessage('No templates found. Create or sync templates first.');
        setTemplateModalMessageTone('error');
        return;
      }

      const defaultTemplate = usableTemplates[0];
      const defaultKey = getTemplateCompositeKey(defaultTemplate);
      setSelectedTemplateKey(defaultKey);

      const bodyVariableCount = extractTemplateVariableCount(defaultTemplate);
      const headerVariableCount = extractTemplateHeaderVariableCount(defaultTemplate);
      setTemplateVariableValues(Array.from({ length: bodyVariableCount }, () => ''));
      setTemplateHeaderVariableValues(Array.from({ length: headerVariableCount }, () => ''));
      setTemplateHeaderMediaUrl(getDefaultHeaderMediaUrl(defaultTemplate));

      if (approvedTemplates.length === 0) {
        setTemplateModalMessage('No approved template found. Showing available templates.');
        setTemplateModalMessageTone('error');
      }
    } catch (error) {
      setTemplateOptions([]);
      setSelectedTemplateKey('');
      setTemplateVariableValues([]);
      setTemplateHeaderVariableValues([]);
      setTemplateHeaderMediaUrl('');
      setTemplateModalMessage(error?.message || 'Failed to load templates.');
      setTemplateModalMessageTone('error');
    } finally {
      setTemplateLoading(false);
    }
  };

  const openTemplateSendModal = async () => {
    if (!resolvedTemplateTarget?.contactPhone) {
      if (typeof onMissingContactPhone === 'function') {
        onMissingContactPhone('No contact phone found for this conversation.');
      }
      return;
    }

    setShowTemplateSendModal(true);
    setTemplateModalMessage('');
    setTemplateModalMessageTone('info');
    await loadTemplateOptions();
  };

  const closeTemplateSendModal = () => {
    if (templateSending) return;
    setShowTemplateSendModal(false);
    setTemplateModalMessage('');
    setTemplateModalMessageTone('info');
    if (typeof onTemplateModalClosed === 'function') {
      onTemplateModalClosed();
    }
  };

  const handleTemplateSelectionChange = (templateKey) => {
    setSelectedTemplateKey(templateKey);
    const selectedTemplate = templateOptions.find((template) => getTemplateCompositeKey(template) === templateKey);
    const variableCount = extractTemplateVariableCount(selectedTemplate);
    const headerVariableCount = extractTemplateHeaderVariableCount(selectedTemplate);
    setTemplateVariableValues((previousValues) =>
      Array.from({ length: variableCount }, (_, index) => previousValues[index] || '')
    );
    setTemplateHeaderVariableValues((previousValues) =>
      Array.from({ length: headerVariableCount }, (_, index) => previousValues[index] || '')
    );
    setTemplateHeaderMediaUrl(getDefaultHeaderMediaUrl(selectedTemplate));
  };

  const handleTemplateVariableChange = (index, value) => {
    setTemplateVariableValues((previousValues) =>
      previousValues.map((item, variableIndex) => (variableIndex === index ? value : item))
    );
  };

  const handleTemplateHeaderVariableChange = (index, value) => {
    setTemplateHeaderVariableValues((previousValues) =>
      previousValues.map((item, variableIndex) => (variableIndex === index ? value : item))
    );
  };

  const handleTemplateHeaderMediaUrlChange = (value) => {
    setTemplateHeaderMediaUrl(String(value || ''));
  };

  const handleSendTemplate = async () => {
    try {
      const activeConversationId =
        getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
      if (!resolvedTemplateTarget?.contactPhone) {
        throw new Error('Missing contact details.');
      }

      const selectedTemplate = templateOptions.find(
        (template) => getTemplateCompositeKey(template) === selectedTemplateKey
      );
      if (!selectedTemplate) {
        throw new Error('Please select a valid template.');
      }

      const templateName = String(selectedTemplate?.name || '').trim();
      if (!templateName) {
        throw new Error('Template name is missing.');
      }

      const language = getTemplateLanguageCode(selectedTemplate);
      const bodyVariableCount = extractTemplateVariableCount(selectedTemplate);
      const headerVariableCount = extractTemplateHeaderVariableCount(selectedTemplate);
      const bodyVariables = templateVariableValues
        .slice(0, bodyVariableCount)
        .map((value) => String(value || '').trim());
      const hasMissingBodyVariable =
        bodyVariableCount > 0 && bodyVariables.some((value) => !value);
      if (hasMissingBodyVariable) {
        throw new Error('Please fill all template variables.');
      }

      const headerVariables = templateHeaderVariableValues
        .slice(0, headerVariableCount)
        .map((value) => String(value || '').trim());
      const hasMissingHeaderVariable =
        headerVariableCount > 0 && headerVariables.some((value) => !value);
      if (hasMissingHeaderVariable) {
        throw new Error('Please fill all header variables.');
      }

      const templateComponents = [];
      const headerFormat = getTemplateHeaderFormat(selectedTemplate);
      if (templateRequiresHeaderMedia(selectedTemplate)) {
        const mediaUrl = String(templateHeaderMediaUrl || '').trim();
        if (!mediaUrl) {
          throw new Error(
            `This template requires a ${headerFormat.toLowerCase()} header URL.`
          );
        }
        if (!/^https?:\/\//i.test(mediaUrl)) {
          throw new Error('Header media URL must start with http:// or https://');
        }

        const mediaType = headerFormat.toLowerCase();
        templateComponents.push({
          type: 'HEADER',
          parameters: [
            {
              type: mediaType,
              [mediaType]: { link: mediaUrl }
            }
          ]
        });
      } else if (headerVariableCount > 0) {
        templateComponents.push({
          type: 'HEADER',
          parameters: headerVariables.map((value) => ({
            type: 'text',
            text: value
          }))
        });
      }

      if (bodyVariableCount > 0) {
        templateComponents.push({
          type: 'BODY',
          parameters: bodyVariables.map((value) => ({
            type: 'text',
            text: value
          }))
        });
      }

      setTemplateSending(true);
      setTemplateModalMessage('');

      const result = await whatsappService.sendTemplateMessage(
        resolvedTemplateTarget.contactPhone,
        templateName,
        language,
        bodyVariables,
        activeConversationId,
        templateComponents,
        {
          contactId: resolvedTemplateTarget?.contactId || '',
          contactName: resolvedTemplateTarget?.contactName || '',
          templateCategory: String(selectedTemplate?.category || '').trim()
        }
      );

      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to send template.');
      }

      setShowTemplateSendModal(false);
      setTemplateModalMessage('');
      if (typeof onTemplateSent === 'function') {
        onTemplateSent('Template sent successfully.', result);
      }
      if (typeof onTemplateModalClosed === 'function') {
        onTemplateModalClosed();
      }
    } catch (error) {
      setTemplateModalMessage(error?.message || 'Failed to send template.');
      setTemplateModalMessageTone('error');
    } finally {
      setTemplateSending(false);
    }
  };

  useEffect(() => {
    setShowTemplateSendModal(false);
    setTemplateModalMessage('');
    setTemplateModalMessageTone('info');
    setTemplateOptions([]);
    setSelectedTemplateKey('');
    setTemplateVariableValues([]);
    setTemplateHeaderVariableValues([]);
    setTemplateHeaderMediaUrl('');
  }, [selectedConversation?._id, templateTarget?.contactPhone, templateTarget?.contactId]);

  return {
    showTemplateSendModal,
    templateLoading,
    templateSending,
    templateOptions,
    selectedTemplateKey,
    templateVariableValues,
    templateHeaderVariableValues,
    templateHeaderMediaUrl,
    templateModalMessage,
    templateModalMessageTone,
    selectedTemplateOption,
    getTemplateCompositeKey,
    getTemplateLanguageCode,
    extractTemplateVariableCount,
    extractTemplateHeaderVariableCount,
    getTemplateHeaderFormat,
    templateRequiresHeaderMedia,
    openTemplateSendModal,
    closeTemplateSendModal,
    handleTemplateSelectionChange,
    handleTemplateVariableChange,
    handleTemplateHeaderVariableChange,
    handleTemplateHeaderMediaUrlChange,
    handleSendTemplate
  };
};
