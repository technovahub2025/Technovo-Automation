export const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

export const getPhoneLookupKeys = (value) => {
  const normalized = normalizePhone(value);
  if (!normalized) return [];
  const keys = [normalized];
  if (normalized.length > 10) {
    keys.push(normalized.slice(-10));
  }
  return Array.from(new Set(keys));
};

export const matchesPhoneLookup = (leftValue, rightValue) => {
  const leftKeys = getPhoneLookupKeys(leftValue);
  const rightKeys = getPhoneLookupKeys(rightValue);
  if (!leftKeys.length || !rightKeys.length) return false;
  return leftKeys.some((key) => rightKeys.includes(key));
};

export const isRealName = (value) => {
  const name = String(value || '').trim();
  return Boolean(name) && !/^\+?\d+$/.test(name);
};

export const normalizeLookupText = (value) => String(value || '').trim().toLowerCase();

export const getMappedContactName = (phone, contactNameMap = {}) => {
  const keys = getPhoneLookupKeys(phone);
  for (const key of keys) {
    if (isRealName(contactNameMap[key])) {
      return contactNameMap[key];
    }
  }
  return '';
};

export const doesConversationMatchSearch = ({
  conversation,
  searchTerm,
  getConversationDisplayName
}) => {
  const normalizedSearchTerm = normalizeLookupText(searchTerm);
  if (!normalizedSearchTerm) return true;

  const displayName = normalizeLookupText(getConversationDisplayName?.(conversation) || '');
  const rawName = normalizeLookupText(
    conversation?.contactId?.name || conversation?.contactName || ''
  );
  const contactPhone = String(conversation?.contactPhone || '').trim();
  const previewText = normalizeLookupText(conversation?.lastMessagePreviewText || '');
  const normalizedPhoneQuery = normalizePhone(searchTerm);
  const phoneKeys = getPhoneLookupKeys(contactPhone);

  return (
    displayName.includes(normalizedSearchTerm) ||
    rawName.includes(normalizedSearchTerm) ||
    previewText.includes(normalizedSearchTerm) ||
    contactPhone.includes(String(searchTerm || '').trim()) ||
    (Boolean(normalizedPhoneQuery) &&
      phoneKeys.some(
        (key) => key.includes(normalizedPhoneQuery) || normalizedPhoneQuery.includes(key)
      ))
  );
};

export const findConversationByContactIdentity = ({
  conversations,
  phoneNumber,
  contactName,
  getConversationDisplayName
}) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];
  const normalizedContactName = normalizeLookupText(contactName);

  const phoneMatch = safeConversations.find((conversation) =>
    matchesPhoneLookup(conversation?.contactPhone, phoneNumber)
  );
  if (phoneMatch) return phoneMatch;

  if (!normalizedContactName) return null;

  return (
    safeConversations.find((conversation) => {
      const displayName = normalizeLookupText(getConversationDisplayName?.(conversation) || '');
      const rawName = normalizeLookupText(
        conversation?.contactId?.name || conversation?.contactName || ''
      );
      return displayName === normalizedContactName || rawName === normalizedContactName;
    }) || null
  );
};
