import React, { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle, Calendar, Users, FileText, Upload, Send, AlertCircle } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './Broadcast.css';
import '../styles/whatsapp.css';
import '../styles/message-preview.css';
import whatsappLogo from '../assets/WhatsApp.svg.webp';

const Broadcast = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [messageType, setMessageType] = useState('template');
    const [templates, setTemplates] = useState({});
    const [officialTemplates, setOfficialTemplates] = useState([]);
    const [recipients, setRecipients] = useState([]);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [sendResults, setSendResults] = useState(null);
    
    // Form states
    const [templateName, setTemplateName] = useState('');
    const [language, setLanguage] = useState('en_US');
    const [customMessage, setCustomMessage] = useState('');
    const [selectedLocalTemplate, setSelectedLocalTemplate] = useState('');
    const [broadcastName, setBroadcastName] = useState('');

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        const result = await whatsappService.getTemplates();
        if (result.success) {
            setTemplates(result.templates);
        }
        
        // Load official templates (these would come from WhatsApp Business Manager API)
        // For now, we'll use placeholder data - you should replace this with actual API call
        const officialTemplatesData = [
            { name: 'hello_world', language: 'en_US', status: 'approved', category: 'utility' },
        ];
        setOfficialTemplates(officialTemplatesData);
    };

    const handleLocalTemplateSelect = (templateName) => {
        setSelectedLocalTemplate(templateName);
        if (templates[templateName]) {
            setCustomMessage(templates[templateName]);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            const result = await whatsappService.uploadCSV(file);
            if (result.success) {
                setRecipients(result.recipients);
            } else {
                alert('Failed to process CSV: ' + result.message);
            }
        }
    };

    const handleSendBroadcast = async () => {
        if (!recipients.length) {
            alert('Please upload a CSV file with recipients');
            return;
        }

        setIsSending(true);
        
        const config = messageType === 'template' 
            ? { templateName, language }
            : { customMessage };

        const result = await whatsappService.sendBulkMessages(messageType, config, recipients);
        
        setSendResults(result);
        setIsSending(false);

        if (result.success) {
            alert(`Campaign sent successfully! ${result.successful}/${result.total_sent} messages delivered.`);
        } else {
            alert('Failed to send campaign: ' + result.message);
        }
    };

    const getTemplatePreview = () => {
        if (!templateName) return 'Select a template';
        
        // For demo purposes, show a sample template message
        const templateMessages = {
            'hello_world': 'Hello World! This is a sample template message.',
            'welcome_message': 'Welcome {{1}}! Thank you for joining our service.',
            'promotion': 'Hi {{1}}, get {{2}} off on your next purchase! Use code: {{3}}'
        };
        
        let message = templateMessages[templateName] || `Template: ${templateName}`;
        
        // Replace variables with sample values if recipients have variables
        if (recipients.length > 0 && recipients[0].variables.length > 0) {
            recipients[0].variables.forEach((variable, index) => {
                message = message.replace(`{{${index + 1}}}`, variable || `[Variable ${index + 1}]`);
                message = message.replace(`{var${index + 1}}`, variable || `[Variable ${index + 1}]`);
            });
        }
        
        return message;
    };

    const getMessagePreview = () => {
        if (!customMessage) return 'Enter your custom message';
        
        let message = customMessage;
        
        // Replace variables with sample values if recipients have variables
        if (recipients.length > 0 && recipients[0].variables.length > 0) {
            recipients[0].variables.forEach((variable, index) => {
                message = message.replace(`{{${index + 1}}}`, variable || `[Variable ${index + 1}]`);
                message = message.replace(`{var${index + 1}}`, variable || `[Variable ${index + 1}]`);
            });
        }
        
        return message;
    };

    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    };

    const getCurrentPhoneTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: false 
        });
    };

    return (
        <div className="broadcast-page">
            <div className="page-header">
                <div>
                    <h2>Broadcasts</h2>
                    <p>Manage your bulk message campaigns</p>
                </div>
                {activeTab === 'overview' && (
                    <button className="primary-btn" onClick={() => setActiveTab('schedule')}>
                        <Plus size={18} />
                        New Broadcast
                    </button>
                )}
            </div>

            <div className="broadcast-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    Schedule Broadcast
                </button>
            </div>

            {activeTab === 'overview' ? (
                <>
                    <div className="broadcast-stats">
                        <div className="stat-box">
                            <span className="label">Total Reached</span>
                            <span className="value">45,200</span>
                        </div>
                        <div className="stat-box">
                            <span className="label">Engagement Rate</span>
                            <span className="value">12.5%</span>
                        </div>
                        <div className="stat-box">
                            <span className="label">Credits Used</span>
                            <span className="value">5,600</span>
                        </div>
                    </div>

                    <div className="history-section">
                        <h3>History</h3>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Campaign Name</th>
                                    <th>Status</th>
                                    <th>Scheduled</th>
                                    <th>Sent</th>
                                    <th>Delivered</th>
                                    <th>Read</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Summer Sale Promo</td>
                                    <td><span className="badge ongoing">Sending</span></td>
                                    <td>Today, 10:00 AM</td>
                                    <td>1,200</td>
                                    <td>1,150</td>
                                    <td>850</td>
                                </tr>
                                <tr>
                                    <td>Weekend Reminder</td>
                                    <td><span className="badge success">Completed</span></td>
                                    <td>Yesterday, 9:00 AM</td>
                                    <td>350</td>
                                    <td>348</td>
                                    <td>310</td>
                                </tr>
                                <tr>
                                    <td>New Collection Drop</td>
                                    <td><span className="badge success">Completed</span></td>
                                    <td>Oct 24, 2:00 PM</td>
                                    <td>5,000</td>
                                    <td>4,950</td>
                                    <td>4,100</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="schedule-form-container">
                    <div className="campaign-config-wrapper">
                        <div className="form-section">
                            <h3>Configure WhatsApp Campaign</h3>

                            <div className="form-group">
                                <label>Campaign Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Diwali Promo 2024" 
                                    value={broadcastName}
                                    onChange={(e) => setBroadcastName(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Message Type</label>
                                <div className="message-type-options">
                                    <label className="radio-option">
                                        <input 
                                            type="radio" 
                                            name="message_type" 
                                            value="template" 
                                            checked={messageType === 'template'}
                                            onChange={(e) => setMessageType(e.target.value)}
                                        />
                                        <span><CheckCircle size={14} /> Official WhatsApp Template</span>
                                    </label>
                                    <label className="radio-option">
                                        <input 
                                            type="radio" 
                                            name="message_type" 
                                            value="text" 
                                            checked={messageType === 'text'}
                                            onChange={(e) => setMessageType(e.target.value)}
                                        />
                                        <span><FileText size={14} /> Custom Text Message</span>
                                    </label>
                                </div>
                            </div>

                            {messageType === 'template' ? (
                                <>
                                    <div className="form-group">
                                        <label><CheckCircle size={16} /> Official Template Name</label>
                                        <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
                                            <option value="">Select official template...</option>
                                            {officialTemplates.map(template => (
                                                <option key={template.name} value={template.name}>
                                                    {template.name} ({template.language}) - {template.status}
                                                </option>
                                            ))}
                                        </select>
                                        <small>These are your approved templates from WhatsApp Business Manager</small>
                                    </div>

                                    <div className="form-group">
                                        <label>Language Code</label>
                                        <input 
                                            type="text" 
                                            value={language} 
                                            onChange={(e) => setLanguage(e.target.value)}
                                            placeholder="en_US"
                                        />
                                        <small>Must match the template's approved language</small>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label><FileText size={16} /> Custom Message</label>
                                        <div className="whatsapp-message-input">
                                            <textarea 
                                                placeholder="Type your message here..."
                                                value={customMessage}
                                                onChange={(e) => {
                                                    if (e.target.value.length <= 1000) {
                                                        setCustomMessage(e.target.value);
                                                    }
                                                }}
                                                rows={4}
                                                className="message-textarea"
                                                maxLength={1000}
                                            />
                                            <div className="message-input-footer">
                                                <span className="char-count">{customMessage?.length || 0}/1000</span>
                                                <div className="message-actions">
                                                    <span className="action-icon">😊</span>
                                                    <span className="action-icon">📎</span>
                                                </div>
                                            </div>
                                        </div>
                                        <small>Use {'{var1}'}, {'{var2}'} for variables from CSV file</small>
                                    </div>

                                    <div className="form-group">
                                        <label>Or use saved local template:</label>
                                        <div className="template-selector">
                                            <select 
                                                value={selectedLocalTemplate} 
                                                onChange={(e) => handleLocalTemplateSelect(e.target.value)}
                                                className="template-dropdown"
                                            >
                                                <option value="">Select local template...</option>
                                                {Object.keys(templates).map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <small>These are custom templates saved locally</small>
                                    </div>
                                </>
                            )}

                            <div className="form-group">
                                <label><Upload size={16} /> Upload Recipients CSV</label>
                                <div className="csv-upload-area">
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        onChange={handleFileUpload}
                                        id="csv-upload"
                                        className="csv-input"
                                    />
                                    <label htmlFor="csv-upload" className="csv-upload-label">
                                        <div className="upload-content">
                                            <div className="upload-icon">📄</div>
                                            <div className="upload-text">
                                                <p>Click to upload</p>
                                                <span>CSV files only</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>
                                <small>Format: phone numbers only OR phone,var1,var2...</small>
                            </div>

                            {uploadedFile && (
                                <div className="file-info-card">
                                    <div className="file-details">
                                        <div className="file-icon">📊</div>
                                        <div className="file-info">
                                            <p className="file-name">{uploadedFile.name}</p>
                                            <p className="file-stats">{recipients.length} recipients found</p>
                                        </div>
                                        <button className="remove-file" onClick={() => {
                                            setUploadedFile(null);
                                            setRecipients([]);
                                        }}>
                                            ×
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button className="secondary-btn" onClick={() => setActiveTab('overview')}>Cancel</button>
                                <button 
                                    className="primary-btn" 
                                    onClick={handleSendBroadcast}
                                    disabled={isSending || !recipients.length}
                                >
                                    {isSending ? (
                                        <>
                                            <Clock size={16} className="animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            Send Campaign
                                        </>
                                    )}
                                </button>
                            </div>

                            {sendResults && (
                                <div className="results-section">
                                    <h4>Campaign Results</h4>
                                    <div className="result-stats">
                                        <div className="stat">
                                            <span className="label">Total Sent:</span>
                                            <span className="value">{sendResults.total_sent}</span>
                                        </div>
                                        <div className="stat">
                                            <span className="label">Successful:</span>
                                            <span className="value success">{sendResults.successful}</span>
                                        </div>
                                        <div className="stat">
                                            <span className="label">Failed:</span>
                                            <span className="value failed">{sendResults.total_sent - sendResults.successful}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="preview-section">
                            <h3>Message Preview</h3>
                            <div className="phone-mockup">
                                <div className="phone-header">
                                    <span className="phone-time">{getCurrentPhoneTime()}</span>
                                    <div className="phone-icons">
                                        <span className="network-icon">📶</span>
                                        <span className="signal-bars">📶</span>
                                        <span className="battery">🔋</span>
                                    </div>
                                </div>
                                
                                <div className="chat-header">
                                    <div className="chat-header-left">
                                        <span className="back-arrow">←</span>
                                        <div className="contact-info">
                                            <div className="contact-avatar">
                                                <img src={whatsappLogo} alt="WhatsApp Business" className="contact-avatar-img" />
                                            </div>
                                            <div className="contact-details">
                                                <div className="contact-name">
                                                    WhatsApp Business
                                                    <span className="verified-badge">✓</span>
                                                </div>
                                                <div className="contact-status">Online</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="chat-header-right">
                                        <span className="menu-icon">⋮</span>
                                    </div>
                                </div>

                                <div className="chat-container">
                                    <div className="date-separator">
                                        <span className="date-text">Today</span>
                                    </div>
                                    
                                    <div className="message-bubble sent">
                                        {messageType === 'template' ? (
                                            <>
                                                {templateName ? (
                                                    <>
                                                        <p className="template-content">
                                                            {getTemplatePreview()}
                                                        </p>
                                                        {recipients.length > 0 && (
                                                            <div className="recipient-preview">
                                                                <small>📱 Sending to {recipients.length} recipient(s)</small>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="placeholder-text">
                                                        Select an official template to preview
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {customMessage ? (
                                                    <>
                                                        <p className="custom-content">
                                                            {getMessagePreview()}
                                                        </p>
                                                        {recipients.length > 0 && (
                                                            <div className="recipient-preview">
                                                                <small>📱 Sending to {recipients.length} recipient(s)</small>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="placeholder-text">
                                                        Enter your custom message to preview
                                                    </p>
                                                )}
                                            </>
                                        )}
                                        <div className="message-meta">
                                            <span className="msg-time">{getCurrentTime()}</span>
                                            <span className="message-status">
                                                <span className="checkmark">✓</span>
                                                <span className="checkmark">✓</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="chat-input">
                                    <div className="input-container">
                                        <span className="emoji-icon">😊</span>
                                        <input 
                                            type="text" 
                                            className="message-input" 
                                            placeholder="Type a message"
                                            readOnly
                                        />
                                        <span className="attachment-icon">📎</span>
                                        <span className="camera-icon">📷</span>
                                        <span className="mic-icon">🎤</span>
                                    </div>
                                </div>
                            </div>
                            <div className="preview-info">
                                {messageType === 'template' ? (
                                    <div className="info-badge official">
                                        <CheckCircle size={12} />
                                        Official WhatsApp Template
                                    </div>
                                ) : (
                                    <div className="info-badge custom">
                                        <FileText size={12} />
                                        Custom Text Message
                                    </div>
                                )}
                                <div className="preview-stats">
                                    <span className="stat-item">
                                        <Users size={12} />
                                        {recipients.length} recipients
                                    </span>
                                    <span className="stat-item">
                                        <FileText size={12} />
                                        {messageType === 'template' ? 'Template' : 'Custom'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Broadcast;
