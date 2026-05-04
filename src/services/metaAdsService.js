import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

const metaApi = axios.create({
  baseURL: `${resolveApiBaseUrl()}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: String(import.meta.env.VITE_API_WITH_CREDENTIALS || "false").toLowerCase() === "true",
});

metaApi.interceptors.request.use((config) => {
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const token =
    localStorage.getItem(tokenKey) ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const metaAdsService = {
  async getCampaigns() {
    const response = await metaApi.get("/meta-ads/campaigns");
    return response.data;
  },

  async getCampaignAdSets(campaignId) {
    const response = await metaApi.get(`/meta-ads/campaign/${campaignId}/adsets`);
    return response.data;
  },

  async getAdSetAds(adSetId) {
    const response = await metaApi.get(`/meta-ads/adset/${adSetId}/ads`);
    return response.data;
  },

  async getOverview() {
    const response = await metaApi.get("/meta-ads/overview");
    return response.data;
  },

  async startFacebookAuth(origin) {
    const response = await metaApi.post("/meta-ads/auth/facebook", { origin });
    return response.data;
  },

  async getAdAccounts() {
    const response = await metaApi.get("/meta-ads/adaccounts");
    return response.data;
  },

  async saveAdAccount(adAccountId) {
    const response = await metaApi.post("/meta-ads/save-adaccount", { adAccountId });
    return response.data;
  },

  async connectAccount() {
    const response = await metaApi.post("/meta-ads/connect");
    return response.data;
  },

  async getConnectAuthUrl(origin) {
    const response = await metaApi.post("/meta-ads/connect/auth-url", { origin });
    return response.data;
  },

  async saveSelections(payload) {
    const response = await metaApi.post("/meta-ads/settings/selection", payload);
    return response.data;
  },

  async saveCampaignStep(payload) {
    const response = await metaApi.post("/meta-ads/campaigns/step/campaign", payload);
    return response.data;
  },

  async saveAdSetStep(payload) {
    const response = await metaApi.post("/meta-ads/campaigns/step/adset", payload);
    return response.data;
  },

  async saveAdCreativeStep(payload, creativeFile) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (creativeFile) {
      formData.append("creativeFile", creativeFile);
    }

    const response = await metaApi.post("/meta-ads/campaigns/step/ad", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async publishCampaignDraft(campaignId) {
    const response = await metaApi.post(`/meta-ads/campaigns/${campaignId}/publish`);
    return response.data;
  },

  async createCampaign(payload, creativeFile) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (creativeFile) {
      formData.append("creativeFile", creativeFile);
    }

    const response = await metaApi.post("/meta-ads/campaigns", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async createCampaignOnly(payload) {
    const response = await metaApi.post("/meta-ads/campaign/create", payload);
    return response.data;
  },

  async createAdSet(payload) {
    const response = await metaApi.post("/meta-ads/adset/create", payload);
    return response.data;
  },

  async createAd(payload, creativeFile) {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (creativeFile) {
      formData.append("creativeFile", creativeFile);
    }

    const response = await metaApi.post("/meta-ads/ad/create", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async activateCampaign(payload) {
    const response = await metaApi.post("/meta-ads/campaign/activate", payload);
    return response.data;
  },

  async activateAdSet(payload) {
    const response = await metaApi.post("/meta-ads/adset/activate", payload);
    return response.data;
  },

  async activateAd(payload) {
    const response = await metaApi.post("/meta-ads/ad/activate", payload);
    return response.data;
  },

  async syncCampaign(campaignId) {
    const response = await metaApi.post(`/meta-ads/campaigns/${campaignId}/sync`);
    return response.data;
  },

  async updateCampaignStatus(campaignId, status) {
    const response = await metaApi.post(`/meta-ads/campaigns/${campaignId}/status`, { status });
    return response.data;
  },

  async syncAllCampaigns() {
    const response = await metaApi.post("/meta-ads/campaigns/sync-all");
    return response.data;
  },

  async getDiagnostics() {
    const response = await metaApi.get("/meta-ads/diagnostics");
    return response.data;
  },

  async getBillingSummary() {
    const response = await metaApi.get("/meta-ads/billing-summary");
    return response.data;
  },

  async getWallet() {
    const response = await metaApi.get("/meta-ads/wallet");
    return response.data;
  },

  async topUpWallet(amount) {
    const response = await metaApi.post("/meta-ads/wallet/topup", { amount });
    return response.data;
  },
};

export default metaAdsService;
