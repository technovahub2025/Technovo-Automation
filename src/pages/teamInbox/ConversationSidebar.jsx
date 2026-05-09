import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import {
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  Trash2,
  CheckCheck,
  Image as ImageIcon,
  FileText,
  Video,
  Mic
} from 'lucide-react';
import {
  getConversationPreviewMeta,
  resolveConversationSlaMeta
} from './teamInboxDisplayUtils';

const renderConversationMediaIcon = (mediaType = '') => {
  switch (String(mediaType || '').trim().toLowerCase()) {
    case 'image':
      return <ImageIcon size={14} className="conversation-preview-media-icon" aria-hidden="true" />;
    case 'document':
      return <FileText size={14} className="conversation-preview-media-icon" aria-hidden="true" />;
    case 'video':
      return <Video size={14} className="conversation-preview-media-icon" aria-hidden="true" />;
    case 'audio':
      return <Mic size={14} className="conversation-preview-media-icon" aria-hidden="true" />;
    default:
      return null;
  }
};

const ConversationRow = memo(function ConversationRow({
  conversation,
  selectedConversationId,
  showSelectMode,
  selectedForDeletionSet,
  openConversationMenuId,
  onConversationClick,
  onDeleteConversation,
  onToggleSelectForDeletion,
  getUnreadCount,
  getConversationAvatarText,
  getConversationDisplayName,
  formatConversationTime
}) {
  const activeConversationMenuRef = useRef(null);
  const conversationId = String(conversation?._id || '').trim();
  const isConversationMenuOpen = !showSelectMode && openConversationMenuId === conversationId;
  const unreadCount = getUnreadCount(conversation);
  const leadScoreRaw = Number(conversation?.contactId?.leadScore ?? conversation?.leadScore ?? 0);
  const leadScore = Number.isFinite(leadScoreRaw) ? Math.max(0, Math.round(leadScoreRaw)) : 0;
  const previewMeta = getConversationPreviewMeta(conversation);
  const slaMeta = resolveConversationSlaMeta(conversation);
  const hasOpsMeta = Boolean(slaMeta.label);
  const isActiveConversation = selectedConversationId === conversationId;
  const isSelectedForDeletion = selectedForDeletionSet.has(conversationId);

  return (
    <div
      className={`conversation-item ${isActiveConversation ? 'active' : ''} ${
        showSelectMode ? 'select-mode' : ''
      } ${unreadCount > 0 ? 'has-unread' : ''} ${isConversationMenuOpen ? 'menu-open' : ''}`}
      onClick={() => {
        if (showSelectMode) {
          onToggleSelectForDeletion(conversationId);
          return;
        }
        onConversationClick(conversation);
      }}
    >
      {showSelectMode && (
        <div className="select-checkbox">
          <input
            type="checkbox"
            checked={isSelectedForDeletion}
            onChange={() => onToggleSelectForDeletion(conversationId)}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <div className="avatar">{getConversationAvatarText(conversation)}</div>

      <div className="conversation-info">
        <div className="conversation-top">
          <div className="conversation-name-row">
            <span className="name">{getConversationDisplayName(conversation)}</span>
            <span className="conversation-score-chip" title={`Lead score: ${leadScore}`}>
              {leadScore}
            </span>
          </div>
          <div className="conversation-meta-right">
            <span className={`time conversation-time-label ${unreadCount > 0 ? 'unread' : ''}`}>
              {formatConversationTime(conversation.lastMessageTime)}
            </span>
            <div className="conversation-meta-bottom">
              {unreadCount > 0 && <span className="team-unread-badge">{unreadCount}</span>}
              {!showSelectMode && (
                <div
                  className="conversation-menu-anchor"
                  ref={isConversationMenuOpen ? activeConversationMenuRef : null}
                >
                  <button
                    className="conversation-hover-chevron"
                    type="button"
                    aria-label="Conversation actions"
                    aria-haspopup="menu"
                    aria-expanded={isConversationMenuOpen}
                    onClick={(event) => {
                      event.stopPropagation();
                      onConversationClick?.(conversation, { toggleMenu: true });
                    }}
                  >
                    <ChevronDown size={17} strokeWidth={2.3} />
                  </button>

                  {isConversationMenuOpen && (
                    <div className="inbox-select-menu conversation-row-menu" role="menu">
                      <button
                        className="select-menu-item conversation-row-menu-item danger"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteConversation?.(conversation);
                        }}
                      >
                        <Trash2 size={16} strokeWidth={2} />
                        <span>Delete chat</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="conversation-bottom">
          <div className="conversation-preview-line">
            {previewMeta.showStatusIcon && (
              <CheckCheck size={14} className="conversation-preview-status-icon" aria-hidden="true" />
            )}
            {previewMeta.isMedia && renderConversationMediaIcon(previewMeta.mediaType)}
            <p className="preview">{previewMeta.previewText}</p>
          </div>
        </div>
        {hasOpsMeta && (
          <div className="conversation-operator-meta">
            {slaMeta.label && (
              <span
                className={`conversation-operator-chip conversation-operator-chip--sla ${
                  slaMeta.tone ? `conversation-operator-chip--${slaMeta.tone}` : ''
                }`}
              >
                {slaMeta.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const ConversationSidebar = ({
  wsConnected,
  refreshing,
  loadingMoreConversations,
  showFilterMenu,
  showSelectMenu,
  showSelectMode,
  selectedForDeletion,
  loading,
  filteredConversations,
  selectedConversation,
  searchTerm,
  searchInputRef,
  onSearchTermChange,
  onToggleFilterMenu,
  onSelectFilter,
  onToggleSelectMenu,
  onToggleSelectMode,
  onDeleteSelectedChats,
  onDeleteConversation,
  onResolveSelection,
  onConversationClick,
  onToggleSelectForDeletion,
  hasMoreConversations,
  onLoadMoreConversations,
  getUnreadCount,
  getConversationAvatarText,
  getConversationDisplayName,
  formatConversationTime
}) => {
  const [openConversationMenuId, setOpenConversationMenuId] = useState('');
  const selectedConversationId = String(selectedConversation?._id || '').trim();
  const selectedForDeletionSet = useMemo(
    () => new Set((Array.isArray(selectedForDeletion) ? selectedForDeletion : []).map((id) => String(id || '').trim())),
    [selectedForDeletion]
  );

  useEffect(() => {
    if (!openConversationMenuId) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      const menu = document.querySelector('.conversation-row-menu[role="menu"]');
      if (menu && menu.contains(target)) return;
      setOpenConversationMenuId('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openConversationMenuId]);

  const handleConversationClick = useCallback(
    (conversation, options = {}) => {
      const conversationId = String(conversation?._id || '').trim();
      if (!conversationId) return;

      if (options?.toggleMenu) {
        setOpenConversationMenuId((prev) => (prev === conversationId ? '' : conversationId));
        return;
      }

      setOpenConversationMenuId('');
      onConversationClick(conversation);
    },
    [onConversationClick]
  );

  const handleEndReached = useCallback(() => {
    if (!hasMoreConversations || loadingMoreConversations) return;
    Promise.resolve(onLoadMoreConversations?.()).catch(() => {
      // no-op: loading state is managed by the parent
    });
  }, [hasMoreConversations, loadingMoreConversations, onLoadMoreConversations]);

  const footer = useMemo(
    () =>
      function Footer() {
        if (!hasMoreConversations) return null;
        return (
          <div className="conversation-load-more-wrap">
            <button
              type="button"
              className="conversation-load-more-btn"
              onClick={onLoadMoreConversations}
              disabled={loadingMoreConversations}
            >
              {loadingMoreConversations ? 'Loading more...' : 'Load more conversations'}
            </button>
          </div>
        );
      },
    [hasMoreConversations, loadingMoreConversations, onLoadMoreConversations]
  );

  const itemContent = useCallback(
    (_index, conversation) => (
      <ConversationRow
        conversation={conversation}
        selectedConversationId={selectedConversationId}
        showSelectMode={showSelectMode}
        selectedForDeletionSet={selectedForDeletionSet}
        openConversationMenuId={openConversationMenuId}
        onConversationClick={handleConversationClick}
        onDeleteConversation={onDeleteConversation}
        onToggleSelectForDeletion={onToggleSelectForDeletion}
        getUnreadCount={getUnreadCount}
        getConversationAvatarText={getConversationAvatarText}
        getConversationDisplayName={getConversationDisplayName}
        formatConversationTime={formatConversationTime}
      />
    ),
    [
      getConversationAvatarText,
      getConversationDisplayName,
      getUnreadCount,
      handleConversationClick,
      onDeleteConversation,
      onToggleSelectForDeletion,
      openConversationMenuId,
      selectedConversationId,
      selectedForDeletionSet,
      showSelectMode,
      formatConversationTime
    ]
  );

  const computeItemKey = useCallback((index, conversation) => {
    return String(conversation?._id || conversation?.id || index).trim();
  }, []);

  return (
    <div className="inbox-sidebar">
      <div className="inbox-header">
        <h2>Team Inbox</h2>
        <div className="inbox-actions">
          <div className={`connection-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />

          <div className="inbox-header-menu">
            <button
              className="icon-btn"
              type="button"
              aria-label="Filter conversations"
              title="Filter conversations"
              onClick={onToggleFilterMenu}
            >
              <Filter size={18} />
            </button>
            {showFilterMenu && (
              <div className="inbox-select-menu">
                <button className="select-menu-item" onClick={() => onSelectFilter('all')}>
                  All Chats
                </button>
                <button className="select-menu-item" onClick={() => onSelectFilter('unread')}>
                  Unread
                </button>
                <button className="select-menu-item" onClick={() => onSelectFilter('read')}>
                  Read
                </button>
              </div>
            )}
          </div>

          <div className="inbox-header-menu">
            <button
              className="icon-btn"
              type="button"
              aria-label="Inbox actions"
              title="Inbox actions"
              onClick={onToggleSelectMenu}
            >
              <MoreVertical size={18} />
            </button>

            {showSelectMenu && (
              <div className="inbox-select-menu">
                <button className="select-menu-item" onClick={onToggleSelectMode}>
                  {showSelectMode ? 'Cancel Select' : 'Select Chat'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="search-bar">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          ref={searchInputRef}
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
        {refreshing ? (
          <div className="conversation-refresh-indicator" aria-live="polite">
            Refreshing...
          </div>
        ) : null}
      </div>

      <div className="conversation-list">
        {loading ? (
          <div className="loading">Loading conversations...</div>
        ) : (
          <>
            {showSelectMode && (
              <div className="selection-actions">
                <button
                  className="delete-selected-btn"
                  onClick={onDeleteSelectedChats}
                  disabled={selectedForDeletion.length === 0}
                  style={{ opacity: selectedForDeletion.length === 0 ? 0.5 : 1 }}
                >
                  Delete Selected ({selectedForDeletion.length})
                </button>
                <button className="resolve-btn" onClick={onResolveSelection}>
                  Resolve
                </button>
              </div>
            )}

            {filteredConversations.length === 0 ? (
              <div className="conversation-empty-state" role="status" aria-live="polite">
                <h4 className="conversation-empty-title">
                  {String(searchTerm || '').trim()
                    ? 'No conversations match your search'
                    : 'No conversations found'}
                </h4>
                <p className="conversation-empty-copy">
                  {String(searchTerm || '').trim()
                    ? 'Try a different keyword or clear filters to see more chats.'
                    : 'New chats will appear here once customers start messaging your team.'}
                </p>
                <div className="conversation-empty-actions">
                  {String(searchTerm || '').trim() && (
                    <button
                      type="button"
                      className="conversation-empty-btn"
                      onClick={() => onSearchTermChange('')}
                    >
                      Clear Search
                    </button>
                  )}
                  <button
                    type="button"
                    className="conversation-empty-btn conversation-empty-btn--ghost"
                    onClick={() => onSelectFilter('all')}
                  >
                    Show All Chats
                  </button>
                </div>
              </div>
            ) : (
              <Virtuoso
                style={{ height: '100%' }}
                data={filteredConversations}
                computeItemKey={computeItemKey}
                itemContent={itemContent}
                endReached={handleEndReached}
                increaseViewportBy={220}
                defaultItemHeight={88}
                components={{ Footer: footer }}
                className="conversation-virtuoso"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ConversationSidebar);
