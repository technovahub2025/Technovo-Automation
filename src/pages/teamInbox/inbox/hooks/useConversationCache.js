import { useMemo } from 'react';
import { dedupeConversationList } from '../utils/dedupeConversation';
import { getConversationIdValue } from '../../teamInboxUtils';

export const useConversationCache = (conversations = []) => {
  return useMemo(() => {
    const normalized = dedupeConversationList(conversations);
    const lookup = new Map();

    normalized.conversations.forEach((conversation) => {
      const conversationId = getConversationIdValue(conversation);
      if (conversationId) {
        lookup.set(conversationId, conversation);
      }
      const summaryId = String(conversation?.summaryId || '').trim();
      if (summaryId && !lookup.has(summaryId)) {
        lookup.set(summaryId, conversation);
      }
    });

    return {
      conversations: normalized.conversations,
      order: normalized.order,
      byId: normalized.byId,
      lookup
    };
  }, [conversations]);
};
