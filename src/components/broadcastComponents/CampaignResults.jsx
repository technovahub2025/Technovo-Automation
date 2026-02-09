import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Download, 
  Search,
  RefreshCw,
  Phone,
  MessageCircle,
  BarChart3,
  Activity,
  Eye,
  EyeOff,
  Copy,
  AlertTriangle
} from 'lucide-react';
import './CampaignResults.css';

const CampaignResults = ({ results, broadcastId, onRetry }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetails, setShowDetails] = useState(true);
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Calculate advanced metrics
  const metrics = useMemo(() => {
    if (!results?.results) return null;
    
    const total = results.total_sent || 0;
    const successful = results.successful || 0;
    const failed = results.failed || 0;
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : 0;
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : 0;
    
    return {
      total,
      successful,
      failed,
      successRate,
      failureRate
    };
  }, [results]);

  // Filter and search results
  const filteredResults = useMemo(() => {
    if (!results?.results) return [];
    
    return results.results.filter(result => {
      const matchesSearch = result.phone.includes(searchTerm) || 
                           (result.response && JSON.stringify(result.response).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = statusFilter === 'all' || 
                           (statusFilter === 'success' && result.success) ||
                           (statusFilter === 'failed' && !result.success);
      return matchesSearch && matchesFilter;
    });
  }, [results, searchTerm, statusFilter]);

  const handleSelectAll = () => {
    if (selectedRows.size === filteredResults.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredResults.map((_, index) => index)));
    }
  };

  const handleSelectRow = (index) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const exportSelected = () => {
    const selectedData = filteredResults.filter((_, index) => selectedRows.has(index));
    const csv = [
      'phone,status,timestamp,response',
      ...selectedData.map(result => 
        `${result.phone},${result.success ? 'success' : 'failed'},${new Date().toISOString()},"${result.success ? (result.response?.messages?.[0]?.id || 'Sent') : (result.error || 'Failed')}"`
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_results_selected_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyPhoneNumbers = () => {
    const phones = filteredResults.map(result => result.phone).join('\n');
    navigator.clipboard.writeText(phones);
  };

  const getStatusIcon = (success) => {
    return success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;
  };

  if (!metrics) return null;

  return (
    <div className="campaign-results">
      {/* Header */}
      <div className="campaign-results-header">
        <div className="campaign-results-title">
          <div className="metric-icon total">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2>Campaign Results</h2>
            <p>Advanced analytics and detailed insights</p>
          </div>
        </div>
        <div className="action-buttons">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="action-btn"
            title={showDetails ? "Hide details" : "Show details"}
          >
            {showDetails ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="action-btn"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card total">
          <div className="metric-info">
            <h3>Total Sent</h3>
            <div className="value">{metrics.total}</div>
          </div>
          <div className="metric-icon total">
            <MessageCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-info">
            <h3>Successful</h3>
            <div className="value">{metrics.successful}</div>
            <p className="subtitle">{metrics.successRate}% success rate</p>
          </div>
          <div className="metric-icon success">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="metric-card failed">
          <div className="metric-info">
            <h3>Failed</h3>
            <div className="value">{metrics.failed}</div>
            <p className="subtitle">{metrics.failureRate}% failure rate</p>
          </div>
          <div className="metric-icon failed">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="metric-card performance">
          <div className="metric-info">
            <h3>Performance</h3>
            <div className="value">
              {metrics.successRate >= 90 ? 'Excellent' : 
               metrics.successRate >= 70 ? 'Good' : 
               metrics.successRate >= 50 ? 'Fair' : 'Poor'}
            </div>
            <p className="subtitle">{metrics.successRate}% success</p>
          </div>
          <div className="metric-icon performance">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span>Campaign Progress</span>
          <span>{metrics.successful}/{metrics.total} completed</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${metrics.successRate}%` }}
          ></div>
        </div>
        <div className="progress-legend">
          <span className="success">
            <div className="dot"></div>
            Success: {metrics.successful}
          </span>
          <span className="failed">
            <div className="dot"></div>
            Failed: {metrics.failed}
          </span>
        </div>
      </div>

      {/* Detailed Results Table */}
      {showDetails && (
        <div className="detailed-results">
          {/* Controls */}
          <div className="results-controls">
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search phone numbers or responses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
            </select>

            <div className="action-buttons">
              {selectedRows.size > 0 && (
                <>
                  <button
                    onClick={exportSelected}
                    className="btn btn-primary"
                  >
                    <Download className="w-4 h-4" />
                    Export Selected ({selectedRows.size})
                  </button>
                  <button
                    onClick={copyPhoneNumbers}
                    className="btn btn-secondary"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Numbers
                  </button>
                </>
              )}
              <button
                onClick={() => onRetry && onRetry()}
                className="btn btn-success"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Failed
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="results-table">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredResults.length && filteredResults.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Phone Number</th>
                    <th>Status</th>
                    <th>Response</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(index)}
                          onChange={() => handleSelectRow(index)}
                        />
                      </td>
                      <td>
                        <div className="phone-cell">
                          <Phone className="w-4 h-4" />
                          <span>{result.phone}</span>
                        </div>
                      </td>
                      <td>
                        <div className={`status-badge ${result.success ? 'success' : 'failed'}`}>
                          {getStatusIcon(result.success)}
                          <span>{result.success ? 'Success' : 'Failed'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="response-cell">
                          {result.success ? (
                            <span className="success">
                              {result.response?.messages?.[0]?.id || 'Message sent successfully'}
                            </span>
                          ) : (
                            <span className="failed">
                              {result.error || 'Failed to send'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="actions-cell">
                          {!result.success && (
                            <button
                              onClick={() => onRetry && onRetry([result])}
                              className="action-btn retry"
                              title="Retry this number"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            className="action-btn view"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredResults.length === 0 && (
                <div className="no-results">
                  <AlertTriangle className="w-12 h-12" />
                  <p>No results found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignResults;
