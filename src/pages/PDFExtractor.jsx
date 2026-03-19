import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './PDFExtractor.css';
import logo from '../assets/logo.png';

const PDFExtractor = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [output, setOutput] = useState(null);
  const [showOutput, setShowOutput] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const webhookUrl = 'https://technova112.app.n8n.cloud/webhook-test/extract-report';
  const fallbackWebhookUrl = 'https://technova112.app.n8n.cloud/webhook/extract-report';

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setShowOutput(false);
      setOutput(null);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const displayData = (data) => {
    if (typeof data === 'object' && data !== null) {
      // Display JSON as a table
      return (
        <table className="data-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      return <pre className="text-output">{String(data)}</pre>;
    }
  };

  const saveHistory = async (filename, data) => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const payload = {
        filename,
        data_json: JSON.stringify(data),
        mime_type: 'application/pdf',
        status: 'success'
      };

      const result = await axios.post(`${apiBaseUrl}/api/extractions`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('Extraction saved:', result?.data || result);
    } catch (error) {
      if (!error?.response) {
        console.warn('Network error - history not saved. Backend server may not be running.');
      } else {
        console.error('Could not save history:', error);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a PDF file first.');
      return;
    }

    setUploading(true);
    setShowOutput(false);

    const tryUpload = async (url) => {
      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name);

      console.log('Uploading to:', url);
      console.log('File:', selectedFile.name, selectedFile.type, selectedFile.size);

      const token = localStorage.getItem("token");
      const response = await axios.post(url, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response?.data;
      return data;
    };

    try {
      let parsed;
      try {
        parsed = await tryUpload(webhookUrl);
      } catch (primaryError) {
        console.warn('Primary webhook failed, trying fallback:', primaryError.message);
        try {
          parsed = await tryUpload(fallbackWebhookUrl);
        } catch (fallbackError) {
          throw new Error(`Primary webhook failed: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }

      setOutput(parsed);
      setShowOutput(true);
      await saveHistory(selectedFile.name, parsed);
    } catch (error) {
      console.error('Upload error:', error);
      setOutput(`Error: ${error.message}`);
      setShowOutput(true);
    } finally {
      setUploading(false);
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="pdf-extractor">
      {/* Header */}
      <header className="extractor-header">
        <div className="header-left">
          <img
            src={logo}
            alt="Technova Hub Logo"
            className="logo-img"
          />
          <div>
            <h1>Technova Hub</h1>
            <p className="tagline">Empowering Minds | PDF Data Extractor</p>
          </div>
        </div>
        <nav className="header-nav">
          <button onClick={() => navigate('/email-automation')} className="nav-link">Dashboard</button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="extractor-main">
        <section className="uploader-section">
          <div className="uploader-card">
            <label htmlFor="pdfInput" className="file-label">
              Select PDF Report
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="pdfInput"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="file-input"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="upload-btn"
            >
              {uploading ? 'Uploading…' : 'Extract Data'}
            </button>
          </div>
        </section>

        {/* Output Section */}
        {showOutput && (
          <section className="output-section">
            <div className="output-card">
              {typeof output === 'string' && output.includes('Error') ? (
                <div className="error-message">
                  {output}
                </div>
              ) : (
                displayData(output)
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="extractor-footer">
        &copy; {currentYear} Your Company. All rights reserved.
      </footer>
    </div>
  );
};

export default PDFExtractor;
