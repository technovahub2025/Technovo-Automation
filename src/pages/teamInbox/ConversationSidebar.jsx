import React, { useEffect, useRef, useState } from 'react';
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
import { getConversationPreviewMeta } from './teamInboxDisplayUtils';

const ConversationSidebar = ({
  wsConnected,
  filterMenuRef,
  inboxMenuRef,
  showFilterMenu,
  showSelectMenu,
  showSelectMode,
  selectedForDeletion,
  loading,
  filteredConversations,
  selectedConversation,
  searchTerm,
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
  getUnreadCount,
  getConversationAvatarText,
  getConversationDisplayName,
  formatConversationTime
}) => {
  const [openConversationMenuId, setOpenConversationMenuId] = useState('');
  const activeConversationMenuRef = useRef(null);

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

  useEffect(() => {
    if (!openConversationMenuId) return undefined;

    const handlePointerDown = (event) => {
      if (activeConversationMenuRef.current?.contains(event.target)) return;
      setOpenConversationMenuId('');
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openConversationMenuId]);

  useEffect(() => {
    if (!showSelectMode) return;
    setOpenConversationMenuId('');
  }, [showSelectMode]);

  useEffect(() => {
    if (!openConversationMenuId) return;
    const menuStillVisible = filteredConversations.some(
      (conversation) => String(conversation?._id || '').trim() === openConversationMenuId
    );
    if (!menuStillVisible) {
      setOpenConversationMenuId('');
    }
  }, [filteredConversations, openConversationMenuId]);

  return (
    <div className="inbox-sidebar">
      <div className="inbox-header">
        <h2>Team Inbox</h2>
        <div className="inbox-actions">
          <div className={`connection-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />

          <div className="inbox-header-menu" ref={filterMenuRef}>
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

          <div className="inbox-header-menu" ref={inboxMenuRef}>
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
          onChange={(event) => onSearchTermChange(event.target.value)}
        />
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

            {filteredConversations.map((conversation) => {
              const unreadCount = getUnreadCount(conversation);
              const conversationId = String(conversation?._id || '').trim();
              const isConversationMenuOpen = openConversationMenuId === conversationId;
              const previewMeta = getConversationPreviewMeta(conversation);

              return (
                <div
                  key={conversationId}
                  className={`conversation-item ${selectedConversation?._id === conversationId ? 'active' : ''} ${showSelectMode ? 'select-mode' : ''} ${unreadCount > 0 ? 'has-unread' : ''} ${isConversationMenuOpen ? 'menu-open' : ''}`}
                  onClick={() => {
                    if (showSelectMode) {
                      onToggleSelectForDeletion(conversationId);
                      return;
                    }
                    setOpenConversationMenuId('');
                    onConversationClick(conversation);
                  }}
                >
                  {showSelectMode && (
                    <div className="select-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedForDeletion.includes(conversationId)}
                        onChange={() => onToggleSelectForDeletion(conversationId)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                  )}

                  <div className="avatar">{getConversationAvatarText(conversation)}</div>

                  <div className="conversation-info">
                    <div className="conversation-top">
                      <span className="name">{getConversationDisplayName(conversation)}</span>
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
                                  setOpenConversationMenuId((prev) =>
                                    prev === conversationId ? '' : conversationId
                                  );
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
                                      setOpenConversationMenuId('');
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
                          <CheckCheck
                            size={14}
                            className="conversation-preview-status-icon"
                            aria-hidden="true"
                          />
                        )}
                        {previewMeta.isMedia && renderConversationMediaIcon(previewMeta.mediaType)}
                        <p className="preview">{previewMeta.previewText}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export default ConversationSidebar;
