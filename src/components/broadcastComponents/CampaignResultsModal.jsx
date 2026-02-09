import React from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const CampaignResultsModal = ({ isOpen, onClose, results }) => {
  if (!isOpen || !results) return null;

  const { total_sent, successful, failed, delivered = 0, read = 0 } = results;

  return (
    <div className="modal-overlay">
      <div className="campaign-results-modal">
        <div className="modal-header">
          <h3>Campaign Results</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="results-summary">
            <div className="result-item total">
              <div className="result-icon">
                <AlertCircle size={24} />
              </div>
              <div className="result-info">
                <span className="result-label">Total Messages</span>
                <span className="result-value">{total_sent || 0}</span>
              </div>
            </div>

            <div className="result-item success">
              <div className="result-icon">
                <CheckCircle size={24} />
              </div>
              <div className="result-info">
                <span className="result-label">Successfully Sent</span>
                <span className="result-value">{successful || 0}</span>
              </div>
            </div>

            <div className="result-item failed">
              <div className="result-icon">
                <XCircle size={24} />
              </div>
              <div className="result-info">
                <span className="result-label">Failed</span>
                <span className="result-value">{failed || 0}</span>
              </div>
            </div>

            {(delivered > 0 || read > 0) && (
              <div className="additional-stats">
                {delivered > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Delivered:</span>
                    <span className="stat-value">{delivered}</span>
                  </div>
                )}
                {read > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Read:</span>
                    <span className="stat-value">{read}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {failed > 0 && (
            <div className="warning-message">
              <AlertCircle size={16} />
              <span>{failed} messages failed to deliver. Please check the recipient numbers and try again.</span>
            </div>
          )}

          {successful > 0 && (
            <div className="success-message">
              <CheckCircle size={16} />
              <span>Campaign completed successfully! {successful} messages were sent.</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignResultsModal;
