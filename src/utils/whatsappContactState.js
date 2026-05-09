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

const hasOptInEvidence = (contact = {}) =>
  Boolean(
    toTrimmedString(contact?.whatsappOptInAt) ||
      toTrimmedString(contact?.whatsappOptInTextSnapshot) ||
      toTrimmedString(contact?.whatsappOptInProofType) ||
      toTrimmedString(contact?.whatsappOptInProofId) ||
      toTrimmedString(contact?.whatsappOptInProofUrl) ||
      toTrimmedString(contact?.whatsappOptInPageUrl) ||
      toTrimmedString(contact?.whatsappOptInCapturedBy) ||
      toTrimmedString(contact?.whatsappOptInMetadata) ||
      ['landing_page', 'public_opt_in', 'website_form'].includes(
        toTrimmedString(contact?.whatsappOptInSource || contact?.source).toLowerCase()
      )
  );

export const normalizeWhatsappOptInStatus = (contact = {}) => {
  const normalized = toTrimmedString(contact?.whatsappOptInStatus)
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  if (normalized === 'opted_in') return 'opted_in';
  if (normalized === 'opted_out') return 'opted_out';
  if (hasOptInEvidence(contact)) return 'opted_in';
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
  const lastInboundMessageAt = toSafeDate(contact?.lastInboundMessageAt);
  const inferredServiceWindowClosesAt = lastInboundMessageAt
    ? new Date(lastInboundMessageAt.getTime() + 24 * 60 * 60 * 1000)
    : null;
  const effectiveServiceWindowClosesAt =
    serviceWindowClosesAt && inferredServiceWindowClosesAt
      ? new Date(
          Math.max(
            serviceWindowClosesAt.getTime(),
            inferredServiceWindowClosesAt.getTime()
          )
        )
      : serviceWindowClosesAt || inferredServiceWindowClosesAt;
  const marketingWindowStartAt = toSafeDate(contact?.whatsappMarketingWindowStartedAt);
  const marketingLastSentAt = toSafeDate(contact?.whatsappMarketingLastSentAt);
  const marketingSendCount = Number(contact?.whatsappMarketingSendCount || 0) || 0;
  const now = new Date();
  const serviceWindowOpen = Boolean(
    effectiveServiceWindowClosesAt && effectiveServiceWindowClosesAt.getTime() > now.getTime()
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
    serviceWindowClosesAt: effectiveServiceWindowClosesAt,
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
