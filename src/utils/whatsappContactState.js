const toTrimmedString = (value) => String(value || '').trim();

const toSafeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeWhatsappOptInStatus = (contact = {}) => {
  const normalized = toTrimmedString(contact?.whatsappOptInStatus).toLowerCase();
  if (normalized === 'opted_in') return 'opted_in';
  if (normalized === 'opted_out') return 'opted_out';
  return contact?.isBlocked ? 'opted_out' : 'unknown';
};

export const getWhatsAppConversationState = (contact = {}) => {
  const normalizedOptInStatus = normalizeWhatsappOptInStatus(contact);
  const serviceWindowClosesAt = toSafeDate(contact?.serviceWindowClosesAt);
  const now = new Date();
  const serviceWindowOpen = Boolean(
    serviceWindowClosesAt && serviceWindowClosesAt.getTime() > now.getTime()
  );
  const optedOut = normalizedOptInStatus === 'opted_out';
  const freeformAllowed = serviceWindowOpen && !optedOut;
  const templateOnly = !optedOut && !freeformAllowed;

  let statusLabel = 'Template Only';
  let badgeTone = 'template-only';

  if (optedOut) {
    statusLabel = 'Opted Out';
    badgeTone = 'opted-out';
  } else if (freeformAllowed) {
    statusLabel = '24h Open';
    badgeTone = 'service-open';
  }

  return {
    normalizedOptInStatus,
    serviceWindowClosesAt,
    serviceWindowOpen,
    freeformAllowed,
    templateOnly,
    optedOut,
    marketingTemplateAllowed: !optedOut && normalizedOptInStatus === 'opted_in',
    statusLabel,
    badgeTone
  };
};
