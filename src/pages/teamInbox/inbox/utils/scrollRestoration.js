export const getScrollAnchorKey = (conversationId = '', searchTerm = '') =>
  `${String(conversationId || '').trim()}::${String(searchTerm || '').trim()}`;

export const saveScrollRestoration = (storage, key, value) => {
  if (!storage || !key) return;
  storage.current = storage.current || new Map();
  storage.current.set(key, value);
};

export const readScrollRestoration = (storage, key) => {
  if (!storage || !key || !storage.current) return null;
  return storage.current.get(key) || null;
};
