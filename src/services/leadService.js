import apiService from '../services/api';

class LeadService {
    /**
     * Get all leads with filtering
     */
    async getLeads(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters).toString();
            const response = await apiService.get(`/api/leads?${queryParams}`);
            return response.data;
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
            const response = await apiService.get(`/api/leads/${id}`);
            return response.data;
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
            const response = await apiService.put(`/api/leads/${id}`, data);
            return response.data;
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
            const response = await apiService.delete(`/api/leads/${id}`);
            return response.data;
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
            const response = await apiService.get(`/api/leads/export?${queryParams}`, {
                responseType: 'blob'
            });

            const blob = response.data;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export leads:', error);
            throw error;
        }
    }
}

export default new LeadService();
