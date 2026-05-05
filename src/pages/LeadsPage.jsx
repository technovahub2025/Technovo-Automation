import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Phone,
  Play,
  FileText,
  Search,
  Download,
  Trash2,
  SlidersHorizontal,
  MoreVertical,
  X,
  UserRound,
  BadgeCheck,
  GitBranch,
  CalendarClock,
  Timer,
  Check,
  Ban,
  CheckCircle2
} from 'lucide-react';
import leadService from '../services/leadService';
import useSocket from '../hooks/useSocket';
import useIVRMenus from '../hooks/useIVRMenus';
import { normalizeLead, normalizePagination } from '../utils/inboundNormalizers';
import './LeadsPage.css';

const PAGE_SIZE = 50;

const normalizeDurationSeconds = (lead) => {
  const rawValue = lead?.duration ?? lead?.durationSeconds;
  const value = Number(rawValue);
  if (rawValue !== undefined && rawValue !== null && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  const formatted = String(lead?.durationFormatted || '');
  const match = formatted.match(/^(\d+):([0-5]?\d)$/);
  if (!match) return 0;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const mapLeadForView = (lead) => ({
  ...normalizeLead(lead),
  duration: normalizeDurationSeconds(lead),
});

const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const LeadsPage = () => {
  const { socket, connected } = useSocket();
  const { ivrMenus } = useIVRMenus();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDrawerLeadId, setActiveDrawerLeadId] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState({ contactsUsed: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    workflowId: '',
    page: 1,
    limit: PAGE_SIZE
  });
  const refreshTimerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const selectedIvrName = useMemo(() => {
    if (!filters.workflowId) return '';
    const selected = ivrMenus.find((menu) =>
      String(menu._id || '') === String(filters.workflowId) ||
      String(menu.id || '') === String(filters.workflowId) ||
      String(menu.promptKey || '') === String(filters.workflowId)
    );
    return selected?.displayName || selected?.promptKey || '';
  }, [ivrMenus, filters.workflowId]);

  const activeDrawerLead = useMemo(
    () => leads.find((lead) => String(lead._id) === String(activeDrawerLeadId)) || null,
    [leads, activeDrawerLeadId]
  );

  const fetchLeads = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    try {
      setLoading(true);
      const response = await leadService.getLeads(filters);
      if (requestSeq !== requestSeqRef.current) return;
      const leadData = response?.data || response || {};
      const fetchedLeads = Array.isArray(leadData?.leads) ? leadData.leads : [];
      const nextPagination = leadData?.pagination || {};
      const normalizedLeads = fetchedLeads.map(mapLeadForView);
      const safePagination = normalizePagination(nextPagination, filters);

      setLeads(normalizedLeads);
      setStats({
        contactsUsed: safePagination.total
      });
      setPagination(safePagination);
      setError(null);
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) return;
      setError('Failed to load leads');
      console.error(error);
    } finally {
      if (requestSeq === requestSeqRef.current) setLoading(false);
    }
  }, [filters]);

  const matchesLeadFilters = useCallback((lead, activeFilters) => {
    if (!lead) return false;
    const searchValue = String(activeFilters.search || '').toLowerCase();
    const statusFilter = String(activeFilters.status || '').toLowerCase();
    const workflowFilter = String(activeFilters.workflowId || '');
    const nameValue = `${lead.callerName || ''} ${lead.callerNumber || ''}`.toLowerCase();
    const leadStatus = String(lead.status || '').toLowerCase();
    const leadWorkflowId = String(lead.workflowId || lead.workflow?._id || '');

    if (searchValue && !nameValue.includes(searchValue)) return false;
    if (statusFilter && leadStatus !== statusFilter) return false;
    if (workflowFilter && leadWorkflowId !== workflowFilter) return false;
    return true;
  }, []);

  const applyLiveLeadUpdate = useCallback((payload) => {
    const leadPayload = payload?.lead || payload?.leadData || payload?.leadDetails || payload;
    const leadId = leadPayload?._id || leadPayload?.leadId || leadPayload?.id;
    if (!leadId) return false;

    const mappedLead = mapLeadForView(leadPayload);
    const matchesFilters = matchesLeadFilters(mappedLead, filters);

    setLeads((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      const index = next.findIndex((item) => String(item?._id) === String(leadId));

      if (index >= 0) {
        if (matchesFilters) {
          next[index] = { ...next[index], ...mappedLead };
        } else {
          next.splice(index, 1);
        }
      } else if (payload?.action !== 'deleted' && matchesFilters && Number(filters.page || 1) === 1) {
        next.unshift(mappedLead);
      } else if (payload?.action !== 'deleted' && matchesFilters && Number(filters.page || 1) === Number(pagination.totalPages || 1)) {
        next.push(mappedLead);
      }

      return next.slice(0, Number(filters.limit || PAGE_SIZE));
    });

    setPagination((prev) => {
      const nextTotal = payload?.action === 'created' && matchesFilters
        ? Number(prev.total || 0) + 1
        : payload?.action === 'deleted' && matchesFilters
          ? Math.max(0, Number(prev.total || 0) - 1)
        : Number(prev.total || 0);

      return {
        ...prev,
        total: nextTotal,
        totalPages: Math.max(1, Math.ceil(nextTotal / Number(prev.limit || PAGE_SIZE)))
      };
    });
    return true;
  }, [filters, matchesLeadFilters, pagination.totalPages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput.trim(),
        page: 1
      }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((lead) => lead._id === id)));
    if (activeDrawerLeadId && !leads.some((lead) => String(lead._id) === String(activeDrawerLeadId))) {
      setActiveDrawerLeadId(null);
    }
  }, [leads, activeDrawerLeadId]);

  useEffect(() => {
    if (!socket || !connected) return undefined;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        fetchLeads();
      }, 500);
    };

    const handleSocketUpdate = (payload) => {
      const applied = applyLiveLeadUpdate(payload);
      if (!applied) scheduleRefresh();
    };

    socket.on('lead_update', handleSocketUpdate);
    socket.on('lead:updated', handleSocketUpdate);
    socket.on('inbound_lead_update', handleSocketUpdate);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      socket.off('lead_update', handleSocketUpdate);
      socket.off('lead:updated', handleSocketUpdate);
      socket.off('inbound_lead_update', handleSocketUpdate);
    };
  }, [socket, connected, fetchLeads, applyLiveLeadUpdate]);

  useEffect(() => {
    if (!activeDrawerLeadId) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveDrawerLeadId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawerLeadId]);

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
  };

  const handleWorkflowChange = (event) => {
    setFilters((prev) => ({ ...prev, workflowId: event.target.value, page: 1 }));
  };

  const handleStatusFilterChange = (event) => {
    setFilters((prev) => ({ ...prev, status: event.target.value, page: 1 }));
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectionMode(true);
      setSelectedLeadIds(leads.map((lead) => lead._id));
      return;
    }
    setSelectedLeadIds([]);
    setSelectionMode(false);
  };

  const handleSelectLead = (leadId, checked) => {
    setSelectionMode(true);
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(leadId)) return prev;
        return [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await leadService.updateLead(id, { status: newStatus });
      fetchLeads();
    } catch {
      alert('Failed to update status');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadService.deleteLead(leadId);
      setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));
      if (activeDrawerLeadId === leadId) {
        setActiveDrawerLeadId(null);
      }
      await fetchLeads();
    } catch (error) {
      console.error(error);
      alert('Failed to delete lead');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedLeadIds.length} selected lead(s)?`)) return;

    try {
      await Promise.all(selectedLeadIds.map((id) => leadService.deleteLead(id)));
      setSelectedLeadIds([]);
      setSelectionMode(false);
      if (activeDrawerLeadId && selectedLeadIds.includes(activeDrawerLeadId)) {
        setActiveDrawerLeadId(null);
      }
      await fetchLeads();
    } catch (error) {
      console.error(error);
      alert('Failed to delete selected leads');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > (pagination.totalPages || 1)) return;
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const getVisiblePages = () => {
    const totalPages = Math.max(1, pagination.totalPages || 1);
    const current = Math.max(1, pagination.page || 1);
    const pages = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, current + 2);
    for (let pageNo = start; pageNo <= end; pageNo += 1) pages.push(pageNo);
    return pages;
  };

  const handleToggleSelectVisible = () => {
    setSelectionMode((prev) => {
      const next = !prev;
      setSelectedLeadIds(next ? leads.map((lead) => lead._id) : []);
      return next;
    });
  };

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const handleExportExcel = () => {
    const rows = leads.map((lead, index) => ({
      slNo: ((pagination.page || 1) - 1) * (pagination.limit || PAGE_SIZE) + index + 1,
      callerName: lead.callerName || 'Unknown Caller',
      callerNumber: lead.callerNumber || '',
      status: (lead.status || 'PENDING_AGENT').replace('_', ' '),
      ivr: lead.workflowName || selectedIvrName || '-',
      receivedAt: formatDate(lead.createdAt),
      duration: formatDuration(lead.duration),
      notes: lead.notes || '',
      intent: lead.intent || '-'
    }));

    const tableRows = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.slNo)}</td>
        <td>${escapeHtml(row.callerName)}</td>
        <td>${escapeHtml(row.callerNumber)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.ivr)}</td>
        <td>${escapeHtml(row.receivedAt)}</td>
        <td>${escapeHtml(row.duration)}</td>
        <td>${escapeHtml(row.notes)}</td>
        <td>${escapeHtml(row.intent)}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Sl No</th>
              <th>Caller Name</th>
              <th>Caller Number</th>
              <th>Status</th>
              <th>IVR</th>
              <th>Received</th>
              <th>Duration</th>
              <th>Notes</th>
              <th>Intent</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([`\ufeff${tableHtml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `leads_export_${datePart}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="leads-page">
      <div className="leads-header">
        <div className="header-content">
          <h1>Leads</h1>
          <p className="subtitle">IVR-specific lead tracking</p>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.contactsUsed}</span>
            <span className="stat-label">Contacts Used</span>
          </div>
        </div>
      </div>

      <div className="leads-controls">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, phone..."
            value={searchInput}
            onChange={handleSearchChange}
          />
        </div>

        <button
          className={`btn-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => {
            setShowFilters((prev) => {
              const next = !prev;
              if (!next && selectedLeadIds.length === 0) {
                setSelectionMode(false);
              }
              return next;
            });
          }}
          type="button"
          aria-expanded={showFilters}
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={16} />
          Filter
        </button>

        <div className="actions-group">
          <button
            className="btn-export"
            onClick={handleExportExcel}
            disabled={loading || leads.length === 0}
            title="Download visible leads as Excel"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filter-row">
            <div className="filter-left">
              <div className="filter-item">
                <label>Status</label>
                <select
                  className="status-filter"
                  value={filters.status}
                  onChange={handleStatusFilterChange}
                  title="Filter by status"
                >
                  <option value="">All Status</option>
                  <option value="PENDING_AGENT">Pending Agent</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="filter-item">
                <label>IVR</label>
                <select
                  className="status-filter"
                  value={filters.workflowId}
                  onChange={handleWorkflowChange}
                  title="Filter by IVR"
                >
                  <option value="">All IVRs</option>
                {ivrMenus.map((menu) => (
                    <option key={menu._id || menu.id || menu.promptKey} value={menu._id || menu.id || menu.promptKey}>
                      {menu.displayName || menu.promptKey}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-item select-block">
                <label>Select</label>
                <button
                  type="button"
                  className="filter-action-btn select-btn"
                  onClick={handleToggleSelectVisible}
                >
                  {selectionMode ? 'Clear All Visible' : 'Select All Visible'}
                </button>
              </div>
            </div>

            <div className="filter-item delete-block">
              <label>Delete</label>
              <button
                type="button"
                className="filter-action-btn danger icon-only delete-btn"
                onClick={handleDeleteSelected}
                disabled={loading || selectedLeadIds.length === 0}
                aria-label="Delete selected leads"
                title={selectedLeadIds.length === 0 ? 'Select leads to delete' : `Delete ${selectedLeadIds.length} selected`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="leads-table-container">
        {loading ? (
          <div className="loading-state">Loading leads...</div>
        ) : (
          <table className={`leads-table ${selectionMode ? 'selection-mode' : ''}`}>
            <thead>
              <tr>
                {selectionMode && (
                  <th className="leads-col-select">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                      onChange={handleSelectAll}
                      aria-label="Select all visible leads"
                    />
                  </th>
                )}
                <th className="leads-col-caller"><span className="table-heading"><UserRound size={14} /> Caller</span></th>
                <th className="leads-col-status"><span className="table-heading"><BadgeCheck size={14} /> Status</span></th>
                <th className="leads-col-ivr"><span className="table-heading"><GitBranch size={14} /> IVR</span></th>
                <th className="leads-col-received"><span className="table-heading"><CalendarClock size={14} /> Received</span></th>
                <th className="leads-col-duration"><span className="table-heading"><Timer size={14} /> Duration</span></th>
                <th className="leads-col-actions"><span className="table-heading actions-heading"><MoreVertical size={14} /> Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan={selectionMode ? 7 : 6} className="no-data">No leads found</td></tr>
              ) : leads.map((lead) => (
                <tr
                  key={lead._id || lead.id || lead.callSid}
                  className={`lead-row ${activeDrawerLeadId === lead._id ? 'selected' : ''}`}
                >
                  {selectionMode && (
                    <td className="leads-col-select" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead._id)}
                        onChange={(event) => handleSelectLead(lead._id, event.target.checked)}
                        aria-label={`Select lead ${lead.callerName || lead.callerNumber || lead._id}`}
                      />
                    </td>
                  )}
                  <td className="leads-col-caller">
                    <div className="caller-info">
                      <span className="caller-name">{lead.callerName || 'Unknown Caller'}</span>
                      <span className="caller-phone">{lead.callerNumber}</span>
                    </div>
                  </td>
                  <td className="leads-col-status">
                    <span className={`status-pill ${(lead.status || 'PENDING_AGENT').toLowerCase().replace('_', '-')}`}>
                      {(lead.status || 'PENDING_AGENT').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="leads-col-ivr">
                    <span className="truncate-cell" title={lead.workflowName || selectedIvrName || '-'}>
                      {lead.workflowName || selectedIvrName || '-'}
                    </span>
                  </td>
                  <td className="leads-col-received">{formatDate(lead.createdAt)}</td>
                  <td className="leads-col-duration duration-cell">{formatDuration(lead.duration)}</td>
                  <td className="leads-col-actions actions-cell">
                    <button
                      className="btn-kebab"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveDrawerLeadId(lead._id);
                      }}
                      title="Open lead actions"
                      aria-label="Open lead actions"
                      type="button"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeDrawerLead && (
        <div className="lead-drawer-layer" role="presentation">
          <button
            className="lead-drawer-backdrop"
            type="button"
            aria-label="Close lead drawer"
            onClick={() => setActiveDrawerLeadId(null)}
          />
          <aside className="lead-drawer" aria-label="Lead details drawer">
            <div className="lead-drawer-header">
              <div>
                <h2>{activeDrawerLead.callerName || 'Unknown Caller'}</h2>
                <p>{activeDrawerLead.callerNumber || '-'}</p>
              </div>
              <button
                className="drawer-close"
                type="button"
                onClick={() => setActiveDrawerLeadId(null)}
                aria-label="Close lead drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="lead-drawer-body">
              <section className="drawer-card">
                <h3><UserRound size={15} /> Lead Details</h3>
                <div className="drawer-field-grid">
                  <span><BadgeCheck size={14} /> Status</span>
                  <strong>{(activeDrawerLead.status || 'PENDING_AGENT').replace('_', ' ')}</strong>
                  <span><GitBranch size={14} /> IVR</span>
                  <strong>{activeDrawerLead.workflowName || selectedIvrName || '-'}</strong>
                  <span><CalendarClock size={14} /> Received</span>
                  <strong>{formatDate(activeDrawerLead.createdAt)}</strong>
                  <span><Timer size={14} /> Duration</span>
                  <strong>{formatDuration(activeDrawerLead.duration)}</strong>
                  <span><FileText size={14} /> Intent</span>
                  <strong>{activeDrawerLead.intent || '-'}</strong>
                </div>
              </section>

              <section className="drawer-card">
                <h3><FileText size={15} /> Notes</h3>
                <p className="drawer-note">{activeDrawerLead.notes || 'No notes'}</p>
              </section>

              <section className="drawer-card">
                <h3><Play size={15} /> Call Recordings</h3>
                <div className="audio-list">
                  {activeDrawerLead.audioPrompts && activeDrawerLead.audioPrompts.length > 0 ? (
                    activeDrawerLead.audioPrompts.map((url, index) => (
                      <div key={`${url}-${index}`} className="audio-item">
                        <span>Recording {index + 1}</span>
                        <audio controls src={url} className="custom-audio" />
                      </div>
                    ))
                  ) : (
                    <span className="no-audio">No recordings available</span>
                  )}
                </div>
              </section>
            </div>

            <div className="lead-drawer-footer">
              <a href={`tel:${activeDrawerLead.callerNumber}`} className="btn-action call">
                <Phone size={16} /> Call
              </a>
              <div className="drawer-action-row">
                <button type="button" onClick={() => handleStatusUpdate(activeDrawerLead._id, 'CONFIRMED')} className="btn-action confirm">
                  <Check size={16} /> Confirm
                </button>
                <button type="button" onClick={() => handleStatusUpdate(activeDrawerLead._id, 'CANCELLED')} className="btn-action cancel">
                  <Ban size={16} /> Cancel
                </button>
              </div>
              <button type="button" onClick={() => handleStatusUpdate(activeDrawerLead._id, 'COMPLETED')} className="btn-action complete">
                <CheckCircle2 size={16} /> Complete
              </button>
              <button type="button" onClick={() => handleDeleteLead(activeDrawerLead._id)} className="btn-action delete">
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="pagination-bar">
        <span className="pagination-summary">
          {pagination.total === 0
            ? 'No leads'
            : `Showing ${((pagination.page || 1) - 1) * (pagination.limit || PAGE_SIZE) + 1}-${Math.min((pagination.page || 1) * (pagination.limit || PAGE_SIZE), pagination.total)} of ${pagination.total}`}
        </span>
        <button
          className="pagination-btn"
          onClick={() => handlePageChange((pagination.page || 1) - 1)}
          disabled={(pagination.page || 1) <= 1 || loading}
        >
          Prev
        </button>

        <div className="pagination-pages">
          {getVisiblePages().map((pageNo) => (
            <button
              key={pageNo}
              className={`pagination-page ${pageNo === (pagination.page || 1) ? 'active' : ''}`}
              onClick={() => handlePageChange(pageNo)}
              disabled={loading}
            >
              {pageNo}
            </button>
          ))}
        </div>

        <button
          className="pagination-btn"
          onClick={() => handlePageChange((pagination.page || 1) + 1)}
          disabled={(pagination.page || 1) >= (pagination.totalPages || 1) || loading}
        >
          Next
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}
    </div>
  );
};

export default LeadsPage;
