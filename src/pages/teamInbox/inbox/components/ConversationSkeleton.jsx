import React from 'react';

const ConversationSkeleton = ({ count = 6 }) => {
  return (
    <div className="conversation-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`conversation-skeleton-${index}`} className="conversation-item conversation-item--skeleton">
          <div className="avatar conversation-skeleton__avatar" />
          <div className="conversation-info conversation-skeleton__info">
            <div className="conversation-top">
              <div className="conversation-name-row">
                <span className="conversation-skeleton__line conversation-skeleton__line--name" />
                <span className="conversation-skeleton__chip" />
              </div>
              <div className="conversation-meta-right">
                <span className="conversation-skeleton__line conversation-skeleton__line--time" />
                <span className="conversation-skeleton__line conversation-skeleton__line--badge" />
              </div>
            </div>
            <div className="conversation-bottom">
              <div className="conversation-preview-line">
                <span className="conversation-skeleton__line conversation-skeleton__line--preview" />
              </div>
            </div>
            <div className="conversation-operator-meta">
              <span className="conversation-skeleton__pill" />
              <span className="conversation-skeleton__pill conversation-skeleton__pill--wide" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default React.memo(ConversationSkeleton);
