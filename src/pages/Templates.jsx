import React, { useState, useEffect } from 'react';
import { Plus, FileText, CheckCircle, Clock, AlertCircle, Trash2, Edit, Save, X, RefreshCw, Download } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './Templates.css';
import '../styles/whatsapp.css';

const Templates = () => {
    const [templates, setTemplates] = useState([]);
    const [officialTemplates, setOfficialTemplates] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateMessage, setNewTemplateMessage] = useState('');
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('local');
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
    try {
        const response = await whatsappService.getTemplates();
        let allTemplates = [];
        
        // Handle both response formats
        if (Array.isArray(response)) {
            allTemplates = response;
        } else if (response?.success && Array.isArray(response.data)) {
            allTemplates = response.data;
        } else {
            console.error('Unexpected response format:', response);
            allTemplates = [];
        }
        
        // Categorize templates based on their type from the database
        const official = [];
        const custom = [];
        
        allTemplates.forEach(template => {
            // If template has a type, use it; otherwise treat as official
            if (template.type === 'custom') {
                custom.push(template);
            } else {
                // All other templates (including those with type 'official' or no type) go to official
                official.push(template);
            }
        });
        
        setOfficialTemplates(official);
        setTemplates(custom);
    } catch (error) {
        console.error('Failed to load templates:', error);
        setTemplates([]);
        setOfficialTemplates([]);
    }
};

    const syncTemplates = async () => {
    setIsSyncing(true);
    try {
        const result = await whatsappService.syncTemplates();
        if (result.success) {
            await loadTemplates(); // This will re-fetch and separate the templates
            alert('Templates synced successfully!');
        } else {
            alert('Failed to sync templates: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error syncing templates:', error);
        alert('Error syncing templates: ' + error.message);
    } finally {
        setIsSyncing(false);
    }
};

const handleUpdateTemplate = async () => {
    if (!editingTemplate.name || !editingTemplate.content?.body && !editingTemplate.message) {
        alert('Please fill in both template name and message');
        return;
    }
    try {
        const result = await whatsappService.updateTemplate(
            editingTemplate._id,
            editingTemplate.name,
            editingTemplate.content?.body || editingTemplate.message,
            'custom'
        );
        if (result.success) {
            await loadTemplates();
            setEditingTemplate(null);
            alert('Template updated successfully!');
        } else {
            alert('Failed to update template: ' + (result.error || result.message));
        }
    } catch (error) {
        alert('Failed to update template: ' + error.message);
    }
};

const handleCreateTemplate = async () => {
    if (!newTemplateName || !newTemplateMessage) {
        alert('Please fill in both template name and message');
        return;
    }
    try {
        const result = await whatsappService.saveTemplate(
            newTemplateName, 
            newTemplateMessage,
            'custom' // Make sure to pass the type
        );
        if (result.success) {
            await loadTemplates(); // This will update both template lists
            setNewTemplateName('');
            setNewTemplateMessage('');
            setShowCreateForm(false);
            alert('Template created successfully!');
        } else {
            alert('Failed to create template: ' + (result.error || result.message));
        }
    } catch (error) {
        alert('Failed to create template: ' + error.message);
    }
};

    const handleDeleteTemplate = async (templateId) => {
        if (confirm('Are you sure you want to delete this template?')) {
            try {
                const result = await whatsappService.deleteTemplate(templateId);
                if (result.success) {
                    await loadTemplates();
                    alert('Template deleted successfully!');
                } else {
                    alert('Failed to delete template: ' + (result.error || result.message));
                }
            } catch (error) {
                alert('Failed to delete template: ' + error.message);
            }
        }
    };

    const filteredTemplates = activeTab === 'official' 
    ? officialTemplates.filter(template => 
        filter === 'all' || template.category === filter
      )
    : templates.filter(template => 
        filter === 'all' || template.category === filter
      );

    const getStatusIcon = (status) => {
        switch (status) {
            case 'approved': return <CheckCircle size={12} />;
            case 'pending': return <Clock size={12} />;
            case 'rejected': return <AlertCircle size={12} />;
            default: return null;
        }
    };
    return (
        <div className="templates-page">
            <div className="page-header">
                <div>
                    <h2>Templates Library</h2>
                    <p>Manage your WhatsApp templates</p>
                </div>
                <div className="header-actions">
                    {activeTab === 'local' && (
                        <button className="primary-btn" onClick={() => setShowCreateForm(true)}>
                            <Plus size={18} />
                            New Template
                        </button>
                    )}
                    {activeTab === 'official' && (
                        <button 
                            className="secondary-btn" 
                            onClick={syncTemplates}
                            disabled={isSyncing}
                        >
                            <RefreshCw size={18} className={isSyncing ? 'spinning' : ''} />
                            {isSyncing ? 'Syncing...' : 'Sync Templates'}
                        </button>
                    )}
                </div>
            </div>

            <div className="template-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
                    onClick={() => setActiveTab('local')}
                >
                    <FileText size={16} />
                    Message Templates ({templates.length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'official' ? 'active' : ''}`}
                    onClick={() => setActiveTab('official')}
                >
                    <CheckCircle size={16} />
                    Whatsapp Templates ({officialTemplates.length})
                </button>
            </div>

            {activeTab === 'local' && (
                <>
                    {editingTemplate && (
                        <div className="create-template-form">
                            <h3>Edit Local Template</h3>
                            <div className="form-group">
                                <label>Template Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. welcome_message"
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Message Content</label>
                                <textarea 
                                    placeholder="Enter your template message here... Use {{1}}, {{2}}, etc. for variables"
                                    value={editingTemplate.content?.body || editingTemplate.message || ''}
                                    onChange={(e) => setEditingTemplate({
                                        ...editingTemplate, 
                                        content: { ...editingTemplate.content, body: e.target.value }
                                    })}
                                    rows={4}
                                />
                                <small>Example: Hello {'{{1}}'}, welcome to our service! Your code is {'{{2}}'}</small>
                            </div>
                            <div className="form-actions">
                                <button className="secondary-btn" onClick={() => setEditingTemplate(null)}>
                                    <X size={16} />
                                    Cancel
                                </button>
                                <button className="primary-btn" onClick={handleUpdateTemplate}>
                                    <Save size={16} />
                                    Update Template
                                </button>
                            </div>
                        </div>
                    )}

                    {showCreateForm && (
                        <div className="create-template-form">
                            <h3>Create New Local Template</h3>
                            <div className="form-group">
                                <label>Template Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. welcome_message"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Message Content</label>
                                <textarea 
                                    placeholder="Enter your template message here... Use {{1}}, {{2}}, etc. for variables"
                                    value={newTemplateMessage}
                                    onChange={(e) => setNewTemplateMessage(e.target.value)}
                                    rows={4}
                                />
                                <small>Example: Hello {'{{1}}'}, welcome to our service! Your code is {'{{2}}'}</small>
                            </div>
                            <div className="form-actions">
                                <button className="secondary-btn" onClick={() => setShowCreateForm(false)}>
                                    <X size={16} />
                                    Cancel
                                </button>
                                <button className="primary-btn" onClick={handleCreateTemplate}>
                                    <Save size={16} />
                                    Save Template
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="templates-grid">
                        {templates.map((template) => (
                            <div key={template._id || template.name} className="template-card local">
                                <div className="card-header">
                                    <span className="template-name">{template.name}</span>
                                </div>
                                <p className="template-content">
                                    {template.content?.body || template.message || 'No content'}
                                </p>
                                <div className="card-footer">
                                    <span className="lang-tag">Custom</span>
                                    <div className="template-actions">
                                        <button className="icon-btn" onClick={() => setEditingTemplate(template)}>
                                            <Edit size={14} />
                                        </button>
                                        <button className="icon-btn" onClick={() => handleDeleteTemplate(template._id || template.name)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {templates.length === 0 && (
                            <div className="no-templates">
                                <FileText size={48} />
                                <h3>No local templates found</h3>
                                <p>Create your first local template to get started</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'official' && (
                <>
                    <div className="templates-filters">
                        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                        <button className={`filter-btn ${filter === 'marketing' ? 'active' : ''}`} onClick={() => setFilter('marketing')}>Marketing</button>
                        <button className={`filter-btn ${filter === 'utility' ? 'active' : ''}`} onClick={() => setFilter('utility')}>Utility</button>
                        <button className={`filter-btn ${filter === 'authentication' ? 'active' : ''}`} onClick={() => setFilter('authentication')}>Authentication</button>
                    </div>
                    <div className="templates-grid">
                    {officialTemplates
                        .filter(template => {
                            if (filter === 'all') return true;
                            return template.category?.toLowerCase() === filter.toLowerCase();
                        })
                        .map((template) => (
                        <div key={template.name} className="template-card official">
                            <div className="card-header">
                                <span className="template-name">{template.name}</span>
                                <span className={`status-badge ${template.status}`}>
                                    {getStatusIcon(template.status)}
                                    {template.status}
                                </span>
                            </div>
                            <p className="template-content">
                                {template.content?.body || template.message || 'No content'}
                            </p>
                            <div className="card-footer">
                                <span className="lang-tag">{template.language}</span>
                                <span className="category-tag">{template.category}</span>
                                <div className="template-actions">
                                </div>
                            </div>
                        </div>
                    ))}
                    {officialTemplates.filter(template => {
                        if (filter === 'all') return false;
                        return template.category?.toLowerCase() === filter.toLowerCase();
                    }).length === 0 && filter !== 'all' && (
                        <div className="no-templates">
                            <FileText size={48} />
                            <h3>No templates found</h3>
                            <p>No templates match the selected filter</p>
                        </div>
                    )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Templates;
