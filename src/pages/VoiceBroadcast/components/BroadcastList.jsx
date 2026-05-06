import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  Eye,
  Filter,
  History,
  ListFilter,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Rows3,
  Search,
  Square,
  Trash2,
  XCircle
} from 'lucide-react';
import { formatVoiceDateTime } from '../../../utils/voiceTime';
import './BroadcastList.css';

const getCampaignId = (campaign = {}) => String(campaign._id || campaign.id || '').trim();

const numberFormat = new Intl.NumberFormat('en-US');

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return formatVoiceDateTime(dateString);
};

const getStats = (campaign = {}) => ({
  total: Number(campaign.stats?.total || 0),
  queued: Number(campaign.stats?.queued || 0),
  calling: Number(campaign.stats?.calling || 0),
  completed: Number(campaign.stats?.completed || 0),
  failed: Number(campaign.stats?.failed || 0),
  optedOut: Number(campaign.stats?.opted_out || 0)
});

const getProgress = (campaign) => {
  const stats = getStats(campaign);
  if (!stats.total) return 0;
  return Math.min(100, Math.round(((stats.completed + stats.failed + stats.optedOut) / stats.total) * 100));
};

const getSuccessRate = (campaign) => {
  const stats = getStats(campaign);
  const finished = stats.completed + stats.failed;
  if (!finished) return 0;
  return Math.round((stats.completed / finished) * 100);
};

const getStatusMeta = (status) => {
  switch (status) {
    case 'queued':
    case 'in_progress':
      return { label: status === 'queued' ? 'Active' : 'Running', className: 'active', icon: PlayCircle };
    case 'completed':
      return { label: 'Completed', className: 'completed', icon: CheckCircle2 };
    case 'cancelled':
      return { label: 'Failed', className: 'failed', icon: XCircle };
    default:
      return { label: 'Pending', className: 'pending', icon: Square };
  }
};

const SummaryBar = memo(({ summary = {} }) => (
  <div className="campaign-summary-bar">
    <div className="campaign-summary-item">
      <span className="campaign-summary-label">Active</span>
      <strong>{numberFormat.format(summary.active || 0)}</strong>
    </div>
    <div className="campaign-summary-item">
      <span className="campaign-summary-label">Completed</span>
      <strong>{numberFormat.format(summary.completed || 0)}</strong>
    </div>
    <div className="campaign-summary-item">
      <span className="campaign-summary-label">Failed</span>
      <strong>{numberFormat.format(summary.failed || 0)}</strong>
    </div>
    <div className="campaign-summary-item">
      <span className="campaign-summary-label">Avg Success</span>
      <strong>{Math.round(summary.avgSuccessRate || 0)}%</strong>
    </div>
    <div className="campaign-summary-item">
      <span className="campaign-summary-label">Running Now</span>
      <strong>{numberFormat.format(summary.runningNow || 0)}</strong>
    </div>
  </div>
));

SummaryBar.displayName = 'SummaryBar';

