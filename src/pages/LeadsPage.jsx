import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Phone, Play, FileText, ChevronDown, ChevronUp, Search } from 'lucide-react';
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
  const [stats, setStats] = useState({ contactsUsed: 0 });
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
      const payload = response?.data || {};
      const leadData = payload?.data || {};
      const fetchedLeads = leadData?.leads || [];
      const pagination = leadData?.pagination || {};
      const normalizedLeads = fetchedLeads.map(mapLeadForView);

      setLeads(normalizedLeads);
      setStats({
        contactsUsed: Number(pagination?.total || 0)
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

        <select
          className="status-filter"
          value={filters.workflowId}
          onChange={handleWorkflowChange}
        >
          <option value="">All IVRs</option>
          {ivrMenus.map((menu) => (
            <option key={menu._id} value={menu._id}>
              {menu.displayName || menu.promptKey}
            </option>
          ))}
        </select>

      </div>

      <div className="leads-table-container">
        {loading ? (
          <div className="loading-state">Loading leads...</div>
        ) : (
          <table className="leads-table">
            <thead>
              <tr>
                <th>Caller</th>
                <th>Status</th>
                <th>IVR</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr><td colSpan="5" className="no-data">No leads found</td></tr>
              ) : leads.map((lead) => (
                <React.Fragment key={lead._id}>
                  <tr
                    className={`lead-row ${expandedRow === lead._id ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(lead._id)}
                  >
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
                      </div>
                    </td>
                  </tr>

                  {expandedRow === lead._id && (
                    <tr className="details-row">
                      <td colSpan="5">
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

      {error && <div className="error-state">{error}</div>}
    </div>
  );
};

export default LeadsPage;
