import apiService from '../services/api';

class LeadService {
    /**
     * Get all leads with filtering
     */
    async getLeads(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await apiService.get(`/leads?${queryParams}`);
            return response;
        } catch (error) {
            console.error('Failed to fetch leads:', error);
            throw error;
        }
    }

    /**
     * Get a single lead by ID
     */
    async getLeadById(id) {
        try {
            const response = await apiService.get(`/leads/${id}`);
            return response;
        } catch (error) {
            console.error(`Failed to fetch lead ${id}:`, error);
            throw error;
        }
    }

    /**
     * Update lead
     */
    async updateLead(id, data) {
        try {
            const response = await apiService.put(`/leads/${id}`, data);
            return response;
        } catch (error) {
            console.error(`Failed to update lead ${id}:`, error);
            throw error;
        }
    }

    /**
     * Delete lead
     */
    async deleteLead(id) {
        try {
            const response = await apiService.delete(`/leads/${id}`);
            return response;
        } catch (error) {
            console.error(`Failed to delete lead ${id}:`, error);
            throw error;
        }
    }

    /**
     * Export leads to CSV
     */
    async exportLeads(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            // Use raw fetch or apiService if it supports blob, passing token manually if needed
            // Assuming apiService handles auth headers, we need to handle blob response
            // apiService.get usually returns JSON. We might need a direct call or update apiService
            // For now, let's assume apiService can return the raw response if we ask or construction a direct fetch with token
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiService.baseURL || '/api'}/leads/export?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error('Failed to export leads:', error);
            throw error;
        }
    }
}

export default new LeadService();
