import React, { useState, useEffect } from 'react';
import { Plus, FileText, CheckCircle, Clock, AlertCircle, Trash2, Edit, Save, X } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './Templates.css';
import '../styles/whatsapp.css';

const Templates = () => {
    const [templates, setTemplates] = useState({});
    const [officialTemplates, setOfficialTemplates] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateMessage, setNewTemplateMessage] = useState('');
    const [filter, setFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('local');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        const result = await whatsappService.getTemplates();
        if (result.success) {
            setTemplates(result.templates);
        }
        
        // Load official templates from WhatsApp Business Manager
        const officialTemplatesData = [
            { name: 'hello_world', language: 'en_US', status: 'approved', category: 'utility' },
        ];
        setOfficialTemplates(officialTemplatesData);
    };

    const handleCreateTemplate = async () => {
        if (!newTemplateName || !newTemplateMessage) {
            alert('Please fill in both template name and message');
            return;
        }

        const result = await whatsappService.saveTemplate(newTemplateName, newTemplateMessage);
        if (result.success) {
            await loadTemplates();
            setNewTemplateName('');
            setNewTemplateMessage('');
            setShowCreateForm(false);
            alert('Template created successfully!');
        } else {
            alert('Failed to create template: ' + result.message);
        }
    };

    const handleDeleteTemplate = async (templateName) => {
        if (confirm(`Are you sure you want to delete template "${templateName}"?`)) {
            const result = await whatsappService.deleteTemplate(templateName);
            if (result.success) {
                await loadTemplates();
                alert('Template deleted successfully!');
            } else {
                alert('Failed to delete template: ' + result.message);
            }
        }
    };

    const filteredTemplates = Object.entries(templates).map(([name, message]) => ({
        name,
        message,
        status: 'approved', // Mock status - in real app this would come from WhatsApp API
        language: 'en_US', // Mock language - in real app this would come from WhatsApp API
        category: 'utility' // Mock category - in real app this would come from WhatsApp API
    }));

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
                    <h2>Message Templates</h2>
                    <p>Manage your WhatsApp message templates</p>
                </div>
                {activeTab === 'local' && (
                    <button className="primary-btn" onClick={() => setShowCreateForm(true)}>
                        <Plus size={18} />
                        New Template
                    </button>
                )}
            </div>

            <div className="template-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'local' ? 'active' : ''}`}
                    onClick={() => setActiveTab('local')}
                >
                    <FileText size={16} />
                    Local Templates ({Object.keys(templates).length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'official' ? 'active' : ''}`}
                    onClick={() => setActiveTab('official')}
                >
                    <CheckCircle size={16} />
                    Official Templates ({officialTemplates.length})
                </button>
            </div>

            {activeTab === 'local' && (
                <>
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

                    <div className="templates-filters">
                        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                        <button className={`filter-btn ${filter === 'marketing' ? 'active' : ''}`} onClick={() => setFilter('marketing')}>Marketing</button>
                        <button className={`filter-btn ${filter === 'utility' ? 'active' : ''}`} onClick={() => setFilter('utility')}>Utility</button>
                        <button className={`filter-btn ${filter === 'authentication' ? 'active' : ''}`} onClick={() => setFilter('authentication')}>Authentication</button>
                    </div>

                    <div className="templates-grid">
                        {Object.entries(templates).map(([name, message]) => (
                            <div key={name} className="template-card local">
                                <div className="card-header">
                                    <span className="template-name">{name}</span>
                                    <span className="status-badge local">
                                        <FileText size={12} />
                                        Local
                                    </span>
                                </div>
                                <p className="template-content">
                                    {message}
                                </p>
                                <div className="card-footer">
                                    <span className="lang-tag">Custom</span>
                                    <span className="category-tag">Local</span>
                                    <div className="template-actions">
                                        <button className="icon-btn" onClick={() => handleDeleteTemplate(name)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {Object.keys(templates).length === 0 && (
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
                <div className="templates-grid">
                    {officialTemplates.map((template) => (
                        <div key={template.name} className="template-card official">
                            <div className="card-header">
                                <span className="template-name">{template.name}</span>
                                <span className={`status-badge ${template.status}`}>
                                    {getStatusIcon(template.status)}
                                    {template.status}
                                </span>
                            </div>
                            <p className="template-content">
                                Official WhatsApp template from Business Manager
                            </p>
                            <div className="card-footer">
                                <span className="lang-tag">{template.language}</span>
                                <span className="category-tag">{template.category}</span>
                                <div className="template-actions">
                                    <span className="official-badge">
                                        <CheckCircle size={12} />
                                        Official
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Templates;
