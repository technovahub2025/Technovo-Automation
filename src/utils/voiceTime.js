export const VOICE_TIME_ZONE = 'Asia/Kolkata';
export const VOICE_TIME_ZONE_LABEL = 'IST';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatVoiceDateTime = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return options.fallback || '-';
  const formatted = date.toLocaleString('en-IN', {
    timeZone: VOICE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  });
  return options.showZone === false ? formatted : `${formatted} ${VOICE_TIME_ZONE_LABEL}`;
};

export const formatVoiceTime = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return options.fallback || '-';
  const formatted = date.toLocaleTimeString('en-IN', {
    timeZone: VOICE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: options.second === false ? undefined : '2-digit',
    hour12: true,
    ...options
  });
  return options.showZone === false ? formatted : `${formatted} ${VOICE_TIME_ZONE_LABEL}`;
};

export const formatVoiceDate = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return options.fallback || '-';
  const formatted = date.toLocaleDateString('en-IN', {
    timeZone: VOICE_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options
  });
  return options.showZone ? `${formatted} ${VOICE_TIME_ZONE_LABEL}` : formatted;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const dateOnlyToIstIsoBoundary = (value, endOfDay = false) => {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  const utcMillis = Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMillis + (endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0)).toISOString();
};
