const CRM_CONTACT_SYNC_EVENT = "crm:contact-sync";

const normalizeContactId = (value) => String(value || "").trim();

export const publishCrmContactSync = ({
  contactId,
  conversationId = "",
  reason = "unknown"
} = {}) => {
  const normalizedContactId = normalizeContactId(contactId);
  if (!normalizedContactId) return;

  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CRM_CONTACT_SYNC_EVENT, {
      detail: {
        contactId: normalizedContactId,
        conversationId: String(conversationId || "").trim(),
        reason: String(reason || "unknown").trim()
      }
    })
  );
};

export const addCrmContactSyncListener = (listener) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }

  const wrappedListener = (event) => {
    if (typeof listener !== "function") return;
    const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
    const contactId = normalizeContactId(detail.contactId);
    if (!contactId) return;
    listener({
      contactId,
      conversationId: String(detail.conversationId || "").trim(),
      reason: String(detail.reason || "unknown").trim()
    });
  };

  window.addEventListener(CRM_CONTACT_SYNC_EVENT, wrappedListener);
  return () => {
    window.removeEventListener(CRM_CONTACT_SYNC_EVENT, wrappedListener);
  };
};

export const isCrmContactSyncForContact = (payload = {}, contactId = "") =>
  normalizeContactId(payload?.contactId) !== "" &&
  normalizeContactId(payload?.contactId) === normalizeContactId(contactId);
