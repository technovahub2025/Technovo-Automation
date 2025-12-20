import React from 'react';
import { Search, Filter, Paperclip, Send, Smile } from 'lucide-react';
import './TeamInbox.css';

const contacts = [
    { id: 1, name: 'Shahkul', message: 'Hi, I need help with my order', time: '10:30 AM', unread: 2 },
    { id: 2, name: 'Nandha', message: 'Thanks for the quick reply!', time: '10:15 AM', unread: 0 },
    { id: 3, name: 'Lyrisha', message: 'When will the item ship?', time: '09:45 AM', unread: 0 },
    { id: 4, name: 'Maaran', message: 'Is this available in red?', time: 'Yesterday', unread: 1 },
    { id: 5, name: 'Gobinath', message: 'Is this available in red?', time: 'Yesterday', unread: 1 },

];

const TeamInbox = () => {
    return (
        <div className="inbox-container">
            <div className="inbox-sidebar">
                <div className="inbox-header">
                    <h2>Team Inbox</h2>
                    <div className="inbox-actions">
                        <button className="icon-btn"><Search size={18} /></button>
                        <button className="icon-btn"><Filter size={18} /></button>
                    </div>
                </div>

                <div className="conversation-list">
                    {contacts.map(contact => (
                        <div key={contact.id} className={`conversation-item ${contact.id === 1 ? 'active' : ''}`}>
                            <div className="avatar">{contact.name.charAt(0)}</div>
                            <div className="conversation-info">
                                <div className="conversation-top">
                                    <span className="name">{contact.name}</span>
                                    <span className="time">{contact.time}</span>
                                </div>
                                <div className="conversation-bottom">
                                    <p className="preview">{contact.message}</p>
                                    {contact.unread > 0 && <span className="unread-badge">{contact.unread}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="chat-area">
                <div className="chat-header">
                    <div className="avatar">A</div>
                    <div className="chat-header-info">
                        <span className="name">Shahkul</span>
                        <span className="status">Online</span>
                    </div>
                    <div className="chat-header-actions">
                        <button className="resolve-btn">Resolve</button>
                    </div>
                </div>

                <div className="chat-messages">
                    <div className="message incoming">
                        <div className="bubble">Hi, I need help with my order #12345.</div>
                        <span className="timestamp">10:30 AM</span>
                    </div>
                    <div className="message outgoing">
                        <div className="bubble">Hello Alice! I'd be happy to help you with that. Let me check the status.</div>
                        <span className="timestamp">10:32 AM</span>
                    </div>
                </div>

                <div className="chat-input-area">
                    <button className="attach-btn"><Paperclip size={20} /></button>
                    <input type="text" placeholder="Type a message..." />
                    <button className="emoji-btn"><Smile size={20} /></button>
                    <button className="send-btn"><Send size={18} /></button>
                </div>
            </div>
        </div>
    );
};

export default TeamInbox;
