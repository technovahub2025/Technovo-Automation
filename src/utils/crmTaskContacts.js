export const normalizeTaskContact = (contact = {}) => ({
  _id: String(contact?._id || contact?.id || contact?.contactId || '').trim(),
  id: String(contact?.id || contact?._id || contact?.contactId || '').trim(),
  name: String(contact?.name || '').trim(),
  phone: String(contact?.phone || contact?.mobile || contact?.phoneNumber || '').trim(),
  email: String(contact?.email || '').trim(),
  stage: String(contact?.stage || '').trim(),
  status: String(contact?.status || '').trim(),
  leadScore:
    Number.isFinite(Number(contact?.leadScore)) && Number(contact?.leadScore) >= 0
      ? Number(contact.leadScore)
      : 0,
  temperature: String(contact?.temperature || '').trim(),
  ownerId: String(contact?.ownerId || '').trim(),
  nextFollowUpAt: String(contact?.nextFollowUpAt || '').trim()
});

export const normalizeTaskContactList = (value) => {
  const contacts = Array.isArray(value)
    ? value
    : Array.isArray(value?.data)
      ? value.data
      : Array.isArray(value?.results)
        ? value.results
        : [];
  return contacts.map(normalizeTaskContact).filter((contact) => contact._id);
};

export const getTaskContactLabel = (contact = {}) => {
  const name = String(contact?.name || contact?.displayName || contact?.contactName || '').trim();
  const phone = String(contact?.phone || contact?.mobile || contact?.phoneNumber || '').trim();
  const email = String(contact?.email || '').trim();
  const identity = name || email || 'Unknown contact';
  return [identity, phone, email && name ? email : ''].filter(Boolean).join(' · ');
};
