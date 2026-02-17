import React, { useState, useEffect, useMemo } from 'react';
import { FileText, CheckCircle, Clock, AlertCircle, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { whatsappService } from '../services/whatsappService';
import './Templates.css';
import '../styles/whatsapp.css';

const Templates = () => {
  const navigate = useNavigate();
  const [officialTemplates, setOfficialTemplates] = useState([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingTemplateName, setDeletingTemplateName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const extractErrorMessage = (err, fallback) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await whatsappService.getTemplates();

      let allTemplates = [];
      if (Array.isArray(response)) {
        allTemplates = response;
      } else if (response?.success && Array.isArray(response.data)) {
        allTemplates = response.data;
      } else {
        allTemplates = [];
      }

      setOfficialTemplates(allTemplates);
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to load templates. Please try again.');
      setError(message);
      setOfficialTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const syncTemplates = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const result = await whatsappService.syncTemplates();
      if (result?.success) {
        await loadTemplates();
        alert('Templates synced successfully!');
      } else {
        const msg = result?.error || result?.message || 'Failed to sync templates';
        setError(msg);
        alert(msg);
      }
    } catch (err) {
      const msg = extractErrorMessage(err, 'Error syncing templates');
      setError(msg);
      alert(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <CheckCircle size={12} />;
      case 'pending': return <Clock size={12} />;
      case 'rejected': return <AlertCircle size={12} />;
      default: return null;
    }
  };

  const getTemplateBody = (template) => {
    if (template?.content?.body) return template.content.body;
    if (template?.message) return template.message;
    if (Array.isArray(template?.components)) {
      const bodyComponent = template.components.find((comp) => comp?.type === 'BODY');
      if (bodyComponent?.text) return bodyComponent.text;
    }
    return '';
  };

  const handleDeleteTemplate = async (template) => {
    const templateName = template?.name?.trim();
    if (!templateName) {
      alert('Template name is missing');
      return;
    }

    const confirmed = window.confirm(`Delete template "${templateName}" from Meta and local DB?`);
    if (!confirmed) return;

    setDeletingTemplateName(templateName);
    try {
      const result = await whatsappService.deleteTemplateFromMeta(templateName);
      if (!result?.success) {
        alert(result?.error || 'Failed to delete template');
        return;
      }
      await loadTemplates();
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to delete template'));
    } finally {
      setDeletingTemplateName('');
    }
  };

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return officialTemplates.filter((template) => {
      const matchesFilter =
        filter === 'all' || template.category?.toLowerCase() === filter.toLowerCase();
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;

        const haystack = [
        template.name,
        template.language,
        template.category,
        getTemplateBody(template),
        template.message
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [officialTemplates, filter, query]);

  const templateStats = useMemo(() => {
    const stats = { total: 0, approved: 0, pending: 0, rejected: 0 };
    stats.total = officialTemplates.length;
    officialTemplates.forEach((template) => {
      const status = template.status?.toLowerCase();
      if (status === 'approved') stats.approved += 1;
      if (status === 'pending') stats.pending += 1;
      if (status === 'rejected') stats.rejected += 1;
    });
    return stats;
  }, [officialTemplates]);

  return (
    <div className="templates-page">
      <div className="templates-hero">
        <div className="hero-text">
          <span className="hero-eyebrow">Template Library</span>
          <h2>WhatsApp Templates</h2>
          <p>Curate, review, and sync your Meta-approved message templates.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" onClick={() => navigate('/templates/create')}>
            <Plus size={18} />
            Create Template
          </button>
          <button className="secondary-btn" onClick={syncTemplates} disabled={isSyncing}>
            <RefreshCw size={18} className={isSyncing ? 'spinning' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Templates'}
          </button>
          <div className="hero-hint">Last updated when you sync</div>
        </div>
      </div>

      <div className="templates-stats">
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <span className="stat-value">{templateStats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Approved</span>
          <span className="stat-value approved">{templateStats.approved}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <span className="stat-value pending">{templateStats.pending}</span>
        </div>
      </div>

      <div className="templates-toolbar">
        <div className="templates-filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'marketing' ? 'active' : ''}`} onClick={() => setFilter('marketing')}>Marketing</button>
          <button className={`filter-btn ${filter === 'utility' ? 'active' : ''}`} onClick={() => setFilter('utility')}>Utility</button>
          <button className={`filter-btn ${filter === 'authentication' ? 'active' : ''}`} onClick={() => setFilter('authentication')}>Authentication</button>
        </div>
        <label className="templates-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, content, or language"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {isLoading && (
        <div className="loading-state">
          <RefreshCw size={32} className="spinning" />
          <p>Loading templates...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button className="primary-btn" onClick={loadTemplates}>Retry</button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="templates-grid">
          {filteredTemplates.map((template) => (
            <div key={template.id || template._id || template.name} className="template-card official">
              <div className="card-header">
                <span className="template-name">{template.name}</span>
                <span className={`status-badge ${template.status?.toLowerCase()}`}>
                  {getStatusIcon(template.status)}
                  {template.status}
                </span>
              </div>
              <div className="template-content">
                {getTemplateBody(template) || 'No content available'}
              </div>
              <div className="card-footer">
                <span className="lang-tag">{template.language}</span>
                <span className="category-tag">{template.category}</span>
                <div className="template-actions">
                  <button
                    type="button"
                    className="icon-btn delete-btn"
                    onClick={() => handleDeleteTemplate(template)}
                    disabled={deletingTemplateName === template.name}
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="no-templates">
              <FileText size={48} />
              <h3>No templates found</h3>
              <p>No templates match the selected filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Templates;
