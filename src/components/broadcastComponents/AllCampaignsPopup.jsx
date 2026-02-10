import React from 'react';
import { X, Search, Filter, LineChart, Eye, PauseCircle, PlayCircle, Trash, FileText } from 'lucide-react';
import BroadcastCard from './BroadcastCard';
import './Modal.css';

const AllCampaignsPopup = ({
  showAllCampaignsPopup,
  broadcasts,
  filteredBroadcasts,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showFilterDropdown,
  onFilterDropdownToggle,
  onClose,
  getReadPercentage,
  getStatusClass,
  onStopBroadcast,
  onDeleteClick
}) => {
  if (!showAllCampaignsPopup) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content all-campaigns-popup" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>All Campaigns ({broadcasts.length})</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="popup-controls">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={onSearchChange}
              />
            </div>
            
            <div className="filter-dropdown">
              <button className="icon-btn" onClick={onFilterDropdownToggle} title="Filter campaigns">
                <Filter size={18} />
              </button>
              
              {showFilterDropdown && (
                <div className="filter-menu">
                  <div className="filter-section">
                    <h4>Status</h4>
                    <div className="filter-options">
                      {['all', 'scheduled', 'sending', 'completed'].map((status) => (
                        <label className="filter-option" key={status}>
                          <input
                            type="radio"
                            name="status"
                            value={status}
                            checked={statusFilter === status}
                            onChange={(e) => onStatusFilterChange(e.target.value)}
                          />
                          {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="campaigns-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Status</th>
                  <th>Scheduled Time</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Read</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBroadcasts.map((broadcast) => (
                  <tr key={broadcast._id}>
                    <td>{broadcast.name}</td>
                    <td>
                      <span className={`badge ${getStatusClass(broadcast.status)}`}>{broadcast.status}</span>
                    </td>
                    <td>
                      {broadcast.scheduledAt ? 
                        `${broadcast.name} (${new Date(broadcast.scheduledAt + 'Z').toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: 'UTC'
                        })})` : `${broadcast.name} (Immediate)`
                      }
                    </td>
                    <td>{broadcast.recipientCount || broadcast.recipients?.length || 0}</td>
                    <td>{broadcast.stats?.sent || 0}</td>
                    <td>{broadcast.stats?.delivered || 0}</td>
                    <td>
                      <span className={`read-count ${broadcast.stats?.read > 0 ? 'has-reads' : ''}`}>
                        {broadcast.stats?.read || 0}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" title="View Analytics">
                          <BarChart size={14} />
                        </button>
                        
                        <div className="eye-icon-container">
                          <button 
                            className="action-btn" 
                            title={`${broadcast.stats?.read || 0} members read this message`}
                          >
                            <Eye size={14} />
                          </button>
                          <div className="read-count-tooltip">
                            <div className="tooltip-content">
                              <div className="tooltip-header">
                                <Eye size={12} />
                                <span>Read Statistics</span>
                              </div>
                              <div className="tooltip-stats">
                                <div className="stat-row">
                                  <span className="stat-label">Read:</span>
                                  <span className="stat-value">{broadcast.stats?.read || 0}</span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Sent:</span>
                                  <span className="stat-value">{broadcast.stats?.sent || 0}</span>
                                </div>
                                <div className="stat-row">
                                  <span className="stat-label">Rate:</span>
                                  <span className="stat-value">{getReadPercentage(broadcast)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {broadcast.status === 'scheduled' && (
                          <>
                            <button className="action-btn stop-btn" title="Stop Campaign" onClick={() => {
                              onStopBroadcast(broadcast._id);
                              onClose();
                            }}>
                              <Square size={14} />
                            </button>
                            
                            <button className="action-btn delete-btn" title="Delete Campaign" onClick={() => {
                              onDeleteClick(broadcast);
                              onClose();
                            }}>
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredBroadcasts.length === 0 && (
            <div className="no-campaigns-in-popup">
              <FileText size={48} />
              <h4>No campaigns found</h4>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AllCampaignsPopup;
