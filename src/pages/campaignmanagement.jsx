// CampaignManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Play,
    Pause,
    Edit,
    Copy,
    Trash2,
    Calendar,
    DollarSign,
    Target,
    Facebook,
    Instagram,
    ChevronDown,
    Download,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Users,
    Eye,
    MousePointer,
    BarChart3,
    PieChart,
    Settings,
    Save,
    X
} from 'lucide-react';
import './campaignmanagement.css';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const USE_MOCK = String(import.meta.env.VITE_META_ADS_USE_MOCK || 'false').toLowerCase() === 'true';
const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

const CampaignManagement = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // grid or list
    const [dateRange, setDateRange] = useState('last30days');

    const getAuthHeaders = useCallback(() => {
        const token =
            localStorage.getItem(tokenKey) ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    const normalizeCampaign = (campaign) => ({
        ...campaign,
        id: campaign._id || campaign.id,
        startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
        endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
        platform: campaign.platform || 'both',
        status: campaign.status || 'draft',
        objective: campaign.objective || 'awareness',
        targeting: campaign.targeting || '',
        dailyBudget: campaign.dailyBudget || campaign.lifetimeBudget || 0,
        spent: campaign.spent || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        ctr: campaign.ctr || 0,
        cpc: campaign.cpc || 0,
        revenue: campaign.revenue || 0
    });

    const sanitizePayload = (data) => {
        const payload = { ...data };

        // Remove empty strings
        ['startDate', 'endDate', 'targeting'].forEach((key) => {
            if (!payload[key]) delete payload[key];
        });

        // Numbers
        ['dailyBudget', 'lifetimeBudget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'revenue'].forEach((key) => {
            if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
                delete payload[key];
            } else {
                payload[key] = Number(payload[key]);
                if (Number.isNaN(payload[key])) delete payload[key];
            }
        });

        // Prevent sending both budgets
        if (payload.dailyBudget && payload.lifetimeBudget) {
            delete payload.lifetimeBudget;
        }

        return payload;
    };

    const fetchCampaigns = useCallback(async () => {
        if (USE_MOCK) {
            setCampaigns(mockCampaigns);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const response = await api.get('/api/campaigns', {
                headers: getAuthHeaders(),
                params: {
                    platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
                    status: selectedStatus !== 'all' ? selectedStatus : undefined,
                    search: searchQuery || undefined
                }
            });
            const data = response.data?.data || [];
            setCampaigns(data.map(normalizeCampaign));
        } catch (err) {
            console.error('Failed to load campaigns', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Unable to load campaigns from server.');
            setCampaigns([]);
        } finally {
            setLoading(false);
        }
    }, [api, getAuthHeaders, searchQuery, selectedPlatform, selectedStatus]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    const filteredCampaigns = campaigns.filter(campaign => {
        const matchesPlatform = selectedPlatform === 'all' || campaign.platform === selectedPlatform;
        const matchesStatus = selectedStatus === 'all' || campaign.status === selectedStatus;
        const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             campaign.objective.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesPlatform && matchesStatus && matchesSearch;
    });

    const handleCreateCampaign = async (campaignData) => {
        if (USE_MOCK) {
            setCampaigns(prev => [...prev, { ...normalizeCampaign(campaignData), id: Date.now() }]);
            setShowCreateModal(false);
            return;
        }

        try {
            setLoading(true);
            await api.post('/api/campaigns', sanitizePayload(campaignData), { headers: getAuthHeaders() });
            await fetchCampaigns();
            setShowCreateModal(false);
        } catch (err) {
            console.error('Create failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Create campaign failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditCampaign = async (campaignData) => {
        if (!selectedCampaign) return;

        if (USE_MOCK) {
            setCampaigns(prev =>
                prev.map(c =>
                    c.id === selectedCampaign.id ? { ...c, ...campaignData } : c
                )
            );
            setShowEditModal(false);
            setSelectedCampaign(null);
            return;
        }

        try {
            setLoading(true);
            await api.put(`/api/campaigns/${selectedCampaign.id}`, sanitizePayload(campaignData), {
                headers: getAuthHeaders()
            });
            await fetchCampaigns();
        } catch (err) {
            console.error('Update failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Update campaign failed.');
        } finally {
            setShowEditModal(false);
            setSelectedCampaign(null);
            setLoading(false);
        }
    };

    const handleDeleteCampaign = async (campaignId) => {
        if (!campaignId || !window.confirm('Are you sure you want to delete this campaign?')) return;

        if (USE_MOCK) {
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
            return;
        }

        try {
            setLoading(true);
            await api.delete(`/api/campaigns/${campaignId}`, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Delete failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Delete campaign failed.');
        } finally {
            setLoading(false);
        }
    };

    const handlePauseCampaign = async (campaignId) => {
        if (USE_MOCK) {
            setCampaigns(prev =>
                prev.map(c => (c.id === campaignId ? { ...c, status: 'paused' } : c))
            );
            return;
        }
        try {
            await api.put(`/api/campaigns/${campaignId}/pause`, {}, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Pause failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Pause campaign failed.');
        }
    };

    const handleResumeCampaign = async (campaignId) => {
        if (USE_MOCK) {
            setCampaigns(prev =>
                prev.map(c => (c.id === campaignId ? { ...c, status: 'active' } : c))
            );
            return;
        }
        try {
            await api.put(`/api/campaigns/${campaignId}/resume`, {}, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Resume failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Resume campaign failed.');
        }
    };

    const handleDuplicateCampaign = async (campaign) => {
        if (USE_MOCK) {
            setCampaigns(prev => [...prev, { ...campaign, id: Date.now(), status: 'draft', name: `${campaign.name} (Copy)` }]);
            return;
        }
        try {
            await api.post(`/api/campaigns/${campaign.id}/duplicate`, {}, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Duplicate failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Duplicate campaign failed.');
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            active: { icon: <Play size={14} />, class: 'status-active', label: 'Active' },
            paused: { icon: <Pause size={14} />, class: 'status-paused', label: 'Paused' },
            draft: { icon: <Clock size={14} />, class: 'status-draft', label: 'Draft' },
            ended: { icon: <XCircle size={14} />, class: 'status-ended', label: 'Ended' }
        };
        const config = statusConfig[status] || statusConfig.draft;
        return (
            <span className={`status-badge ${config.class}`}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    const getPlatformIcon = (platform) => {
        switch(platform) {
            case 'facebook':
                return <Facebook size={16} className="platform-icon facebook" />;
            case 'instagram':
                return <Instagram size={16} className="platform-icon instagram" />;
            case 'both':
                return (
                    <div className="platform-icon both">
                        <Facebook size={16} />
                        <Instagram size={16} />
                    </div>
                );
            default:
                return null;
        }
    };

    const getPerformanceMetric = (campaign) => {
        const roi = ((campaign.revenue - campaign.spent) / campaign.spent * 100).toFixed(1);
        return (
            <div className="performance-metric">
                <div className="metric-row">
                    <span className="metric-label">ROAS:</span>
                    <span className="metric-value">{(campaign.revenue / campaign.spent).toFixed(2)}x</span>
                </div>
                <div className="metric-row">
                    <span className="metric-label">CTR:</span>
                    <span className="metric-value">{campaign.ctr}%</span>
                </div>
                <div className="metric-row">
                    <span className="metric-label">CPC:</span>
                    <span className="metric-value">${campaign.cpc}</span>
                </div>
                <div className="metric-row">
                    <span className="metric-label">ROI:</span>
                    <span className={`metric-value ${roi >= 0 ? 'positive' : 'negative'}`}>
                        {roi}%
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="campaign-management">
            {/* Header */}
            <div className="campaign-header">
                <div className="header-left">
                    <h1>Campaign Management</h1>
                    <p className="header-subtitle">
                        Create, edit, and manage your Facebook and Instagram ad campaigns
                    </p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => console.log('Export data')}>
                        <Download size={18} />
                        Export
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} />
                        Create Campaign
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-group">
                    <select 
                        className="filter-select"
                        value={selectedPlatform}
                        onChange={(e) => setSelectedPlatform(e.target.value)}
                    >
                        <option value="all">All Platforms</option>
                        <option value="facebook">Facebook Only</option>
                        <option value="instagram">Instagram Only</option>
                        <option value="both">Both Platforms</option>
                    </select>

                    <select 
                        className="filter-select"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="draft">Draft</option>
                        <option value="ended">Ended</option>
                    </select>

                    <select 
                        className="filter-select"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="last7days">Last 7 Days</option>
                        <option value="last30days">Last 30 Days</option>
                        <option value="thisMonth">This Month</option>
                        <option value="lastMonth">Last Month</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    <button className="btn btn-ghost">
                        <Filter size={18} />
                        More Filters
                    </button>
                </div>

                <div className="view-toggle">
                    <button 
                        className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                    >
                        <BarChart3 size={18} />
                    </button>
                    <button 
                        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        <PieChart size={18} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={fetchCampaigns} className="retry-btn">Retry</button>
                </div>
            )}

            {/* Campaigns Stats Overview */}
            <div className="campaigns-stats">
                <div className="stat-card">
                    <div className="stat-icon active">
                        <Play size={20} />
                    </div>
                    <div className="stat-details">
                        <span className="stat-label">Active Campaigns</span>
                        <span className="stat-value">
                            {campaigns.filter(c => c.status === 'active').length}
                        </span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon total">
                        <DollarSign size={20} />
                    </div>
                    <div className="stat-details">
                        <span className="stat-label">Total Spend</span>
                        <span className="stat-value">
                            ${campaigns.reduce((sum, c) => sum + c.spent, 0).toLocaleString()}
                        </span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon revenue">
                        <TrendingUp size={20} />
                    </div>
                    <div className="stat-details">
                        <span className="stat-label">Total Revenue</span>
                        <span className="stat-value">
                            ${campaigns.reduce((sum, c) => sum + c.revenue, 0).toLocaleString()}
                        </span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon impressions">
                        <Eye size={20} />
                    </div>
                    <div className="stat-details">
                        <span className="stat-label">Total Impressions</span>
                        <span className="stat-value">
                            {(campaigns.reduce((sum, c) => sum + c.impressions, 0) / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </div>
            </div>

            {/* Campaigns Grid/List */}
            <div className={`campaigns-container ${viewMode}`}>
                {filteredCampaigns.length === 0 ? (
                    <div className="no-campaigns">
                        {loading ? (
                            <>
                                <RefreshCw size={32} className="spinner" />
                                <h3>Loading campaigns...</h3>
                                <p>Please wait while we fetch your campaigns.</p>
                            </>
                        ) : (
                            <>
                                <AlertCircle size={48} />
                                <h3>No campaigns found</h3>
                                <p>Try adjusting your filters or create a new campaign</p>
                                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                                    <Plus size={18} />
                                    Create Campaign
                                </button>
                            </>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="campaigns-grid">
                        {filteredCampaigns.map(campaign => (
                            <div key={campaign.id} className="campaign-card">
                                <div className="card-header">
                                    <div className="platform-status">
                                        {getPlatformIcon(campaign.platform)}
                                        {getStatusBadge(campaign.status)}
                                    </div>
                                    <div className="card-actions">
                                        <button className="action-btn" onClick={() => {
                                            setSelectedCampaign(campaign);
                                            setShowEditModal(true);
                                        }}>
                                            <Edit size={16} />
                                        </button>
                                        <button className="action-btn" onClick={() => handleDuplicateCampaign(campaign)}>
                                            <Copy size={16} />
                                        </button>
                                        <button className="action-btn" onClick={() => handleDeleteCampaign(campaign.id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="card-content">
                                    <h3 className="campaign-name">{campaign.name}</h3>
                                    <p className="campaign-objective">{campaign.objective}</p>
                                    
                                    <div className="campaign-details">
                                        <div className="detail-item">
                                            <DollarSign size={14} />
                                            <span>${campaign.dailyBudget}/day</span>
                                        </div>
                                        <div className="detail-item">
                                            <Calendar size={14} />
                                            <span>{campaign.startDate} - {campaign.endDate || 'Ongoing'}</span>
                                        </div>
                                        <div className="detail-item">
                                            <Target size={14} />
                                            <span>{campaign.targeting}</span>
                                        </div>
                                    </div>

                                    <div className="campaign-progress">
                                        <div className="progress-header">
                                            <span>Budget Used</span>
                                            <span>{((campaign.spent / (campaign.dailyBudget * 30)) * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: `${(campaign.spent / (campaign.dailyBudget * 30)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {getPerformanceMetric(campaign)}

                                    <div className="card-footer">
                                        <div className="footer-actions">
                                            {campaign.status === 'active' ? (
                                                <button 
                                                    className="pause-btn"
                                                    onClick={() => handlePauseCampaign(campaign.id)}
                                                >
                                                    <Pause size={14} />
                                                    Pause
                                                </button>
                                            ) : campaign.status === 'paused' ? (
                                                <button 
                                                    className="resume-btn"
                                                    onClick={() => handleResumeCampaign(campaign.id)}
                                                >
                                                    <Play size={14} />
                                                    Resume
                                                </button>
                                            ) : null}
                                        </div>
                                        <button className="more-btn">
                                            <MoreVertical size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="campaigns-list">
                        <table className="campaigns-table">
                            <thead>
                                <tr>
                                    <th>Campaign</th>
                                    <th>Platform</th>
                                    <th>Status</th>
                                    <th>Budget</th>
                                    <th>Spent</th>
                                    <th>Impressions</th>
                                    <th>Clicks</th>
                                    <th>CTR</th>
                                    <th>CPC</th>
                                    <th>Revenue</th>
                                    <th>ROAS</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCampaigns.map(campaign => (
                                    <tr key={campaign.id}>
                                        <td>
                                            <div className="campaign-cell">
                                                <strong>{campaign.name}</strong>
                                                <small>{campaign.objective}</small>
                                            </div>
                                        </td>
                                        <td>{getPlatformIcon(campaign.platform)}</td>
                                        <td>{getStatusBadge(campaign.status)}</td>
                                        <td>${campaign.dailyBudget}/day</td>
                                        <td>${campaign.spent.toLocaleString()}</td>
                                        <td>{(campaign.impressions / 1000).toFixed(1)}K</td>
                                        <td>{campaign.clicks.toLocaleString()}</td>
                                        <td>{campaign.ctr}%</td>
                                        <td>${campaign.cpc}</td>
                                        <td>${campaign.revenue.toLocaleString()}</td>
                                        <td>{(campaign.revenue / campaign.spent).toFixed(2)}x</td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="table-action" onClick={() => {
                                                    setSelectedCampaign(campaign);
                                                    setShowEditModal(true);
                                                }}>
                                                    <Edit size={14} />
                                                </button>
                                                {campaign.status === 'active' ? (
                                                    <button className="table-action" onClick={() => handlePauseCampaign(campaign.id)}>
                                                        <Pause size={14} />
                                                    </button>
                                                ) : campaign.status === 'paused' ? (
                                                    <button className="table-action" onClick={() => handleResumeCampaign(campaign.id)}>
                                                        <Play size={14} />
                                                    </button>
                                                ) : null}
                                                <button className="table-action" onClick={() => handleDuplicateCampaign(campaign)}>
                                                    <Copy size={14} />
                                                </button>
                                                <button className="table-action" onClick={() => handleDeleteCampaign(campaign.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <CampaignModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateCampaign}
                    mode="create"
                />
            )}

            {/* Edit Campaign Modal */}
            {showEditModal && selectedCampaign && (
                <CampaignModal
                    campaign={selectedCampaign}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedCampaign(null);
                    }}
                    onSave={handleEditCampaign}
                    mode="edit"
                />
            )}
        </div>
    );
};

// Campaign Modal Component
const CampaignModal = ({ campaign, onClose, onSave, mode }) => {
    const [formData, setFormData] = useState({
        name: campaign?.name || '',
        platform: campaign?.platform || 'both',
        objective: campaign?.objective || 'awareness',
        dailyBudget: campaign?.dailyBudget || 50,
        lifetimeBudget: campaign?.lifetimeBudget || '',
        startDate: campaign?.startDate || '',
        endDate: campaign?.endDate || '',
        targeting: campaign?.targeting || '',
        status: campaign?.status || 'draft'
    });

    const [activeTab, setActiveTab] = useState('basic');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="modal-overlay">
            <div className="campaign-modal">
                <div className="modal-header">
                    <h2>{mode === 'create' ? 'Create New Campaign' : 'Edit Campaign'}</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
                        onClick={() => setActiveTab('basic')}
                    >
                        Basic Info
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'budget' ? 'active' : ''}`}
                        onClick={() => setActiveTab('budget')}
                    >
                        Budget & Schedule
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'targeting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('targeting')}
                    >
                        Targeting
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
                        onClick={() => setActiveTab('advanced')}
                    >
                        Advanced
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-content">
                        {activeTab === 'basic' && (
                            <div className="tab-panel">
                                <div className="form-group">
                                    <label>Campaign Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        placeholder="e.g., Summer Sale 2024"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Platform</label>
                                    <div className="platform-options">
                                        <label className="platform-option">
                                            <input
                                                type="radio"
                                                name="platform"
                                                value="facebook"
                                                checked={formData.platform === 'facebook'}
                                                onChange={(e) => setFormData({...formData, platform: e.target.value})}
                                            />
                                            <Facebook size={20} />
                                            <span>Facebook</span>
                                        </label>
                                        <label className="platform-option">
                                            <input
                                                type="radio"
                                                name="platform"
                                                value="instagram"
                                                checked={formData.platform === 'instagram'}
                                                onChange={(e) => setFormData({...formData, platform: e.target.value})}
                                            />
                                            <Instagram size={20} />
                                            <span>Instagram</span>
                                        </label>
                                        <label className="platform-option">
                                            <input
                                                type="radio"
                                                name="platform"
                                                value="both"
                                                checked={formData.platform === 'both'}
                                                onChange={(e) => setFormData({...formData, platform: e.target.value})}
                                            />
                                            <div className="both-icons">
                                                <Facebook size={20} />
                                                <Instagram size={20} />
                                            </div>
                                            <span>Both</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Campaign Objective</label>
                                    <select
                                        value={formData.objective}
                                        onChange={(e) => setFormData({...formData, objective: e.target.value})}
                                    >
                                        <option value="awareness">Brand Awareness</option>
                                        <option value="traffic">Traffic</option>
                                        <option value="engagement">Engagement</option>
                                        <option value="leads">Lead Generation</option>
                                        <option value="sales">Conversions</option>
                                        <option value="catalog">Catalog Sales</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {activeTab === 'budget' && (
                            <div className="tab-panel">
                                <div className="form-group">
                                    <label>Budget Type</label>
                                    <div className="budget-type-options">
                                        <label className="budget-option">
                                            <input
                                                type="radio"
                                                name="budgetType"
                                                value="daily"
                                                checked={!!formData.dailyBudget}
                                                onChange={() => setFormData({...formData, dailyBudget: 50, lifetimeBudget: ''})}
                                            />
                                            <span>Daily Budget</span>
                                        </label>
                                        <label className="budget-option">
                                            <input
                                                type="radio"
                                                name="budgetType"
                                                value="lifetime"
                                                checked={!!formData.lifetimeBudget}
                                                onChange={() => setFormData({...formData, lifetimeBudget: 1000, dailyBudget: ''})}
                                            />
                                            <span>Lifetime Budget</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.dailyBudget && (
                                    <div className="form-group">
                                        <label>Daily Budget ($)</label>
                                        <input
                                            type="number"
                                            value={formData.dailyBudget}
                                            onChange={(e) => setFormData({...formData, dailyBudget: parseInt(e.target.value)})}
                                            min="1"
                                            required
                                        />
                                    </div>
                                )}

                                {formData.lifetimeBudget && (
                                    <div className="form-group">
                                        <label>Lifetime Budget ($)</label>
                                        <input
                                            type="number"
                                            value={formData.lifetimeBudget}
                                            onChange={(e) => setFormData({...formData, lifetimeBudget: parseInt(e.target.value)})}
                                            min="1"
                                            required
                                        />
                                    </div>
                                )}

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Start Date</label>
                                        <input
                                            type="date"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>End Date (Optional)</label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Schedule</label>
                                    <div className="schedule-options">
                                        <label className="schedule-option">
                                            <input type="checkbox" /> Run continuously
                                        </label>
                                        <label className="schedule-option">
                                            <input type="checkbox" /> Run only on weekdays
                                        </label>
                                        <label className="schedule-option">
                                            <input type="checkbox" /> Set specific hours
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'targeting' && (
                            <div className="tab-panel">
                                <div className="form-group">
                                    <label>Location</label>
                                    <input
                                        type="text"
                                        value={formData.targeting}
                                        onChange={(e) => setFormData({...formData, targeting: e.target.value})}
                                        placeholder="e.g., United States, Canada"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Age Range</label>
                                    <div className="age-range">
                                        <input type="number" placeholder="18" min="13" max="65" />
                                        <span>to</span>
                                        <input type="number" placeholder="65" min="13" max="65" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Gender</label>
                                    <select>
                                        <option>All</option>
                                        <option>Male</option>
                                        <option>Female</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Interests</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Fitness, Technology, Fashion"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Behaviors</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Frequent travelers, Online shoppers"
                                    />
                                </div>

                                <button type="button" className="btn btn-secondary">
                                    <Plus size={16} />
                                    Add Targeting Layer
                                </button>
                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div className="tab-panel">
                                <div className="form-group">
                                    <label>Optimization Goal</label>
                                    <select>
                                        <option>Impressions</option>
                                        <option>Clicks</option>
                                        <option>Conversions</option>
                                        <option>Reach</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Bid Strategy</label>
                                    <select>
                                        <option>Lowest cost</option>
                                        <option>Target cost</option>
                                        <option>Bid cap</option>
                                        <option>Cost cap</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Ad Scheduling</label>
                                    <div className="ad-scheduling">
                                        {/* Add scheduling interface */}
                                        <p>Set specific times for ads to run</p>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Conversion Tracking</label>
                                    <select>
                                        <option>Pixel: Standard Events</option>
                                        <option>Pixel: Custom Conversions</option>
                                        <option>Offline Conversions</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            <Save size={16} />
                            {mode === 'create' ? 'Create Campaign' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Mock data
const mockCampaigns = [
    {
        id: 1,
        name: 'Summer Sale 2024',
        platform: 'both',
        objective: 'Conversions',
        status: 'active',
        dailyBudget: 100,
        spent: 2450,
        impressions: 150000,
        clicks: 4500,
        ctr: 3.0,
        cpc: 0.54,
        revenue: 8900,
        startDate: '2024-06-01',
        endDate: '',
        targeting: 'US, CA, 18-45',
        createdAt: '2024-05-15'
    },
    {
        id: 2,
        name: 'Brand Awareness Q3',
        platform: 'facebook',
        objective: 'Awareness',
        status: 'paused',
        dailyBudget: 75,
        spent: 1200,
        impressions: 200000,
        clicks: 1800,
        ctr: 0.9,
        cpc: 0.67,
        revenue: 0,
        startDate: '2024-07-01',
        endDate: '2024-07-15',
        targeting: 'US, 25-54',
        createdAt: '2024-06-20'
    },
    {
        id: 3,
        name: 'Instagram Stories Campaign',
        platform: 'instagram',
        objective: 'Engagement',
        status: 'active',
        dailyBudget: 50,
        spent: 850,
        impressions: 95000,
        clicks: 3200,
        ctr: 3.4,
        cpc: 0.27,
        revenue: 2100,
        startDate: '2024-07-10',
        endDate: '',
        targeting: 'Global, 18-34',
        createdAt: '2024-07-01'
    },
    {
        id: 4,
        name: 'Retargeting Campaign',
        platform: 'both',
        objective: 'Conversions',
        status: 'draft',
        dailyBudget: 150,
        spent: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        revenue: 0,
        startDate: '2024-08-01',
        endDate: '',
        targeting: 'Website Visitors',
        createdAt: '2024-07-25'
    },
    {
        id: 5,
        name: 'Holiday Special',
        platform: 'both',
        objective: 'Sales',
        status: 'ended',
        dailyBudget: 200,
        spent: 5600,
        impressions: 420000,
        clicks: 12500,
        ctr: 3.0,
        cpc: 0.45,
        revenue: 18700,
        startDate: '2023-12-01',
        endDate: '2023-12-31',
        targeting: 'US, CA, UK',
        createdAt: '2023-11-15'
    }
];

export default CampaignManagement;
