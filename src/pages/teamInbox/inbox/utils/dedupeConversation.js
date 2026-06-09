import { getConversationIdValue, mergeConversationRecords } from '../../teamInboxUtils';

export const dedupeConversation = (conversation = {}) => {
  const normalizedId = getConversationIdValue(conversation);
  if (!normalizedId) return null;
  return {
    ...conversation,
    _id: normalizedId,
    id: String(conversation?.id || normalizedId).trim() || normalizedId
  };
};

export const dedupeConversationList = (conversations = []) => {
  const byId = new Map();
  const order = [];

  (Array.isArray(conversations) ? conversations : []).forEach((conversation) => {
    const normalized = dedupeConversation(conversation);
    if (!normalized) return;
    const conversationId = getConversationIdValue(normalized);
    const previous = byId.get(conversationId) || null;
    const nextConversation = previous
      ? mergeConversationRecords(previous, normalized)
      : normalized;

    if (byId.has(conversationId)) {
      const existingIndex = order.indexOf(conversationId);
      if (existingIndex >= 0) order.splice(existingIndex, 1);
    }

    byId.set(conversationId, nextConversation);
    order.push(conversationId);
  });

  return {
    byId,
    order,
    conversations: order.map((conversationId) => byId.get(conversationId)).filter(Boolean)
  };
};
