import React, { useState, useEffect } from 'react';
import { MoreHorizontal, CheckCheck, Check, Clock, MessageCircle } from 'lucide-react';
import { whatsappService } from '../services/whatsappService';
import './RecentChats.css';

const RecentChats = () => {
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadRecentConversations();
    }, []);

    const loadRecentConversations = async () => {
        try {
            setLoading(true);
            const conversations = await whatsappService.getConversations();
            
            // Get the 5 most recent conversations (same as TeamInbox)
            const recentConversations = conversations
                .sort((a, b) => new Date(b.lastMessageTime || b.createdAt) - new Date(a.lastMessageTime || a.createdAt))
                .slice(0, 5);
            
            // Transform conversation data to match TeamInbox format
            const formattedChats = recentConversations.map(conv => ({
                id: conv._id,
                name: conv.contactId?.name || conv.contactPhone || 'Unknown',
                message: conv.lastMessage || 'No messages yet',
                time: formatTime(conv.lastMessageTime || conv.createdAt),
                status: conv.status || 'open',
                avatar: getInitials(conv.contactId?.name || conv.contactPhone || 'Unknown'),
                unreadCount: conv.unreadCount || 0,
                phoneNumber: conv.contactPhone,
                // Additional TeamInbox fields
                contactId: conv.contactId,
                lastMessageTime: conv.lastMessageTime,
                createdAt: conv.createdAt
            }));
            
            setChats(formattedChats);
        } catch (error) {
            console.error('Failed to load recent conversations:', error);
            setError('Failed to load conversations');
            // Fallback to mock data if API fails
            setChats([
                { id: 1, name: 'Shahkul', message: 'Hi, I need help with my order', time: '10:30 AM', status: 'open', avatar: 'AS' },
                { id: 2, name: 'Nandha', message: 'Thanks for the quick reply!', time: '10:15 AM', status: 'resolved', avatar: 'BJ' },
                { id: 3, name: 'Lyrisha', message: 'When will the item ship?', time: '09:45 AM', status: 'pending', avatar: 'CD' },
                { id: 4, name: 'Maaran', message: 'Is this available in red?', time: 'Yesterday', status: 'open', avatar: 'DP' },
                { id: 5, name: 'Gopi', message: 'Perfect, thank you.', time: 'Yesterday', status: 'resolved', avatar: 'EW' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return 'No time';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        // Use same format as TeamInbox for consistency
        if (diffInHours < 24) {
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    };

    const getInitials = (name) => {
        if (!name) return '??';
        const words = name.split(' ');
        if (words.length >= 2) {
            return words[0][0].toUpperCase() + words[1][0].toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="recent-chats">
                <div className="section-header">
                    <h3>Recent Conversations</h3>
                    <button className="view-all-btn">View All</button>
                </div>
                <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <p>Loading conversations...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="recent-chats">
                <div className="section-header">
                    <h3>Recent Conversations</h3>
                    <button className="view-all-btn" onClick={loadRecentConversations}>Retry</button>
                </div>
                <div className="error-state">
                    <MessageCircle size={24} />
                    <p>{error}</p>
                </div>
            </div>
        );
    }

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

    return (
        <div className="recent-chats">
            <div className="section-header">
                <h3>Recent Conversations</h3>
                <button className="view-all-btn" onClick={() => window.location.href = '/inbox'}>View All</button>
            </div>

            <div className="chats-list">
                {chats.map((chat) => (
                    <div 
                        key={chat.id} 
                        className="chat-item"
                    >
                        <div className="chat-avatar">
                            {chat.avatar}
                            {chat.unreadCount > 0 && (
                                <span className="unread-badge">{chat.unreadCount}</span>
                            )}
                        </div>
                        <div className="chat-content">
                            <div className="chat-top">
                                <span className="chat-name">{chat.name}</span>
                                <span className="chat-time">{chat.time}</span>
                            </div>
                            <p className="chat-message">{chat.message}</p>
                            {chat.phoneNumber && (
                                <span className="chat-phone">{chat.phoneNumber}</span>
                            )}
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
