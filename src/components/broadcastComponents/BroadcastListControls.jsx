import React from 'react';
import { RefreshCw, Search } from 'lucide-react';
import './Broadcastlistcontrols.css';

const BroadcastListControls = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  reliabilityFilter = 'all',
  onReliabilityFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onRefresh,
  totalBroadcasts = 0,
  formatLastUpdated,
  selectedPreset = 'all',
  onApplyPreset
}) => {
  const presets = [
    { key: 'all', label: 'All Campaigns' },
    { key: 'needs_retry', label: 'Needs Retry' },
    { key: 'suppressed', label: 'Suppressed' },
    { key: 'high_risk', label: 'High Risk' }
  ];

  return (
    <div className="broadcast-list-controls-wati">
      <div className="preset-row">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`preset-chip ${selectedPreset === preset.key ? 'active' : ''}`}
            onClick={() => onApplyPreset?.(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="controls-header">
        <div className="controls-title">
          <h3>Broadcast list ({totalBroadcasts})</h3>
        </div>

        <div className="controls-actions">
          <div className="search-control">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={searchTerm || ''}
              onChange={onSearchChange}
              className="search-input-wati"
              placeholder="Search campaigns"
            />
          </div>

          <div className="sorted-by-control">
            <label>Status</label>
            <select
              className="sorted-select"
              value={statusFilter || 'all'}
              onChange={(event) => onStatusFilterChange?.(event.target.value)}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="sending">Sending</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sorted-by-control">
            <label>Reliability</label>
            <select
              className="sorted-select"
              value={reliabilityFilter || 'all'}
              onChange={(event) => onReliabilityFilterChange?.(event.target.value)}
            >
              <option value="all">All</option>
              <option value="any">Any event</option>
              <option value="suppressed">Suppressed &gt; 0</option>
              <option value="deferred">Deferred &gt; 0</option>
              <option value="retried">Retried &gt; 0</option>
            </select>
          </div>

          <div className="sorted-by-control">
            <label>Sort</label>
            <select
              className="sorted-select"
              value={sortBy || 'createdAt'}
              onChange={(event) => onSortByChange?.(event.target.value)}
            >
              <option value="createdAt">Latest</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="recipientCount">Recipients</option>
              <option value="suppressedCount">Suppressed</option>
              <option value="deferredCount">Deferred</option>
              <option value="retriedCount">Retried</option>
            </select>
          </div>

          <div className="sorted-by-control">
            <label>Order</label>
            <select
              className="sorted-select"
              value={sortOrder || 'desc'}
              onChange={(event) => onSortOrderChange?.(event.target.value)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="updated-badge">
            <span>{typeof formatLastUpdated === 'function' ? formatLastUpdated() : 'Updated recently'}</span>
            <button
              type="button"
              className="refresh-icon-btn"
              onClick={() => onRefresh?.()}
              title="Refresh list"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastListControls;
