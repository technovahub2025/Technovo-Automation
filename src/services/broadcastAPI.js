/**
 * Broadcast API Service
 */
import apiService from "./api";

export const broadcastAPI = {
  startBroadcast: (data) => apiService.post("/broadcast/start", data),

  getBroadcastStatus: (broadcastId) =>
    apiService.get(`/broadcast/status/${broadcastId}`),

  cancelBroadcast: (broadcastId) =>
    apiService.post(`/broadcast/${broadcastId}/cancel`),

  getBroadcastCalls: (broadcastId, params = {}) =>
    apiService.get(`/broadcast/${broadcastId}/calls`, { params }),

  listBroadcasts: (params = {}) =>
    apiService.get("/broadcast/list", { params }),

  deleteBroadcast: (broadcastId) =>
    apiService.delete(`/broadcast/${broadcastId}`),
};

export default broadcastAPI;