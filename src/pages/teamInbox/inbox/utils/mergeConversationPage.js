import { dedupeConversationList } from './dedupeConversation';

export const mergeConversationPage = (base = [], page = []) => {
  const merged = dedupeConversationList([
    ...(Array.isArray(base) ? base : []),
    ...(Array.isArray(page) ? page : [])
  ]);
  return merged.conversations;
};
