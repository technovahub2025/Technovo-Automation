const toTrimmedString = (value) => String(value || '').trim();

const toSafeDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeOptInScope = (value = '') => {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === 'marketing' || normalized === 'service' || normalized === 'both') {
    return normalized;
  }
  return 'unknown';
};

export const normalizeWhatsappOptInStatus = (contact = {}) => {
  const normalized = toTrimmedString(contact?.whatsappOptInStatus).toLowerCase();
  if (normalized === 'opted_in') return 'opted_in';
  if (normalized === 'opted_out') return 'opted_out';
  return contact?.isBlocked ? 'opted_out' : 'unknown';
};

export const getWhatsAppConversationState = (contact = {}) => {
  const marketingLimit = Number(import.meta.env.VITE_WHATSAPP_MARKETING_TEMPLATE_MAX_PER_24H || 1);
  const marketingWindowHours = Number(import.meta.env.VITE_WHATSAPP_MARKETING_TEMPLATE_WINDOW_HOURS || 24);
  const safeMarketingLimit =
    Number.isFinite(marketingLimit) && marketingLimit > 0 ? Math.floor(marketingLimit) : 1;
  const safeWindowHours =
    Number.isFinite(marketingWindowHours) && marketingWindowHours > 0 ? marketingWindowHours : 24;
  const windowMs = safeWindowHours * 60 * 60 * 1000;

  const normalizedOptInStatus = normalizeWhatsappOptInStatus(contact);
  const normalizedOptInScope = normalizeOptInScope(contact?.whatsappOptInScope);
  const serviceWindowClosesAt = toSafeDate(contact?.serviceWindowClosesAt);
  const marketingWindowStartAt = toSafeDate(contact?.whatsappMarketingWindowStartedAt);
  const marketingLastSentAt = toSafeDate(contact?.whatsappMarketingLastSentAt);
  const marketingSendCount = Number(contact?.whatsappMarketingSendCount || 0) || 0;
  const now = new Date();
  const serviceWindowOpen = Boolean(
    serviceWindowClosesAt && serviceWindowClosesAt.getTime() > now.getTime()
  );
  const marketingWindowStart = marketingWindowStartAt || marketingLastSentAt;
  const marketingWindowExpiresAt =
    marketingWindowStart && marketingWindowStart.getTime() + windowMs > now.getTime()
      ? new Date(marketingWindowStart.getTime() + windowMs)
      : null;
  const marketingRemaining = marketingWindowExpiresAt
    ? Math.max(safeMarketingLimit - marketingSendCount, 0)
    : safeMarketingLimit;
  const marketingRateLimited = Boolean(marketingWindowExpiresAt && marketingRemaining <= 0);

  const optedOut = normalizedOptInStatus === 'opted_out';
  const freeformAllowed = serviceWindowOpen && !optedOut;
  const templateOnly = !optedOut && !freeformAllowed;
  const marketingScopeAllowed =
    normalizedOptInScope === 'marketing' || normalizedOptInScope === 'both';

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
    normalizedOptInScope,
    marketingTemplateAllowed:
      !optedOut && normalizedOptInStatus === 'opted_in' && marketingScopeAllowed,
    marketingRateLimited,
    marketingRateRemaining: marketingRemaining,
    marketingNextAllowedAt: marketingWindowExpiresAt,
    marketingWindowStartAt: marketingWindowStart,
    statusLabel,
    badgeTone
  };
};
