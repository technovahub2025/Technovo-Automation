import React, { useState, useRef } from 'react';
import { Upload, X, Download, Users, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import './ContactUploader.css';

const ContactUploader = ({ contacts, onContactsUploaded, error, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setParseError(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        try {
          const parsedContacts = validateAndTransformContacts(results.data);
          onContactsUploaded(parsedContacts);
          setUploading(false);
        } catch (err) {
          setParseError(err.message);
          setUploading(false);
        }
      },
      error: (err) => {
        setParseError('Failed to parse CSV file');
        setUploading(false);
      }
    });

    // Reset input
    e.target.value = '';
  };

  const validateAndTransformContacts = (data) => {
    if (!data || data.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Check required columns
    const firstRow = data[0];
    if (!firstRow.phone && !firstRow.mobile && !firstRow.number) {
      throw new Error('CSV must have a "phone", "mobile", or "number" column');
    }

    const contacts = [];
    const seen = new Set();

    data.forEach((row, index) => {
      // Get phone number (try different column names)
      let phone = row.phone || row.mobile || row.number;
      
      if (!phone) {
        console.warn(`Row ${index + 1}: Missing phone number, skipping`);
        return;
      }

      // Clean phone number
      phone = cleanPhoneNumber(phone);

      // Skip duplicates
      if (seen.has(phone)) {
        console.warn(`Row ${index + 1}: Duplicate phone ${phone}, skipping`);
        return;
      }

      seen.add(phone);

      // Extract custom fields (all columns except phone/name)
      const customFields = {};
      Object.keys(row).forEach(key => {
        if (!['phone', 'mobile', 'number', 'name'].includes(key) && row[key]) {
          customFields[key] = row[key];
        }
      });

      contacts.push({
        phone,
        name: row.name || `Contact ${index + 1}`,
        customFields
      });
    });

    if (contacts.length === 0) {
      throw new Error('No valid contacts found in CSV');
    }

    return contacts;
  };

  const cleanPhoneNumber = (phone) => {
    // Remove spaces, dashes, parentheses
    let cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');

    // Add country code if missing
    if (!cleaned.startsWith('+')) {
      // Assume Indian number if 10 digits
      if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
        // Remove leading 0 and add +91
        cleaned = '+91' + cleaned.substring(1);
      }
    }

    return cleaned;
  };

  const handleClearContacts = () => {
    onContactsUploaded([]);
    setParseError(null);
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      { phone: '+919876543210', name: 'Rahul Kumar', city: 'Mumbai', offer: 'Diwali discount' },
      { phone: '+919876543211', name: 'Priya Sharma', city: 'Delhi', offer: 'Diwali discount' },
      { phone: '+919876543212', name: 'Amit Patel', city: 'Bangalore', offer: 'Diwali discount' }
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'broadcast_contacts_sample.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="contact-uploader">
      <label className="form-label">
        <Users size={18} />
        Upload Contacts
      </label>

      {contacts.length === 0 ? (
        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            style={{ display: 'none' }}
          />

          <div
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="uploading-state">
                <div className="spinner" />
                <p>Parsing CSV...</p>
              </div>
            ) : (
              <>
                <Upload size={48} />
                <h3>Upload CSV File</h3>
                <p>Click to select or drag and drop</p>
                <small>CSV must include "phone" or "mobile" column</small>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn-link"
            onClick={downloadSampleCSV}
            disabled={disabled || uploading}
          >
            <Download size={16} />
            Download Sample CSV
          </button>
        </div>
      ) : (
        <div className="contacts-preview">
          <div className="preview-header">
            <div className="preview-info">
              <Users size={20} />
              <span>{contacts.length} contacts uploaded</span>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={handleClearContacts}
              disabled={disabled}
              title="Clear contacts"
            >
              <X size={18} />
            </button>
          </div>

          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Phone</th>
                  <th>Name</th>
                  <th>Custom Fields</th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(0, 5).map((contact, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td className="phone">{contact.phone}</td>
                    <td>{contact.name}</td>
                    <td>
                      {Object.keys(contact.customFields || {}).length > 0 ? (
                        <span className="badge">
                          {Object.keys(contact.customFields).length} fields
                        </span>
                      ) : (
                        <span className="text-muted">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {contacts.length > 5 && (
              <p className="preview-more">
                ... and {contacts.length - 5} more contacts
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload size={16} />
            Replace CSV
          </button>
        </div>
      )}

      {(parseError || error) && (
        <div className="error-message">
          <AlertCircle size={16} />
          {parseError || error}
        </div>
      )}

      <div className="upload-info">
        <small>
          <strong>Supported format:</strong> CSV with columns: phone/mobile, name (optional), 
          and any custom fields for personalization.
        </small>
      </div>
    </div>
  );
};

export default ContactUploader;