import React from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload
} from 'lucide-react';

const CRM_DOCUMENT_TYPE_OPTIONS = [
  { value: 'id_proof', label: 'ID Proof' },
  { value: 'address_proof', label: 'Address Proof' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'quote', label: 'Quote' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'contract', label: 'Contract' },
  { value: 'payment_receipt', label: 'Payment Receipt' },
  { value: 'other', label: 'Other' }
];

const formatDocumentFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const ContactInfoPanel = ({
  selectedConversation,
  showContactInfo,
  setShowContactInfo,
  deriveLeadStatus,
  getConversationLeadScore,
  getLeadStageValue,
  handleLeadStageChange,
  contactInfoActionBusy,
  leadStageOptions,
  openTemplateSendModal,
  templateLoading,
  templateSending,
  handleQualifyLead,
  handleUnqualifyLead,
  leadFollowUpDraft,
  setLeadFollowUpDraft,
  handleSaveLeadFollowUp,
  leadFollowUpSaving,
  crmTaskTitleDraft,
  setCrmTaskTitleDraft,
  crmTaskPriorityDraft,
  setCrmTaskPriorityDraft,
  crmTaskDueDraft,
  setCrmTaskDueDraft,
  handleCreateQuickTask,
  crmTaskCreating,
  meetTokenDraft,
  setMeetTokenDraft,
  meetAuthConfigured,
  meetAuthStatusLoading,
  meetConnecting,
  meetDisconnecting,
  handleDisconnectGoogleForMeet,
  handleConnectGoogleForMeet,
  meetTitleDraft,
  setMeetTitleDraft,
  meetStartDraft,
  setMeetStartDraft,
  meetEndDraft,
  setMeetEndDraft,
  meetCreateFollowUpTask,
  setMeetCreateFollowUpTask,
  meetFollowUpTitleDraft,
  setMeetFollowUpTitleDraft,
  meetFollowUpPriorityDraft,
  setMeetFollowUpPriorityDraft,
  meetFollowUpDueDraft,
  setMeetFollowUpDueDraft,
  handleCreateMeetLink,
  meetCreating,
  meetLink,
  handleCopyMeetLink,
  meetSending,
  meetTemplateSending,
  handleSendMeetTemplateToContact,
  sendingMessage,
  handleSendMeetLinkToContact,
  crmActivitiesLoading,
  crmActivities,
  crmDocumentsLoading,
  crmDocuments,
  crmDocumentUploading,
  crmDocumentTypeDraft,
  setCrmDocumentTypeDraft,
  handleUploadCrmDocument,
  handleOpenCrmDocument,
  handleDownloadCrmDocument,
  handleDeleteCrmDocument,
  getCrmActivityLabel,
  getCrmActivityDescription,
  formatDateTimeForActivity,
  internalNoteDraft,
  setInternalNoteDraft,
  handleSaveInternalNote,
  internalNoteSaving,
  contactInfoMessage,
  contactInfoMessageTone
}) => {
  const crmDocumentInputRef = React.useRef(null);

  const handleDocumentFileSelection = async (event) => {
    const nextFile = event?.target?.files?.[0] || null;
    if (nextFile) {
      await handleUploadCrmDocument(nextFile);
    }
    if (event?.target) {
      event.target.value = '';
    }
  };

  if (!selectedConversation || !showContactInfo) return null;

  return (
    <aside className="contact-info-side-panel">
      <div className="contact-info-modal">
        <div className="contact-info-modal-header">
          <h3>Contact Information</h3>
          <button className="contact-info-close-btn" onClick={() => setShowContactInfo(false)}>
            Close
          </button>
        </div>

        <div className="contact-info-card">
          <h4>Lead Info</h4>
          <div className="contact-info-item">
            <span>Name</span>
            <strong>{selectedConversation.contactId?.name || 'Unknown'}</strong>
          </div>
          <div className="contact-info-item">
            <span>Phone</span>
            <strong>{selectedConversation.contactPhone || '-'}</strong>
          </div>
          <div className="contact-info-item">
            <span>Status</span>
            <strong>
              <span className={`lead-status-badge status-${deriveLeadStatus(selectedConversation).toLowerCase()}`}>
                {deriveLeadStatus(selectedConversation)}
              </span>
            </strong>
          </div>
          <div className="contact-info-item">
            <span>Score</span>
            <strong className="lead-score-value">{getConversationLeadScore(selectedConversation)}</strong>
          </div>
          <div className="contact-info-item">
            <span>Stage</span>
            <select
              className="lead-stage-select"
              value={getLeadStageValue(selectedConversation)}
              onChange={(event) => handleLeadStageChange(event.target.value)}
              disabled={contactInfoActionBusy}
            >
              {leadStageOptions.map((stage) => (
                <option key={`lead-stage-${stage.value}`} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="contact-info-card">
          <h4>Actions</h4>
          <button
            type="button"
            className="lead-action-btn lead-action-btn--template"
            onClick={openTemplateSendModal}
            disabled={templateLoading || templateSending || !selectedConversation?.contactPhone}
          >
            <MessageSquare size={14} />
            Send Template
          </button>
          <button
            type="button"
            className="lead-action-btn lead-action-btn--qualify"
            onClick={handleQualifyLead}
            disabled={contactInfoActionBusy}
          >
            <ThumbsUp size={14} />
            Qualify Lead
          </button>
          <button
            type="button"
            className="lead-action-btn lead-action-btn--unqualify"
            onClick={handleUnqualifyLead}
            disabled={contactInfoActionBusy}
          >
            <ThumbsDown size={14} />
            Unqualify
          </button>
        </div>

        <div className="contact-info-card">
          <h4>Follow-up</h4>
          <input
            type="datetime-local"
            className="lead-followup-input"
            value={leadFollowUpDraft}
            onChange={(event) => setLeadFollowUpDraft(event.target.value)}
          />
          <button
            type="button"
            className="lead-action-btn lead-action-btn--save-note"
            onClick={handleSaveLeadFollowUp}
            disabled={leadFollowUpSaving || contactInfoActionBusy}
          >
            {leadFollowUpSaving ? 'Saving...' : 'Save Follow-up'}
          </button>
        </div>

        <div className="contact-info-card">
          <h4>Quick Task</h4>
          <input
            type="text"
            className="quick-task-input"
            placeholder="Follow-up task title..."
            value={crmTaskTitleDraft}
            onChange={(event) => setCrmTaskTitleDraft(event.target.value)}
          />
          <div className="quick-task-row">
            <select
              className="quick-task-select"
              value={crmTaskPriorityDraft}
              onChange={(event) => setCrmTaskPriorityDraft(event.target.value)}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <input
              type="datetime-local"
              className="quick-task-input"
              value={crmTaskDueDraft}
              onChange={(event) => setCrmTaskDueDraft(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="lead-action-btn lead-action-btn--qualify"
            onClick={handleCreateQuickTask}
            disabled={crmTaskCreating || contactInfoActionBusy}
          >
            {crmTaskCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>

        <div className="contact-info-card">
          <h4>Documents</h4>
          <div className="crm-document-upload-row">
            <select
              className="quick-task-select"
              value={crmDocumentTypeDraft}
              onChange={(event) => setCrmDocumentTypeDraft(event.target.value)}
              disabled={crmDocumentUploading}
            >
              {CRM_DOCUMENT_TYPE_OPTIONS.map((option) => (
                <option key={`crm-document-type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="lead-action-btn lead-action-btn--template crm-document-upload-btn"
              onClick={() => crmDocumentInputRef.current?.click()}
              disabled={crmDocumentUploading || contactInfoActionBusy}
            >
              <Upload size={14} />
              {crmDocumentUploading ? 'Uploading...' : 'Upload'}
            </button>
            <input
              ref={crmDocumentInputRef}
              type="file"
              className="crm-document-file-input"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              onChange={handleDocumentFileSelection}
            />
          </div>
          {crmDocumentsLoading ? (
            <p className="crm-activity-empty">Loading documents...</p>
          ) : crmDocuments.length > 0 ? (
            <ul className="crm-document-list">
              {crmDocuments.map((document, index) => {
                const documentId = String(document?._id || document?.id || `document-${index}`);
                const fileName = String(
                  document?.attachment?.originalFileName || document?.title || 'Document'
                ).trim();
                const typeOption = CRM_DOCUMENT_TYPE_OPTIONS.find(
                  (option) => option.value === String(document?.documentType || '').trim()
                );
                const fileMeta = [
                  typeOption?.label || 'Document',
                  formatDocumentFileSize(document?.attachment?.bytes),
                  document?.attachment?.pages ? `${document.attachment.pages} page${document.attachment.pages > 1 ? 's' : ''}` : ''
                ]
                  .filter(Boolean)
                  .join(' • ');

                return (
                  <li key={documentId} className="crm-document-item">
                    <div className="crm-document-copy">
                      <div className="crm-document-title-row">
                        <span className="crm-document-icon">
                          <FileText size={14} />
                        </span>
                        <strong>{fileName}</strong>
                      </div>
                      <span>{fileMeta || 'CRM document'}</span>
                      <time>{formatDateTimeForActivity(document?.createdAt)}</time>
                    </div>
                    <div className="crm-document-actions">
                      <button
                        type="button"
                        className="crm-document-action-btn"
                        onClick={() => handleOpenCrmDocument(documentId)}
                        title="Open"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        type="button"
                        className="crm-document-action-btn"
                        onClick={() => handleDownloadCrmDocument(documentId)}
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="crm-document-action-btn crm-document-action-btn--danger"
                        onClick={() => handleDeleteCrmDocument(documentId)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="crm-activity-empty">No CRM documents saved for this contact yet.</p>
          )}
        </div>

        <div className="contact-info-card">
          <h4>Schedule Meet</h4>
          {!meetAuthConfigured && (
            <input
              type="password"
              className="meet-schedule-input"
              placeholder="Google access token (optional)"
              value={meetTokenDraft}
              onChange={(event) => setMeetTokenDraft(event.target.value)}
              autoComplete="off"
            />
          )}
          <p className={`meet-auth-hint ${meetAuthConfigured ? 'meet-auth-hint--ok' : 'meet-auth-hint--warn'}`}>
            {meetAuthStatusLoading
              ? 'Checking backend Google auth...'
              : meetAuthConfigured
                ? 'Backend Google auth is configured in env.'
                : 'Paste a Google access token or configure backend Google auth env values.'}
          </p>
          <div className="meet-auth-actions">
            <button
              type="button"
              className={`lead-action-btn ${meetAuthConfigured ? 'lead-action-btn--unqualify' : 'lead-action-btn--template'}`}
              onClick={meetAuthConfigured ? handleDisconnectGoogleForMeet : handleConnectGoogleForMeet}
              disabled={meetAuthStatusLoading || meetConnecting || meetDisconnecting}
            >
              {meetAuthStatusLoading
                ? 'Checking...'
                : meetConnecting
                  ? 'Connecting...'
                  : meetDisconnecting
                    ? 'Disconnecting...'
                    : meetAuthConfigured
                      ? 'Disconnect Google'
                      : 'Connect Google'}
            </button>
          </div>
          <input
            type="text"
            className="meet-schedule-input"
            placeholder="Meeting title"
            value={meetTitleDraft}
            onChange={(event) => setMeetTitleDraft(event.target.value)}
          />
          <div className="meet-schedule-row">
            <input
              type="datetime-local"
              className="meet-schedule-input"
              value={meetStartDraft}
              onChange={(event) => setMeetStartDraft(event.target.value)}
            />
            <input
              type="datetime-local"
              className="meet-schedule-input"
              value={meetEndDraft}
              onChange={(event) => setMeetEndDraft(event.target.value)}
            />
          </div>
          <label className="meet-followup-toggle">
            <input
              type="checkbox"
              checked={meetCreateFollowUpTask}
              onChange={(event) => {
                const isEnabled = Boolean(event.target.checked);
                setMeetCreateFollowUpTask(isEnabled);
                if (!isEnabled) return;

                if (!String(meetFollowUpTitleDraft || '').trim()) {
                  const nextTitle = String(meetTitleDraft || '').trim();
                  setMeetFollowUpTitleDraft(
                    nextTitle ? `Follow up: ${nextTitle}` : 'Follow up after meeting'
                  );
                }
                if (!String(meetFollowUpDueDraft || '').trim() && String(meetStartDraft || '').trim()) {
                  setMeetFollowUpDueDraft(meetStartDraft);
                }
              }}
            />
            <span>Create follow-up task after scheduling</span>
          </label>
          {meetCreateFollowUpTask && (
            <>
              <input
                type="text"
                className="meet-schedule-input"
                placeholder="Follow-up task title (optional)"
                value={meetFollowUpTitleDraft}
                onChange={(event) => setMeetFollowUpTitleDraft(event.target.value)}
              />
              <div className="meet-followup-row">
                <select
                  className="quick-task-select"
                  value={meetFollowUpPriorityDraft}
                  onChange={(event) => setMeetFollowUpPriorityDraft(event.target.value)}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="datetime-local"
                  className="meet-schedule-input"
                  value={meetFollowUpDueDraft}
                  onChange={(event) => setMeetFollowUpDueDraft(event.target.value)}
                />
              </div>
            </>
          )}
          <button
            type="button"
            className="lead-action-btn lead-action-btn--qualify"
            onClick={handleCreateMeetLink}
            disabled={meetCreating || contactInfoActionBusy}
          >
            {meetCreating ? 'Creating...' : 'Create Meet Link'}
          </button>
          {meetLink && (
            <div className="meet-link-box">
              <a href={meetLink} target="_blank" rel="noopener noreferrer">
                {meetLink}
              </a>
              <div className="meet-link-actions">
                <button
                  type="button"
                  className="lead-action-btn lead-action-btn--save-note"
                  onClick={handleCopyMeetLink}
                  disabled={meetSending || meetTemplateSending}
                >
                  Copy Link
                </button>
                <button
                  type="button"
                  className="lead-action-btn lead-action-btn--template"
                  onClick={handleSendMeetTemplateToContact}
                  disabled={meetTemplateSending || meetSending || sendingMessage}
                >
                  {meetTemplateSending ? 'Sending Template...' : 'Send Template'}
                </button>
                <button
                  type="button"
                  className="lead-action-btn lead-action-btn--qualify"
                  onClick={handleSendMeetLinkToContact}
                  disabled={meetSending || meetTemplateSending || sendingMessage}
                >
                  {meetSending ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="contact-info-card">
          <h4>Recent Activity</h4>
          {crmActivitiesLoading ? (
            <p className="crm-activity-empty">Loading activity...</p>
          ) : crmActivities.length > 0 ? (
            <ul className="crm-activity-list">
              {crmActivities.map((activity, index) => {
                const activityId = String(activity?._id || activity?.id || `activity-${index}`);
                return (
                  <li key={activityId} className="crm-activity-item">
                    <strong>{getCrmActivityLabel(activity)}</strong>
                    <span>{getCrmActivityDescription(activity)}</span>
                    <time>{formatDateTimeForActivity(activity?.createdAt)}</time>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="crm-activity-empty">No CRM activity for this lead yet.</p>
          )}
        </div>

        <div className="contact-info-card">
          <h4>Internal Notes</h4>
          <textarea
            className="internal-note-input"
            placeholder="Add notes about this lead..."
            value={internalNoteDraft}
            onChange={(event) => setInternalNoteDraft(event.target.value)}
            rows={4}
          />
          <button
            type="button"
            className="lead-action-btn lead-action-btn--save-note"
            onClick={handleSaveInternalNote}
            disabled={internalNoteSaving}
          >
            {internalNoteSaving ? 'Saving...' : 'Save Note'}
          </button>
          <p className="internal-note-hint">
            {String(selectedConversation?.contactId?.notes || '').trim()
              ? 'Note saved for this lead.'
              : 'No notes saved for this lead yet.'}
          </p>
        </div>

        {contactInfoMessage && (
          <div className={`contact-info-feedback contact-info-feedback--${contactInfoMessageTone}`}>
            {contactInfoMessage}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ContactInfoPanel;
