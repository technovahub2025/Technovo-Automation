import axios from 'axios';
import { resolveApiBaseUrl } from './apiBaseUrl';

const API_BASE_URL = resolveApiBaseUrl();
const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
const USE_MOCK =
  String(import.meta.env.VITE_INSIGHTS_USE_MOCK || 'false').toLowerCase() === 'true';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000
});

const ensureInsightsShape = (payload = {}) => {
  const summary = payload?.summary && typeof payload.summary === 'object' ? payload.summary : {};
  const timeseries = Array.isArray(payload?.timeseries) ? payload.timeseries : [];
  const demographics = Array.isArray(payload?.demographics) ? payload.demographics : [];
  const meta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {};

  return {
    summary: {
      reach: Number(summary?.reach || 0),
      impressions: Number(summary?.impressions || 0),
      spend: Number(summary?.spend || 0),
      ctr: Number(summary?.ctr || 0)
    },
    timeseries: timeseries.map((row) => ({
      date: String(row?.date || row?.date_start || '').trim(),
      reach: Number(row?.reach || 0),
      spend: Number(row?.spend || 0)
    })),
    demographics: demographics.map((row) => ({
      age: String(row?.age || '').trim(),
      male: Number(row?.male || 0),
      female: Number(row?.female || 0)
    })),
    meta
  };
};

const normalizeInsightsResponse = (raw = {}) => {
  if (raw && typeof raw === 'object') {
    if (raw.summary || raw.timeseries || raw.demographics) {
      return ensureInsightsShape(raw);
    }
    if (raw.data && (raw.data.summary || raw.data.timeseries || raw.data.demographics)) {
      return ensureInsightsShape(raw.data);
    }
    if (raw.insights && (raw.insights.summary || raw.insights.timeseries || raw.insights.demographics)) {
      return ensureInsightsShape(raw.insights);
    }
  }
  return ensureInsightsShape();
};

const normalizeInsightFiltersResponse = (raw = {}) => {
  if (Array.isArray(raw?.campaigns)) return raw;
  if (Array.isArray(raw?.data?.campaigns)) return raw.data;
  if (Array.isArray(raw?.filters?.campaigns)) return raw.filters;
  return { campaigns: campaignCatalog };
};

const getAuthHeaders = () => {
  const token =
    localStorage.getItem(tokenKey) ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token');

  return token ? { Authorization: `Bearer ${token}` } : {};
};

const campaignCatalog = [
  {
    id: 'all',
    name: 'All Campaigns',
    adSets: [{ id: 'all', name: 'All Ad Sets' }]
  },
  {
    id: 'awareness_launch',
    name: 'Brand Awareness Launch',
    adSets: [
      { id: 'all', name: 'All Ad Sets' },
      { id: 'awareness_feed', name: 'Awareness Feed Push' },
      { id: 'awareness_story', name: 'Awareness Story Push' }
    ]
  },
  {
    id: 'lead_funnel',
    name: 'Lead Funnel Sprint',
    adSets: [
      { id: 'all', name: 'All Ad Sets' },
      { id: 'lead_citywide', name: 'Citywide Lead Capture' },
      { id: 'lead_retargeting', name: 'Retargeting Warm Leads' }
    ]
  },
  {
    id: 'remarketing_boost',
    name: 'Remarketing Boost',
    adSets: [
      { id: 'all', name: 'All Ad Sets' },
      { id: 'remarketing_site', name: 'Website Visitors' },
      { id: 'remarketing_video', name: 'Video Viewers' }
    ]
  }
];

const demographicBase = [
  { age: '13-17', male: 4200, female: 3800 },
  { age: '18-24', male: 18100, female: 14900 },
  { age: '25-34', male: 27400, female: 23200 },
  { age: '35-44', male: 16200, female: 14100 },
  { age: '45-54', male: 9300, female: 8500 },
  { age: '55-64', male: 5100, female: 4600 },
  { age: '65+', male: 2800, female: 2400 }
];

