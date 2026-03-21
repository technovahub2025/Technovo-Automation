// CampaignManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
const getTodayDateValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

const getOptimizationGoalOptions = (objective) => {
    switch (String(objective || '').toLowerCase()) {
        case 'traffic':
            return [
                { value: 'LINK_CLICKS', label: 'Clicks' },
                { value: 'LANDING_PAGE_VIEWS', label: 'Landing page views' },
                { value: 'REACH', label: 'Reach' },
                { value: 'IMPRESSIONS', label: 'Impressions' }
            ];
        case 'engagement':
            return [
                { value: 'POST_ENGAGEMENT', label: 'Post engagement' },
                { value: 'REACH', label: 'Reach' },
                { value: 'IMPRESSIONS', label: 'Impressions' }
            ];
        case 'leads':
            return [
                { value: 'LEADS', label: 'Leads' },
                { value: 'QUALITY_LEAD', label: 'Quality leads' },
                { value: 'CONVERSATIONS', label: 'Conversations' }
            ];
        case 'sales':
            return [
                { value: 'OFFSITE_CONVERSIONS', label: 'Conversions' },
                { value: 'VALUE', label: 'Value' },
                { value: 'LINK_CLICKS', label: 'Clicks' }
            ];
        case 'awareness':
        default:
            return [
                { value: 'REACH', label: 'Reach' },
                { value: 'IMPRESSIONS', label: 'Impressions' }
            ];
    }
};

const getDefaultOptimizationGoal = (objective) => {
    const options = getOptimizationGoalOptions(objective);
    return options[0]?.value || 'REACH';
};

