import { whatsappService } from '../../services/whatsappService';
import { crmService } from '../../services/crmService';
import { publishCrmContactSync } from '../../utils/crmSyncEvents';

export const createContactCrmActions = ({
  selectedConversation,
  setConversations,
  setContactNameMap,
  setSelectedConversation,
  setContactInfoActionBusy,
  setContactInfoMessage,
  setContactInfoMessageTone,
  internalNoteDraft,
  setInternalNoteDraft,
  setInternalNoteSaving,
  setCrmActivities,
  setCrmActivitiesLoading,
  setCrmDocuments,
  setCrmDocumentsLoading,
  setCrmDocumentUploading,
  setLeadFollowUpSaving,
  setLeadFollowUpDraft,
  setCrmTaskCreating,
  crmDocumentTypeDraft,
  crmTaskTitleDraft,
  crmTaskDueDraft,
  crmTaskPriorityDraft,
  setCrmTaskTitleDraft,
  setCrmTaskDueDraft,
  setCrmTaskPriorityDraft,
  leadFollowUpDraft,
  normalizePhone,
  getContactIdFromConversation,
  getContactTagsRaw,
  getConversationIdValue,
  currentUserId,
  toIsoFromDateTimeLocalInput,
  toDateTimeLocalInputValue,
  refreshInboxOverview,
  setInboxView,
  isAgentRestricted = false,
  confirmAction
}) => {
  const confirmWithFallback = async (message) => {
    if (typeof confirmAction === 'function') {
      return Boolean(await confirmAction(String(message || '').trim()));
    }
    console.warn('Team Inbox confirm callback missing:', String(message || '').trim());
    return false;
  };

  const refreshInboxOverviewSafely = async () => {
    if (typeof refreshInboxOverview !== 'function') return;
    try {
      await refreshInboxOverview();
    } catch (error) {
      console.warn('Failed to refresh Team Inbox overview:', error);
    }
  };

  const applyContactUpdateLocally = (updatedContact) => {
    if (!updatedContact) return;

    const normalizedContactId = String(updatedContact?._id || updatedContact?.id || '').trim();
    const normalizedPhone = normalizePhone(updatedContact?.phone);
    const normalizedName = String(updatedContact?.name || '').trim();

    const matchesConversation = (conversation) => {
      if (!conversation) return false;
      const conversationContactId = getContactIdFromConversation(conversation);
      const conversationPhone = normalizePhone(conversation?.contactPhone);
      if (normalizedContactId && conversationContactId && normalizedContactId === conversationContactId) {
        return true;
      }
      if (normalizedPhone && conversationPhone && normalizedPhone === conversationPhone) {
        return true;
      }
      return false;
    };

    const mergeConversationWithContact = (conversation) => {
      if (!matchesConversation(conversation)) return conversation;
      const existingContact =
        conversation?.contactId && typeof conversation.contactId === 'object'
          ? conversation.contactId
          : {};
      return {
        ...conversation,
        contactId: {
          ...existingContact,
          ...updatedContact
        },
        contactName: String(updatedContact?.name || '').trim() || conversation?.contactName
      };
    };

    if (normalizedPhone && normalizedName) {
      setContactNameMap?.((prev) => {
        const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
        next[normalizedPhone] = normalizedName;
        if (normalizedPhone.length > 10) {
          next[normalizedPhone.slice(-10)] = normalizedName;
        }
        return next;
      });
    }

    setConversations((prev) => prev.map((conversation) => mergeConversationWithContact(conversation)));
    setSelectedConversation((prev) => mergeConversationWithContact(prev));
  };

  const applyConversationPatchLocally = (patch = {}) => {
    const conversationId = getConversationIdValue(selectedConversation);
    if (!conversationId) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        getConversationIdValue(conversation) === conversationId
          ? {
              ...conversation,
              ...patch,
              ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
              ...(patch.assignedAgent !== undefined ? { assignedAgent: patch.assignedAgent } : {}),
              ...(patch.leadStatus !== undefined ? { leadStatus: patch.leadStatus } : {}),
              ...(patch.followupAt !== undefined ? { followupAt: patch.followupAt } : {}),
              ...(patch.important !== undefined ? { important: patch.important } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
              ...(Array.isArray(patch.internalNotes) ? { internalNotes: patch.internalNotes } : {})
            }
          : conversation
      )
    );

    setSelectedConversation((prev) =>
      getConversationIdValue(prev) === conversationId
        ? {
            ...prev,
            ...patch,
            ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo } : {}),
            ...(patch.assignedAgent !== undefined ? { assignedAgent: patch.assignedAgent } : {}),
            ...(patch.leadStatus !== undefined ? { leadStatus: patch.leadStatus } : {}),
            ...(patch.followupAt !== undefined ? { followupAt: patch.followupAt } : {}),
            ...(patch.important !== undefined ? { important: patch.important } : {}),
            ...(patch.status !== undefined ? { status: patch.status } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
            ...(Array.isArray(patch.internalNotes) ? { internalNotes: patch.internalNotes } : {})
          }
        : prev
    );
  };

  const ensureSelectedContactExists = async () => {
    const existingContactId = getContactIdFromConversation(selectedConversation);
    if (existingContactId) {
      return existingContactId;
    }

    const phone = String(selectedConversation?.contactPhone || '').trim();
    if (!phone) {
      throw new Error('No contact phone found for this conversation.');
    }

    const displayName = String(
      selectedConversation?.contactId?.name ||
        selectedConversation?.contactName ||
        ''
    ).trim();

    const result = await whatsappService.createContact({
      name: displayName,
      phone,
      source: 'team_inbox',
      sourceType: 'incoming_message',
      tags: []
    });

    if (result?.success === false) {
      throw new Error(result?.error || 'Failed to create contact.');
    }

    const createdContact = result?.data || result;
    const createdContactId = String(createdContact?._id || createdContact?.id || '').trim();
    if (!createdContactId) {
      throw new Error('Contact creation returned an invalid payload.');
    }

    applyContactUpdateLocally(createdContact);
    setContactInfoMessage('Contact linked to CRM successfully.');
    setContactInfoMessageTone('success');
    return createdContactId;
  };

  const updateSelectedContact = async (
    patch = {},
    successMessage = '',
    { syncReason = 'contact_updated', refreshActivities = false } = {}
  ) => {
    try {
      setContactInfoActionBusy(true);
      setContactInfoMessage('');
      const contactId = await ensureSelectedContactExists();

      const response = await whatsappService.updateContact(contactId, patch);
      if (response?.success === false) {
        throw new Error(response?.error || 'Failed to update contact.');
      }

      const updatedContact = response?.data || response;
      applyContactUpdateLocally(updatedContact);
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: syncReason
      });

      if (successMessage) {
        setContactInfoMessage(successMessage);
        setContactInfoMessageTone('success');
      }
      if (refreshActivities) {
        await loadCrmActivitiesForContact({ contactId, silent: true });
      }
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to update contact.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const loadCrmActivitiesForContact = async ({ contactId, silent = false } = {}) => {
    const resolvedContactId = String(
      contactId || getContactIdFromConversation(selectedConversation) || ''
    ).trim();
    if (!resolvedContactId) {
      setCrmActivities([]);
      return;
    }

    try {
      if (!silent) setCrmActivitiesLoading(true);
      const result = await crmService.getActivities(resolvedContactId, 15);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to load CRM activity');
      }
      setCrmActivities(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      if (!silent) {
        setContactInfoMessage(error?.message || 'Failed to load CRM activity.');
        setContactInfoMessageTone('error');
      }
      setCrmActivities([]);
    } finally {
      if (!silent) setCrmActivitiesLoading(false);
    }
  };

  const loadCrmDocumentsForContact = async ({ contactId, silent = false } = {}) => {
    const resolvedContactId = String(
      contactId || getContactIdFromConversation(selectedConversation) || ''
    ).trim();
    if (!resolvedContactId) {
      setCrmDocuments([]);
      return;
    }

    try {
      if (!silent) setCrmDocumentsLoading(true);
      const result = await crmService.listContactDocuments(resolvedContactId, {
        conversationId: getConversationIdValue(selectedConversation)
      });
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to load contact documents');
      }
      setCrmDocuments(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      if (!silent) {
        setContactInfoMessage(error?.message || 'Failed to load contact documents.');
        setContactInfoMessageTone('error');
      }
      setCrmDocuments([]);
    } finally {
      if (!silent) setCrmDocumentsLoading(false);
    }
  };

  const handleQualifyLead = async () => {
    const existingTags = getContactTagsRaw(selectedConversation);
    const nextTags = Array.from(
      new Set(
        existingTags
          .filter((tag) => String(tag).toLowerCase() !== 'unqualified')
          .concat(['Qualified'])
      )
    );
    await updateSelectedContact(
      { tags: nextTags, status: 'qualified', stage: 'qualified' },
      'Lead marked as qualified.',
      { syncReason: 'lead_qualified', refreshActivities: true }
    );
  };

  const handleUnqualifyLead = async () => {
    const existingTags = getContactTagsRaw(selectedConversation);
    const nextTags = Array.from(
      new Set(
        existingTags
          .filter((tag) => String(tag).toLowerCase() !== 'qualified')
          .concat(['Unqualified'])
      )
    );
    await updateSelectedContact(
      { tags: nextTags, status: 'unqualified', stage: 'lost' },
      'Lead marked as unqualified.',
      { syncReason: 'lead_unqualified', refreshActivities: true }
    );
  };

  const handleSaveInternalNote = async () => {
    const note = String(internalNoteDraft || '').trim();
    setInternalNoteSaving(true);
    const updated = await updateSelectedContact(
      { notes: note },
      'Internal note saved.',
      { syncReason: 'internal_note_saved', refreshActivities: true }
    );
    if (updated) {
      setInternalNoteDraft(note);
    }
    setInternalNoteSaving(false);
  };

  const handleLeadStageChange = async (nextStage) => {
    const normalizedStage = String(nextStage || '').trim().toLowerCase();
    if (!normalizedStage) {
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setContactInfoActionBusy(true);
      setContactInfoMessage('');
      const contactId = await ensureSelectedContactExists();
      const result = await crmService.updateContactStage(contactId, normalizedStage);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to update lead stage.');
      }
      const updatedContact = result?.data || { stage: normalizedStage };
      applyContactUpdateLocally(updatedContact);
      setContactInfoMessage('Lead stage updated.');
      setContactInfoMessageTone('success');
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: 'lead_stage_updated'
      });
      await loadCrmActivitiesForContact({ contactId, silent: true });
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to update lead stage.');
      setContactInfoMessageTone('error');
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleSaveLeadFollowUp = async () => {
    const nextFollowUpAt = toIsoFromDateTimeLocalInput(leadFollowUpDraft);
    if (String(leadFollowUpDraft || '').trim() && !nextFollowUpAt) {
      setContactInfoMessage('Invalid follow-up date. Please use a valid date and time.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setLeadFollowUpSaving(true);
      const updated = await updateSelectedContact(
        { nextFollowUpAt },
        nextFollowUpAt ? 'Next follow-up updated.' : 'Next follow-up cleared.',
        { syncReason: 'follow_up_updated', refreshActivities: true }
      );
      if (updated) {
        setLeadFollowUpDraft(toDateTimeLocalInputValue(nextFollowUpAt));
      }
    } finally {
      setLeadFollowUpSaving(false);
    }
  };

  const handleCreateQuickTask = async () => {
    const conversationIdValue = getConversationIdValue(selectedConversation);
    const title = String(crmTaskTitleDraft || '').trim();
    if (!title) {
      setContactInfoMessage('Task title is required.');
      setContactInfoMessageTone('error');
      return;
    }

    const dueAt = toIsoFromDateTimeLocalInput(crmTaskDueDraft);
    if (String(crmTaskDueDraft || '').trim() && !dueAt) {
      setContactInfoMessage('Invalid task due date. Please use a valid date and time.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setCrmTaskCreating(true);
      setContactInfoMessage('');
      const contactId = await ensureSelectedContactExists();
      const result = await crmService.createTask({
        contactId,
        conversationId: conversationIdValue || undefined,
        title,
        priority: crmTaskPriorityDraft || 'medium',
        dueAt: dueAt || undefined
      });
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to create quick task.');
      }
      setCrmTaskTitleDraft('');
      setCrmTaskDueDraft(leadFollowUpDraft || '');
      setCrmTaskPriorityDraft('medium');
      setContactInfoMessage('Follow-up task created.');
      setContactInfoMessageTone('success');
      publishCrmContactSync({
        contactId,
        conversationId: conversationIdValue,
        reason: 'quick_task_created'
      });
      await loadCrmActivitiesForContact({ contactId, silent: true });
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to create quick task.');
      setContactInfoMessageTone('error');
    } finally {
      setCrmTaskCreating(false);
    }
  };

  const handleOpenCrmDocument = async (documentId) => {
    const normalizedDocumentId = String(documentId || '').trim();
    if (!normalizedDocumentId) return;

    try {
      const result = await crmService.getContactDocumentAccess(normalizedDocumentId, 'view');
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to open document.');
      }

      const nextUrl = String(result?.data?.url || '').trim();
      if (!nextUrl) {
        throw new Error('Document access URL is unavailable.');
      }

      const openedWindow = window.open(nextUrl, '_blank', 'noopener,noreferrer');
      if (!openedWindow) {
        window.location.assign(nextUrl);
      }
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to open document.');
      setContactInfoMessageTone('error');
    }
  };

  const handleDownloadCrmDocument = async (documentId) => {
    const normalizedDocumentId = String(documentId || '').trim();
    if (!normalizedDocumentId) return;

    try {
      const result = await crmService.getContactDocumentAccess(normalizedDocumentId, 'download');
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to download document.');
      }

      const nextUrl = String(result?.data?.url || '').trim();
      if (!nextUrl) {
        throw new Error('Document download URL is unavailable.');
      }

      const link = document.createElement('a');
      link.href = nextUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (String(result?.data?.fileName || '').trim()) {
        link.download = result.data.fileName;
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to download document.');
      setContactInfoMessageTone('error');
    }
  };

  const handleDeleteCrmDocument = async (documentId) => {
    const normalizedDocumentId = String(documentId || '').trim();
    if (!normalizedDocumentId) return;

    const isConfirmed = await confirmWithFallback('Delete this CRM document?');
    if (!isConfirmed) return;

    try {
      setContactInfoActionBusy(true);
      const result = await crmService.deleteContactDocument(normalizedDocumentId);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to delete document.');
      }

      const contactId = getContactIdFromConversation(selectedConversation);
      await Promise.all([
        loadCrmDocumentsForContact({ contactId, silent: true }),
        loadCrmActivitiesForContact({ contactId, silent: true })
      ]);
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: 'document_deleted'
      });
      setContactInfoMessage('CRM document deleted.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to delete document.');
      setContactInfoMessageTone('error');
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleUploadCrmDocument = async (file) => {
    const nextFile = file instanceof File ? file : null;
    if (!nextFile) {
      setContactInfoMessage('Please choose a file to upload.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setCrmDocumentUploading(true);
      setContactInfoMessage('');
      const contactId = await ensureSelectedContactExists();
      const result = await crmService.uploadContactDocument(contactId, {
        file: nextFile,
        documentType: crmDocumentTypeDraft || 'other',
        conversationId: getConversationIdValue(selectedConversation) || undefined
      });
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to upload document.');
      }

      await Promise.all([
        loadCrmDocumentsForContact({ contactId, silent: true }),
        loadCrmActivitiesForContact({ contactId, silent: true })
      ]);
      publishCrmContactSync({
        contactId,
        conversationId: getConversationIdValue(selectedConversation),
        reason: 'document_uploaded'
      });
      setContactInfoMessage('CRM document uploaded.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to upload document.');
      setContactInfoMessageTone('error');
    } finally {
      setCrmDocumentUploading(false);
    }
  };

  const handleAssignConversation = async (assignedTo) => {
    const conversationId = getConversationIdValue(selectedConversation);
    const nextAssignedTo = String(assignedTo || '').trim();
    if (!conversationId || !nextAssignedTo) {
      setContactInfoMessage('Please choose an agent to assign this chat.');
      setContactInfoMessageTone('error');
      return false;
    }

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.assignConversation(conversationId, nextAssignedTo);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to assign conversation.');
      }
      applyConversationPatchLocally({
        assignedTo: nextAssignedTo,
        assignedAgent: nextAssignedTo,
        assignedToId: nextAssignedTo
      });
      if (!isAgentRestricted && typeof setInboxView === 'function') {
        setInboxView('all');
      }
      setContactInfoMessage('Conversation assigned successfully.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to assign conversation.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleSetConversationImportant = async (important) => {
    const conversationId = getConversationIdValue(selectedConversation);
    if (!conversationId) return false;

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.setConversationImportant(conversationId, Boolean(important));
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to update conversation flag.');
      }
      applyConversationPatchLocally({ important: Boolean(important) });
      setContactInfoMessage(important ? 'Conversation marked important.' : 'Important flag cleared.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to update conversation flag.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleCloseConversation = async () => {
    const conversationId = getConversationIdValue(selectedConversation);
    if (!conversationId) return false;

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.closeConversation(conversationId);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to close conversation.');
      }
      applyConversationPatchLocally({ status: 'resolved', leadStatus: 'closed' });
      setContactInfoMessage('Conversation closed.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to close conversation.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleReopenConversation = async () => {
    const conversationId = getConversationIdValue(selectedConversation);
    if (!conversationId) return false;

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.reopenConversation(conversationId);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to reopen conversation.');
      }
      applyConversationPatchLocally({ status: 'active', leadStatus: 'new_lead' });
      setContactInfoMessage('Conversation reopened.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to reopen conversation.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleAddInternalNote = async (noteText) => {
    const conversationId = getConversationIdValue(selectedConversation);
    const text = String(noteText || '').trim();
    if (!conversationId || !text) {
      setContactInfoMessage('Please enter a note before saving.');
      setContactInfoMessageTone('error');
      return false;
    }

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.addConversationNote(conversationId, text);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to save note.');
      }
      applyConversationPatchLocally({
        notes: text,
        internalNotes: Array.isArray(result?.data?.internalNotes)
          ? result.data.internalNotes
          : [
              ...(Array.isArray(selectedConversation?.internalNotes) ? selectedConversation.internalNotes : []),
              {
                text,
                createdBy: currentUserId || null,
                createdAt: new Date().toISOString()
              }
            ]
      });
      setContactInfoMessage('Internal note saved.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to save note.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  const handleCreateFollowupTask = async ({ followupAt, title, description, priority, assignedTo } = {}) => {
    const conversationId = getConversationIdValue(selectedConversation);
    if (!conversationId) return false;

    try {
      setContactInfoActionBusy(true);
      const result = await whatsappService.createConversationFollowup(conversationId, {
        followupAt,
        title,
        description,
        priority,
        assignedTo
      });
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to create follow-up.');
      }
      applyConversationPatchLocally({
        followupAt: followupAt || null
      });
      setContactInfoMessage('Follow-up saved.');
      setContactInfoMessageTone('success');
      void refreshInboxOverviewSafely();
      return true;
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to create follow-up.');
      setContactInfoMessageTone('error');
      return false;
    } finally {
      setContactInfoActionBusy(false);
    }
  };

  return {
    applyContactUpdateLocally,
    loadCrmActivitiesForContact,
    loadCrmDocumentsForContact,
    handleQualifyLead,
    handleUnqualifyLead,
    handleSaveInternalNote,
    handleLeadStageChange,
    handleSaveLeadFollowUp,
    handleCreateQuickTask,
    handleOpenCrmDocument,
    handleDownloadCrmDocument,
    handleDeleteCrmDocument,
    handleUploadCrmDocument,
    handleAssignConversation,
    handleSetConversationImportant,
    handleCloseConversation,
    handleReopenConversation,
    handleAddInternalNote,
    handleCreateFollowupTask
  };
};
