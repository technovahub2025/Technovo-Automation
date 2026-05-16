const VOICE_RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mpeg'
];

const normalizeMimeType = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();

const writeStringToView = (view, offset, string) => {
  for (let index = 0; index < string.length; index += 1) {
    view.setUint8(offset + index, string.charCodeAt(index));
  }
};

const encodeAudioBufferToWav = (audioBuffer) => {
  const numberOfChannels = Number(audioBuffer?.numberOfChannels || 0);
  const sampleRate = Number(audioBuffer?.sampleRate || 44100);
  const length = Number(audioBuffer?.length || 0);
  if (!numberOfChannels || !length) {
    throw new Error('Unable to encode voice message.');
  }

  const interleaved = new Float32Array(length * numberOfChannels);
  const channelData = [];
  for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
    channelData.push(audioBuffer.getChannelData(channelIndex));
  }

  let interleaveIndex = 0;
  for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
      interleaved[interleaveIndex] = channelData[channelIndex][sampleIndex] || 0;
      interleaveIndex += 1;
    }
  }

  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + interleaved.length * bytesPerSample);
  const view = new DataView(buffer);

  writeStringToView(view, 0, 'RIFF');
  view.setUint32(4, 36 + interleaved.length * bytesPerSample, true);
  writeStringToView(view, 8, 'WAVE');
  writeStringToView(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeStringToView(view, 36, 'data');
  view.setUint32(40, interleaved.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < interleaved.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, interleaved[i] || 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
};

export const convertVoiceRecordingToWavFile = async (blob, fileName = '') => {
  const AudioContextCtor =
    typeof window !== 'undefined'
      ? window.AudioContext || window.webkitAudioContext || null
      : null;
  if (!AudioContextCtor) {
    throw new Error('Audio conversion is not supported in this browser.');
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContextCtor();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBuffer = encodeAudioBufferToWav(audioBuffer);
    const safeName = String(fileName || 'voice-note.wav').trim() || 'voice-note.wav';
    const normalizedName = safeName.toLowerCase().endsWith('.wav')
      ? safeName
      : `${safeName}.wav`;
    return new File([wavBuffer], normalizedName, {
      type: 'audio/wav',
      lastModified: Date.now()
    });
  } finally {
    try {
      await audioContext.close();
    } catch (_error) {
      // no-op
    }
  }
};

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
  if (normalizedMimeType === 'audio/wav') return 'wav';
  if (normalizedMimeType === 'audio/mpeg') return 'mp3';
  return 'audio';
};

export const isMetaCompatibleVoiceMimeType = (mimeType = '') => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return (
    normalizedMimeType === 'audio/webm' ||
    normalizedMimeType === 'audio/ogg' ||
    normalizedMimeType === 'audio/wav' ||
    normalizedMimeType === 'audio/mpeg' ||
    normalizedMimeType === 'audio/amr' ||
    normalizedMimeType === 'audio/aac' ||
    normalizedMimeType === 'audio/opus'
  );
};

export const formatVoiceRecorderDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

