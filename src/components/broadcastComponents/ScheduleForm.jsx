import React from "react";
import {
  CheckCircle,
  ChevronDown,
  FileText,
  Upload,
  Calendar,
  Send,
  Clock,
  Users,
  Download,
  Settings,
  UserPlus,
} from "lucide-react";
import MessagePreview from "./MessagePreview";
import "./ScheduleForm.css";
import { downloadCsv } from "../../utils/csvExport";

const BROADCAST_SCHEDULE_DRAFT_KEY = "broadcast:schedule-form:draft:v1";
const parseSuppressionListEntries = (input = "") =>
  String(input || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
const isValidSuppressionPhone = (value = "") =>
  /^\+?[1-9]\d{7,14}$/.test(String(value || "").trim());
const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const ScheduleForm = ({
  messageType,
  broadcastName,
  onBroadcastNameChange,
  templateName,
  onTemplateNameChange,
  templateFilter,
  onTemplateFilterChange,
  officialTemplates,
  filteredTemplates,
  customMessage,
  onCustomMessageChange,
  selectedTemplateCategory = "",
  onFileUpload,
  uploadedFile,
  recipients,
  fileVariables,
  templateHeaderMediaUrl,
  templateHeaderMediaUploading = false,
  templateHeaderMediaError = "",
  onTemplateHeaderMediaUpload,
  onClearTemplateHeaderMedia,
  onClearUpload,
  onPrepareCsvReplace,
  csvUploadState = {
    phase: "idle",
    message: "",
    percent: 0,
  },
  onOpenContactAudiencePicker,
  onOpenCampaignAudiencePicker,
  onOpenGroupAudiencePicker,
  onCloseContactAudiencePicker,
  onClearSelectedAudience,
  audienceSourceMode = "contacts",
  onAudienceSourceModeChange,
  audienceSourceLabel = "",
  selectedCampaignAudienceLabel = "",
  selectedCampaignAudienceCount = 0,
  selectedCampaignAudienceRecipients = [],
  onAutoCleanRecipients,
  scheduledTime,
  onScheduledTimeChange,
  isSending,
  onCreateBroadcast,
  onSendBroadcast,
  sendResults,
  onBackToOverview,
  onResetForm,
  resetVersion = 0,
  onToast,
  quietHoursEnabled = false,
  onQuietHoursEnabledChange = () => {},
  quietHoursStartHour = 22,
  onQuietHoursStartHourChange = () => {},
  quietHoursEndHour = 9,
  onQuietHoursEndHourChange = () => {},
  quietHoursTimezone = "Asia/Kolkata",
  onQuietHoursTimezoneChange = () => {},
  quietHoursAction = "defer",
  onQuietHoursActionChange = () => {},
  retryPolicyEnabled = true,
  onRetryPolicyEnabledChange = () => {},
  retryMaxAttempts = 3,
  onRetryMaxAttemptsChange = () => {},
  retryBackoffSeconds = 45,
  onRetryBackoffSecondsChange = () => {},
  deliveryBatchSize = 50,
  onDeliveryBatchSizeChange = () => {},
  deliveryBatchDelaySeconds = 5,
  onDeliveryBatchDelaySecondsChange = () => {},
  respectOptOut = true,
  onRespectOptOutChange = () => {},
  suppressionListRaw = "",
  onSuppressionListRawChange = () => {},
}) => {
  const scheduleInputRef = React.useRef(null);
  const csvInputRef = React.useRef(null);
  const hasAppliedResetVersion = React.useRef(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isTemplateHeaderDragOver, setIsTemplateHeaderDragOver] =
    React.useState(false);
  const [draftSavedAt, setDraftSavedAt] = React.useState(null);
  const [hasStoredDraft, setHasStoredDraft] = React.useState(false);
  const hasRestoredDraftRef = React.useRef(false);
  const lastDraftPayloadRef = React.useRef("");
  const csvUploadPhase = String(csvUploadState?.phase || "idle");
  const csvUploadMessage = String(csvUploadState?.message || "").trim();
  const csvUploadPercent = Math.max(
    0,
    Math.min(100, Number(csvUploadState?.percent || 0)),
  );
  const isCsvUploadBusy = [
    "parsing",
    "validating",
    "processing",
    "uploading",
  ].includes(csvUploadPhase);
  const hasCampaignAudience =
    Boolean(String(selectedCampaignAudienceLabel || "").trim()) ||
    Number(selectedCampaignAudienceCount || 0) > 0;
  const campaignAudienceRows = Array.isArray(selectedCampaignAudienceRecipients)
    ? selectedCampaignAudienceRecipients
    : [];
  const [showAddRecipientMenu, setShowAddRecipientMenu] =
    React.useState(false);
  const addRecipientMenuRef = React.useRef(null);

  React.useEffect(() => {
    if (!hasAppliedResetVersion.current) {
      hasAppliedResetVersion.current = true;
      return;
    }

    setDraftSavedAt(null);
    setHasStoredDraft(false);
    hasRestoredDraftRef.current = false;
    lastDraftPayloadRef.current = "";
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
    } catch {
      // ignore storage errors
    }
  }, [resetVersion]);

  React.useEffect(() => {
    if (!showAddRecipientMenu) return undefined;

    const handlePointerDown = (event) => {
      if (
        addRecipientMenuRef.current &&
        !addRecipientMenuRef.current.contains(event.target)
      ) {
        setShowAddRecipientMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowAddRecipientMenu(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showAddRecipientMenu]);

  React.useEffect(() => {
    if (!canUseSessionStorage() || hasRestoredDraftRef.current) return;
    hasRestoredDraftRef.current = true;

    const hasExistingData =
      String(broadcastName || "").trim().length > 0 ||
      String(templateName || "").trim().length > 0 ||
      String(customMessage || "").trim().length > 0 ||
      String(scheduledTime || "").trim().length > 0 ||
      String(suppressionListRaw || "").trim().length > 0 ||
      quietHoursEnabled ||
      (Array.isArray(recipients) && recipients.length > 0);
    if (hasExistingData) return;

    try {
      const raw = window.sessionStorage.getItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      if (!raw) return;
      setHasStoredDraft(true);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      if (typeof parsed.broadcastName === "string") {
        onBroadcastNameChange?.({ target: { value: parsed.broadcastName } });
      }
      if (typeof parsed.templateName === "string") {
        onTemplateNameChange?.({ target: { value: parsed.templateName } });
      }
      if (typeof parsed.templateFilter === "string") {
        onTemplateFilterChange?.(parsed.templateFilter);
      }
      if (typeof parsed.customMessage === "string") {
        onCustomMessageChange?.({ target: { value: parsed.customMessage } });
      }
      if (typeof parsed.scheduledTime === "string") {
        onScheduledTimeChange?.({ target: { value: parsed.scheduledTime } });
      }
      if (typeof parsed.quietHoursEnabled === "boolean") {
        onQuietHoursEnabledChange?.(parsed.quietHoursEnabled);
      }
      if (typeof parsed.quietHoursStartHour !== "undefined") {
        onQuietHoursStartHourChange?.(String(parsed.quietHoursStartHour));
      }
      if (typeof parsed.quietHoursEndHour !== "undefined") {
        onQuietHoursEndHourChange?.(String(parsed.quietHoursEndHour));
      }
      if (typeof parsed.quietHoursTimezone === "string") {
        onQuietHoursTimezoneChange?.(parsed.quietHoursTimezone);
      }
      if (typeof parsed.quietHoursAction === "string") {
        onQuietHoursActionChange?.(parsed.quietHoursAction);
      }
      if (typeof parsed.retryPolicyEnabled === "boolean") {
        onRetryPolicyEnabledChange?.(parsed.retryPolicyEnabled);
      }
      if (typeof parsed.retryMaxAttempts !== "undefined") {
        onRetryMaxAttemptsChange?.(String(parsed.retryMaxAttempts));
      }
      if (typeof parsed.retryBackoffSeconds !== "undefined") {
        onRetryBackoffSecondsChange?.(String(parsed.retryBackoffSeconds));
      }
      if (typeof parsed.deliveryBatchSize !== "undefined") {
        onDeliveryBatchSizeChange?.(String(parsed.deliveryBatchSize));
      }
      if (typeof parsed.respectOptOut === "boolean") {
        onRespectOptOutChange?.(parsed.respectOptOut);
      }
      if (typeof parsed.suppressionListRaw === "string") {
        onSuppressionListRawChange?.(parsed.suppressionListRaw);
      }
    } catch {
      // ignore invalid draft payload
    }
  }, [
    broadcastName,
    templateName,
    customMessage,
    scheduledTime,
    suppressionListRaw,
    quietHoursEnabled,
    recipients,
    onBroadcastNameChange,
    onTemplateNameChange,
    onTemplateFilterChange,
    onCustomMessageChange,
    onScheduledTimeChange,
    onQuietHoursEnabledChange,
    onQuietHoursStartHourChange,
    onQuietHoursEndHourChange,
    onQuietHoursTimezoneChange,
    onQuietHoursActionChange,
    onRetryPolicyEnabledChange,
    onRetryMaxAttemptsChange,
    onRetryBackoffSecondsChange,
    onDeliveryBatchSizeChange,
    onRespectOptOutChange,
    onSuppressionListRawChange,
  ]);

  const buildDraftPayload = React.useCallback(
    () => ({
      broadcastName: String(broadcastName || ""),
      templateName: String(templateName || ""),
      templateFilter: String(templateFilter || ""),
      customMessage: String(customMessage || ""),
      scheduledTime: String(scheduledTime || ""),
      quietHoursEnabled: Boolean(quietHoursEnabled),
      quietHoursStartHour,
      quietHoursEndHour,
      quietHoursTimezone: String(quietHoursTimezone || ""),
      quietHoursAction: String(quietHoursAction || ""),
      retryPolicyEnabled: Boolean(retryPolicyEnabled),
      retryMaxAttempts,
      retryBackoffSeconds,
      deliveryBatchSize,
      respectOptOut: Boolean(respectOptOut),
      suppressionListRaw: String(suppressionListRaw || ""),
    }),
    [
      broadcastName,
      templateName,
      templateFilter,
      customMessage,
      scheduledTime,
      quietHoursEnabled,
      quietHoursStartHour,
      quietHoursEndHour,
      quietHoursTimezone,
      quietHoursAction,
      retryPolicyEnabled,
      retryMaxAttempts,
      retryBackoffSeconds,
      deliveryBatchSize,
      respectOptOut,
      suppressionListRaw,
    ],
  );

  const hasFormProgress = React.useMemo(() => {
    const hasCampaignMeta =
      String(broadcastName || "").trim().length > 0 ||
      String(templateName || "").trim().length > 0 ||
      String(customMessage || "").trim().length > 0;
    const hasUploadOrRecipients =
      Boolean(uploadedFile) ||
      (Array.isArray(recipients) && recipients.length > 0);
    const hasScheduleOrPolicy =
      String(scheduledTime || "").trim().length > 0 ||
      quietHoursEnabled ||
      String(suppressionListRaw || "").trim().length > 0;
    return hasCampaignMeta || hasUploadOrRecipients || hasScheduleOrPolicy;
  }, [
    broadcastName,
    templateName,
    customMessage,
    uploadedFile,
    recipients,
    scheduledTime,
    quietHoursEnabled,
    suppressionListRaw,
  ]);

  const templateHeaderUploadInputId = "schedule-template-header-upload";
  const handleTemplateHeaderUploadClick = () => {
    const input = document.getElementById(templateHeaderUploadInputId);
    if (!input) return;
    input.value = "";
    input.click();
  };

  const handleTemplateHeaderDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsTemplateHeaderDragOver(true);
  };

  const handleTemplateHeaderDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsTemplateHeaderDragOver(false);
  };

  const handleTemplateHeaderDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsTemplateHeaderDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && typeof onTemplateHeaderMediaUpload === "function") {
      await onTemplateHeaderMediaUpload(file);
    }
  };

  React.useEffect(() => {
    if (!canUseSessionStorage()) return;
    if (!hasFormProgress) {
      try {
        window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      } catch {
        // ignore storage errors
      }
      lastDraftPayloadRef.current = "";
      if (hasStoredDraft || draftSavedAt) {
        setHasStoredDraft(false);
        setDraftSavedAt(null);
      }
      return;
    }

    const payload = buildDraftPayload();
    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastDraftPayloadRef.current) return;

    try {
      window.sessionStorage.setItem(
        BROADCAST_SCHEDULE_DRAFT_KEY,
        serializedPayload,
      );
      lastDraftPayloadRef.current = serializedPayload;
      setHasStoredDraft(true);
      setDraftSavedAt(new Date());
    } catch {
      // ignore storage errors
    }
  }, [buildDraftPayload, hasFormProgress, hasStoredDraft, draftSavedAt]);

  const extractTemplateBody = (template) => {
    if (!template || typeof template !== "object") return "";

    if (
      typeof template.templateContent === "string" &&
      template.templateContent.trim()
    ) {
      return template.templateContent.trim();
    }

    if (typeof template.content === "string" && template.content.trim()) {
      return template.content.trim();
    }

    if (template.content && typeof template.content === "object") {
      if (
        typeof template.content.body === "string" &&
        template.content.body.trim()
      ) {
        return template.content.body.trim();
      }
      if (
        typeof template.content.text === "string" &&
        template.content.text.trim()
      ) {
        return template.content.text.trim();
      }
    }

    if (Array.isArray(template.components)) {
      const bodyComponent = template.components.find(
        (comp) => String(comp?.type || "").toUpperCase() === "BODY",
      );
      if (
        typeof bodyComponent?.text === "string" &&
        bodyComponent.text.trim()
      ) {
        return bodyComponent.text.trim();
      }
    }

    return "";
  };

  const getTemplateVariableCount = React.useCallback((template) => {
    const bodyText = extractTemplateBody(template);
    if (!bodyText) return 0;

    const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const numbers = matches
      .map((token) => Number(token.replace(/[{}]/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);

    return numbers.length > 0 ? Math.max(...numbers) : 0;
  }, []);

  const selectedTemplate = React.useMemo(
    () =>
      (officialTemplates || []).find((t) => t.name === templateName) || null,
    [officialTemplates, templateName],
  );
  const selectedTemplateHeader =
    selectedTemplate?.content?.header ||
    selectedTemplate?.header ||
    (Array.isArray(selectedTemplate?.components)
      ? selectedTemplate.components.find(
          (component) =>
            String(component?.type || "")
              .trim()
              .toUpperCase() === "HEADER",
        ) || null
      : null);
  const selectedTemplateHeaderType = String(
    selectedTemplateHeader?.type ||
      selectedTemplateHeader?.format ||
      selectedTemplate?.type ||
      selectedTemplate?.mediaType ||
      selectedTemplate?.headerType ||
      selectedTemplate?.templateType ||
      "",
  ).toLowerCase();
  const selectedTemplateHasImageHeader =
    selectedTemplateHeaderType === "image" ||
    (Boolean(
      selectedTemplateHeader?.mediaUrl ||
      selectedTemplateHeader?.example?.header_handle?.[0] ||
      selectedTemplateHeader?.header_handle?.[0],
    ) &&
      !String(selectedTemplateHeader?.text || "").trim());
  const selectedTemplateHeaderMediaUrl = String(
    templateHeaderMediaUrl ||
      selectedTemplateHeader?.mediaUrl ||
      selectedTemplateHeader?.example?.header_handle?.[0] ||
      selectedTemplateHeader?.header_handle?.[0] ||
      "",
  ).trim();

  const buildSampleCsvRows = React.useCallback(() => {
    const variableCount =
      messageType === "template"
        ? getTemplateVariableCount(selectedTemplate)
        : 0;

    const headers = ["phone"];
    for (let i = 1; i <= variableCount; i += 1) {
      headers.push(`var${i}`);
    }

    const firstDataRow = [""];
    for (let i = 1; i <= variableCount; i += 1) {
      firstDataRow.push("");
    }

    const secondDataRow = [""];
    for (let i = 1; i <= variableCount; i += 1) {
      secondDataRow.push("");
    }

    return [headers.join(","), firstDataRow.join(","), secondDataRow.join(",")];
  }, [selectedTemplate, messageType, getTemplateVariableCount]);

  const downloadSampleCsv = () => {
    const csvRows = buildSampleCsvRows();
    const [headerLine, ...dataLines] = csvRows;
    const headers = String(headerLine || "").split(",");
    const rows = dataLines.map((line) => String(line || "").split(","));
    downloadCsv({
      filename: "broadcast_contacts_sample.csv",
      headers,
      rows,
      exportType: "broadcast_contacts_sample",
    });
  };

  const triggerCsvPicker = () => {
    const input = csvInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  };

  const handleReplaceCsv = () => {
    if (typeof onPrepareCsvReplace === "function") {
      onPrepareCsvReplace();
    }
    triggerCsvPicker();
  };

  const triggerAudienceSelection = () => {
    if (
      audienceSourceMode === "contacts" &&
      typeof onOpenContactAudiencePicker === "function"
    ) {
      onOpenContactAudiencePicker();
      return;
    }
    if (
      audienceSourceMode === "campaign" &&
      typeof onOpenCampaignAudiencePicker === "function"
    ) {
      onOpenCampaignAudiencePicker();
      return;
    }
    triggerCsvPicker();
  };

  const handleToggleAddRecipientMenu = () => {
    setShowAddRecipientMenu((current) => !current);
  };

  const handleAddRecipientMenuAction = (action) => {
    if (action === "contacts") {
      onAudienceSourceModeChange?.("contacts");
      onOpenContactAudiencePicker?.();
    } else if (action === "groups") {
      onOpenGroupAudiencePicker?.();
    } else if (action === "campaign") {
      onAudienceSourceModeChange?.("campaign");
      onOpenCampaignAudiencePicker?.();
    } else if (action === "csv") {
      onAudienceSourceModeChange?.("csv");
      triggerCsvPicker();
    } else if (action === "clear") {
      onClearSelectedAudience?.();
    }
    setShowAddRecipientMenu(false);
  };

  const handleCsvDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleCsvDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleCsvDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);

    const droppedFile = event.dataTransfer?.files?.[0];
    if (!droppedFile) return;

    if (
      !String(droppedFile.name || "")
        .toLowerCase()
        .endsWith(".csv")
    ) {
      onToast?.("Please drop a valid CSV file.", "error");
      return;
    }

    onFileUpload({ target: { files: [droppedFile] } });
  };

  const openSchedulePicker = () => {
    setTimeout(() => {
      if (scheduleInputRef.current?.showPicker) {
        scheduleInputRef.current.showPicker();
      } else if (scheduleInputRef.current) {
        scheduleInputRef.current.focus();
      }
    }, 0);
  };

  const clearScheduleTime = () => {
    onScheduledTimeChange({ target: { value: "" } });
  };

  const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return Math.trunc(parsed);
  };

  const normalizeQuietStartHour = () => {
    const normalized = clampNumber(quietHoursStartHour, 0, 23, 22);
    onQuietHoursStartHourChange(String(normalized));
  };

  const normalizeQuietEndHour = () => {
    const normalized = clampNumber(quietHoursEndHour, 0, 23, 9);
    onQuietHoursEndHourChange(String(normalized));
  };

  const normalizeRetryAttempts = () => {
    const normalized = clampNumber(retryMaxAttempts, 1, 10, 3);
    onRetryMaxAttemptsChange(String(normalized));
  };

  const normalizeRetryBackoff = () => {
    const normalized = clampNumber(retryBackoffSeconds, 5, 600, 45);
    onRetryBackoffSecondsChange(String(normalized));
  };

  const normalizeQuietTimezone = () => {
    const trimmed = String(quietHoursTimezone || "").trim();
    onQuietHoursTimezoneChange(trimmed || "Asia/Kolkata");
  };

  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const getRecipientDiagnostics = React.useCallback(() => {
    const phoneCountMap = new Map();
    (recipients || []).forEach((recipient) => {
      const raw = recipient?.data || recipient || {};
      const fullData = raw.fullData || raw || {};
      const phone = String(
        recipient?.phone ||
          raw.phone ||
          fullData.phone ||
          fullData.mobile ||
          fullData.number ||
          "",
      ).trim();
      if (!phone || phone === "-") return;
      phoneCountMap.set(phone, (phoneCountMap.get(phone) || 0) + 1);
    });

    const rows = (recipients || []).map((recipient, index) => {
      const raw = recipient?.data || recipient || {};
      const fullData = raw.fullData || raw || {};
      const normalizedPhone = String(
        recipient?.phone ||
          raw.phone ||
          fullData.phone ||
          fullData.mobile ||
          fullData.number ||
          "",
      ).trim();
      const phone = normalizedPhone || "-";
      const name = raw.name || fullData.name || `Contact ${index + 1}`;
      const customFieldCount = Object.keys(fullData).filter(
        (key) =>
          !["phone", "mobile", "number", "name", "variables"].includes(
            String(key).toLowerCase(),
          ),
      ).length;
      const isMissingPhone = !normalizedPhone || normalizedPhone === "-";
      const isDuplicatePhone =
        !isMissingPhone && (phoneCountMap.get(normalizedPhone) || 0) > 1;
      const optInStatus = String(
        recipient?.whatsappOptInStatus ||
          raw.whatsappOptInStatus ||
          fullData.whatsappOptInStatus ||
          raw.optInStatus ||
          fullData.optInStatus ||
          "",
      )
        .trim()
        .toLowerCase();
      const optInScope = String(
        recipient?.whatsappOptInScope ||
          raw.whatsappOptInScope ||
          fullData.whatsappOptInScope ||
          raw.scope ||
          fullData.scope ||
          "",
      )
        .trim()
        .toLowerCase();
      const consentEvidence = Boolean(
        raw.whatsappOptInAt ||
        fullData.whatsappOptInAt ||
        raw.whatsappOptInTextSnapshot ||
        fullData.whatsappOptInTextSnapshot ||
        raw.consentText ||
        fullData.consentText ||
        raw.whatsappOptInProofType ||
        fullData.whatsappOptInProofType ||
        raw.proofType ||
        fullData.proofType ||
        raw.whatsappOptInProofId ||
        fullData.whatsappOptInProofId ||
        raw.proofId ||
        fullData.proofId ||
        raw.whatsappOptInProofUrl ||
        fullData.whatsappOptInProofUrl ||
        raw.proofUrl ||
        fullData.proofUrl,
      );
      const hasOptIn = optInStatus === "opted_in" || consentEvidence;
      const hasMarketingScope =
        optInScope === "marketing" || optInScope === "both";
      const recentlyInteracted = Boolean(
        raw.lastInboundMessageAt ||
        fullData.lastInboundMessageAt ||
        raw.serviceWindowClosesAt ||
        fullData.serviceWindowClosesAt,
      );
      const hasCrmMatch = Boolean(
        String(
          recipient?.contactId ||
            raw?.contactId ||
            raw?._id ||
            fullData?._id ||
            raw?.crmContactId ||
            fullData?.crmContactId ||
            "",
        ).trim(),
      );
      const isMarketingTemplate =
        String(selectedTemplateCategory || "")
          .trim()
          .toLowerCase() === "marketing";
      const hasMarketingEligibility = hasOptIn || recentlyInteracted;
      const missingOptIn =
        messageType === "template" &&
        isMarketingTemplate &&
        !hasMarketingEligibility;
      const eligibilityLabel = isMissingPhone
        ? "N/A"
        : !isMarketingTemplate
          ? "Template eligible"
          : hasMarketingEligibility
            ? "Marketing eligible"
            : recentlyInteracted
              ? "Service only"
              : "Opt-in missing";
      const eligibilityTone = isMissingPhone
        ? "muted"
        : eligibilityLabel === "Marketing eligible" ||
            eligibilityLabel === "Template eligible"
          ? "ok"
          : eligibilityLabel === "Service only"
            ? "info"
            : "issue";

      return {
        index,
        phone,
        name,
        customFieldCount,
        qualityLabel: isMissingPhone
          ? "Missing phone"
          : isDuplicatePhone
            ? "Duplicate phone"
            : "Valid",
        qualityTone: isMissingPhone || isDuplicatePhone ? "issue" : "ok",
        optInLabel: isMissingPhone
          ? "N/A"
          : missingOptIn
            ? "Opt-in missing"
            : hasMarketingScope
              ? "Opted in"
              : "Consent unknown",
        optInTone: isMissingPhone ? "muted" : missingOptIn ? "issue" : "ok",
        crmMatchLabel: hasCrmMatch ? "CRM matched" : "CRM not matched",
        crmMatchTone: hasCrmMatch ? "ok" : "issue",
        eligibilityLabel,
        eligibilityTone,
      };
    });

    const missingPhoneCount = rows.filter(
      (row) => row.qualityLabel === "Missing phone",
    ).length;
    const duplicatePhoneCount = rows.filter(
      (row) => row.qualityLabel === "Duplicate phone",
    ).length;
    const missingOptInCount = rows.filter(
      (row) => row.optInTone === "issue",
    ).length;
    const validCount = rows.filter((row) => row.qualityTone === "ok").length;
    const skippedCount = missingPhoneCount + duplicatePhoneCount;

    return {
      rows,
      summary: {
        validCount,
        skippedCount,
        missingPhoneCount,
        duplicatePhoneCount,
        missingOptInCount,
        hasIssues: skippedCount > 0,
      },
    };
  }, [recipients, messageType, selectedTemplateCategory]);

  const recipientDiagnostics = React.useMemo(
    () => getRecipientDiagnostics(),
    [getRecipientDiagnostics],
  );
  const contactRows = React.useMemo(
    () => recipientDiagnostics.rows.slice(0, 5),
    [recipientDiagnostics],
  );
  const recipientQualitySummary = recipientDiagnostics.summary;

  const downloadRecipientIssueCsv = () => {
    const issueRows = recipientDiagnostics.rows.filter(
      (row) => row.qualityTone === "issue",
    );
    if (!issueRows.length) {
      onToast?.("No issue rows available for export.", "info");
      return;
    }

    downloadCsv({
      filename: `recipient_quality_issues_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      headers: ["rowNumber", "phone", "name", "issueType"],
      rows: issueRows.map((row) => [
        row.index + 1,
        row.phone,
        row.name,
        row.qualityLabel,
      ]),
      exportType: "recipient_quality_issues",
    });
  };

  const requiredColumnsLabel = React.useMemo(() => {
    const variableCount =
      messageType === "template"
        ? getTemplateVariableCount(selectedTemplate)
        : 0;
    const columns = ["phone"];
    for (let i = 1; i <= variableCount; i += 1) {
      columns.push(`var${i}`);
    }
    return columns.join(", ");
  }, [selectedTemplate, messageType, getTemplateVariableCount]);

  const getSelectedTemplatePreview = () => {
    if (!templateName) return "Select a template";
    if (!selectedTemplate) return `Template: ${templateName}`;

    let text =
      extractTemplateBody(selectedTemplate) || `Template: ${templateName}`;

    const firstRecipient = recipients?.[0];
    const replacementVars =
      firstRecipient?.variables || firstRecipient?.data?.variables || [];
    if (Array.isArray(replacementVars) && replacementVars.length > 0) {
      text = text.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const index = Number(n) - 1;
        return replacementVars[index] ?? `{{${n}}}`;
      });
    }

    return text;
  };

  const suppressionListMeta = React.useMemo(() => {
    const entries = parseSuppressionListEntries(suppressionListRaw);
    const uniqueEntries = Array.from(new Set(entries));
    const invalidEntries = uniqueEntries.filter(
      (entry) => !isValidSuppressionPhone(entry),
    );
    return {
      total: uniqueEntries.length,
      invalidEntries,
    };
  }, [suppressionListRaw]);
  const hasRecipientIssues = recipientQualitySummary.hasIssues;
  const policyValidation = React.useMemo(() => {
    if (!quietHoursEnabled && !retryPolicyEnabled) {
      return { isInvalid: false, reason: "" };
    }

    const toInteger = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
    };

    if (quietHoursEnabled) {
      const startHour = toInteger(quietHoursStartHour);
      const endHour = toInteger(quietHoursEndHour);
      if (Number.isNaN(startHour) || startHour < 0 || startHour > 23) {
        return {
          isInvalid: true,
          reason: "Quiet hours start must be between 0 and 23.",
        };
      }
      if (Number.isNaN(endHour) || endHour < 0 || endHour > 23) {
        return {
          isInvalid: true,
          reason: "Quiet hours end must be between 0 and 23.",
        };
      }
      if (startHour === endHour) {
        return {
          isInvalid: true,
          reason: "Quiet hours start and end cannot be the same.",
        };
      }
      if (!String(quietHoursTimezone || "").trim()) {
        return {
          isInvalid: true,
          reason:
            "Quiet hours timezone is required when quiet hours are enabled.",
        };
      }
    }

    if (retryPolicyEnabled) {
      const attempts = toInteger(retryMaxAttempts);
      const backoff = toInteger(retryBackoffSeconds);
      if (Number.isNaN(attempts) || attempts < 1 || attempts > 10) {
        return {
          isInvalid: true,
          reason: "Retry max attempts must be between 1 and 10.",
        };
      }
      if (Number.isNaN(backoff) || backoff < 5 || backoff > 600) {
        return {
          isInvalid: true,
          reason: "Retry backoff must be between 5 and 600 seconds.",
        };
      }
    }

    const batchSize = toInteger(deliveryBatchSize);
    if (Number.isNaN(batchSize) || batchSize < 1 || batchSize > 50) {
      return {
        isInvalid: true,
        reason: "Delivery batch size must be between 1 and 50.",
      };
    }

    const batchDelay = toInteger(deliveryBatchDelaySeconds);
    if (Number.isNaN(batchDelay) || batchDelay < 0 || batchDelay > 3600) {
      return {
        isInvalid: true,
        reason: "Batch delay must be between 0 and 3600 seconds.",
      };
    }

    if (suppressionListMeta.invalidEntries.length > 0) {
      return {
        isInvalid: true,
        reason: `Invalid suppression numbers: ${suppressionListMeta.invalidEntries.slice(0, 3).join(", ")}${
          suppressionListMeta.invalidEntries.length > 3 ? "..." : ""
        }`,
      };
    }

    return { isInvalid: false, reason: "" };
  }, [
    quietHoursEnabled,
    quietHoursStartHour,
    quietHoursEndHour,
    quietHoursTimezone,
    retryPolicyEnabled,
    retryMaxAttempts,
    retryBackoffSeconds,
    deliveryBatchSize,
    deliveryBatchDelaySeconds,
    suppressionListMeta,
  ]);

  const scheduleValidation = React.useMemo(() => {
    const raw = String(scheduledTime || "").trim();
    if (!raw) {
      return { isInvalid: false, reason: "" };
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return {
        isInvalid: true,
        reason: "Selected schedule date/time is invalid.",
      };
    }

    const now = new Date();
    if (parsed.getTime() <= now.getTime()) {
      return {
        isInvalid: true,
        reason: "Schedule time must be in the future.",
      };
    }

    return { isInvalid: false, reason: "" };
  }, [scheduledTime]);

  const canSubmitCampaign = React.useMemo(() => {
    const hasRecipients = Array.isArray(recipients) && recipients.length > 0;
    const hasName = String(broadcastName || "").trim().length > 0;
    if (!hasRecipients || !hasName) return false;

    if (messageType === "template") {
      return String(templateName || "").trim().length > 0;
    }

    return String(customMessage || "").trim().length > 0;
  }, [recipients, broadcastName, messageType, templateName, customMessage]);

  React.useEffect(() => {
    if (!hasFormProgress || typeof window === "undefined") return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasFormProgress]);

  const handleResetClick = () => {
    if (!hasFormProgress) {
      onResetForm?.();
      return;
    }

    const message =
      "Reset will clear campaign name, message/template, contacts, schedule and policy settings. Continue?";
    const shouldReset =
      typeof window === "undefined" ? true : window.confirm(message);
    if (!shouldReset) return;
    if (canUseSessionStorage()) {
      try {
        window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      } catch {
        // ignore storage errors
      }
    }
    setHasStoredDraft(false);
    setDraftSavedAt(null);
    lastDraftPayloadRef.current = "";
    onResetForm?.();
  };

  const handleBackToOverviewClick = () => {
    if (!hasFormProgress) {
      onCloseContactAudiencePicker?.();
      onBackToOverview?.();
      return;
    }

    const message =
      "You have unsaved campaign changes. Leave this page and go back to overview?";
    const shouldLeave =
      typeof window === "undefined" ? true : window.confirm(message);
    if (!shouldLeave) return;
    onCloseContactAudiencePicker?.();
    onBackToOverview?.();
  };

  React.useEffect(() => {
    if (!sendResults || !canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      setHasStoredDraft(false);
      setDraftSavedAt(null);
      lastDraftPayloadRef.current = "";
    } catch {
      // ignore storage errors
    }
  }, [sendResults]);

  const handleClearSavedDraft = () => {
    if (!canUseSessionStorage()) return;
    try {
      window.sessionStorage.removeItem(BROADCAST_SCHEDULE_DRAFT_KEY);
      setHasStoredDraft(false);
      setDraftSavedAt(null);
      lastDraftPayloadRef.current = "";
      onToast?.("Saved draft cleared.", "success");
    } catch {
      onToast?.("Unable to clear saved draft right now.", "error");
    }
  };

  const handleSaveDraftNow = React.useCallback(() => {
    if (!canUseSessionStorage()) {
      onToast?.("Draft save is unavailable in this environment.", "error");
      return;
    }
    if (!hasFormProgress) {
      onToast?.("Nothing to save yet. Fill campaign details first.", "info");
      return;
    }

    const payload = buildDraftPayload();

    try {
      const serializedPayload = JSON.stringify(payload);
      window.sessionStorage.setItem(
        BROADCAST_SCHEDULE_DRAFT_KEY,
        serializedPayload,
      );
      lastDraftPayloadRef.current = serializedPayload;
      setHasStoredDraft(true);
      setDraftSavedAt(new Date());
      onToast?.("Draft saved.", "success");
    } catch {
      onToast?.("Unable to save draft right now.", "error");
    }
  }, [buildDraftPayload, hasFormProgress, onToast]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onKeyDown = (event) => {
      const isSaveCombo =
        (event.ctrlKey || event.metaKey) &&
        String(event.key || "").toLowerCase() === "s";
      if (!isSaveCombo) return;
      if (!hasFormProgress) return;
      event.preventDefault();
      handleSaveDraftNow();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveDraftNow, hasFormProgress]);

  const handleCreateBroadcastClick = () => {
    if (hasRecipientIssues) {
      onToast?.(
        `Please resolve recipient issues before scheduling (${recipientQualitySummary.missingPhoneCount} missing phone, ${recipientQualitySummary.duplicatePhoneCount} duplicates).`,
        "error",
      );
      return;
    }
    if (scheduleValidation.isInvalid) {
      onToast?.(scheduleValidation.reason, "error");
      return;
    }
    if (policyValidation.isInvalid) {
      onToast?.(policyValidation.reason, "error");
      return;
    }
    onCreateBroadcast?.();
  };

  const handleSendBroadcastClick = () => {
    if (hasRecipientIssues) {
      onToast?.(
        `Please resolve recipient issues before sending (${recipientQualitySummary.missingPhoneCount} missing phone, ${recipientQualitySummary.duplicatePhoneCount} duplicates).`,
        "error",
      );
      return;
    }
    if (policyValidation.isInvalid) {
      onToast?.(policyValidation.reason, "error");
      return;
    }
    onSendBroadcast?.();
  };

  return (
    <div className="schedule-form-container">
      <div className="campaign-config-wrapper">
        <div className="form-section">
          <h3>Configure WhatsApp Campaign</h3>

          <div className="form-group">
            <label>Campaign Name</label>
            <input
              type="text"
              placeholder="e.g. Diwali Promo 2024"
              value={broadcastName}
              onChange={onBroadcastNameChange}
            />
          </div>

          {messageType === "template" ? (
            <>
              <div className="form-group">
                <div className="template-header-row">
                  <label>
                    <CheckCircle size={16} /> Template Name
                  </label>

                  <div className="template-filters">
                    <button
                      className={`filter-btn ${templateFilter === "all" ? "active" : ""}`}
                      onClick={() => onTemplateFilterChange("all")}
                    >
                      All
                    </button>
                    <button
                      className={`filter-btn ${templateFilter === "marketing" ? "active" : ""}`}
                      onClick={() => onTemplateFilterChange("marketing")}
                    >
                      Marketing
                    </button>
                    <button
                      className={`filter-btn ${templateFilter === "utility" ? "active" : ""}`}
                      onClick={() => onTemplateFilterChange("utility")}
                    >
                      Utility
                    </button>
                    <button
                      className={`filter-btn ${templateFilter === "authentication" ? "active" : ""}`}
                      onClick={() => onTemplateFilterChange("authentication")}
                    >
                      Authentication
                    </button>
                  </div>
                </div>

                <div className="template-selector-with-sync">
                  <select value={templateName} onChange={onTemplateNameChange}>
                    <option value="">Select template...</option>
                    {filteredTemplates.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.name} ({template.language}) -{" "}
                        {template.status}
                      </option>
                    ))}
                  </select>

                  {templateName &&
                    (() => {
                      const variableCount = selectedTemplate
                        ? (
                            selectedTemplate.content?.body?.match(
                              /\{\{\d+\}\}/g,
                            ) || []
                          ).length
                        : 0;
                      return variableCount > 0 ? (
                        <div className="variable-count-indicator">
                          {variableCount} variable
                          {variableCount !== 1 ? "s" : ""} required
                        </div>
                      ) : null;
                    })()}
                </div>

                {selectedTemplate ? (
                  <div className="template-header-hint">
                    <span className="template-header-hint__label">Header</span>
                    <span
                      className={`template-header-hint__chip ${selectedTemplateHasImageHeader ? "is-image" : "is-text"}`}
                    >
                      {selectedTemplateHasImageHeader
                        ? "Image template"
                        : "Text template"}
                    </span>
                    <span className="template-header-hint__text">
                      {selectedTemplateHasImageHeader
                        ? "This template requires an image header. Upload one before sending."
                        : "This approved template uses text-only header content."}
                    </span>
                  </div>
                ) : null}

                {selectedTemplateHasImageHeader ? (
                  <div
                    className={`template-media-upload-box${isTemplateHeaderDragOver ? " is-drag-over" : ""}`}
                    onDragOver={handleTemplateHeaderDragOver}
                    onDragLeave={handleTemplateHeaderDragLeave}
                    onDrop={handleTemplateHeaderDrop}
                    onClick={handleTemplateHeaderUploadClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleTemplateHeaderUploadClick();
                      }
                    }}
                  >
                    <div className="template-media-upload-box__empty-state">
                      <div className="template-media-upload-box__icon-shell">
                        <Upload size={18} />
                      </div>
                      <div className="template-media-upload-box__copy">
                        <strong>
                          {selectedTemplateHeaderMediaUrl
                            ? "Replace the image header"
                            : "Drop image here"}
                        </strong>
                        <span>
                          {isTemplateHeaderDragOver
                            ? "Release to upload this image for the template header."
                            : "PNG or JPG works best. You can also click to browse."}
                        </span>
                      </div>
                    </div>
                    <div className="template-media-upload-box__header">
                      <strong>Image Header</strong>
                      <span>
                        {selectedTemplateHeaderMediaUrl
                          ? "Ready to send"
                          : "Upload required"}
                      </span>
                    </div>
                    <div className="template-media-upload-box__dropzone-copy">
                      {isTemplateHeaderDragOver
                        ? "Drop the image here to upload it for this template."
                        : "Drag and drop an image here, or choose one from your device."}
                    </div>
                    <div className="template-media-upload-box__actions">
                      <input
                        id={templateHeaderUploadInputId}
                        type="file"
                        accept="image/*"
                        className="template-media-upload-box__input"
                        onChange={onTemplateHeaderMediaUpload}
                        disabled={templateHeaderMediaUploading}
                      />
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleTemplateHeaderUploadClick();
                        }}
                        disabled={templateHeaderMediaUploading}
                      >
                        {templateHeaderMediaUploading
                          ? "Uploading..."
                          : selectedTemplateHeaderMediaUrl
                            ? "Replace Image"
                            : "Upload Image"}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClearTemplateHeaderMedia?.();
                        }}
                        disabled={
                          templateHeaderMediaUploading ||
                          !selectedTemplateHeaderMediaUrl
                        }
                      >
                        Clear
                      </button>
                    </div>
                    {selectedTemplateHeaderMediaUrl ? (
                      <div className="template-media-upload-box__preview">
                        <img
                          src={selectedTemplateHeaderMediaUrl}
                          alt={`${templateName} header`}
                        />
                      </div>
                    ) : null}
                    {templateHeaderMediaError ? (
                      <div className="template-media-upload-box__error">
                        {templateHeaderMediaError}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <small>
                  These are your approved templates from WhatsApp Business
                  Manager
                </small>
              </div>
            </>
          ) : (
            /* Template-only broadcast flow:
               the custom message composer is intentionally hidden now. */
            <></>
          )}

          {/*
          <div className="form-group meta-lead-sync-block">
            <label>
              <Users size={16} /> Meta Lead Batch Sync (Optional)
            </label>
            <textarea
              rows={3}
              value={metaLeadIdsText}
              onChange={(e) => setMetaLeadIdsText(e.target.value)}
              placeholder="Paste Meta lead IDs (comma/newline separated)"
            />
            <small className="meta-lead-sync-summary">
              {hasMetaLeadIds
                ? `${parsedMetaLeadIds.length} lead ID${parsedMetaLeadIds.length === 1 ? '' : 's'} ready`
                : 'No lead IDs parsed yet'}
            </small>
            <div className="meta-lead-sync-row">
              <label className="meta-lead-sync-check">
                <input
                  type="checkbox"
                  checked={metaSendTemplate}
                  onChange={(e) => setMetaSendTemplate(e.target.checked)}
                />
                Sync and send selected template
              </label>
              <label className="meta-lead-sync-check">
                <input
                  type="checkbox"
                  checked={metaDryRun}
                  onChange={(e) => setMetaDryRun(e.target.checked)}
                />
                Dry run (no send)
              </label>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleMetaBatchSubmit}
                disabled={metaLeadBatchLoading || !hasMetaLeadIds}
              >
                {metaLeadBatchLoading ? 'Syncing...' : 'Run Lead Sync'}
              </button>
            </div>
            {metaLeadBatchResult ? (
              <small className="meta-lead-sync-summary">
                {`Leads: ${metaLeadBatchResult?.summary?.totalLeadIds || 0} | Synced: ${metaLeadBatchResult?.summary?.syncedSuccess || 0} | Sync failed: ${metaLeadBatchResult?.summary?.syncedFailed || 0} | Send success: ${metaLeadBatchResult?.summary?.templateSendSuccess || 0} | Send failed: ${metaLeadBatchResult?.summary?.templateSendFailed || 0}`}
              </small>
            ) : null}
            {metaLeadBatchResult ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={downloadMetaBatchFullCsv}
              >
                Download Full Batch Report CSV
              </button>
            ) : null}
            {metaLeadBatchResult &&
            (Number(metaLeadBatchResult?.summary?.syncedFailed || 0) > 0 ||
              Number(metaLeadBatchResult?.summary?.templateSendFailed || 0) > 0) ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={downloadMetaBatchFailureCsv}
              >
                Download Failed Rows CSV
              </button>
            ) : null}
            {Number(metaLeadBatchResult?.summary?.templateSendFailed || 0) > 0 ? (
              <button
                type="button"
                className="primary-btn meta-lead-retry-btn"
                onClick={retryFailedMetaSends}
                disabled={metaLeadBatchLoading}
              >
                {metaLeadBatchLoading ? 'Retrying...' : 'Retry Failed Sends Only'}
              </button>
            ) : null}
            {metaRetryCount > 0 ? (
              <small className="meta-lead-retry-meta">
                {`Retries: ${metaRetryCount} | Last retry leads: ${metaLastRetryLeadCount} | Last retry at: ${
                  metaLastRetryAt ? metaLastRetryAt.toLocaleString() : '-'
                }`}
              </small>
            ) : null}
            {metaRetryHistory.length > 0 ? (
              <div className="meta-lead-retry-history">
                {metaRetryHistory.map((item, index) => (
                  <span key={`${item.at?.toISOString?.() || 'retry'}-${index}`} className="meta-lead-retry-chip">
                    {`${item.at ? item.at.toLocaleString() : '-'} | ${item.leadCount} leads`}
                  </span>
                ))}
              </div>
            ) : null}
            {metaRetryHistory.length > 0 ? (
              <button
                type="button"
                className="secondary-btn meta-lead-download-btn"
                onClick={clearMetaRetryHistory}
              >
                Clear Retry History
              </button>
            ) : null}
          </div>
          */}

          <div className="form-group">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <label style={{ marginBottom: 0 }}>Recipients *</label>
              <div style={{ position: "relative" }} ref={addRecipientMenuRef}>
                <button
                  type="button"
                  className="replace-upload-btn"
                  onClick={handleToggleAddRecipientMenu}
                  aria-haspopup="menu"
                  aria-expanded={showAddRecipientMenu}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <UserPlus size={16} />
                  Add
                  <ChevronDown size={14} />
                </button>

                {showAddRecipientMenu ? (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      zIndex: 20,
                      minWidth: 220,
                      padding: 8,
                      border: "1px solid #dbe4ff",
                      borderRadius: 14,
                      background: "#fff",
                      boxShadow: "0 18px 36px rgba(15, 23, 42, 0.12)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={() => handleAddRecipientMenuAction("contacts")}
                      style={{ justifyContent: "flex-start" }}
                    >
                      <Users size={16} />
                      From CRM
                    </button>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={() => handleAddRecipientMenuAction("groups")}
                      style={{ justifyContent: "flex-start" }}
                    >
                      <Users size={16} />
                      Saved Groups
                    </button>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={() => handleAddRecipientMenuAction("campaign")}
                      style={{ justifyContent: "flex-start" }}
                    >
                      <Calendar size={16} />
                      From Past Campaigns
                    </button>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={() => handleAddRecipientMenuAction("csv")}
                      style={{ justifyContent: "flex-start" }}
                    >
                      <Upload size={16} />
                      CSV first
                    </button>
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="clear-upload-btn"
                        onClick={() => handleAddRecipientMenuAction("clear")}
                        style={{ justifyContent: "flex-start" }}
                      >
                        Clear Selected Contacts
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="audience-source-toggle">
              <button
                type="button"
                className={`audience-source-toggle__btn${audienceSourceMode === "contacts" ? " is-active" : ""}`}
                onClick={() =>
                  typeof onAudienceSourceModeChange === "function" &&
                  onAudienceSourceModeChange("contacts")
                }
              >
                <Users size={16} />
                Contacts first
              </button>
              <button
                type="button"
                className={`audience-source-toggle__btn${audienceSourceMode === "csv" ? " is-active" : ""}`}
                onClick={() =>
                  typeof onAudienceSourceModeChange === "function" &&
                  onAudienceSourceModeChange("csv")
                }
              >
                <Upload size={16} />
                CSV first
              </button>
            </div>
            <p className="audience-source-helper">
              {audienceSourceMode === "contacts"
                ? "Audience source: CRM contacts"
                : audienceSourceMode === "campaign" || hasCampaignAudience
                  ? "Audience source: Past campaign contacts"
                  : "Audience source: CSV upload"}
            </p>

            <div className="voice-style-upload-wrapper">
              <input
                type="file"
                accept=".csv"
                onChange={onFileUpload}
                id="broadcast-csv-upload"
                className="csv-input"
                ref={csvInputRef}
                disabled={isCsvUploadBusy}
              />

              {hasCampaignAudience ? (
                <div className="contacts-preview-panel">
                  <div className="contacts-preview-header">
                    <div className="contacts-preview-info">
                      <Users size={20} />
                      <span>
                        {selectedCampaignAudienceCount.toLocaleString()} contacts
                        selected
                      </span>
                    </div>
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="contacts-clear-btn"
                        onClick={onClearSelectedAudience}
                        title="Clear campaign audience"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>

                  <div className="contacts-source-toggle">
                    {typeof onOpenContactAudiencePicker === "function" ? (
                      <button
                        type="button"
                        className={`contacts-source-toggle__btn${audienceSourceMode === "contacts" ? " is-active" : ""}`}
                        onClick={onOpenContactAudiencePicker}
                      >
                        <Users size={16} />
                        From CRM
                      </button>
                    ) : null}
                    {typeof onOpenCampaignAudiencePicker === "function" ? (
                      <button
                        type="button"
                        className={`contacts-source-toggle__btn${audienceSourceMode === "campaign" ? " is-active" : ""}`}
                        onClick={onOpenCampaignAudiencePicker}
                      >
                        <Calendar size={16} />
                        From Past Campaigns
                      </button>
                    ) : null}
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="contacts-source-toggle__btn is-secondary"
                        onClick={onClearSelectedAudience}
                      >
                        Clear Selected Contacts
                      </button>
                    ) : null}
                  </div>

                  {audienceSourceLabel ? (
                    <p className="contacts-more-row" style={{ marginTop: 0 }}>
                      Audience source: {audienceSourceLabel}
                    </p>
                  ) : null}

                  <div className="recipient-quality-summary is-clean">
                    <strong>
                      All {selectedCampaignAudienceCount.toLocaleString()} contacts
                      are selected.
                    </strong>{" "}
                    Past campaign contacts are ready to send.
                  </div>

                  <div className="contacts-preview-table-wrap">
                    <table className="contacts-preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Phone</th>
                          <th>Name</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(campaignAudienceRows.length > 0
                          ? campaignAudienceRows
                          : Array.from({
                              length: Math.max(
                                0,
                                Number(selectedCampaignAudienceCount || 0),
                              ),
                            }).map((_, index) => ({
                              _id: `campaign-row-${index}`,
                              phone: "",
                              name: "",
                              status: "selected",
                            }))
                        ).map((row, index) => (
                          <tr key={row?._id || `${row?.phone || "row"}-${index}`}>
                            <td>{index + 1}</td>
                            <td className="phone-cell">
                              <span>{row?.phone || "—"}</span>
                              <span className="phone-quality-badge valid">
                                Selected
                              </span>
                            </td>
                            <td>{row?.name || "Campaign contact"}</td>
                            <td>
                              <span className="phone-quality-badge valid">
                                {row?.status || "selected"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {selectedCampaignAudienceCount > 5 ? (
                      <p className="contacts-more-row">
                        ... and {selectedCampaignAudienceCount - 5} more contacts
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    className="replace-csv-btn"
                    onClick={onOpenCampaignAudiencePicker}
                  >
                    <Users size={16} />
                    Review Campaign Audience
                  </button>
                </div>
              ) : recipients.length === 0 ? (
                <>
                  <div className="contacts-source-toggle">
                    {typeof onOpenContactAudiencePicker === "function" ? (
                      <button
                        type="button"
                        className={`contacts-source-toggle__btn${audienceSourceMode === "contacts" ? " is-active" : ""}`}
                        onClick={onOpenContactAudiencePicker}
                      >
                        <Users size={16} />
                        From CRM
                      </button>
                    ) : null}
                    {typeof onOpenCampaignAudiencePicker === "function" ? (
                      <button
                        type="button"
                        className={`contacts-source-toggle__btn${audienceSourceMode === "campaign" ? " is-active" : ""}`}
                        onClick={onOpenCampaignAudiencePicker}
                      >
                        <Calendar size={16} />
                        From Past Campaigns
                      </button>
                    ) : null}
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="contacts-source-toggle__btn is-secondary"
                        onClick={onClearSelectedAudience}
                      >
                        Clear Selected Contacts
                      </button>
                    ) : null}
                  </div>

                  {audienceSourceMode === "contacts" ? (
                    <>
                      <div
                        className={`voice-upload-dropzone ${isDragOver ? "drag-over" : ""} ${csvUploadPhase !== "idle" ? `is-${csvUploadPhase}` : ""}`}
                        onClick={
                          isCsvUploadBusy ? undefined : triggerAudienceSelection
                        }
                        onDragOver={
                          isCsvUploadBusy ? undefined : handleCsvDragOver
                        }
                        onDragLeave={
                          isCsvUploadBusy ? undefined : handleCsvDragLeave
                        }
                        onDrop={isCsvUploadBusy ? undefined : handleCsvDrop}
                        aria-busy={isCsvUploadBusy}
                        aria-disabled={isCsvUploadBusy}
                      >
                        <Upload size={48} />
                        <h3>Select contacts from CRM</h3>
                        <p>
                          Click here to open your contacts and build the
                          audience from CRM.
                        </p>
                        <small>
                          Use CRM contacts now. CSV remains available as
                          fallback.
                        </small>
                        {csvUploadPhase !== "idle" ? (
                          <div
                            className={`csv-upload-overlay is-${csvUploadPhase}`}
                          >
                            <div
                              className="csv-upload-overlay__spinner"
                              aria-hidden="true"
                            />
                            <div className="csv-upload-overlay__content">
                              <strong>
                                {csvUploadMessage || "Processing CSV..."}
                              </strong>
                              <span>{csvUploadPercent}%</span>
                            </div>
                            <div
                              className="csv-upload-overlay__progress"
                              aria-hidden="true"
                            >
                              <span style={{ width: `${csvUploadPercent}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="download-sample-btn"
                        onClick={downloadSampleCsv}
                      >
                        <Download size={16} />
                        Download Sample CSV
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className={`voice-upload-dropzone ${isDragOver ? "drag-over" : ""} ${csvUploadPhase !== "idle" ? `is-${csvUploadPhase}` : ""}`}
                        onClick={
                          isCsvUploadBusy ? undefined : triggerAudienceSelection
                        }
                        onDragOver={
                          isCsvUploadBusy ? undefined : handleCsvDragOver
                        }
                        onDragLeave={
                          isCsvUploadBusy ? undefined : handleCsvDragLeave
                        }
                        onDrop={isCsvUploadBusy ? undefined : handleCsvDrop}
                        aria-busy={isCsvUploadBusy}
                        aria-disabled={isCsvUploadBusy}
                      >
                        <Upload size={48} />
                        <h3>Upload CSV contacts</h3>
                        <p>
                          Click here to upload a CSV list. CRM contacts remain
                          available.
                        </p>
                        <small>
                          CSV must include "phone" or "mobile" column when used
                        </small>
                        {csvUploadPhase !== "idle" ? (
                          <div
                            className={`csv-upload-overlay is-${csvUploadPhase}`}
                          >
                            <div
                              className="csv-upload-overlay__spinner"
                              aria-hidden="true"
                            />
                            <div className="csv-upload-overlay__content">
                              <strong>
                                {csvUploadMessage || "Processing CSV..."}
                              </strong>
                              <span>{csvUploadPercent}%</span>
                            </div>
                            <div
                              className="csv-upload-overlay__progress"
                              aria-hidden="true"
                            >
                              <span style={{ width: `${csvUploadPercent}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="download-sample-btn"
                        onClick={downloadSampleCsv}
                      >
                        <Download size={16} />
                        Download Sample CSV
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="contacts-preview-panel">
                    <div className="contacts-preview-header">
                      <div className="contacts-preview-info">
                        <Users size={20} />
                        <span>
                          {audienceSourceLabel
                            ? `${recipients.length} contacts selected`
                            : `${recipients.length} recipients loaded`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="contacts-clear-btn"
                        onClick={onClearUpload}
                        title="Clear contacts"
                      >
                        ×
                      </button>
                    </div>

                    {csvUploadPhase !== "idle" ? (
                      <div
                        className={`csv-upload-inline-banner ${csvUploadPhase === "completed" ? "is-completed" : csvUploadPhase === "failed" ? "is-failed" : ""}`}
                        aria-live="polite"
                      >
                        <strong>
                          {csvUploadMessage || "Replacing CSV..."}
                        </strong>
                        <span>{csvUploadPercent}%</span>
                      </div>
                    ) : null}

                    <div className="contacts-source-toggle">
                      {typeof onOpenContactAudiencePicker === "function" ? (
                        <button
                          type="button"
                          className={`contacts-source-toggle__btn${audienceSourceMode === "contacts" ? " is-active" : ""}`}
                          onClick={onOpenContactAudiencePicker}
                        >
                          <Users size={16} />
                          From CRM
                        </button>
                      ) : null}
                      {typeof onOpenCampaignAudiencePicker === "function" ? (
                        <button
                          type="button"
                          className={`contacts-source-toggle__btn${audienceSourceMode === "campaign" ? " is-active" : ""}`}
                          onClick={onOpenCampaignAudiencePicker}
                        >
                          <Calendar size={16} />
                          From Past Campaigns
                        </button>
                      ) : null}
                      {typeof onClearSelectedAudience === "function" ? (
                        <button
                          type="button"
                          className="contacts-source-toggle__btn is-secondary"
                          onClick={onClearSelectedAudience}
                        >
                          Clear Selected Contacts
                        </button>
                      ) : null}
                    </div>

                    {audienceSourceLabel ? (
                      <p className="contacts-more-row" style={{ marginTop: 0 }}>
                        Audience source: {audienceSourceLabel}
                      </p>
                    ) : null}

                    <div
                      className={`recipient-quality-summary ${recipientQualitySummary.hasIssues ? "has-issues" : "is-clean"}`}
                    >
                      {recipientQualitySummary.hasIssues ? (
                        <>
                          <strong>
                            {recipientQualitySummary.validCount} valid contacts
                            ready.
                          </strong>{" "}
                          Skipping {recipientQualitySummary.skippedCount} rows (
                          {recipientQualitySummary.missingPhoneCount} missing
                          phone, {recipientQualitySummary.duplicatePhoneCount}{" "}
                          duplicates).
                        </>
                      ) : (
                        <>
                          <strong>
                            All {recipientQualitySummary.validCount} contacts
                            are valid.
                          </strong>{" "}
                          No missing or duplicate phone rows detected.
                        </>
                      )}
                    </div>

                    {audienceSourceMode === "csv" &&
                    recipientQualitySummary.missingOptInCount > 0 ? (
                      <div className="csv-optin-warning">
                        <strong>
                          {recipientQualitySummary.missingOptInCount} CSV rows
                          are missing WhatsApp opt-in.
                        </strong>{" "}
                        Marketing templates can only send to opted-in contacts.
                      </div>
                    ) : null}

                    <div className="recipient-quality-actions">
                      <button
                        type="button"
                        className="contacts-clean-btn"
                        onClick={onAutoCleanRecipients}
                        disabled={
                          !recipientQualitySummary.hasIssues ||
                          typeof onAutoCleanRecipients !== "function"
                        }
                      >
                        Auto-clean rows
                      </button>
                      <button
                        type="button"
                        className="contacts-clean-btn"
                        onClick={downloadRecipientIssueCsv}
                        disabled={!recipientQualitySummary.hasIssues}
                      >
                        Download issue rows
                      </button>
                    </div>

                    <div className="contacts-preview-table-wrap">
                      <table className="contacts-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Phone</th>
                            <th>Name</th>
                            {audienceSourceMode === "csv" ? (
                              <th>Opt-in</th>
                            ) : (
                              <th>Custom Fields</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {contactRows.map((row) => (
                            <tr
                              key={`${row.phone}-${row.index}`}
                              className={
                                row.qualityTone === "issue"
                                  ? "contact-row-issue"
                                  : ""
                              }
                            >
                              <td>{row.index + 1}</td>
                              <td className="phone-cell">
                                <span>{row.phone}</span>
                                <span
                                  className={`phone-quality-badge ${row.qualityTone}`}
                                >
                                  {row.qualityLabel}
                                </span>
                              </td>
                              <td>{row.name}</td>
                              {audienceSourceMode === "csv" ? (
                                <td>
                                  <span
                                    className={`phone-quality-badge ${row.optInTone}`}
                                  >
                                    {row.optInLabel}
                                  </span>
                                </td>
                              ) : null}
                              {audienceSourceMode !== "csv" ? (
                                <td>
                                  {row.customFieldCount > 0 ? (
                                    <span className="field-badge">
                                      {row.customFieldCount} fields
                                    </span>
                                  ) : (
                                    <span className="muted-text">None</span>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {recipients.length > 5 ? (
                        <p className="contacts-more-row">
                          ... and {recipients.length - 5} more contacts below
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="replace-csv-btn"
                      onClick={handleReplaceCsv}
                    >
                      <Upload size={16} />
                      Replace CSV
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="upload-format-info">
              <small>
                <strong>Supported format:</strong> CSV columns:{" "}
                {requiredColumnsLabel}.
              </small>
            </div>
          </div>

          <div className="form-group advanced-settings-block">
            <details>
              <summary>
                <Settings size={16} />
                Scheduled Time
              </summary>
              <div className="advanced-settings-content">
                <div className="schedule-input-row">
                  <div className="schedule-picker-wrap">
                    <input
                      ref={scheduleInputRef}
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={onScheduledTimeChange}
                      onFocus={openSchedulePicker}
                      min={getCurrentDateTimeLocal()}
                    />
                  </div>

                  {scheduledTime ? (
                    <button
                      type="button"
                      className="schedule-clear-btn"
                      onClick={clearScheduleTime}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <small>
                  Select date/time to schedule. Use <strong>Clear</strong> for
                  immediate send.
                </small>
                {scheduleValidation.isInvalid ? (
                  <small className="schedule-validation-error">
                    {scheduleValidation.reason}
                  </small>
                ) : null}
              </div>
            </details>
          </div>

          <div className="form-group policy-settings-block">
            <details>
              <summary>
                <Settings size={16} />
                Delivery & Compliance Policy
              </summary>
              <div className="policy-settings-content">
                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={quietHoursEnabled}
                    onChange={(event) =>
                      onQuietHoursEnabledChange(event.target.checked)
                    }
                  />
                  <span>Enable quiet hours</span>
                </label>

                {quietHoursEnabled ? (
                  <div className="policy-grid">
                    <div className="policy-field">
                      <span>Start hour</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={quietHoursStartHour}
                        onChange={(event) =>
                          onQuietHoursStartHourChange(event.target.value)
                        }
                        onBlur={normalizeQuietStartHour}
                      />
                    </div>
                    <div className="policy-field">
                      <span>End hour</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={quietHoursEndHour}
                        onChange={(event) =>
                          onQuietHoursEndHourChange(event.target.value)
                        }
                        onBlur={normalizeQuietEndHour}
                      />
                    </div>
                    <div className="policy-field">
                      <span>Timezone</span>
                      <input
                        type="text"
                        value={quietHoursTimezone}
                        onChange={(event) =>
                          onQuietHoursTimezoneChange(event.target.value)
                        }
                        onBlur={normalizeQuietTimezone}
                        placeholder="Asia/Kolkata"
                      />
                    </div>
                    <div className="policy-field">
                      <span>Action</span>
                      <select
                        value={quietHoursAction}
                        onChange={(event) =>
                          onQuietHoursActionChange(event.target.value)
                        }
                      >
                        <option value="defer">Defer send</option>
                        <option value="skip">Skip send</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={retryPolicyEnabled}
                    onChange={(event) =>
                      onRetryPolicyEnabledChange(event.target.checked)
                    }
                  />
                  <span>Enable retry policy</span>
                </label>

                <div className="policy-grid">
                  <div className="policy-field">
                    <span>Max attempts</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={retryMaxAttempts}
                      disabled={!retryPolicyEnabled}
                      onChange={(event) =>
                        onRetryMaxAttemptsChange(event.target.value)
                      }
                      onBlur={normalizeRetryAttempts}
                    />
                  </div>
                  <div className="policy-field">
                    <span>Backoff (seconds)</span>
                    <input
                      type="number"
                      min="5"
                      max="600"
                      value={retryBackoffSeconds}
                      disabled={!retryPolicyEnabled}
                      onChange={(event) =>
                        onRetryBackoffSecondsChange(event.target.value)
                      }
                      onBlur={normalizeRetryBackoff}
                    />
                  </div>
                </div>

                <div className="policy-field">
                  <span>Delivery batch size</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={deliveryBatchSize}
                    onChange={(event) =>
                      onDeliveryBatchSizeChange(event.target.value)
                    }
                    onBlur={() =>
                      onDeliveryBatchSizeChange(
                        String(
                          Math.min(
                            50,
                            Math.max(1, Number(deliveryBatchSize) || 50),
                          ),
                        ),
                      )
                    }
                  />
                  <small>
                    Controls how many recipients the backend processes before
                    moving to the next batch.
                  </small>
                </div>

                <div className="policy-field">
                  <span>Wait between batches (seconds)</span>
                  <input
                    type="number"
                    min="0"
                    max="3600"
                    value={deliveryBatchDelaySeconds}
                    onChange={(event) =>
                      onDeliveryBatchDelaySecondsChange(event.target.value)
                    }
                    onBlur={() =>
                      onDeliveryBatchDelaySecondsChange(
                        String(
                          Math.min(
                            3600,
                            Math.max(0, Number(deliveryBatchDelaySeconds) || 0),
                          ),
                        ),
                      )
                    }
                  />
                  <small>
                    How long the backend waits before sending the next batch.
                  </small>
                </div>

                <label className="policy-checkbox-row">
                  <input
                    type="checkbox"
                    checked={respectOptOut}
                    onChange={(event) =>
                      onRespectOptOutChange(event.target.checked)
                    }
                  />
                  <span>Respect opted-out recipients</span>
                </label>

                <div className="policy-field suppression-list-field">
                  <span>Suppression list (comma/newline separated)</span>
                  <textarea
                    rows={3}
                    value={suppressionListRaw}
                    onChange={(event) =>
                      onSuppressionListRawChange(event.target.value)
                    }
                    placeholder="+919999999999, +919888888888"
                  />
                  <small className="suppression-list-meta">
                    {suppressionListMeta.total > 0
                      ? `${suppressionListMeta.total} unique number${suppressionListMeta.total === 1 ? "" : "s"}`
                      : "No suppression numbers added"}
                  </small>
                  {suppressionListMeta.invalidEntries.length > 0 ? (
                    <small className="suppression-list-error">
                      Invalid format:{" "}
                      {suppressionListMeta.invalidEntries
                        .slice(0, 5)
                        .join(", ")}
                      {suppressionListMeta.invalidEntries.length > 5
                        ? "..."
                        : ""}
                    </small>
                  ) : null}
                </div>
                {policyValidation.isInvalid ? (
                  <small className="policy-validation-error">
                    {policyValidation.reason}
                  </small>
                ) : null}
              </div>
            </details>
          </div>

          {uploadedFile && fileVariables.length > 0 && (
            <div className="variable-file-info">
              Variables detected: {fileVariables.join(", ")}
            </div>
          )}

          {uploadedFile &&
          messageType === "template" &&
          selectedTemplate &&
          getTemplateVariableCount(selectedTemplate) > 0 &&
          fileVariables.length === 0 ? (
            <div className="submit-block-warning" style={{ marginTop: 12 }}>
              <strong>CSV needs template variables:</strong> this template
              requires {getTemplateVariableCount(selectedTemplate)} variable
              column(s) like <code>var1</code>, <code>var2</code>. Your CSV does
              not include them yet.
            </div>
          ) : null}

          <div className="form-actions">
            {hasStoredDraft ? (
              <div className="draft-status-meta">
                {draftSavedAt
                  ? `Draft auto-saved at ${draftSavedAt.toLocaleTimeString()}`
                  : "Draft auto-save is enabled"}
              </div>
            ) : null}

            {hasRecipientIssues ? (
              <div className="submit-block-warning">
                <strong>Broadcast blocked:</strong> fix recipient issues first (
                {recipientQualitySummary.missingPhoneCount} missing phone,{" "}
                {recipientQualitySummary.duplicatePhoneCount} duplicates).
              </div>
            ) : null}

            <button
              type="button"
              className="secondary-btn"
              onClick={handleSaveDraftNow}
            >
              Save Draft Now
            </button>

            {hasStoredDraft ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleClearSavedDraft}
              >
                Clear Saved Draft
              </button>
            ) : null}

            <button className="secondary-btn" onClick={handleResetClick}>
              Reset
            </button>

            <button
              className="secondary-btn"
              onClick={handleBackToOverviewClick}
            >
              Back to Overview
            </button>

            {scheduledTime ? (
              <button
                className="primary-btn"
                onClick={handleCreateBroadcastClick}
                disabled={
                  isSending ||
                  !canSubmitCampaign ||
                  hasRecipientIssues ||
                  scheduleValidation.isInvalid ||
                  policyValidation.isInvalid
                }
              >
                <Calendar size={16} />
                {isSending
                  ? "Scheduling..."
                  : `Schedule Broadcast (${recipients.length} contacts)`}
              </button>
            ) : (
              <button
                className="primary-btn"
                onClick={handleSendBroadcastClick}
                disabled={
                  isSending ||
                  !canSubmitCampaign ||
                  hasRecipientIssues ||
                  policyValidation.isInvalid
                }
              >
                {isSending ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Start Broadcast ({recipients.length} contacts)
                  </>
                )}
              </button>
            )}
          </div>

          {sendResults && (
            <div className="results-section">
              <h4>Campaign Results</h4>

              <div className="result-stats">
                <div className="stat">
                  <span className="label">Total Sent:</span>
                  <span className="value">{sendResults.total_sent}</span>
                </div>

                <div className="stat">
                  <span className="label">Successful:</span>
                  <span className="value success">
                    {sendResults.successful}
                  </span>
                </div>

                <div className="stat">
                  <span className="label">Failed:</span>
                  <span className="value failed">
                    {sendResults.failed ??
                      (sendResults.total_sent || 0) -
                        (sendResults.successful || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="broadcast-message-preview">
        <MessagePreview
          messageType={messageType}
          templateName={templateName}
          selectedTemplate={selectedTemplate}
          templateHeaderMediaUrl={selectedTemplateHeaderMediaUrl}
          customMessage={customMessage}
          recipients={recipients}
          getTemplatePreview={getSelectedTemplatePreview}
          getMessagePreview={() => {
            if (!customMessage) return "Enter your custom message";
            return customMessage;
          }}
        />
      </div>
    </div>
  );
};

export default ScheduleForm;
