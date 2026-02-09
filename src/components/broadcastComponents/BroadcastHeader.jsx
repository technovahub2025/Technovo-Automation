import React from 'react';
import './BroadcastHeader.css';

const BroadcastHeader = ({ activeTab, onShowBroadcastTypeChoice }) => {
  return (
    <div className="page-header">
      <div>
        <h2>Broadcasts</h2>
        <p>Manage your bulk message campaigns</p>
      </div>

      {activeTab === 'overview' && (
        <button className="primary-btn" onClick={onShowBroadcastTypeChoice}>
          New Broadcast
        </button>
      )}
    </div>
  );
};

export default BroadcastHeader;
