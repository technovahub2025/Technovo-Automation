import { useEffect, useRef } from 'react';

export const useTeamInboxContactEffects = ({
  selectedConversation,
  showContactInfo,
  toDateTimeLocalInputValue,
  getContactIdFromConversation,
  loadCrmActivitiesForContact,
  loadCrmDocumentsForContact,
  setShowContactInfo,
  setContactInfoMessage,
  setContactInfoMessageTone,
  setInternalNoteDraft,
  setLeadFollowUpDraft,
  setCrmTaskTitleDraft,
  setCrmTaskDueDraft,
  setCrmTaskPriorityDraft,
  setCrmDocumentTypeDraft,
  setCrmDocuments,
  setCrmDocumentsLoading,
  setCrmDocumentUploading,
  setMeetTokenDraft,
  setMeetTitleDraft,
  setMeetStartDraft,
  setMeetEndDraft,
  setMeetSending,
  setMeetTemplateSending,
  setMeetCreateFollowUpTask,
  setMeetFollowUpTitleDraft,
  setMeetFollowUpDueDraft,
  setMeetFollowUpPriorityDraft,
  setMeetLink,
  setCrmActivities,
  setCrmActivitiesLoading
}) => {
  const loadCrmActivitiesForContactRef = useRef(loadCrmActivitiesForContact);
  const loadCrmDocumentsForContactRef = useRef(loadCrmDocumentsForContact);

  const selectedConversationContactName = String(selectedConversation?.contactId?.name || '').trim();
  const selectedConversationContactPhone = String(selectedConversation?.contactPhone || '').trim();
  const selectedConversationContactNotes = String(selectedConversation?.contactId?.notes || '').trim();
  const selectedConversationFollowUpAt = selectedConversation?.contactId?.nextFollowUpAt;
  const selectedConversationContactId = getContactIdFromConversation(selectedConversation);
  const selectedConversationId = String(
    selectedConversation?.conversationId ||
      selectedConversation?.conversation_id ||
      selectedConversation?.threadConversationId ||
      selectedConversation?._id ||
      selectedConversation?.id ||
      ''
  ).trim();
  const lastActivitiesConversationIdRef = useRef(selectedConversationId);
  const lastDocumentsConversationIdRef = useRef(selectedConversationId);

  useEffect(() => {
    loadCrmActivitiesForContactRef.current = loadCrmActivitiesForContact;
  }, [loadCrmActivitiesForContact]);

  useEffect(() => {
    loadCrmDocumentsForContactRef.current = loadCrmDocumentsForContact;
  }, [loadCrmDocumentsForContact]);

  useEffect(() => {
    setShowContactInfo(false);
    setContactInfoMessage('');
    setContactInfoMessageTone('info');
    setInternalNoteDraft(selectedConversationContactNotes);
    const leadName = String(
      selectedConversationContactName ||
      selectedConversationContactPhone ||
      ''
    ).trim();
    const followUpValue = toDateTimeLocalInputValue(selectedConversationFollowUpAt);
    const followUpDate = followUpValue ? new Date(followUpValue) : null;
    const followUpEndValue =
      followUpDate && !Number.isNaN(followUpDate.getTime())
        ? toDateTimeLocalInputValue(new Date(followUpDate.getTime() + 30 * 60 * 1000))
        : '';
    const defaultMeetTitle = leadName ? `Follow-up with ${leadName}` : '';
    setLeadFollowUpDraft(followUpValue);
    setCrmTaskTitleDraft('');
    setCrmTaskDueDraft(followUpValue);
    setCrmTaskPriorityDraft('medium');
    setCrmDocumentTypeDraft('other');
    setCrmDocuments([]);
    setCrmDocumentsLoading(false);
    setCrmDocumentUploading(false);
    setMeetTokenDraft('');
    setMeetTitleDraft(defaultMeetTitle);
    setMeetStartDraft(followUpValue);
    setMeetEndDraft(followUpEndValue);
    setMeetSending(false);
    setMeetTemplateSending(false);
    setMeetCreateFollowUpTask(false);
    setMeetFollowUpTitleDraft(defaultMeetTitle ? `Follow up: ${defaultMeetTitle}` : '');
    setMeetFollowUpDueDraft(followUpValue);
    setMeetFollowUpPriorityDraft('medium');
    setMeetLink('');
    setCrmActivities([]);
    setCrmActivitiesLoading(false);
  }, [
    selectedConversation?._id,
    selectedConversationContactName,
    selectedConversationContactPhone,
    selectedConversationContactNotes,
    selectedConversationFollowUpAt,
    toDateTimeLocalInputValue,
    setShowContactInfo,
    setContactInfoMessage,
    setContactInfoMessageTone,
    setInternalNoteDraft,
    setLeadFollowUpDraft,
    setCrmTaskTitleDraft,
    setCrmTaskDueDraft,
    setCrmTaskPriorityDraft,
    setCrmDocumentTypeDraft,
    setCrmDocuments,
    setCrmDocumentsLoading,
    setCrmDocumentUploading,
    setMeetTokenDraft,
    setMeetTitleDraft,
    setMeetStartDraft,
    setMeetEndDraft,
    setMeetSending,
    setMeetTemplateSending,
    setMeetCreateFollowUpTask,
    setMeetFollowUpTitleDraft,
    setMeetFollowUpDueDraft,
    setMeetFollowUpPriorityDraft,
    setMeetLink,
    setCrmActivities,
    setCrmActivitiesLoading
  ]);

  useEffect(() => {
    const conversationChanged = lastActivitiesConversationIdRef.current !== selectedConversationId;
    lastActivitiesConversationIdRef.current = selectedConversationId;
    if (!showContactInfo || conversationChanged || !selectedConversationContactId) {
      setCrmActivities([]);
      setCrmActivitiesLoading(false);
      return;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    loadCrmActivitiesForContactRef.current({
      contactId: selectedConversationContactId,
      signal: controller?.signal
    });
    return () => controller?.abort();
  }, [
    selectedConversationId,
    selectedConversationContactId,
    setCrmActivities,
    setCrmActivitiesLoading,
    showContactInfo
  ]);

  useEffect(() => {
    const conversationChanged = lastDocumentsConversationIdRef.current !== selectedConversationId;
    lastDocumentsConversationIdRef.current = selectedConversationId;
    if (!showContactInfo || conversationChanged || !selectedConversationContactId) {
      setCrmDocuments([]);
      setCrmDocumentsLoading(false);
      return;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    loadCrmDocumentsForContactRef.current({
      contactId: selectedConversationContactId,
      signal: controller?.signal
    });
    return () => controller?.abort();
  }, [
    selectedConversationId,
    selectedConversationContactId,
    setCrmDocuments,
    setCrmDocumentsLoading,
    showContactInfo
  ]);
};
