import React from 'react';
import { X, RefreshCw, FileText } from 'lucide-react';
import './Modal.css';

const CsvPreviewPopup = ({
  showCsvPreview,
  uploadedFile,
  recipients,
  onClose,
  onReplaceCsv
}) => {
  if (!showCsvPreview) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-container csv-preview-popup">
        <div className="popup-header">
          <div className="popup-title">
            <FileText size={24} />
            <span>CSV Preview</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          <div className="csv-preview-info">
            <p><strong>File:</strong> {uploadedFile?.name}</p>
            <p><strong>Total Recipients:</strong> {recipients.length}</p>
            <p><strong>Showing:</strong> First 5 rows</p>
          </div>

          <div className="csv-table-container">
            <table className="csv-preview-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Variables</th>
                </tr>
              </thead>
              <tbody>
                {recipients.slice(0, 5).map((recipient, index) => (
                  <tr key={index}>
                    <td>{recipient.phone || ''}</td>
                    <td>
                      {(() => {
                        const varKeys = Object.keys(recipient)
                          .filter(key => key.toLowerCase().startsWith('var'))
                          .sort((a, b) => {
                            const aNum = parseInt(a.replace('var', '')) || 0;
                            const bNum = parseInt(b.replace('var', '')) || 0;
                            return aNum - bNum;
                          });
                        
                        const varValues = varKeys.map(key => recipient[key] || '').filter(val => val !== '');
                        return varValues.join(', ');
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recipients.length > 5 && (
            <p className="preview-note">
              ... and {recipients.length - 5} more rows
            </p>
          )}
        </div>

        <div className="popup-footer">
          <button 
            className="replace-btn" 
            onClick={onReplaceCsv}
          >
            <RefreshCw size={16} />
            Replace CSV
          </button>
          <button className="primary-btn" onClick={onClose}>
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default CsvPreviewPopup;
