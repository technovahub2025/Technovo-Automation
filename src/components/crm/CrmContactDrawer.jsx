import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileStack,
  Flame,
  GitBranch,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Target,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { crmService } from "../../services/crmService";
import { buildPublicWhatsAppOptInDemoUrl } from "../../utils/whatsappOutreachNavigation";
import { getWhatsAppConversationState } from "../../utils/whatsappContactState";
import {
  formatDateTimeForActivity,
  getCrmActivityDescription,
  getCrmActivityLabel,
  toDateTimeLocalInputValue,
  toIsoFromDateTimeLocalInput
} from "../../pages/teamInbox/teamInboxUtils";
import { googleCalendarService } from "../../services/googleCalendarService";
import {
  publishCrmContactSync
} from "../../utils/crmSyncEvents";
import useCrmRealtimeRefresh from "../../hooks/useCrmRealtimeRefresh";
import {
  DEFAULT_PIPELINE_STAGE_OPTIONS,
  normalizePipelineStageOption
} from "../../utils/crmPipelineStages";

const getDefaultStageOptions = () =>
  DEFAULT_PIPELINE_STAGE_OPTIONS.map((stage) => ({
    key: stage.key,
    label: String(stage.label || "").replace(" Lead", "") || "New"
  }));

const TEMPERATURE_OPTIONS = [
  { key: "cold", label: "Cold" },
  { key: "warm", label: "Warm" },
  { key: "hot", label: "Hot" }
];

