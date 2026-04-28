import React from 'react';
import { FileText } from 'lucide-react';
import BroadcastCard from './BroadcastCard';
import './BroadcastTable.css';

const BroadcastTable = ({
  broadcasts,
  selectionMode,
  selectedCampaigns,
  onSelectAll,
  onCheckboxChange,
  getSuccessPercentage,
  getReadPercentage,
  getRepliedPercentage,
  getStatusClass,
  onPauseBroadcast,
  onResumeBroadcast,
  onCancelBroadcast,
  onDeleteClick,
  onViewAnalytics
}) => {
  if (broadcasts.length === 0) {
    return (
      <div className="no-campaigns">
        <div className="no-campaigns-content">
          <FileText size={48} />
          <h3>No campaigns found</h3>
          <p>Start by creating your first broadcast campaign</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {selectionMode && (
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  onChange={onSelectAll}
                  checked={broadcasts.length > 0 && selectedCampaigns.length === broadcasts.length}
                />
              </th>
            )}
            <th className="col-name">Campaign Name</th>
            <th className="col-time">Scheduled Time</th>
            <th>Successful</th>
            <th>Read</th>
            <th>Replied</th>
            <th className="col-recipients">Recipients</th>
            <th className="col-failed">Failed</th>
            <th className="col-reliability">Suppressed</th>
            <th className="col-reliability">Deferred</th>
            <th className="col-reliability">Retried</th>
            <th className="col-status">Status</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>

        <tbody>
          {broadcasts.map((broadcast) => (
            <BroadcastCard
              key={broadcast._id}
              broadcast={broadcast}
              selectionMode={selectionMode}
              selectedCampaigns={selectedCampaigns}
              onCheckboxChange={onCheckboxChange}
              getSuccessPercentage={getSuccessPercentage}
              getReadPercentage={getReadPercentage}
              getRepliedPercentage={getRepliedPercentage}
              getStatusClass={getStatusClass}
              onPauseBroadcast={onPauseBroadcast}
              onResumeBroadcast={onResumeBroadcast}
              onCancelBroadcast={onCancelBroadcast}
              onDeleteClick={onDeleteClick}
              onViewAnalytics={onViewAnalytics}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BroadcastTable;
