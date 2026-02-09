import React, { useState, useEffect, useCallback } from 'react';
import { Users, Filter, Download, Phone, Calendar, Clock, Play, FileText, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';
import leadService from '../services/leadService';
import './LeadsPage.css';

const LeadsPage = () => {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [activeTab, setActiveTab] = useState('list');
    const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0 });
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        page: 1,
        limit: 10
    });

    const fetchLeads = useCallback(async () => {
        try {
            setLoading(true);
            const response = await leadService.getLeads(filters);
            const fetchedLeads = response.leads || [];
            setLeads(fetchedLeads);

            // Calculate stats
            setStats({
                total: fetchedLeads.length,
                pending: fetchedLeads.filter(l => l.status === 'PENDING_AGENT').length,
                confirmed: fetchedLeads.filter(l => l.status === 'CONFIRMED').length
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
        fetchLeads();
    }, [fetchLeads]);

    const handleSearchChange = (e) => {
        setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await leadService.updateLead(id, { status: newStatus });
            fetchLeads();
        } catch (err) {
            alert('Failed to update status');
        }
    };

    const handleExport = async () => {
        try {
            await leadService.exportLeads(filters);
        } catch (err) {
            alert('Export failed');
        }
    };

    const toggleExpand = (id) => setExpandedRow(expandedRow === id ? null : id);

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="leads-page">
            {/* Header */}
            <div className="leads-header">
                <div className="header-content">
                    <h1>Lead Management</h1>
                    <p className="subtitle">Manage and track your inbound hotel booking requests</p>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <span className="stat-value">{stats.total}</span>
                        <span className="stat-label">Total Leads</span>
                    </div>
                    <div className="stat-card warning">
                        <span className="stat-value">{stats.pending}</span>
                        <span className="stat-label">Pending</span>
                    </div>
                    <div className="stat-card success">
                        <span className="stat-value">{stats.confirmed}</span>
                        <span className="stat-label">Confirmed</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
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

                <div className="actions-group">
                    <button className="btn-refresh" onClick={fetchLeads} title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                    <button className="btn-export" onClick={handleExport}>
                        <Download size={18} />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="leads-table-container">
                {loading ? (
                    <div className="loading-state">Loading leads...</div>
                ) : (
                    <table className="leads-table">
                        <thead>
                            <tr>
                                <th>Caller</th>
                                <th>Status</th>
                                <th>Room Type</th>
                                <th>Stay Dates</th>
                                <th>Received</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leads.length === 0 ? (
                                <tr><td colSpan="6" className="no-data">No leads found</td></tr>
                            ) : leads.map(lead => (
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
                                            <span className={`status-pill ${lead.status.toLowerCase().replace('_', '-')}`}>
                                                {lead.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="room-info">
                                                <span className="room-type">{lead.roomType || 'Standard'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="date-info">
                                                <span>In: {lead.checkIn ? new Date(lead.checkIn).toLocaleDateString() : '-'}</span>
                                                <span>Out: {lead.checkOut ? new Date(lead.checkOut).toLocaleDateString() : '-'}</span>
                                            </div>
                                        </td>
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
                                            <td colSpan="6">
                                                <div className="lead-details-panel">
                                                    <div className="detail-column">
                                                        <h3><FileText size={16} /> Booking Details</h3>
                                                        <div className="detail-item">
                                                            <span className="label">Note:</span>
                                                            <span className="value">{lead.notes || 'No notes'}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="label">Intent:</span>
                                                            <span className="value badge">{lead.intent}</span>
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
        </div>
    );
};

export default LeadsPage;
