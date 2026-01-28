import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import './StatCard.css';

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }) => {
    return (
        <div className="stat-card-main">
            <div className="stat-header">
                <div className="stat-info">
                    <span className="stat-title">{title}</span>
                    <h3 className="stat-value">{value}</h3>
                </div>
                <div className="stat-icon" style={{ backgroundColor: `${color}20`, color: color }}>
                    <Icon size={24} />
                </div>
            </div>
            <div className="stat-footer">
                <span className={`stat-change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    {change}%
                </span>
                <span className="stat-period">vs last month</span>
            </div>
        </div>
    );
};

export default StatCard;
