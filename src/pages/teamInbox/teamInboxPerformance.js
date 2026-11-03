const diagnosticIds = new Map();

const enabled = () => {
  if (import.meta.env.DEV) return true;
  try {
    return String(localStorage.getItem('debugTeamInbox') || '').trim() === '1';
  } catch {
    return false;
  }
};

export const diagnosticId = (value = '') => {
  const input = String(value || '');
  if (!input) return 'none';
  if (!diagnosticIds.has(input)) {
    const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    diagnosticIds.set(input, randomId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
  }
  return diagnosticIds.get(input);
};

export const createInboxRequestId = () =>
  globalThis.crypto?.randomUUID?.() || `inbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const logTeamInboxPerformance = (event = {}) => {
  if (!enabled()) return;
  console.info('[team-inbox-perf]', event);
};