const CampaignRow = memo(({
  campaign,
  selected,
  onToggleSelected,
  onMonitor,
  onStop,
  onDelete
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const id = getCampaignId(campaign);
  const stats = getStats(campaign);
  const pending = Math.max(0, stats.queued + stats.calling);
  const progress = getProgress(campaign);
  const successRate = getSuccessRate(campaign);
  const statusMeta = getStatusMeta(campaign.status);
  const StatusIcon = statusMeta.icon;
  const canStop = ['queued', 'in_progress'].includes(campaign.status);
  const canViewResults = ['completed', 'cancelled'].includes(campaign.status);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutside = (event) => {
      if (
        !menuRef.current?.contains(event.target)
        && !dropdownRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    const closeOnHidden = () => {
      if (document.hidden) setMenuOpen(false);
    };

    const closeMenu = () => {
      setMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('visibilitychange', closeOnHidden);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('visibilitychange', closeOnHidden);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 152;
      const menuHeight = canStop ? 116 : 80;
      const top = rect.bottom + menuHeight + 10 > window.innerHeight
        ? Math.max(8, rect.top - menuHeight - 6)
        : rect.bottom + 6;
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      setMenuPosition({ top, left });
    }

    setMenuOpen((open) => !open);
  };

  const handleMenuAction = (action) => {
    setMenuOpen(false);
    action?.(id);
  };

  return (
    <tr className={`campaign-row status-${statusMeta.className} ${selected ? 'is-selected' : ''}`}>
      <td className="campaign-select-cell">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggleSelected?.(id, event.target.checked)}
          aria-label={`Select ${campaign.name}`}
        />
      </td>
      <td className="campaign-name-cell sticky-name">
        <span title={campaign.name}>{campaign.name}</span>
      </td>
      <td>
        <span className={`campaign-status-pill ${statusMeta.className}`}>
          <StatusIcon size={14} />
          {statusMeta.label}
        </span>
      </td>
      <td>{numberFormat.format(stats.total)}</td>
      <td className="campaign-progress-cell">
        <div className="campaign-progress-track" aria-label={`${progress}% progress`}>
          <div className="campaign-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}%</span>
      </td>
      <td>{numberFormat.format(stats.completed)}</td>
      <td>{numberFormat.format(stats.failed)}</td>
      <td>{numberFormat.format(pending)}</td>
      <td>{successRate}%</td>
      <td>{formatDate(campaign.createdAt)}</td>
      <td className="campaign-actions-cell">
        <div className="campaign-action-menu" ref={menuRef}>
          <button
            type="button"
            className="campaign-action-trigger"
            ref={triggerRef}
            onClick={toggleMenu}
            aria-label={`${campaign.name} actions`}
            aria-expanded={menuOpen}
            title="Actions"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && createPortal(
            <div
              className="campaign-action-dropdown"
              ref={dropdownRef}
              style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
            >
              {canStop && (
                <>
                  <button type="button" onClick={() => handleMenuAction(onMonitor)}>
                    <Eye size={15} />
                    Monitor
                  </button>
                  <button type="button" onClick={() => handleMenuAction(onStop)}>
                    <PauseCircle size={15} />
                    Stop
                  </button>
                </>
              )}
              {canViewResults && (
                <button type="button" onClick={() => handleMenuAction(onMonitor)}>
                  <BarChart3 size={15} />
                  View results
                </button>
              )}
              <button type="button" className="danger" onClick={() => handleMenuAction(onDelete)}>
                <Trash2 size={15} />
                Delete
              </button>
            </div>,
            document.body
          )}
        </div>
      </td>
    </tr>
  );
});

CampaignRow.displayName = 'CampaignRow';

