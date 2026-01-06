import React, { useState } from 'react';
import './EmailAutomation.css';
import PDFExtractor from './PDFExtractor';
import { FileText, Type, CheckCircle, Clock } from 'lucide-react';

const EmailAutomation = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notification, setNotification] = useState(null);
  const extractionHistory = [
    { id: 1, filename: 'report1.pdf', date: '2025-12-30', keywords: 15, score: 8.5 },
    { id: 2, filename: 'analysis.pdf', date: '2025-12-29', keywords: 12, score: 7.2 },
    { id: 3, filename: 'summary.pdf', date: '2025-12-28', keywords: 18, score: 9.1 },
    { id: 4, filename: 'data.pdf', date: '2025-12-27', keywords: 20, score: 8.8 },
    { id: 5, filename: 'overview.pdf', date: '2025-12-26', keywords: 14, score: 7.9 },
    { id: 6, filename: 'metrics.pdf', date: '2025-12-25', keywords: 16, score: 8.3 },
  ];

  const stats = [
    { label: 'Total Extractions', value: '24', change: '+12%', icon: FileText, color: '#3b82f6' },
    { label: 'Avg. Keywords', value: '15.3', change: '+5%', icon: Type, color: '#8b5cf6' },
    { label: 'Success Rate', value: '98.5%', change: '+2%', icon: CheckCircle, color: '#10b981' },
    { label: 'Processing Time', value: '2.3s', change: '-15%', icon: Clock, color: '#f59e0b' },
  ];

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleViewHistory = () => {
    setShowFullHistory(!showFullHistory);
  };

  const handleExportReports = async () => {
    setIsExporting(true);
    try {
      const csvContent = [
        ['Filename', 'Date', 'Keywords', 'Score'],
        ...extractionHistory.map(item => [
          item.filename,
          item.date,
          item.keywords,
          item.score
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extraction-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification('Report exported successfully!');
    } catch (error) {
      showNotification('Failed to export report', 'error');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="email-automation">
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="automation-header">
        <div className="header-left">
          <h1>Email Automation Dashboard</h1>
        </div>
        <div className="tab-navigation">
          <button
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`tab-btn ${activeTab === 'extractor' ? 'active' : ''}`}
            onClick={() => setActiveTab('extractor')}
          >
            PDF Extractor
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="automation-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-view">
            {/* Stats Cards */}
            <div className="stats-grid">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="stat-card">
                    <div className="stat-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <h3>{stat.label}</h3>
                      <div className="stat-icon-wrapper" style={{ backgroundColor: `${stat.color}20`, padding: '8px', borderRadius: '8px', color: stat.color }}>
                        <Icon size={20} />
                      </div>
                    </div>
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-change positive">{stat.change}</div>
                  </div>
                )
              })}
            </div>

            {/* Recent Activity */}
            <div className="activity-section">
              <div className="section-card">
                <div className="section-header">
                  <h2>Recent Extractions</h2>
                  <span className="history-count">
                    {showFullHistory ? `Showing ${extractionHistory.length} items` : `Showing 3 of ${extractionHistory.length} items`}
                  </span>
                </div>
                <div className="activity-list">
                  {extractionHistory.slice(0, showFullHistory ? extractionHistory.length : 3).map((item) => (
                    <div key={item.id} className="activity-item">
                      <div className="activity-info">
                        <div className="filename">{item.filename}</div>
                        <div className="date">{item.date}</div>
                      </div>
                      <div className="activity-stats">
                        <span className="keywords">{item.keywords} keywords</span>
                        <span className="score">Score: {item.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <div className="section-card">
                <h2>Quick Actions</h2>
                <div className="action-buttons">
                  <button
                    className="action-btn primary"
                    onClick={() => setActiveTab('extractor')}
                  >
                    Extract New PDF
                  </button>
                  <button className="action-btn secondary" onClick={handleViewHistory}>
                    {showFullHistory ? 'Hide History' : 'View History'}
                  </button>
                  <button
                    className="action-btn secondary"
                    onClick={handleExportReports}
                    disabled={isExporting}
                  >
                    {isExporting ? 'Exporting...' : 'Export Reports'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'extractor' && (
          <div className="extractor-view">
            <PDFExtractor />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailAutomation;
