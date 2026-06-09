import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, MoreVertical, Trash2, CheckCheck, UserRound, Bell } from 'lucide-react';
import ConversationListContainer from './inbox/components/ConversationListContainer';

const isIdLikeLabel = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  if (/^[0-9a-f]{24}$/i.test(normalized)) return true;
  if (/^\d{8,}$/.test(normalized)) return true;
  return false;
};

const resolveAgentOptionLabel = (agent = {}, fallbackLabel = 'Agent') => {
  const companyRole = String(agent?.companyRole || agent?.role || '').trim().toLowerCase();
  const label = String(
    agent?.label || agent?.displayName || agent?.name || agent?.fullName || agent?.email || ''
  ).trim();
  if (label && !isIdLikeLabel(label)) return label;
  if (companyRole === 'admin') return 'Admin';
  return fallbackLabel;
};

const ConversationSidebar = ({
  wsConnected,
  loading,
  loadingMoreConversations,
  hasMoreConversations,
  conversationListExhausted,
  showFilterMenu,
  showSelectMenu,
  showInboxNotificationsMenu,
  showSelectMode,
  selectedForDeletion,
  bulkAssignTarget,
  bulkAssignBusy,
  filteredConversations,
  selectedConversation,
  searchTerm,
  searchInputRef,
  onSearchTermChange,
  onToggleFilterMenu,
  onSelectFilter,
  onToggleSelectMenu,
  onToggleInboxNotificationsMenu,
  onToggleSelectMode,
  onDeleteSelectedChats,
  onDeleteConversation,
  onResolveSelection,
  onConversationClick,
  onToggleSelectForDeletion,
  onLoadMoreConversations,
  getUnreadCount,
  getConversationAvatarText,
  getConversationDisplayName,
  formatConversationTime,
  onAssignConversation,
  canAssignChats = false,
  currentUserId = '',
  availableAgents = [],
  setBulkAssignTarget,
  onBulkAssignSelectedChats,
  inboxView = 'all',
  inboxFilterOptions = [],
  onInboxViewChange,
  inboxFilterTitle = 'Chat Filters',
  inboxFilterDescription = '',
  inboxWorkspaceLabel = '',
  inboxWorkspaceHint = '',
  inboxNotifications = [],
  onClearInboxNotifications
}) => {
  const [openConversationMenuId, setOpenConversationMenuId] = useState('');
  const [showAdminActionsMenu, setShowAdminActionsMenu] = useState(false);
  const inboxNotificationMenuRef = useRef(null);
  const bulkAssignSelectRef = useRef(null);
  const displayableAgents = useMemo(() => {
    return (Array.isArray(availableAgents) ? availableAgents : []).map((agent) => {
      const agentId = String(agent?.id || agent?._id || agent?.userId || '').trim();
      const agentLabel = resolveAgentOptionLabel(agent, 'Agent');

      return {
        ...agent,
        id: agentId || agent?.id || agent?._id || agent?.userId,
        _id: agentId || agent?._id || agent?.id || agent?.userId,
        userId: agentId || agent?.userId || agent?.id || agent?._id,
        label: agentLabel,
        displayName: agentLabel,
        name: agentLabel
      };
    });
  }, [availableAgents]);

  const selectedConversationId = String(selectedConversation?._id || '').trim();
  const selectedForDeletionSet = useMemo(
    () => new Set((Array.isArray(selectedForDeletion) ? selectedForDeletion : []).map((id) => String(id || '').trim())),
    [selectedForDeletion]
  );

  useEffect(() => {
    if (!showAdminActionsMenu) return undefined;
    if (!canAssignChats) return undefined;
    const timer = window.setTimeout(() => {
      bulkAssignSelectRef.current?.focus?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showAdminActionsMenu, canAssignChats]);

  useEffect(() => {
    if (!showInboxNotificationsMenu) return undefined;

    const handlePointerDown = (event) => {
      const target = event?.target;
      if (!target) return;
      const menu = inboxNotificationMenuRef.current;
      if (menu && menu.contains(target)) return;
      onToggleInboxNotificationsMenu?.();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onToggleInboxNotificationsMenu, showInboxNotificationsMenu]);

  const handleConversationClick = useCallback(
    (conversation, options = {}) => {
      const conversationId = String(conversation?._id || '').trim();
      if (!conversationId) return;

      if (options?.toggleMenu) {
        setOpenConversationMenuId((current) => (current === conversationId ? '' : conversationId));
        return;
      }

      setOpenConversationMenuId('');
      onConversationClick?.(conversation);
    },
    [onConversationClick]
  );

  const handleSelectChatToggle = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setShowAdminActionsMenu(false);
    setOpenConversationMenuId('');
    onToggleSelectMode?.();
  }, [onToggleSelectMode]);

  return (
    <div className="inbox-sidebar">
      <div className="inbox-header">
        <h2>Team Inbox</h2>
        <div className="inbox-actions">
          <div className={`connection-indicator ${wsConnected ? 'connected' : 'disconnected'}`} />

          <div className="inbox-header-menu inbox-header-menu--alerts" ref={inboxNotificationMenuRef}>
            <button
              className={`icon-btn inbox-alerts-btn ${
                Array.isArray(inboxNotifications) && inboxNotifications.length > 0 ? 'has-alerts' : ''
              }`}
              type="button"
              aria-label="Inbox notifications"
              title="Inbox notifications"
              onClick={onToggleInboxNotificationsMenu}
            >
              <Bell size={18} />
              {Array.isArray(inboxNotifications) && inboxNotifications.length > 0 ? (
                <span className="inbox-alerts-badge">
                  {inboxNotifications.length > 9 ? '9+' : inboxNotifications.length}
                </span>
              ) : null}
            </button>
            {showInboxNotificationsMenu ? (
              <div className="inbox-select-menu inbox-notification-menu" role="menu">
                <div className="inbox-notification-menu__header">
                  <strong>Inbox alerts</strong>
                  <button
                    type="button"
                    className="select-menu-item inbox-notification-menu__clear"
                    onClick={() => onClearInboxNotifications?.()}
                    disabled={!Array.isArray(inboxNotifications) || inboxNotifications.length === 0}
                  >
                    Clear
                  </button>
                </div>
                {Array.isArray(inboxNotifications) && inboxNotifications.length > 0 ? (
                  <div className="inbox-notification-menu__list">
                    {inboxNotifications.map((notification) => (
                      <div
                        key={notification?.id}
                        className={`inbox-notification-menu__item inbox-notification-menu__item--${String(notification?.tone || 'info').trim()}`}
                      >
                        <span className="inbox-notification-menu__message">
                          {String(notification?.message || '')
                            .replace(/\b[0-9a-f]{24}\b/gi, 'Agent')
                            .replace(/\b\d{8,}\b/g, 'Agent')}
                        </span>
                        <span className="inbox-notification-menu__meta">
                          {formatConversationTime(notification?.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inbox-notification-menu__empty">No recent alerts</div>
                )}
              </div>
            ) : null}
          </div>

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
              <div className="inbox-select-menu inbox-filter-menu">
                <div className="inbox-filter-menu__header">
                  <strong>{inboxFilterTitle || 'Chat Filters'}</strong>
                  <span>{inboxFilterDescription || 'Role-aware queue and workload filters'}</span>
                </div>
                <div className="inbox-filter-menu__list">
                  {(Array.isArray(inboxFilterOptions) ? inboxFilterOptions : []).map((option) => {
                    const isActive =
                      String(inboxView || '').trim().toLowerCase() ===
                      String(option?.value || '').trim().toLowerCase();
                    return (
                      <button
                        key={`inbox-filter-menu-${option.value}`}
                        className={`select-menu-item inbox-filter-menu__item ${isActive ? 'is-active' : ''} ${
                          option?.disabled ? 'is-disabled' : ''
                        }`.trim()}
                        onClick={() => {
                          if (option?.disabled) return;
                          onInboxViewChange?.(option.value);
                          onToggleFilterMenu?.();
                        }}
                        disabled={Boolean(option?.disabled)}
                      >
                        <span>{option?.label}</span>
                        <span className="inbox-filter-menu__count">{Number(option?.count || 0)}</span>
                      </button>
                    );
                  })}
                </div>
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
                <button
                  type="button"
                  className="select-menu-item"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={handleSelectChatToggle}
                >
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
      </div>

      <div className="conversation-list">
        {showSelectMode && (
          <div className="selection-actions">
            <div className="selection-actions__topbar">
              <div className="selection-actions__summary">
                Admin actions
                <strong>{selectedForDeletion.length}</strong>
              </div>
              <div className="selection-actions__eyebrow">
                Reassign selected chats or resolve them in one place.
              </div>
            </div>
            <div className="selection-actions__toolbar">
              <button
                type="button"
                className="selection-actions__trigger"
                onClick={() => setShowAdminActionsMenu((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={showAdminActionsMenu}
              >
                <MoreVertical size={16} />
                <span>Admin actions</span>
              </button>
              {canAssignChats ? (
                <button
                  type="button"
                  className="selection-actions__quick"
                  onClick={() => setShowAdminActionsMenu(true)}
                >
                  <UserRound size={14} />
                  <span>Bulk assign</span>
                </button>
              ) : null}
              {showAdminActionsMenu ? (
                <div className="selection-actions-menu" role="menu">
                  <button
                    type="button"
                    className="selection-actions-menu__item"
                    onClick={() => {
                      setShowAdminActionsMenu(false);
                      onDeleteSelectedChats?.();
                    }}
                    disabled={selectedForDeletion.length === 0}
                  >
                    <Trash2 size={14} />
                    <span>Delete selected</span>
                  </button>
                  <button
                    type="button"
                    className="selection-actions-menu__item"
                    onClick={() => {
                      setShowAdminActionsMenu(false);
                      onResolveSelection?.();
                    }}
                    disabled={selectedForDeletion.length === 0}
                  >
                    <CheckCheck size={14} />
                    <span>Resolve selected</span>
                  </button>
                  {canAssignChats ? <div className="selection-actions-menu__divider" /> : null}
                  {canAssignChats ? (
                    <>
                      <label className="selection-actions-menu__label">
                        Reassign to
                        <select
                          className="lead-stage-select bulk-assign-select bulk-assign-select--menu"
                          value={bulkAssignTarget}
                          onChange={(event) => setBulkAssignTarget?.(event.target.value)}
                          disabled={bulkAssignBusy}
                          ref={bulkAssignSelectRef}
                        >
                          <option value="">Choose agent</option>
                          {Array.isArray(displayableAgents)
                            ? displayableAgents.map((agent) => {
                                const agentId = String(agent?.id || agent?._id || agent?.userId || '').trim();
                                const agentLabel = resolveAgentOptionLabel(agent, 'Agent');
                                if (!agentId) return null;
                                return (
                                  <option key={`bulk-agent-${agentId}`} value={agentId}>
                                    {agentLabel}
                                  </option>
                                );
                              })
                            : null}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="selection-actions-menu__item selection-actions-menu__item--primary"
                        onClick={async () => {
                          setShowAdminActionsMenu(false);
                          await onBulkAssignSelectedChats?.(bulkAssignTarget);
                        }}
                        disabled={
                          bulkAssignBusy ||
                          selectedForDeletion.length === 0 ||
                          !String(bulkAssignTarget || '').trim()
                        }
                      >
                        <UserRound size={14} />
                        <span>{bulkAssignBusy ? 'Reassigning...' : 'Reassign selected'}</span>
                      </button>
                      <button
                        type="button"
                        className="selection-actions-menu__item selection-actions-menu__item--ghost"
                        onClick={async () => {
                          setShowAdminActionsMenu(false);
                          await onBulkAssignSelectedChats?.(currentUserId);
                        }}
                        disabled={
                          bulkAssignBusy ||
                          selectedForDeletion.length === 0 ||
                          !String(currentUserId || '').trim()
                        }
                      >
                        <UserRound size={14} />
                        <span>Assign to me</span>
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            {canAssignChats ? (
              <p className="selection-actions__hint">
                Admins can reassign selected chats to an active agent or take ownership themselves.
              </p>
            ) : null}
          </div>
        )}

        <ConversationListContainer
          conversations={filteredConversations}
          loading={loading}
          loadingMoreConversations={loadingMoreConversations}
        hasMoreConversations={hasMoreConversations}
        conversationListExhausted={conversationListExhausted}
        onLoadMoreConversations={onLoadMoreConversations}
          selectedConversationId={selectedConversationId}
          showSelectMode={showSelectMode}
          selectedForDeletion={selectedForDeletion}
          openConversationMenuId={openConversationMenuId}
          onConversationClick={handleConversationClick}
          onDeleteConversation={onDeleteConversation}
          onToggleSelectForDeletion={onToggleSelectForDeletion}
          onAssignConversation={onAssignConversation}
          onCloseConversationMenu={() => setOpenConversationMenuId('')}
          getUnreadCount={getUnreadCount}
          getConversationAvatarText={getConversationAvatarText}
          getConversationDisplayName={getConversationDisplayName}
          formatConversationTime={formatConversationTime}
          canAssignChats={canAssignChats}
          currentUserId={currentUserId}
          availableAgents={availableAgents}
          onBulkAssignSelectedChats={onBulkAssignSelectedChats}
          bulkAssignBusy={bulkAssignBusy}
        />
      </div>
    </div>
  );
};

export default memo(ConversationSidebar);
