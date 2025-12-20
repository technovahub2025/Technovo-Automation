import React from 'react';
import { Send, CheckCircle, Eye, AlertCircle, Plus } from 'lucide-react';
import StatCard from '../components/StatCard';
import RecentChats from '../components/RecentChats';
import './Dashboard.css';

const Dashboard = () => {
    return (
        <div className="dashboard">
            <div className="welcome-banner">
                <div>
                    <h1>Welcome back, Vidhyavathi! 👋</h1>
                    <p>Here's what's happening with your broadcasts today.</p>
                </div>
                <button className="primary-btn">
                    <Plus size={18} />
                    New Broadcast
                </button>
            </div>

            <div className="stats-grid">
                <StatCard
                    title="Messages Sent"
                    value="12,450"
                    change="12"
                    isPositive={true}
                    icon={Send}
                    color="#25D366"
                />
                <StatCard
                    title="Delivered"
                    value="12,280"
                    change="8"
                    isPositive={true}
                    icon={CheckCircle}
                    color="#34B7F1"
                />
                <StatCard
                    title="Read Rate"
                    value="84%"
                    change="2"
                    isPositive={false}
                    icon={Eye}
                    color="#a855f7"
                />
                <StatCard
                    title="Failed"
                    value="45"
                    change="0.5"
                    isPositive={true}
                    icon={AlertCircle}
                    color="#ef4444"
                />
            </div>

            <div className="dashboard-content-grid">
                <div className="main-chart-area">
                    {/* Placeholder for a chart or main activity feed */}
                    <RecentChats />
                </div>

                <div className="side-widgets">
                    <div className="widget-card">
                        <h3>System Status</h3>
                        <div className="status-item">
                            <span className="dot online"></span>
                            <span>WhatsApp API Connected</span>
                        </div>
                        <div className="status-item">
                            <span className="dot online"></span>
                            <span>Webhook Active</span>
                        </div>
                    </div>

                    <div className="widget-card">
                        <h3>Broadcasting Now</h3>
                        <div className="broadcast-item">
                            <span className="broadcast-name">Summer Sale Promo</span>
                            <div className="progress-bar">
                                <div className="fill" style={{ width: '65%' }}></div>
                            </div>
                            <span className="broadcast-meta">3,400 / 5,200 sent</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
