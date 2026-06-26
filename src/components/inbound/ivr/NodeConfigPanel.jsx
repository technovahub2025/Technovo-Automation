import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import apiService from '../../../services/api';
import './NodeConfigPanel.css';

const getNodeField = (data, camelKey, snakeKey, fallback) => {
  if (!data || typeof data !== 'object') return fallback;
  if (data[camelKey] !== undefined && data[camelKey] !== null) return data[camelKey];
  if (snakeKey && data[snakeKey] !== undefined && data[snakeKey] !== null) return data[snakeKey];
  return fallback;
};

const buildInitialConfig = (node) => {
  const data = node?.data || {};
  return {
    mode: getNodeField(data, 'mode', null, 'tts'),
    messageText: getNodeField(data, 'messageText', null, getNodeField(data, 'text', null, '')),
    afterPlayback: getNodeField(data, 'afterPlayback', null, 'next'),
    maxRetries: getNodeField(data, 'maxRetries', 'max_retries', 3),
    timeoutSeconds: getNodeField(data, 'timeoutSeconds', 'timeout', 10),
    fallbackAudioNodeId: getNodeField(data, 'fallbackAudioNodeId', null, ''),
    digit: getNodeField(data, 'digit', null, '1'),
    label: getNodeField(data, 'label', null, ''),
    action: getNodeField(data, 'action', null, 'transfer'),
    destination: getNodeField(data, 'destination', null, ''),
    maxAttempts: getNodeField(data, 'maxAttempts', 'max_attempts', 3),
    invalidInputMessage: getNodeField(data, 'invalidInputMessage', null, ''),
    queueName: getNodeField(data, 'queueName', 'queue_name', ''),
    workflowSid: getNodeField(data, 'workflowSid', 'workflow_sid', ''),
    callerId: getNodeField(data, 'callerId', 'caller_id', ''),
    transferTimeout: getNodeField(data, 'transferTimeout', 'transfer_timeout', getNodeField(data, 'timeout', null, 30)),
    promptAudioNodeId: getNodeField(data, 'promptAudioNodeId', 'prompt_audio_node_id', ''),
    invalidAudioNodeId: getNodeField(data, 'invalidAudioNodeId', 'invalid_audio_node_id', ''),
    timeoutAudioNodeId: getNodeField(data, 'timeoutAudioNodeId', 'timeout_audio_node_id', ''),
    greetingAudioNodeId: getNodeField(data, 'greetingAudioNodeId', 'greeting_audio_node_id', ''),
    fallbackNodeId: getNodeField(data, 'fallbackNodeId', 'fallback_node_id', ''),
    condition: getNodeField(data, 'condition', null, 'business_hours'),
    variable: getNodeField(data, 'variable', null, ''),
    operator: getNodeField(data, 'operator', null, 'equals'),
    value: getNodeField(data, 'value', null, ''),
    businessStartHour: getNodeField(data, 'businessStartHour', 'business_start_hour', 9),
    businessEndHour: getNodeField(data, 'businessEndHour', 'business_end_hour', 18),
    businessTimezone: getNodeField(data, 'businessTimezone', 'business_timezone', ''),
    businessDays: getNodeField(data, 'businessDays', 'business_days', [1, 2, 3, 4, 5]),
    callerNumberVariable: getNodeField(data, 'callerNumberVariable', 'caller_number_variable', 'callerNumber'),
    unknownCallerValuesText: (() => {
      const raw = getNodeField(data, 'unknownCallerValues', 'unknown_caller_values', ['unknown', 'anonymous', 'private', 'restricted', 'unavailable']);
      return Array.isArray(raw) ? raw.join(', ') : String(raw || '');
    })(),
    premiumFlagVariable: getNodeField(data, 'premiumFlagVariable', 'premium_flag_variable', 'isPremium'),
    premiumTierVariable: getNodeField(data, 'premiumTierVariable', 'premium_tier_variable', 'customerTier'),
    premiumSegmentVariable: getNodeField(data, 'premiumSegmentVariable', 'premium_segment_variable', 'segment'),
    premiumTiersText: (() => {
      const raw = getNodeField(data, 'premiumTiers', 'premium_tiers', ['premium', 'vip']);
      return Array.isArray(raw) ? raw.join(', ') : String(raw || '');
    })(),
    truePath: getNodeField(data, 'truePath', 'true_path', ''),
    falsePath: getNodeField(data, 'falsePath', 'false_path', ''),
    numDigits: getNodeField(data, 'numDigits', 'num_digits', 1),
    maxLength: getNodeField(data, 'maxLength', 'max_length', 60),
    transcribe: getNodeField(data, 'transcribe', null, true),
    storageRoute: getNodeField(data, 'storageRoute', null, ''),
    mailbox: getNodeField(data, 'mailbox', null, 'general'),
    terminationType: getNodeField(data, 'terminationType', 'reason', 'hangup'),
    transferNumber: getNodeField(data, 'transferNumber', 'transfer_number', ''),
    voicemailBox: getNodeField(data, 'voicemailBox', 'voicemail_box', ''),
    callbackDelay: getNodeField(data, 'callbackDelay', 'callback_delay', 15),
    maxCallbackAttempts: getNodeField(data, 'maxCallbackAttempts', 'max_callback_attempts', 3),
    sendSurvey: getNodeField(data, 'sendSurvey', 'send_survey', false),
    logCall: getNodeField(data, 'logCall', 'log_data', false),
    sendReceipt: getNodeField(data, 'sendReceipt', 'send_receipt', false),
    contactMethod: getNodeField(data, 'contactMethod', 'contact_method', 'sms'),
    voice: getNodeField(data, 'voice', null, 'en-GB-SoniaNeural'),
    language: getNodeField(data, 'language', null, 'en-GB'),
    audioUrl: getNodeField(data, 'audioUrl', null, ''),
    audioPublicId: getNodeField(data, 'audioPublicId', 'audio_public_id', getNodeField(data, 'audioAssetId', 'audio_asset_id', '')),
    audioAssetId: getNodeField(data, 'audioAssetId', 'audio_asset_id', ''),
    promptKey: getNodeField(data, 'promptKey', null, ''),
    timezone: getNodeField(data, 'timezone', null, 'Asia/Kolkata'),
    promptText: getNodeField(data, 'promptText', 'prompt_text', ''),
    offerText: getNodeField(data, 'offerText', 'offer_text', ''),
    yesDigits: getNodeField(data, 'yesDigits', 'yes_digits', '1'),
    noDigits: getNodeField(data, 'noDigits', 'no_digits', '2'),
    slotDefinitionsText: (() => {
      const raw = getNodeField(data, 'slotDefinitions', 'slot_definitions', getNodeField(data, 'slots', null, []));
      return typeof raw === 'string' ? raw : JSON.stringify(Array.isArray(raw) ? raw : [], null, 2);
    })(),
    selectionVariable: getNodeField(data, 'selectionVariable', 'selection_variable', 'booking.selectedSlotKey'),
    suggestedSlotVariable: getNodeField(data, 'suggestedSlotVariable', 'suggested_slot_variable', 'booking.nextAvailableSlotKey'),
    bookingReferencePrefix: getNodeField(data, 'bookingReferencePrefix', 'booking_reference_prefix', 'BK'),
    tokenPrefix: getNodeField(data, 'tokenPrefix', 'token_prefix', 'T'),
    customerNameVariable: getNodeField(data, 'customerNameVariable', 'customer_name_variable', 'customerName'),
    customerPhoneVariable: getNodeField(data, 'customerPhoneVariable', 'customer_phone_variable', 'callerNumber'),
    customerEmailVariable: getNodeField(data, 'customerEmailVariable', 'customer_email_variable', 'customerEmail'),
    notesVariable: getNodeField(data, 'notesVariable', 'notes_variable', 'notes'),
    preventDuplicates: getNodeField(data, 'preventDuplicates', 'prevent_duplicates', true),
    customerRecipient: getNodeField(data, 'customerRecipient', 'customer_recipient', '{{callerNumber}}'),
    adminRecipient: getNodeField(data, 'adminRecipient', 'admin_recipient', ''),
    customerTemplateName: getNodeField(data, 'customerTemplateName', 'customer_template_name', ''),
    adminTemplateName: getNodeField(data, 'adminTemplateName', 'admin_template_name', ''),
    customerMessageText: getNodeField(data, 'customerMessageText', 'customer_message_text', ''),
    adminMessageText: getNodeField(data, 'adminMessageText', 'admin_message_text', ''),
    customerTemplateLanguage: getNodeField(data, 'customerTemplateLanguage', 'customer_template_language', 'en_US'),
    adminTemplateLanguage: getNodeField(data, 'adminTemplateLanguage', 'admin_template_language', 'en_US'),
    announcementText: getNodeField(data, 'announcementText', 'announcement_text', ''),
    bookingText: getNodeField(data, 'text', null, '')
  };
};