const rangeLengths = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

const multipliers = {
  all: 1,
  awareness_launch: 1.08,
  lead_funnel: 0.94,
  remarketing_boost: 0.82,
  awareness_feed: 0.63,
  awareness_story: 0.45,
  lead_citywide: 0.58,
  lead_retargeting: 0.36,
  remarketing_site: 0.49,
  remarketing_video: 0.33
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getMultiplier = (campaignId, adSetId) => {
  const adSetMultiplier = multipliers[adSetId] || 1;
  const campaignMultiplier = multipliers[campaignId] || 1;
  if (adSetId && adSetId !== 'all') {
    return adSetMultiplier;
  }
  return campaignMultiplier;
};

const buildTimeseries = ({ range = '30d', campaignId = 'all', adSetId = 'all' }) => {
  const totalDays = rangeLengths[range] || 30;
  const multiplier = getMultiplier(campaignId, adSetId);
  const today = new Date('2026-03-19T00:00:00');

  return Array.from({ length: totalDays }, (_, index) => {
    const pointDate = new Date(today);
    pointDate.setDate(today.getDate() - (totalDays - index - 1));

    const wave = Math.sin(index / 3.2) * 0.12 + Math.cos(index / 4.4) * 0.08;
    const trend = index / Math.max(totalDays, 1);
    const baseReach = 3800 + index * 145 + trend * 2200;
    const reach = Math.round((baseReach + baseReach * wave) * multiplier);
    const spend = Number((reach * 0.0044 + (index % 4) * 1.85).toFixed(2));

    return {
      date: pointDate.toISOString().slice(0, 10),
      reach,
      spend
    };
  });
};

const buildSummary = (timeseries) => {
  const reach = timeseries.reduce((sum, item) => sum + Number(item.reach || 0), 0);
  const spend = timeseries.reduce((sum, item) => sum + Number(item.spend || 0), 0);
  const impressions = Math.round(reach * 1.37);
  const ctr = Number(((2.1 + (reach % 3000) / 3000) * 1.07).toFixed(2));

  return {
    reach,
    impressions,
    spend: Number(spend.toFixed(2)),
    ctr
  };
};

const buildDemographics = ({ campaignId = 'all', adSetId = 'all' }) => {
  const multiplier = getMultiplier(campaignId, adSetId);

  return demographicBase.map((row, index) => ({
    age: row.age,
    male: Math.round(row.male * multiplier * (1 + index * 0.015)),
    female: Math.round(row.female * multiplier * (1 + index * 0.012))
  }));
};

const getMockInsights = async ({ range = '30d', campaignId = 'all', adSetId = 'all' } = {}) => {
  await delay(650);
  const timeseries = buildTimeseries({ range, campaignId, adSetId });

  return {
    summary: buildSummary(timeseries),
    timeseries,
    demographics: buildDemographics({ campaignId, adSetId })
  };
};

export const fetchInsightFilters = async () => {
  if (USE_MOCK) {
    await delay(180);
    return {
      campaigns: campaignCatalog
    };
  }

  try {
    const response = await api.get('/api/insights/filters', {
      headers: getAuthHeaders()
    });
    return normalizeInsightFiltersResponse(response.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      await delay(180);
      return {
        campaigns: campaignCatalog
      };
    }
    throw error;
  }
};

export const fetchInsights = async ({ range = '30d', campaignId = 'all', adSetId = 'all' } = {}) => {
  if (USE_MOCK) {
    return getMockInsights({ range, campaignId, adSetId });
  }

  try {
    const response = await api.get('/api/insights', {
      headers: getAuthHeaders(),
      params: {
        range,
        campaignId: campaignId !== 'all' ? campaignId : undefined,
        adSetId: adSetId !== 'all' ? adSetId : undefined
      }
    });

    return normalizeInsightsResponse(response.data);
  } catch (error) {
    if (error?.response?.status === 404) {
      return getMockInsights({ range, campaignId, adSetId });
    }
    throw error;
  }
};
