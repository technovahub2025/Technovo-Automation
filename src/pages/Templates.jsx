import React from 'react';
import { Plus, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import './Templates.css';

const Templates = () => {
    return (
        <div className="templates-page">
            <div className="page-header">
                <div>
                    <h2>Message Templates</h2>
                    <p>Create and manage your WhatsApp message templates</p>
                </div>
                <button className="primary-btn">
                    <Plus size={18} />
                    New Template
                </button>
            </div>

            <div className="templates-filters">
                <button className="filter-btn active">All</button>
                <button className="filter-btn">Marketing</button>
                <button className="filter-btn">Utility</button>
                <button className="filter-btn">Authentication</button>
            </div>

            <div className="templates-grid">
                <div className="template-card">
                    <div className="card-header">
                        <span className="template-name">summer_sale_promo_v1</span>
                        <span className="status-badge approved"><CheckCircle size={12} /> Approved</span>
                    </div>
                    <p className="template-content">
                        Hello &#123;&#123;1&#125;&#125;, our Summer Sale is now live! Get up to 50% off on all items. Shop now: &#123;&#123;2&#125;&#125;
                    </p>
                    <div className="card-footer">
                        <span className="lang-tag">English (US)</span>
                        <span className="category-tag">Marketing</span>
                    </div>
                </div>

                <div className="template-card">
                    <div className="card-header">
                        <span className="template-name">order_confirmation</span>
                        <span className="status-badge approved"><CheckCircle size={12} /> Approved</span>
                    </div>
                    <p className="template-content">
                        Hi &#123;&#123;1&#125;&#125;, your order #&#123;&#123;2&#125;&#125; has been confirmed! We will notify you when it ships.
                    </p>
                    <div className="card-footer">
                        <span className="lang-tag">English (US)</span>
                        <span className="category-tag">Utility</span>
                    </div>
                </div>

                <div className="template-card">
                    <div className="card-header">
                        <span className="template-name">shipping_update</span>
                        <span className="status-badge pending"><Clock size={12} /> Pending</span>
                    </div>
                    <p className="template-content">
                        Your package is on its way! Track it here: &#123;&#123;1&#125;&#125;
                    </p>
                    <div className="card-footer">
                        <span className="lang-tag">Spanish</span>
                        <span className="category-tag">Utility</span>
                    </div>
                </div>

                <div className="template-card">
                    <div className="card-header">
                        <span className="template-name">account_otp</span>
                        <span className="status-badge rejected"><AlertCircle size={12} /> Rejected</span>
                    </div>
                    <p className="template-content">
                        Do not share this code. Your OTP is &#123;&#123;1&#125;&#125;.
                    </p>
                    <div className="card-footer">
                        <span className="lang-tag">English (US)</span>
                        <span className="category-tag">calc_auth</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Templates;
