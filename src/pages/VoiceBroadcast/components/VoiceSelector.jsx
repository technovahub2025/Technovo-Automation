import React from 'react';
import { Mic, Volume2 } from 'lucide-react';

const VoiceSelector = ({ selected, onChange, disabled }) => {
  const voices = [
    { id: 'en-IN-NeerjaNeural', name: 'Neerja (Female, Hindi-English)', language: 'en-IN', gender: 'Female' },
    { id: 'en-IN-PrabhatNeural', name: 'Prabhat (Male, Hindi-English)', language: 'en-IN', gender: 'Male' },
    { id: 'en-US-AriaNeural', name: 'Aria (Female, US)', language: 'en-US', gender: 'Female' },
    { id: 'en-US-GuyNeural', name: 'Guy (Male, US)', language: 'en-US', gender: 'Male' },
    { id: 'en-GB-SoniaNeural', name: 'Sonia (Female, British)', language: 'en-GB', gender: 'Female' },
    { id: 'hi-IN-SwaraNeural', name: 'Swara (Female, Hindi)', language: 'hi-IN', gender: 'Female' },
    { id: 'hi-IN-MadhurNeural', name: 'Madhur (Male, Hindi)', language: 'hi-IN', gender: 'Male' }
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
          Hindi voices work best for Indian audiences.
        </small>
      </div>
    </div>
  );
};

export default VoiceSelector;