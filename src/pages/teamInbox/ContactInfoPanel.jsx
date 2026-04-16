import React from 'react';
import {
  CalendarClock,
  Download,
  ExternalLink,
  FileText,
  FileStack,
  Link2,
  MessageSquare,
  NotebookPen,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  UserRound,
  X,
  ChevronDown
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
  whatsappMessagingState,
  leadStageOptions,
  openTemplateSendModal,
  onMarkWhatsAppOptIn,
  onOpenWhatsAppOptInModal,
  onMarkWhatsAppOptOut,
  onViewWhatsAppConsentAudit,
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
  const [expandedSections, setExpandedSections] = React.useState({
    followUp: false,
    quickTask: false,
    documents: false,
    scheduleMeet: false,
    recentActivity: false,
    internalNotes: false
  });

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

  const contactName = String(selectedConversation.contactId?.name || '').trim() || 'Unknown Contact';
  const contactPhone = String(selectedConversation.contactPhone || '').trim() || '-';
  const contactInitials = contactName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'UN';
  const leadStatus = deriveLeadStatus(selectedConversation);
  const leadScore = getConversationLeadScore(selectedConversation);
  const isUnknownContact = contactName === 'Unknown Contact';
  const contactOptInScope = String(selectedConversation?.contactId?.whatsappOptInScope || 'unknown').trim() || 'unknown';
  const marketingLimit = Number(import.meta.env.VITE_WHATSAPP_MARKETING_TEMPLATE_MAX_PER_24H || 1);
  const marketingLimitLabel = Number.isFinite(marketingLimit) && marketingLimit > 0 ? Math.floor(marketingLimit) : 1;
  const marketingCount =
    whatsappMessagingState?.marketingWindowStartAt
      ? Number(selectedConversation?.contactId?.whatsappMarketingSendCount || 0) || 0
      : 0;
  const marketingNextAllowedAt = selectedConversation?.contactId?.whatsappMarketingWindowStartedAt
    ? whatsappMessagingState?.marketingNextAllowedAt
    : null;

  const toggleSection = (sectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  };

  const renderCollapsibleCard = (sectionKey, title, content, summary, icon) => {
    const isExpanded = Boolean(expandedSections[sectionKey]);

    return (
      <div className="contact-info-card contact-info-card--collapsible">
        <button
          type="button"
          className="contact-info-section-toggle"
          onClick={() => toggleSection(sectionKey)}
          aria-expanded={isExpanded}
        >
          <span className="contact-info-section-toggle-copy">
            <span className="contact-info-section-toggle-title">
              <span className="contact-info-section-toggle-icon-wrap" aria-hidden="true">
                {icon}
              </span>
              <span>{title}</span>
            </span>
            {!isExpanded && summary ? (
              <span className="contact-info-section-toggle-summary">{summary}</span>
            ) : null}
          </span>
          <ChevronDown
            size={16}
            className={`contact-info-section-toggle-icon${isExpanded ? ' is-expanded' : ''}`}
          />
        </button>
        {isExpanded ? <div className="contact-info-section-body">{content}</div> : null}
      </div>
    );
  };

  return (
    <aside className="contact-info-side-panel">
      <div className="contact-info-modal">
        <div className="contact-info-modal-header">
          <h3>Contact Information</h3>
          <button
            className="contact-info-close-btn"
            onClick={() => setShowContactInfo(false)}
            aria-label="Close contact information"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="contact-info-card">
          <div className="contact-profile-summary">
            <div className="contact-profile-avatar" aria-hidden="true">
              {isUnknownContact ? <UserRound size={18} /> : contactInitials}
            </div>
            <div className="contact-profile-copy">
              <strong>{contactName}</strong>
              <span>{contactPhone}</span>
              <small>
                {isUnknownContact
                  ? 'No saved contact name yet'
                  : 'Lead details and WhatsApp policy status'}
              </small>
            </div>
          </div>
          <h4>Lead Info</h4>
          <div className="contact-info-item">
            <span>Name</span>
            <strong>{contactName}</strong>
          </div>
          <div className="contact-info-item">
            <span>Phone</span>
            <strong>{contactPhone}</strong>
          </div>
          <div className="contact-info-item">
            <span>Status</span>
            <strong>
              <span className={`lead-status-badge status-${leadStatus.toLowerCase()}`}>
                {leadStatus}
              </span>
            </strong>
          </div>
          <div className="contact-info-item">
            <span>Score</span>
            <strong className="lead-score-value">{leadScore}</strong>
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

        <div className="contact-info-card whatsapp-status-card">
          <h4>WhatsApp Status</h4>
          <div className="contact-info-item">
            <span>Messaging</span>
            <strong>
              <span className={`whatsapp-status-badge whatsapp-status-badge--${whatsappMessagingState?.badgeTone || 'template-only'}`}>
                {whatsappMessagingState?.statusLabel || 'Template Only'}
              </span>
            </strong>
          </div>
          <div className="whatsapp-status-explainer">
            <p className="whatsapp-status-meta">
              {whatsappMessagingState?.optedOut
                ? 'This contact has opted out. Update consent before sending WhatsApp outreach.'
                : whatsappMessagingState?.marketingRateLimited
                  ? 'Marketing template limit reached for this contact. Use service templates or wait for the cooldown.'
                  : whatsappMessagingState?.freeformAllowed
                    ? 'The 24-hour customer service window is open for free-form replies.'
                    : 'Free-form chat is closed. Use an approved template to continue the conversation.'}
            </p>
          </div>
          <div className="whatsapp-status-actions">
            <button
              type="button"
              className="lead-action-btn lead-action-btn--neutral"
              onClick={onOpenWhatsAppOptInModal || onMarkWhatsAppOptIn}
              disabled={contactInfoActionBusy}
            >
              <ThumbsUp size={14} />
              Mark Opted In
            </button>
            <button
              type="button"
              className="lead-action-btn lead-action-btn--unqualify"
              onClick={onMarkWhatsAppOptOut}
              disabled={contactInfoActionBusy}
            >
              <ThumbsDown size={14} />
              Mark Opted Out
            </button>
            <button
              type="button"
              className="lead-action-btn lead-action-btn--template"
              onClick={onViewWhatsAppConsentAudit}
              disabled={contactInfoActionBusy}
            >
              <FileText size={14} />
              View Audit
            </button>
          </div>
          {(selectedConversation?.contactId?.whatsappOptInAt || selectedConversation?.contactId?.whatsappOptInSource) ? (
            <div className="whatsapp-status-audit">
              <span>
                Opt-in saved:
                <strong>{` ${formatDateTimeForActivity(selectedConversation?.contactId?.whatsappOptInAt) || '-'}`}</strong>
              </span>
              <span>
                Source:
                <strong>{` ${String(selectedConversation?.contactId?.whatsappOptInSource || '-').trim() || '-'}`}</strong>
              </span>
              <span>
                Proof:
                <strong>{` ${String(selectedConversation?.contactId?.whatsappOptInProofType || '-').trim() || '-'}`}</strong>
              </span>
            </div>
          ) : null}
          <div className="whatsapp-status-audit whatsapp-status-audit--compact">
            <span>
              Scope:
              <strong>{` ${contactOptInScope || '-'}`}</strong>
            </span>
            <span>
              Marketing window:
              <strong>{` ${marketingCount}/${marketingLimitLabel}`}</strong>
            </span>
            {whatsappMessagingState?.marketingRateLimited ? (
              <span className="whatsapp-status-warning">
                Next allowed:
                <strong>{` ${formatDateTimeForActivity(marketingNextAllowedAt) || '-'}`}</strong>
              </span>
            ) : null}
          </div>
        </div>

        <div className="contact-info-card">
          <h4>Actions</h4>
          <p className="contact-info-section-note">WhatsApp actions</p>
          <button
            type="button"
            className="lead-action-btn lead-action-btn--template"
            onClick={openTemplateSendModal}
            disabled={
              templateLoading ||
              templateSending ||
              !selectedConversation?.contactPhone ||
              whatsappMessagingState?.optedOut
            }
          >
            <MessageSquare size={14} />
            Send Template
          </button>
          <p className="contact-info-section-note">CRM actions</p>
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

        {renderCollapsibleCard(
          'followUp',
          'Follow-up',
          <>
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
          </>,
          leadFollowUpDraft ? `Scheduled for ${leadFollowUpDraft.replace('T', ' ')}` : 'No follow-up saved',
          <CalendarClock size={15} />
        )}

        {renderCollapsibleCard(
          'quickTask',
          'Quick Task',
          <>
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
          </>,
          String(crmTaskTitleDraft || '').trim() || 'Create a quick follow-up task',
          <NotebookPen size={15} />
        )}

        {renderCollapsibleCard(
          'documents',
          'Documents',
          <>
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
          </>,
          crmDocumentsLoading ? 'Loading documents...' : `${crmDocuments.length} document${crmDocuments.length === 1 ? '' : 's'}`,
          <FileStack size={15} />
        )}

        {renderCollapsibleCard(
          'scheduleMeet',
          'Schedule Meet',
          <>
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
          </>,
          meetLink ? 'Meet link ready to share' : 'Create and share a Google Meet link',
          <Link2 size={15} />
        )}

        {renderCollapsibleCard(
          'recentActivity',
          'Recent Activity',
          <>
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
          </>,
          crmActivitiesLoading ? 'Loading activity...' : `${crmActivities.length} recent activit${crmActivities.length === 1 ? 'y' : 'ies'}`,
          <ScrollText size={15} />
        )}

        {renderCollapsibleCard(
          'internalNotes',
          'Internal Notes',
          <>
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
          </>,
          String(selectedConversation?.contactId?.notes || '').trim() ? 'Saved note available' : 'No internal note yet',
          <FileText size={15} />
        )}

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
