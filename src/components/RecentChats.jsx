import React from 'react';
import { MoreHorizontal, CheckCheck, Check, Clock } from 'lucide-react';
import './RecentChats.css';

const chats = [
    { id: 1, name: 'Shahkul', message: 'Hi, I need help with my order', time: '10:30 AM', status: 'open', avatar: 'AS' },
    { id: 2, name: 'Nandha', message: 'Thanks for the quick reply!', time: '10:15 AM', status: 'resolved', avatar: 'BJ' },
    { id: 3, name: 'Lyrisha', message: 'When will the item ship?', time: '09:45 AM', status: 'pending', avatar: 'CD' },
    { id: 4, name: 'Maaran', message: 'Is this available in red?', time: 'Yesterday', status: 'open', avatar: 'DP' },
    { id: 5, name: 'Gopi', message: 'Perfect, thank you.', time: 'Yesterday', status: 'resolved', avatar: 'EW' },
];

const StatusBadge = ({ status }) => {
    const styles = {
        open: { bg: '#fff7ed', color: '#c2410c' }, // Orange
        resolved: { bg: '#ecfdf5', color: '#047857' }, // Green
        pending: { bg: '#eff6ff', color: '#1d4ed8' }, // Blue
    };
    const style = styles[status] || styles.open;

    return (
        <span className="status-badge" style={{ backgroundColor: style.bg, color: style.color }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const RecentChats = () => {
    return (
        <div className="recent-chats">
            <div className="section-header">
                <h3>Recent Conversations</h3>
                <button className="view-all-btn">View All</button>
            </div>

            <div className="chats-list">
                {chats.map((chat) => (
                    <div key={chat.id} className="chat-item">
                        <div className="chat-avatar">{chat.avatar}</div>
                        <div className="chat-content">
                            <div className="chat-top">
                                <span className="chat-name">{chat.name}</span>
                                <span className="chat-time">{chat.time}</span>
                            </div>
                            <p className="chat-message">{chat.message}</p>
                        </div>
                        <div className="chat-meta">
                            <StatusBadge status={chat.status} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentChats;
