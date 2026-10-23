export const shouldRefreshTtsAudio = ({
  messageText,
  previousMessageText,
  voice,
  previousVoice,
  language,
  previousLanguage,
  audioStatus
} = {}) => {
  const nextText = String(messageText || '').trim();
  if (!nextText) return false;

  return audioStatus === 'failed' ||
    nextText !== String(previousMessageText || '').trim() ||
    (voice || 'en-GB-SoniaNeural') !== (previousVoice || 'en-GB-SoniaNeural') ||
    (language || 'en-GB') !== (previousLanguage || 'en-GB');
};

export const markTtsAudioFailure = (config = {}, error = '') => ({
  ...config,
  audioStatus: 'failed',
  audioError: String(error || 'TTS audio generation failed')
});