const extractCloudinaryPublicId = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const match =
      raw.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?([^?]+?)(?:\.[a-zA-Z0-9]+)?(?:\?|$)/) ||
      raw.match(/\/upload\/(?:v\d+\/)?([^?]+?)(?:\.[a-zA-Z0-9]+)?(?:\?|$)/);
    return match?.[1] || raw;
  }

  return raw;
};

const NodeConfigPanel = ({ node, workflowId, onSave, onClose, availableAudioNodes = [], availableVoices }) => {
  const [config, setConfig] = useState(() => buildInitialConfig(node));
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const parseNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const parseIntegerArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 6)
      .map((v) => Math.floor(v));
  };

  const handleChange = (field, value) => {
    // Only update local state instantly - no auto-save
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = () => {};

  const handleSave = async () => {
    const nextConfig = {
      ...config,
      action: config.action
    };

    if (node?.type === 'input') {
      const action = String(nextConfig.action || '').trim().toLowerCase();
      const normalizedDigit = String(
        nextConfig.digit ?? node?.data?.digit ?? ''
      ).trim();
      nextConfig.digit = normalizedDigit;
      nextConfig.destination = String(nextConfig.destination || '').trim();

      // Keep only action-relevant fields to avoid stale/legacy behavior.
      if (action !== 'queue') {
        nextConfig.queueName = '';
        nextConfig.workflowSid = '';
      }
      if (action !== 'transfer') {
        nextConfig.callerId = '';
        nextConfig.transferTimeout = 30;
      }
      if (action !== 'voicemail') {
        nextConfig.maxLength = 60;
        nextConfig.transcribe = true;
      } else {
        // Destination is not used for voicemail input actions.
        nextConfig.destination = '';
      }

      const normalizedPromptAudioNodeId = String(nextConfig.promptAudioNodeId || '').trim();
      if (!normalizedPromptAudioNodeId) {
        alert('Prompt Audio Node is required for User Input. Please select one audio node.');
        return;
      }
    }

    if (node?.type === 'conditional') {
      const toList = (text) =>
        String(text || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      nextConfig.unknownCallerValues = toList(nextConfig.unknownCallerValuesText);
      nextConfig.premiumTiers = toList(nextConfig.premiumTiersText);
      delete nextConfig.unknownCallerValuesText;
      delete nextConfig.premiumTiersText;
    }

    if (['availability_check', 'slot_offer', 'booking_confirm', 'booking_create', 'whatsapp_notify', 'handoff'].includes(node?.type)) {
      try {
        const parsedSlots = String(nextConfig.slotDefinitionsText || '').trim()
          ? JSON.parse(nextConfig.slotDefinitionsText)
          : [];
        nextConfig.slotDefinitions = Array.isArray(parsedSlots) ? parsedSlots : [];
      } catch (error) {
        alert(`Slot definitions must be valid JSON: ${error.message}`);
        return;
      }
      delete nextConfig.slotDefinitionsText;
    }

    if (node?.type === 'whatsapp_notify') {
      const normalizeTextValue = (value, fallback = '') => String(value ?? fallback).trim();
      const normalizedCustomerRecipient = normalizeTextValue(nextConfig.customerRecipient, '{{callerNumber}}');
      const normalizedAdminRecipient = normalizeTextValue(nextConfig.adminRecipient, '');
      const normalizedCustomerTemplateName = normalizeTextValue(nextConfig.customerTemplateName, '');
      const normalizedAdminTemplateName = normalizeTextValue(nextConfig.adminTemplateName, '');
      const normalizedCustomerMessageText = normalizeTextValue(nextConfig.customerMessageText, '');
      const normalizedAdminMessageText = normalizeTextValue(nextConfig.adminMessageText, '');
      const normalizedCustomerLanguage = normalizeTextValue(nextConfig.customerTemplateLanguage, 'en_US') || 'en_US';
      const normalizedAdminLanguage = normalizeTextValue(nextConfig.adminTemplateLanguage, 'en_US') || 'en_US';

      Object.assign(nextConfig, {
        customerRecipient: normalizedCustomerRecipient,
        customer_recipient: normalizedCustomerRecipient,
        adminRecipient: normalizedAdminRecipient,
        admin_recipient: normalizedAdminRecipient,
        customerTemplateName: normalizedCustomerTemplateName,
        customer_template_name: normalizedCustomerTemplateName,
        adminTemplateName: normalizedAdminTemplateName,
        admin_template_name: normalizedAdminTemplateName,
        customerMessageText: normalizedCustomerMessageText,
        customer_message_text: normalizedCustomerMessageText,
        adminMessageText: normalizedAdminMessageText,
        admin_message_text: normalizedAdminMessageText,
        customerTemplateLanguage: normalizedCustomerLanguage,
        customer_template_language: normalizedCustomerLanguage,
        adminTemplateLanguage: normalizedAdminLanguage,
        admin_template_language: normalizedAdminLanguage
      });
    }

    if (node?.type === 'audio' && nextConfig.mode === 'tts') {
      const previousMessageText = (node?.data?.messageText || node?.data?.text || '').trim();
      const previousVoice = node?.data?.voice || 'en-GB-SoniaNeural';
      const previousLanguage = node?.data?.language || 'en-GB';
      const nextMessageText = (nextConfig.messageText || '').trim();
      const shouldRegenerateAudio =
        Boolean(nextMessageText) &&
        (
          nextMessageText !== previousMessageText ||
          (nextConfig.voice || 'en-GB-SoniaNeural') !== previousVoice ||
          (nextConfig.language || 'en-GB') !== previousLanguage
        );

      if (shouldRegenerateAudio) {
        try {
          setIsSaving(true);
          const existingPublicId = extractCloudinaryPublicId(
            nextConfig.audioPublicId || nextConfig.audioAssetId || nextConfig.audioUrl
          );

          if (existingPublicId) {
            const deleteResponse = await apiService.deleteCustomAudioByPublicId(existingPublicId);
            if (!deleteResponse?.data?.success) {
              throw new Error(deleteResponse?.data?.error || 'Failed to delete old audio');
            }
          }

          const ttsResponse = await apiService.post('/ivr/tts/preview', {
            text: nextMessageText,
            voice: nextConfig.voice || 'en-GB-SoniaNeural',
            language: nextConfig.language || 'en-GB',
            workflowId,
            nodeId: node?.id
          });

          if (!ttsResponse?.data?.success || !ttsResponse?.data?.audioUrl || !ttsResponse?.data?.publicId) {
            throw new Error(ttsResponse?.data?.error || 'Failed to generate TTS audio');
          }

          nextConfig.audioUrl = ttsResponse.data.audioUrl;
          nextConfig.audioPublicId = ttsResponse.data.publicId;
          nextConfig.audioAssetId = ttsResponse.data.publicId;
        } catch (error) {
          alert(`Failed to refresh TTS audio: ${error.message}`);
          return;
        } finally {
          setIsSaving(false);
        }
      }
    }

    onSave(node.id, nextConfig);
    onClose();
  };

  useEffect(() => {
    setConfig(buildInitialConfig(node));
  // Reset only when the node identity changes; preserving in-progress edits on data-only refreshes is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]); // Only reset when node ID changes, not when node.data changes

  const fallbackVoiceOptions = useMemo(() => ([
    { id: 'ta-IN-PallaviNeural', name: 'PallaviNeural (Female, Tamil)', language: 'ta-IN' },
    { id: 'ta-IN-ValluvarNeural', name: 'ValluvarNeural (Male, Tamil)', language: 'ta-IN' },
    { id: 'hi-IN-SwaraNeural', name: 'SwaraNeural (Female, Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-MadhurNeural', name: 'MadhurNeural (Male, Hindi)', language: 'hi-IN' },
    { id: 'en-GB-SoniaNeural', name: 'SoniaNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-RyanNeural', name: 'RyanNeural (Male, English UK)', language: 'en-GB' },
    { id: 'en-GB-LibbyNeural', name: 'LibbyNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-ThomasNeural', name: 'ThomasNeural (Male, English UK)', language: 'en-GB' }
  ]), []);
  const voiceOptions = useMemo(() => {
    if (Array.isArray(availableVoices) && availableVoices.length > 0) {
      return availableVoices.map((voice) => ({
        id: voice.id || voice.value || voice.voiceId,
        name: voice.name || voice.label || voice.id || voice.value || voice.voiceId,
        language: voice.language || config.language || 'en-GB'
      })).filter((voice) => voice.id);
    }
    return fallbackVoiceOptions;
  }, [availableVoices, fallbackVoiceOptions, config.language]);

  const audioNodeOptions = useMemo(() => {
    return (availableAudioNodes || [])
      .filter((n) => n?.id && (n.type === 'audio' || n.type === 'greeting') && n.id !== node?.id)
      .map((n) => ({
        id: n.id,
        label: n.data?.label || n.data?.messageText || n.data?.text || `${n.type} (${n.id})`
      }));
  }, [availableAudioNodes, node?.id]);
  const noAudioNodesConfigured = audioNodeOptions.length === 0;
  const availableNodeOptions = useMemo(() => {
    return (availableAudioNodes || [])
      .filter((n) => n?.id && n.id !== node?.id)
      .map((n) => ({
        id: n.id,
        label: n.data?.label || n.data?.messageText || n.data?.text || `${n.type} (${n.id})`
      }));
  }, [availableAudioNodes, node?.id]);

  const renderAudioConfig = () => (
    <div className="config-section">
      <h4>Audio / Play Message Configuration</h4>

      <div className="form-group">
        <label>Mode</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="audio-mode"
              value="tts"
              checked={config.mode === 'tts'}
              onChange={(e) => handleChange('mode', e.target.value)}
            />
            Text to Speech (TTS)
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="audio-mode"
              value="upload"
              checked={config.mode === 'upload'}
              onChange={(e) => handleChange('mode', e.target.value)}
            />
            Upload Audio File
          </label>
        </div>
      </div>

      {config.mode === 'tts' && (
        <>
          <div className="form-group">
            <label>Message Text</label>
            <textarea
              value={config.messageText}
              onChange={(e) => handleChange('messageText', e.target.value)}
              onBlur={() => handleBlur('messageText')}
              placeholder="Enter message to be converted to speech..."
              rows={3}
            />
            <small className="form-help">This message will be converted to speech using the selected voice.</small>
          </div>

          <div className="form-group">
            <label>Voice</label>
            <select
              className="full-width"
              value={config.voice}
              onChange={(e) => {
                const nextVoice = e.target.value;
                const selected = voiceOptions.find(v => v.id === nextVoice);
                handleChange('voice', nextVoice);
                if (selected) {
                  handleChange('language', selected.language);
                }
              }}
              onBlur={() => handleBlur('voice')}
            >
              {voiceOptions.map(voice => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {config.mode === 'upload' && (
        <div className="form-group">
          <label>Audio File</label>
          <div className="upload-container">
            <input
              type="file"
              accept="audio/*"
              className="file-input"
              id="audio-upload-input"
              onChange={async (e) => {
                const file = e.target.files[0];
                if (file) {
                  // Validate file size (max 10MB)
                  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
                  if (file.size > maxSize) {
                    alert('Audio file is too large. Please choose a file smaller than 10MB.');
                    e.target.value = ''; // Clear the input
                    return;
                  }

                  // Validate file type
                  if (!file.type.startsWith('audio/')) {
                    alert('Please select a valid audio file.');
                    e.target.value = ''; // Clear the input
                    return;
                  }

                  try {
                    // Set loading state
                    setIsUploading(true);

                    // Create form data for upload
                    const formData = new FormData();
                    formData.append('audio', file);
                    formData.append('language', config.language || 'en-GB');
                    if (workflowId) {
                      formData.append('workflowId', workflowId);
                    }
                    if (node?.id) {
                      formData.append('nodeId', node.id);
                    }
                    const existingAudioAssetId = extractCloudinaryPublicId(config.audioAssetId || config.audioUrl);
                    if (existingAudioAssetId) {
                      formData.append('existingAudioAssetId', existingAudioAssetId);
                    }

                    // Perform upload to backend with increased timeout
                    const response = await apiService.post('/ivr/audio/upload', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      timeout: 120000 // Increase timeout to 120 seconds for large audio files
                    });

                    if (response.data.success) {
                      // Update config with permanent URL (this will trigger a debounced auto-save)
                      const updates = {
                        audioUrl: response.data.audioUrl,
                        audioPublicId: response.data.publicId,
                        audioAssetId: response.data.publicId
                      };
                      setConfig(prev => ({ ...prev, ...updates }));

                      // Explicitly save immediately after successful upload

                      console.log('✅ Audio uploaded and state updated:', response.data.audioUrl);
                    } else {
                      throw new Error(response.data.message || 'Upload failed');
                    }
                  } catch (error) {
                    console.error('❌ Audio upload failed:', error);
                    alert(`Failed to upload audio: ${error.message}`);
                  } finally {
                    setIsUploading(false);
                  }
                }
              }}
            />
            {isUploading && <div className="upload-spinner">Uploading...</div>}
            {config.audioUrl && (
              <div className="audio-preview">
                <div className="audio-player-container">
                  <audio controls src={config.audioUrl} />
                  <button
                    type="button"
                    className="delete-audio-btn"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this audio file? This action cannot be undone.')) {
                        try {
                          setIsUploading(true);
                          
                          // Delete from Cloudinary/backend
                          const assetToDelete = extractCloudinaryPublicId(
                            config.audioPublicId || config.audioAssetId || config.audioUrl
                          );
                          if (assetToDelete) {
                            await apiService.deleteCustomAudioByPublicId(assetToDelete);
                            console.log('Deleted audio from Cloudinary:', assetToDelete);
                          } else {
                            console.warn('No Cloudinary asset id resolved for delete request', {
                              audioAssetId: config.audioAssetId,
                              audioUrl: config.audioUrl
                            });
                          }
                          
                          // Update local state to remove audio
                          const updates = {
                            audioUrl: null,
                            audioPublicId: null,
                            audioAssetId: null
                          };
                          setConfig(prev => ({ ...prev, ...updates }));
                          
                          // Save the changes immediately
                          
                          console.log('✅ Audio file removed from node configuration');
                        } catch (error) {
                          console.error('❌ Failed to delete audio:', error);
                          alert(`Failed to delete audio: ${error.message}`);
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                    disabled={isUploading}
                    title="Delete audio file"
                  >
                    <Trash2 size={14} />
                    Delete Audio
                  </button>
                </div>
              </div>
            )}
          </div>
          <small className="form-help">Upload an audio file (MP3, WAV, etc.) to use instead of TTS.</small>
        </div>
      )}

      <div className="form-group">
        <label>After Playback</label>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="after-playback"
              value="next"
              checked={config.afterPlayback === 'next'}
              onChange={(e) => handleChange('afterPlayback', e.target.value)}
              onBlur={() => handleBlur('afterPlayback')}
            />
            Go to next node
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="after-playback"
              value="wait"
              checked={config.afterPlayback === 'wait'}
              onChange={(e) => handleChange('afterPlayback', e.target.value)}
              onBlur={() => handleBlur('afterPlayback')}
            />
            Wait for input
          </label>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Max Retries</label>
          <input
            type="number"
            value={config.maxRetries}
            onChange={(e) => handleChange('maxRetries', parseNumber(e.target.value))}
            min={0}
            max={10}
          />
          <small className="form-help">Maximum retry attempts on failure.</small>
        </div>

        <div className="form-group">
          <label>Timeout (seconds)</label>
          <input
            type="number"
            value={config.timeoutSeconds}
            onChange={(e) => handleChange('timeoutSeconds', parseNumber(e.target.value))}
            onBlur={() => handleBlur('timeoutSeconds')}
            min={1}
            max={60}
          />
          <small className="form-help">Timeout duration for audio playback.</small>
        </div>
      </div>

      <div className="form-group">
        <label>Fallback Audio Node</label>
        <select
          value={config.fallbackAudioNodeId}
          onChange={(e) => handleChange('fallbackAudioNodeId', e.target.value)}
          disabled={noAudioNodesConfigured}
        >
          <option value="">{noAudioNodesConfigured ? 'Create Audio / Play Message node first...' : 'Select fallback audio node...'}</option>
          {audioNodeOptions.map((audioNode) => (
            <option key={audioNode.id} value={audioNode.id}>
              {audioNode.label}
            </option>
          ))}
        </select>
        <small className="form-help">Audio node to play on error or timeout.</small>
      </div>
    </div>
  );

  const renderBookingConfig = (type) => {
    const isAvailability = type === 'availability_check';
    const isOffer = type === 'slot_offer';
    const isConfirm = type === 'booking_confirm';
    const isCreate = type === 'booking_create';
    const isNotify = type === 'whatsapp_notify';
    const isHandoff = type === 'handoff';

    return (
      <div className="config-section">
        <h4>{type.replace('_', ' ')} Configuration</h4>

        {isAvailability && (
          <>
            <div className="form-group">
              <label>Prompt Text</label>
              <textarea
                value={config.promptText || ''}
                onChange={(e) => handleChange('promptText', e.target.value)}
                rows={3}
                placeholder="Please choose a time slot."
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Timezone</label>
                <input
                  type="text"
                  value={config.timezone || 'Asia/Kolkata'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </div>
              <div className="form-group">
                <label>Digits to Read</label>
                <input
                  type="number"
                  value={config.numDigits || 1}
                  onChange={(e) => handleChange('numDigits', parseNumber(e.target.value, 1))}
                  min={1}
                  max={5}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Timeout (seconds)</label>
                <input
                  type="number"
                  value={config.timeoutSeconds || 10}
                  onChange={(e) => handleChange('timeoutSeconds', parseNumber(e.target.value, 10))}
                  min={1}
                  max={60}
                />
              </div>
              <div className="form-group">
                <label>Max Retries</label>
                <input
                  type="number"
                  value={config.maxRetries || 3}
                  onChange={(e) => handleChange('maxRetries', parseNumber(e.target.value, 3))}
                  min={1}
                  max={10}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Selection Variable</label>
              <input
                type="text"
                value={config.selectionVariable || 'booking.selectedSlotKey'}
                onChange={(e) => handleChange('selectionVariable', e.target.value)}
                placeholder="booking.selectedSlotKey"
              />
            </div>
            <div className="form-group">
              <label>Slot Definitions JSON</label>
              <textarea
                value={config.slotDefinitionsText || '[]'}
                onChange={(e) => handleChange('slotDefinitionsText', e.target.value)}
                rows={8}
                placeholder='[{"key":"slot_1","label":"4:00 PM","startTime":"16:00","endTime":"16:30","capacity":5,"digit":"1","order":1,"active":true}]'
              />
              <small className="form-help">Provide a JSON array of slot objects. Each object may include key, label, startTime, endTime, capacity, digit, order, and active.</small>
            </div>
          </>
        )}

        {isOffer && (
          <>
            <div className="form-group">
              <label>Prompt Text</label>
              <textarea
                value={config.promptText || ''}
                onChange={(e) => handleChange('promptText', e.target.value)}
                rows={2}
                placeholder="The selected slot is full."
              />
            </div>
            <div className="form-group">
              <label>Offer Text</label>
              <textarea
                value={config.offerText || ''}
                onChange={(e) => handleChange('offerText', e.target.value)}
                rows={2}
                placeholder="Would you like to book the next available slot?"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Yes Digits</label>
                <input
                  type="text"
                  value={config.yesDigits || '1'}
                  onChange={(e) => handleChange('yesDigits', e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="form-group">
                <label>No Digits</label>
                <input
                  type="text"
                  value={config.noDigits || '2'}
                  onChange={(e) => handleChange('noDigits', e.target.value)}
                  placeholder="2"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Suggested Slot Variable</label>
              <input
                type="text"
                value={config.suggestedSlotVariable || 'booking.nextAvailableSlotKey'}
                onChange={(e) => handleChange('suggestedSlotVariable', e.target.value)}
                placeholder="booking.nextAvailableSlotKey"
              />
            </div>
          </>
        )}

        {isConfirm && (
          <>
            <div className="form-group">
              <label>Prompt Text</label>
              <textarea
                value={config.promptText || ''}
                onChange={(e) => handleChange('promptText', e.target.value)}
                rows={2}
                placeholder="Would you like to confirm this booking?"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Yes Digits</label>
                <input
                  type="text"
                  value={config.yesDigits || '1'}
                  onChange={(e) => handleChange('yesDigits', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>No Digits</label>
                <input
                  type="text"
                  value={config.noDigits || '2'}
                  onChange={(e) => handleChange('noDigits', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {isCreate && (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Booking Reference Prefix</label>
                <input
                  type="text"
                  value={config.bookingReferencePrefix || 'BK'}
                  onChange={(e) => handleChange('bookingReferencePrefix', e.target.value)}
                  placeholder="BK"
                />
              </div>
              <div className="form-group">
                <label>Token Prefix</label>
                <input
                  type="text"
                  value={config.tokenPrefix || 'T'}
                  onChange={(e) => handleChange('tokenPrefix', e.target.value)}
                  placeholder="T"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Name Variable</label>
                <input
                  type="text"
                  value={config.customerNameVariable || 'customerName'}
                  onChange={(e) => handleChange('customerNameVariable', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Customer Phone Variable</label>
                <input
                  type="text"
                  value={config.customerPhoneVariable || 'callerNumber'}
                  onChange={(e) => handleChange('customerPhoneVariable', e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Email Variable</label>
                <input
                  type="text"
                  value={config.customerEmailVariable || 'customerEmail'}
                  onChange={(e) => handleChange('customerEmailVariable', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Notes Variable</label>
                <input
                  type="text"
                  value={config.notesVariable || 'notes'}
                  onChange={(e) => handleChange('notesVariable', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Prevent Duplicate Booking</label>
              <select
                value={config.preventDuplicates ? 'yes' : 'no'}
                onChange={(e) => handleChange('preventDuplicates', e.target.value === 'yes')}
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </div>
          </>
        )}

        {isNotify && (
          <>
            <div className="form-group">
              <label>Customer Recipient</label>
              <input
                type="text"
                value={config.customerRecipient || '{{callerNumber}}'}
                onChange={(e) => handleChange('customerRecipient', e.target.value)}
                placeholder="{{callerNumber}}"
              />
            </div>
            <div className="form-group">
              <label>Admin Recipient</label>
              <input
                type="text"
                value={config.adminRecipient || ''}
                onChange={(e) => handleChange('adminRecipient', e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Customer Template Name</label>
                <input
                  type="text"
                  value={config.customerTemplateName || ''}
                  onChange={(e) => handleChange('customerTemplateName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Customer Language</label>
                <input
                  type="text"
                  value={config.customerTemplateLanguage || 'en_US'}
                  onChange={(e) => handleChange('customerTemplateLanguage', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Customer Message Text</label>
              <textarea
                value={config.customerMessageText || ''}
                onChange={(e) => handleChange('customerMessageText', e.target.value)}
                rows={2}
                placeholder="Your booking has been confirmed."
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Admin Template Name</label>
                <input
                  type="text"
                  value={config.adminTemplateName || ''}
                  onChange={(e) => handleChange('adminTemplateName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Admin Language</label>
                <input
                  type="text"
                  value={config.adminTemplateLanguage || 'en_US'}
                  onChange={(e) => handleChange('adminTemplateLanguage', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Admin Message Text</label>
              <textarea
                value={config.adminMessageText || ''}
                onChange={(e) => handleChange('adminMessageText', e.target.value)}
                rows={2}
                placeholder="New booking confirmed."
              />
            </div>
          </>
        )}

        {isHandoff && (
          <>
            <div className="form-group">
              <label>Destination Number</label>
              <input
                type="tel"
                value={config.destination || ''}
                onChange={(e) => handleChange('destination', e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Caller ID</label>
                <input
                  type="text"
                  value={config.callerId || ''}
                  onChange={(e) => handleChange('callerId', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Timeout (seconds)</label>
                <input
                  type="number"
                  value={config.timeout || 30}
                  onChange={(e) => handleChange('timeout', parseNumber(e.target.value, 30))}
                  min={10}
                  max={120}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Announcement Text</label>
              <textarea
                value={config.announcementText || ''}
                onChange={(e) => handleChange('announcementText', e.target.value)}
                rows={2}
                placeholder="Connecting you now."
              />
            </div>
          </>
        )}

      </div>
    );
  };

  const renderConfigByNodeType = () => {
    switch (node?.type) {
      case 'audio':
        return renderAudioConfig();
      case 'availability_check':
      case 'slot_offer':
      case 'booking_confirm':
      case 'booking_create':
      case 'whatsapp_notify':
      case 'handoff':
        return renderBookingConfig(node?.type);
      case 'input':
        return (
          <div className="config-section">
            <h4>Input Configuration</h4>
            <small className="form-help">
              Audio selections below are config references only. You do not need to connect edge lines to these audio nodes.
            </small>

            <div className="form-group">
              <label>Prompt Audio Node *</label>
              <select
                value={config.promptAudioNodeId}
                onChange={(e) => handleChange('promptAudioNodeId', e.target.value)}
                disabled={noAudioNodesConfigured}
              >
                <option value="">{noAudioNodesConfigured ? 'Create Audio / Play Message node first...' : 'Select audio node for prompt...'}</option>
                {audioNodeOptions.map((audioNode) => (
                  <option key={audioNode.id} value={audioNode.id}>
                    {audioNode.label}
                  </option>
                ))}
              </select>
              <small className="form-help">Audio node to play for main prompt.</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Digit</label>
                <input
                  type="text"
                  value={config.digit}
                  onChange={(e) => handleChange('digit', e.target.value)}
                  onBlur={() => handleBlur('digit')}
                  placeholder="1-9, 0, *, #"
                  maxLength={1}
                />
                <small className="form-help">The digit callers should press to select this option.</small>
              </div>
              <div className="form-group">
                <label>Digits to Capture</label>
                <input
                  type="number"
                  value={config.numDigits || 1}
                  onChange={(e) => handleChange('numDigits', parseNumber(e.target.value, 1))}
                  min={1}
                  max={10}
                />
                <small className="form-help">How many key presses to collect in the gather.</small>
              </div>
            </div>

            <div className="form-group">
              <label>Label</label>
              <input
                type="text"
                value={config.label}
                onChange={(e) => handleChange('label', e.target.value)}
                onBlur={() => handleBlur('label')}
                placeholder="e.g., Customer Support"
              />
              <small className="form-help">Display name for this menu option.</small>
            </div>

            <div className="form-group">
              <label>Action</label>
              <select
                value={config.action}
                onChange={(e) => handleChange('action', e.target.value)}
              >
                <option value="transfer">Transfer Call</option>
                <option value="queue">Add to Queue</option>
                <option value="voicemail">Send to Voicemail</option>
                <option value="submenu">Go to Sub-Menu</option>
              
              </select>
              <small className="form-help">What happens when caller selects this option.</small>
            </div>

            {config.action !== 'voicemail' && (
              <div className="form-group">
                <label>
                  {config.action === 'submenu'
                    ? 'Sub-Menu Node ID'
                    : config.action === 'queue'
                      ? 'Queue Name'
                      : 'Destination'}
                </label>

                {config.action === 'submenu' ? (
                  <select
                    value={config.destination || ''}
                    onChange={(e) => handleChange('destination', e.target.value)}
                  >
                    <option value="">Select target node...</option>
                    {availableNodeOptions.map((targetNode) => (
                      <option key={targetNode.id} value={targetNode.id}>
                        {targetNode.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={config.destination}
                    onChange={(e) => handleChange('destination', e.target.value)}
                    onBlur={() => handleBlur('destination')}
                    placeholder={config.action === 'queue' ? 'General' : 'Phone number (+1234567890)'}
                  />
                )}

                <small className="form-help">
                  {config.action === 'submenu'
                    ? 'Node ID to redirect to when no matching edge is used.'
                    : config.action === 'queue'
                      ? 'Queue to enqueue when no matching edge is used.'
                      : 'Phone number to dial when no matching edge is used.'}
                </small>
              </div>
            )}

            {config.action === 'queue' && (
              <div className="form-group">
                <label>Workflow SID (optional)</label>
                <input
                  type="text"
                  value={config.workflowSid || ''}
                  onChange={(e) => handleChange('workflowSid', e.target.value)}
                  placeholder="WWxxxxxx"
                />
                <small className="form-help">Used only when integrating TaskRouter workflows.</small>
              </div>
            )}

            {config.action === 'transfer' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Caller ID (optional)</label>
                  <input
                    type="text"
                    value={config.callerId || ''}
                    onChange={(e) => handleChange('callerId', e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                <div className="form-group">
                  <label>Dial Timeout (seconds)</label>
                  <input
                    type="number"
                    value={config.transferTimeout || 30}
                    onChange={(e) => handleChange('transferTimeout', parseNumber(e.target.value, 30))}
                    min={5}
                    max={60}
                  />
                </div>
              </div>
            )}

            {config.action === 'voicemail' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Max Recording (seconds)</label>
                  <input
                    type="number"
                    value={config.maxLength || 60}
                    onChange={(e) => handleChange('maxLength', parseNumber(e.target.value, 60))}
                    min={10}
                    max={300}
                  />
                </div>
                <div className="form-group">
                  <label>Transcription</label>
                  <select
                    value={config.transcribe ? 'yes' : 'no'}
                    onChange={(e) => handleChange('transcribe', e.target.value === 'yes')}
                  >
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Timeout (seconds)</label>
                <input
                  type="number"
                  value={config.timeoutSeconds}
                  onChange={(e) => handleChange('timeoutSeconds', parseNumber(e.target.value))}
                  min={5}
                  max={30}
                />
                <small className="form-help">Time to wait for input.</small>
              </div>

              <div className="form-group">
                <label>Max Attempts</label>
                <input
                  type="number"
                  value={config.maxAttempts}
                  onChange={(e) => handleChange('maxAttempts', parseNumber(e.target.value))}
                  min={1}
                  max={5}
                />
                <small className="form-help">How many times to retry on invalid input.</small>
              </div>
            </div>

            <div className="form-group">
              <label>Invalid Input Audio Node</label>
              <select
                value={config.invalidAudioNodeId}
                onChange={(e) => handleChange('invalidAudioNodeId', e.target.value)}
                disabled={noAudioNodesConfigured}
              >
                <option value="">{noAudioNodesConfigured ? 'Create Audio / Play Message node first...' : 'Select audio node for invalid input...'}</option>
                {audioNodeOptions.map((audioNode) => (
                  <option key={audioNode.id} value={audioNode.id}>
                    {audioNode.label}
                  </option>
                ))}
              </select>
              <small className="form-help">Config reference for invalid input retry audio.</small>
            </div>

            <div className="form-group">
              <label>Timeout Audio Node</label>
              <select
                value={config.timeoutAudioNodeId}
                onChange={(e) => handleChange('timeoutAudioNodeId', e.target.value)}
                disabled={noAudioNodesConfigured}
              >
                <option value="">{noAudioNodesConfigured ? 'Create Audio / Play Message node first...' : 'Select audio node for timeout...'}</option>
                {audioNodeOptions.map((audioNode) => (
                  <option key={audioNode.id} value={audioNode.id}>
                    {audioNode.label}
                  </option>
                ))}
              </select>
              <small className="form-help">Config reference for timeout retry audio.</small>
            </div>
          </div>
        );
      case 'transfer':
        return (
          <div className="config-section">
            <h4>Transfer Configuration</h4>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={config.destination}
                onChange={(e) => handleChange('destination', e.target.value)}
                placeholder="+1234567890"
              />
            </div>

            <div className="form-group">
              <label>Department/Label</label>
              <input
                type="text"
                value={config.label}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="e.g., Sales, Support"
              />
            </div>
          </div>
        );
      case 'conditional':
        return (
          <div className="config-section">
            <h4>Conditional Logic</h4>
            <div className="form-group">
              <label>Condition</label>
              <select
                value={config.condition}
                onChange={(e) => handleChange('condition', e.target.value)}
              >
                <option value="business_hours">Business Hours</option>
                <option value="caller_id_known">Known Caller ID</option>
                <option value="premium_customer">Premium Customer</option>
                <option value="custom">Custom Expression</option>
              </select>
              <small className="form-help">Choose a preset condition or switch to custom expression.</small>
            </div>

            {config.condition === 'business_hours' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Business Start Hour</label>
                    <input
                      type="number"
                      value={config.businessStartHour ?? 9}
                      onChange={(e) => handleChange('businessStartHour', parseNumber(e.target.value, 9))}
                      min={0}
                      max={23}
                    />
                  </div>
                  <div className="form-group">
                    <label>Business End Hour</label>
                    <input
                      type="number"
                      value={config.businessEndHour ?? 18}
                      onChange={(e) => handleChange('businessEndHour', parseNumber(e.target.value, 18))}
                      min={0}
                      max={23}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Business Timezone (IANA)</label>
                  <input
                    type="text"
                    value={config.businessTimezone || ''}
                    onChange={(e) => handleChange('businessTimezone', e.target.value)}
                    placeholder="e.g., America/New_York"
                  />
                  <small className="form-help">Leave blank to use server timezone.</small>
                </div>

                <div className="form-group">
                  <label>Business Days</label>
                  <div className="checkbox-group">
                    {[
                      { value: 0, label: 'Sun' },
                      { value: 1, label: 'Mon' },
                      { value: 2, label: 'Tue' },
                      { value: 3, label: 'Wed' },
                      { value: 4, label: 'Thu' },
                      { value: 5, label: 'Fri' },
                      { value: 6, label: 'Sat' }
                    ].map((day) => {
                      const selectedDays = new Set(parseIntegerArray(config.businessDays));
                      const checked = selectedDays.has(day.value);
                      return (
                        <label key={day.value} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(parseIntegerArray(config.businessDays));
                              if (e.target.checked) next.add(day.value);
                              else next.delete(day.value);
                              handleChange('businessDays', Array.from(next).sort((a, b) => a - b));
                            }}
                          />
                          {day.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {config.condition === 'caller_id_known' && (
              <>
                <div className="form-group">
                  <label>Caller Variable</label>
                  <input
                    type="text"
                    value={config.callerNumberVariable || 'callerNumber'}
                    onChange={(e) => handleChange('callerNumberVariable', e.target.value)}
                    placeholder="callerNumber"
                  />
                  <small className="form-help">Execution variable to read caller identity from.</small>
                </div>
                <div className="form-group">
                  <label>Unknown Caller Values</label>
                  <input
                    type="text"
                    value={config.unknownCallerValuesText || ''}
                    onChange={(e) => handleChange('unknownCallerValuesText', e.target.value)}
                    placeholder="unknown, anonymous, private, restricted, unavailable"
                  />
                  <small className="form-help">Comma-separated values treated as unknown caller IDs.</small>
                </div>
              </>
            )}

            {config.condition === 'premium_customer' && (
              <>
                <div className="form-group">
                  <label>Premium Flag Variable</label>
                  <input
                    type="text"
                    value={config.premiumFlagVariable || 'isPremium'}
                    onChange={(e) => handleChange('premiumFlagVariable', e.target.value)}
                    placeholder="isPremium"
                  />
                  <small className="form-help">Boolean variable that marks premium caller status.</small>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tier Variable</label>
                    <input
                      type="text"
                      value={config.premiumTierVariable || 'customerTier'}
                      onChange={(e) => handleChange('premiumTierVariable', e.target.value)}
                      placeholder="customerTier"
                    />
                  </div>
                  <div className="form-group">
                    <label>Segment Variable</label>
                    <input
                      type="text"
                      value={config.premiumSegmentVariable || 'segment'}
                      onChange={(e) => handleChange('premiumSegmentVariable', e.target.value)}
                      placeholder="segment"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Premium Tier Values</label>
                  <input
                    type="text"
                    value={config.premiumTiersText || ''}
                    onChange={(e) => handleChange('premiumTiersText', e.target.value)}
                    placeholder="premium, vip"
                  />
                  <small className="form-help">Comma-separated values treated as premium tiers.</small>
                </div>
              </>
            )}

            {config.condition === 'custom' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Variable</label>
                    <input
                      type="text"
                      value={config.variable || ''}
                      onChange={(e) => handleChange('variable', e.target.value)}
                      placeholder="customerTier"
                    />
                  </div>
                  <div className="form-group">
                    <label>Operator</label>
                    <select
                      value={config.operator || 'equals'}
                      onChange={(e) => handleChange('operator', e.target.value)}
                    >
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                      <option value="contains">Contains</option>
                      <option value="greater_than">Greater Than</option>
                      <option value="less_than">Less Than</option>
                      <option value="exists">Exists</option>
                    </select>
                  </div>
                </div>
                {config.operator !== 'exists' && (
                  <div className="form-group">
                    <label>Value</label>
                    <input
                      type="text"
                      value={config.value || ''}
                      onChange={(e) => handleChange('value', e.target.value)}
                      placeholder="premium"
                    />
                  </div>
                )}
                <small className="form-help">Custom mode routes by variable/operator/value evaluation in backend.</small>
              </>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>If True</label>
                <select
                  value={config.truePath}
                  onChange={(e) => handleChange('truePath', e.target.value)}
                >
                  <option value="">Select target node...</option>
                  {availableNodeOptions.map((targetNode) => (
                    <option key={targetNode.id} value={targetNode.id}>
                      {targetNode.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>If False</label>
                <select
                  value={config.falsePath}
                  onChange={(e) => handleChange('falsePath', e.target.value)}
                >
                  <option value="">Select target node...</option>
                  {availableNodeOptions.map((targetNode) => (
                    <option key={targetNode.id} value={targetNode.id}>
                      {targetNode.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      case 'voicemail':
        return (
          <div className="config-section voicemail-config-section">
            <h4>Voicemail Configuration</h4>

            <div className="form-group">
              <label>Greeting Audio Node</label>
              <select
                value={config.greetingAudioNodeId}
                onChange={(e) => handleChange('greetingAudioNodeId', e.target.value)}
                disabled={noAudioNodesConfigured}
              >
                <option value="">{noAudioNodesConfigured ? 'Create Audio / Play Message node first...' : 'Select audio node for greeting...'}</option>
                {audioNodeOptions.map((audioNode) => (
                  <option key={audioNode.id} value={audioNode.id}>
                    {audioNode.label}
                  </option>
                ))}
              </select>
              <small className="form-help">Audio node to play before recording.</small>
            </div>

            <div className="form-row voicemail-row-stacked">
              <div className="form-group">
                <label>Max Recording (seconds)</label>
                <input
                  type="number"
                  value={config.maxLength || 60}
                  onChange={(e) => handleChange('maxLength', parseNumber(e.target.value))}
                  min={10}
                  max={300}
                />
              </div>
              <div className="form-group">
                <label>Storage Route</label>
                <input
                  type="text"
                  value={config.storageRoute || ''}
                  onChange={(e) => handleChange('storageRoute', e.target.value)}
                  placeholder="e.g., s3://bucket/path or /ivr/voicemail"
                />
              </div>
            </div>
            <div className="form-row voicemail-row-inline">
              <div className="form-group">
                <label>Transcription</label>
                <select
                  value={config.transcribe ? 'yes' : 'no'}
                  onChange={(e) => handleChange('transcribe', e.target.value === 'yes')}
                >
                  <option value="yes">Enabled</option>
                  <option value="no">Disabled</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fallback Node</label>
                <select
                  value={config.fallbackNodeId || ''}
                  onChange={(e) => handleChange('fallbackNodeId', e.target.value)}
                >
                  <option value="">No fallback node</option>
                  {availableNodeOptions.map((targetNode) => (
                    <option key={targetNode.id} value={targetNode.id}>
                      {targetNode.label}
                    </option>
                  ))}
                </select>
                <small className="form-help">
                  Used when no outgoing edge matches voicemail completion status.
                </small>
              </div>
            </div>
          </div>
        );
      case 'end':
        return (
          <div className="config-section">
            <h4>End Call Configuration</h4>
            <div className="form-group">
              <label>Call Termination</label>
              <select
                value={config.terminationType || 'hangup'}
                onChange={(e) => handleChange('terminationType', e.target.value)}
              >
                <option value="hangup">Hang Up Call</option>
                <option value="transfer">Transfer to Operator</option>
                <option value="voicemail">Send to Voicemail</option>
                <option value="callback">Schedule Callback</option>
              </select>
              <small className="form-help">What happens after workflow ends.</small>
            </div>

            {config.terminationType === 'transfer' && (
              <div className="form-group">
                <label>Transfer Number</label>
                <input
                  type="tel"
                  value={config.transferNumber || ''}
                  onChange={(e) => handleChange('transferNumber', e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            )}

            {config.terminationType === 'voicemail' && (
              <div className="form-group">
                <label>Voicemail Box</label>
                <input
                  type="text"
                  value={config.voicemailBox || ''}
                  onChange={(e) => handleChange('voicemailBox', e.target.value)}
                  placeholder="general"
                />
              </div>
            )}

            {config.terminationType === 'callback' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Callback Delay (minutes)</label>
                  <input
                    type="number"
                    value={config.callbackDelay || 15}
                    onChange={(e) => handleChange('callbackDelay', parseNumber(e.target.value))}
                    min={1}
                    max={10}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Post-Call Actions</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.sendSurvey || false}
                    onChange={(e) => handleChange('sendSurvey', e.target.checked)}
                  />
                  Send Satisfaction Survey
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.logCall || false}
                    onChange={(e) => handleChange('logCall', e.target.checked)}
                  />
                  Log Call Details
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.sendReceipt || false}
                    onChange={(e) => handleChange('sendReceipt', e.target.checked)}
                  />
                  Send Call Receipt
                </label>
              </div>
            </div>

            {(config.sendSurvey || config.sendReceipt) && (
              <div className="form-group">
                <label>Contact Method</label>
                <select
                  value={config.contactMethod || 'sms'}
                  onChange={(e) => handleChange('contactMethod', e.target.value)}
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="both">Both SMS and Email</option>
                </select>
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="config-section">
            <p>No configuration available for {node?.type} nodes.</p>
          </div>
        );
    }
  };

  return (
    <div className="node-config-panel">
      <div className="panel-header">
        <h3>Configure {(node?.type || 'node').replace('_', ' ')} Node</h3>
        <button type="button" className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="panel-content">
        {renderConfigByNodeType()}
      </div>

      <div className="panel-footer">
        <button type="button" className="node-config-action node-config-cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="node-config-action node-config-save-btn"
          onClick={handleSave}
          disabled={isSaving || isUploading}
        >
          <Save size={16} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default NodeConfigPanel;



