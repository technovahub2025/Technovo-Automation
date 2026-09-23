import { useEffect, useRef } from 'react';
import { AlertCircle, LoaderCircle, Trash2, X } from 'lucide-react';
import './CampaignDeleteDialog.css';

export default function CampaignDeleteDialog({ campaign, busy, error, onCancel, onConfirm }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        dialog.showModal();
        return () => {
            dialog.close();
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="cm-delete-dialog"
            aria-labelledby="cm-delete-title"
            aria-describedby="cm-delete-description"
            onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
        >
            <button type="button" className="cm-delete-close" aria-label="Close delete dialog" disabled={busy} onClick={onCancel}>
                <X size={20} />
            </button>
            <div className={`cm-delete-icon ${busy ? 'is-busy' : ''}`} aria-hidden="true">
                {busy ? <LoaderCircle size={28} className="cm-delete-spinner" /> : <Trash2 size={28} />}
            </div>
            <div role="status" aria-live="polite">
                <h2 id="cm-delete-title">{busy ? 'Deleting campaign…' : 'Delete this campaign?'}</h2>
                <p id="cm-delete-description">
                    {busy ? 'Please wait while we archive your campaign and clean up its linked Meta assets.' : 'This will archive the campaign and clean up its linked Meta assets.'}
                </p>
            </div>
            <div className="cm-delete-campaign">
                <span>SELECTED CAMPAIGN</span>
                <strong>{campaign.name || campaign.campaignName || 'Untitled campaign'}</strong>
            </div>
            {error && <p className="cm-delete-error" role="alert"><AlertCircle size={18} />{error}</p>}
            <div className="cm-delete-actions">
                <button type="button" className="cm-delete-cancel" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
                <button type="button" className="cm-delete-confirm" disabled={busy} onClick={onConfirm}>
                    {busy ? <LoaderCircle size={17} className="cm-delete-spinner" /> : <Trash2 size={17} />}
                    {busy ? 'Deleting…' : error ? 'Try again' : 'Delete campaign'}
                </button>
            </div>
        </dialog>
    );
}
