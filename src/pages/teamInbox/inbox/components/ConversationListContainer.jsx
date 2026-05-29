import React, { memo, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import ConversationRow from './ConversationRow';
import ConversationSkeleton from './ConversationSkeleton';
import ConversationEmptyState from './ConversationEmptyState';
import { useConversationCache } from '../hooks/useConversationCache';
import { useConversationPagination } from '../hooks/useConversationPagination';
import { useConversationScroll } from '../hooks/useConversationScroll';
import { useConversationVirtualizer } from '../hooks/useConversationVirtualizer';

const ConversationListContainer = ({
  conversations = [],
  loading = false,
  loadingMoreConversations = false,
  hasMoreConversations = false,
  conversationListExhausted = false,
  onLoadMoreConversations,
  selectedConversationId = '',
  showSelectMode = false,
  selectedForDeletion = [],
  openConversationMenuId = '',
  onConversationClick,
  onDeleteConversation,
  onToggleSelectForDeletion,
  onAssignConversation,
  onCloseConversationMenu,
  getUnreadCount,
  getConversationAvatarText,
  getConversationDisplayName,
  formatConversationTime,
  canAssignChats = false,
  currentUserId = '',
  availableAgents = [],
  onBulkAssignSelectedChats,
  bulkAssignBusy = false
}) => {
  const cache = useConversationCache(conversations);
  const { virtuosoRef, setScrollerNode, showJumpToNewest, scrollToNewest, isCompactViewport } =
    useConversationScroll();
  const prefetchThreshold = isCompactViewport ? 4 : 6;
  const viewportBuffer = isCompactViewport
    ? { top: 120, bottom: 560 }
    : { top: 240, bottom: 1440 };
  const { initialLoading, nextPageLoading, onRangeChanged, onEndReached } =
    useConversationPagination({
      loading,
      loadingMoreConversations,
      hasMoreConversations,
      conversationListExhausted,
      itemCount: cache.conversations.length,
      prefetchThreshold,
      onLoadMoreConversations
    });
  const showTailSkeleton = Boolean(nextPageLoading || loadingMoreConversations);

  const selectedForDeletionSet = useMemo(
    () => new Set((Array.isArray(selectedForDeletion) ? selectedForDeletion : []).map((id) => String(id || '').trim())),
    [selectedForDeletion]
  );

  const renderRow = useMemo(
    () => (conversation) => (
      <ConversationRow
        conversation={conversation}
        selectedConversationId={selectedConversationId}
        showSelectMode={showSelectMode}
        selectedForDeletionSet={selectedForDeletionSet}
        openConversationMenuId={openConversationMenuId}
        onConversationClick={onConversationClick}
        onDeleteConversation={onDeleteConversation}
        onToggleSelectForDeletion={onToggleSelectForDeletion}
        onAssignConversation={onAssignConversation}
        onCloseConversationMenu={onCloseConversationMenu}
        getUnreadCount={getUnreadCount}
        getConversationAvatarText={getConversationAvatarText}
        getConversationDisplayName={getConversationDisplayName}
        formatConversationTime={formatConversationTime}
        canAssignChats={canAssignChats}
        currentUserId={currentUserId}
        availableAgents={availableAgents}
      />
    ),
    [
      availableAgents,
      canAssignChats,
      currentUserId,
      formatConversationTime,
      getConversationAvatarText,
      getConversationDisplayName,
      getUnreadCount,
      onAssignConversation,
      onCloseConversationMenu,
      onConversationClick,
      onDeleteConversation,
      onToggleSelectForDeletion,
      openConversationMenuId,
      selectedConversationId,
      selectedForDeletionSet,
      showSelectMode
    ]
  );

  const { computeItemKey, itemContent } = useConversationVirtualizer({
    conversations: cache.conversations,
    renderRow
  });

  if (initialLoading && cache.conversations.length === 0) {
    return (
      <div className="conversation-list">
        <ConversationSkeleton count={6} />
      </div>
    );
  }

  if (cache.conversations.length === 0) {
    return (
      <div className="conversation-list">
        <ConversationEmptyState />
      </div>
    );
  }

  return (
    <div className="conversation-list">
      <Virtuoso
        ref={virtuosoRef}
        scrollerRef={setScrollerNode}
        style={{ height: '100%' }}
        data={cache.conversations}
        computeItemKey={computeItemKey}
        itemContent={itemContent}
        increaseViewportBy={viewportBuffer}
        defaultItemHeight={84}
        rangeChanged={onRangeChanged}
        endReached={onEndReached}
        components={{
          Footer: () =>
            showTailSkeleton ? (
              <div className="conversation-load-more-tail" aria-hidden="true">
                <ConversationSkeleton count={3} />
              </div>
            ) : null
        }}
        className="conversation-virtuoso"
      />
      <button
        type="button"
        className={`conversation-jump-to-newest ${showJumpToNewest ? 'is-visible' : ''}`}
        onClick={scrollToNewest}
        aria-label="Jump to newest chats"
      >
        <span>Newest</span>
      </button>
    </div>
  );
};

export default memo(ConversationListContainer);
