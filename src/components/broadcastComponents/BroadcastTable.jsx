import React from 'react';
import { FileText, BarChart, Eye, Square, Trash2 } from 'lucide-react';
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
            <th>Campaign Name</th>
            <th>Scheduled Time</th>
            <th>Successful</th>
            <th>Read</th>
            <th>Replied</th>
            <th>Recipients</th>
            <th>Failed</th>
            <th>Status</th>
            <th>Actions</th>
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
