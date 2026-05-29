import React from 'react';

const ConversationEmptyState = ({
  searchTerm = '',
  onSearchTermChange,
  onSelectFilter
}) => {
  return (
    <div className="conversation-empty-state" role="status" aria-live="polite">
      <h4 className="conversation-empty-title">
        {String(searchTerm || '').trim() ? 'No conversations match your search' : 'No conversations found'}
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
            onClick={() => onSearchTermChange?.('')}
          >
            Clear Search
          </button>
        )}
        <button
          type="button"
          className="conversation-empty-btn conversation-empty-btn--ghost"
          onClick={() => onSelectFilter?.('all')}
        >
          Show All Chats
        </button>
      </div>
    </div>
  );
};

export default React.memo(ConversationEmptyState);
