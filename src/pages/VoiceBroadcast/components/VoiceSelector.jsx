import React from 'react';
import { Mic, Volume2 } from 'lucide-react';

const VoiceSelector = ({ selected, onChange, disabled }) => {
  const voices = [
    { id: 'ta-IN-PallaviNeural', name: 'PallaviNeural (Female,Tamil)', language: 'ta-IN', gender: 'Female' },
    { id: 'ta-IN-ValluvarNeural', name: 'ValluvarNeural (Male,Tamil)', language: 'ta-IN', gender: 'Male' },
    { id: 'en-GB-SoniaNeural', name: 'SoniaNeural (Female,English)', language: 'en-GB', gender: 'Female' },
    { id: 'en-GB-RyanNeural', name: 'RyanNeural (Male,English)', language: 'en-GB', gender: 'Male' }
  ];

  const handleVoiceChange = (voiceId) => {
    const voice = voices.find(v => v.id === voiceId);
    onChange({
      provider: 'edge',
      voiceId: voice.id,
      language: voice.language
    });
  };

  return (
    <div className="form-section">
      <label className="form-label">
        <Mic size={18} />
        Voice Selection
      </label>

      <div className="voice-selector">
        <select
          className="form-input"
          value={selected.voiceId}
          onChange={(e) => handleVoiceChange(e.target.value)}
          disabled={disabled}
        >
          {voices.map(voice => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>

        <div className="voice-preview">
          <Volume2 size={16} />
          <span>
            {voices.find(v => v.id === selected.voiceId)?.gender} voice • 
            {' '}{selected.language} language
          </span>
        </div>
      </div>

      <div className="voice-info">
        <small>
          <strong>Tip:</strong> Select a voice that matches your audience's language and preference.
        </small>
      </div>
    </div>
  );
};

export default VoiceSelector;