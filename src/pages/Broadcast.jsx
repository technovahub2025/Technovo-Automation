import React, { useState } from 'react';
import { Plus, Clock, CheckCircle, Calendar, Users, FileText } from 'lucide-react';
import './Broadcast.css';

const Broadcast = () => {
    const [activeTab, setActiveTab] = useState('overview');

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
                    <div className="form-section">
                        <h3>Configure Campaign</h3>

                        <div className="form-group">
                            <label>Broadcast Name</label>
                            <input type="text" placeholder="e.g. Diwali Promo 2024" />
                        </div>

                        <div className="form-group">
                            <label><FileText size={16} /> Select Template</label>
                            <select>
                                <option>Select a template...</option>
                                <option>summer_sale_promo_v1</option>
                                <option>order_confirmation</option>
                                <option>shipping_update</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label><Users size={16} /> Select Audience</label>
                            <div className="audience-options">
                                <label className="radio-option">
                                    <input type="radio" name="audience" defaultChecked />
                                    <span>All Contacts</span>
                                </label>
                                <label className="radio-option">
                                    <input type="radio" name="audience" />
                                    <span>Filter by Tags</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-group">
                            <label><Calendar size={16} /> Schedule Time</label>
                            <input type="datetime-local" />
                            <p className="help-text">Leave empty to send immediately.</p>
                        </div>

                        <div className="form-actions">
                            <button className="secondary-btn" onClick={() => setActiveTab('overview')}>Cancel</button>
                            <button className="primary-btn">Schedule Campaign</button>
                        </div>
                    </div>

                    <div className="preview-section">
                        <h3>Message Preview</h3>
                        <div className="phone-mockup">
                            <div className="message-bubble">
                                <p>Hello <strong>Alice</strong>, our Summer Sale is now live! Get up to 50% off on all items. Shop now: bit.ly/345345</p>
                                <span className="msg-time">10:00 AM</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Broadcast;
