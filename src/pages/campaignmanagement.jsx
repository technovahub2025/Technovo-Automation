// CampaignManagement.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
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
    ExternalLink,
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
import apiService from '../services/api';
import { resolveApiBaseUrl } from '../services/apiBaseUrl';
import CampaignDeleteDialog from '../components/campaigns/CampaignDeleteDialog';


const API_BASE_URL = resolveApiBaseUrl();
const USE_MOCK = false;
const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
const ITEMS_PER_PAGE = 3;
const getTodayDateValue = () => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
};

const normalizeCampaignObjective = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    const compact = raw.replace(/[^a-z0-9]+/g, '_');

    if (!compact) return 'awareness';
    if (['awareness', 'reach', 'impressions', 'outcome_awareness'].includes(compact)) return 'awareness';
    if (['traffic', 'link_clicks', 'landing_page_views', 'outcome_traffic'].includes(compact)) return 'traffic';
    if (['engagement', 'post_engagement', 'outcome_engagement'].includes(compact)) return 'engagement';
    if (['leads', 'quality_lead', 'conversations', 'outcome_leads'].includes(compact)) return 'leads';
    if (['sales', 'value', 'offsite_conversions', 'outcome_sales'].includes(compact)) return 'sales';
    if (['catalog', 'catalog_sales', 'outcome_catalog_sales'].includes(compact)) return 'catalog';

    // Common Meta UI labels that need to map into the backend contract.
    if (compact.includes('awareness')) return 'awareness';
    if (compact.includes('traffic') || compact.includes('click')) return 'traffic';
    if (compact.includes('engagement')) return 'engagement';
    if (compact.includes('lead')) return 'leads';
    if (compact.includes('sale') || compact.includes('conversion')) return 'sales';

    return 'awareness';
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
                { value: 'LEAD_GENERATION', label: 'Lead generation' },
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

const normalizeOptimizationGoal = (objective, optimizationGoal) => {
    const normalizedObjective = String(objective || '').trim().toLowerCase();
    const normalizedGoal = String(optimizationGoal || '').trim().toUpperCase();
    const aliasMap = {
        LEADS: 'LEAD_GENERATION'
    };
    const resolvedGoal = aliasMap[normalizedGoal] || normalizedGoal;
    const allowedGoals = getOptimizationGoalOptions(normalizedObjective).map((option) => option.value);

    return allowedGoals.includes(resolvedGoal) ? resolvedGoal : getDefaultOptimizationGoal(normalizedObjective);
};

const toNumberOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const toBudgetInputValue = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
};

const getCampaignContractField = (campaign, contractKey, fallbackKey, defaultValue = '') => {
    const contractValue = campaign?.[contractKey];
    if (contractValue !== undefined && contractValue !== null && contractValue !== '') return contractValue;
    const fallbackValue = campaign?.[fallbackKey];
    if (fallbackValue !== undefined && fallbackValue !== null && fallbackValue !== '') return fallbackValue;
    return defaultValue;
};

const getCampaignCreativeImageUrl = (campaign = {}) => {
    const candidates = [
        campaign?.imageUrl,
        campaign?.mediaUrl,
        campaign?.creative?.mediaUrl,
        campaign?.creative?.imageUrl,
        campaign?.metaResponse?.creative?.mediaUrl,
        campaign?.metaResponse?.creative?.imageUrl,
        campaign?.metaResponse?.creativeUpload?.mediaUrl,
        campaign?.metaResponse?.creativeUpload?.secureUrl,
        campaign?.metaResponse?.mediaUrl,
        campaign?.metaResponse?.imageUrl
    ];

    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw) continue;

        if (
            /lh3\.googleusercontent\.com\/aida-public/i.test(raw) ||
            /googleusercontent\.com\/aida-public/i.test(raw)
        ) {
            continue;
        }

        if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('data:image/')) {
            return raw;
        }
    }

    return '';
};

const resolveSafeExternalUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
};

