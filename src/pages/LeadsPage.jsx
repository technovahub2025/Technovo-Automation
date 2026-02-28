import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Phone, Play, FileText, ChevronDown, ChevronUp, Search, Download, Trash2, SlidersHorizontal } from 'lucide-react';
import leadService from '../services/leadService';
import apiService from '../services/api';
import useSocket from '../hooks/useSocket';
import './LeadsPage.css';

const mapLeadForView = (lead) => ({
  ...lead,
  callerName: lead?.callerName || lead?.caller?.name || '',
  callerNumber: lead?.callerNumber || lead?.caller?.phoneNumber || '',
  notes: lead?.notes || lead?.bookingDetails?.notes || '',
  workflowName: lead?.workflowName || lead?.workflow?.displayName || '',
  audioPrompts: Array.isArray(lead?.audioPrompts)
    ? lead.audioPrompts
    : Array.isArray(lead?.audioRecordings)
      ? lead.audioRecordings.map((item) => item?.url).filter(Boolean)
      : []
});

const LeadsPage = () => {
  const { socket, connected } = useSocket();
  const [leads, setLeads] = useState([]);
  const [ivrMenus, setIvrMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({ contactsUsed: 0 });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    workflowId: '',
    page: 1,
    limit: 10
  });
  const refreshTimerRef = useRef(null);

  const selectedIvrName = useMemo(() => {
    if (!filters.workflowId) return '';
    const selected = ivrMenus.find((menu) => menu._id === filters.workflowId);
    return selected?.displayName || selected?.promptKey || '';
  }, [ivrMenus, filters.workflowId]);

  const fetchIvrMenus = useCallback(async () => {
    try {
      const response = await apiService.getIVRConfigs();
      const menus = response?.data?.ivrMenus || [];
      setIvrMenus(menus);
    } catch (err) {
      console.error('Failed to load IVR menus', err);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const response = await leadService.getLeads(filters);
      // leadService.getLeads() already returns response.data
      const leadData = response?.data || response || {};
      const fetchedLeads = leadData?.leads || [];
      const pagination = leadData?.pagination || {};
      const normalizedLeads = fetchedLeads
        .map(mapLeadForView)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); // LIFO: newest first

      setLeads(normalizedLeads);
      setStats({
        contactsUsed: Number(pagination?.total || 0)
      });
      setPagination({
        page: Number(pagination?.page || filters.page || 1),
        limit: Number(pagination?.limit || filters.limit || 10),
        total: Number(pagination?.total || 0),
        totalPages: Number(pagination?.totalPages || 1)
      });
      setError(null);
    } catch (err) {
      setError('Failed to load leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIvrMenus();
  }, [fetchIvrMenus]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setSelectedLeadIds((prev) => prev.filter((id) => leads.some((lead) => lead._id === id)));
  }, [leads]);

  useEffect(() => {
    if (!socket || !connected) return undefined;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        fetchLeads();
      }, 400);
    };

    const handleIvrConfigChanged = () => {
      fetchIvrMenus();
      scheduleRefresh();
    };

    socket.on('inbound_call_update', scheduleRefresh);
    socket.on('call_status_update', scheduleRefresh);
    socket.on('calls_update', scheduleRefresh);
    socket.on('ivr_config_created', handleIvrConfigChanged);
    socket.on('ivr_config_updated', handleIvrConfigChanged);
    socket.on('ivr_config_deleted', handleIvrConfigChanged);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      socket.off('inbound_call_update', scheduleRefresh);
      socket.off('call_status_update', scheduleRefresh);
      socket.off('calls_update', scheduleRefresh);
      socket.off('ivr_config_created', handleIvrConfigChanged);
      socket.off('ivr_config_updated', handleIvrConfigChanged);
      socket.off('ivr_config_deleted', handleIvrConfigChanged);
    };
  }, [socket, connected, fetchLeads, fetchIvrMenus]);

  const handleSearchChange = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleWorkflowChange = (e) => {
    setFilters((prev) => ({ ...prev, workflowId: e.target.value, page: 1 }));
  };

  const handleStatusFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }));
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await leadService.updateLead(id, { status: newStatus });
      fetchLeads();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const toggleExpand = (id) => setExpandedRow((prev) => (prev === id ? null : id));

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(leads.map((lead) => lead._id));
      return;
    }
    setSelectedLeadIds([]);
  };

  const handleSelectLead = (leadId, checked) => {
    setSelectedLeadIds((prev) => {
      if (checked) {
        if (prev.includes(leadId)) return prev;
        return [...prev, leadId];
      }
      return prev.filter((id) => id !== leadId);
    });
  };

  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return;
    try {
      await leadService.deleteLead(leadId);
      setSelectedLeadIds((prev) => prev.filter((id) => id !== leadId));
      if (expandedRow === leadId) {
        setExpandedRow(null);
      }
      await fetchLeads();
    } catch (err) {
      console.error(err);
      alert('Failed to delete lead');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedLeadIds.length} selected lead(s)?`)) return;

    try {
      await Promise.all(selectedLeadIds.map((id) => leadService.deleteLead(id)));
      setSelectedLeadIds([]);
      if (expandedRow && selectedLeadIds.includes(expandedRow)) {
        setExpandedRow(null);
      }
      await fetchLeads();
    } catch (err) {
      console.error(err);
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
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  };

  const allVisibleSelected = leads.length > 0 && selectedLeadIds.length === leads.length;

  const handleToggleSelectVisible = () => {
    if (allVisibleSelected) {
      setSelectedLeadIds([]);
      return;
    }
    setSelectedLeadIds(leads.map((lead) => lead._id));
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
      slNo: index + 1,
      callerName: lead.callerName || 'Unknown Caller',
      callerNumber: lead.callerNumber || '',
      status: (lead.status || 'PENDING_AGENT').replace('_', ' '),
      ivr: lead.workflowName || selectedIvrName || '-',
      receivedAt: formatDate(lead.createdAt),
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
            value={filters.search}
            onChange={handleSearchChange}
          />
        </div>

        <button
          className={`btn-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters((prev) => !prev)}
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
            disabled={loading}
            title="Download leads as Excel"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>

      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-field">
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

            <div className="filter-field">
              <label>IVR</label>
              <select
                className="status-filter"
                value={filters.workflowId}
                onChange={handleWorkflowChange}
                title="Filter by IVR"
              >
                <option value="">All IVRs</option>
                {ivrMenus.map((menu) => (
                  <option key={menu._id} value={menu._id}>
                    {menu.displayName || menu.promptKey}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label>Select</label>
              <button
                className="btn-select-toggle"
                onClick={handleToggleSelectVisible}
                type="button"
              >
                {allVisibleSelected ? 'Clear Selection' : 'Select All Visible'}
              </button>
            </div>

            <div className="filter-field filter-actions">
              <label>Delete</label>
              <button
                className="btn-delete-selected"
                onClick={handleDeleteSelected}
                disabled={loading || selectedLeadIds.length === 0}
                title={selectedLeadIds.length === 0 ? 'Select leads to delete' : `Delete ${selectedLeadIds.length} selected`}
              >
                <Trash2 size={16} />
                Delete Selected {selectedLeadIds.length > 0 ? `(${selectedLeadIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="leads-table-container">
        {loading ? (
          <div className="loading-state">Loading leads...</div>
        ) : (
          <table className="leads-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                    onChange={handleSelectAll}
                    aria-label="Select all leads"
                  />
                </th>
                <th>Caller</th>
                <th>Status</th>
                <th>IVR</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan="6" className="no-data">No leads found</td></tr>
              ) : leads.map((lead) => (
                <React.Fragment key={lead._id}>
                  <tr
                    className={`lead-row ${expandedRow === lead._id ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(lead._id)}
                  >
                    <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead._id)}
                        onChange={(e) => handleSelectLead(lead._id, e.target.checked)}
                        aria-label={`Select lead ${lead.callerName || lead.callerNumber || lead._id}`}
                      />
                    </td>
                    <td>
                      <div className="caller-info">
                        <span className="caller-name">{lead.callerName || 'Unknown Caller'}</span>
                        <span className="caller-phone">{lead.callerNumber}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${(lead.status || 'PENDING_AGENT').toLowerCase().replace('_', '-')}`}>
                        {(lead.status || 'PENDING_AGENT').replace('_', ' ')}
                      </span>
                    </td>
                    <td>{lead.workflowName || selectedIvrName || '-'}</td>
                    <td>{formatDate(lead.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); toggleExpand(lead._id); }}>
                          {expandedRow === lead._id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLead(lead._id);
                          }}
                          title="Delete lead"
                          aria-label="Delete lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedRow === lead._id && (
                    <tr className="details-row">
                      <td colSpan="6">
                        <div className="lead-details-panel">
                          <div className="detail-column">
                            <h3><FileText size={16} /> Lead Details</h3>
                            <div className="detail-item">
                              <span className="label">Note:</span>
                              <span className="value">{lead.notes || 'No notes'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Intent:</span>
                              <span className="value badge">{lead.intent || '-'}</span>
                            </div>
                          </div>

                          <div className="detail-column">
                            <h3><Play size={16} /> Call Recordings</h3>
                            <div className="audio-list">
                              {lead.audioPrompts && lead.audioPrompts.length > 0 ? (
                                lead.audioPrompts.map((url, i) => (
                                  <div key={i} className="audio-item">
                                    <span>Step {i + 1}</span>
                                    <audio controls src={url} className="custom-audio" />
                                  </div>
                                ))
                              ) : (
                                <span className="no-audio">No recordings available</span>
                              )}
                            </div>
                          </div>

                          <div className="detail-column actions">
                            <h3>Actions</h3>
                            <div className="action-buttons-grid">
                              <a href={`tel:${lead.callerNumber}`} className="btn-action call">
                                <Phone size={16} /> Call
                              </a>
                              <button onClick={() => handleStatusUpdate(lead._id, 'CONFIRMED')} className="btn-action confirm">
                                Confirm
                              </button>
                              <button onClick={() => handleStatusUpdate(lead._id, 'CANCELLED')} className="btn-action cancel">
                                Cancel
                              </button>
                              <button onClick={() => handleStatusUpdate(lead._id, 'COMPLETED')} className="btn-action complete">
                                Complete
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagination-bar">
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
