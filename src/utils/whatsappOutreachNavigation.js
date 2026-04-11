import { normalizePhone } from '../pages/teamInbox/teamInboxIdentityUtils.js';

const resolveContactId = (contact = {}) =>
  String(
    contact?._id ||
      contact?.id ||
      contact?.contactId?._id ||
      contact?.contactId?.id ||
      contact?.contactId ||
      ''
  ).trim();

const buildNonce = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toTrimmedString = (value) => String(value || '').trim();

const getStoredUserContext = () => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null') || {};
  } catch {
    return {};
  }
};

const getBasePath = () => {
  const rawBasePath = String(import.meta.env.BASE_URL || '/').trim();
  if (!rawBasePath || rawBasePath === '/') return '';
  return rawBasePath.endsWith('/') ? rawBasePath.slice(0, -1) : rawBasePath;
};

export const buildWhatsAppOutreachState = (contact = {}, options = {}) => {
  const phoneNumber = String(
    contact?.phone || contact?.contactPhone || options?.phoneNumber || ''
  ).trim();
  const contactName = String(
    contact?.name || contact?.contactName || options?.contactName || ''
  ).trim();
  const contactId = resolveContactId(contact) || String(options?.contactId || '').trim();

  return {
    phoneNumber,
    normalizedPhoneNumber: normalizePhone(phoneNumber),
    contactName,
    contactId,
    openTemplateSendModal: Boolean(options?.openTemplateSendModal),
    whatsappOutreachNonce: String(options?.whatsappOutreachNonce || '').trim() || buildNonce()
  };
};

export const getWhatsAppOutreachTargetFromLocationState = (state = {}) => {
  if (!state || typeof state !== 'object') return null;

  const phoneNumber = String(
    state?.phoneNumber || state?.normalizedPhoneNumber || state?.contactPhone || ''
  ).trim();
  if (!phoneNumber) return null;

  const contactName = String(state?.contactName || state?.name || '').trim();
  const contactId = String(state?.contactId || state?.id || '').trim();

  return {
    contactPhone: phoneNumber,
    normalizedPhoneNumber: normalizePhone(phoneNumber),
    contactName,
    name: contactName,
    contactId
  };
};

export const buildPublicWhatsAppOptInDemoUrl = (contact = {}, options = {}) => {
  if (typeof window === 'undefined') return '';

  const user = getStoredUserContext();
  const query = new URLSearchParams();
  const name = toTrimmedString(contact?.name || options?.name);
  const phone = toTrimmedString(contact?.phone || contact?.contactPhone || options?.phone);
  const email = toTrimmedString(contact?.email || options?.email);
  const source = toTrimmedString(options?.source || 'manual_share');
  const scope = toTrimmedString(options?.scope || 'marketing');
  const proofId = toTrimmedString(options?.proofId || `share-${Date.now()}`);
  const userId = toTrimmedString(options?.userId || user?.id || user?.userId);
  const companyId = toTrimmedString(options?.companyId || user?.companyId);
  const backendUrl = toTrimmedString(options?.backendUrl || import.meta.env.VITE_API_BASE_URL);

  if (backendUrl) query.set('backendUrl', backendUrl);
  if (userId) query.set('userId', userId);
  if (companyId) query.set('companyId', companyId);
  if (name) query.set('name', name);
  if (phone) query.set('phone', phone);
  if (email) query.set('email', email);
  if (source) query.set('source', source);
  if (scope) query.set('scope', scope);
  if (proofId) query.set('proofId', proofId);

  const basePath = getBasePath();
  const path = `${window.location.origin}${basePath}/whatsapp-opt-in-demo`;
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};
