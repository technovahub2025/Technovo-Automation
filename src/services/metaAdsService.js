import axios from "axios";

// Dedicated client for Meta Ads + related backend routes.
const META_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_CREDENTIALS = String(import.meta.env.VITE_API_WITH_CREDENTIALS || "false").toLowerCase() === "true";
const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "authToken";

export const metaApi = axios.create({
  baseURL: META_BASE_URL,
  withCredentials: USE_CREDENTIALS,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach auth token if present
metaApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem("authToken") || localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const metaGet = (path, config) => metaApi.get(path, config);
const metaPost = (path, data, config) => metaApi.post(path, data, config);

export const metaAdsService = {
  async getOverview() {
    const response = await metaGet("/api/meta-ads/overview");
    return response.data;
  },

  async startFacebookAuth(origin) {
    const response = await metaPost("/api/meta-ads/auth/facebook", { origin });
    return response.data;
  },

  async getAdAccounts() {
    const response = await metaGet("/api/meta-ads/adaccounts");
    return response.data;
  },

  async saveAdAccount(adAccountId) {
    const response = await metaPost("/api/meta-ads/save-adaccount", { adAccountId });
    return response.data;
  },

  async connectAccount() {
    const response = await metaPost("/api/meta-ads/connect");
    return response.data;
  },

  async getConnectAuthUrl(origin) {
    const response = await metaPost("/api/meta-ads/connect/auth-url", { origin });
    return response.data;
  },

  async saveSelections(payload) {
    const response = await metaPost("/api/meta-ads/settings/selection", payload);
    return response.data;
  },

  async saveCampaignStep(payload) {
    const response = await metaPost("/api/meta-ads/campaigns/step/campaign", payload);
    return response.data;
  },

  async saveAdSetStep(payload) {
    const response = await metaPost("/api/meta-ads/campaigns/step/adset", payload);
    return response.data;
  },

  async saveAdCreativeStep(payload, creativeFile) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (creativeFile) {
      formData.append("creativeFile", creativeFile);
    }

    const response = await metaPost("/api/meta-ads/campaigns/step/ad", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async publishCampaignDraft(campaignId) {
    const response = await metaPost(`/api/meta-ads/campaigns/${campaignId}/publish`);
    return response.data;
  },

  async createCampaign(payload, creativeFile) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (creativeFile) {
      formData.append("creativeFile", creativeFile);
    }

    const response = await metaPost("/api/meta-ads/campaigns", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async syncCampaign(campaignId) {
    const response = await metaPost(`/api/meta-ads/campaigns/${campaignId}/sync`);
    return response.data;
  },

  async updateCampaignStatus(campaignId, status) {
    const response = await metaPost(`/api/meta-ads/campaigns/${campaignId}/status`, { status });
    return response.data;
  },

  async syncAllCampaigns() {
    const response = await metaPost("/api/meta-ads/campaigns/sync-all");
    return response.data;
  },

  async getDiagnostics() {
    const response = await metaGet("/api/meta-ads/diagnostics");
    return response.data;
  },

  async getWallet() {
    const response = await metaGet("/api/meta-ads/wallet");
    return response.data;
  },

  async topUpWallet(amount) {
    const response = await metaPost("/api/meta-ads/wallet/topup", { amount });
    return response.data;
  },
};

export default metaAdsService;
