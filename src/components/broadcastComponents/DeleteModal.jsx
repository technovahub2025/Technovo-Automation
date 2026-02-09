import React from 'react';
import { X } from 'lucide-react';
import './Modal.css';

const DeleteModal = ({
  showDeleteModal,
  selectedCampaigns,
  broadcasts,
  onDeleteConfirm,
  onDeleteCancel
}) => {
  if (!showDeleteModal || selectedCampaigns.length === 0) return null;

  const selected = selectedCampaigns.length === 1
    ? broadcasts.find((b) => b._id === selectedCampaigns[0])
    : null;

  return (
    <div className="popup-overlay">
      <div className="popup-container delete-modal">
        <div className="popup-header">
          <div className="popup-title">Delete Campaign{selectedCampaigns.length > 1 ? 's' : ''}</div>
          <button className="close-btn" onClick={onDeleteCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="popup-content delete-modal-content">
          <p className="delete-question">
            Are you sure you want to delete {selectedCampaigns.length > 1 ? 'these campaigns' : 'this campaign'}?
          </p>

          <div className="campaign-info">
            {selected ? (
              <>
                <strong>{selected.name}</strong>
                <p>Status: {selected.status}</p>
                <p>
                  Recipients:{' '}
                  {selected.recipientCount || selected.recipients?.length || 0}
                </p>
              </>
            ) : (
              <>
                <strong>{selectedCampaigns.length} campaigns selected</strong>
                <p>This will permanently delete all selected campaigns and their data.</p>
              </>
            )}
          </div>

          <p className="warning-text">This action cannot be undone.</p>
        </div>

        <div className="popup-footer">
          <button className="btn-cancel" onClick={onDeleteCancel}>
            Cancel
          </button>
          <button className="btn-delete" onClick={onDeleteConfirm}>
            Delete {selectedCampaigns.length > 1 ? 'All' : 'Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
