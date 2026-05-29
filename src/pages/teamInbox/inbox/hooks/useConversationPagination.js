import { useCallback, useRef } from 'react';

export const useConversationPagination = ({
  loading = false,
  loadingMoreConversations = false,
  hasMoreConversations = false,
  conversationListExhausted = false,
  itemCount = 0,
  prefetchThreshold = 6,
  onLoadMoreConversations
} = {}) => {
  const requestLockRef = useRef(false);
  const initialLoading = Boolean(loading);
  const nextPageLoading = Boolean(loadingMoreConversations);
  const realtimeSyncLoading = false;

  const triggerNextPage = useCallback(async () => {
    if (!hasMoreConversations || conversationListExhausted) return false;
    if (requestLockRef.current) return false;
    if (loadingMoreConversations) return false;

    requestLockRef.current = true;

    try {
      return await Promise.resolve(onLoadMoreConversations?.());
    } finally {
      requestLockRef.current = false;
    }
  }, [conversationListExhausted, hasMoreConversations, loadingMoreConversations, onLoadMoreConversations]);

  const onRangeChanged = useCallback(
    (range) => {
      const endIndex = Number(range?.endIndex ?? -1);
      const totalCount = Math.max(0, Number(itemCount || 0));
      if (endIndex < 0 || totalCount <= 0) return;
      if (endIndex < totalCount - prefetchThreshold) return;
      void triggerNextPage();
    },
    [itemCount, prefetchThreshold, triggerNextPage]
  );

  const onEndReached = useCallback(() => {
    void triggerNextPage();
  }, [triggerNextPage]);

  return {
    initialLoading,
    nextPageLoading,
    realtimeSyncLoading,
    onRangeChanged,
    onEndReached,
    requestLockRef
  };
};
