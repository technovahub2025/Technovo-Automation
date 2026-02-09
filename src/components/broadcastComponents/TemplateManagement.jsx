import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, FileText, Search, Clock, AlertCircle, Eye, Copy } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './TemplateManagement.css';

const TemplateManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('official'); // 'official' or 'message'
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    language: 'en_US',
    content: {
      header: { type: 'text', text: '' },
      body: '',
      footer: ''
    },
    variables: [],
    status: 'draft'
  });

  useEffect(() => {
    fetchTemplates();
  }, [filterStatus, filterCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await whatsappService.getTemplates();
      setTemplates(data || []);
    } catch (error) {
      alert('Error fetching templates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncWhatsAppTemplates = async () => {
    setSyncing(true);
    try {
      const result = await whatsappService.syncTemplates();
      if (result.success) {
        alert(`Synced ${result.templates?.length || 0} templates from WhatsApp`);
        await fetchTemplates();
      } else {
        alert('Failed to sync templates: ' + (result.error || result.message));
      }
    } catch (error) {
      alert('Error syncing templates: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingTemplate) {
        const result = await whatsappService.updateTemplate(editingTemplate._id, formData);
        if (result.success) {
          alert('Template updated successfully!');
        } else {
          throw new Error(result.error || result.message);
        }
      } else {
        const result = await whatsappService.saveTemplate(formData.name, formData.content.body);
        if (result.success) {
          alert('Template created successfully!');
        } else {
          throw new Error(result.error || result.message);
        }
      }
      
      setShowModal(false);
      setEditingTemplate(null);
      resetForm();
      await fetchTemplates();
    } catch (error) {
      alert('Error saving template: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      const result = await whatsappService.deleteTemplate(id);
      if (result.success) {
        await fetchTemplates();
      } else {
        alert('Failed to delete template: ' + (result.error || result.message));
      }
    } catch (error) {
      alert('Error deleting template: ' + error.message);
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      category: template.category || 'general',
      language: template.language || 'en_US',
      content: template.content || {
        header: { type: 'text', text: '' },
        body: '',
        footer: ''
      },
      variables: template.variables || [],
      status: template.status || 'draft'
    });
    setShowModal(true);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleCopyTemplate = (template) => {
    const newTemplate = {
      ...template,
      name: `${template.name}_copy`,
      _id: undefined
    };
    handleEdit(newTemplate);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'general',
      language: 'en_US',
      content: {
        header: { type: 'text', text: '' },
        body: '',
        footer: ''
      },
      variables: [],
      status: 'draft'
    });
    setEditingTemplate(null);
  };

  const addVariable = () => {
    setFormData({
      ...formData,
      variables: [...formData.variables, { name: '', example: '', required: false }]
    });
  };

  const updateVariable = (index, field, value) => {
    const newVariables = [...formData.variables];
    newVariables[index][field] = value;
    setFormData({ ...formData, variables: newVariables });
  };

  const removeVariable = (index) => {
    setFormData({
      ...formData,
      variables: formData.variables.filter((_, i) => i !== index)
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle size={16} className="status-approved" />;
      case 'pending': return <Clock size={16} className="status-pending" />;
      case 'rejected': return <XCircle size={16} className="status-rejected" />;
      default: return <AlertCircle size={16} className="status-draft" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'approved';
      case 'pending': return 'pending';
      case 'rejected': return 'rejected';
      default: return 'draft';
    }
  };

  // Separate official and message templates
  const officialTemplates = templates.filter(template => template.type === 'official');
  const messageTemplates = templates.filter(template => template.type === 'custom');

  // Filter based on active tab
  const templatesToShow = activeTab === 'official' ? officialTemplates : messageTemplates;
  
  const filteredTemplates = templatesToShow.filter(template => {
    const matchesSearch = template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       template.content?.body?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || template.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];

  const renderTemplatePreview = (template) => {
    let preview = template.content?.body || '';
    
    // Replace variables with examples
    template.variables?.forEach((variable, index) => {
      const placeholder = `{{${index + 1}}}`;
      const replacement = variable.example || `[${variable.name || 'Variable ' + (index + 1)}]`;
      preview = preview.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
    });

    return preview;
  };

  return (
    <div className="template-management">
      <div className="template-header">
        <div className="header-content">
          <h2>Template Management</h2>
          <p>Create and manage WhatsApp message templates</p>
        </div>
        <div className="header-actions">
          <button
            onClick={syncWhatsAppTemplates}
            disabled={syncing}
            className="sync-btn"
          >
            <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
            {syncing ? 'Syncing...' : 'Sync from WhatsApp'}
          </button>
          {activeTab === 'message' && (
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="create-btn"
          >
            <Plus size={16} />
            New Template
          </button>
        )}
        </div>
      </div>

      {/* Tabs */}
      <div className="template-tabs">
        <button
          className={`tab-btn ${activeTab === 'official' ? 'active' : ''}`}
          onClick={() => setActiveTab('official')}
        >
          <FileText size={16} />
          Official Templates ({officialTemplates.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'message' ? 'active' : ''}`}
          onClick={() => setActiveTab('message')}
        >
          <Plus size={16} />
          Message Templates ({messageTemplates.length})
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Templates List */}
      <div className="templates-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>No templates found</h3>
            <p>Try adjusting your filters or create a new template</p>
          </div>
        ) : (
          <div className="templates-grid">
            {filteredTemplates.map(template => (
              <div key={template._id} className="template-card">
                <div className="template-header-info">
                  <div className="template-title">
                    <h3>{template.name}</h3>
                    <div className="template-badges">
                      <span className={`status-badge ${getStatusColor(template.status)}`}>
                        {getStatusIcon(template.status)}
                        {template.status}
                      </span>
                      {template.isActive && (
                        <span className="active-badge">Active</span>
                      )}
                    </div>
                  </div>
                  <div className="template-meta">
                    <span className="meta-item">{template.category}</span>
                    <span className="meta-item">{template.language}</span>
                    <span className="meta-item">Used {template.usageCount || 0} times</span>
                  </div>
                </div>
                
                <div className="template-content">
                  <p className="template-preview">
                    {renderTemplatePreview(template)}
                  </p>
                  {template.variables && template.variables.length > 0 && (
                    <div className="variables-list">
                      <span className="variables-label">Variables:</span>
                      {template.variables.map((variable, index) => (
                        <span key={index} className="variable-tag">
                          {variable.name || `{{${index + 1}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="template-actions">
                  <button
                    onClick={() => handlePreview(template)}
                    className="action-btn preview-btn"
                    title="Preview template"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleCopyTemplate(template)}
                    className="action-btn copy-btn"
                    title="Duplicate template"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleEdit(template)}
                    className="action-btn edit-btn"
                    title="Edit template"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="action-btn delete-btn"
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingTemplate ? 'Edit Template' : (activeTab === 'message' ? 'New Message Template' : 'New Official Template')}</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="template-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Template Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <input
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="form-select"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Body Content</label>
                <textarea
                  value={formData.content.body}
                  onChange={(e) => setFormData({
                    ...formData,
                    content: { ...formData.content, body: e.target.value }
                  })}
                  rows={4}
                  className="form-textarea"
                  placeholder="Enter your template message here... Use {{1}}, {{2}}, etc. for variables"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Footer (Optional)</label>
                <input
                  type="text"
                  value={formData.content.footer || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    content: { ...formData.content, footer: e.target.value }
                  })}
                  className="form-input"
                  placeholder="Optional footer text"
                />
              </div>

              <div className="variables-section">
                <div className="variables-header">
                  <label className="form-label">Variables</label>
                  <button
                    type="button"
                    onClick={addVariable}
                    className="add-variable-btn"
                  >
                    <Plus size={14} />
                    Add Variable
                  </button>
                </div>
                
                {formData.variables.map((variable, index) => (
                  <div key={index} className="variable-row">
                    <input
                      type="text"
                      placeholder="Variable name"
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value)}
                      className="variable-input"
                    />
                    <input
                      type="text"
                      placeholder="Example value"
                      value={variable.example}
                      onChange={(e) => updateVariable(index, 'example', e.target.value)}
                      className="variable-input"
                    />
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                      />
                      Required
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVariable(index)}
                      className="remove-variable-btn"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="submit-btn"
                >
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="modal-overlay">
          <div className="modal-content preview-modal">
            <div className="modal-header">
              <h3>Template Preview: {previewTemplate.name}</h3>
              <button
                onClick={() => { setShowPreview(false); setPreviewTemplate(null); }}
                className="close-btn"
              >
                ×
              </button>
            </div>
            
            <div className="preview-content">
              <div className="preview-meta">
                <span className="meta-item">{previewTemplate.category}</span>
                <span className="meta-item">{previewTemplate.language}</span>
                <span className={`status-badge ${getStatusColor(previewTemplate.status)}`}>
                  {getStatusIcon(previewTemplate.status)}
                  {previewTemplate.status}
                </span>
              </div>
              
              <div className="preview-message">
                <div className="message-header">
                  {previewTemplate.content?.header?.text && (
                    <div className="header-text">{previewTemplate.content.header.text}</div>
                  )}
                </div>
                <div className="message-body">
                  {renderTemplatePreview(previewTemplate)}
                </div>
                {previewTemplate.content?.footer && (
                  <div className="message-footer">{previewTemplate.content.footer}</div>
                )}
              </div>
              
              {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                <div className="preview-variables">
                  <h4>Variables:</h4>
                  <div className="variables-grid">
                    {previewTemplate.variables.map((variable, index) => (
                      <div key={index} className="variable-info">
                        <span className="variable-name">
                          {'{{' + (index + 1) + '}}'} {variable.name && `(${variable.name})`}
                        </span>
                        <span className="variable-example">
                          Example: {variable.example || 'Not set'}
                        </span>
                        {variable.required && (
                          <span className="variable-required">Required</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManagement;
