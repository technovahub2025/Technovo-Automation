import apiService from './api';

const consentService = {
  getConsentLogs: (params = {}) => apiService.get('/consent', { params }),
  exportConsentLogs: (params = {}) =>
    apiService.get('/consent/export', { params, responseType: 'blob' }),
  requestConsentExportEmail: (email, params = {}) =>
    apiService.post('/consent/export-email', { email, ...params }),
  getConsentExportJobs: (params = {}) => apiService.get('/consent/export-jobs', { params }),
  downloadConsentExportJob: (jobId) =>
    apiService.get(`/consent/export-jobs/${jobId}/download`, { responseType: 'blob' }),
  getConsentReviewAudit: (params = {}) =>
    apiService.get('/consent/review/missing-proof', { params }),
  resetContactWhatsAppConsent: (contactId, data = {}) =>
    apiService.post(`/contacts/${contactId}/whatsapp-reset-consent`, data)
};

export default consentService;
