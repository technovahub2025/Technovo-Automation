import React from 'react';
import { MessageSquare, Zap, GitBranch } from 'lucide-react';
import './Automation.css';

const Automation = () => {
    return (
        <div className="automation-page">
            <div className="page-header">
                <div>
                    <h2>Automation</h2>
                    <p>Setup chatbots and automated replies</p>
                </div>
            </div>

            <div className="automation-grid">
                <div className="automation-card">
                    <div className="card-icon blue">
                        <MessageSquare size={24} />
                    </div>
                    <h3>Default Reply</h3>
                    <p>Set a message to be sent when no other automation matches.</p>
                    <button className="card-btn">Configure</button>
                </div>

                <div className="automation-card">
                    <div className="card-icon green">
                        <Zap size={24} />
                    </div>
                    <h3>Keyword Action</h3>
                    <p>Trigger specific replies or actions based on keywords.</p>
                    <button className="card-btn">Configure</button>
                </div>

                <div className="automation-card">
                    <div className="card-icon purple">
                        <GitBranch size={24} />
                    </div>
                    <h3>Flow Builder</h3>
                    <p>Build complex conversation flows with drag-and-drop.</p>
                    <button className="card-btn">Open Builder</button>
                </div>
            </div>
        </div>
    );
};

export default Automation;
