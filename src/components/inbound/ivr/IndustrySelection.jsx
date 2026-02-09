import React, { useState } from 'react';
import { Plus, ArrowLeft } from 'lucide-react';
import { INDUSTRY_TEMPLATES, getAllIndustries } from '../../../config/industryTemplates';
import './IndustrySelection.css';

const IndustrySelection = ({ onIndustrySelect, onBack }) => {
  const [customIndustry, setCustomIndustry] = useState('');
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  
  const handleIndustrySelect = (industry) => {
    onIndustrySelect({
      ...industry,
      type: industry.key
    });
  };
  
  const handleCustomIndustry = () => {
    if (customIndustry.trim()) {
      const customIndustryData = {
        name: customIndustry,
        icon: '⚙️',
        type: 'custom',
        description: `Custom IVR workflow for ${customIndustry}`,
        defaultFlow: {
          greeting: `Welcome to our ${customIndustry} service. How can I help you today?`,
          nodes: [
            {
              id: "greeting_1",
              type: "greeting",
              position: { x: 100, y: 50 },
              data: {
                text: `Welcome to our ${customIndustry} service. How can I help you today?`,
                voice: "en-US-AriaNeural",
                language: "en-US"
              }
            }
          ],
          edges: []
        }
      };
      
      onIndustrySelect(customIndustryData);
      setCustomIndustry('');
      setIsCreatingCustom(false);
    }
  };
  
  const industries = getAllIndustries();
  
  return (
    <div className="industry-selection">
      <div className="industry-header">
        <div className="header-content">
          {onBack && (
            <button onClick={onBack} className="back-btn">
              <ArrowLeft size={20} />
              Back to IVR List
            </button>
          )}
          <div className="header-text">
            <h2>Create New IVR Configuration</h2>
            <p>Choose an industry template or create a custom workflow</p>
          </div>
        </div>
      </div>
      
      <div className="industry-grid">
        {industries.map((industry) => (
          <div 
            key={industry.key}
            className="industry-card"
            onClick={() => handleIndustrySelect(industry)}
          >
            <div className="industry-icon">{industry.icon}</div>
            <div className="industry-content">
              <h3>{industry.name}</h3>
              <p>{industry.description}</p>
              <div className="industry-stats">
                <span className="node-count">
                  {industry.defaultFlow.nodes.length} nodes
                </span>
                <span className="connection-count">
                  {industry.defaultFlow.edges.length} connections
                </span>
              </div>
            </div>
            <div className="industry-arrow">
              <Plus size={20} />
            </div>
          </div>
        ))}
        
        <div className="industry-card custom">
          <div className="industry-icon">⚙️</div>
          <div className="industry-content">
            <h3>Custom Industry</h3>
            {isCreatingCustom ? (
              <div className="custom-input">
                <input 
                  type="text"
                  placeholder="Enter industry name..."
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomIndustry()}
                  className="custom-industry-input"
                  autoFocus
                />
                <div className="custom-actions">
                  <button 
                    onClick={handleCustomIndustry} 
                    className="btn btn-primary"
                    disabled={!customIndustry.trim()}
                  >
                    Create
                  </button>
                  <button 
                    onClick={() => {
                      setIsCreatingCustom(false);
                      setCustomIndustry('');
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>Create a custom workflow for any industry</p>
                <button 
                  onClick={() => setIsCreatingCustom(true)}
                  className="btn btn-outline"
                >
                  <Plus size={16} />
                  Create Custom
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="industry-features">
        <h3>🚀 Features Included</h3>
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-icon">🎯</span>
            <div className="feature-content">
              <h4>Industry-Specific Workflows</h4>
              <p>Pre-configured nodes and flows for your industry</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">👥</span>
            <div className="feature-content">
              <h4>Real-time Collaboration</h4>
              <p>Multiple users can edit workflows simultaneously</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🧪</span>
            <div className="feature-content">
              <h4>Live Testing</h4>
              <p>Test workflows before deployment</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔌</span>
            <div className="feature-content">
              <h4>AI Integration</h4>
              <p>Powered by Python AI service for intelligent responses</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <div className="feature-content">
              <h4>Analytics & Monitoring</h4>
              <p>Track performance and call metrics</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🌍</span>
            <div className="feature-content">
              <h4>Multi-language Support</h4>
              <p>English, Tamil, and Hindi language options</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndustrySelection;
