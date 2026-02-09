import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, Trash2, Tag } from 'lucide-react';
import apiService from "../../src/services/api";
import './CallLogs.css';

const CallLogs = () => {
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        status: '',
        direction: '',
        phoneNumber: '',
        page: 1,
        limit: 20
    });
    const [stats, setStats] = useState(null);
    const [selectedCalls, setSelectedCalls] = useState([]);
    const [pagination, setPagination] = useState({});

    useEffect(() => {
        fetchCalls();
        fetchStats();
    }, [filters]);

    const fetchCalls = async () => {
        try {
            setLoading(true);
            const response = await apiService.get('/api/call-logs', { params: filters });

            if (response.data.success) {
                setCalls(response.data.data);
                setPagination(response.data.meta.pagination);
            }
        } catch (error) {
            console.error('Error fetching calls:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const { startDate, endDate } = filters;
            const response = await apiService.get('/api/call-logs/stats', {
                params: { startDate, endDate }
            });

            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const handleExport = async (format = 'json') => {
        try {
            const response = await apiService.get('/api/call-logs/export', {
                params: { ...filters, format },
                responseType: format === 'csv' ? 'blob' : 'json'
            });

            if (format === 'csv') {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `call-logs-${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            } else {
                const dataStr = JSON.stringify(response.data.data, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = window.URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `call-logs-${Date.now()}.json`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (error) {
            console.error('Error exporting calls:', error);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedCalls.length === 0 || !confirm(`Delete ${selectedCalls.length} selected calls?`)) {
            return;
        }

        try {
            await apiService.post('/api/call-logs/bulk-delete', {
                callSids: selectedCalls
            });

            setSelectedCalls([]);
            fetchCalls();
        } catch (error) {
            console.error('Error deleting calls:', error);
        }
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedCalls(calls.map(call => call.callSid));
        } else {
            setSelectedCalls([]);
        }
    };

    const handleSelectCall = (callSid) => {
        setSelectedCalls(prev =>
            prev.includes(callSid)
                ? prev.filter(id => id !== callSid)
                : [...prev, callSid]
        );
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    const getStatusColor = (status) => {
        const colors = {
            completed: '#10b981',
            failed: '#ef4444',
            'no-answer': '#f59e0b',
            busy: '#f97316',
            'in-progress': '#3b82f6',
            ringing: '#8b5cf6',
            initiated: '#6b7280'
        };
        return colors[status] || '#6b7280';
    };

    return (
        <div className="call-logs-container">
            <div className="call-logs-header">
                <h1>Call Logs</h1>
                <div className="header-actions">
                    <button onClick={() => handleExport('csv')} className="export-btn">
                        <Download size={16} />
                        Export CSV
                    </button>
                    <button onClick={() => handleExport('json')} className="export-btn">
                        <Download size={16} />
                        Export JSON
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">Total Calls</div>
                        <div className="stat-value">{stats.totalCalls}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Completed</div>
                        <div className="stat-value success">{stats.completedCalls}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Failed</div>
                        <div className="stat-value danger">{stats.failedCalls}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Success Rate</div>
                        <div className="stat-value">{stats.successRate}%</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Avg Duration</div>
                        <div className="stat-value">{formatDuration(Math.round(stats.avgDuration))}</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-section">
                <div className="filter-row">
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                        className="filter-input"
                        placeholder="Start Date"
                    />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                        className="filter-input"
                        placeholder="End Date"
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="no-answer">No Answer</option>
                        <option value="busy">Busy</option>
                        <option value="in-progress">In Progress</option>
                    </select>
                    <select
                        value={filters.direction}
                        onChange={(e) => handleFilterChange('direction', e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Directions</option>
                        <option value="inbound">Inbound</option>
                        <option value="outbound">Outbound</option>
                    </select>
                    <div className="search-box">
                        <Search size={16} />
                        <input
                            type="text"
                            value={filters.phoneNumber}
                            onChange={(e) => handleFilterChange('phoneNumber', e.target.value)}
                            placeholder="Search phone number..."
                            className="search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedCalls.length > 0 && (
                <div className="bulk-actions">
                    <span>{selectedCalls.length} selected</span>
                    <button onClick={handleBulkDelete} className="bulk-delete-btn">
                        <Trash2 size={16} />
                        Delete Selected
                    </button>
                </div>
            )}

            {/* Call Table */}
            <div className="calls-table-container">
                {loading ? (
                    <div className="loading-state">Loading calls...</div>
                ) : calls.length === 0 ? (
                    <div className="empty-state">No calls found</div>
                ) : (
                    <table className="calls-table">
                        <thead>
                            <tr>
                                <th>
                                    <input
                                        type="checkbox"
                                        checked={selectedCalls.length === calls.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th>Call SID</th>
                                <th>Phone Number</th>
                                <th>Direction</th>
                                <th>Status</th>
                                <th>Duration</th>
                                <th>Routing</th>
                                <th>Created At</th>
                                <th>Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calls.map(call => (
                                <tr key={call.callSid}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedCalls.includes(call.callSid)}
                                            onChange={() => handleSelectCall(call.callSid)}
                                        />
                                    </td>
                                    <td className="call-sid">{call.callSid?.substring(0, 10)}...</td>
                                    <td className="phone-number">{call.phoneNumber}</td>
                                    <td>
                                        <span className={`direction-badge ${call.direction}`}>
                                            {call.direction}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(call.status) }}
                                        >
                                            {call.status}
                                        </span>
                                    </td>
                                    <td>{formatDuration(call.duration)}</td>
                                    <td>{call.routing || 'default'}</td>
                                    <td>{new Date(call.createdAt).toLocaleString()}</td>
                                    <td>
                                        <div className="tags-cell">
                                            {call.tags?.map(tag => (
                                                <span key={tag} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="pagination">
                    <button
                        disabled={!pagination.hasPrevPage}
                        onClick={() => handleFilterChange('page', filters.page - 1)}
                        className="page-btn"
                    >
                        Previous
                    </button>
                    <span className="page-info">
                        Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                        disabled={!pagination.hasNextPage}
                        onClick={() => handleFilterChange('page', filters.page + 1)}
                        className="page-btn"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default CallLogs;
