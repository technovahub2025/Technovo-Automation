import { getConversationIdValue, getConversationSortTimestamp, mergeConversationRecords } from '../../teamInboxUtils';

export const reorderConversation = (conversations = [], incomingConversation = {}) => {
  const safeConversations = Array.isArray(conversations) ? [...conversations] : [];
  const incomingId = getConversationIdValue(incomingConversation);
  if (!incomingId) return safeConversations;

  const existingIndex = safeConversations.findIndex(
    (conversation) => getConversationIdValue(conversation) === incomingId
  );
  const existingConversation = existingIndex >= 0 ? safeConversations[existingIndex] : null;
  const mergedConversation = existingConversation
    ? mergeConversationRecords(existingConversation, incomingConversation)
    : incomingConversation;

  if (existingIndex >= 0) {
    safeConversations.splice(existingIndex, 1);
  }

  const targetTs = getConversationSortTimestamp(mergedConversation);
  const insertIndex = safeConversations.findIndex(
    (conversation) => getConversationSortTimestamp(conversation) < targetTs
  );

  if (insertIndex < 0) {
    safeConversations.push(mergedConversation);
  } else {
    safeConversations.splice(insertIndex, 0, mergedConversation);
  }

  return safeConversations;
};
