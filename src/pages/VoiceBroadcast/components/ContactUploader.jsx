import React, { useState, useRef } from 'react';
import { Upload, X, Download, Users, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import './ContactUploader.css';

const DEFAULT_SAMPLE_ROWS = [
  { phone: '+919876543210', name: 'Rahul Kumar', city: 'Mumbai', offer: 'Diwali discount' },
  { phone: '+919876543211', name: 'Priya Sharma', city: 'Delhi', offer: 'Diwali discount' },
  { phone: '+919876543212', name: 'Amit Patel', city: 'Bangalore', offer: 'Diwali discount' }
];

const defaultNormalizePhoneNumber = (phone) => {
  let cleaned = String(phone || '').replace(/[\s\-\(\)]/g, '');

  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = `+91${cleaned.substring(1)}`;
    }
  }

  return cleaned;
};

const defaultTransformContact = (row, index, normalizePhoneNumber) => {
  let phone = row.phone || row.mobile || row.number;

  if (!phone) {
    return null;
  }

  phone = normalizePhoneNumber(phone);

  const customFields = {};
  Object.keys(row || {}).forEach((key) => {
    if (!['phone', 'mobile', 'number', 'name'].includes(key) && row[key]) {
      customFields[key] = row[key];
    }
  });

  return {
    phone,
    name: row.name || `Contact ${index + 1}`,
    customFields
  };
};

const ContactUploader = ({
  contacts,
  onContactsUploaded,
  error,
  disabled,
  sampleRows = DEFAULT_SAMPLE_ROWS,
  sampleFileName = 'broadcast_contacts_sample.csv',
  parseFileName = null,
  supportedColumnsHelp = 'CSV with columns: phone/mobile, name (optional), and any custom fields for personalization.',
  emptyStateTitle = 'Upload CSV File',
  emptyStateSubtitle = 'Click to select or drag and drop',
  emptyStateHint = 'CSV must include "phone" or "mobile" column',
  previewTitle = 'contacts uploaded',
  onUploadProcessed = null,
  normalizePhoneNumber = defaultNormalizePhoneNumber,
  transformContact = defaultTransformContact
}) => {
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const processCsvFile = async (file) => {
    if (!file) return;

    if (!String(file.name || '').toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setParseError(null);

    const rawText = await file.text();

    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => String(header || '').trim().toLowerCase(),
      complete: (results) => {
        try {
          const parsedContacts = validateAndTransformContacts(results.data);
          onContactsUploaded(parsedContacts);
          if (typeof onUploadProcessed === 'function') {
            onUploadProcessed({
              contacts: parsedContacts,
              rawText,
              fileName: parseFileName || file.name,
              rejectedCount: Math.max(0, (results.data || []).length - parsedContacts.length)
            });
          }
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

    const nextContacts = [];
    const seen = new Set();

    data.forEach((row, index) => {
      const contact = transformContact(row, index, normalizePhoneNumber);

      if (!contact?.phone) {
        console.warn(`Row ${index + 1}: Missing phone number, skipping`);
        return;
      }

      const phone = String(contact.phone || '').trim();

      if (seen.has(phone)) {
        console.warn(`Row ${index + 1}: Duplicate phone ${phone}, skipping`);
        return;
      }

      seen.add(phone);
      nextContacts.push({
        ...contact,
        phone
      });
    });

    if (nextContacts.length === 0) {
      throw new Error('No valid contacts found in CSV');
    }

    return nextContacts;
  };

  const handleClearContacts = () => {
    onContactsUploaded([]);
    setParseError(null);
    if (typeof onUploadProcessed === 'function') {
      onUploadProcessed({
        contacts: [],
        rawText: '',
        fileName: '',
        rejectedCount: 0
      });
    }
  };

  const downloadSampleCSV = () => {
    const csv = Papa.unparse(sampleRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sampleFileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    await processCsvFile(file);
    e.target.value = '';
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    await processCsvFile(file);
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
            className={`upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="uploading-state">
                <div className="spinner" />
                <p>Parsing CSV...</p>
              </div>
            ) : (
              <>
                <Upload size={48} />
                <h3>{emptyStateTitle}</h3>
                <p>{emptyStateSubtitle}</p>
                <small>{emptyStateHint}</small>
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
              <span>{contacts.length} {previewTitle}</span>
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
          <strong>Supported format:</strong> {supportedColumnsHelp}
        </small>
      </div>
    </div>
  );
};

export default ContactUploader;