const CampaignManagement = () => {
    const navigate = useNavigate();
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
    const [metaSetupReady, setMetaSetupReady] = useState(true);
    const [metaSetupLoading, setMetaSetupLoading] = useState(true);
    const [metaSetupMessage, setMetaSetupMessage] = useState('');

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
        revenue: campaign.revenue || 0,
        ageMin: campaign.ageMin || 18,
        ageMax: campaign.ageMax || 65,
        gender: campaign.gender || 'all',
        interests: campaign.interests || '',
        behaviors: campaign.behaviors || '',
        primaryText: campaign.primaryText || '',
        headline: campaign.headline || '',
        description: campaign.description || '',
        destinationUrl: campaign.destinationUrl || '',
        imageUrl: campaign.imageUrl || '',
        callToAction: campaign.callToAction || 'LEARN_MORE',
        optimizationGoal: campaign.optimizationGoal || getDefaultOptimizationGoal(campaign.objective || 'awareness'),
        bidStrategy: campaign.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        metaCampaignId: campaign.metaCampaignId || '',
        metaAdSetId: campaign.metaAdSetId || '',
        metaAdId: campaign.metaAdId || '',
        lifecycleStatus: campaign.lifecycleStatus || (campaign.status === 'active' ? 'running' : campaign.status === 'paused' ? 'paused' : 'draft'),
        paymentStatus: campaign.paymentStatus || 'verified',
        reviewStatus: campaign.reviewStatus || 'approved',
        deliveryStatus: campaign.deliveryStatus || (campaign.status === 'active' ? 'active' : campaign.status === 'paused' ? 'paused' : 'not_published'),
        reviewNotes: campaign.reviewNotes || '',
        source: campaign.source || 'local',
        readOnly: Boolean(campaign.readOnly),
        syncedFromMeta: Boolean(campaign.syncedFromMeta)
    });

    const getSafeRatio = (numerator, denominator) => {
        const top = Number(numerator || 0);
        const bottom = Number(denominator || 0);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) {
            return 0;
        }
        return top / bottom;
    };

    const sanitizePayload = (data) => {
        const payload = { ...data };

        // Remove empty strings
        [
            'startDate',
            'endDate',
            'targeting',
            'interests',
            'behaviors',
            'primaryText',
            'headline',
            'description',
            'destinationUrl',
            'imageUrl'
        ].forEach((key) => {
            if (!payload[key]) delete payload[key];
        });

        delete payload.creativeImage;

        // Numbers
        ['dailyBudget', 'lifetimeBudget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'revenue', 'ageMin', 'ageMax'].forEach((key) => {
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

    const buildCampaignPayload = (data) => {
        const payload = sanitizePayload(data);
        if (!data?.creativeImage) {
            return payload;
        }

        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                formData.append(key, value);
            }
        });
        formData.append('creativeImage', data.creativeImage);
        return formData;
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

    const fetchMetaSetupState = useCallback(async () => {
        setMetaSetupLoading(true);
        try {
            const response = await api.get('/api/meta-ads/overview', {
                headers: getAuthHeaders()
            });
            const setup = response?.data?.setup || {};
            const isReady = Boolean(setup.connected && setup.adAccountId && setup.pageId);
            setMetaSetupReady(isReady);
            setMetaSetupMessage(
                setup.setupError || 'Connect Meta, select an ad account and Facebook page to continue.'
            );
        } catch (loadError) {
            setMetaSetupReady(false);
            setMetaSetupMessage(
                loadError?.response?.data?.error ||
                loadError?.response?.data?.message ||
                'Connect Meta to unlock Ads Manager.'
            );
        } finally {
            setMetaSetupLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    useEffect(() => {
        fetchMetaSetupState();
    }, [fetchMetaSetupState]);

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
            const payload = buildCampaignPayload(campaignData);
            const headers = {
                ...getAuthHeaders(),
                ...(payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {})
            };
            await api.post('/api/campaigns', payload, { headers });
            await fetchCampaigns();
            setShowCreateModal(false);
        } catch (err) {
            console.error('Create failed', err?.response?.data || err.message);
            const responseData = err?.response?.data || {};
            const detailMessage = responseData?.details?.error?.error_user_msg;
            const stageMessage = responseData?.metaStage ? `${responseData.metaStage}: ` : '';
            const validationMessage = Array.isArray(responseData?.errors) && responseData.errors.length
                ? responseData.errors.map((item) => item?.message || item?.msg).filter(Boolean).join(', ')
                : '';
            setError(
                validationMessage ||
                responseData?.message ||
                (detailMessage ? `${stageMessage}${detailMessage}` : 'Create campaign failed.')
            );
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
            const payload = buildCampaignPayload(campaignData);
            const headers = {
                ...getAuthHeaders(),
                ...(payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {})
            };
            await api.put(`/api/campaigns/${selectedCampaign.id}`, payload, { headers });
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

    const handleDeleteCampaign = async (campaign) => {
        const campaignId = typeof campaign === 'object' ? campaign?.id : campaign;
        if (
            !campaignId ||
            !window.confirm('Are you sure you want to delete this campaign? This will also archive the linked Meta campaign assets before removing it from the database.')
        ) return;

        if (USE_MOCK) {
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
            return;
        }

        try {
            setLoading(true);
            await api.delete(`/api/campaigns/${campaignId}`, {
                headers: getAuthHeaders(),
                data: typeof campaign === 'object' ? {
                    metaCampaignId: campaign.metaCampaignId || '',
                    metaAdSetId: campaign.metaAdSetId || '',
                    metaAdId: campaign.metaAdId || ''
                } : undefined
            });
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
            setCampaigns(prev => [...prev, normalizeCampaign({
                ...campaign,
                id: Date.now(),
                status: 'draft',
                name: `${campaign.name} (Copy)`,
                lifecycleStatus: 'draft',
                paymentStatus: 'verified',
                reviewStatus: 'approved',
                deliveryStatus: 'not_published'
            })]);
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

    const runWorkflowAction = async (campaignId, endpoint, fallbackMessage, options = {}) => {
        if (USE_MOCK) return;

        try {
            setLoading(true);
            setError('');
            await api.post(`/api/campaigns/${campaignId}/${endpoint}`, options.body || {}, {
                headers: getAuthHeaders()
            });
            await fetchCampaigns();
        } catch (err) {
            console.error(`${endpoint} failed`, err?.response?.data || err.message);
            const responseData = err?.response?.data || {};
            const detailMessage =
                responseData?.details?.error?.error_user_msg ||
                responseData?.details?.error?.message;
            const composedMessage =
                responseData?.message ||
                (detailMessage ? `${responseData?.metaStage ? `${responseData.metaStage}: ` : ''}${detailMessage}` : fallbackMessage);
            setError(composedMessage);
        } finally {
            setLoading(false);
        }
    };

    const handlePublishCampaign = (campaignId) => {
        if (!window.confirm('Publish this campaign to Meta now? This will create live ad assets.')) return;
        runWorkflowAction(campaignId, 'publish', 'Publish campaign failed.');
    };

    const getStatusBadge = (campaignOrStatus) => {
        const status = typeof campaignOrStatus === 'string' ? campaignOrStatus : campaignOrStatus?.status;
        const lifecycleStatus = typeof campaignOrStatus === 'object' ? campaignOrStatus?.lifecycleStatus : null;
        const statusKey = lifecycleStatus || status;
        const statusConfig = {
            active: { icon: <Play size={14} />, class: 'status-active', label: 'Active' },
            running: { icon: <Play size={14} />, class: 'status-active', label: 'Running' },
            paused: { icon: <Pause size={14} />, class: 'status-paused', label: 'Paused' },
            draft: { icon: <Clock size={14} />, class: 'status-draft', label: 'Draft' },
            publishing: { icon: <RefreshCw size={14} />, class: 'status-review', label: 'Publishing' },
            rejected: { icon: <XCircle size={14} />, class: 'status-ended', label: 'Rejected' },
            completed: { icon: <CheckCircle size={14} />, class: 'status-approved', label: 'Completed' },
            ended: { icon: <XCircle size={14} />, class: 'status-ended', label: 'Ended' }
        };
        const config = statusConfig[statusKey] || statusConfig.draft;
        return (
            <span className={`status-badge ${config.class}`}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    const getMiniBadge = (label, tone = 'neutral') => (
        <span className={`mini-badge mini-${tone}`}>{label}</span>
    );

    const getCampaignStageMeta = (campaign) => {
        const deliveryMap = {
            active: getMiniBadge('Live on Meta', 'success'),
            paused: getMiniBadge('Delivery Paused', 'warning'),
            publishing: getMiniBadge('Publishing', 'info'),
            rejected: getMiniBadge('Delivery Rejected', 'danger'),
            not_published: getMiniBadge('Not Published', 'neutral')
        };

        return [
            deliveryMap[campaign.deliveryStatus] || deliveryMap.not_published
        ];
    };

    const getWorkflowActions = (campaign, variant = 'card') => {
        if (campaign.readOnly) return [];

        const actionClass = variant === 'table' ? 'table-workflow-btn' : 'workflow-btn';
        const actions = [];

        if (campaign.lifecycleStatus === 'draft' || campaign.lifecycleStatus === 'approved' || campaign.lifecycleStatus === 'pending_review') {
            actions.push({
                key: 'publish',
                label: 'Publish',
                className: `${actionClass} workflow-primary`,
                icon: <Play size={14} />,
                onClick: () => handlePublishCampaign(campaign.id)
            });
        }

        if (campaign.status === 'active') {
            actions.push({
                key: 'pause',
                label: 'Pause',
                className: `${actionClass} workflow-secondary`,
                icon: <Pause size={14} />,
                onClick: () => handlePauseCampaign(campaign.id)
            });
        } else if (campaign.status === 'paused' && campaign.metaCampaignId) {
            actions.push({
                key: 'resume',
                label: 'Resume',
                className: `${actionClass} workflow-secondary`,
                icon: <Play size={14} />,
                onClick: () => handleResumeCampaign(campaign.id)
            });
        }

        return actions;
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
        const roi = (getSafeRatio(campaign.revenue - campaign.spent, campaign.spent) * 100).toFixed(1);
        const roas = getSafeRatio(campaign.revenue, campaign.spent).toFixed(2);
        return (
            <div className="performance-metric">
                <div className="metric-row">
                    <span className="metric-label">ROAS:</span>
                    <span className="metric-value">{roas}x</span>
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
        <div className="meta-access-shell">
        <div className={`campaign-management ${!metaSetupLoading && !metaSetupReady ? 'meta-access-blurred' : ''}`}>
            {/* Header */}
            <div className="campaign-header">
                <div className="header-left">
                    <h1>Campaign Management</h1>
                    <p className="header-subtitle">
                        Create, edit, and manage your Facebook and Instagram ad campaigns
                    </p>
                </div>
                <div className="header-actions">
                    {!metaSetupLoading && !metaSetupReady ? (
                        <button className="btn btn-secondary" onClick={() => navigate('/meta-connect')}>
                            <Facebook size={18} />
                            Connect Meta
                        </button>
                    ) : null}
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
                            {campaigns.filter(c => c.lifecycleStatus === 'running' || c.status === 'active').length}
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
                                        {getStatusBadge(campaign)}
                                    </div>
                                    <div className="card-actions">
                                        {campaign.readOnly ? (
                                            <>
                                                <span className="status-badge status-draft">Meta</span>
                                                <button className="action-btn" onClick={() => handleDeleteCampaign(campaign)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="action-btn" onClick={() => {
                                                    setSelectedCampaign(campaign);
                                                    setShowEditModal(true);
                                                }}>
                                                    <Edit size={16} />
                                                </button>
                                                <button className="action-btn" onClick={() => handleDuplicateCampaign(campaign)}>
                                                    <Copy size={16} />
                                                </button>
                                                <button className="action-btn" onClick={() => handleDeleteCampaign(campaign)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="card-content">
                                    <h3 className="campaign-name">{campaign.name}</h3>
                                    <p className="campaign-objective">
                                        {campaign.objective}
                                        {campaign.readOnly ? ' • Synced from Meta Ads' : ''}
                                    </p>
                                    <div className="campaign-stage-row">
                                        {getCampaignStageMeta(campaign).map((badge, index) => (
                                            <React.Fragment key={`${campaign.id}-stage-${index}`}>{badge}</React.Fragment>
                                        ))}
                                    </div>

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
                                            <span>{(getSafeRatio(campaign.spent, campaign.dailyBudget * 30) * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill"
                                                style={{ width: `${Math.min(100, getSafeRatio(campaign.spent, campaign.dailyBudget * 30) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {getPerformanceMetric(campaign)}

                                    <div className="card-footer">
                                        <div className="footer-actions">
                                            {getWorkflowActions(campaign).map((action) => (
                                                <button
                                                    key={action.key}
                                                    className={action.className}
                                                    onClick={action.onClick}
                                                    type="button"
                                                >
                                                    {action.icon}
                                                    {action.label}
                                                </button>
                                            ))}
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
                                                <div className="table-stage-row">
                                                    {getCampaignStageMeta(campaign).map((badge, index) => (
                                                        <React.Fragment key={`${campaign.id}-table-stage-${index}`}>{badge}</React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{getPlatformIcon(campaign.platform)}</td>
                                        <td>{getStatusBadge(campaign)}</td>
                                        <td>${campaign.dailyBudget}/day</td>
                                        <td>${campaign.spent.toLocaleString()}</td>
                                        <td>{(campaign.impressions / 1000).toFixed(1)}K</td>
                                        <td>{campaign.clicks.toLocaleString()}</td>
                                        <td>{campaign.ctr}%</td>
                                        <td>${campaign.cpc}</td>
                                        <td>${campaign.revenue.toLocaleString()}</td>
                                        <td>{getSafeRatio(campaign.revenue, campaign.spent).toFixed(2)}x</td>
                                        <td>
                                            <div className="table-actions">
                                                {campaign.readOnly ? (
                                                    <>
                                                        <span className="status-badge status-draft">Meta</span>
                                                        <button className="table-action" onClick={() => handleDeleteCampaign(campaign)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {getWorkflowActions(campaign, 'table').map((action) => (
                                                            <button
                                                                key={action.key}
                                                                className={action.className}
                                                                onClick={action.onClick}
                                                                type="button"
                                                                title={action.label}
                                                            >
                                                                {action.icon}
                                                            </button>
                                                        ))}
                                                        <button className="table-action" onClick={() => {
                                                            setSelectedCampaign(campaign);
                                                            setShowEditModal(true);
                                                        }}>
                                                            <Edit size={14} />
                                                        </button>
                                                        <button className="table-action" onClick={() => handleDuplicateCampaign(campaign)}>
                                                            <Copy size={14} />
                                                        </button>
                                                        <button className="table-action" onClick={() => handleDeleteCampaign(campaign)}>
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
        {!metaSetupLoading && !metaSetupReady ? (
            <div className="meta-access-overlay">
                <div className="meta-access-card">
                    <div className="meta-access-icon">
                        <Facebook size={24} />
                    </div>
                    <h2>Connect Meta to unlock Ads Manager</h2>
                    <p>{metaSetupMessage}</p>
                    <button className="btn btn-primary" onClick={() => navigate('/meta-connect')} type="button">
                        <Facebook size={18} />
                        Connect Meta
                    </button>
                </div>
            </div>
        ) : null}
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
        startDate: campaign?.startDate || getTodayDateValue(),
        endDate: campaign?.endDate || '',
        targeting: campaign?.targeting || '',
        status: campaign?.status || 'draft',
        ageMin: campaign?.ageMin || 18,
        ageMax: campaign?.ageMax || 65,
        gender: campaign?.gender || 'all',
        interests: campaign?.interests || '',
        behaviors: campaign?.behaviors || '',
        primaryText: campaign?.primaryText || '',
        headline: campaign?.headline || '',
        description: campaign?.description || '',
        destinationUrl: campaign?.destinationUrl || '',
        imageUrl: campaign?.imageUrl || '',
        creativeImage: null,
        callToAction: campaign?.callToAction || 'LEARN_MORE',
        optimizationGoal: campaign?.optimizationGoal || getDefaultOptimizationGoal(campaign?.objective || 'awareness'),
        bidStrategy: campaign?.bidStrategy || 'LOWEST_COST_WITHOUT_CAP'
    });

    const [activeTab, setActiveTab] = useState('basic');
    const tabSteps = [
        { key: 'basic', label: 'Basic Info', step: 1 },
        { key: 'budget', label: 'Budget & Schedule', step: 2 },
        { key: 'targeting', label: 'Targeting', step: 3 },
        { key: 'advanced', label: 'Advanced', step: 4 }
    ];

    useEffect(() => {
        const allowedOptions = getOptimizationGoalOptions(formData.objective);
        const allowedValues = allowedOptions.map((option) => option.value);

        if (!allowedValues.includes(formData.optimizationGoal)) {
            setFormData((prev) => ({
                ...prev,
                optimizationGoal: allowedOptions[0]?.value || prev.optimizationGoal
            }));
        }
    }, [formData.objective, formData.optimizationGoal]);

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

                <div className="modal-tabs step-tabs">
                    {tabSteps.map((tab, index) => (
                        <React.Fragment key={tab.key}>
                            <button 
                                type="button"
                                className={`tab-btn step-tab ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                <span className="step-number">{tab.step}</span>
                                <span className="step-label">{tab.label}</span>
                            </button>
                            {index < tabSteps.length - 1 ? <span className="step-divider" aria-hidden="true" /> : null}
                        </React.Fragment>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="campaign-create-content">
                        {activeTab === 'basic' && (
                            <div className="tab-panel basic-tab-panel">
                                <section className="basic-panel-section">
                                    <div className="form-group">
                                        <label>Campaign Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            placeholder="Enter campaign name"
                                            required
                                        />
                                    </div>
                                </section>

                                <section className="basic-panel-section">
                                    <div className="form-group">
                                        <label>Select Platform</label>
                                        <div className="platform-card-grid">
                                            <button
                                                type="button"
                                                className={`platform-card ${formData.platform === 'facebook' ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, platform: 'facebook' })}
                                            >
                                                <Facebook size={34} />
                                                <span>Facebook</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`platform-card instagram-card ${formData.platform === 'instagram' ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, platform: 'instagram' })}
                                            >
                                                <Instagram size={34} />
                                                <span>Instagram</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`platform-card ${formData.platform === 'both' ? 'selected' : ''}`}
                                                onClick={() => setFormData({ ...formData, platform: 'both' })}
                                            >
                                                <div className="platform-card-icons">
                                                    <Facebook size={34} />
                                                    <Instagram size={34} />
                                                </div>
                                                <span>Facebook + Instagram</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <section className="basic-panel-section compact-fields">
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
                                </section>
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
                                        <input
                                            type="number"
                                            value={formData.ageMin}
                                            onChange={(e) => setFormData({...formData, ageMin: parseInt(e.target.value || '18', 10)})}
                                            placeholder="18"
                                            min="13"
                                            max="65"
                                        />
                                        <span>to</span>
                                        <input
                                            type="number"
                                            value={formData.ageMax}
                                            onChange={(e) => setFormData({...formData, ageMax: parseInt(e.target.value || '65', 10)})}
                                            placeholder="65"
                                            min="13"
                                            max="65"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                                    >
                                        <option value="all">All</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Interests</label>
                                    <input
                                        type="text"
                                        value={formData.interests}
                                        onChange={(e) => setFormData({...formData, interests: e.target.value})}
                                        placeholder="e.g., Fitness, Technology, Fashion"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Behaviors</label>
                                    <input
                                        type="text"
                                        value={formData.behaviors}
                                        onChange={(e) => setFormData({...formData, behaviors: e.target.value})}
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
                                    <select
                                        value={formData.optimizationGoal}
                                        onChange={(e) => setFormData({...formData, optimizationGoal: e.target.value})}
                                    >
                                        {getOptimizationGoalOptions(formData.objective).map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Bid Strategy</label>
                                    <select
                                        value={formData.bidStrategy}
                                        onChange={(e) => setFormData({...formData, bidStrategy: e.target.value})}
                                    >
                                        <option value="LOWEST_COST_WITHOUT_CAP">Lowest cost</option>
                                        <option value="TARGET_COST">Target cost</option>
                                        <option value="LOWEST_COST_WITH_BID_CAP">Bid cap</option>
                                        <option value="COST_CAP">Cost cap</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Primary Text</label>
                                    <textarea
                                        value={formData.primaryText}
                                        onChange={(e) => setFormData({...formData, primaryText: e.target.value})}
                                        placeholder="Write the main ad copy"
                                        rows="4"
                                        required={mode === 'create'}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Headline</label>
                                    <input
                                        type="text"
                                        value={formData.headline}
                                        onChange={(e) => setFormData({...formData, headline: e.target.value})}
                                        placeholder="Ad headline"
                                        required={mode === 'create'}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                        placeholder="Optional short description"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Destination URL</label>
                                    <input
                                        type="url"
                                        value={formData.destinationUrl}
                                        onChange={(e) => setFormData({...formData, destinationUrl: e.target.value})}
                                        placeholder="https://example.com/landing-page"
                                        required={mode === 'create'}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>CTA Button</label>
                                    <select
                                        value={formData.callToAction}
                                        onChange={(e) => setFormData({...formData, callToAction: e.target.value})}
                                    >
                                        <option value="LEARN_MORE">Learn More</option>
                                        <option value="SHOP_NOW">Shop Now</option>
                                        <option value="SIGN_UP">Sign Up</option>
                                        <option value="CONTACT_US">Contact Us</option>
                                        <option value="APPLY_NOW">Apply Now</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Image URL</label>
                                    <input
                                        type="url"
                                        value={formData.imageUrl}
                                        onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                                        placeholder="https://example.com/ad-image.jpg"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Upload Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setFormData({...formData, creativeImage: e.target.files?.[0] || null})}
                                    />
                                    {formData.creativeImage ? <small>{formData.creativeImage.name}</small> : null}
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

                    <div className="campaign-create-footer">
                        <button type="button" className="btn btn-secondary campaign-create-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary campaign-create-submit">
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
