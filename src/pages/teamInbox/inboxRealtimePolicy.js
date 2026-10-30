export const isContactsImportedCrmEvent = (event = {}) =>
  String(event?.action || '').trim().toLowerCase() === 'contacts_imported';

export const shouldRefreshInboxForCrmEvent = (event = {}) =>
  !isContactsImportedCrmEvent(event);
