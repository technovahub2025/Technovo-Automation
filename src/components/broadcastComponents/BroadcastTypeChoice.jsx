import React from 'react';
import { ArrowLeft, X, FileText, MessageSquare, Send } from 'lucide-react';
import './Modal.css';

const BroadcastTypeChoice = ({
  showBroadcastTypeChoice,
  onClose,
  onChooseTemplate,
  onChooseCustomMessage
}) => {
  if (!showBroadcastTypeChoice) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-container broadcast-type-choice">
        <div className="popup-header">
          <div className="popup-title">
            <button 
              className="back-btn" 
              onClick={onClose}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                marginRight: '8px'
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <span>Choose Broadcast Type</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          <p className="broadcast-type-description">
            What type of message would you like to send?
          </p>
          
          <div className="broadcast-type-grid">
            <div className="broadcast-type-card" onClick={onChooseTemplate}>
              <div className="broadcast-type-icon">
                <FileText size={40} />
              </div>
              <div className="broadcast-type-content">
                <h3>Template Message</h3>
                <p>Send pre-approved WhatsApp templates for marketing, notifications, and more</p>
              </div>
            </div>

            <div className="broadcast-type-card" onClick={onChooseCustomMessage}>
              <div className="broadcast-type-icon">
                <MessageSquare size={40} />
              </div>
              <div className="broadcast-type-content">
                <h3>Custom Message</h3>
                <p>Send personalized text messages to your contacts</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastTypeChoice;