const CampaignManagement = () => {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingCampaign, setSavingCampaign] = useState(false);
    const [error, setError] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // grid or list
    const [dateRange, setDateRange] = useState('last30days');
    const [currentPage, setCurrentPage] = useState(1);
    const [metaSetupReady, setMetaSetupReady] = useState(true);
    const [metaSetupLoading, setMetaSetupLoading] = useState(true);
    const [metaSetupMessage, setMetaSetupMessage] = useState('');
    const [metaWalletBalance, setMetaWalletBalance] = useState(0);
    const [metaSetup, setMetaSetup] = useState(null);
    const [metaPaymentFundUrl, setMetaPaymentFundUrl] = useState('');
    const [campaignFlash, setCampaignFlash] = useState('');
    const campaignPreviews = useRef(new Map());
    const loadedCampaigns = useRef(false);

    useEffect(() => () => {
        campaignPreviews.current.forEach((url) => URL.revokeObjectURL(url));
    }, []);
    const [deletingCampaignId, setDeletingCampaignId] = useState('');
    const [campaignToDelete, setCampaignToDelete] = useState(null);
    const [deleteError, setDeleteError] = useState('');
    const dateRangeLabels = {
        today: 'Today',
        yesterday: 'Yesterday',
        last7days: 'Last 7 Days',
        last30days: 'Last 30 Days',
        thisMonth: 'This Month',
        lastMonth: 'Last Month'
    };

    const getAuthHeaders = useCallback(() => {
        const token =
            localStorage.getItem(tokenKey) ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    const normalizeCampaign = (campaign) => {
        const audience = campaign?.audience || {};
        const deliveryPolicy = campaign?.deliveryPolicy || {};
        const analytics = campaign?.analytics || {};
        const retryPolicy = campaign?.retryPolicy || {};
        const compliancePolicy = campaign?.compliancePolicy || {};
        const objective = String(getCampaignContractField(audience, 'objective', 'objective', campaign?.objective || 'awareness'));
        const platform = String(getCampaignContractField(audience, 'platform', 'platform', campaign?.platform || 'both'));
        const status = String(
            campaign?.status ||
            getCampaignContractField(deliveryPolicy, 'status', 'status', campaign?.status || 'draft')
        );
        const startDateRaw = getCampaignContractField(deliveryPolicy, 'startDate', 'startDate', campaign?.startDate || '');
        const endDateRaw = getCampaignContractField(deliveryPolicy, 'endDate', 'endDate', campaign?.endDate || '');

        return {
            ...campaign,
            id: campaign._id || campaign.id,
            audience,
            deliveryPolicy,
            retryPolicy,
            compliancePolicy,
            analytics,
            startDate: startDateRaw ? String(startDateRaw).slice(0, 10) : '',
            endDate: endDateRaw ? String(endDateRaw).slice(0, 10) : '',
            platform,
            status,
            objective,
            targeting: getCampaignContractField(audience, 'targeting', 'targeting', campaign?.targeting || ''),
            dailyBudget: Number(getCampaignContractField(deliveryPolicy, 'dailyBudget', 'dailyBudget', campaign?.dailyBudget || 0) || 0),
            lifetimeBudget: Number(getCampaignContractField(deliveryPolicy, 'lifetimeBudget', 'lifetimeBudget', campaign?.lifetimeBudget || 0) || 0),
            spent: Number(getCampaignContractField(analytics, 'spent', 'spent', campaign?.spent || 0) || 0),
            impressions: Number(getCampaignContractField(analytics, 'impressions', 'impressions', campaign?.impressions || 0) || 0),
            clicks: Number(getCampaignContractField(analytics, 'clicks', 'clicks', campaign?.clicks || 0) || 0),
            ctr: Number(getCampaignContractField(analytics, 'ctr', 'ctr', campaign?.ctr || 0) || 0),
            cpc: Number(getCampaignContractField(analytics, 'cpc', 'cpc', campaign?.cpc || 0) || 0),
            revenue: Number(getCampaignContractField(analytics, 'revenue', 'revenue', campaign?.revenue || 0) || 0),
            roi: Number(getCampaignContractField(analytics, 'roi', 'roi', campaign?.roi || 0) || 0),
            conversions: campaign.conversions ?? campaign.leads ?? 0,
            ageMin: Number(getCampaignContractField(audience, 'ageMin', 'ageMin', campaign?.ageMin || 18) || 18),
            ageMax: Number(getCampaignContractField(audience, 'ageMax', 'ageMax', campaign?.ageMax || 65) || 65),
            gender: getCampaignContractField(audience, 'gender', 'gender', campaign?.gender || 'all'),
            interests: getCampaignContractField(audience, 'interests', 'interests', campaign?.interests || ''),
            behaviors: getCampaignContractField(audience, 'behaviors', 'behaviors', campaign?.behaviors || ''),
            primaryText: campaign.primaryText || '',
            headline: campaign.headline || '',
            description: campaign.description || '',
            destinationUrl: campaign.destinationUrl || '',
            imageUrl: getCampaignCreativeImageUrl(campaign),
            videoUrl: campaign.videoUrl || '',
            mediaType: campaign.mediaType || (campaign.videoUrl ? 'video' : 'image'),
            callToAction: campaign.callToAction || 'LEARN_MORE',
            optimizationGoal: normalizeOptimizationGoal(objective, campaign.optimizationGoal),
            bidStrategy: campaign.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
            metaCampaignId: campaign.metaCampaignId || '',
            metaAdSetId: campaign.metaAdSetId || '',
            metaAdId: campaign.metaAdId || '',
            lifecycleStatus: campaign.lifecycleStatus || (status === 'active' ? 'running' : status === 'paused' ? 'paused' : 'draft'),
            paymentStatus: campaign.paymentStatus || 'verified',
            reviewStatus: campaign.reviewStatus || 'approved',
            deliveryStatus: campaign.deliveryStatus || (status === 'active' ? 'active' : status === 'paused' ? 'paused' : 'not_published'),
            reviewNotes: campaign.reviewNotes || '',
            source: campaign.source || 'local',
            readOnly: Boolean(campaign.readOnly),
            syncedFromMeta: Boolean(campaign.syncedFromMeta)
        };
    };

    const getSafeRatio = (numerator, denominator) => {
        const top = Number(numerator || 0);
        const bottom = Number(denominator || 0);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) {
            return 0;
        }
        return top / bottom;
    };

    const sanitizePayload = (data) => {
        const normalizedMediaType = String(data?.mediaType || 'image').toLowerCase() === 'video' ? 'video' : 'image';
        const dailyBudget = toNumberOrNull(data?.dailyBudget);
        const lifetimeBudget = toNumberOrNull(data?.lifetimeBudget);
        const hasDailyBudget = dailyBudget !== null && dailyBudget > 0;
        const hasLifetimeBudget = lifetimeBudget !== null && lifetimeBudget > 0;

        const payload = {
            name: String(data?.name || '').trim(),
            platform: String(data?.platform || 'both'),
            objective: normalizeCampaignObjective(data?.objective || 'awareness'),
            status: String(data?.status || 'draft'),
            adAccountId: String(data?.adAccountId || '').trim(),
            mediaType: normalizedMediaType,
            primaryText: String(data?.primaryText || '').trim(),
            headline: String(data?.headline || '').trim(),
            description: String(data?.description || '').trim(),
            destinationUrl: String(data?.destinationUrl || '').trim(),
            callToAction: String(data?.callToAction || 'LEARN_MORE'),
            optimizationGoal: normalizeOptimizationGoal(data?.objective || 'awareness', data?.optimizationGoal),
            bidStrategy: String(data?.bidStrategy || 'LOWEST_COST_WITHOUT_CAP'),
            audience: {
                ...(data?.audience && typeof data.audience === 'object' ? data.audience : {}),
                name: String(data?.name || '').trim(),
                platform: String(data?.platform || 'both'),
            objective: normalizeCampaignObjective(data?.objective || 'awareness'),
                targeting: String(data?.targeting || '').trim(),
                ageMin: toNumberOrNull(data?.ageMin) ?? 18,
                ageMax: toNumberOrNull(data?.ageMax) ?? 65,
                gender: String(data?.gender || 'all'),
                interests: String(data?.interests || '').trim(),
                behaviors: String(data?.behaviors || '').trim()
            },
            deliveryPolicy: {
                ...(data?.deliveryPolicy && typeof data.deliveryPolicy === 'object' ? data.deliveryPolicy : {}),
                status: String(data?.status || 'draft'),
                dailyBudget: hasDailyBudget ? dailyBudget : null,
                lifetimeBudget: !hasDailyBudget && hasLifetimeBudget ? lifetimeBudget : null,
                startDate: data?.startDate ? new Date(data.startDate).toISOString() : null,
                endDate: data?.endDate ? new Date(data.endDate).toISOString() : null
            },
            retryPolicy: {
                ...(data?.retryPolicy && typeof data.retryPolicy === 'object' ? data.retryPolicy : {})
            },
            compliancePolicy: {
                respectOptOut: true,
                ...(data?.compliancePolicy && typeof data.compliancePolicy === 'object' ? data.compliancePolicy : {})
            },
            analytics: {
                ...(data?.analytics && typeof data.analytics === 'object' ? data.analytics : {}),
                spent: toNumberOrNull(data?.spent) ?? 0,
                impressions: toNumberOrNull(data?.impressions) ?? 0,
                clicks: toNumberOrNull(data?.clicks) ?? 0,
                ctr: toNumberOrNull(data?.ctr) ?? 0,
                cpc: toNumberOrNull(data?.cpc) ?? 0,
                revenue: toNumberOrNull(data?.revenue) ?? 0
            },
            ageMin: toNumberOrNull(data?.ageMin) ?? 18,
            ageMax: toNumberOrNull(data?.ageMax) ?? 65,
            gender: String(data?.gender || 'all'),
            targeting: String(data?.targeting || '').trim(),
            interests: String(data?.interests || '').trim(),
            behaviors: String(data?.behaviors || '').trim(),
            dailyBudget: hasDailyBudget ? dailyBudget : undefined,
            lifetimeBudget: !hasDailyBudget && hasLifetimeBudget ? lifetimeBudget : undefined,
            startDate: data?.startDate ? new Date(data.startDate).toISOString() : undefined,
            endDate: data?.endDate ? new Date(data.endDate).toISOString() : undefined,
            imageUrl: normalizedMediaType === 'image' ? String(data?.imageUrl || '').trim() : undefined,
            videoUrl: normalizedMediaType === 'video' ? String(data?.videoUrl || '').trim() : undefined
        };

        if (!payload.imageUrl) delete payload.imageUrl;
        if (!payload.videoUrl) delete payload.videoUrl;
        if (!payload.primaryText) delete payload.primaryText;
        if (!payload.headline) delete payload.headline;
        if (!payload.description) delete payload.description;
        if (!payload.destinationUrl) delete payload.destinationUrl;
        if (!payload.targeting) delete payload.targeting;
        if (!payload.interests) delete payload.interests;
        if (!payload.behaviors) delete payload.behaviors;
        if (!payload.endDate) delete payload.endDate;
        if (!payload.startDate) delete payload.startDate;
        if (!payload.dailyBudget) delete payload.dailyBudget;
        if (!payload.lifetimeBudget) delete payload.lifetimeBudget;

        delete payload.creativeImage;
        delete payload.creativeVideo;
        delete payload.id;
        delete payload._id;
        delete payload.readOnly;
        delete payload.source;
        delete payload.syncedFromMeta;

        return payload;
    };

    const buildCampaignPayload = (data) => {
        const payload = sanitizePayload(data);
        const normalizedMediaType = String(data?.mediaType || payload.mediaType || 'image').toLowerCase();
        const hasImageFile = normalizedMediaType !== 'video' && Boolean(data?.creativeImage);
        const hasVideoFile = normalizedMediaType === 'video' && Boolean(data?.creativeVideo);

        if (!hasImageFile && !hasVideoFile) {
            return payload;
        }

        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof File) && !Array.isArray(value)) {
                    formData.append(key, JSON.stringify(value));
                } else {
                    formData.append(key, value);
                }
            }
        });
        if (hasImageFile) {
            formData.append('creativeImage', data.creativeImage);
        }
        if (hasVideoFile) {
            formData.append('creativeVideo', data.creativeVideo);
        }
        return formData;
    };

    const fetchCampaigns = useCallback(async () => {
        if (USE_MOCK) {
            setCampaigns(mockCampaigns);
            setLoading(false);
            return;
        }

        if (!loadedCampaigns.current) setLoading(true);
        setError('');
        const requestedAt = Date.now();
        try {
            const response = await api.get('/api/campaigns', {
                headers: getAuthHeaders(),
                params: {
                    page: 1,
                    platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
                    status: selectedStatus !== 'all' ? selectedStatus : undefined,
                    search: searchQuery || undefined,
                    dateRange: dateRange || undefined
                }
            });
            const data = response.data?.data || [];
            setCampaigns((previous) => {
                const incoming = data.map(normalizeCampaign);
                const ids = new Set(incoming.map((item) => String(item.id)));
                const previousById = new Map(previous.map((item) => [String(item.id), item]));
                return [
                    ...previous.filter((item) => !ids.has(String(item.id)) &&
                        (String(item.id).startsWith('temp-') || item.lifecycleStatus === 'publishing' ||
                            new Date(item.createdAt).getTime() >= requestedAt)),
                    ...incoming.map((item) => {
                        const existing = previousById.get(String(item.id));
                        return existing && new Date(existing.updatedAt) > new Date(item.updatedAt)
                            ? existing : item;
                    })
                ];
            });
            loadedCampaigns.current = true;
        } catch (err) {
            console.error('Failed to load campaigns', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Unable to load campaigns from server.');
        } finally {
            setLoading(false);
        }
    }, [dateRange, getAuthHeaders, searchQuery, selectedPlatform, selectedStatus]);

    const fetchMetaSetupState = useCallback(async () => {
        setMetaSetupLoading(true);
        try {
            const response = await api.get('/api/meta-ads/overview', {
                headers: getAuthHeaders()
            });
            const walletBalance = Number(response?.data?.wallet?.balance || 0);
            const setup = response?.data?.setup || {};
            setMetaSetup(setup);
            const isReady = Boolean(setup.connected && setup.pageId);
            setMetaSetupReady(isReady);
            setMetaWalletBalance(walletBalance);
            setMetaSetupMessage(
                setup.setupError || 'Connect Meta and select a Facebook page to continue.'
            );
        } catch (loadError) {
            setMetaSetup(null);
            setMetaSetupReady(false);
            setMetaWalletBalance(0);
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
        const intervalId = window.setInterval(() => {
            fetchCampaigns();
        }, 30000);

        const handleVisibilityRefresh = () => {
            if (document.visibilityState === 'visible') {
                fetchCampaigns();
            }
        };

        window.addEventListener('focus', fetchCampaigns);
        document.addEventListener('visibilitychange', handleVisibilityRefresh);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', fetchCampaigns);
            document.removeEventListener('visibilitychange', handleVisibilityRefresh);
        };
    }, [fetchCampaigns]);

    useEffect(() => {
        fetchMetaSetupState();
    }, [fetchMetaSetupState]);

    const publishingIds = campaigns
        .filter((item) => item.lifecycleStatus === 'publishing' && !String(item.id).startsWith('temp-'))
        .map((item) => String(item.id)).sort().join(',');

    useEffect(() => {
        if (!publishingIds) return undefined;
        let cancelled = false;
        let timer;
        const refreshPublishing = async () => {
            const results = await Promise.allSettled(publishingIds.split(',').map(async (id) => {
                const response = await api.get(`/api/campaigns/${id}`, { headers: getAuthHeaders() });
                return normalizeCampaign(response.data.data);
            }));
            if (cancelled) return;
            const updates = new Map(results.filter((result) => result.status === 'fulfilled')
                .map((result) => [String(result.value.id), result.value]));
            setCampaigns((previous) => previous.map((item) => updates.get(String(item.id)) || item));
            timer = window.setTimeout(refreshPublishing, 3000);
        };
        refreshPublishing();
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [publishingIds, getAuthHeaders]);

    useEffect(() => {
        campaigns.forEach((campaign) => {
            const id = String(campaign.id);
            if (campaignPreviews.current.has(id) && (campaign.imageUrl || campaign.videoUrl)) {
                URL.revokeObjectURL(campaignPreviews.current.get(id));
                campaignPreviews.current.delete(id);
            }
        });
    }, [campaigns]);

    useEffect(() => {
        let cancelled = false;

        const loadPaymentFundUrl = async () => {
            try {
                const response = await apiService.getUserCredentials();
                if (cancelled) return;
                setMetaPaymentFundUrl(
                    String(response?.data?.data?.metaPaymentFundUrl || response?.data?.data?.metapaymentfundurl || '').trim()
                );
            } catch {
                if (!cancelled) setMetaPaymentFundUrl('');
            }
        };

        loadPaymentFundUrl();

        return () => {
            cancelled = true;
        };
    }, [getAuthHeaders]);

    const filteredCampaigns = campaigns.filter(campaign => {
        const matchesPlatform = selectedPlatform === 'all' || campaign.platform === selectedPlatform;
        const matchesStatus = selectedStatus === 'all' || campaign.status === selectedStatus;
        const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             campaign.objective.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesPlatform && matchesStatus && matchesSearch;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedPlatform, selectedStatus, searchQuery, dateRange]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE));
        setCurrentPage((prev) => Math.min(prev, maxPage));
    }, [filteredCampaigns.length]);

    const handleCreateCampaign = async (campaignData) => {
        if (USE_MOCK) {
            setCampaigns(prev => [...prev, { ...normalizeCampaign(campaignData), id: Date.now() }]);
            setShowCreateModal(false);
            window.alert('Campaign successfully created.');
            return;
        }

        const optimisticId = `temp-${Date.now()}`;
        const creativeFile = campaignData.mediaType === 'video' ? campaignData.creativeVideo : campaignData.creativeImage;
        if (creativeFile) campaignPreviews.current.set(optimisticId, URL.createObjectURL(creativeFile));
        const optimisticCampaign = normalizeCampaign({
            ...campaignData,
            id: optimisticId,
            _id: optimisticId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: 'local',
            lifecycleStatus: 'publishing',
            deliveryStatus: 'publishing'
        });

        try {
            setSavingCampaign(true);
            setCurrentPage(1);
            setSelectedPlatform('all');
            setSelectedStatus('all');
            setSearchQuery('');
            setCampaigns((prev) => [
                optimisticCampaign,
                ...prev.filter((item) => String(item.id) !== String(optimisticId))
            ]);
            // Show the optimistic row immediately while the video/file request is still uploading.
            setCampaignFlash('Campaign added. Uploading creative and publishing in the background…');
            setShowCreateModal(false);
            const payload = buildCampaignPayload({
                ...campaignData,
                adAccountId: campaignData?.adAccountId || metaSetup?.selectedAdAccountId || metaSetup?.adAccountId || ''
            });
            let response;
            if (payload instanceof FormData) {
                response = await axios.post(`${API_BASE_URL}/api/campaigns`, payload, {
                    headers: getAuthHeaders()
                });
            } else {
                response = await api.post('/api/campaigns', payload, {
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    }
                });
            }
            const createdCampaign = response?.data?.data || null;
            const normalizedCreated = normalizeCampaign(createdCampaign || {
                ...campaignData,
                id: createdCampaign?._id || createdCampaign?.id || `temp-${Date.now()}`,
                _id: createdCampaign?._id || createdCampaign?.id || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                source: 'local'
            });
            if (campaignPreviews.current.has(optimisticId)) {
                campaignPreviews.current.set(String(normalizedCreated.id), campaignPreviews.current.get(optimisticId));
                campaignPreviews.current.delete(optimisticId);
            }
            setCampaigns((prev) => [
                normalizedCreated,
                ...prev.filter(
                    (item) =>
                        String(item.id) !== String(normalizedCreated.id) &&
                        String(item.id) !== String(optimisticId)
                )
            ]);
            setCurrentPage(1);
            setCampaignFlash(response?.data?.message || 'Your ad has been created successfully.');
            setShowCreateModal(false);
            window.clearTimeout(window.__campaignFlashTimer);
            window.__campaignFlashTimer = window.setTimeout(() => {
                setCampaignFlash('');
            }, 4500);
        } catch (err) {
            console.error('Create failed', {
                status: err?.response?.status,
                data: err?.response?.data || null,
                message: err?.message
            });
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
            setCampaigns((prev) => prev.filter((item) => String(item.id) !== String(optimisticId)));
            const preview = campaignPreviews.current.get(optimisticId);
            if (preview) URL.revokeObjectURL(preview);
            campaignPreviews.current.delete(optimisticId);
            setCampaignFlash('');
        } finally {
            setSavingCampaign(false);
        }
    };

    const openEditCampaign = async (campaign) => {
        try {
            setError('');
            const record = !USE_MOCK && !String(campaign.id).startsWith('meta_')
                ? (await api.get(`/api/campaigns/${campaign.id}`, { headers: getAuthHeaders() })).data.data
                : campaign;
            setSelectedCampaign(normalizeCampaign(record));
            setShowEditModal(true);
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load campaign details. Please try again.');
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
            setSavingCampaign(true);
            const publishSafeData = selectedCampaign?.metaCampaignId
                ? {
                    name: campaignData?.name || selectedCampaign?.name || '',
                    status: campaignData?.status || selectedCampaign?.status || 'draft'
                }
                : campaignData;
            const payload = selectedCampaign?.metaCampaignId
                ? publishSafeData
                : buildCampaignPayload(publishSafeData);
            if (payload instanceof FormData) {
                await axios.put(`${API_BASE_URL}/api/campaigns/${selectedCampaign.id}`, payload, {
                    headers: getAuthHeaders()
                });
            } else {
                await api.put(`/api/campaigns/${selectedCampaign.id}`, payload, {
                    headers: {
                        ...getAuthHeaders(),
                        'Content-Type': 'application/json'
                    }
                });
            }
            await fetchCampaigns();
            setShowEditModal(false);
            setSelectedCampaign(null);
        } catch (err) {
            console.error('Update failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Update campaign failed.');
        } finally {
            setSavingCampaign(false);
        }
    };

    const handleDeleteCampaign = async (campaign) => {
        const campaignId = typeof campaign === 'object' ? campaign?.id : campaign;
        if (!campaignId || savingCampaign) return;
        setDeleteError('');

        if (USE_MOCK) {
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
            setCampaignToDelete(null);
            return;
        }

        try {
            setSavingCampaign(true);
            setDeletingCampaignId(String(campaignId));
            const response = await api.delete(`/api/campaigns/${campaignId}`, {
                headers: getAuthHeaders(),
                data: typeof campaign === 'object' ? {
                    metaCampaignId: campaign.metaCampaignId || '',
                    metaAdSetId: campaign.metaAdSetId || '',
                    metaAdId: campaign.metaAdId || ''
                } : undefined
            });
            const deleteDurationMs = response?.headers?.['x-campaign-delete-duration-ms'];
            const deletePhase = response?.headers?.['x-campaign-delete-phase'];
            if (deleteDurationMs || deletePhase) {
                console.info('[campaign-delete-response]', {
                    campaignId,
                    deleteDurationMs,
                    deletePhase,
                    requestId: response?.headers?.['x-campaign-delete-request-id']
                });
            }
            setCampaigns((prev) => prev.filter((item) => String(item.id) !== String(campaignId)));
            setCampaignToDelete(null);
            setCampaignFlash('Campaign deleted successfully.');
        } catch (err) {
            console.error('Delete failed', err?.response?.data || err.message);
            setDeleteError(err?.response?.data?.message || 'Could not delete this campaign. Please try again.');
        } finally {
            setDeletingCampaignId('');
            setSavingCampaign(false);
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
            setSavingCampaign(true);
            await api.put(`/api/campaigns/${campaignId}/pause`, {}, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Pause failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Pause campaign failed.');
        } finally {
            setSavingCampaign(false);
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
            setSavingCampaign(true);
            await api.put(`/api/campaigns/${campaignId}/resume`, {}, { headers: getAuthHeaders() });
            await fetchCampaigns();
        } catch (err) {
            console.error('Resume failed', err?.response?.data || err.message);
            setError(err?.response?.data?.message || 'Resume campaign failed.');
        } finally {
            setSavingCampaign(false);
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

    const getWorkflowActions = (campaign, variant = 'card') => {
        if (campaign.readOnly || campaign.lifecycleStatus === 'publishing') return [];

        const actionClass = variant === 'table' ? 'cm-action-btn' : 'cm-action-btn';
        const actions = [];

        if (campaign.lifecycleStatus === 'draft' || campaign.lifecycleStatus === 'approved' || campaign.lifecycleStatus === 'pending_review') {
            actions.push({
                key: 'publish',
                label: 'Publish',
                className: `${actionClass} cm-action-primary`,
                icon: <Play size={14} />,
                onClick: () => handlePublishCampaign(campaign.id)
            });
        }

        if (campaign.status === 'active') {
            actions.push({
                key: 'pause',
                label: 'Pause',
                className: `${actionClass} cm-action-secondary`,
                icon: <Pause size={14} />,
                onClick: () => handlePauseCampaign(campaign.id)
            });
        } else if (campaign.status === 'paused' && campaign.metaCampaignId) {
            actions.push({
                key: 'resume',
                label: 'Resume',
                className: `${actionClass} cm-action-secondary`,
                icon: <Play size={14} />,
                onClick: () => handleResumeCampaign(campaign.id)
            });
        }

        return actions;
    };

    const getCampaignBudgetBase = (campaign) => {
        const dailyBudget = Number(campaign?.dailyBudget || 0);
        if (dailyBudget > 0) {
            return dailyBudget * 30;
        }
        const lifetimeBudget = Number(campaign?.lifetimeBudget || 0);
        return lifetimeBudget > 0 ? lifetimeBudget : 0;
    };

    const getCampaignBudgetLabel = (campaign) => {
        const dailyBudget = Number(campaign?.dailyBudget || 0);
        if (dailyBudget > 0) {
            return `$${dailyBudget}/day`;
        }
        const lifetimeBudget = Number(campaign?.lifetimeBudget || 0);
        if (lifetimeBudget > 0) {
            return `$${lifetimeBudget} lifetime`;
        }
        return '$0';
    };

    const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const displayCampaigns = filteredCampaigns.slice(startIndex, endIndex);
    const pageWindowStart = Math.max(2, Math.min(safeCurrentPage - 1, totalPages - 3));
    const visiblePages = totalPages <= 5
        ? Array.from({ length: totalPages }, (_, idx) => idx + 1)
        : [1, pageWindowStart, pageWindowStart + 1, pageWindowStart + 2, totalPages];
    const pageNumbers = visiblePages.flatMap((page, index) => (
        index > 0 && page - visiblePages[index - 1] > 1
            ? [`ellipsis-${page}`, page]
            : [page]
    ));
    const showingStart = filteredCampaigns.length === 0 ? 0 : startIndex + 1;
    const showingEnd = filteredCampaigns.length === 0 ? 0 : Math.min(endIndex, filteredCampaigns.length);
    const activeCampaignsCount = campaigns.filter((campaign) => campaign.lifecycleStatus === 'running' || campaign.status === 'active').length;
    const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spent || 0), 0);
    const totalRevenue = campaigns.reduce((sum, campaign) => sum + Number(campaign.revenue || 0), 0);
    const totalImpressions = campaigns.reduce((sum, campaign) => sum + Number(campaign.impressions || 0), 0);
    const getCampaignImageSrc = (campaign) => {
        return getCampaignCreativeImageUrl(campaign);
    };
    const compactMoney = (value) => {
        const amount = Number(value || 0);
        if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
        return `$${amount.toFixed(0)}`;
    };
    const compactCount = (value) => {
        const amount = Number(value || 0);
        if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
        return `${amount.toFixed(0)}`;
    };
    const formatCurrency = (value, digits = 0) => {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '--';
        return `$${amount.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        })}`;
    };
    const formatPercent = (value, digits = 2) => {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '--';
        return `${amount.toFixed(digits)}%`;
    };
    const formatRatio = (value, digits = 1) => {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '--';
        return `${amount.toFixed(digits)}x`;
    };
    const getCampaignStatusMeta = (campaign) => {
        const statusKey = String(campaign?.lifecycleStatus || campaign?.status || 'draft').toLowerCase();
        const map = {
            active: { label: 'ACTIVE', badgeClass: 'cm-status-running', metricsClass: '' },
            running: { label: 'RUNNING', badgeClass: 'cm-status-running', metricsClass: '' },
            paused: { label: 'PAUSED', badgeClass: 'cm-status-paused', metricsClass: 'cm-faded-metrics' },
            draft: { label: 'DRAFT', badgeClass: 'cm-status-draft', metricsClass: 'cm-faded-metrics' },
            ended: { label: 'ENDED', badgeClass: 'cm-status-ended', metricsClass: 'cm-faded-metrics' },
            rejected: { label: 'REJECTED', badgeClass: 'cm-status-ended', metricsClass: 'cm-faded-metrics' },
            publishing: { label: 'PUBLISHING', badgeClass: 'cm-status-review', metricsClass: '' }
        };
        return map[statusKey] || map.draft;
    };
    const totalBudgetBase = campaigns.reduce((sum, campaign) => sum + getCampaignBudgetBase(campaign), 0);
    const spendTargetPercentage = totalBudgetBase > 0 ? Math.round((totalSpend / totalBudgetBase) * 100) : null;
    const avgImpressionsPerCampaign = campaigns.length > 0 ? totalImpressions / campaigns.length : null;
    const activeCampaignsTrendLabel = campaigns.length
        ? `${Math.round((activeCampaignsCount / campaigns.length) * 100)}% active`
        : '+12% vs LY';
    const spendTrendLabel = spendTargetPercentage !== null
        ? `${spendTargetPercentage}% of budget`
        : '88% of target';
    const revenueTrendLabel = totalSpend > 0
        ? `${formatRatio(getSafeRatio(totalRevenue, totalSpend), 2)} ROAS`
        : '+24% MoM';
    const impressionsTrendLabel = avgImpressionsPerCampaign !== null
        ? `${compactCount(avgImpressionsPerCampaign)} avg`
        : 'Stable';
    const selectedDateRangeLabel = dateRangeLabels[dateRange] || 'Last 30 Days';
    const activeFillPercent = campaigns.length ? Math.min(100, Math.round((activeCampaignsCount / campaigns.length) * 100)) : 0;
    const spendFillPercent = spendTargetPercentage !== null ? Math.min(100, Math.max(0, spendTargetPercentage)) : 50;
    const roasValue = getSafeRatio(totalRevenue, totalSpend);
    const revenueFillPercent = totalSpend > 0 ? Math.min(100, Math.max(0, Math.round(roasValue * 20))) : 0;
    const impressionFillPercent = campaigns.length > 0 && avgImpressionsPerCampaign !== null
        ? Math.min(100, Math.max(10, Math.round((avgImpressionsPerCampaign / (totalImpressions || 1)) * 100 * 3)))
        : 66;
    const safePaymentFundUrl = resolveSafeExternalUrl(metaPaymentFundUrl);
    const handleOpenPaymentFund = () => {
        if (safePaymentFundUrl) {
            window.open(safePaymentFundUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        window.alert('Set the Meta Payment Fund URL in Super Admin to enable this button.');
    };

    return (
        <div className="meta-access-shell">
        {campaignToDelete && (
            <CampaignDeleteDialog
                campaign={campaignToDelete}
                busy={Boolean(deletingCampaignId)}
                error={deleteError}
                onCancel={() => setCampaignToDelete(null)}
                onConfirm={() => handleDeleteCampaign(campaignToDelete)}
            />
        )}
        <div className={`campaign-management ${!metaSetupLoading && !metaSetupReady ? 'meta-access-blurred' : ''}`}>
            <main className="cm-strict">
                <section className="cm-strict-container">
                    <div className="cm-toolbar">
                        <div className="cm-search-area">
                            <div className="cm-search-wrap">
                                <span className="cm-search-icon material-symbols-outlined">search</span>
                                <input
                                    className="cm-search-input"
                                    placeholder="Search campaign name or ID..."
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="cm-wallet-pill" title="Connected Meta ad balance">
                                <span className="material-symbols-outlined cm-wallet-pill__icon">account_balance_wallet</span>
                                <div className="cm-wallet-pill__copy">
                                    <span>Meta balance</span>
                                    <strong>{formatCurrency(metaWalletBalance)}</strong>
                                </div>
                            </div>
                        </div>
                        <div className="cm-toolbar-actions">
                            <label className="cm-filter-chip">
                                <span className="material-symbols-outlined cm-chip-icon">filter_list</span>
                                <span className="cm-chip-label">Platforms</span>
                                <span className="material-symbols-outlined cm-chip-icon">expand_more</span>
                                <select
                                    className="template-select-overlay"
                                    value={selectedPlatform}
                                    onChange={(e) => setSelectedPlatform(e.target.value)}
                                >
                                    <option value="all">All</option>
                                    <option value="facebook">Facebook</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="both">Both</option>
                                </select>
                            </label>

                            <label className="cm-filter-chip">
                                <span className="material-symbols-outlined cm-chip-icon">radio_button_checked</span>
                                <span className="cm-chip-label">Status</span>
                                <span className="material-symbols-outlined cm-chip-icon">expand_more</span>
                                <select
                                    className="template-select-overlay"
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                >
                                    <option value="all">All</option>
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="draft">Draft</option>
                                    <option value="ended">Ended</option>
                                </select>
                            </label>

                            <label className="cm-filter-chip">
                                <span className="material-symbols-outlined cm-chip-icon">calendar_today</span>
                                <span className="cm-chip-label">{selectedDateRangeLabel}</span>
                                <span className="material-symbols-outlined cm-chip-icon">expand_more</span>
                                <select
                                    className="template-select-overlay"
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value)}
                                >
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="last7days">Last 7 Days</option>
                                    <option value="last30days">Last 30 Days</option>
                                    <option value="thisMonth">This Month</option>
                                    <option value="lastMonth">Last Month</option>
                                </select>
                            </label>

                            <button className="cm-refresh-btn" type="button" onClick={fetchCampaigns}>
                                <span className="material-symbols-outlined">refresh</span>
                            </button>
                            <button
                                className={`cm-create-btn cm-fund-btn ${safePaymentFundUrl ? 'cm-fund-btn--ready' : 'cm-fund-btn--missing'}`}
                                type="button"
                                onClick={handleOpenPaymentFund}
                                title={safePaymentFundUrl ? 'Open Facebook payment fund link' : 'Set the payment URL in Super Admin first'}
                            >
                                <ExternalLink size={16} />
                                Add Funds
                            </button>
                            <button
                                className="cm-create-btn"
                                type="button"
                                disabled={savingCampaign}
                                onClick={() => setShowCreateModal(true)}
                            >
                                Create Campaign
                            </button>
                        </div>
                    </div>

                    {campaignFlash ? (
                        <div className="cm-flash cm-flash-success" role="status" aria-live="polite">
                            <span className="material-symbols-outlined">check_circle</span>
                            <span>{campaignFlash}</span>
                        </div>
                    ) : null}

                    <div className="cm-kpi-grid">
                        <div className="cm-kpi-card">
                            <div className="cm-kpi-top">
                                <div className="cm-kpi-icon cm-kpi-icon-primary">
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                </div>
                                <span className="cm-kpi-trend cm-kpi-trend-primary">{activeCampaignsTrendLabel}</span>
                            </div>
                            <p className="cm-kpi-label">Active Campaigns</p>
                            <h3 className="cm-kpi-value headline-font">{activeCampaignsCount}</h3>
                            <div className="cm-kpi-track">
                                <div className="cm-kpi-fill cm-kpi-fill-primary" style={{ width: `${activeFillPercent}%` }} />
                            </div>
                        </div>

                        <div className="cm-kpi-card">
                            <div className="cm-kpi-top">
                                <div className="cm-kpi-icon cm-kpi-icon-secondary">
                                    <span className="material-symbols-outlined">payments</span>
                                </div>
                                <span className="cm-kpi-trend cm-kpi-trend-muted">{spendTrendLabel}</span>
                            </div>
                            <p className="cm-kpi-label">Total Spend</p>
                            <h3 className="cm-kpi-value headline-font">{compactMoney(totalSpend)}</h3>
                            <div className="cm-kpi-track">
                                <div className="cm-kpi-fill cm-kpi-fill-secondary" style={{ width: `${spendFillPercent}%` }} />
                            </div>
                        </div>

                        <div className="cm-kpi-card">
                            <div className="cm-kpi-top">
                                <div className="cm-kpi-icon cm-kpi-icon-tertiary">
                                    <span className="material-symbols-outlined">account_balance_wallet</span>
                                </div>
                                <span className="cm-kpi-trend cm-kpi-trend-tertiary">{revenueTrendLabel}</span>
                            </div>
                            <p className="cm-kpi-label">Total Revenue</p>
                            <h3 className="cm-kpi-value headline-font">{compactMoney(totalRevenue)}</h3>
                            <div className="cm-kpi-track">
                                <div className="cm-kpi-fill cm-kpi-fill-tertiary" style={{ width: `${revenueFillPercent}%` }} />
                            </div>
                        </div>

                        <div className="cm-kpi-card">
                            <div className="cm-kpi-top">
                                <div className="cm-kpi-icon cm-kpi-icon-blue">
                                    <span className="material-symbols-outlined">visibility</span>
                                </div>
                                <span className="cm-kpi-trend cm-kpi-trend-blue">{impressionsTrendLabel}</span>
                            </div>
                            <p className="cm-kpi-label">Total Impressions</p>
                            <h3 className="cm-kpi-value headline-font">{compactCount(totalImpressions)}</h3>
                            <div className="cm-kpi-track">
                                <div className="cm-kpi-fill cm-kpi-fill-blue" style={{ width: `${impressionFillPercent}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="cm-campaigns-head">
                        <h3 className="headline-font">Recent Campaigns</h3>
                        <div className="cm-view-toggle">
                            <button
                                className={`cm-view-btn ${viewMode === 'grid' ? 'cm-view-btn-active' : ''}`}
                                type="button"
                                onClick={() => setViewMode('grid')}
                                aria-pressed={viewMode === 'grid'}
                            >
                                <span className="material-symbols-outlined cm-filled">grid_view</span>
                            </button>
                            <button
                                className={`cm-view-btn ${viewMode === 'list' ? 'cm-view-btn-active' : ''}`}
                                type="button"
                                onClick={() => setViewMode('list')}
                                aria-pressed={viewMode === 'list'}
                            >
                                <span className="material-symbols-outlined">list</span>
                            </button>
                        </div>
                    </div>

                    {displayCampaigns.length === 0 ? (
                        <div className="cm-state-card">
                            {loading ? (
                                <>
                                    <RefreshCw size={32} className="spinner" />
                                    <h3>Loading campaigns...</h3>
                                    <p>Please wait while we fetch your campaigns.</p>
                                </>
                            ) : error ? (
                                <>
                                    <AlertCircle size={44} />
                                    <h3>Unable to load campaigns</h3>
                                    <p>{error}</p>
                                    <button className="cm-create-btn" onClick={fetchCampaigns} type="button">
                                        Retry
                                    </button>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={44} />
                                    <h3>No campaigns found</h3>
                                    <p>Try adjusting your filters or create a new campaign.</p>
                                    <button className="cm-create-btn" onClick={() => setShowCreateModal(true)} type="button" disabled={savingCampaign}>
                                        Create Campaign
                                    </button>
                                </>
                            )}
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="cm-list-stack">
                            {displayCampaigns.map((campaign) => {
                                const workflowActions = getWorkflowActions(campaign, 'table');
                                const roas = getSafeRatio(campaign.revenue, campaign.spent);
                                const statusMeta = getCampaignStatusMeta(campaign);
                                return (
                                    <article key={campaign.id} className="cm-list-card">
                                        <div className="cm-list-main">
                                            <div className="cm-list-title-wrap">
                                                <h4 className="cm-list-title headline-font">{campaign.name}</h4>
                                                <div className="cm-list-meta">
                                                    <span className="material-symbols-outlined">calendar_today</span>
                                                    <span>{campaign.startDate || 'Not set'} - {campaign.endDate || 'Ongoing'}</span>
                                                </div>
                                            </div>
                                            <span className={`cm-status-badge cm-list-status ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                                        </div>
                                        <div className="cm-list-details">
                                            <div className="cm-list-platforms">
                                                {(campaign.platform === 'facebook' || campaign.platform === 'both') ? (
                                                    <span className="cm-platform-chip">
                                                        <Facebook size={16} className="cm-platform-icon cm-platform-icon-facebook" />
                                                    </span>
                                                ) : null}
                                                {(campaign.platform === 'instagram' || campaign.platform === 'both') ? (
                                                    <span className="cm-platform-chip">
                                                        <Instagram size={16} className="cm-platform-icon cm-platform-icon-instagram" />
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className={`cm-list-metrics ${statusMeta.metricsClass}`}>
                                                <div className="cm-metric"><span>Budget</span><strong>{getCampaignBudgetLabel(campaign)}</strong></div>
                                                <div className="cm-metric"><span>Spend</span><strong>{formatCurrency(campaign.spent || 0)}</strong></div>
                                <div className="cm-metric"><span>ROAS</span><strong className={roas > 0 ? 'cm-metric-primary' : ''}>{formatRatio(roas, 1)}</strong></div>
                                <div className="cm-metric"><span>CTR</span><strong>{formatPercent(campaign.ctr || 0)}</strong></div>
                                <div className="cm-metric"><span>CPC</span><strong>{formatCurrency(campaign.cpc || 0, 2)}</strong></div>
                                <div className="cm-metric"><span>Conversions</span><strong>{Number(campaign.conversions ?? campaign.clicks ?? 0).toLocaleString()}</strong></div>
                                            </div>
                                        </div>
                                        <div className="cm-list-actions">
                                            {workflowActions.map((action) => (
                                                <button
                                                    key={action.key}
                                                    type="button"
                                                    className={action.className}
                                                    onClick={action.onClick}
                                                    title={action.label}
                                                >
                                                    {action.icon}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                className="cm-action-btn cm-action-secondary"
                                                onClick={() => openEditCampaign(campaign)}
                                                title="Edit"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="cm-action-btn cm-action-secondary"
                                                onClick={() => handleDuplicateCampaign(campaign)}
                                                title="Duplicate"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="cm-action-btn cm-action-danger"
                                                disabled={savingCampaign}
                                                onClick={() => { setDeleteError(''); setCampaignToDelete(campaign); }}
                                                title="Delete"
                                                aria-label={`Delete ${campaign.name || 'campaign'}`}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="cm-cards-grid">
                            {displayCampaigns.map((campaign) => {
                                const roas = getSafeRatio(campaign.revenue, campaign.spent);
                                const statusMeta = getCampaignStatusMeta(campaign);
                                const localPreview = campaignPreviews.current.get(String(campaign.id)) || '';
                                const imageSrc = getCampaignImageSrc(campaign) || (campaign.mediaType !== 'video' ? localPreview : '');
                                const videoSrc = campaign.videoUrl || (campaign.mediaType === 'video' ? localPreview : '');
                                const shouldShowImage = Boolean(imageSrc);
                                return (
                                    <div key={campaign.id} className="cm-campaign-card">
                                        <div className="cm-card-media">
                                            {videoSrc ? (
                                                <video
                                                    key={videoSrc}
                                                    className="cm-card-media-img"
                                                    src={videoSrc}
                                                    poster={imageSrc || undefined}
                                                    controls
                                                    muted
                                                    playsInline
                                                    preload="metadata"
                                                />
                                            ) : shouldShowImage ? (
                                                <img
                                                    key={imageSrc}
                                                    className="cm-card-media-img"
                                                    src={imageSrc}
                                                    alt={campaign.name}
                                                    onError={(event) => {
                                                        event.currentTarget.removeAttribute("src");
                                                    }}
                                                />
                                            ) : (
                                                <div className="cm-card-media-fallback">
                                                    <span className="material-symbols-outlined">image</span>
                                                </div>
                                            )}
                                            <div className="cm-card-media-overlay" />
                                            <div className="cm-card-platforms">
                                                {(campaign.platform === 'facebook' || campaign.platform === 'both') ? (
                                                    <div className="cm-platform-chip">
                                                        <Facebook size={16} className="cm-platform-icon cm-platform-icon-facebook" />
                                                    </div>
                                                ) : null}
                                                {(campaign.platform === 'instagram' || campaign.platform === 'both') ? (
                                                    <div className="cm-platform-chip">
                                                        <Instagram size={16} className="cm-platform-icon cm-platform-icon-instagram" />
                                                    </div>
                                                ) : null}
                                            </div>
                                            <div className={`cm-status-badge ${statusMeta.badgeClass}`}>{statusMeta.label}</div>
                                        </div>
                                        <div className="cm-card-body">
                                            <div className="cm-card-head">
                                                <div>
                                                    <h4 className="cm-card-title headline-font">{campaign.name}</h4>
                                                    <div className="cm-card-date">
                                                        <span className="material-symbols-outlined">calendar_today</span>
                                                        <span>{campaign.startDate || 'Not set'} - {campaign.endDate || 'Ongoing'}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    className="cm-card-menu"
                                                    type="button"
                                                    onClick={() => openEditCampaign(campaign)}
                                                    title="Edit campaign"
                                                >
                                                    <span className="material-symbols-outlined">more_vert</span>
                                                </button>
                                            </div>
                                            <div className="cm-budget-box">
                                                <div>
                                                    <p className="cm-budget-label">Daily Budget</p>
                                                    <p className="cm-budget-value">{getCampaignBudgetLabel(campaign)}</p>
                                                </div>
                                                <div>
                                                    <p className="cm-budget-label">Target ROI</p>
                                                    <p className="cm-budget-value">{formatPercent(campaign.roi || 0)}</p>
                                                </div>
                                            </div>
                                            <div className={`cm-metrics-grid ${statusMeta.metricsClass}`}>
                                                <div className="cm-metric"><span>ROAS</span><strong className={roas > 0 ? 'cm-metric-primary' : ''}>{formatRatio(roas, 1)}</strong></div>
                                                <div className="cm-metric"><span>CTR</span><strong>{formatPercent(campaign.ctr || 0)}</strong></div>
                                                <div className="cm-metric"><span>CPC</span><strong>{formatCurrency(campaign.cpc || 0, 2)}</strong></div>
                                                <div className="cm-metric"><span>Conversions</span><strong>{Number(campaign.conversions ?? campaign.clicks ?? 0).toLocaleString()}</strong></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {filteredCampaigns.length > 0 ? (
                        <div className="cm-pagination">
                            <div className="cm-pagination-text">
                                Showing <span className="cm-pagination-strong">{showingStart}-{showingEnd}</span> of <span className="cm-pagination-strong">{filteredCampaigns.length}</span> campaigns
                            </div>
                            <nav className="cm-pagination-controls" aria-label="Campaign pagination">
                                <button
                                    className="cm-page-btn"
                                    type="button"
                                    aria-label="Previous page"
                                    onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
                                    disabled={safeCurrentPage === 1}
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                {pageNumbers.map((pageNo) => typeof pageNo === 'string' ? (
                                    <span key={pageNo} className="cm-page-ellipsis" aria-hidden="true">…</span>
                                ) : (
                                    <button
                                        key={pageNo}
                                        className={`cm-page-btn ${safeCurrentPage === pageNo ? 'cm-page-btn-active' : ''}`}
                                        type="button"
                                        aria-label={`Page ${pageNo}`}
                                        aria-current={safeCurrentPage === pageNo ? 'page' : undefined}
                                        onClick={() => setCurrentPage(pageNo)}
                                    >
                                        {pageNo}
                                    </button>
                                ))}
                                <button
                                    className="cm-page-btn"
                                    type="button"
                                    aria-label="Next page"
                                    onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </nav>
                        </div>
                    ) : null}
                </section>
            </main>

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <CampaignModal
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateCampaign}
                    submitting={savingCampaign}
                    mode="create"
                    adAccounts={metaSetup?.adAccounts || []}
                    selectedAdAccountId={metaSetup?.selectedAdAccountId || metaSetup?.adAccountId || ''}
                />
            )}

            {/* Edit Campaign Modal */}
            {showEditModal && selectedCampaign && (
                <CampaignModal
                    key={selectedCampaign.id}
                    campaign={selectedCampaign}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedCampaign(null);
                    }}
                    onSave={handleEditCampaign}
                    submitting={savingCampaign}
                    mode="edit"
                    adAccounts={metaSetup?.adAccounts || []}
                    selectedAdAccountId={metaSetup?.selectedAdAccountId || metaSetup?.adAccountId || ''}
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
const CampaignModal = ({
    campaign,
    onClose,
    onSave,
    mode,
    submitting = false,
    adAccounts = [],
    selectedAdAccountId = ''
}) => {
    const [formData, setFormData] = useState({
        name: campaign?.name || (mode === 'create' ? 'Untitled Campaign' : ''),
        platform: campaign?.platform || 'both',
        objective: campaign?.objective || 'awareness',
        adAccountId: campaign?.adAccountId || selectedAdAccountId || '',
        budgetType: campaign?.lifetimeBudget ? 'lifetime' : 'daily',
        dailyBudget: campaign?.dailyBudget ?? (mode === 'create' ? 50 : ''),
        lifetimeBudget: campaign?.lifetimeBudget || '',
        startDate: campaign?.startDate || getTodayDateValue(),
        endDate: campaign?.endDate || '',
        targeting: campaign?.targeting || '',
        status: campaign?.status || (mode === 'create' ? 'active' : 'draft'),
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
        videoUrl: campaign?.videoUrl || '',
        mediaType: campaign?.mediaType || (campaign?.videoUrl ? 'video' : 'image'),
        creativeImage: null,
        creativeVideo: null,
        callToAction: campaign?.callToAction || 'LEARN_MORE',
        optimizationGoal: normalizeOptimizationGoal(campaign?.objective || 'awareness', campaign?.optimizationGoal),
        bidStrategy: campaign?.bidStrategy || 'LOWEST_COST_WITHOUT_CAP'
    });

    const [activeTab, setActiveTab] = useState('basic');
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
    const [mediaPreviewFailed, setMediaPreviewFailed] = useState(false);
    const previewFile = formData.mediaType === 'video' ? formData.creativeVideo : formData.creativeImage;
    const previewRemoteUrl = formData.mediaType === 'video' ? formData.videoUrl : formData.imageUrl;

    useEffect(() => {
        setMediaPreviewFailed(false);
        if (!previewFile) {
            setMediaPreviewUrl(previewRemoteUrl || '');
            return undefined;
        }
        const objectUrl = URL.createObjectURL(previewFile);
        setMediaPreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [previewFile, previewRemoteUrl]);

    const tabSteps = [
        { key: 'basic', label: 'Basic Info', step: 1 },
        { key: 'budget', label: 'Budget & Schedule', step: 2 },
        { key: 'targeting', label: 'Targeting', step: 3 },
        { key: 'advanced', label: 'Advanced', step: 4 },
        { key: 'preview', label: 'Preview & Review', step: 5 }
    ];
    const activeTabIndex = tabSteps.findIndex((tab) => tab.key === activeTab);
    const isFirstTab = activeTabIndex <= 0;
    const isLastTab = activeTabIndex === tabSteps.length - 1;

    const handleConfirmCreate = useCallback(() => {
        onSave({
            ...formData,
            name: String(formData.name || '').trim() || (mode === 'create' ? 'Untitled Campaign' : ''),
            startDate: formData.startDate || getTodayDateValue(),
            platform: formData.platform || 'both',
            objective: formData.objective || 'awareness',
            status: formData.status || 'draft'
        });
    }, [formData, mode, onSave]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!isLastTab) {
            const nextTab = tabSteps[activeTabIndex + 1];
            if (nextTab) {
                setActiveTab(nextTab.key);
            }
            return;
        }

        if (mode === 'create') {
            handleConfirmCreate();
            return;
        }

        onSave({
            ...formData,
            name: String(formData.name || '').trim() || (mode === 'create' ? 'Untitled Campaign' : ''),
            startDate: formData.startDate || getTodayDateValue(),
            platform: formData.platform || 'both',
            objective: formData.objective || 'awareness',
            status: formData.status || 'draft'
        });
    };

    const handlePreviousTab = () => {
        const previousTab = tabSteps[activeTabIndex - 1];
        if (previousTab) {
            setActiveTab(previousTab.key);
        }
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

                <div className={`modal-tabs step-tabs ${mode === 'create' ? 'step-tabs-create' : ''}`}>
                    {tabSteps.map((tab, index) => (
                        <React.Fragment key={tab.key}>
                            <button 
                                type="button"
                                className={`tab-btn step-tab ${activeTab === tab.key ? 'active' : ''}`}
                                disabled={submitting || (mode === 'create' && index > activeTabIndex)}
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
                                        <label>Meta Ad Account</label>
                                        <select
                                            value={formData.adAccountId}
                                            onChange={(e) => setFormData({...formData, adAccountId: e.target.value})}
                                            required
                                        >
                                            <option value="">Select ad account</option>
                                            {adAccounts.map((account) => (
                                                <option key={account.id} value={account.id}>
                                                    {account.name || account.id}
                                                    {account.currency ? ` (${account.currency})` : ''}
                                                    {Number.isFinite(Number(account.amountSpent))
                                                        ? ` - spent ${Number(account.amountSpent).toLocaleString('en-US')}`
                                                        : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Campaign Objective</label>
                                        <select
                                            value={formData.objective}
                                            onChange={(e) => {
                                                const objective = e.target.value;
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    objective,
                                                    optimizationGoal: getDefaultOptimizationGoal(objective)
                                                }));
                                            }}
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
                                                checked={formData.budgetType === 'daily'}
                                                onChange={() => setFormData((prev) => ({
                                                    ...prev,
                                                    budgetType: 'daily',
                                                    dailyBudget: prev.dailyBudget === '' || prev.dailyBudget === null || prev.dailyBudget === undefined ? 50 : prev.dailyBudget,
                                                    lifetimeBudget: ''
                                                }))}
                                            />
                                            <span>Daily Budget</span>
                                        </label>
                                        <label className="budget-option">
                                            <input
                                                type="radio"
                                                name="budgetType"
                                                value="lifetime"
                                                checked={formData.budgetType === 'lifetime'}
                                                onChange={() => setFormData((prev) => ({
                                                    ...prev,
                                                    budgetType: 'lifetime',
                                                    lifetimeBudget: prev.lifetimeBudget === '' || prev.lifetimeBudget === null || prev.lifetimeBudget === undefined ? 1000 : prev.lifetimeBudget,
                                                    dailyBudget: ''
                                                }))}
                                            />
                                            <span>Lifetime Budget</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.budgetType === 'daily' && (
                                    <div className="form-group">
                                        <label>Daily Budget ($)</label>
                                        <input
                                            type="number"
                                            value={toBudgetInputValue(formData.dailyBudget)}
                                            onChange={(e) => setFormData((prev) => ({
                                                ...prev,
                                                dailyBudget: e.target.value === '' ? '' : (Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : '')
                                            }))}
                                            min="1"
                                            required
                                        />
                                    </div>
                                )}

                                {formData.budgetType === 'lifetime' && (
                                    <div className="form-group">
                                        <label>Lifetime Budget ($)</label>
                                        <input
                                            type="number"
                                            value={toBudgetInputValue(formData.lifetimeBudget)}
                                            onChange={(e) => setFormData((prev) => ({
                                                ...prev,
                                                lifetimeBudget: e.target.value === '' ? '' : (Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : '')
                                            }))}
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
                                        <label>{formData.lifetimeBudget ? 'End Date (Required for Lifetime Budget)' : 'End Date (Optional)'}</label>
                                        <input
                                            type="date"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                                            required={Boolean(formData.lifetimeBudget)}
                                        />
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
                                        placeholder="e.g., United States, Canada or US, CA"
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
                                    <label>Media Type</label>
                                    <select
                                        value={formData.mediaType}
                                        onChange={(e) => {
                                            const nextType = e.target.value === 'video' ? 'video' : 'image';
                                            setFormData((prev) => ({
                                                ...prev,
                                                mediaType: nextType,
                                                creativeImage: nextType === 'image' ? prev.creativeImage : null,
                                                creativeVideo: nextType === 'video' ? prev.creativeVideo : null
                                            }));
                                        }}
                                    >
                                        <option value="image">Image</option>
                                        <option value="video">Video</option>
                                    </select>
                                </div>

                                {formData.mediaType === 'video' ? (
                                    <>
                                        <div className="form-group">
                                            <label>Video URL</label>
                                            <input
                                                type="url"
                                                value={formData.videoUrl}
                                                onChange={(e) => setFormData({...formData, videoUrl: e.target.value})}
                                                placeholder="https://example.com/ad-video.mp4"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Upload Video</label>
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={(e) => setFormData({...formData, creativeVideo: e.target.files?.[0] || null})}
                                            />
                                            {formData.creativeVideo ? <small>{formData.creativeVideo.name}</small> : null}
                                        </div>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}

                            </div>
                        )}
                        {activeTab === 'preview' && (
                            <section className="campaign-preview-panel" aria-label="Campaign preview and review">
                                <div className="campaign-preview-panel__header">
                                    <div>
                                        <h3>Preview & Review</h3>
                                        <p>Review your ad before {mode === 'create' ? 'creating' : 'saving'} the campaign. Actual appearance may vary by placement.</p>
                                    </div>
                                </div>
                                <div className="cm-creation-review">
                                    <article className="cm-draft-ad" aria-label="Ad preview">
                                        <div className="cm-draft-ad__header">
                                            {formData.platform === 'instagram' ? <Instagram size={24} /> : <Facebook size={24} />}
                                            <div><strong>{formData.platform === 'both' ? 'Facebook + Instagram' : formData.platform === 'instagram' ? 'Instagram' : 'Facebook'}</strong><small>Sponsored · Ad preview</small></div>
                                        </div>
                                        <p className="cm-draft-ad__text">{formData.primaryText || 'No primary text added'}</p>
                                        <div className="cm-draft-ad__media">
                                            {mediaPreviewUrl && !mediaPreviewFailed ? (
                                                formData.mediaType === 'video'
                                                    ? <video key={mediaPreviewUrl} src={mediaPreviewUrl} controls preload="metadata" onError={() => setMediaPreviewFailed(true)} />
                                                    : <img src={mediaPreviewUrl} alt="Campaign creative" onError={() => setMediaPreviewFailed(true)} />
                                            ) : <p>{mediaPreviewFailed ? 'Media could not be loaded. Go Back to check the file or URL.' : 'No image or video added. Go Back to add your creative.'}</p>}
                                        </div>
                                        <div className="cm-draft-ad__destination">
                                            <div>
                                                <small>{formData.destinationUrl || 'No destination URL'}</small>
                                                <strong>{formData.headline || 'No headline added'}</strong>
                                                {formData.description ? <p>{formData.description}</p> : null}
                                            </div>
                                            <span className="cm-draft-ad__cta">{{ LEARN_MORE: 'Learn More', SHOP_NOW: 'Shop Now', SIGN_UP: 'Sign Up', CONTACT_US: 'Contact Us', APPLY_NOW: 'Apply Now' }[formData.callToAction] || formData.callToAction}</span>
                                        </div>
                                    </article>
                                    <div className="cm-creation-summary">
                                        <h3>Campaign details</h3>
                                        <dl>
                                            {[
                                                ['Name', formData.name],
                                                ['Ad account', adAccounts.find((account) => account.id === formData.adAccountId)?.name || formData.adAccountId],
                                                ['Objective', formData.objective],
                                                ['Initial status', formData.status],
                                                [formData.budgetType === 'lifetime' ? 'Lifetime budget ($)' : 'Daily budget ($)', formData.budgetType === 'lifetime' ? formData.lifetimeBudget : formData.dailyBudget],
                                                ['Schedule', `${formData.startDate} – ${formData.endDate || 'Ongoing'}`],
                                                ['Location', formData.targeting || 'Default targeting'],
                                                ['Age range', `${formData.ageMin}–${formData.ageMax}`],
                                                ['Gender', formData.gender],
                                                ['Interests', formData.interests || 'None specified'],
                                                ['Behaviors', formData.behaviors || 'None specified'],
                                                ['Optimization', getOptimizationGoalOptions(formData.objective).find((option) => option.value === formData.optimizationGoal)?.label || formData.optimizationGoal],
                                                ['Bid strategy', formData.bidStrategy.replaceAll('_', ' ')]
                                            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not set'}</dd></div>)}
                                        </dl>
                                        <p>{mode === 'create' ? 'Click Confirm & Create to create this campaign with the settings above.' : 'Click Save Changes to update this campaign.'}</p>
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                <div className="campaign-create-footer">
                    <button type="button" className="btn btn-secondary campaign-create-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    {!isFirstTab ? (
                        <button type="button" className="btn btn-secondary campaign-create-cancel" onClick={handlePreviousTab} disabled={submitting}>
                            Back
                        </button>
                    ) : null}
                    {isLastTab ? (
                        <button key="confirm" type="submit" className="btn btn-primary campaign-create-submit" disabled={submitting}>
                            <Save size={16} />
                            {submitting
                                ? (mode === 'create' ? 'Creating...' : 'Saving...')
                                : (mode === 'create' ? 'Confirm & Create' : 'Save Changes')}
                        </button>
                    ) : (
                        <button key="next" type="submit" className="btn btn-primary campaign-create-submit" disabled={submitting}>
                            {mode === 'create' && activeTab === 'advanced' ? 'Next: Preview' : 'Next'}
                        </button>
                        )}
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
