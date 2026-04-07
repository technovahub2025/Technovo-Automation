import { whatsappService } from '../../services/whatsappService';
import { googleCalendarService } from '../../services/googleCalendarService';

export const createMeetIntegrationActions = ({
  meetTokenDraft,
  meetTitleDraft,
  meetStartDraft,
  meetEndDraft,
  meetCreateFollowUpTask,
  meetFollowUpTitleDraft,
  meetFollowUpDueDraft,
  meetFollowUpPriorityDraft,
  meetLink,
  meetAuthConfigured,
  selectedConversation,
  conversationId,
  setConversations,
  setMeetCreating,
  setMeetLink,
  setMeetSending,
  setMeetTemplateSending,
  setMeetAuthConfigured,
  setMeetAuthStatusLoading,
  setMeetDisconnecting,
  setMeetTokenDraft,
  setContactInfoMessage,
  setContactInfoMessageTone,
  appendMessageUnique,
  applyContactUpdateLocally,
  loadCrmActivitiesForContact,
  getContactIdFromConversation,
  getConversationIdValue,
  toIsoFromDateTimeLocalInput,
  formatDateTimeForActivity,
  getTemplateLanguageCode,
  extractTemplateVariableCount
}) => {
  const handleCreateMeetLink = async () => {
    const googleAccessToken = String(meetTokenDraft || '').trim();
    const startDateTime = toIsoFromDateTimeLocalInput(meetStartDraft);
    const endDateTime = toIsoFromDateTimeLocalInput(meetEndDraft);

    if (!googleAccessToken && !meetAuthConfigured) {
      setContactInfoMessage(
        'Google access token is required. Or configure backend Google auth in env.'
      );
      setContactInfoMessageTone('error');
      return;
    }

    if (!startDateTime || !endDateTime) {
      setContactInfoMessage('Start and end date/time are required.');
      setContactInfoMessageTone('error');
      return;
    }

    if (new Date(endDateTime).getTime() <= new Date(startDateTime).getTime()) {
      setContactInfoMessage('End date/time must be later than start date/time.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setMeetCreating(true);
      setContactInfoMessage('');
      const contactName = String(
        selectedConversation?.contactId?.name ||
          selectedConversation?.contactPhone ||
          'Lead'
      ).trim();
      const summary = String(meetTitleDraft || '').trim() || `Follow-up with ${contactName}`;
      const attendeeEmail = String(selectedConversation?.contactId?.email || '').trim();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const contactId = getContactIdFromConversation(selectedConversation);
      const activeConversationId =
        getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
      const followUpDueAt = toIsoFromDateTimeLocalInput(meetFollowUpDueDraft);
      if (
        meetCreateFollowUpTask &&
        String(meetFollowUpDueDraft || '').trim() &&
        !followUpDueAt
      ) {
        throw new Error('Invalid follow-up due date. Please use a valid date and time.');
      }

      const payload = {
        summary,
        startDateTime,
        endDateTime,
        timeZone,
        appendToNotes: true,
        createFollowUpTask: Boolean(meetCreateFollowUpTask)
      };
      if (contactId) payload.contactId = contactId;
      if (activeConversationId) payload.conversationId = activeConversationId;
      if (googleAccessToken) {
        payload.googleAccessToken = googleAccessToken;
      }
      if (meetCreateFollowUpTask) {
        payload.followUpTitle =
          String(meetFollowUpTitleDraft || '').trim() || `Follow up: ${summary}`;
        payload.followUpPriority = meetFollowUpPriorityDraft || 'medium';
        if (followUpDueAt) payload.followUpDueAt = followUpDueAt;
      }
      if (attendeeEmail) {
        payload.attendees = [{ email: attendeeEmail, displayName: contactName }];
      }

      const result = await googleCalendarService.createMeetLink(payload);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to create Google Meet link.');
      }

      const nextMeetLink = String(result?.data?.meetingUrl || '').trim();
      if (!nextMeetLink) {
        throw new Error('Google Meet URL was not returned.');
      }

      setMeetLink(nextMeetLink);
      if (result?.data?.updatedContact) {
        applyContactUpdateLocally(result.data.updatedContact);
      }
      const noteUpdated = Boolean(result?.data?.noteUpdated);
      const followUpTask = result?.data?.followUpTask || null;
      if (followUpTask?.title) {
        setContactInfoMessage(
          noteUpdated
            ? `Google Meet link created, note updated, and follow-up task "${followUpTask.title}" created.`
            : `Google Meet link created and follow-up task "${followUpTask.title}" created.`
        );
      } else {
        setContactInfoMessage(
          noteUpdated
            ? 'Google Meet link created and saved to lead notes.'
            : 'Google Meet link created successfully.'
        );
      }
      setContactInfoMessageTone('success');

      if (contactId) {
        await loadCrmActivitiesForContact({ contactId, silent: true });
      }
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to create Google Meet link.');
      setContactInfoMessageTone('error');
    } finally {
      setMeetCreating(false);
    }
  };

  const handleCopyMeetLink = async () => {
    const value = String(meetLink || '').trim();
    if (!value) return;

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard is not available in this browser.');
      }
      await navigator.clipboard.writeText(value);
      setContactInfoMessage('Meeting link copied to clipboard.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to copy meeting link.');
      setContactInfoMessageTone('error');
    }
  };

  const handleSendMeetLinkToContact = async () => {
    const link = String(meetLink || '').trim();
    const phone = String(selectedConversation?.contactPhone || '').trim();
    const activeConversationId =
      getConversationIdValue(selectedConversation) || String(conversationId || '').trim();

    if (!link) {
      setContactInfoMessage('Create a Meet link first.');
      setContactInfoMessageTone('error');
      return;
    }
    if (!phone || !activeConversationId) {
      setContactInfoMessage('Missing contact or conversation details.');
      setContactInfoMessageTone('error');
      return;
    }

    const messageText = `Join our meeting: ${link}`;
    try {
      setMeetSending(true);
      setContactInfoMessage('');

      const result = await whatsappService.sendMessage(phone, messageText, activeConversationId);
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to send meeting link.');
      }

      const sentMessage = result?.message || result?.data?.message;
      if (sentMessage) {
        appendMessageUnique({ ...sentMessage, status: sentMessage.status || 'sent' });
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          getConversationIdValue(conversation) === activeConversationId
            ? {
                ...conversation,
                lastMessage: messageText,
                lastMessageMediaType: '',
                lastMessageAttachmentName: '',
                lastMessageAttachmentPages: null,
                lastMessageTime: new Date().toISOString(),
                lastMessageFrom: 'agent'
              }
            : conversation
        )
      );
      setContactInfoMessage('Meeting link sent to contact.');
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to send meeting link.');
      setContactInfoMessageTone('error');
    } finally {
      setMeetSending(false);
    }
  };

  const handleSendMeetTemplateToContact = async () => {
    const link = String(meetLink || '').trim();
    const phone = String(selectedConversation?.contactPhone || '').trim();
    const activeConversationId =
      getConversationIdValue(selectedConversation) || String(conversationId || '').trim();
    if (!link) {
      setContactInfoMessage('Create a Meet link first.');
      setContactInfoMessageTone('error');
      return;
    }
    if (!phone || !activeConversationId) {
      setContactInfoMessage('Missing contact or conversation details.');
      setContactInfoMessageTone('error');
      return;
    }

    try {
      setMeetTemplateSending(true);
      setContactInfoMessage('');

      const allTemplates = await whatsappService.getTemplates();
      const templates = Array.isArray(allTemplates) ? allTemplates : [];
      const approvedTemplates = templates.filter((template) =>
        ['APPROVED', 'ACTIVE'].includes(String(template?.status || '').toUpperCase())
      );
      const candidateTemplates = approvedTemplates.length > 0 ? approvedTemplates : templates;
      const preferredName = String(import.meta.env.VITE_MEETING_DETAILS_TEMPLATE_NAME || '')
        .trim()
        .toLowerCase();

      const selectedTemplate = candidateTemplates.find((template) => {
        const templateName = String(template?.name || '').trim().toLowerCase();
        if (!templateName) return false;
        if (preferredName && templateName === preferredName) return true;
        return templateName.includes('meeting') || templateName.includes('meet');
      });

      if (!selectedTemplate) {
        throw new Error(
          'No approved meeting template found. Add template name in VITE_MEETING_DETAILS_TEMPLATE_NAME or create a template containing "meeting".'
        );
      }

      const language = getTemplateLanguageCode(selectedTemplate);
      const variableCount = extractTemplateVariableCount(selectedTemplate);
      const formattedStart = meetStartDraft
        ? formatDateTimeForActivity(toIsoFromDateTimeLocalInput(meetStartDraft))
        : '';
      const defaultValues = [
        String(meetTitleDraft || 'Meeting').trim() || 'Meeting',
        formattedStart || '-',
        link
      ];
      const variables = Array.from({ length: variableCount }, (_, index) => {
        if (defaultValues[index]) return defaultValues[index];
        return link;
      });

      const result = await whatsappService.sendTemplateMessage(
        phone,
        String(selectedTemplate.name || '').trim(),
        language,
        variables,
        activeConversationId
      );
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to send meeting template.');
      }

      const sentMessage = result?.message || result?.data?.message;
      if (sentMessage) {
        appendMessageUnique({ ...sentMessage, status: sentMessage.status || 'sent' });
      }
      setConversations((prev) =>
        prev.map((conversation) =>
          getConversationIdValue(conversation) === activeConversationId
            ? {
                ...conversation,
                lastMessage: `Meeting details shared via template (${selectedTemplate.name})`,
                lastMessageMediaType: '',
                lastMessageAttachmentName: '',
                lastMessageAttachmentPages: null,
                lastMessageTime: new Date().toISOString(),
                lastMessageFrom: 'agent'
              }
            : conversation
        )
      );
      setContactInfoMessage(`Meeting details template "${selectedTemplate.name}" sent successfully.`);
      setContactInfoMessageTone('success');
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to send meeting details template.');
      setContactInfoMessageTone('error');
    } finally {
      setMeetTemplateSending(false);
    }
  };

  const loadMeetAuthStatus = async () => {
    try {
      setMeetAuthStatusLoading(true);
      const result = await googleCalendarService.getAuthStatus();
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to load Google auth status.');
      }
      setMeetAuthConfigured(Boolean(result?.data?.hasBackendGoogleAuth));
    } catch {
      setMeetAuthConfigured(false);
    } finally {
      setMeetAuthStatusLoading(false);
    }
  };

  const handleDisconnectGoogleForMeet = async () => {
    try {
      setMeetDisconnecting(true);
      setContactInfoMessage('');
      const result = await googleCalendarService.disconnect();
      if (result?.success === false) {
        throw new Error(result?.error || 'Failed to disconnect Google Calendar.');
      }
      setMeetTokenDraft('');
      setContactInfoMessage(result?.message || 'Google Calendar disconnected successfully.');
      setContactInfoMessageTone('success');
      await loadMeetAuthStatus();
    } catch (error) {
      setContactInfoMessage(error?.message || 'Failed to disconnect Google Calendar.');
      setContactInfoMessageTone('error');
    } finally {
      setMeetDisconnecting(false);
    }
  };

  return {
    handleCreateMeetLink,
    handleCopyMeetLink,
    handleSendMeetLinkToContact,
    handleSendMeetTemplateToContact,
    loadMeetAuthStatus,
    handleDisconnectGoogleForMeet
  };
};