const DEAL_STAGE_OPTIONS = [
  { key: "discovery", label: "Discovery" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const TASK_PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" }
];

const TASK_TYPES = [
  { key: "follow_up", label: "Follow Up" },
  { key: "call", label: "Call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "meeting", label: "Meeting" },
  { key: "demo", label: "Demo" },
  { key: "other", label: "Other" }
];

const TASK_RECURRENCE_OPTIONS = [
  { key: "none", label: "No Repeat" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" }
];

const getEntityId = (value) => String(value?._id || value?.id || "").trim();

const toProfileForm = (contact = {}) => ({
  name: String(contact?.name || "").trim(),
  email: String(contact?.email || "").trim(),
  source: String(contact?.source || "").trim(),
  temperature: String(contact?.temperature || "warm").trim().toLowerCase() || "warm",
  dealValue:
    Number.isFinite(Number(contact?.dealValue)) && Number(contact?.dealValue) > 0
      ? String(Number(contact.dealValue))
      : "",
  lostReason: String(contact?.lostReason || "").trim(),
  nextFollowUpAt: toDateTimeLocalInputValue(contact?.nextFollowUpAt),
  notes: String(contact?.notes || "").trim()
});

const toQuickTaskForm = () => ({
  title: "",
  description: "",
  priority: "medium",
  taskType: "follow_up",
  dueAt: "",
  reminderAt: "",
  recurrenceFrequency: "none",
  recurrenceInterval: "1",
  comment: ""
});

const toQuickDealForm = (contact = {}) => ({
  title: "",
  stage: "discovery",
  value: "",
  probability: "25",
  expectedCloseAt: "",
  productName: "",
  source: String(contact?.source || "").trim(),
  ownerId: String(contact?.ownerId || "").trim()
});

const toMeetingForm = (contact = {}) => ({
  title: contact?.name ? `Follow-up with ${contact.name}` : "",
  startAt: "",
  endAt: "",
  createFollowUpTask: true,
  followUpTitle: "",
  followUpDueAt: "",
  followUpPriority: "medium"
});

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

const toReadableLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "-";

const resolveContactDocumentName = (document = {}) =>
  String(
    document?.attachment?.originalFileName ||
      document?.title ||
      document?.fileName ||
      "Document"
  ).trim() || "Document";

const CrmContactDrawer = ({
  open,
  contactId,
  initialContact = null,
  currentUserId = "",
  onClose,
  onContactUpdated,
  onTaskMutation,
  onDealMutation,
  onStartWhatsApp
}) => {
  const fileInputRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [profileForm, setProfileForm] = useState(() => toProfileForm(initialContact));
  const [ownerDraft, setOwnerDraft] = useState(String(initialContact?.ownerId || "").trim());
  const [quickTaskForm, setQuickTaskForm] = useState(() => toQuickTaskForm());
  const [quickDealForm, setQuickDealForm] = useState(() => toQuickDealForm(initialContact));
  const [meetingForm, setMeetingForm] = useState(() => toMeetingForm(initialContact));
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [leadStageOptions, setLeadStageOptions] = useState(getDefaultStageOptions());
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [taskBusyId, setTaskBusyId] = useState("");
  const [dealBusyId, setDealBusyId] = useState("");
  const [documentBusyId, setDocumentBusyId] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);

  const currentContact = useMemo(() => detail || initialContact || {}, [detail, initialContact]);
  const normalizedContactId = useMemo(
    () => String(contactId || getEntityId(currentContact)).trim(),
    [contactId, currentContact]
  );
  const whatsappState = useMemo(
    () => getWhatsAppConversationState(currentContact),
    [currentContact]
  );

  const syncFormState = useCallback((contact = {}) => {
    setProfileForm(toProfileForm(contact));
    setOwnerDraft(String(contact?.ownerId || "").trim());
    setQuickDealForm(toQuickDealForm(contact));
    setMeetingForm((previous) => ({
      ...previous,
      ...toMeetingForm(contact),
      startAt: previous?.startAt || "",
      endAt: previous?.endAt || "",
      createFollowUpTask:
        previous?.createFollowUpTask === undefined ? true : previous.createFollowUpTask,
      followUpTitle: previous?.followUpTitle || "",
      followUpDueAt: previous?.followUpDueAt || "",
      followUpPriority: previous?.followUpPriority || "medium"
    }));
  }, []);

  const applyContactUpdate = useCallback(
    (updatedContact = {}) => {
      setDetail((previous) => ({
        ...(previous || {}),
        ...updatedContact
      }));
      syncFormState({
        ...currentContact,
        ...updatedContact
      });
      if (typeof onContactUpdated === "function") {
        onContactUpdated({
          ...currentContact,
          ...updatedContact
        });
      }
    },
    [currentContact, onContactUpdated, syncFormState]
  );

  const loadDetail = useCallback(
    async ({ silent = false } = {}) => {
      if (!normalizedContactId) return;
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setMessage("");

        const result = await crmService.getContact(normalizedContactId);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to load contact details");
        }

        const nextDetail = result?.data || null;
        setDetail(nextDetail);
        syncFormState(nextDetail || {});
      } catch (error) {
        setMessage(error?.message || "Failed to load contact details");
        setMessageTone("error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [normalizedContactId, syncFormState]
  );

  useEffect(() => {
    if (!open || !normalizedContactId) return;
    loadDetail();
  }, [loadDetail, normalizedContactId, open]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    crmService.getPipelineStages().then((result) => {
      if (cancelled) return;
      if (result?.success === false) return;

      const nextStages = Array.isArray(result?.data?.stages) && result.data.stages.length
        ? result.data.stages.map((stage, index) =>
            normalizePipelineStageOption(stage, index)
          ).map((stage) => ({
            key: stage.key,
            label: String(stage.label || "").replace(" Lead", "") || "New"
          }))
        : getDefaultStageOptions();
      setLeadStageOptions(nextStages);
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useCrmRealtimeRefresh({
    currentUserId,
    contactId: normalizedContactId,
    enabled: open && Boolean(normalizedContactId),
    onRefresh: () => loadDetail({ silent: true })
  });

  useEffect(() => {
    if (!open) return;
    syncFormState(currentContact);
  }, [currentContact, open, syncFormState]);

  const showMessage = useCallback((text, tone = "success") => {
    setMessage(String(text || "").trim());
    setMessageTone(tone);
  }, []);

  const publishDetailSync = useCallback(
    (reason = "crm_contact_updated") => {
      if (!normalizedContactId) return;
      publishCrmContactSync({
        contactId: normalizedContactId,
        conversationId: getEntityId(detail?.recentConversation),
        reason
      });
    },
    [detail?.recentConversation, normalizedContactId]
  );

  const handleCopyOptInLink = useCallback(async () => {
    const link = buildPublicWhatsAppOptInDemoUrl(currentContact, {
      source: "crm_contact_drawer",
      scope: "marketing"
    });
    if (!link) {
      showMessage("Unable to generate public opt-in link.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      showMessage("Public opt-in link copied.");
    } catch {
      showMessage("Clipboard blocked. Open the opt-in page and copy the link manually.", "error");
    }
  }, [currentContact, showMessage]);

  const handleOpenOptInLink = useCallback(() => {
    const link = buildPublicWhatsAppOptInDemoUrl(currentContact, {
      source: "crm_contact_drawer",
      scope: "marketing"
    });
    if (!link) {
      showMessage("Unable to generate public opt-in link.", "error");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  }, [currentContact, showMessage]);

  const handleStageChange = useCallback(
    async (nextStage) => {
      if (!normalizedContactId || !nextStage) return;
      try {
        setStageUpdating(true);
        setMessage("");
        const result = await crmService.updateContactStage(normalizedContactId, nextStage);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update stage");
        }
        applyContactUpdate(result?.data || { stage: nextStage });
        await loadDetail({ silent: true });
        publishDetailSync("crm_stage_updated");
        showMessage("Lead stage updated.");
      } catch (error) {
        showMessage(error?.message || "Failed to update stage", "error");
      } finally {
        setStageUpdating(false);
      }
    },
    [applyContactUpdate, loadDetail, normalizedContactId, publishDetailSync, showMessage]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!normalizedContactId) return;
    try {
      setSavingProfile(true);
      setMessage("");

      const payload = {
        name: profileForm.name,
        email: profileForm.email,
        source: profileForm.source,
        temperature: profileForm.temperature,
        dealValue: profileForm.dealValue ? Number(profileForm.dealValue) : 0,
        lostReason: profileForm.lostReason,
        nextFollowUpAt: profileForm.nextFollowUpAt
          ? toIsoFromDateTimeLocalInput(profileForm.nextFollowUpAt)
          : null,
        notes: profileForm.notes
      };

      const result = await crmService.updateContactProfile(normalizedContactId, payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to update contact profile");
      }

      applyContactUpdate(result?.data || payload);
      await loadDetail({ silent: true });
      publishDetailSync("crm_profile_updated");
      showMessage("Contact profile updated.");
    } catch (error) {
      showMessage(error?.message || "Failed to update contact profile", "error");
    } finally {
      setSavingProfile(false);
    }
  }, [applyContactUpdate, loadDetail, normalizedContactId, profileForm, publishDetailSync, showMessage]);

  const saveOwner = useCallback(
    async (ownerId) => {
      if (!normalizedContactId) return;
      try {
        setSavingOwner(true);
        setMessage("");
        const result = await crmService.updateContactOwner(normalizedContactId, ownerId || null);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update owner");
        }
        applyContactUpdate(result?.data || { ownerId: ownerId || null });
        await loadDetail({ silent: true });
        publishDetailSync("crm_owner_updated");
        showMessage(ownerId ? "Lead owner updated." : "Lead is now unassigned.");
      } catch (error) {
        showMessage(error?.message || "Failed to update owner", "error");
      } finally {
        setSavingOwner(false);
      }
    },
    [applyContactUpdate, loadDetail, normalizedContactId, publishDetailSync, showMessage]
  );

  const handleCreateTask = useCallback(async () => {
    if (!normalizedContactId) return;
    try {
      setTaskSubmitting(true);
      setMessage("");

      if (!String(quickTaskForm.title || "").trim()) {
        throw new Error("Task title is required");
      }

      const payload = {
        contactId: normalizedContactId,
        title: String(quickTaskForm.title || "").trim(),
        description: String(quickTaskForm.description || "").trim(),
        priority: quickTaskForm.priority || "medium",
        taskType: quickTaskForm.taskType || "follow_up",
        assignedTo: String(ownerDraft || currentContact?.ownerId || "").trim() || null
      };

      if (quickTaskForm.dueAt) {
        payload.dueAt = toIsoFromDateTimeLocalInput(quickTaskForm.dueAt);
      }
      if (quickTaskForm.reminderAt) {
        payload.reminderAt = toIsoFromDateTimeLocalInput(quickTaskForm.reminderAt);
      }
      if (quickTaskForm.recurrenceFrequency && quickTaskForm.recurrenceFrequency !== "none") {
        payload.recurrence = {
          frequency: quickTaskForm.recurrenceFrequency,
          interval: Math.max(Number(quickTaskForm.recurrenceInterval) || 1, 1)
        };
      }
      if (String(quickTaskForm.comment || "").trim()) {
        payload.comment = String(quickTaskForm.comment || "").trim();
      }

      const result = await crmService.createTask(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to create task");
      }

      setQuickTaskForm(toQuickTaskForm());
      await loadDetail({ silent: true });
      if (typeof onTaskMutation === "function") {
        onTaskMutation();
      }
      publishDetailSync("crm_task_created");
      showMessage("Follow-up task created.");
    } catch (error) {
      showMessage(error?.message || "Failed to create task", "error");
    } finally {
      setTaskSubmitting(false);
    }
  }, [currentContact?.ownerId, loadDetail, normalizedContactId, onTaskMutation, ownerDraft, publishDetailSync, quickTaskForm, showMessage]);

  const handleCreateDeal = useCallback(async () => {
    if (!normalizedContactId) return;
    try {
      setDealSubmitting(true);
      setMessage("");

      if (!String(quickDealForm.title || "").trim()) {
        throw new Error("Deal title is required");
      }

      const payload = {
        contactId: normalizedContactId,
        title: String(quickDealForm.title || "").trim(),
        stage: quickDealForm.stage || "discovery",
        status: ["won", "lost"].includes(quickDealForm.stage) ? quickDealForm.stage : "open",
        value: quickDealForm.value ? Number(quickDealForm.value) : 0,
        probability: quickDealForm.probability ? Number(quickDealForm.probability) : 0,
        productName: String(quickDealForm.productName || "").trim(),
        source: String(quickDealForm.source || "").trim(),
        ownerId: String(quickDealForm.ownerId || "").trim() || null
      };

      if (quickDealForm.expectedCloseAt) {
        payload.expectedCloseAt = toIsoFromDateTimeLocalInput(quickDealForm.expectedCloseAt);
      }

      const result = await crmService.createDeal(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to create deal");
      }

      setQuickDealForm(toQuickDealForm(currentContact));
      await loadDetail({ silent: true });
      if (typeof onDealMutation === "function") {
        onDealMutation();
      }
      publishDetailSync("crm_deal_created");
      showMessage("Deal created.");
    } catch (error) {
      showMessage(error?.message || "Failed to create deal", "error");
    } finally {
      setDealSubmitting(false);
    }
  }, [currentContact, loadDetail, normalizedContactId, onDealMutation, publishDetailSync, quickDealForm, showMessage]);

  const handleDealStatusChange = useCallback(async (deal, nextStatus) => {
    const normalizedDealId = getEntityId(deal);
    if (!normalizedDealId) return;

    try {
      setDealBusyId(normalizedDealId);
      setMessage("");
      const result = await crmService.updateDeal(normalizedDealId, {
        status: nextStatus,
        stage: nextStatus === "won" ? "won" : nextStatus === "lost" ? "lost" : deal?.stage || "discovery"
      });
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to update deal");
      }
      await loadDetail({ silent: true });
      if (typeof onDealMutation === "function") {
        onDealMutation();
      }
      publishDetailSync(nextStatus === "won" ? "crm_deal_won" : nextStatus === "lost" ? "crm_deal_lost" : "crm_deal_updated");
      showMessage(nextStatus === "won" ? "Deal marked won." : nextStatus === "lost" ? "Deal marked lost." : "Deal updated.");
    } catch (error) {
      showMessage(error?.message || "Failed to update deal", "error");
    } finally {
      setDealBusyId("");
    }
  }, [loadDetail, onDealMutation, publishDetailSync, showMessage]);

  const handleDeleteDeal = useCallback(async (deal) => {
    const normalizedDealId = getEntityId(deal);
    if (!normalizedDealId) return;

    try {
      setDealBusyId(normalizedDealId);
      setMessage("");
      const result = await crmService.deleteDeal(normalizedDealId);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to delete deal");
      }
      await loadDetail({ silent: true });
      if (typeof onDealMutation === "function") {
        onDealMutation();
      }
      publishDetailSync("crm_deal_deleted");
      showMessage("Deal deleted.");
    } catch (error) {
      showMessage(error?.message || "Failed to delete deal", "error");
    } finally {
      setDealBusyId("");
    }
  }, [loadDetail, onDealMutation, publishDetailSync, showMessage]);

  const handleCreateMeeting = useCallback(async () => {
    if (!normalizedContactId) return;
    try {
      setMeetingSubmitting(true);
      setMessage("");

      const startDateTime = toIsoFromDateTimeLocalInput(meetingForm.startAt);
      const endDateTime = toIsoFromDateTimeLocalInput(meetingForm.endAt);
      if (!startDateTime || !endDateTime) {
        throw new Error("Meeting start and end time are required");
      }
      if (new Date(endDateTime).getTime() <= new Date(startDateTime).getTime()) {
        throw new Error("Meeting end time must be later than start time");
      }

      const payload = {
        contactId: normalizedContactId,
        conversationId: getEntityId(detail?.recentConversation),
        summary:
          String(meetingForm.title || "").trim() ||
          `Follow-up with ${currentContact?.name || currentContact?.phone || "Lead"}`,
        startDateTime,
        endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
        appendToNotes: true,
        createFollowUpTask: Boolean(meetingForm.createFollowUpTask)
      };

      const attendeeEmail = String(currentContact?.email || "").trim();
      const attendeeName = String(currentContact?.name || currentContact?.phone || "Lead").trim();
      if (attendeeEmail) {
        payload.attendees = [{ email: attendeeEmail, displayName: attendeeName }];
      }
      if (meetingForm.createFollowUpTask) {
        payload.followUpTitle =
          String(meetingForm.followUpTitle || "").trim() ||
          `Follow up: ${payload.summary}`;
        payload.followUpPriority = meetingForm.followUpPriority || "medium";
        if (meetingForm.followUpDueAt) {
          payload.followUpDueAt = toIsoFromDateTimeLocalInput(meetingForm.followUpDueAt);
        }
      }

      const result = await googleCalendarService.createMeetLink(payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to schedule meeting");
      }

      if (result?.data?.updatedContact) {
        applyContactUpdate(result.data.updatedContact);
      }
      setMeetingForm(toMeetingForm(currentContact));
      await loadDetail({ silent: true });
      if (typeof onTaskMutation === "function" && result?.data?.followUpTask) {
        onTaskMutation();
      }
      publishDetailSync("crm_meeting_scheduled");
      showMessage("Meeting scheduled.");
    } catch (error) {
      showMessage(error?.message || "Failed to schedule meeting", "error");
    } finally {
      setMeetingSubmitting(false);
    }
  }, [
    applyContactUpdate,
    currentContact,
    detail?.recentConversation,
    loadDetail,
    meetingForm,
    normalizedContactId,
    onTaskMutation,
    publishDetailSync,
    showMessage
  ]);

  const handleTaskStatusChange = useCallback(
    async (task, nextStatus) => {
      const taskId = getEntityId(task);
      if (!taskId) return;
      try {
        setTaskBusyId(taskId);
        setMessage("");
        const result = await crmService.updateTask(taskId, { status: nextStatus });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to update task");
        }
        await loadDetail({ silent: true });
        if (typeof onTaskMutation === "function") {
          onTaskMutation();
        }
        publishDetailSync(nextStatus === "completed" ? "crm_task_completed" : "crm_task_updated");
        showMessage(nextStatus === "completed" ? "Task completed." : "Task updated.");
      } catch (error) {
        showMessage(error?.message || "Failed to update task", "error");
      } finally {
        setTaskBusyId("");
      }
    },
    [loadDetail, onTaskMutation, publishDetailSync, showMessage]
  );

  const handleDeleteTask = useCallback(
    async (task) => {
      const taskId = getEntityId(task);
      if (!taskId) return;
      try {
        setTaskBusyId(taskId);
        setMessage("");
        const result = await crmService.deleteTask(taskId);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete task");
        }
        await loadDetail({ silent: true });
        if (typeof onTaskMutation === "function") {
          onTaskMutation();
        }
        publishDetailSync("crm_task_deleted");
        showMessage("Task deleted.");
      } catch (error) {
        showMessage(error?.message || "Failed to delete task", "error");
      } finally {
        setTaskBusyId("");
      }
    },
    [loadDetail, onTaskMutation, publishDetailSync, showMessage]
  );

  const openDocumentInMode = useCallback(
    async (documentId, mode = "view") => {
      if (!documentId) return;
      try {
        setDocumentBusyId(documentId);
        const result = await crmService.getContactDocumentAccess(documentId, mode);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to open document");
        }
        const nextUrl = String(result?.data?.url || "").trim();
        if (!nextUrl) {
          throw new Error("Document URL is unavailable");
        }
        window.open(nextUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        showMessage(error?.message || "Failed to open document", "error");
      } finally {
        setDocumentBusyId("");
      }
    },
    [showMessage]
  );

  const handleDeleteDocument = useCallback(
    async (documentId) => {
      if (!documentId) return;
      try {
        setDocumentBusyId(documentId);
        const result = await crmService.deleteContactDocument(documentId);
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to delete document");
        }
        await loadDetail({ silent: true });
        publishDetailSync("crm_document_deleted");
        showMessage("Document deleted.");
      } catch (error) {
        showMessage(error?.message || "Failed to delete document", "error");
      } finally {
        setDocumentBusyId("");
      }
    },
    [loadDetail, publishDetailSync, showMessage]
  );

  const handleUploadDocument = useCallback(
    async (file) => {
      if (!normalizedContactId || !file) return;
      try {
        setDocumentUploading(true);
        setMessage("");
        const result = await crmService.uploadContactDocument(normalizedContactId, {
          file,
          documentType: "other",
          title: file.name
        });
        if (result?.success === false) {
          throw new Error(result?.error || "Failed to upload document");
        }
        await loadDetail({ silent: true });
        publishDetailSync("crm_document_uploaded");
        showMessage("Document uploaded.");
      } catch (error) {
        showMessage(error?.message || "Failed to upload document", "error");
      } finally {
        setDocumentUploading(false);
      }
    },
    [loadDetail, normalizedContactId, publishDetailSync, showMessage]
  );

  const handleDocumentFileChange = useCallback(
    async (event) => {
      const file = event?.target?.files?.[0] || null;
      if (file) {
        await handleUploadDocument(file);
      }
      if (event?.target) {
        event.target.value = "";
      }
    },
    [handleUploadDocument]
  );

  if (!open) return null;

  const sourceAttribution = detail?.sourceAttribution || {};
  const consentAudit = detail?.consentAudit || {};
  const leadScoringInsight = detail?.leadScoring || {};
  const timelineItems = Array.isArray(detail?.timeline) ? detail.timeline : [];

  return (
    <div className="crm-drawer-shell" role="dialog" aria-modal="true">
      <button type="button" className="crm-drawer-backdrop" onClick={onClose} aria-label="Close CRM contact drawer" />
      <aside className="crm-contact-drawer">
        <div className="crm-contact-drawer-header">
          <div>
            <p className="crm-contact-drawer-kicker">Contact 360</p>
            <h2>{currentContact?.name || "Unknown Contact"}</h2>
            <div className="crm-contact-drawer-subtitle">
              <span>{currentContact?.phone || "-"}</span>
              <span>{currentContact?.email || "No email"}</span>
            </div>
          </div>
          <div className="crm-contact-drawer-header-actions">
            <button
              type="button"
              className="crm-btn crm-btn-secondary"
              onClick={() => loadDetail({ silent: true })}
              disabled={refreshing || loading}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Close CRM drawer">
              <X size={18} />
            </button>
          </div>
        </div>

        {message && (
          <div className={`crm-alert ${messageTone === "error" ? "crm-alert-error" : "crm-alert-success"}`}>
            {message}
          </div>
        )}

        {loading && !detail ? (
          <div className="crm-loading">Loading contact details...</div>
        ) : (
          <div className="crm-contact-drawer-body">
            <section className="crm-contact-hero">
              <div className="crm-contact-hero-main">
                <div className="crm-contact-chip-row">
                  <span className={`crm-status-badge status-${String(currentContact?.status || "nurturing").toLowerCase()}`}>
                    {String(currentContact?.status || "nurturing")}
                  </span>
                  <span className={`crm-temperature-badge crm-temperature-badge--${String(currentContact?.temperature || "warm").toLowerCase()}`}>
                    <Flame size={13} />
                    {String(currentContact?.temperature || "warm")}
                  </span>
                  <span className={`crm-whatsapp-badge crm-whatsapp-badge--${whatsappState?.badgeTone || "template-only"}`}>
                    {whatsappState?.statusLabel || "Template Only"}
                  </span>
                </div>
                <div className="crm-contact-stats">
                  <div>
                    <strong>{Number(currentContact?.leadScore || 0)}</strong>
                    <span>Lead Score</span>
                  </div>
                  <div>
                    <strong>{formatCurrency(currentContact?.dealValue)}</strong>
                    <span>Deal Value</span>
                  </div>
                  <div>
                    <strong>{currentContact?.ownerId || "-"}</strong>
                    <span>Owner</span>
                  </div>
                  <div>
                    <strong>{formatDateTime(currentContact?.nextFollowUpAt)}</strong>
                    <span>Next Follow-up</span>
                  </div>
                </div>
              </div>

              <div className="crm-contact-action-grid">
                <button
                  type="button"
                  className="crm-contact-action-btn"
                  onClick={() => onStartWhatsApp?.(currentContact)}
                  disabled={Boolean(whatsappState?.optedOut)}
                >
                  <Send size={14} />
                  Start WhatsApp
                </button>
                <button type="button" className="crm-contact-action-btn crm-contact-action-btn--secondary" onClick={handleCopyOptInLink}>
                  <Copy size={14} />
                  Copy Opt-In
                </button>
                <button type="button" className="crm-contact-action-btn crm-contact-action-btn--secondary" onClick={handleOpenOptInLink}>
                  <ExternalLink size={14} />
                  Open Opt-In
                </button>
              </div>
            </section>

            <div className="crm-contact-drawer-grid">
              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <UserRound size={16} />
                    Overview
                  </h3>
                </div>

                <div className="crm-drawer-form-grid">
                  <label className="crm-field">
                    <span>Name</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((previous) => ({ ...previous, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Email</span>
                    <input
                      type="email"
                      className="crm-input"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((previous) => ({ ...previous, email: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Stage</span>
                    <select
                      className="crm-select"
                      value={String(currentContact?.stage || "new").toLowerCase()}
                      onChange={(event) => handleStageChange(event.target.value)}
                      disabled={stageUpdating}
                    >
                      {leadStageOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Owner ID</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={ownerDraft}
                      onChange={(event) => setOwnerDraft(event.target.value)}
                      placeholder="Mongo user id or team id"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Temperature</span>
                    <select
                      className="crm-select"
                      value={profileForm.temperature}
                      onChange={(event) =>
                        setProfileForm((previous) => ({ ...previous, temperature: event.target.value }))
                      }
                    >
                      {TEMPERATURE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Deal Value</span>
                    <input
                      type="number"
                      min="0"
                      className="crm-input"
                      value={profileForm.dealValue}
                      onChange={(event) =>
                        setProfileForm((previous) => ({ ...previous, dealValue: event.target.value }))
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Source</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={profileForm.source}
                      onChange={(event) =>
                        setProfileForm((previous) => ({ ...previous, source: event.target.value }))
                      }
                      placeholder="Meta Ads / Website / Referral"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Next Follow-up</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={profileForm.nextFollowUpAt}
                      onChange={(event) =>
                        setProfileForm((previous) => ({
                          ...previous,
                          nextFollowUpAt: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="crm-field">
                  <span>Lost Reason</span>
                  <input
                    type="text"
                    className="crm-input"
                    value={profileForm.lostReason}
                    onChange={(event) =>
                      setProfileForm((previous) => ({ ...previous, lostReason: event.target.value }))
                    }
                    placeholder="Reason if this lead is lost"
                  />
                </label>

                <label className="crm-field">
                  <span>Internal Notes</span>
                  <textarea
                    className="crm-textarea"
                    rows={4}
                    value={profileForm.notes}
                    onChange={(event) =>
                      setProfileForm((previous) => ({ ...previous, notes: event.target.value }))
                    }
                    placeholder="Notes about this lead..."
                  />
                </label>

                <div className="crm-drawer-actions">
                  <button type="button" className="crm-btn crm-btn-primary" onClick={handleSaveProfile} disabled={savingProfile}>
                    <NotebookPen size={15} />
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={() => saveOwner(ownerDraft.trim())} disabled={savingOwner}>
                    <UserRound size={15} />
                    {savingOwner ? "Saving..." : "Save Owner"}
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={() => saveOwner(currentUserId)} disabled={!currentUserId || savingOwner}>
                    Assign To Me
                  </button>
                  <button type="button" className="crm-btn crm-btn-secondary" onClick={() => saveOwner("")} disabled={savingOwner}>
                    Unassign
                  </button>
                </div>
              </section>

              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <CalendarClock size={16} />
                    Follow-up Center
                  </h3>
                </div>

                <div className="crm-summary-grid crm-summary-grid--compact">
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.open || 0)}</strong>
                    <span>Open</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.overdue || 0)}</strong>
                    <span>Overdue</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.dueToday || 0)}</strong>
                    <span>Due Today</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.highPriority || 0)}</strong>
                    <span>High Priority</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.todayCalls || 0)}</strong>
                    <span>Today Calls</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.taskSummary?.followUpCompletionRate || 0)}%</strong>
                    <span>Follow-up Rate</span>
                  </div>
                </div>

                <div className="crm-drawer-form-grid">
                  <label className="crm-field crm-field--span-2">
                    <span>Task Title</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={quickTaskForm.title}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Call back lead / send proposal / book demo"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Task Type</span>
                    <select
                      className="crm-select"
                      value={quickTaskForm.taskType}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({ ...previous, taskType: event.target.value }))
                      }
                    >
                      {TASK_TYPES.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Priority</span>
                    <select
                      className="crm-select"
                      value={quickTaskForm.priority}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({ ...previous, priority: event.target.value }))
                      }
                    >
                      {TASK_PRIORITIES.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Due At</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={quickTaskForm.dueAt}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({ ...previous, dueAt: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Reminder</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={quickTaskForm.reminderAt}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({
                          ...previous,
                          reminderAt: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Repeat</span>
                    <select
                      className="crm-select"
                      value={quickTaskForm.recurrenceFrequency}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({
                          ...previous,
                          recurrenceFrequency: event.target.value
                        }))
                      }
                    >
                      {TASK_RECURRENCE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Repeat Every</span>
                    <input
                      type="number"
                      min="1"
                      className="crm-input"
                      value={quickTaskForm.recurrenceInterval}
                      onChange={(event) =>
                        setQuickTaskForm((previous) => ({
                          ...previous,
                          recurrenceInterval: event.target.value
                        }))
                      }
                      disabled={quickTaskForm.recurrenceFrequency === "none"}
                    />
                  </label>
                </div>

                <label className="crm-field">
                  <span>Description</span>
                  <textarea
                    className="crm-textarea"
                    rows={3}
                    value={quickTaskForm.description}
                    onChange={(event) =>
                      setQuickTaskForm((previous) => ({
                        ...previous,
                        description: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="crm-field">
                  <span>Initial Comment</span>
                  <textarea
                    className="crm-textarea"
                    rows={2}
                    value={quickTaskForm.comment}
                    onChange={(event) =>
                      setQuickTaskForm((previous) => ({
                        ...previous,
                        comment: event.target.value
                      }))
                    }
                    placeholder="Internal context for the assignee"
                  />
                </label>

                <button type="button" className="crm-btn crm-btn-primary" onClick={handleCreateTask} disabled={taskSubmitting}>
                  {taskSubmitting ? "Creating..." : "Create Follow-up Task"}
                </button>

                <div className="crm-drawer-list">
                  {(detail?.recentTasks || []).map((task) => {
                    const taskId = getEntityId(task);
                    const isBusy = taskBusyId === taskId;
                    const isCompleted = String(task?.status || "").toLowerCase() === "completed";
                    return (
                      <article key={taskId} className="crm-drawer-list-item">
                        <div>
                          <strong>{task?.title || "Untitled task"}</strong>
                          <span>
                            {String(task?.taskType || "follow_up")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (character) => character.toUpperCase())}
                            {" • "}
                            {task?.priority || "medium"}
                            {" • "}
                            {formatDateTime(task?.dueAt)}
                          </span>
                        </div>
                        <div className="crm-inline-actions">
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() =>
                              handleTaskStatusChange(task, isCompleted ? "pending" : "completed")
                            }
                            disabled={isBusy}
                            title={isCompleted ? "Mark pending" : "Mark completed"}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn crm-inline-action-btn--danger"
                            onClick={() => handleDeleteTask(task)}
                            disabled={isBusy}
                            title="Delete task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!detail?.recentTasks?.length && <p className="crm-activity-empty">No follow-up tasks for this lead yet.</p>}
                </div>
              </section>

              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <CalendarClock size={16} />
                    Meetings
                  </h3>
                </div>

                <div className="crm-drawer-form-grid">
                  <label className="crm-field crm-field--span-2">
                    <span>Meeting Title</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={meetingForm.title}
                      onChange={(event) =>
                        setMeetingForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Follow-up with lead"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Start</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={meetingForm.startAt}
                      onChange={(event) =>
                        setMeetingForm((previous) => ({ ...previous, startAt: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>End</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={meetingForm.endAt}
                      onChange={(event) =>
                        setMeetingForm((previous) => ({ ...previous, endAt: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field crm-field--span-2">
                    <span className="crm-field-inline">
                      <input
                        type="checkbox"
                        checked={Boolean(meetingForm.createFollowUpTask)}
                        onChange={(event) =>
                          setMeetingForm((previous) => ({
                            ...previous,
                            createFollowUpTask: event.target.checked
                          }))
                        }
                      />
                      Create follow-up task after meeting
                    </span>
                  </label>
                  {meetingForm.createFollowUpTask && (
                    <>
                      <label className="crm-field crm-field--span-2">
                        <span>Follow-up Task Title</span>
                        <input
                          type="text"
                          className="crm-input"
                          value={meetingForm.followUpTitle}
                          onChange={(event) =>
                            setMeetingForm((previous) => ({
                              ...previous,
                              followUpTitle: event.target.value
                            }))
                          }
                          placeholder="Follow up after meeting"
                        />
                      </label>
                      <label className="crm-field">
                        <span>Follow-up Due</span>
                        <input
                          type="datetime-local"
                          className="crm-input"
                          value={meetingForm.followUpDueAt}
                          onChange={(event) =>
                            setMeetingForm((previous) => ({
                              ...previous,
                              followUpDueAt: event.target.value
                            }))
                          }
                        />
                      </label>
                      <label className="crm-field">
                        <span>Priority</span>
                        <select
                          className="crm-select"
                          value={meetingForm.followUpPriority}
                          onChange={(event) =>
                            setMeetingForm((previous) => ({
                              ...previous,
                              followUpPriority: event.target.value
                            }))
                          }
                        >
                          {TASK_PRIORITIES.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={handleCreateMeeting}
                  disabled={meetingSubmitting}
                >
                  {meetingSubmitting ? "Scheduling..." : "Schedule Meeting"}
                </button>

                <div className="crm-drawer-list">
                  {(detail?.recentMeetings || []).map((meeting, index) => {
                    const meetingId = getEntityId(meeting) || `meeting-${index}`;
                    return (
                      <article key={meetingId} className="crm-drawer-list-item">
                        <div>
                          <strong>{String(meeting?.meta?.summary || "Scheduled meeting").trim()}</strong>
                          <span>{formatDateTime(meeting?.meta?.start || meeting?.createdAt)}</span>
                          <span>{String(meeting?.meta?.meetingUrl || "").trim() || "Meet link generated"}</span>
                        </div>
                      </article>
                    );
                  })}
                  {!detail?.recentMeetings?.length && (
                    <p className="crm-activity-empty">No meetings scheduled for this contact yet.</p>
                  )}
                </div>
              </section>

              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <BadgeDollarSign size={16} />
                    Deals
                  </h3>
                </div>

                <div className="crm-summary-grid crm-summary-grid--compact">
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.dealSummary?.open || 0)}</strong>
                    <span>Open</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{Number(detail?.dealSummary?.won || 0)}</strong>
                    <span>Won</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{formatCurrency(detail?.dealSummary?.pipelineValue)}</strong>
                    <span>Pipeline</span>
                  </div>
                  <div className="crm-summary-card">
                    <strong>{formatCurrency(detail?.dealSummary?.wonValue)}</strong>
                    <span>Won Value</span>
                  </div>
                </div>

                <div className="crm-drawer-form-grid">
                  <label className="crm-field crm-field--span-2">
                    <span>Deal Title</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={quickDealForm.title}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({ ...previous, title: event.target.value }))
                      }
                      placeholder="Website redesign / yearly support / onboarding package"
                    />
                  </label>
                  <label className="crm-field">
                    <span>Stage</span>
                    <select
                      className="crm-select"
                      value={quickDealForm.stage}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({ ...previous, stage: event.target.value }))
                      }
                    >
                      {DEAL_STAGE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span>Value</span>
                    <input
                      type="number"
                      min="0"
                      className="crm-input"
                      value={quickDealForm.value}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({ ...previous, value: event.target.value }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Probability</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="crm-input"
                      value={quickDealForm.probability}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({
                          ...previous,
                          probability: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Expected Close</span>
                    <input
                      type="datetime-local"
                      className="crm-input"
                      value={quickDealForm.expectedCloseAt}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({
                          ...previous,
                          expectedCloseAt: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Product / Service</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={quickDealForm.productName}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({
                          ...previous,
                          productName: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="crm-field">
                    <span>Owner ID</span>
                    <input
                      type="text"
                      className="crm-input"
                      value={quickDealForm.ownerId}
                      onChange={(event) =>
                        setQuickDealForm((previous) => ({ ...previous, ownerId: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="crm-btn crm-btn-primary"
                  onClick={handleCreateDeal}
                  disabled={dealSubmitting}
                >
                  {dealSubmitting ? "Creating..." : "Create Deal"}
                </button>

                <div className="crm-drawer-list">
                  {(detail?.recentDeals || []).map((deal) => {
                    const normalizedDealId = getEntityId(deal);
                    const isBusy = dealBusyId === normalizedDealId;
                    const isWon = String(deal?.status || "").toLowerCase() === "won";
                    const isLost = String(deal?.status || "").toLowerCase() === "lost";
                    return (
                      <article key={normalizedDealId} className="crm-drawer-list-item">
                        <div>
                          <strong>{deal?.title || "Untitled deal"}</strong>
                          <span>
                            {formatCurrency(deal?.value)}
                            {" | "}
                            {String(deal?.stage || "discovery").replace(/\b\w/g, (character) => character.toUpperCase())}
                            {" | "}
                            {Number(deal?.probability || 0)}%
                          </span>
                        </div>
                        <div className="crm-inline-actions">
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() => handleDealStatusChange(deal, isWon ? "open" : "won")}
                            disabled={isBusy}
                            title={isWon ? "Reopen deal" : "Mark won"}
                          >
                            <BadgeDollarSign size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() => handleDealStatusChange(deal, isLost ? "open" : "lost")}
                            disabled={isBusy}
                            title={isLost ? "Reopen deal" : "Mark lost"}
                          >
                            <CalendarClock size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn crm-inline-action-btn--danger"
                            onClick={() => handleDeleteDeal(deal)}
                            disabled={isBusy}
                            title="Delete deal"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!detail?.recentDeals?.length && (
                    <p className="crm-activity-empty">No deals attached to this contact yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="crm-contact-drawer-grid crm-contact-drawer-grid--secondary">
              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <Target size={16} />
                    Lead Score & Source
                  </h3>
                </div>
                <div className="crm-insight-grid">
                  <div className="crm-insight-item">
                    <span>Lead Score</span>
                    <strong>{Number(leadScoringInsight?.score || 0)}</strong>
                  </div>
                  <div className="crm-insight-item">
                    <span>Read Points</span>
                    <strong>{Number(leadScoringInsight?.breakdown?.read || 0)}</strong>
                  </div>
                  <div className="crm-insight-item">
                    <span>Reply Points</span>
                    <strong>{Number(leadScoringInsight?.breakdown?.reply || 0)}</strong>
                  </div>
                  <div className="crm-insight-item">
                    <span>Keyword Points</span>
                    <strong>{Number(leadScoringInsight?.breakdown?.keyword || 0)}</strong>
                  </div>
                </div>

                <div className="crm-insight-stack">
                  <div className="crm-insight-row">
                    <span>Source Label</span>
                    <strong>{sourceAttribution?.sourceLabel || "-"}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Acquisition Channel</span>
                    <strong>{sourceAttribution?.acquisitionChannel || "-"}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Source Type</span>
                    <strong>{toReadableLabel(sourceAttribution?.sourceType || "manual")}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Campaign</span>
                    <strong>{sourceAttribution?.campaignId || "-"}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Ad Set / Ad</span>
                    <strong>
                      {sourceAttribution?.adSetId || "-"} / {sourceAttribution?.adId || "-"}
                    </strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Form / Page</span>
                    <strong>
                      {sourceAttribution?.formId || "-"} / {sourceAttribution?.pageUrl || "-"}
                    </strong>
                  </div>
                </div>

                {(leadScoringInsight?.stageRecommendation || leadScoringInsight?.recommendedTemplate) && (
                  <div className="crm-insight-note">
                    {leadScoringInsight?.stageRecommendation
                      ? `Recommended stage: ${toReadableLabel(leadScoringInsight.stageRecommendation)}. `
                      : ""}
                    {leadScoringInsight?.recommendedTemplate
                      ? `Recommended template: ${leadScoringInsight.recommendedTemplate}.`
                      : ""}
                  </div>
                )}
              </section>

              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <ShieldCheck size={16} />
                    Consent Audit
                  </h3>
                </div>

                <div className="crm-insight-stack">
                  <div className="crm-insight-row">
                    <span>Status</span>
                    <strong>{toReadableLabel(consentAudit?.status || "unknown")}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Scope</span>
                    <strong>{toReadableLabel(consentAudit?.scope || "unknown")}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Opted In</span>
                    <strong>{formatDateTime(consentAudit?.optedInAt)}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Opted Out</span>
                    <strong>{formatDateTime(consentAudit?.optedOutAt)}</strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Proof</span>
                    <strong>
                      {consentAudit?.proofType || "-"} / {consentAudit?.proofId || "-"}
                    </strong>
                  </div>
                  <div className="crm-insight-row">
                    <span>Captured By</span>
                    <strong>{sourceAttribution?.capturedBy || consentAudit?.source || "-"}</strong>
                  </div>
                </div>

                {String(consentAudit?.consentText || "").trim() && (
                  <div className="crm-insight-note">{consentAudit.consentText}</div>
                )}

                <div className="crm-drawer-list">
                  {(consentAudit?.logs || []).slice(0, 4).map((log, index) => {
                    const logId = getEntityId(log) || `consent-log-${index}`;
                    return (
                      <article key={logId} className="crm-drawer-list-item">
                        <div>
                          <strong>{toReadableLabel(log?.action || "consent")}</strong>
                          <span>
                            {toReadableLabel(log?.source || "unknown")} | {toReadableLabel(log?.scope || "unknown")}
                          </span>
                          <span>{formatDateTime(log?.createdAt)}</span>
                        </div>
                      </article>
                    );
                  })}
                  {!consentAudit?.logs?.length && (
                    <p className="crm-activity-empty">No consent log entries for this contact yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="crm-contact-drawer-grid crm-contact-drawer-grid--secondary">
              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <ScrollText size={16} />
                    Unified Timeline
                  </h3>
                  <span className="crm-drawer-helper-text">
                    Messages, tasks, docs, notes, stage changes, and consent history in one stream
                  </span>
                </div>
                {timelineItems.length > 0 ? (
                  <ul className="crm-activity-list">
                    {timelineItems.map((entry, index) => {
                      const activityId = getEntityId(entry) || `timeline-${index}`;
                      const payload = entry?.payload || {};
                      const isMessage = entry?.type === "message";
                      return (
                        <li key={activityId} className="crm-activity-item">
                          <strong>
                            {isMessage
                              ? `Message • ${toReadableLabel(
                                  payload?.senderName || payload?.sender || "contact"
                                )}`
                              : getCrmActivityLabel(payload)}
                          </strong>
                          <span>
                            {isMessage
                              ? payload?.text ||
                                payload?.mediaCaption ||
                                payload?.mediaType ||
                                "Media message"
                              : getCrmActivityDescription(payload)}
                          </span>
                          <time>{formatDateTimeForActivity(entry?.createdAt)}</time>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="crm-activity-empty">No CRM timeline recorded yet.</p>
                )}
              </section>

              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <GitBranch size={16} />
                    Owner Alerts
                  </h3>
                </div>
                <div className="crm-drawer-list">
                  {(detail?.recentOwnerNotifications || []).map((notification, index) => {
                    const notificationId = getEntityId(notification) || `owner-notification-${index}`;
                    return (
                      <article key={notificationId} className="crm-drawer-list-item">
                        <div>
                          <strong>{getCrmActivityLabel(notification)}</strong>
                          <span>{getCrmActivityDescription(notification)}</span>
                          <span>{formatDateTime(notification?.createdAt)}</span>
                        </div>
                      </article>
                    );
                  })}
                  {!detail?.recentOwnerNotifications?.length && (
                    <p className="crm-activity-empty">No owner notification alerts for this contact yet.</p>
                  )}
                </div>
              </section>
            </div>

            <div className="crm-contact-drawer-grid crm-contact-drawer-grid--secondary">
              <section className="crm-drawer-card">
                <div className="crm-drawer-card-header">
                  <h3>
                    <FileStack size={16} />
                    Documents
                  </h3>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="crm-file-input"
                      onChange={handleDocumentFileChange}
                    />
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={documentUploading}
                    >
                      <Upload size={15} />
                      {documentUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
                <div className="crm-drawer-list">
                  {(detail?.recentDocuments || []).map((document) => {
                    const documentId = getEntityId(document);
                    const isBusy = documentBusyId === documentId;
                    return (
                      <article key={documentId} className="crm-drawer-list-item">
                        <div>
                          <strong>{resolveContactDocumentName(document)}</strong>
                          <span>{String(document?.documentType || "other").replace(/_/g, " ")}</span>
                        </div>
                        <div className="crm-inline-actions">
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() => openDocumentInMode(documentId, "view")}
                            disabled={isBusy}
                            title="View"
                          >
                            <ExternalLink size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn"
                            onClick={() => openDocumentInMode(documentId, "download")}
                            disabled={isBusy}
                            title="Download"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            type="button"
                            className="crm-inline-action-btn crm-inline-action-btn--danger"
                            onClick={() => handleDeleteDocument(documentId)}
                            disabled={isBusy}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!detail?.recentDocuments?.length && <p className="crm-activity-empty">No CRM documents for this contact yet.</p>}
                </div>
              </section>
            </div>

            <section className="crm-drawer-card">
              <div className="crm-drawer-card-header">
                <h3>
                  <MessageSquare size={16} />
                  Recent Messages
                </h3>
                <span className="crm-drawer-helper-text">
                  {detail?.recentConversation?.lastMessageTime
                    ? `Last conversation activity ${formatDateTime(detail.recentConversation.lastMessageTime)}`
                    : "No conversation synced yet"}
                </span>
              </div>
              <div className="crm-message-list">
                {(detail?.recentMessages || []).map((messageItem) => {
                  const messageId = getEntityId(messageItem);
                  return (
                    <article
                      key={messageId}
                      className={`crm-message-item crm-message-item--${String(messageItem?.sender || "agent").toLowerCase()}`}
                    >
                      <strong>
                        {String(messageItem?.senderName || messageItem?.sender || "message")
                          .replace(/\b\w/g, (character) => character.toUpperCase())}
                      </strong>
                      {String(messageItem?.broadcastName || "").trim() && (
                        <span className="crm-message-meta">
                          Broadcast: {messageItem.broadcastName}
                        </span>
                      )}
                      <p>{messageItem?.text || messageItem?.mediaCaption || messageItem?.mediaType || "Media message"}</p>
                      <time>{formatDateTime(messageItem?.timestamp)}</time>
                    </article>
                  );
                })}
                {!detail?.recentMessages?.length && (
                  <p className="crm-activity-empty">No recent WhatsApp messages found for this lead.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

export default CrmContactDrawer;
