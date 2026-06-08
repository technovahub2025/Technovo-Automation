import React, { memo, useRef } from 'react';
import { ChevronDown, CheckCheck, Trash2, UserRound, Image as ImageIcon, FileText, Video, Mic } from 'lucide-react';
import { getConversationPreviewMeta, resolveConversationAssigneeLabel, resolveConversationSlaMeta } from '../../teamInboxDisplayUtils';
import { getLeadStageLabel, getLeadStageValue } from '../../teamInboxUtils';

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

const ConversationRow = ({
  conversation,
  selectedConversationId,
  showSelectMode,
  selectedForDeletionSet,
  openConversationMenuId,
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
  availableAgents = []
}) => {
  const activeConversationMenuRef = useRef(null);
  const conversationId = String(conversation?._id || '').trim();
  const isConversationMenuOpen = !showSelectMode && openConversationMenuId === conversationId;
  const unreadCount = getUnreadCount(conversation);
  const leadScoreRaw = Number(conversation?.contactId?.leadScore ?? conversation?.leadScore ?? 0);
  const leadScore = Number.isFinite(leadScoreRaw) ? Math.max(0, Math.round(leadScoreRaw)) : 0;
  const previewMeta = getConversationPreviewMeta(conversation);
  const slaMeta = resolveConversationSlaMeta(conversation);
  const assigneeLabel = resolveConversationAssigneeLabel(conversation, availableAgents);
  const leadStageValue = getLeadStageValue(conversation);
  const leadStageLabel = getLeadStageLabel(conversation);
  const leadStageTone = String(leadStageValue || '').trim().toLowerCase();
  const conversationTags = Array.isArray(conversation?.contactId?.tags)
    ? conversation.contactId.tags.map((tag) => String(tag || '').trim()).filter(Boolean).slice(0, 3)
    : [];
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
        onConversationClick?.(conversation);
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
                      {canAssignChats && currentUserId ? (
                        <button
                          className="select-menu-item conversation-row-menu-item assign"
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAssignConversation?.(conversationId, currentUserId);
                            onCloseConversationMenu?.();
                          }}
                        >
                          <UserRound size={16} strokeWidth={2} />
                          <span>Assign to me</span>
                        </button>
                      ) : null}
                      <button
                        className="select-menu-item conversation-row-menu-item danger"
                        type="button"
                        role="menuitem"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteConversation?.(conversation);
                          onCloseConversationMenu?.();
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
        <div className="conversation-operator-meta conversation-operator-meta--inbox">
          <span
            className="conversation-operator-chip conversation-operator-chip--assignee"
            title={`Assigned agent: ${assigneeLabel}`}
          >
            {assigneeLabel}
          </span>
          <span
            className={`conversation-operator-chip conversation-operator-chip--lead conversation-operator-chip--${leadStageTone}`}
            title={`Lead stage: ${leadStageLabel}`}
          >
            {leadStageLabel}
          </span>
          {conversationTags.map((tag) => (
            <span
              key={`${conversationId}-${tag}`}
              className="conversation-operator-chip conversation-operator-chip--tag"
              title={tag}
            >
              {tag}
            </span>
          ))}
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
};

const areConversationRowPropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.conversation === nextProps.conversation &&
    prevProps.selectedConversationId === nextProps.selectedConversationId &&
    prevProps.showSelectMode === nextProps.showSelectMode &&
    prevProps.selectedForDeletionSet === nextProps.selectedForDeletionSet &&
    prevProps.openConversationMenuId === nextProps.openConversationMenuId &&
    prevProps.onConversationClick === nextProps.onConversationClick &&
    prevProps.onDeleteConversation === nextProps.onDeleteConversation &&
    prevProps.onToggleSelectForDeletion === nextProps.onToggleSelectForDeletion &&
    prevProps.onAssignConversation === nextProps.onAssignConversation &&
    prevProps.onCloseConversationMenu === nextProps.onCloseConversationMenu &&
    prevProps.getUnreadCount === nextProps.getUnreadCount &&
    prevProps.getConversationAvatarText === nextProps.getConversationAvatarText &&
    prevProps.getConversationDisplayName === nextProps.getConversationDisplayName &&
    prevProps.formatConversationTime === nextProps.formatConversationTime &&
    prevProps.canAssignChats === nextProps.canAssignChats &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.availableAgents === nextProps.availableAgents
  );
};

export default memo(ConversationRow, areConversationRowPropsEqual);
