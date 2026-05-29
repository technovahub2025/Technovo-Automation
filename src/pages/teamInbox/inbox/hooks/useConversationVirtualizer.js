import { useCallback } from 'react';
import { getConversationIdValue } from '../../teamInboxUtils';

export const useConversationVirtualizer = ({
  conversations = [],
  renderRow
} = {}) => {
  const computeItemKey = useCallback((index, conversation) => {
    return String(getConversationIdValue(conversation) || conversation?._id || index).trim();
  }, []);

  const itemContent = useCallback(
    (index, conversation) => renderRow?.(conversation, index),
    [renderRow]
  );

  return {
    computeItemKey,
    itemContent,
    conversations
  };
};
