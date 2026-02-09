import React, { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import './NodeConfigPanel.css';

const NodeConfigPanel = ({ node, onSave, onClose, onAutoSave, availableVoices }) => {
  const [config, setConfig] = useState({
    text: node?.data?.text || '',
    message: node?.data?.message || '',
    voice: node?.data?.voice || 'en-GB-SoniaNeural',
    language: node?.data?.language || 'en-GB',
    digit: node?.data?.digit || '1',
    label: node?.data?.label || '',
    action: node?.data?.action || 'transfer',
    destination: node?.data?.destination || '',
    timeout: node?.data?.timeout || 10,
    maxRetries: node?.data?.maxRetries || 3,
    invalidInputMessage: node?.data?.invalidInputMessage || '',
    condition: node?.data?.condition || 'business_hours',
    truePath: node?.data?.truePath || '',
    falsePath: node?.data?.falsePath || '',
    audioUrl: node?.data?.audioUrl || '',
    audioAssetId: node?.data?.audioAssetId || '',
    maxLength: node?.data?.maxLength || 60,
    transcribe: node?.data?.transcribe || true,
    storageRoute: node?.data?.storageRoute || '',
    fallbackNodeId: node?.data?.fallbackNodeId || '',
    repeatType: node?.data?.repeatType || 'prompt',
    customRepeatMessage: node?.data?.customRepeatMessage || '',
    maxRepeats: node?.data?.maxRepeats || 3,
    repeatTrigger: node?.data?.repeatTrigger || 'any',
    repeatMessage: node?.data?.repeatMessage || '',
    terminationType: node?.data?.terminationType || 'hangup',
    transferNumber: node?.data?.transferNumber || '',
    voicemailBox: node?.data?.voicemailBox || '',
    callbackDelay: node?.data?.callbackDelay || 15,
    maxCallbackAttempts: node?.data?.maxCallbackAttempts || 3,
    sendSurvey: node?.data?.sendSurvey || false,
    logCall: node?.data?.logCall || false,
    sendReceipt: node?.data?.sendReceipt || false,
    contactMethod: node?.data?.contactMethod || 'sms',
    // Preserve promptKey from node data
    promptKey: node?.data?.promptKey || ''
  });

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(node.id, config);
    onClose();
  };

  useEffect(() => {
    if (!onAutoSave || !node?.id) return;
    const timer = setTimeout(() => {
      onAutoSave(node.id, config);
    }, 800);
    return () => clearTimeout(timer);
  }, [config, node?.id, onAutoSave]);

  useEffect(() => {
    // Reset config when node changes
    setConfig({
      text: node?.data?.text || '',
      message: node?.data?.message || '',
      voice: node?.data?.voice || 'en-GB-SoniaNeural',
      language: node?.data?.language || 'en-GB',
      digit: node?.data?.digit || '1',
      label: node?.data?.label || '',
      action: node?.data?.action || 'transfer',
      destination: node?.data?.destination || '',
      timeout: node?.data?.timeout || 10,
      maxRetries: node?.data?.maxRetries || 3,
      invalidInputMessage: node?.data?.invalidInputMessage || '',
      condition: node?.data?.condition || 'business_hours',
      truePath: node?.data?.truePath || '',
      falsePath: node?.data?.falsePath || '',
      audioUrl: node?.data?.audioUrl || '',
      audioAssetId: node?.data?.audioAssetId || '',
      maxLength: node?.data?.maxLength || 60,
      transcribe: node?.data?.transcribe || true,
      storageRoute: node?.data?.storageRoute || '',
      fallbackNodeId: node?.data?.fallbackNodeId || '',
      repeatType: node?.data?.repeatType || 'prompt',
      customRepeatMessage: node?.data?.customRepeatMessage || '',
      maxRepeats: node?.data?.maxRepeats || 3,
      repeatTrigger: node?.data?.repeatTrigger || 'any',
      repeatMessage: node?.data?.repeatMessage || '',
      terminationType: node?.data?.terminationType || 'hangup',
      transferNumber: node?.data?.transferNumber || '',
      voicemailBox: node?.data?.voicemailBox || '',
      callbackDelay: node?.data?.callbackDelay || 15,
      maxCallbackAttempts: node?.data?.maxCallbackAttempts || 3,
      sendSurvey: node?.data?.sendSurvey || false,
      logCall: node?.data?.logCall || false,
      sendReceipt: node?.data?.sendReceipt || false,
      contactMethod: node?.data?.contactMethod || 'sms',
      // Preserve promptKey from node data
      promptKey: node?.data?.promptKey || ''
    });
  }, [node?.id, node?.data]);

  const renderVoiceSettings = (textField = 'text') => (
    <div className="voice-settings-group">
      <div className="form-group">
        <label>Voice ID</label>
        <select
          value={config.voice}
          onChange={(e) => {
            const nextVoice = e.target.value;
            const selected = voiceOptions.find(v => v.id === nextVoice);
            handleChange('voice', nextVoice);
            if (selected) {
              handleChange('language', selected.language);
            }
          }}
        >
          {voiceOptions.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const voiceOptions = useMemo(() => ([
    { id: 'ta-IN-PallaviNeural', name: 'PallaviNeural (Female, Tamil)', language: 'ta-IN' },
    { id: 'ta-IN-ValluvarNeural', name: 'ValluvarNeural (Male, Tamil)', language: 'ta-IN' },
    { id: 'hi-IN-SwaraNeural', name: 'SwaraNeural (Female, Hindi)', language: 'hi-IN' },
    { id: 'hi-IN-MadhurNeural', name: 'MadhurNeural (Male, Hindi)', language: 'hi-IN' },
    { id: 'en-GB-SoniaNeural', name: 'SoniaNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-RyanNeural', name: 'RyanNeural (Male, English UK)', language: 'en-GB' },
    { id: 'en-GB-LibbyNeural', name: 'LibbyNeural (Female, English UK)', language: 'en-GB' },
    { id: 'en-GB-ThomasNeural', name: 'ThomasNeural (Male, English UK)', language: 'en-GB' },
    { id: 'en-US-AriaNeural', name: 'AriaNeural (Female, English US)', language: 'en-US' },
    { id: 'en-US-GuyNeural', name: 'GuyNeural (Male, English US)', language: 'en-US' }
  ]), []);

  const renderGreetingConfig = () => (
    <div className="config-section">
      <h4>Greeting Message</h4>
      <div className="form-group">
        <label>Message Text</label>
        <textarea
          value={config.text}
          onChange={(e) => handleChange('text', e.target.value)}
          placeholder="Enter greeting message..."
          rows={3}
        />
        <small className="form-help">This message will be played when callers first reach your IVR system.</small>
      </div>
      {renderVoiceSettings('text')}
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

  const renderConfigByNodeType = () => {
    switch (node?.type) {
      case 'greeting':
        return renderGreetingConfig();
      case 'input':
        return renderInputConfig();
      case 'transfer':
        return renderTransferConfig();
      case 'conditional':
        return renderConditionalConfig();
      case 'voicemail':
        return (
          <div className="config-section">
            <h4>Voicemail Configuration</h4>
            <div className="form-group">
              <label>Message Text</label>
              <textarea
                value={config.text || ''}
                onChange={(e) => handleChange('text', e.target.value)}
                placeholder="Leave a message after the tone."
                rows={3}
              />
            </div>
            {renderVoiceSettings('text')}
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
      case 'repeat':
        return (
          <div className="config-section">
            <h4>Repeat Configuration</h4>

            <div className="form-group">
              <label>Repeat Type</label>
              <select
                value={config.repeatType || 'prompt'}
                onChange={(e) => handleChange('repeatType', e.target.value)}
              >
                <option value="prompt">Replay Last Prompt</option>
                <option value="menu">Repeat Entire Menu</option>
                <option value="custom">Custom Message</option>
                <option value="none">No Repeat</option>
              </select>
              <small className="form-help">What should be repeated when caller requests repetition.</small>
            </div>

            {config.repeatType === 'custom' && (
              <div className="form-group">
                <label>Custom Repeat Message</label>
                <textarea
                  value={config.customRepeatMessage || ''}
                  onChange={(e) => handleChange('customRepeatMessage', e.target.value)}
                  placeholder="Let me repeat that for you..."
                  rows={2}
                />
                {renderVoiceSettings('customRepeatMessage')}
              </div>
            )}

            {config.repeatType !== 'none' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Max Repeats</label>
                    <input
                      type="number"
                      value={config.maxRepeats || 3}
                      onChange={(e) => handleChange('maxRepeats', parseInt(e.target.value))}
                      min={1}
                      max={10}
                    />
                    <small className="form-help">Maximum times to repeat before fallback.</small>
                  </div>
                  <div className="form-group">
                    <label>Repeat Trigger</label>
                    <select
                      value={config.repeatTrigger || 'any'}
                      onChange={(e) => handleChange('repeatTrigger', e.target.value)}
                    >
                      <option value="any">Any Invalid Input</option>
                      <option value="timeout">Timeout Only</option>
                      <option value="digit">Specific Digit (*)</option>
                      <option value="voice">Voice Command</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Timeout (seconds)</label>
                    <input
                      type="number"
                      value={config.timeout || 10}
                      onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
                      min={5}
                      max={30}
                    />
                  </div>
                  <div className="form-group">
                    <label>Repeat Interval (seconds)</label>
                    <input
                      type="number"
                      value={config.repeatInterval || 2}
                      onChange={(e) => handleChange('repeatInterval', parseInt(e.target.value))}
                      min={1}
                      max={10}
                    />
                    <small className="form-help">Pause between repeats.</small>
                  </div>
                </div>

                <div className="form-group">
                  <label>Repeat Message</label>
                  <textarea
                    value={config.repeatMessage || ''}
                    onChange={(e) => handleChange('repeatMessage', e.target.value)}
                    placeholder="Please listen carefully or press 0 for assistance."
                    rows={2}
                  />
                  <small className="form-help">Message played before each repetition.</small>
                  {renderVoiceSettings('repeatMessage')}
                </div>
              </>
            )}

            <div className="form-group">
              <label>Fallback Action</label>
              <select
                value={config.fallbackAction || 'node'}
                onChange={(e) => handleChange('fallbackAction', e.target.value)}
              >
                <option value="node">Go to Node</option>
                <option value="transfer">Transfer Call</option>
                <option value="voicemail">Send to Voicemail</option>
                <option value="agent">Connect to Agent</option>
                <option value="end">End Call</option>
              </select>
              <small className="form-help">What happens when max repeats are reached.</small>
            </div>

            {config.fallbackAction === 'node' && (
              <div className="form-group">
                <label>Fallback Node ID</label>
                <input
                  type="text"
                  value={config.fallbackNodeId || ''}
                  onChange={(e) => handleChange('fallbackNodeId', e.target.value)}
                  placeholder="node_id_fallback"
                />
              </div>
            )}

            {config.fallbackAction === 'transfer' && (
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

            {config.fallbackAction === 'voicemail' && (
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

            <div className="form-group">
              <label>Advanced Options</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.countRepeats || false}
                    onChange={(e) => handleChange('countRepeats', e.target.checked)}
                  />
                  Count Repeat Attempts
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.logRepeats || false}
                    onChange={(e) => handleChange('logRepeats', e.target.checked)}
                  />
                  Log Repeat Events
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.progressiveTimeout || false}
                    onChange={(e) => handleChange('progressiveTimeout', e.target.checked)}
                  />
                  Progressive Timeout
                </label>
              </div>
            </div>

            {config.progressiveTimeout && (
              <div className="form-group">
                <label>Timeout Progression</label>
                <input
                  type="text"
                  value={config.timeoutProgression || '10,15,20,25'}
                  onChange={(e) => handleChange('timeoutProgression', e.target.value)}
                  placeholder="10,15,20,25"
                />
                <small className="form-help">Comma-separated timeout values for each repeat attempt.</small>
              </div>
            )}
          </div>
        );
      case 'end':
        return (
          <div className="config-section">
            <h4>End Call Configuration</h4>
            <div className="form-group">
              <label>Goodbye Message</label>
              <textarea
                value={config.message || ''}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="Thank you for calling. Goodbye!"
                rows={3}
              />
              <small className="form-help">This message will be played before ending the call.</small>
            </div>
            {renderVoiceSettings('message')}

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
              <small className="form-help">What happens after the goodbye message.</small>
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
