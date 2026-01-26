import React, { useState, useEffect } from 'react';
import { Upload, Send, FileText, AlertCircle, CheckCircle, Download, X, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import CampaignResults from './CampaignResults';
import './BulkMessaging.css';

const BulkMessaging = () => {
  const [messageType, setMessageType] = useState('template');
  const [templateName, setTemplateName] = useState('');
  const [language, setLanguage] = useState('en_US');
  const [customMessage, setCustomMessage] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [broadcastName, setBroadcastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const result = await api.getTemplates();
      setTemplates(result.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      const result = await api.syncTemplates();
      if (result.success) {
        await fetchTemplates();
      }
    } catch (error) {
      console.error('Error syncing templates:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      // Preview CSV
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          alert('CSV file is empty');
          return;
        }

        // Parse CSV properly
        const headers = lines[0].split(',').map(header => header.trim());
        const parsedRecipients = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(value => value.trim());
          if (values.length > 0 && values[0]) { // Ensure phone number exists
            const recipient = {
              phone: values[0],
              variables: values.slice(1), // All values after phone are variables
              fullData: {}
            };
            
            // Create fullData object with all headers
            headers.forEach((header, headerIndex) => {
              recipient.fullData[header] = values[headerIndex] || '';
            });
            
            parsedRecipients.push(recipient);
          }
        }
        
        setCsvPreview(lines);
        setRecipients(parsedRecipients);
      };
      reader.readAsText(file);
    }
  };

  const removeFile = () => {
    setCsvFile(null);
    setCsvPreview([]);
    setRecipients([]);
    // Clear the file input
    const fileInput = document.getElementById('csv-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const validateForm = () => {
    if (!csvFile) {
      alert('Please upload a CSV file');
      return false;
    }

    if (messageType === 'template' && !templateName) {
      alert('Please select a template');
      return false;
    }

    if (messageType === 'text' && !customMessage.trim()) {
      alert('Please enter a custom message');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setResults(null);

    try {
      // First upload CSV to get recipients
      const uploadResult = await api.uploadCSV(csvFile);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload CSV');
      }

      // Then send bulk messages
      const bulkData = {
        messageType: messageType,
        recipients: uploadResult.data?.csvData || uploadResult.recipients || [],
        ...(messageType === 'template' 
          ? { templateName, language }
          : { customMessage }
        ),
        broadcastName: broadcastName || `Bulk Send - ${new Date().toLocaleString()}`
      };

      const sendResult = await api.sendBulkMessages(bulkData);
      setResults(sendResult);
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      setResults({
        success: false,
        message: error.message || 'Failed to send bulk messages'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results || !results.results) return;

    let csv = 'phone,status,response\n';
    results.results.forEach(result => {
      const status = result.success ? 'success' : 'failed';
      const response = result.response ? JSON.stringify(result.response) : result.error || '';
      csv += `${result.phone},${status},"${response}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_results_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `phone,var1,var2
+1234567890,John,Doe
+1987654321,Jane,Smith
+1122334456,Bob,Johnson`;
    
    const blob = new Blob([sampleCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_bulk_messaging.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bulk-messaging">
      <div className="bulk-messaging-header">
        <h2>Bulk Messaging</h2>
        <p>Send personalized messages to multiple contacts at once</p>
      </div>

      <form onSubmit={handleSubmit} className="bulk-messaging-form">
        {/* Broadcast Name */}
        <div className="form-group">
          <label className="form-label">Broadcast Name</label>
          <input
            type="text"
            value={broadcastName}
            onChange={(e) => setBroadcastName(e.target.value)}
            placeholder="Enter broadcast name (optional)"
            className="form-input"
          />
        </div>

        {/* Message Type */}
        <div className="form-group">
          <label className="form-label">Message Type</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="template"
                checked={messageType === 'template'}
                onChange={(e) => setMessageType(e.target.value)}
                className="radio-input"
              />
              <span>Template Message</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="text"
                checked={messageType === 'text'}
                onChange={(e) => setMessageType(e.target.value)}
                className="radio-input"
              />
              <span>Custom Text Message</span>
            </label>
          </div>
        </div>

        {/* Template Fields */}
        {messageType === 'template' && (
          <div className="template-section">
            <div className="template-header">
              <h3>Template Configuration</h3>
              <button
                type="button"
                onClick={syncTemplates}
                disabled={syncing}
                className="sync-btn"
              >
                <RefreshCw size={16} className={syncing ? 'spinning' : ''} />
                {syncing ? 'Syncing...' : 'Sync Templates'}
              </button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Select Template</label>
              <select
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Select a template...</option>
                {templates.filter(t => t.status === 'approved').map(template => (
                  <option key={template._id || template.name} value={template.name}>
                    {template.name} {template.category && `(${template.category})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language Code</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en_US"
                className="form-input"
                required
              />
              <p className="form-help">e.g., en_US, es_ES, fr_FR</p>
            </div>
          </div>
        )}

        {/* Custom Message Fields */}
        {messageType === 'text' && (
          <div className="custom-message-section">
            <div className="form-group">
              <label className="form-label">Custom Message</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your custom message here... Use {var1}, {var2}, etc. for variables from CSV"
                rows={6}
                className="form-textarea"
                required
              />
              <p className="form-help">
                Use placeholders like {'{var1}'}, {'{var2}'} for dynamic content from CSV columns
              </p>
            </div>
          </div>
        )}

        {/* CSV Upload */}
        <div className="form-group">
          <div className="csv-upload-header">
            <label className="form-label">Upload CSV File</label>
            <button
              type="button"
              onClick={downloadSampleCSV}
              className="download-sample-btn"
            >
              <Download size={14} />
              Download Sample
            </button>
          </div>
          
          <div className="csv-upload-area">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="csv-input"
              id="csv-upload"
              required
            />
            <label htmlFor="csv-upload" className="csv-upload-label">
              <Upload className="upload-icon" />
              <p className="upload-text">
                {csvFile ? csvFile.name : 'Click to upload CSV file'}
              </p>
              <p className="upload-help">
                Format: phone,var1,var2,... or just phone numbers
              </p>
            </label>
          </div>

          {csvFile && (
            <div className="file-info">
              <FileText className="file-icon" />
              <span className="file-name">{csvFile.name}</span>
              <button
                type="button"
                onClick={removeFile}
                className="remove-file-btn"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {csvPreview.length > 0 && (
            <div className="csv-preview">
              <h4>CSV Data Table ({csvPreview.length > 0 ? csvPreview.length - 1 : 0} rows)</h4>
              <div className="csv-table-container">
                <table className="csv-data-table">
                  <thead>
                    <tr>
                      {csvPreview.length > 0 && csvPreview[0].split(',').map((header, index) => (
                        <th key={index}>{header.trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(1).map((line, rowIndex) => (
                      <tr key={rowIndex}>
                        {line.split(',').map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell.trim()}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="submit-btn"
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              <span>Sending Messages...</span>
            </>
          ) : (
            <>
              <Send className="send-icon" />
              <span>Send Bulk Messages</span>
            </>
          )}
        </button>
      </form>

      {/* Results */}
      {results && (
        <CampaignResults 
          results={results} 
          broadcastId={results.broadcastId}
          onRetry={handleRetryFailed}
        />
      )}
    </div>
  );
};

export default BulkMessaging;
