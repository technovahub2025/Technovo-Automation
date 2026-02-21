/**
 * Custom React Hook for Outbound Call Management
 * Follows the pattern established by useBroadcast
 */
import { useState, useCallback } from 'react';
import apiService from '../services/api';

export const useOutbound = () => {
    const [callHistory, setCallHistory] = useState([]);
    const [scheduledCalls, setScheduledCalls] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refreshCallHistory = useCallback(async (params = { limit: 10 }) => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getCallHistory(params);
            setCallHistory(response.data?.data || response.data?.calls || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load call history');
            console.error('Refresh call history error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshScheduledCalls = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getScheduledCalls();
            setScheduledCalls(response.data?.data || response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load scheduled calls');
            console.error('Refresh scheduled calls error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshTemplates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await apiService.getCallTemplates();
            setTemplates(response.data?.data || response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load templates');
            console.error('Refresh templates error:', err);
            // Fallback to empty array
            setTemplates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshContacts = useCallback(async () => {
        try {
            setError(null);

            const response = await apiService.getContacts();
            setContacts(response.data?.data || response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load contacts');
            console.error('Refresh contacts error:', err);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all data in parallel
            const [historyRes, scheduledRes, templatesRes, contactsRes] = await Promise.all([
                apiService.getCallHistory({ limit: 10 }),
                apiService.getScheduledCalls(),
                apiService.getCallTemplates(),
                apiService.getContacts()
            ]);

            setCallHistory(historyRes.data?.data || historyRes.data?.calls || []);
            setScheduledCalls(scheduledRes.data?.data || scheduledRes.data || []);
            setTemplates(templatesRes.data?.data || templatesRes.data || []);
            setContacts(contactsRes.data?.data || contactsRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load outbound data');
            console.error('Refresh all error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const getTemplateById = useCallback(
        (templateId) => {
            return templates.find(t => t.id === templateId);
        },
        [templates]
    );

    const getScheduledCallById = useCallback(
        (callId) => {
            return scheduledCalls.find(c => c.id === callId);
        },
        [scheduledCalls]
    );

    return {
        callHistory,
        scheduledCalls,
        templates,
        contacts,
        loading,
        error,
        refreshCallHistory,
        refreshScheduledCalls,
        refreshTemplates,
        refreshContacts,
        refreshAll,
        getTemplateById,
        getScheduledCallById
    };
};
