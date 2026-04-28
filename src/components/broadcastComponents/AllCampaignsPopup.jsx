import React, { useEffect, useRef, useState } from 'react';
import { X, Search, Filter, LineChart, Eye, Square, Trash2, FileText, ArrowUpDown } from 'lucide-react';
import './Modal.css';

const AllCampaignsPopup = ({
  showAllCampaignsPopup,
  broadcasts,
  filteredBroadcasts,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showFilterDropdown,
  onFilterDropdownToggle,
  onClose,
  getReadPercentage,
  getStatusClass,
  onViewAnalytics,
  onStopBroadcast,
  onDeleteClick
}) => {
  const FILTER_STATE_KEY = 'broadcast:all-campaigns:filters:v1';
  const searchInputRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({ key: 'scheduledTime', direction: 'desc' });

  const toNumber = (value) => {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const getPolicyMeta = (broadcast) => {
    const retrySummary = broadcast?.retrySummary || {};
    const deliveryPolicy = retrySummary.deliveryPolicy || broadcast?.deliveryPolicy || {};
    const quietHours = deliveryPolicy?.quietHours || {};
    const retryPolicy = retrySummary.retryPolicy || broadcast?.retryPolicy || {};
    const compliancePolicy = retrySummary.compliancePolicy || broadcast?.compliancePolicy || {};
    const suppressionListCount = Array.isArray(compliancePolicy?.suppressionListPhones)
      ? compliancePolicy.suppressionListPhones.length
      : toNumber(compliancePolicy?.suppressionListCount);

    const quietHoursLabel = quietHours?.enabled
      ? `Quiet ${toNumber(quietHours?.startHour)}:00-${toNumber(quietHours?.endHour)}:00`
      : 'Quiet Hrs Off';
    const retryLabel =
      retryPolicy?.enabled === false
        ? 'Retry Off'
        : `Retry x${Math.max(1, toNumber(retryPolicy?.maxAttempts || 1))}`;
    const optOutLabel = compliancePolicy?.respectOptOut === false ? 'Opt-out Off' : 'Opt-out On';

    return {
      quietHoursEnabled: Boolean(quietHours?.enabled),
      retryEnabled: retryPolicy?.enabled !== false,
      respectOptOut: compliancePolicy?.respectOptOut !== false,
      suppressionListCount,
      quietHoursLabel,
      retryLabel,
      optOutLabel
    };
  };

  const getScheduledDisplay = (broadcast) => {
    const value = broadcast?.scheduledAt || broadcast?.startedAt || broadcast?.createdAt || null;
    if (!value) return 'Immediate';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Immediate';
    return parsed.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const statusCounts = broadcasts.reduce(
    (acc, item) => {
      const raw = String(item?.status || '').trim().toLowerCase();
      const normalized = raw === 'running' ? 'sending' : raw;
      acc.all += 1;
      if (Object.prototype.hasOwnProperty.call(acc, normalized)) {
        acc[normalized] += 1;
      }
      return acc;
    },
    { all: 0, scheduled: 0, sending: 0, completed: 0 }
  );

  const statusQuickFilters = [
    { key: 'all', label: 'All' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'sending', label: 'Sending' },
    { key: 'completed', label: 'Completed' }
  ];

  const setSearchValue = (value) => {
    onSearchChange?.({ target: { value: String(value || '') } });
  };

  const getSortableValue = (broadcast, sortKey) => {
    switch (sortKey) {
      case 'campaignName':
        return String(broadcast?.name || '').toLowerCase();
      case 'status':
        return String(broadcast?.status || '').toLowerCase();
      case 'scheduledTime': {
        const dateValue = broadcast?.scheduledAt || broadcast?.startedAt || broadcast?.createdAt || null;
        const parsed = dateValue ? new Date(dateValue).getTime() : 0;
        return Number.isFinite(parsed) ? parsed : 0;
      }
      case 'recipients':
        return toNumber(broadcast?.recipientCount || broadcast?.recipients?.length || 0);
      case 'sent':
        return toNumber(broadcast?.stats?.sent || 0);
      case 'delivered':
        return toNumber(broadcast?.stats?.delivered || 0);
      case 'read':
        return toNumber(broadcast?.stats?.read || 0);
      default:
        return '';
    }
  };

  const sortedBroadcasts = [...filteredBroadcasts].sort((a, b) => {
    const aValue = getSortableValue(a, sortConfig.key);
    const bValue = getSortableValue(b, sortConfig.key);
    if (aValue === bValue) return 0;
    if (sortConfig.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'scheduledTime' ? 'desc' : 'asc' }
    );
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const handleClearFilters = () => {
    setSearchValue('');
    onStatusFilterChange?.('all');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(FILTER_STATE_KEY);
    }
  };

  useEffect(() => {
    if (!showAllCampaignsPopup || typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(FILTER_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.searchTerm === 'string') {
          setSearchValue(parsed.searchTerm);
        }
        if (typeof parsed.statusFilter === 'string') {
          onStatusFilterChange?.(parsed.statusFilter);
        }
      }
    } catch {
      // ignore invalid persisted filter state
    }
    // intentionally run only when popup opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllCampaignsPopup]);

  useEffect(() => {
    if (!showAllCampaignsPopup || typeof window === 'undefined') return;
    const payload = {
      searchTerm: String(searchTerm || ''),
      statusFilter: String(statusFilter || 'all')
    };
    window.sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(payload));
  }, [showAllCampaignsPopup, searchTerm, statusFilter]);

  useEffect(() => {
    if (!showAllCampaignsPopup || typeof window === 'undefined') return undefined;

    const isEditableTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = String(target.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key === '/' && !isEditableTarget(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
        return;
      }

      if (
        event.key === 'Enter' &&
        event.target === searchInputRef.current &&
        Array.isArray(sortedBroadcasts) &&
        sortedBroadcasts.length > 0
      ) {
        event.preventDefault();
        onViewAnalytics?.(sortedBroadcasts[0]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAllCampaignsPopup, onClose, onViewAnalytics, sortedBroadcasts]);

  useEffect(() => {
    if (!showAllCampaignsPopup || !showFilterDropdown || typeof window === 'undefined') return undefined;

    const handleOutsideClick = (event) => {
      if (!filterDropdownRef.current) return;
      if (!filterDropdownRef.current.contains(event.target)) {
        onFilterDropdownToggle?.();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showAllCampaignsPopup, showFilterDropdown, onFilterDropdownToggle]);

  if (!showAllCampaignsPopup) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content all-campaigns-popup" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>All Campaigns ({broadcasts.length})</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="status-summary-row">
            {statusQuickFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={statusFilter === item.key ? 'status-summary-chip active' : 'status-summary-chip'}
                onClick={() => onStatusFilterChange(item.key)}
              >
                <span>{item.label}</span>
                <strong>{statusCounts[item.key] || 0}</strong>
              </button>
            ))}
          </div>

          <div className="popup-controls">
            <div className="search-box">
              <Search size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={onSearchChange}
              />
            </div>
            
            <div className="filter-dropdown" ref={filterDropdownRef}>
              <button className="icon-btn" onClick={onFilterDropdownToggle} title="Filter campaigns">
                <Filter size={18} />
              </button>
              
              {showFilterDropdown && (
                <div className="filter-menu">
                  <div className="filter-section">
                    <h4>Status</h4>
                    <div className="filter-options">
                      {['all', 'scheduled', 'sending', 'completed'].map((status) => (
                        <label className="filter-option" key={status}>
                          <input
                            type="radio"
                            name="status"
                            value={status}
                            checked={statusFilter === status}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                          />
                          {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="popup-clear-btn"
              onClick={handleClearFilters}
              title="Clear search and status filters"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="campaigns-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('campaignName')}>
                      <span>Campaign Name {getSortIndicator('campaignName')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('status')}>
                      <span>Status {getSortIndicator('status')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('scheduledTime')}>
                      <span>Scheduled Time {getSortIndicator('scheduledTime')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('recipients')}>
                      <span>Recipients {getSortIndicator('recipients')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('sent')}>
                      <span>Sent {getSortIndicator('sent')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('delivered')}>
                      <span>Delivered {getSortIndicator('delivered')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>
                    <button type="button" className="sortable-th-btn" onClick={() => handleSort('read')}>
                      <span>Read {getSortIndicator('read')}</span>
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedBroadcasts.map((broadcast) => (
                  <tr key={broadcast._id}>
                    <td>{broadcast.name}</td>
                    <td>
                      <div className="status-with-policy">
                        <span className={`badge ${getStatusClass(broadcast.status)}`}>{broadcast.status}</span>
                        {(() => {
                          const policy = getPolicyMeta(broadcast);
                          return (
                            <div className="status-policy-row">
                              <span className={`policy-chip ${policy.quietHoursEnabled ? 'on' : 'off'}`}>{policy.quietHoursLabel}</span>
                              <span className={`policy-chip ${policy.retryEnabled ? 'on' : 'off'}`}>{policy.retryLabel}</span>
                              <span className={`policy-chip ${policy.respectOptOut ? 'on' : 'off'}`}>{policy.optOutLabel}</span>
                              {policy.suppressionListCount > 0 && (
                                <span className="policy-chip neutral">{`Suppression ${policy.suppressionListCount}`}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      {getScheduledDisplay(broadcast)}
                    </td>
                    <td>{broadcast.recipientCount || broadcast.recipients?.length || 0}</td>
                    <td>{broadcast.stats?.sent || 0}</td>
                    <td>{broadcast.stats?.delivered || 0}</td>
                    <td>
                      <span className={`read-count ${broadcast.stats?.read > 0 ? 'has-reads' : ''}`}>
                        {broadcast.stats?.read || 0}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn"
                          title="View Analytics"
                          onClick={() => onViewAnalytics?.(broadcast)}
                        >
                          <LineChart size={14} />
                        </button>
                        
                        <div className="eye-icon-container">
                          <button 
                            className="action-btn" 
                            title={`${broadcast.stats?.read || 0} members read this message`}
                          >
                            <Eye size={14} />
                          </button>
                          <div className="read-count-tooltip">
                            <div className="tooltip-content">
                              <div className="tooltip-header">
                                <Eye size={12} />
                                <span>Read Statistics</span>
                              </div>
                              <div className="tooltip-stats">
                                <div className="stat-row">
                                  <span className="stat-label">Read:</span>
                                  <span className="stat-value">{broadcast.stats?.read || 0}</span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Sent:</span>
                                  <span className="stat-value">{broadcast.stats?.sent || 0}</span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Rate:</span>
                                  <span className="stat-value">{getReadPercentage(broadcast)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {broadcast.status === 'scheduled' && (
                          <>
                            <button className="action-btn stop-btn" title="Stop Campaign" onClick={() => {
                              onStopBroadcast(broadcast._id);
                              onClose();
                            }}>
                              <Square size={14} />
                            </button>
                            
                            <button className="action-btn delete-btn" title="Delete Campaign" onClick={() => {
                              onDeleteClick(broadcast);
                              onClose();
                            }}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sortedBroadcasts.length === 0 && (
            <div className="no-campaigns-in-popup">
              <FileText size={48} />
              <h4>No campaigns found</h4>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllCampaignsPopup;
