const VOICE_RECORDER_MIME_CANDIDATES = [
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg',
  'audio/mp4'
];

const normalizeMimeType = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();

export const resolvePreferredVoiceRecorderMimeType = () => {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }

  if (typeof window.MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return (
    VOICE_RECORDER_MIME_CANDIDATES.find((candidate) =>
      window.MediaRecorder.isTypeSupported(candidate)
    ) || ''
  );
};

export const inferVoiceRecorderExtension = (mimeType = '') => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (normalizedMimeType === 'audio/ogg') return 'ogg';
  if (normalizedMimeType === 'audio/webm') return 'webm';
  if (normalizedMimeType === 'audio/mp4') return 'm4a';
  if (normalizedMimeType === 'audio/mpeg') return 'mp3';
  return 'audio';
};

export const formatVoiceRecorderDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

