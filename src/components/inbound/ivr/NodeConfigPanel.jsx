import React, { useEffect, useMemo, useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import apiService from '../../../services/api';
import './NodeConfigPanel.css';

const NodeConfigPanel = ({ node, onSave, onClose, onAutoSave, availableVoices }) => {
  const [config, setConfig] = useState({
    // Audio node fields
    mode: node?.data?.mode || 'tts',
    messageText: node?.data?.messageText || '',
    afterPlayback: node?.data?.afterPlayback || 'next',
    maxRetries: node?.data?.maxRetries || 3,
    timeoutSeconds: node?.data?.timeoutSeconds || 10,
    fallbackAudioNodeId: node?.data?.fallbackAudioNodeId || '',

    // Logic node fields (no audio)
    digit: node?.data?.digit || '1',
    label: node?.data?.label || '',
    action: node?.data?.action || 'transfer',
    destination: node?.data?.destination || '',
    maxAttempts: node?.data?.maxAttempts || 3,

    invalidInputMessage: node?.data?.invalidInputMessage || '',

    // Audio node references for logic nodes
    promptAudioNodeId: node?.data?.promptAudioNodeId || '',
    invalidAudioNodeId: node?.data?.invalidAudioNodeId || '',
    timeoutAudioNodeId: node?.data?.timeoutAudioNodeId || '',
    greetingAudioNodeId: node?.data?.greetingAudioNodeId || '',

    // Conditional and transfer fields
    condition: node?.data?.condition || 'business_hours',
    truePath: node?.data?.truePath || '',
    falsePath: node?.data?.falsePath || '',

    // Voicemail fields
    maxLength: node?.data?.maxLength || 60,
    transcribe: node?.data?.transcribe || true,
    storageRoute: node?.data?.storageRoute || '',
    mailbox: node?.data?.mailbox || 'general',

    // End node fields
    terminationType: node?.data?.terminationType || 'hangup',
    transferNumber: node?.data?.transferNumber || '',
    voicemailBox: node?.data?.voicemailBox || '',
    callbackDelay: node?.data?.callbackDelay || 15,
    maxCallbackAttempts: node?.data?.maxCallbackAttempts || 3,
    sendSurvey: node?.data?.sendSurvey || false,
    logCall: node?.data?.logCall || false,
    sendReceipt: node?.data?.sendReceipt || false,
    contactMethod: node?.data?.contactMethod || 'sms',

    // Legacy audio fields (for backward compatibility)
    voice: node?.data?.voice || 'en-GB-SoniaNeural',
    language: node?.data?.language || 'en-GB',
    audioUrl: node?.data?.audioUrl || '',
    audioAssetId: node?.data?.audioAssetId || '',

    // Preserve promptKey from node data
    promptKey: node?.data?.promptKey || ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const isInitialRender = React.useRef(true);
  const configRef = React.useRef(config);

  // Keep ref in sync for debounced saves
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Debounced auto-save effect
  useEffect(() => {
    // Skip initial render and only sync if something changed
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (onAutoSave && node?.id) {
        // Only save if the config has actually changed from the last saved state
        // (This is a simplified check, parent should also handle deduplication)
        onAutoSave(node.id, configRef.current);
      }
    }, 1500); // 1.5s debounce for production stability

    return () => clearTimeout(timer);
  }, [config, node?.id, onAutoSave]);

  const handleChange = (field, value) => {
    // Only update local state instantly
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Save on blur - prevents excessive socket emissions
  const handleBlur = (field) => {
    if (onAutoSave && node?.id) {
      onAutoSave(node.id, { [field]: config[field] });
    }
  };

  const handleSave = () => {
    onSave(node.id, config);
    onClose();
  };

  useEffect(() => {
    // Reset config only when switching to a different node (not when node.data changes during editing)
    setConfig({
      // Audio node fields
      mode: node?.data?.mode || 'tts',
      messageText: node?.data?.messageText || '',
      afterPlayback: node?.data?.afterPlayback || 'next',
      maxRetries: node?.data?.maxRetries || 3,
      timeoutSeconds: node?.data?.timeoutSeconds || 10,
      fallbackAudioNodeId: node?.data?.fallbackAudioNodeId || '',

      // Logic node fields (no audio)
      digit: node?.data?.digit || '1',
      label: node?.data?.label || '',
      action: node?.data?.action || 'transfer',
      destination: node?.data?.destination || '',
      maxAttempts: node?.data?.maxAttempts || 3,

      invalidInputMessage: node?.data?.invalidInputMessage || '',

      // Audio node references for logic nodes
      promptAudioNodeId: node?.data?.promptAudioNodeId || '',
      invalidAudioNodeId: node?.data?.invalidAudioNodeId || '',
      timeoutAudioNodeId: node?.data?.timeoutAudioNodeId || '',
      greetingAudioNodeId: node?.data?.greetingAudioNodeId || '',

      // Conditional and transfer fields
      condition: node?.data?.condition || 'business_hours',
      truePath: node?.data?.truePath || '',
      falsePath: node?.data?.falsePath || '',

      // Voicemail fields
      maxLength: node?.data?.maxLength || 60,
      transcribe: node?.data?.transcribe || true,
      storageRoute: node?.data?.storageRoute || '',
      mailbox: node?.data?.mailbox || 'general',

      // End node fields
      terminationType: node?.data?.terminationType || 'hangup',
      transferNumber: node?.data?.transferNumber || '',
      voicemailBox: node?.data?.voicemailBox || '',
      callbackDelay: node?.data?.callbackDelay || 15,
      maxCallbackAttempts: node?.data?.maxCallbackAttempts || 3,
      sendSurvey: node?.data?.sendSurvey || false,
      logCall: node?.data?.logCall || false,
      sendReceipt: node?.data?.sendReceipt || false,
      contactMethod: node?.data?.contactMethod || 'sms',

      // Legacy audio fields (for backward compatibility)
      voice: node?.data?.voice || 'en-GB-SoniaNeural',
      language: node?.data?.language || 'en-GB',
      audioUrl: node?.data?.audioUrl || '',
      audioAssetId: node?.data?.audioAssetId || '',

      // Preserve promptKey from node data
      promptKey: node?.data?.promptKey || ''
    });
  }, [node?.id]); // Only reset when node ID changes, not when node.data changes

  const voiceOptions = useMemo(() => ([
    { id: 'ta-IN-PallaviNeural', name: 'PallaviNeural (Female, Tamil)', language: 'ta-IN' },
    { id: 'ta-IN-ValluvarNeural', name: 'ValluvarNeural (Male, Tamil)', language: 'ta-IN' },
    { id: 'hi-IN-SwaraNeural', name: 'SwaraNeural (Female, Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-MadhurNeural', name: 'MadhurNeural (Male, Hindi)', language: 'hi-IN' },
    { id: 'en-GB-SoniaNeural', name: 'SoniaNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-RyanNeural', name: 'RyanNeural (Male, English UK)', language: 'en-GB' },
    { id: 'en-GB-LibbyNeural', name: 'LibbyNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-ThomasNeural', name: 'ThomasNeural (Male, English UK)', language: 'en-GB' }
  ]), []);

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

                    // Perform upload to backend with increased timeout
                    const response = await apiService.post('/ivr/audio/upload', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                      timeout: 120000 // Increase timeout to 120 seconds for large audio files
                    });

                    if (response.data.success) {
                      // Update config with permanent URL (this will trigger a debounced auto-save)
                      const updates = {
                        audioUrl: response.data.audioUrl,
                        audioAssetId: response.data.publicId
                      };
                      setConfig(prev => ({ ...prev, ...updates }));

                      // Explicitly save immediately after successful upload
                      if (onAutoSave) {
                        onAutoSave(node.id, updates);
                      }

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
                          if (config.audioAssetId) {
                            await apiService.deleteCustomAudio(config.audioAssetId);
                            console.log('✅ Audio deleted from Cloudinary:', config.audioAssetId);
                          }
                          
                          // Update local state to remove audio
                          const updates = {
                            audioUrl: null,
                            audioAssetId: null
                          };
                          setConfig(prev => ({ ...prev, ...updates }));
                          
                          // Save the changes immediately
                          if (onAutoSave) {
                            onAutoSave(node.id, updates);
                          }
                          
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
            onChange={(e) => handleChange('maxRetries', parseInt(e.target.value))}
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
            onChange={(e) => handleChange('timeoutSeconds', parseInt(e.target.value))}
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
        >
          <option value="">Select fallback audio node...</option>
          {/* This should be populated with available audio nodes */}
        </select>
        <small className="form-help">Audio node to play on error or timeout.</small>
      </div>
    </div>
  );

  const renderInputConfig = () => (
    <div className="config-section">
      <h4>Input Configuration</h4>
      <div className="form-group">
        <label>Prompt Message</label>
        <textarea
          value={config.text || ''}
          onChange={(e) => handleChange('text', e.target.value)}
          onBlur={() => handleBlur('text')}
          placeholder="e.g., Press 1 for Sales, 2 for Support..."
          rows={3}
        />
        <small className="form-help">Message to play to the caller before waiting for input.</small>
      </div>
      {renderVoiceSettings('text')}

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
          <option value="ai-assistant">Connect to AI Assistant</option>
        </select>
        <small className="form-help">What happens when the caller selects this option.</small>
      </div>

      <div className="form-group">
        <label>Destination</label>
        <input
          type="text"
          value={config.destination}
          onChange={(e) => handleChange('destination', e.target.value)}
          onBlur={() => handleBlur('destination')}
          placeholder="Phone number, queue ID, or node ID"
        />
        <small className="form-help">Where the call should be routed based on the action selected.</small>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Timeout (seconds)</label>
          <input
            type="number"
            value={config.timeout}
            onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
            onBlur={() => handleBlur('timeout')}
            min={5}
            max={30}
          />
          <small className="form-help">Time to wait for input.</small>
        </div>

        <div className="form-group">
          <label>Max Retries</label>
          <input
            type="number"
            value={config.maxRetries}
            onChange={(e) => handleChange('maxRetries', parseInt(e.target.value))}
            onBlur={() => handleBlur('maxRetries')}
            min={1}
            max={5}
          />
          <small className="form-help">How many times to retry on invalid input.</small>
        </div>
      </div>

      <div className="form-group">
        <label>Invalid Input Message</label>
        <input
          type="text"
          value={config.invalidInputMessage}
          onChange={(e) => handleChange('invalidInputMessage', e.target.value)}
          onBlur={() => handleBlur('invalidInputMessage')}
          placeholder="Invalid input. Please try again."
        />
      </div>
    </div>
  );

  const renderTransferConfig = () => (
    <div className="config-section">
      <h4>Transfer Configuration</h4>
      <div className="form-group">
        <label>Phone Number</label>
        <input
          type="tel"
          value={config.destination}
          onChange={(e) => handleChange('destination', e.target.value)}
          onBlur={() => handleBlur('destination')}
          placeholder="+1234567890"
        />
      </div>

      <div className="form-group">
        <label>Department/Label</label>
        <input
          type="text"
          value={config.label}
          onChange={(e) => handleChange('label', e.target.value)}
          onBlur={() => handleBlur('label')}
          placeholder="e.g., Sales, Support"
        />
      </div>
    </div>
  );

  const renderConditionalConfig = () => (
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
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>If True (Node ID)</label>
          <input
            type="text"
            value={config.truePath}
            onChange={(e) => handleChange('truePath', e.target.value)}
            onBlur={() => handleBlur('truePath')}
            placeholder="node_id_true"
          />
        </div>

        <div className="form-group">
          <label>If False (Node ID)</label>
          <input
            type="text"
            value={config.falsePath}
            onChange={(e) => handleChange('falsePath', e.target.value)}
            onBlur={() => handleBlur('falsePath')}
            placeholder="node_id_false"
          />
        </div>
      </div>
    </div>
  );

  const renderConfigByNodeType = () => {
    switch (node?.type) {
      case 'audio':
        return renderAudioConfig();
      case 'input':
        return (
          <div className="config-section">
            <h4>Input Configuration</h4>

            <div className="form-group">
              <label>Prompt Audio Node</label>
              <select
                value={config.promptAudioNodeId}
                onChange={(e) => handleChange('promptAudioNodeId', e.target.value)}
              >
                <option value="">Select audio node for prompt...</option>
                {/* This should be populated with available audio nodes */}
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
                <option value="ai-assistant">Connect to AI Assistant</option>
              </select>
              <small className="form-help">What happens when caller selects this option.</small>
            </div>

            <div className="form-group">
              <label>Destination</label>
              <input
                type="text"
                value={config.destination}
                onChange={(e) => handleChange('destination', e.target.value)}
                onBlur={() => handleBlur('destination')}
                placeholder="Phone number, queue ID, or node ID"
              />
              <small className="form-help">Where call should be routed based on action selected.</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Timeout (seconds)</label>
                <input
                  type="number"
                  value={config.timeoutSeconds}
                  onChange={(e) => handleChange('timeoutSeconds', parseInt(e.target.value))}
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
                  onChange={(e) => handleChange('maxAttempts', parseInt(e.target.value))}
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
              >
                <option value="">Select audio node for invalid input...</option>
                {/* This should be populated with available audio nodes */}
              </select>
              <small className="form-help">Audio node to play on invalid input.</small>
            </div>

            <div className="form-group">
              <label>Timeout Audio Node</label>
              <select
                value={config.timeoutAudioNodeId}
                onChange={(e) => handleChange('timeoutAudioNodeId', e.target.value)}
              >
                <option value="">Select audio node for timeout...</option>
                {/* This should be populated with available audio nodes */}
              </select>
              <small className="form-help">Audio node to play on timeout.</small>
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
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>If True (Node ID)</label>
                <input
                  type="text"
                  value={config.truePath}
                  onChange={(e) => handleChange('truePath', e.target.value)}
                  placeholder="node_id_true"
                />
              </div>

              <div className="form-group">
                <label>If False (Node ID)</label>
                <input
                  type="text"
                  value={config.falsePath}
                  onChange={(e) => handleChange('falsePath', e.target.value)}
                  placeholder="node_id_false"
                />
              </div>
            </div>
          </div>
        );
      case 'voicemail':
        return (
          <div className="config-section">
            <h4>Voicemail Configuration</h4>

            <div className="form-group">
              <label>Greeting Audio Node</label>
              <select
                value={config.greetingAudioNodeId}
                onChange={(e) => handleChange('greetingAudioNodeId', e.target.value)}
              >
                <option value="">Select audio node for greeting...</option>
                {/* This should be populated with available audio nodes */}
              </select>
              <small className="form-help">Audio node to play before recording.</small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Max Recording (seconds)</label>
                <input
                  type="number"
                  value={config.maxLength || 60}
                  onChange={(e) => handleChange('maxLength', parseInt(e.target.value))}
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
            <div className="form-row">
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
                <label>Fallback Node ID</label>
                <input
                  type="text"
                  value={config.fallbackNodeId || ''}
                  onChange={(e) => handleChange('fallbackNodeId', e.target.value)}
                  placeholder="node_id_fallback"
                />
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
                    onChange={(e) => handleChange('callbackDelay', parseInt(e.target.value))}
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
        <h3>Configure {node?.type} Node</h3>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="panel-content">
        {renderConfigByNodeType()}
      </div>

      <div className="panel-footer">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default NodeConfigPanel;