const BroadcastList = ({
  broadcasts = [],
  loading,
  onMonitor,
  onStop,
  onDelete,
  summary,
  query,
  searchInput,
  pagination,
  selectedIds,
  onQueryChange,
  onSearchChange,
  onResetFilters,
  onToggleSelected,
  onToggleAllVisible,
  onClearSelection,
  onBulkStop,
  onBulkDelete
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const visibleIds = useMemo(() => broadcasts.map(getCampaignId).filter(Boolean), [broadcasts]);
  const selectedCount = selectedIds?.size || 0;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds?.has(id));
  const hasFilters = Boolean(query?.search || (query?.status && query.status !== 'all'));
  const start = pagination?.total ? ((pagination.page - 1) * pagination.limit) + 1 : 0;
  const end = pagination?.total ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  const handleToggleAllVisible = (checked) => {
    onToggleAllVisible?.(checked);
  };

  const handleClearSelection = () => {
    onClearSelection?.();
  };

  const handleBulkStop = async () => {
    if (selectedCount === 0 || !window.confirm(`Stop ${selectedCount} selected campaign(s)?`)) return;
    await onBulkStop?.();
  };

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || !window.confirm(`Delete ${selectedCount} selected campaign(s)? This cannot be undone.`)) return;
    await onBulkDelete?.();
  };

  return (
    <div className="broadcast-list outbound-history-surface">
      <div className="broadcast-history-card">
        <div className="broadcast-history-content">
          <div className="broadcast-history-header">
            <div className="broadcast-history-title">
              <div className="broadcast-history-icon">
                <History size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2>All Campaigns</h2>
                <p>Track voice broadcast campaigns with live progress and fast filtering.</p>
              </div>
            </div>
          </div>

          <SummaryBar summary={summary} />

          <div className="campaign-toolbar" role="region" aria-label="Campaign filters">
            <label className="history-filter-field campaign-search-field">
              <span className="filter-label-with-icon"><Search size={15} /> Search</span>
              <div className="campaign-search">
                <Search size={14} />
                <input
                  type="search"
                  value={searchInput || ''}
                  onChange={(event) => onSearchChange?.(event.target.value)}
                  placeholder="Search campaigns"
                  aria-label="Search campaigns"
                />
              </div>
            </label>
            <button
              type="button"
              className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label={showFilters ? 'Hide campaign filters' : 'Show campaign filters'}
              title={showFilters ? 'Hide campaign filters' : 'Show campaign filters'}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="filter-panel campaign-filter-panel">
              <label className="history-filter-field campaign-status-filter">
                <span className="filter-label-with-icon"><ListFilter size={15} /> Status</span>
                <select value={query?.status || 'all'} onChange={(event) => onQueryChange?.({ status: event.target.value, page: 1 })} aria-label="Filter by status">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
              <label className="history-filter-field campaign-sort-filter">
                <span className="filter-label-with-icon"><ArrowUpDown size={15} /> Sort</span>
                <select value={query?.sort || 'newest'} onChange={(event) => onQueryChange?.({ sort: event.target.value, page: 1 })} aria-label="Sort campaigns">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="success">Success %</option>
                  <option value="progress">Progress</option>
                </select>
              </label>
              <label className="history-filter-field campaign-rows-filter">
                <span className="filter-label-with-icon"><Rows3 size={15} /> Rows</span>
                <select value={query?.limit || 25} onChange={(event) => onQueryChange?.({ limit: Number(event.target.value), page: 1 })} aria-label="Page size">
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
              <div className="history-filter-field filter-actions">
                <span className="filter-label-with-icon"><CheckSquare size={15} /> Select</span>
                <button type="button" className="filter-action-btn" onClick={() => handleToggleAllVisible(!allVisibleSelected)}>
                  {allVisibleSelected ? 'Clear All Visible' : 'Select All Visible'}
                </button>
              </div>
            </div>
          )}

          {selectedCount > 0 && (
            <div className="campaign-bulk-bar">
              <strong>{selectedCount} selected</strong>
              <div className="campaign-bulk-actions">
                <button type="button" className="filter-action-btn" onClick={handleBulkStop}>
                  <PauseCircle size={16} />
                  Stop selected
                </button>
                <button type="button" className="filter-action-btn danger" onClick={handleBulkDelete}>
                  <Trash2 size={16} />
                  Delete selected
                </button>
                <button type="button" className="filter-action-btn" onClick={handleClearSelection}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {loading && broadcasts.length === 0 ? (
            <div className="history-empty-state campaign-loading-state">
              <div className="spinner-large" />
              <p>Loading campaigns...</p>
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="history-empty-state campaign-empty-state">
              <Activity size={40} strokeWidth={1.5} />
              <h3>{hasFilters ? 'No campaigns match your filters.' : 'No campaigns yet. Create your first broadcast.'}</h3>
              {hasFilters ? (
                <button type="button" className="filter-action-btn" onClick={onResetFilters}>
                  <RotateCcw size={16} />
                  Reset filters
                </button>
              ) : (
                <p>Create your first voice broadcast campaign to get started.</p>
              )}
            </div>
          ) : (
            <>
              <div className="campaign-table-shell">
                <table className={`campaign-table ${selectedCount > 0 ? 'selection-mode' : ''}`}>
                  <colgroup>
                    <col className="campaign-col-select" />
                    <col className="campaign-col-name" />
                    <col className="campaign-col-status" />
                    <col className="campaign-col-contacts" />
                    <col className="campaign-col-progress" />
                    <col className="campaign-col-completed" />
                    <col className="campaign-col-failed" />
                    <col className="campaign-col-pending" />
                    <col className="campaign-col-success" />
                    <col className="campaign-col-created" />
                    <col className="campaign-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="campaign-select-cell" aria-hidden="true" />
                      <th className="sticky-name">Campaign Name</th>
                      <th>Status</th>
                      <th>Contacts</th>
                      <th>Progress</th>
                      <th>Completed</th>
                      <th>Failed</th>
                      <th>Pending</th>
                      <th>Success</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((campaign) => {
                      const id = getCampaignId(campaign);
                      return (
                        <CampaignRow
                          key={id}
                          campaign={campaign}
                          selected={Boolean(selectedIds?.has(id))}
                          onToggleSelected={onToggleSelected}
                          onMonitor={onMonitor}
                          onStop={onStop}
                          onDelete={onDelete}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="history-toolbar campaign-history-toolbar">
                <div className="history-pagination-bar">
                  <span>
                    Showing {numberFormat.format(start)}-{numberFormat.format(end)} of {numberFormat.format(pagination?.total || 0)}
                  </span>
                  <div className="history-pager">
                    <button
                      type="button"
                      disabled={pagination?.page <= 1}
                      onClick={() => onQueryChange?.({ page: pagination.page - 1 })}
                    >
                      Prev
                    </button>
                    <span>{pagination?.page || 1} / {pagination?.pages || 1}</span>
                    <button
                      type="button"
                      disabled={pagination?.page >= pagination?.pages}
                      onClick={() => onQueryChange?.({ page: pagination.page + 1 })}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastList;
