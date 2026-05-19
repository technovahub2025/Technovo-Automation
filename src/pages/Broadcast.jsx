import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Papa from "papaparse";

import { apiClient } from "../services/whatsappapi";
import { useBroadcast, useCampaignAutomation } from "../hooks/useBroadcast";
import webSocketService from "../services/websocketService";

// Import components
import BroadcastHeader from "../components/broadcastComponents/BroadcastHeader";
import DateRangeFilter from "../components/broadcastComponents/DateRangeFilter";
import OverviewStats from "../components/broadcastComponents/OverviewStats";
import ReliabilityInsights from "../components/broadcastComponents/ReliabilityInsights";

import { getCachedOverviewStats } from "../utils/stableBroadcastStats";
import {
  clearSidebarPageCache,
  resolveCacheUserId,
} from "../utils/sidebarPageCache";

import BroadcastListControls from "../components/broadcastComponents/BroadcastListControls";
import BroadcastTable from "../components/broadcastComponents/BroadcastTable";
import ScheduleForm from "../components/broadcastComponents/ScheduleForm";
import DeleteModal from "../components/broadcastComponents/DeleteModal";
import BroadcastTypeChoice from "../components/broadcastComponents/BroadcastTypeChoice";
import NewBroadcastPopup from "../components/broadcastComponents/NewBroadcastPopup";

import AllCampaignsPopup from "../components/broadcastComponents/AllCampaignsPopup";

// Import existing components
import BroadcastAnalyticsModal from "../components/broadcastComponents/BroadcastAnalyticsModal";
import BroadcastAudienceValidationModal from "../components/broadcastComponents/BroadcastAudienceValidationModal";
import ContactAudiencePickerModal from "../components/broadcastComponents/ContactAudiencePickerModal";
import CampaignAudiencePickerModal from "../components/broadcastComponents/CampaignAudiencePickerModal";
import OutboundDialer from "../components/outbound/OutboundDialer";
import { stripAppRouteBase } from "../utils/appRouteBase";

// Import styles
import "../styles/whatsapp.css";
import "../styles/message-preview.css";
import "../styles/broadcast-list-controls.css";
import "./Broadcast.css";

const normalizeText = (value = "") => String(value || "").trim();

const getBroadcastErrorMessage = (
  error,
  fallback = "Failed to send campaign. Please try again.",
) => {
  const status = Number(error?.response?.status || 0);
  const backendMessage = String(
    error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "",
  ).trim();
  const normalized = backendMessage.toLowerCase();

  if (
    normalized.includes("redis is not configured") ||
    normalized.includes("redis is disabled by environment configuration") ||
    normalized.includes("broadcast queue is disabled") ||
    normalized.includes("broadcast inbox queue is disabled")
  ) {
    return "Broadcast sending is temporarily unavailable in this deployment. Please try again later or contact support.";
  }

  if (status === 403) {
    return (
      backendMessage ||
      "Broadcast is blocked for this workspace until activation."
    );
  }

  if (!backendMessage) {
    return fallback;
  }

  return backendMessage;
};

const findPhoneField = (fields = []) => {
  const normalizedFields = Array.isArray(fields) ? fields : [];
  const patterns = [
    /whatsapp\s*number/i,
    /\bphone\s*number\b/i,
    /\bmobile\s*number\b/i,
    /\bwhatsapp\b/i,
    /\bphone\b/i,
    /\bmobile\b/i,
    /\bnumber\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedFields.find((field) =>
      pattern.test(String(field || "").trim()),
    );
    if (match) return match;
  }

  return normalizedFields[0] || "";
};

const Broadcast = ({
  composerMode = false,
  composerType = null,
  chooserMode = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = stripAppRouteBase(location.pathname);
  const currentUserId = resolveCacheUserId();

  const {
    // State

    activeTab,
    setActiveTab,
    messageType,
    setMessageType,
    officialTemplates,
    templateName,
    setTemplateName,
    language,
    setLanguage,

    templateFilter,
    setTemplateFilter,

    broadcasts,

    recipients,
    setRecipients,

    uploadedFile,
    setUploadedFile,

    isSending,
    setIsSending,

    sendResults,
    setSendResults,

    showResultsPopup,
    setShowResultsPopup,

    showNewBroadcastPopup,
    setShowNewBroadcastPopup,

    showBroadcastTypeChoice,
    setShowBroadcastTypeChoice,

    customMessage,
    setCustomMessage,

    scheduledTime,
    setScheduledTime,

    selectedCampaigns,
    setSelectedCampaigns,

    showDropdown,
    setShowDropdown,

    showDeleteModal,
    setShowDeleteModal,

    selectionMode,
    setSelectionMode,
    isExportingCampaigns,

    lastUpdated,

    searchTerm,
    setSearchTerm,

    statusFilter,
    setStatusFilter,

    sortBy,
    setSortBy,

    sortOrder,
    setSortOrder,

    showFilterDropdown,
    setShowFilterDropdown,

    dateFilter,
    setDateFilter,

    startDate,
    setStartDate,

    endDate,
    setEndDate,

    selectedPeriod,
    setSelectedPeriod,

    templateVariables,
    setTemplateVariables,

    fileVariables,
    setFileVariables,

    templateHeaderMediaUrl,
    templateHeaderMediaUploading,
    templateHeaderMediaError,

    broadcastName,
    setBroadcastName,

    // Functions

    loadTemplates,

    loadBroadcasts,

    formatLastUpdated,

    getSuccessPercentage,

    getReadPercentage,

    getRepliedPercentage,

    getSortByLabel,

    getStatusClass,

    extractTemplateVariables,
    templateRequiresImageHeader,
    resetTemplateHeaderMediaState,
    handleTemplateHeaderMediaFileUpload,
    clearTemplateHeaderMedia,

    getFilteredAndSortedBroadcasts,

    downloadAllCampaigns,
  } = useBroadcast();

  // Additional state for pagination and broadcast mode
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [audienceValidationModalOpen, setAudienceValidationModalOpen] =
    useState(false);
  const [pendingAudienceValidation, setPendingAudienceValidation] =
    useState(null);
  const [metaLeadBatchLoading, setMetaLeadBatchLoading] = useState(false);
  const [metaLeadBatchResult, setMetaLeadBatchResult] = useState(null);
  const [broadcastMode, setBroadcastMode] = useState("whatsapp");
  const [outboundPhaseTab, setOutboundPhaseTab] = useState("quick");
  const [showContactAudiencePicker, setShowContactAudiencePicker] =
    useState(false);
  const [contactAudiencePickerPurpose, setContactAudiencePickerPurpose] =
    useState("direct");
  const [showCampaignAudiencePicker, setShowCampaignAudiencePicker] =
    useState(false);
  const [audienceSourceMode, setAudienceSourceMode] = useState("contacts");
  const [selectedAudienceMeta, setSelectedAudienceMeta] = useState({
    segmentId: "",
    segmentName: "",
  });
  const [selectedCampaignAudience, setSelectedCampaignAudience] = useState({
    campaignBroadcastId: "",
    campaignName: "",
    campaignStatus: "",
    campaignRecipientCount: 0,
    excludedPhones: [],
    campaignRecipients: [],
    additionalContacts: [],
  });
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStartHour, setQuietHoursStartHour] = useState(22);
  const [quietHoursEndHour, setQuietHoursEndHour] = useState(9);
  const [quietHoursTimezone, setQuietHoursTimezone] = useState("Asia/Kolkata");
  const [quietHoursAction, setQuietHoursAction] = useState("defer");
  const [deliveryBatchSize, setDeliveryBatchSize] = useState(50);
  const [deliveryBatchDelaySeconds, setDeliveryBatchDelaySeconds] = useState(5);
  const [retryPolicyEnabled, setRetryPolicyEnabled] = useState(true);
  const [retryMaxAttempts, setRetryMaxAttempts] = useState(3);
  const [retryBackoffSeconds, setRetryBackoffSeconds] = useState(45);
  const [respectOptOut, setRespectOptOut] = useState(true);
  const [suppressionListRaw, setSuppressionListRaw] = useState("");
  const [csvUploadState, setCsvUploadState] = useState({
    phase: "idle",
    message: "",
    percent: 0,
  });
  const [reliabilitySummary, setReliabilitySummary] = useState({
    campaigns: 0,
    recipientCount: 0,
    suppressed: 0,
    deferred: 0,
    retried: 0,
    skippedQuietHours: 0,
    failureCodeBreakdown: {},
    topFailureCode: null,
  });
  const broadcastSubmitInFlightRef = useRef(false);
  const reliabilitySummaryTimerRef = useRef(null);
  const csvRecipientRefreshContextRef = useRef({
    recipients: [],
    uploadedFile: null,
  });
  const csvReplaceTimeoutRef = useRef(null);
  const csvUploadProgressRef = useRef({
    lastPercent: -1,
    lastUpdateAt: 0,
  });

  useEffect(
    () => () => {
      if (csvReplaceTimeoutRef.current) {
        clearTimeout(csvReplaceTimeoutRef.current);
        csvReplaceTimeoutRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (uploadedFile) return;
    csvUploadProgressRef.current = {
      lastPercent: -1,
      lastUpdateAt: 0,
    };
    setCsvUploadState((current) =>
      current.phase === "idle" && current.percent === 0 && !current.message
        ? current
        : { phase: "idle", message: "", percent: 0 },
    );
  }, [uploadedFile]);

  useEffect(() => {
    if (composerMode) {
      setActiveTab("schedule");
    }
  }, [composerMode, setActiveTab]);

  useEffect(() => {
    if (chooserMode) {
      setShowBroadcastTypeChoice(true);
      setActiveTab("overview");
    }
  }, [chooserMode, setShowBroadcastTypeChoice, setActiveTab]);

  useEffect(() => {
    if (!composerMode) return;
    if (composerType === "template") {
      setMessageType("template");
    }
  }, [composerMode, composerType, setMessageType]);

  useEffect(() => {
    if (currentPath === "/broadcast") {
      setActiveTab("overview");
      setShowBroadcastTypeChoice(false);
      setShowNewBroadcastPopup(false);
      setShowContactAudiencePicker(false);
    }
  }, [
    currentPath,
    setActiveTab,
    setShowBroadcastTypeChoice,
    setShowNewBroadcastPopup,
  ]);

  useEffect(() => {
    const handleCrmChanged = () => {
      void refreshCsvRecipientsFromContacts();
    };

    webSocketService.on("crm_changed", handleCrmChanged);

    return () => {
      webSocketService.off("crm_changed", handleCrmChanged);
    };
  }, []);
  const {
    scheduleLoading,
    retryLoading,
    abTestLoading,
    rotationLoading,
    scheduleResponse,
    retryStats,
    abTestResults,
    rotationStats,
    error: automationError,
    scheduleCampaign,
    triggerRetry,
    createABTest,
    loadRotationStats,
  } = useCampaignAutomation();

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
      const bodyComponent = template.components.find((comp) => {
        const type = String(comp?.type || "").toUpperCase();
        return type === "BODY" || type === "body";
      });
      if (
        typeof bodyComponent?.text === "string" &&
        bodyComponent.text.trim()
      ) {
        return bodyComponent.text.trim();
      }
    }

    return "";
  };

  // Get filtered and sorted broadcasts

  const filteredBroadcasts = getFilteredAndSortedBroadcasts();

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBroadcasts.length / itemsPerPage),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLastItem = safeCurrentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBroadcasts = filteredBroadcasts.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  const paginate = (pageNumber) => {
    const nextPage = Math.min(Math.max(1, pageNumber), totalPages);
    setCurrentPage(nextPage);
  };

  const getVisiblePages = () => {
    const pages = [];
    const windowSize = 2;
    const start = Math.max(1, safeCurrentPage - windowSize);
    const end = Math.min(totalPages, safeCurrentPage + windowSize);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    sortBy,
    sortOrder,
    dateFilter,
    startDate,
    endDate,
    selectedPeriod,
  ]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);
  const stats = getCachedOverviewStats(broadcasts);
  const mergedOverviewStats = {
    ...stats,
    suppressed: Number(reliabilitySummary?.suppressed || 0),
    deferred: Number(reliabilitySummary?.deferred || 0),
    retried: Number(reliabilitySummary?.retried || 0),
    skippedQuietHours: Number(reliabilitySummary?.skippedQuietHours || 0),
  };

  useEffect(() => {
    let isAlive = true;

    const loadReliabilitySummary = async () => {
      const params = {};
      if (statusFilter && statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (startDate) {
        params.dateFrom = startDate;
      }
      if (endDate) {
        params.dateTo = endDate;
      }

      try {
        const response = await apiClient.getBroadcastReliabilitySummary(params);
        const payload = response?.data?.data || {};
        if (!isAlive) return;
        setReliabilitySummary({
          campaigns: Number(payload?.campaigns || 0),
          recipientCount: Number(payload?.recipientCount || 0),
          suppressed: Number(payload?.suppressed || 0),
          deferred: Number(payload?.deferred || 0),
          retried: Number(payload?.retried || 0),
          skippedQuietHours: Number(payload?.skippedQuietHours || 0),
          failureCodeBreakdown:
            payload?.failureCodeBreakdown &&
            typeof payload.failureCodeBreakdown === "object"
              ? payload.failureCodeBreakdown
              : {},
          topFailureCode:
            payload?.topFailureCode &&
            typeof payload.topFailureCode === "object"
              ? payload.topFailureCode
              : null,
        });
      } catch (_error) {
        if (!isAlive) return;
        setReliabilitySummary({
          campaigns: 0,
          recipientCount: 0,
          suppressed: 0,
          deferred: 0,
          retried: 0,
          skippedQuietHours: 0,
          failureCodeBreakdown: {},
          topFailureCode: null,
        });
      }
    };

    if (reliabilitySummaryTimerRef.current) {
      window.clearTimeout(reliabilitySummaryTimerRef.current);
    }
    reliabilitySummaryTimerRef.current = window.setTimeout(() => {
      loadReliabilitySummary();
    }, 180);

    return () => {
      isAlive = false;
      if (reliabilitySummaryTimerRef.current) {
        window.clearTimeout(reliabilitySummaryTimerRef.current);
        reliabilitySummaryTimerRef.current = null;
      }
    };
  }, [lastUpdated, statusFilter, startDate, endDate]);

  // Filter templates by category

  const filteredTemplates = officialTemplates.filter(
    (template) =>
      templateFilter === "all" ||
      template.category?.toLowerCase() === templateFilter.toLowerCase(),
  );

  // Event handlers

  const handleDropdownToggle = (campaignId, event) => {
    event.stopPropagation();

    setShowDropdown(showDropdown === campaignId ? null : campaignId);
  };

  const handleSelectCampaign = () => {
    setSelectionMode(true);

    setSelectedCampaigns([]);

    setShowDropdown(null);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);

    setSelectedCampaigns([]);
  };

  const handleCheckboxChange = (campaignId, event) => {
    event.stopPropagation();

    if (event.target.checked) {
      setSelectedCampaigns((prev) => [...prev, campaignId]);
    } else {
      setSelectedCampaigns((prev) => prev.filter((id) => id !== campaignId));
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allIds = currentBroadcasts.map((b) => b._id);

      setSelectedCampaigns(allIds);
    } else {
      setSelectedCampaigns([]);
    }
  };

  const handleDeleteClick = (campaign) => {
    setSelectedCampaigns([campaign._id]);

    setShowDeleteModal(true);

    setShowDropdown(null);
  };

  const handleBulkDelete = () => {
    if (selectedCampaigns.length === 0) return;

    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedCampaigns.length === 0) return;

    try {
      await Promise.all(
        selectedCampaigns.map((id) => apiClient.deleteBroadcast(id)),
      );

      await loadBroadcasts();

      setShowDeleteModal(false);

      setSelectedCampaigns([]);

      setSelectionMode(false);
    } catch (error) {
      console.error("Failed to delete campaigns:", error);

      alert("Failed to delete campaigns. Please try again.");
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleTemplateNameChange = (e) => {
    const selectedTemplateName = e.target.value;

    setTemplateName(selectedTemplateName);

    const selectedTemplate = officialTemplates.find(
      (t) => t.name === selectedTemplateName,
    );

    if (selectedTemplate) {
      setLanguage(selectedTemplate.language || "en_US");

      if (selectedTemplate.content?.body) {
        extractTemplateVariables(selectedTemplate.content.body);
      } else if (selectedTemplate.components) {
        const bodyComponent = selectedTemplate.components.find(
          (comp) => comp.type === "BODY" && comp.text,
        );

        if (bodyComponent) {
          extractTemplateVariables(bodyComponent.text);
        }
      }

      resetTemplateHeaderMediaState(selectedTemplate);
    } else {
      setTemplateVariables([]);

      setLanguage("en_US");

      clearTemplateHeaderMedia();
    }

    resetTemplateHeaderMediaState(selectedTemplate);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (csvReplaceTimeoutRef.current) {
      clearTimeout(csvReplaceTimeoutRef.current);
      csvReplaceTimeoutRef.current = null;
    }
    csvUploadProgressRef.current = {
      lastPercent: -1,
      lastUpdateAt: 0,
    };
    setRecipients([]);
    setFileVariables([]);
    setUploadedFile(file);
    setCsvUploadState({
      phase: "parsing",
      message: "Parsing CSV...",
      percent: 5,
    });

    const rawRows = [];
    let detectedFields = [];

    const updateCsvUploadState = (phase, message, percent, force = false) => {
      const normalizedPercent = Math.max(
        0,
        Math.min(100, Math.round(Number(percent) || 0)),
      );
      const now = Date.now();
      const lastState = csvUploadProgressRef.current;
      if (
        !force &&
        normalizedPercent <= lastState.lastPercent &&
        now - lastState.lastUpdateAt < 120
      ) {
        return;
      }
      csvUploadProgressRef.current = {
        lastPercent: normalizedPercent,
        lastUpdateAt: now,
      };
      setCsvUploadState({
        phase,
        message,
        percent: normalizedPercent,
      });
    };

    try {
      await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          worker: true,
          skipEmptyLines: "greedy",
          step: (results) => {
            const row =
              results?.data && typeof results.data === "object"
                ? results.data
                : {};
            if (
              !detectedFields.length &&
              Array.isArray(results?.meta?.fields)
            ) {
              detectedFields = results.meta.fields;
            }
            rawRows.push(row);

            const cursor = Number(results?.meta?.cursor || 0);
            const parseProgress =
              file.size > 0
                ? Math.min(
                    95,
                    Math.max(5, Math.round((cursor / file.size) * 75) + 5),
                  )
                : 15;
            updateCsvUploadState("parsing", "Parsing CSV...", parseProgress);
          },
          complete: () => resolve(),
          error: (parseError) => reject(parseError),
        });
      });

      updateCsvUploadState("validating", "Validating numbers...", 80, true);

      const phoneField = findPhoneField(
        detectedFields.length ? detectedFields : Object.keys(rawRows[0] || {}),
      );
      const recipientsWithFullData = rawRows
        .map((row, index) => {
          const normalizedRow = row && typeof row === "object" ? row : {};
          const phone = normalizeText(
            normalizedRow?.[phoneField] ||
              normalizedRow.phone ||
              normalizedRow.mobile ||
              normalizedRow.whatsappNumber,
          );
          if (!phone) return null;

          const fields = detectedFields.length
            ? detectedFields
            : Object.keys(normalizedRow || {});
          const variables = fields
            .filter((field) => String(field || "").trim() !== phoneField)
            .map((field) => normalizeText(normalizedRow?.[field] || ""));

          return {
            phone,
            variables,
            fullData: {
              ...normalizedRow,
              lineNumber: normalizedRow?.lineNumber || index + 1,
            },
          };
        })
        .filter(Boolean);

      if (!recipientsWithFullData.length) {
        throw new Error("No valid phone numbers were found in the CSV file.");
      }

      let enrichedRecipients = recipientsWithFullData;

      try {
        const lookupPhones = Array.from(
          new Set(
            recipientsWithFullData
              .map((recipient) =>
                normalizePhoneForLookup(
                  recipient?.phone ||
                    recipient?.fullData?.phone ||
                    recipient?.data?.phone ||
                    "",
                ),
              )
              .filter(Boolean),
          ),
        );

        if (lookupPhones.length > 0) {
          updateCsvUploadState("validating", "Validating numbers...", 86, true);
          const lookupResult =
            await apiClient.lookupContactsByPhones(lookupPhones);
          const matchedContacts =
            lookupResult?.data?.data || lookupResult?.data || [];
          enrichedRecipients = mergeCsvRecipientsWithContacts(
            recipientsWithFullData,
            matchedContacts,
          );
        }
      } catch (lookupError) {
        console.warn(
          "CRM contact lookup for CSV recipients failed, continuing with CSV data only:",
          lookupError,
        );
      }

      const csvRows = enrichedRecipients
        .map((recipient, index) => {
          const row = recipient?.fullData || recipient?.data || recipient || {};
          const rawTags = Array.isArray(row?.tags)
            ? row.tags
            : String(row?.tags || "")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);
          const consentText = String(
            row?.whatsappOptInTextSnapshot ||
              row?.consentText ||
              row?.optInText ||
              row?.consentSnapshot ||
              "",
          ).trim();
          const proofType = String(
            row?.whatsappOptInProofType ||
              row?.proofType ||
              row?.consentProofType ||
              "",
          ).trim();
          const proofId = String(
            row?.whatsappOptInProofId ||
              row?.proofId ||
              row?.consentProofId ||
              "",
          ).trim();
          const proofUrl = String(
            row?.whatsappOptInProofUrl ||
              row?.proofUrl ||
              row?.consentProofUrl ||
              "",
          ).trim();
          const scope = String(
            row?.whatsappOptInScope || row?.scope || row?.consentScope || "",
          ).trim();

          const importedConsentReferenceId = `landing-page-import-${String(row?.lineNumber || index + 1).trim()}-${
            String(recipient?.phone || row?.phone || "")
              .replace(/\D/g, "")
              .slice(-4) || "contact"
          }-${Date.now().toString(36)}`;

          return {
            name: String(
              row?.name || row?.contactName || recipient?.name || "",
            ).trim(),
            phone: String(
              recipient?.phone ||
                row?.phone ||
                row?.mobile ||
                row?.whatsappNumber ||
                "",
            ).trim(),
            email: String(row?.email || row?.emailAddress || "").trim(),
            tags: rawTags,
            sourceType:
              String(row?.sourceType || "imported").trim() || "imported",
            whatsappOptInStatus: "opted_in",
            whatsappOptInScope: scope || "marketing",
            whatsappOptInTextSnapshot:
              consentText ||
              "Consent captured via website landing page during CSV import.",
            whatsappOptInProofType: proofType || "import_record",
            whatsappOptInProofId: proofId || importedConsentReferenceId,
            whatsappOptInProofUrl: proofUrl,
            whatsappOptInSource:
              String(row?.whatsappOptInSource || "landing_page").trim() ||
              "landing_page",
            whatsappOptInCapturedBy:
              String(row?.whatsappOptInCapturedBy || "csv_import").trim() ||
              "csv_import",
            whatsappOptInPageUrl: String(
              row?.whatsappOptInPageUrl || "",
            ).trim(),
            whatsappOptInIp: String(row?.whatsappOptInIp || "").trim(),
            whatsappOptInUserAgent: String(
              row?.whatsappOptInUserAgent || "",
            ).trim(),
            whatsappOptInMetadata: {
              importLineNumber: row?.lineNumber || index + 1,
              importSource: "csv_import",
              consentSource: "landing_page",
            },
          };
        })
        .filter((contact) => String(contact.phone || "").trim());

      if (csvRows.length > 0) {
        updateCsvUploadState("processing", "Processing contacts...", 92, true);
        const importedConsentLookup = buildContactLookupMap(csvRows);
        enrichedRecipients = enrichedRecipients.map((recipient) => {
          const raw =
            recipient?.data && typeof recipient.data === "object"
              ? recipient.data
              : recipient;
          const fullData =
            raw?.fullData && typeof raw.fullData === "object"
              ? raw.fullData
              : raw;
          const phoneDigits = normalizePhoneForLookup(
            recipient?.phone ||
              raw?.phone ||
              fullData?.phone ||
              fullData?.mobile ||
              fullData?.whatsappNumber ||
              "",
          );
          const importedConsent =
            importedConsentLookup.get(phoneDigits) ||
            importedConsentLookup.get(phoneDigits.slice(-10)) ||
            null;

          if (!importedConsent) {
            return recipient;
          }

          const mergedFullData = {
            ...fullData,
            ...importedConsent,
          };

          return {
            ...recipient,
            data: mergedFullData,
            fullData: mergedFullData,
            whatsappOptInStatus:
              importedConsent.whatsappOptInStatus ||
              recipient.whatsappOptInStatus ||
              "opted_in",
            whatsappOptInScope:
              importedConsent.whatsappOptInScope ||
              recipient.whatsappOptInScope ||
              "marketing",
            whatsappOptInTextSnapshot:
              importedConsent.whatsappOptInTextSnapshot ||
              recipient.whatsappOptInTextSnapshot,
            whatsappOptInProofType:
              importedConsent.whatsappOptInProofType ||
              recipient.whatsappOptInProofType,
            whatsappOptInProofId:
              importedConsent.whatsappOptInProofId ||
              recipient.whatsappOptInProofId,
            whatsappOptInProofUrl:
              importedConsent.whatsappOptInProofUrl ||
              recipient.whatsappOptInProofUrl,
            whatsappOptInSource:
              importedConsent.whatsappOptInSource ||
              recipient.whatsappOptInSource,
            whatsappOptInCapturedBy:
              importedConsent.whatsappOptInCapturedBy ||
              recipient.whatsappOptInCapturedBy,
            whatsappOptInPageUrl:
              importedConsent.whatsappOptInPageUrl ||
              recipient.whatsappOptInPageUrl,
            whatsappOptInIp:
              importedConsent.whatsappOptInIp || recipient.whatsappOptInIp,
            whatsappOptInUserAgent:
              importedConsent.whatsappOptInUserAgent ||
              recipient.whatsappOptInUserAgent,
            whatsappOptInAt:
              importedConsent.whatsappOptInAt || recipient.whatsappOptInAt,
          };
        });
      }

      if (csvRows.length > 0) {
        try {
          const importResult = await apiClient.importContacts(csvRows);
          if (!importResult?.data?.success && importResult?.data?.error) {
            console.warn(
              "CSV contact import returned a non-success response:",
              importResult.data,
            );
          }
          clearSidebarPageCache("contacts-page:v2", { currentUserId });
        } catch (importError) {
          console.warn(
            "CSV contact import failed, continuing with parsed recipients:",
            importError,
          );
        }
      }

      setRecipients(enrichedRecipients);

      if (enrichedRecipients.length > 0) {
        const firstRecipient = enrichedRecipients[0];
        const fileVarKeys = Object.keys(firstRecipient).filter(
          (key) =>
            /^var\d+$/i.test(String(key || "").trim()) &&
            firstRecipient[key] != null,
        );
        setFileVariables(fileVarKeys);
      } else {
        setFileVariables([]);
      }

      updateCsvUploadState(
        "completed",
        `Upload completed: ${Number(enrichedRecipients.length || 0).toLocaleString()} contacts ready`,
        100,
        true,
      );
    } catch (error) {
      console.error("Failed to upload CSV:", error);
      setCsvUploadState({
        phase: "failed",
        message: `Upload failed: ${error?.message || "Please try again."}`,
        percent: 0,
      });
      alert("Failed to upload CSV: " + error.message);
    } finally {
      if (event?.target) {
        event.target.value = "";
      }
    }
  };

  const handlePrepareCsvReplace = () => {
    if (csvReplaceTimeoutRef.current) {
      clearTimeout(csvReplaceTimeoutRef.current);
      csvReplaceTimeoutRef.current = null;
    }
    csvUploadProgressRef.current = {
      lastPercent: -1,
      lastUpdateAt: 0,
    };
    setCsvUploadState({
      phase: "replacing",
      message: "Replacing CSV...",
      percent: 0,
    });
    csvReplaceTimeoutRef.current = window.setTimeout(() => {
      setCsvUploadState((current) =>
        current.phase === "replacing"
          ? { phase: "idle", message: "", percent: 0 }
          : current,
      );
      csvReplaceTimeoutRef.current = null;
    }, 2500);
  };

  const handleClearUpload = () => {
    if (csvReplaceTimeoutRef.current) {
      clearTimeout(csvReplaceTimeoutRef.current);
      csvReplaceTimeoutRef.current = null;
    }
    setUploadedFile(null);

    setRecipients([]);

    setFileVariables([]);
    setCsvUploadState({
      phase: "idle",
      message: "",
      percent: 0,
    });
    csvUploadProgressRef.current = {
      lastPercent: -1,
      lastUpdateAt: 0,
    };

    const fileInput = document.getElementById("csv-file-popup");

    if (fileInput) {
      fileInput.value = "";
    }
  };

  const clearBroadcastCsvInputs = () => {
    const popupFileInput = document.getElementById("csv-file-popup");
    if (popupFileInput) {
      popupFileInput.value = "";
    }
    const scheduleFileInput = document.getElementById("broadcast-csv-upload");
    if (scheduleFileInput) {
      scheduleFileInput.value = "";
    }
  };

  useEffect(() => {
    csvRecipientRefreshContextRef.current = {
      recipients,
      uploadedFile,
    };
  }, [recipients, uploadedFile]);

  const normalizePhoneForLookup = (value = "") =>
    String(value || "").replace(/\D/g, "");

  const buildContactLookupMap = (contacts = []) => {
    const map = new Map();
    (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
      const phoneDigits = normalizePhoneForLookup(
        contact?.phone ||
          contact?.mobile ||
          contact?.phoneNumber ||
          contact?.whatsappNumber ||
          "",
      );
      if (!phoneDigits) return;
      if (!map.has(phoneDigits)) {
        map.set(phoneDigits, contact);
      }
      const lastTen =
        phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
      if (lastTen && !map.has(lastTen)) {
        map.set(lastTen, contact);
      }
    });
    return map;
  };

  const mergeCsvRecipientsWithContacts = (recipients = [], contacts = []) => {
    const contactLookup = buildContactLookupMap(contacts);

    return (Array.isArray(recipients) ? recipients : []).map((recipient) => {
      const raw =
        recipient?.data && typeof recipient.data === "object"
          ? recipient.data
          : recipient;
      const fullData =
        raw?.fullData && typeof raw.fullData === "object" ? raw.fullData : raw;
      const phoneDigits = normalizePhoneForLookup(
        recipient?.phone ||
          raw?.phone ||
          fullData?.phone ||
          fullData?.mobile ||
          fullData?.whatsappNumber ||
          "",
      );
      const matchedContact =
        contactLookup.get(phoneDigits) ||
        contactLookup.get(phoneDigits.slice(-10)) ||
        null;

      if (!matchedContact) {
        return recipient;
      }

      const mergedFullData = {
        ...fullData,
        ...matchedContact,
      };

      const mergedRecipient = {
        ...recipient,
        contactId: matchedContact._id || recipient.contactId,
        name: matchedContact.name || recipient.name,
        phone: matchedContact.phone || recipient.phone,
        email: matchedContact.email || recipient.email,
        tags: Array.isArray(matchedContact.tags)
          ? matchedContact.tags
          : recipient.tags,
        sourceType: matchedContact.sourceType || recipient.sourceType,
        data: mergedFullData,
        fullData: mergedFullData,
      };

      const optInStatus = String(
        matchedContact.whatsappOptInStatus ||
          fullData.whatsappOptInStatus ||
          recipient.whatsappOptInStatus ||
          "",
      ).trim();

      if (optInStatus) {
        mergedRecipient.whatsappOptInStatus = optInStatus;
        mergedRecipient.whatsappOptInScope =
          matchedContact.whatsappOptInScope || recipient.whatsappOptInScope;
        mergedRecipient.whatsappOptInTextSnapshot =
          matchedContact.whatsappOptInTextSnapshot ||
          recipient.whatsappOptInTextSnapshot;
        mergedRecipient.whatsappOptInProofType =
          matchedContact.whatsappOptInProofType ||
          recipient.whatsappOptInProofType;
        mergedRecipient.whatsappOptInProofId =
          matchedContact.whatsappOptInProofId || recipient.whatsappOptInProofId;
        mergedRecipient.whatsappOptInProofUrl =
          matchedContact.whatsappOptInProofUrl ||
          recipient.whatsappOptInProofUrl;
        mergedRecipient.whatsappOptInSource =
          matchedContact.whatsappOptInSource || recipient.whatsappOptInSource;
      }

      if (matchedContact.lastInboundMessageAt) {
        mergedRecipient.lastInboundMessageAt =
          matchedContact.lastInboundMessageAt;
        mergedFullData.lastInboundMessageAt =
          matchedContact.lastInboundMessageAt;
      }
      if (matchedContact.serviceWindowClosesAt) {
        mergedRecipient.serviceWindowClosesAt =
          matchedContact.serviceWindowClosesAt;
        mergedFullData.serviceWindowClosesAt =
          matchedContact.serviceWindowClosesAt;
      }
      if (matchedContact.whatsappOptOutAt) {
        mergedRecipient.whatsappOptOutAt = matchedContact.whatsappOptOutAt;
        mergedFullData.whatsappOptOutAt = matchedContact.whatsappOptOutAt;
      }

      return mergedRecipient;
    });
  };

  const refreshCsvRecipientsFromContacts = async () => {
    const { recipients: currentRecipients, uploadedFile: currentUploadedFile } =
      csvRecipientRefreshContextRef.current || {};

    if (
      !currentUploadedFile ||
      !Array.isArray(currentRecipients) ||
      currentRecipients.length === 0
    ) {
      return;
    }

    const lookupPhones = Array.from(
      new Set(
        currentRecipients
          .map((recipient) =>
            normalizePhoneForLookup(
              recipient?.phone ||
                recipient?.fullData?.phone ||
                recipient?.data?.phone ||
                "",
            ),
          )
          .filter(Boolean),
      ),
    );

    if (!lookupPhones.length) {
      return;
    }

    try {
      const lookupResult = await apiClient.lookupContactsByPhones(lookupPhones);
      const matchedContacts =
        lookupResult?.data?.data || lookupResult?.data || [];
      const refreshedRecipients = mergeCsvRecipientsWithContacts(
        currentRecipients,
        matchedContacts,
      );
      setRecipients(refreshedRecipients);

      if (refreshedRecipients.length > 0) {
        const firstRecipient = refreshedRecipients[0];
        const fileVarKeys = Object.keys(firstRecipient).filter(
          (key) =>
            /^var\d+$/i.test(String(key || "").trim()) &&
            firstRecipient[key] != null,
        );
        setFileVariables(fileVarKeys);
      }
    } catch (error) {
      console.warn("Failed to refresh CSV recipients after CRM change:", error);
    }
  };

  const buildProcessedRecipients = () =>
    recipients.map((recipient) => ({
      phone: recipient.phone,
      variables: recipient.variables || [],
      data: recipient.data || recipient.fullData || recipient,
    }));

  const prepareRecipientsForDelivery = () => {
    const processedRecipients = buildProcessedRecipients();
    const seenPhones = new Set();
    let missingPhoneCount = 0;
    let duplicatePhoneCount = 0;

    const eligibleRecipients = processedRecipients.filter((recipient) => {
      const phone = String(recipient?.phone || "").trim();
      if (!phone || phone === "-") {
        missingPhoneCount += 1;
        return false;
      }
      if (seenPhones.has(phone)) {
        duplicatePhoneCount += 1;
        return false;
      }
      seenPhones.add(phone);
      return true;
    });

    return {
      eligibleRecipients,
      missingPhoneCount,
      duplicatePhoneCount,
    };
  };

  const validatePreparedRecipients = ({
    eligibleRecipients,
    missingPhoneCount,
    duplicatePhoneCount,
  }) => {
    if (!eligibleRecipients.length) {
      alert(
        "No valid recipients found. Please ensure CSV has unique phone numbers.",
      );
      return false;
    }

    if (missingPhoneCount > 0 || duplicatePhoneCount > 0) {
      alert(
        `Recipient issues found: ${missingPhoneCount} missing-phone and ${duplicatePhoneCount} duplicate rows. Please run Auto-clean before sending.`,
      );
      return false;
    }

    return true;
  };

  const getScheduledAtIso = () => {
    if (!scheduledTime) return null;
    const parsed = new Date(scheduledTime);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const validateScheduledTime = () => {
    if (!scheduledTime) return true;
    const scheduledIso = getScheduledAtIso();
    if (!scheduledIso) {
      alert("Invalid scheduled time. Please choose a valid date and time.");
      return false;
    }
    if (new Date(scheduledIso).getTime() <= Date.now()) {
      alert("Scheduled time must be in the future.");
      return false;
    }
    return true;
  };

  const parseIntegerInRange = (value, { min, max, fallback }) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  };

  const buildPolicyPayload = () => {
    const suppressionListPhones = Array.from(
      new Set(
        String(suppressionListRaw || "")
          .split(/[\n,;\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    return {
      deliveryPolicy: {
        quietHours: {
          enabled: Boolean(quietHoursEnabled),
          startHour: parseIntegerInRange(quietHoursStartHour, {
            min: 0,
            max: 23,
            fallback: 22,
          }),
          endHour: parseIntegerInRange(quietHoursEndHour, {
            min: 0,
            max: 23,
            fallback: 9,
          }),
          timezone: String(quietHoursTimezone || "").trim() || "Asia/Kolkata",
          action:
            String(quietHoursAction || "").toLowerCase() === "skip"
              ? "skip"
              : "defer",
          batchSize: parseIntegerInRange(deliveryBatchSize, {
            min: 1,
            max: 50,
            fallback: 50,
          }),
          batchDelaySeconds: parseIntegerInRange(deliveryBatchDelaySeconds, {
            min: 0,
            max: 3600,
            fallback: 5,
          }),
        },
      },
      retryPolicy: {
        enabled: Boolean(retryPolicyEnabled),
        maxAttempts: parseIntegerInRange(retryMaxAttempts, {
          min: 1,
          max: 5,
          fallback: 3,
        }),
        backoffSeconds: parseIntegerInRange(retryBackoffSeconds, {
          min: 0,
          max: 300,
          fallback: 45,
        }),
      },
      compliancePolicy: {
        respectOptOut: respectOptOut !== false,
        suppressionListPhones,
      },
    };
  };

  const buildValidationRecipientPayload = (recipient = {}) => ({
    phone: String(recipient?.phone || "").trim(),
    name: String(recipient?.name || "").trim(),
    contactId: String(recipient?.contactId || "").trim() || null,
    sourceType:
      String(
        recipient?.sourceType || recipient?.data?.sourceType || "",
      ).trim() || null,
    whatsappOptInStatus: String(
      recipient?.whatsappOptInStatus ||
        recipient?.data?.whatsappOptInStatus ||
        recipient?.fullData?.whatsappOptInStatus ||
        "",
    ).trim(),
    whatsappOptInScope: String(
      recipient?.whatsappOptInScope ||
        recipient?.data?.whatsappOptInScope ||
        recipient?.fullData?.whatsappOptInScope ||
        "",
    ).trim(),
    whatsappOptOutAt:
      recipient?.whatsappOptOutAt ||
      recipient?.data?.whatsappOptOutAt ||
      recipient?.fullData?.whatsappOptOutAt ||
      null,
    serviceWindowClosesAt:
      recipient?.serviceWindowClosesAt ||
      recipient?.data?.serviceWindowClosesAt ||
      recipient?.fullData?.serviceWindowClosesAt ||
      null,
    lastInboundMessageAt:
      recipient?.lastInboundMessageAt ||
      recipient?.data?.lastInboundMessageAt ||
      recipient?.fullData?.lastInboundMessageAt ||
      null,
    isBlocked: Boolean(
      recipient?.isBlocked ||
      recipient?.data?.isBlocked ||
      recipient?.fullData?.isBlocked,
    ),
  });

  const normalizeContactToRecipient = (contact = {}) => {
    const raw =
      contact?.data && typeof contact.data === "object"
        ? contact.data
        : contact;
    const contactId = String(
      contact?._id ||
        contact?.id ||
        contact?.contactId ||
        raw?._id ||
        raw?.id ||
        raw?.contactId ||
        contact?.phone ||
        contact?.mobile ||
        contact?.phoneNumber ||
        contact?.whatsappNumber ||
        raw?.phone ||
        raw?.mobile ||
        raw?.phoneNumber ||
        raw?.whatsappNumber ||
        "",
    ).trim();
    const phone = String(
      contact?.phone ||
        contact?.mobile ||
        contact?.phoneNumber ||
        contact?.whatsappNumber ||
        raw?.phone ||
        raw?.mobile ||
        raw?.phoneNumber ||
        raw?.whatsappNumber ||
        "",
    ).trim();
    const name = String(
      contact?.name ||
        raw?.name ||
        contact?.displayName ||
        raw?.contactName ||
        phone ||
        "",
    ).trim();

    return {
      phone,
      name,
      contactId: contactId || undefined,
      sourceType:
        String(raw?.sourceType || contact?.sourceType || "manual").trim() ||
        "manual",
      variables: [],
      data: raw && typeof raw === "object" ? raw : { phone, name },
      fullData: raw && typeof raw === "object" ? raw : { phone, name },
    };
  };

  const hasContactsAudience =
    Array.isArray(recipients) &&
    recipients.some((recipient) =>
      Boolean(
        String(
          recipient?.contactId ||
            recipient?.data?._id ||
            recipient?.fullData?._id ||
            "",
        ).trim(),
      ),
    );

  const campaignAdditionalContacts = Array.isArray(
    selectedCampaignAudience?.additionalContacts,
  )
    ? selectedCampaignAudience.additionalContacts
    : [];
  const campaignSelectedRecipients = Array.isArray(
    selectedCampaignAudience?.campaignRecipients,
  )
    ? selectedCampaignAudience.campaignRecipients
        .map((contact) => normalizeContactToRecipient(contact))
        .filter((recipient) => String(recipient?.phone || "").trim())
    : [];
  const campaignExcludedPhones = Array.isArray(
    selectedCampaignAudience?.excludedPhones,
  )
    ? selectedCampaignAudience.excludedPhones
        .map((phone) => String(phone || "").trim())
        .filter(Boolean)
    : [];
  const selectedCampaignAudienceCount = React.useMemo(() => {
    const excludedPhoneSet = new Set(
      campaignExcludedPhones.map((phone) => phone.replace(/\D/g, "")),
    );
    const dedupedSelected = campaignSelectedRecipients
      .map((contact) => normalizeContactToRecipient(contact))
      .filter((recipient) => {
        const phone = normalizePhoneForLookup(recipient?.phone || "");
        return phone && !excludedPhoneSet.has(phone);
      });
    const dedupedAudience = [...dedupedSelected];
    const seenPhones = new Set(
      dedupedAudience
        .map((recipient) => normalizePhoneForLookup(recipient?.phone || ""))
        .filter(Boolean),
    );
    for (const contact of campaignAdditionalContacts) {
      const normalized = normalizeContactToRecipient(contact);
      const phone = normalizePhoneForLookup(normalized?.phone || "");
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      dedupedAudience.push(normalized);
    }
    if (dedupedAudience.length > 0) {
      return dedupedAudience.length;
    }
    const baseCount = Math.max(
      0,
      Number(selectedCampaignAudience?.campaignRecipientCount || 0),
    );
    const additionalCount = new Set(
      campaignAdditionalContacts
        .map((contact) => String(contact?.phone || "").replace(/\D/g, ""))
        .filter((phone) => Boolean(phone) && !excludedPhoneSet.has(phone)),
    ).size;
    const excludedCount = excludedPhoneSet.size;
    return Math.max(0, baseCount - excludedCount + additionalCount);
  }, [
    campaignAdditionalContacts,
    campaignExcludedPhones,
    campaignSelectedRecipients,
    selectedCampaignAudience?.campaignRecipientCount,
  ]);

  const selectedCampaignAudienceRecipients = React.useMemo(() => {
    const mergedRecipients = [...campaignSelectedRecipients];
    const seenPhones = new Set(
      mergedRecipients
        .map((recipient) => normalizePhoneForLookup(recipient?.phone || ""))
        .filter(Boolean),
    );
    for (const contact of campaignAdditionalContacts) {
      const phone = normalizePhoneForLookup(contact?.phone || "");
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      mergedRecipients.push(normalizeContactToRecipient(contact));
    }
    return mergedRecipients;
  }, [campaignAdditionalContacts, campaignSelectedRecipients]);

  const hasSelectedCampaignAudience = Boolean(
    String(selectedCampaignAudience?.campaignBroadcastId || "").trim(),
  ) || Number(selectedCampaignAudienceCount || 0) > 0;

  useEffect(() => {
    if (!hasSelectedCampaignAudience) return;
    if (audienceSourceMode === "campaign") return;
    setAudienceSourceMode("campaign");
  }, [audienceSourceMode, hasSelectedCampaignAudience]);

  const audienceSourceLabel =
    audienceSourceMode === "campaign"
      ? String(selectedCampaignAudience?.campaignName || "").trim()
        ? `Campaign: ${selectedCampaignAudience.campaignName}`
        : String(selectedCampaignAudience?.campaignBroadcastId || "").trim()
          ? `Campaign: ${selectedCampaignAudience.campaignBroadcastId}`
          : "Campaign audience"
      : uploadedFile
        ? `CSV upload: ${uploadedFile.name}`
        : String(selectedAudienceMeta?.segmentName || "").trim()
          ? `Saved segment: ${selectedAudienceMeta.segmentName}`
          : hasContactsAudience
            ? "Selected CRM contacts"
            : Array.isArray(recipients) && recipients.length > 0
              ? "Manual audience list"
              : "";

  const buildAudiencePayload = () => {
    const recipientCount = Array.isArray(recipients) ? recipients.length : 0;
    const selectedContactCount = Array.isArray(recipients)
      ? recipients.filter((recipient) =>
          Boolean(
            String(
              recipient?.contactId ||
                recipient?.data?._id ||
                recipient?.fullData?._id ||
                "",
            ).trim(),
          ),
        ).length
      : 0;
    const hasContactsSelection = selectedContactCount > 0;
    const segmentId = String(selectedAudienceMeta?.segmentId || "").trim();
    const segmentName = String(selectedAudienceMeta?.segmentName || "").trim();
    const campaignBroadcastId = String(
      selectedCampaignAudience?.campaignBroadcastId || "",
    ).trim();
    const campaignName = String(
      selectedCampaignAudience?.campaignName || "",
    ).trim();
    const campaignStatus = String(
      selectedCampaignAudience?.campaignStatus || "",
    ).trim();
    const campaignRecipientCount = Math.max(
      0,
      Number(selectedCampaignAudience?.campaignRecipientCount || 0),
    );
    const excludedPhones = campaignExcludedPhones;
    const excludedPhoneSet = new Set(
      excludedPhones
        .map((phone) => normalizePhoneForLookup(phone))
        .filter(Boolean),
    );
    const campaignRecipients = campaignSelectedRecipients
      .filter((recipient) => {
        const phone = normalizePhoneForLookup(recipient?.phone || "");
        return phone && !excludedPhoneSet.has(phone);
      })
      .map((recipient) => normalizeContactToRecipient(recipient));
    const additionalContacts = campaignAdditionalContacts
      .map((contact) => normalizeContactToRecipient(contact))
      .filter((recipient) => String(recipient?.phone || "").trim());
    const campaignAudienceRecipients = [...campaignRecipients];
    const seenPhones = new Set(
      campaignAudienceRecipients
        .map((recipient) => normalizePhoneForLookup(recipient?.phone || ""))
        .filter(Boolean),
    );
    for (const contact of additionalContacts) {
      const phone = normalizePhoneForLookup(contact?.phone || "");
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      campaignAudienceRecipients.push(contact);
    }
    const campaignSelectedCount = campaignAudienceRecipients.length;
    const sourceType = uploadedFile
      ? "csv"
      : campaignBroadcastId
        ? "campaign"
        : segmentId
          ? "saved_segment"
          : hasContactsSelection
            ? "contacts"
            : recipientCount > 0
              ? "manual"
              : "unknown";

    return {
      audienceSource: {
        mode: audienceSourceMode,
        label: audienceSourceLabel,
        type: sourceType,
        segmentId,
        campaignBroadcastId,
        sourceName:
          uploadedFile?.name ||
          (campaignName
            ? `campaign:${campaignName}`
            : campaignBroadcastId
              ? `campaign:${campaignBroadcastId}`
              : "") ||
          (segmentName
            ? `segment:${segmentName}`
            : hasContactsSelection
              ? "crm_contacts"
              : "manual_list"),
        uploadedFileName: uploadedFile?.name || "",
        recipientCount:
          sourceType === "campaign"
            ? campaignAudienceRecipients.length
            : recipientCount,
        selectedContactCount:
          sourceType === "campaign"
            ? campaignAudienceRecipients.length
            : selectedContactCount,
        hasContactIds:
          sourceType === "campaign"
            ? campaignAudienceRecipients.some((recipient) =>
                Boolean(recipient.contactId),
              )
            : hasContactsSelection,
        campaignRecipientCount,
        campaignStatus,
      },
      audienceSnapshot: {
        mode: audienceSourceMode,
        label: audienceSourceLabel,
        sourceType,
        segmentId,
        segmentName,
        campaignBroadcastId,
        campaignName,
        campaignStatus,
        campaignRecipientCount,
        campaignSelectedCount,
        campaignRecipientIds: campaignAudienceRecipients
          .map((recipient) =>
            String(
              recipient?.contactId ||
                recipient?.data?._id ||
                recipient?.fullData?._id ||
                "",
            ).trim(),
          )
          .filter(Boolean),
        excludedPhones,
        excludedCount: excludedPhones.length,
        additionalContactIds:
          sourceType === "campaign"
            ? additionalContacts
                .filter(
                  (recipient) =>
                    !excludedPhoneSet.has(
                      String(recipient?.phone || "").replace(/\D/g, ""),
                    ),
                )
                .map((recipient) =>
                  String(
                    recipient?.contactId ||
                      recipient?.data?._id ||
                      recipient?.fullData?._id ||
                      "",
                  ).trim(),
                )
                .filter(Boolean)
            : [],
        uploadedFileName: uploadedFile?.name || "",
        recipientCount:
          sourceType === "campaign"
            ? campaignAudienceRecipients.length
            : recipientCount,
        selectedContactCount:
          sourceType === "campaign"
            ? campaignAudienceRecipients.length
            : selectedContactCount,
        contactIds: Array.isArray(recipients)
          ? (sourceType === "campaign"
              ? campaignAudienceRecipients
              : recipients)
              .map((recipient) =>
                String(
                  recipient?.contactId ||
                    recipient?.data?._id ||
                    recipient?.fullData?._id ||
                    "",
                ).trim(),
              )
              .filter(Boolean)
          : [],
        selectedPhoneCount: Array.isArray(recipients)
          ? (sourceType === "campaign"
              ? campaignAudienceRecipients
              : recipients).filter((recipient) =>
              String(recipient?.phone || "").trim(),
            ).length
          : 0,
      },
    };
  };

  const openContactAudiencePicker = () => {
    setContactAudiencePickerPurpose("direct");
    setShowContactAudiencePicker(true);
  };

  const closeContactAudiencePicker = () => {
    setShowContactAudiencePicker(false);
  };

  const openCampaignAudiencePicker = () => {
    setShowCampaignAudiencePicker(true);
  };

  const closeCampaignAudiencePicker = () => {
    setShowCampaignAudiencePicker(false);
  };

  const openCampaignExtraContactsPicker = () => {
    setContactAudiencePickerPurpose("campaign_extra");
    setShowContactAudiencePicker(true);
  };

  const handleAudienceSourceModeChange = useCallback((nextMode) => {
    setAudienceSourceMode(nextMode);
    if (String(nextMode || "").trim() !== "campaign") {
      setSelectedCampaignAudience({
        campaignBroadcastId: "",
        campaignName: "",
        campaignStatus: "",
        campaignRecipientCount: 0,
        excludedPhones: [],
        campaignRecipients: [],
        additionalContacts: [],
      });
    }
  }, []);

  const applyContactAudienceSelection = (
    selectedContacts = [],
    segmentMeta = {},
  ) => {
    const normalized = Array.isArray(selectedContacts)
      ? selectedContacts
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((recipient) => recipient.phone)
      : [];

    if (contactAudiencePickerPurpose === "campaign_extra") {
      setSelectedCampaignAudience((previous) => {
        const existing = Array.isArray(previous?.additionalContacts)
          ? previous.additionalContacts
          : [];
        const merged = [...existing];
        for (const contact of normalized) {
          const contactPhone = String(contact?.phone || "").replace(/\D/g, "");
          if (!contactPhone) continue;
          const alreadyExists = merged.some(
            (item) =>
              String(item?.phone || "").replace(/\D/g, "") === contactPhone,
          );
          if (!alreadyExists) {
            merged.push(contact);
          }
        }
        return {
          ...previous,
          additionalContacts: merged,
        };
      });
    } else {
      setRecipients(normalized);
      setUploadedFile(null);
      setFileVariables([]);
      setSelectedAudienceMeta({
        segmentId: String(segmentMeta?.segmentId || "").trim(),
        segmentName: String(segmentMeta?.segmentName || "").trim(),
      });
      setAudienceSourceMode("contacts");
    }

    setShowContactAudiencePicker(false);
  };

  const applyCampaignAudienceSelection = ({
    campaign = null,
    excludedPhones = [],
    additionalContacts = [],
    campaignRecipients = [],
  } = {}) => {
    const campaignBroadcastId = String(
      campaign?._id || campaign?.id || "",
    ).trim();
    const campaignName = String(campaign?.name || "").trim();
    const campaignStatus = String(campaign?.status || "").trim();
    const campaignRecipientCount = Math.max(
      0,
      Number(
        campaign?.recipientCount ||
          campaign?.sentCount ||
          campaign?.stats?.sent ||
          0,
      ),
    );

    setSelectedCampaignAudience({
      campaignBroadcastId,
      campaignName,
      campaignStatus,
      campaignRecipientCount,
      excludedPhones: Array.isArray(excludedPhones)
        ? excludedPhones
            .map((phone) => String(phone || "").trim())
            .filter(Boolean)
        : [],
      campaignRecipients: Array.isArray(campaignRecipients)
        ? campaignRecipients
            .map((contact) => normalizeContactToRecipient(contact))
            .filter((recipient) => recipient.phone)
        : [],
      additionalContacts: Array.isArray(additionalContacts)
        ? additionalContacts
            .map((contact) => normalizeContactToRecipient(contact))
            .filter((recipient) => recipient.phone)
        : [],
    });
    setAudienceSourceMode("campaign");
    setUploadedFile(null);
    setFileVariables([]);
    setRecipients([]);
    setSelectedAudienceMeta({ segmentId: "", segmentName: "" });
    setShowCampaignAudiencePicker(false);
    setShowContactAudiencePicker(false);
  };

  const clearSelectedCampaignAudience = () => {
    setSelectedCampaignAudience({
      campaignBroadcastId: "",
      campaignName: "",
      campaignStatus: "",
      campaignRecipientCount: 0,
      excludedPhones: [],
      campaignRecipients: [],
      additionalContacts: [],
    });
    if (audienceSourceMode === "campaign") {
      setAudienceSourceMode("contacts");
    }
  };

  const clearSelectedAudience = () => {
    setRecipients([]);
    setUploadedFile(null);
    setFileVariables([]);
    setSelectedAudienceMeta({ segmentId: "", segmentName: "" });
    setShowCampaignAudiencePicker(false);
    setShowContactAudiencePicker(false);
    clearSelectedCampaignAudience();
  };

  const handleAutoCleanRecipients = () => {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      alert("No recipients available to clean.");
      return;
    }

    const { eligibleRecipients, missingPhoneCount, duplicatePhoneCount } =
      prepareRecipientsForDelivery();
    const removedCount = missingPhoneCount + duplicatePhoneCount;

    if (removedCount === 0) {
      alert(
        "Recipients are already clean. No missing or duplicate phone rows found.",
      );
      return;
    }

    setRecipients(eligibleRecipients);
    if (!eligibleRecipients.length) {
      setFileVariables([]);
    }
    clearBroadcastCsvInputs();
    alert(`Auto-clean completed. Removed ${removedCount} issue rows.`);
  };

  const validateAudienceOrAbort = async ({
    recipientsPayload,
    selectedTemplate,
  }) => {
    const templateCategory =
      messageType === "template"
        ? String(selectedTemplate?.category || "utility")
            .trim()
            .toLowerCase()
        : "";

    try {
      const validationResponse = await apiClient.validateBroadcastAudience({
        recipients: Array.isArray(recipientsPayload)
          ? recipientsPayload.map((recipient) =>
              buildValidationRecipientPayload(recipient),
            )
          : [],
        messageType,
        templateCategory,
      });

      const validation =
        validationResponse?.data?.data || validationResponse?.data || null;

      return {
        templateCategory,
        validation,
      };
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const backendMessage = String(
        error?.response?.data?.error || error?.message || "",
      ).trim();
      if (status === 403) {
        alert(
          backendMessage ||
            "This workspace is currently read-only or does not have broadcast permission.",
        );
        return null;
      }
      throw error;
    }
  };

  const selectedTemplateCategory = React.useMemo(() => {
    if (messageType !== "template") return "";
    const selectedTemplate = officialTemplates.find(
      (template) => template.name === templateName,
    );
    return String(selectedTemplate?.category || "")
      .trim()
      .toLowerCase();
  }, [messageType, officialTemplates, templateName]);

  const openAudienceValidationModal = (validationResult) => {
    setPendingAudienceValidation(validationResult);
    setAudienceValidationModalOpen(true);
  };

  const closeAudienceValidationModal = () => {
    setAudienceValidationModalOpen(false);
    setPendingAudienceValidation(null);
  };

  const createBroadcast = async () => {
    const campaignMode = audienceSourceMode === "campaign";
    const campaignHasAudience = Boolean(
      String(selectedCampaignAudience?.campaignBroadcastId || "").trim(),
    );
    const campaignSelectedRecipients = Array.isArray(
      selectedCampaignAudience?.campaignRecipients,
    )
      ? selectedCampaignAudience.campaignRecipients
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((recipient) => recipient.phone)
      : [];
    const campaignAdditionalRecipients = Array.isArray(
      selectedCampaignAudience?.additionalContacts,
    )
      ? selectedCampaignAudience.additionalContacts
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((recipient) => recipient.phone)
      : [];
    const campaignAudienceRecipients = [...campaignSelectedRecipients];
    const seenPhones = new Set(
      campaignAudienceRecipients
        .map((recipient) => normalizePhoneForLookup(recipient?.phone || ""))
        .filter(Boolean),
    );
    for (const recipient of campaignAdditionalRecipients) {
      const phone = normalizePhoneForLookup(recipient?.phone || "");
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      campaignAudienceRecipients.push(recipient);
    }
    const campaignSelectedCount = campaignAudienceRecipients.length;

    if (broadcastSubmitInFlightRef.current) {
      console.warn(
        "Duplicate schedule click blocked (request already in flight)",
      );
      return;
    }

    console.log("🔍 createBroadcast called");
    console.log("🔍 broadcastName:", broadcastName);
    console.log("🔍 recipients.length:", recipients.length);
    console.log("🔍 scheduledTime:", scheduledTime);
    console.log("🔍 messageType:", messageType);

    if (
      !broadcastName ||
      (!campaignMode && !recipients.length) ||
      (campaignMode && !campaignHasAudience)
    ) {
      console.log("❌ Validation failed - missing broadcastName or recipients");
      alert("Please provide a campaign name and select an audience");

      return;
    }

    if (!validateScheduledTime()) {
      return;
    }

    try {
      await apiClient.healthCheck();
      console.log("✅ Backend health check passed");
    } catch (error) {
      console.warn(
        "⚠️ Backend health check skipped/failed, continuing broadcast flow:",
        error,
      );
    }

    let templateContent = "";
    let selectedTemplate = null;

    if (messageType === "text" && !String(customMessage || "").trim()) {
      alert("Please enter a custom message.");
      return;
    }

    if (messageType === "template") {
      if (!templateName) {
        alert("Please select a template");

        return;
      }

      selectedTemplate = officialTemplates.find((t) => t.name === templateName);
      const selectedTemplateRequiresImageHeader =
        templateRequiresImageHeader(selectedTemplate);

      // Extract template content for storing in broadcast
      templateContent = selectedTemplate
        ? extractTemplateBody(selectedTemplate)
        : "";

      const approvedStatuses = ["APPROVED", "approved", "ACTIVE", "active"];

      if (!approvedStatuses.includes(selectedTemplate?.status)) {
        console.warn(
          `Template "${templateName}" has status "${selectedTemplate?.status || "unknown"}". Proceeding anyway...`,
        );
      }

      if (!language) {
        alert("Template language not set. Please select the template again.");

        return;
      }

      if (
        selectedTemplateRequiresImageHeader &&
        !String(templateHeaderMediaUrl || "").trim()
      ) {
        alert(
          "This template requires an image header. Please upload an image before sending.",
        );
        return;
      }
    }

    try {
      broadcastSubmitInFlightRef.current = true;
      setIsSending(true);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      let audienceValidation = null;
      let preparedRecipients = [];

      if (!campaignMode) {
        const recipientPreparation = prepareRecipientsForDelivery();
        if (!validatePreparedRecipients(recipientPreparation)) {
          return;
        }
        audienceValidation = await validateAudienceOrAbort({
          recipientsPayload: recipientPreparation.eligibleRecipients,
          selectedTemplate,
        });
        if (!audienceValidation) {
          return;
        }
        const audienceSummary = audienceValidation.validation?.summary || {};
        const eligibleCount = Number(audienceSummary.eligible || 0);
        const invalidCount = Number(audienceSummary.invalid || 0);
        const validatedRecipients = Array.isArray(
          audienceValidation.validation?.eligibleRecipients,
        )
          ? audienceValidation.validation.eligibleRecipients.filter(
              (recipient) => String(recipient?.phone || "").trim(),
            )
          : [];
        if (eligibleCount <= 0) {
          openAudienceValidationModal(audienceValidation);
          return;
        }
        if (invalidCount > 0) {
          console.warn(
            `Audience validation found ${invalidCount} invalid recipient(s), but continuing with ${eligibleCount} eligible recipient(s).`,
          );
        }
        preparedRecipients =
          validatedRecipients.length > 0
            ? validatedRecipients
            : recipientPreparation.eligibleRecipients;
      }

      const payload = {
        name: broadcastName,

        messageType,

        recipients: campaignMode
          ? campaignAudienceRecipients
          : preparedRecipients,
        recipientCount: campaignMode
          ? campaignSelectedCount
          : preparedRecipients.length,

        ...buildAudiencePayload(),

        ...(messageType === "template"
          ? {
              templateName,

              language,

              templateContent,
              templateCategory:
                selectedTemplateCategory ||
                audienceValidation?.templateCategory ||
                "utility",
              mediaUrl: String(templateHeaderMediaUrl || "").trim(),
              mediaType: String(templateHeaderMediaUrl || "").trim()
                ? "image"
                : "",
            }
          : { customMessage }),

        ...(scheduledTime && getScheduledAtIso()
          ? {
              scheduledAt: getScheduledAtIso(),
            }
          : {}),
        ...buildPolicyPayload(),
      };

      console.log("🚀 Sending broadcast payload:", payload);

      const result = await apiClient.createBroadcast(payload);

      if (result.data.success) {
        const queued = Boolean(result.data.queued);
        alert(
          queued
            ? result.data.message ||
                "Broadcast queued. Sending will continue in the background."
            : scheduledTime
              ? "Broadcast scheduled successfully!"
              : "Broadcast created successfully!",
        );

        await loadBroadcasts();

        setBroadcastName("");

        setTemplateName("");
        clearTemplateHeaderMedia();

        setCustomMessage("");

        setScheduledTime("");

        setUploadedFile(null);

        setRecipients([]);
        setAudienceSourceMode("contacts");
        setShowCampaignAudiencePicker(false);
        setShowContactAudiencePicker(false);
        setSelectedCampaignAudience({
          campaignBroadcastId: "",
          campaignName: "",
          campaignStatus: "",
          campaignRecipientCount: 0,
          excludedPhones: [],
          campaignRecipients: [],
          additionalContacts: [],
        });

        setFileVariables([]);
        setQuietHoursEnabled(false);
        setQuietHoursStartHour(22);
        setQuietHoursEndHour(9);
        setQuietHoursTimezone("Asia/Kolkata");
        setQuietHoursAction("defer");
        setDeliveryBatchSize(50);
        setRetryPolicyEnabled(true);
        setRetryMaxAttempts(3);
        setRetryBackoffSeconds(45);
        setRespectOptOut(true);
        setSuppressionListRaw("");
        setDeliveryBatchDelaySeconds(5);

        setShowNewBroadcastPopup(false);
      } else {
        alert("Failed: " + (result.data.error || result.data.message));
      }
    } catch (error) {
      console.error("Broadcast creation error:", error);

      alert("Failed to create broadcast: " + error.message);
    } finally {
      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (broadcastSubmitInFlightRef.current) {
      console.warn("Duplicate send click blocked (request already in flight)");
      return;
    }

    if (audienceSourceMode === "campaign") {
      await createBroadcast();
      return;
    }

    if (!broadcastName || !broadcastName.trim()) {
      alert("Please provide a campaign name");

      return;
    }

    if (!recipients.length) {
      alert("Please add recipients from CSV or Contacts");

      return;
    }

    try {
      await apiClient.healthCheck();
      console.log("✅ Backend health check passed");
    } catch (error) {
      console.warn(
        "⚠️ Backend health check skipped/failed, continuing broadcast flow:",
        error,
      );
    }

    // Initialize templateContent with default value
    let templateContent = "";
    let selectedTemplate = null;

    if (messageType === "text" && !String(customMessage || "").trim()) {
      alert("Please enter a custom message.");
      return;
    }

    if (messageType === "template") {
      if (!templateName) {
        alert("Please select a template");

        return;
      }

      selectedTemplate = officialTemplates.find((t) => t.name === templateName);
      const selectedTemplateRequiresImageHeader =
        templateRequiresImageHeader(selectedTemplate);

      if (!selectedTemplate) {
        console.warn(
          `Template "${templateName}" is not in the synced list. Proceeding with the entered template name.`,
        );
      }

      // Extract template content for storing in broadcast
      templateContent = extractTemplateBody(selectedTemplate);

      const approvedStatuses = ["APPROVED", "approved", "ACTIVE", "active"];

      if (!approvedStatuses.includes(selectedTemplate?.status)) {
        console.warn(
          `Template "${templateName}" has status "${selectedTemplate?.status || "unknown"}". Proceeding anyway...`,
        );
      }

      if (!language) {
        alert("Template language not set. Please select the template again.");

        return;
      }

      if (
        selectedTemplateRequiresImageHeader &&
        !String(templateHeaderMediaUrl || "").trim()
      ) {
        alert(
          "This template requires an image header. Please upload an image before sending.",
        );
        return;
      }
    }

    broadcastSubmitInFlightRef.current = true;
    setIsSending(true);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    try {
      const recipientPreparation = prepareRecipientsForDelivery();
      if (!validatePreparedRecipients(recipientPreparation)) {
        return;
      }
      const audienceValidation = await validateAudienceOrAbort({
        recipientsPayload: recipientPreparation.eligibleRecipients,
        selectedTemplate,
      });
      if (!audienceValidation) {
        return;
      }
      const audienceSummary = audienceValidation.validation?.summary || {};
      const eligibleCount = Number(audienceSummary.eligible || 0);
      const invalidCount = Number(audienceSummary.invalid || 0);
      const validatedRecipients = Array.isArray(
        audienceValidation.validation?.eligibleRecipients,
      )
        ? audienceValidation.validation.eligibleRecipients.filter((recipient) =>
            String(recipient?.phone || "").trim(),
          )
        : [];
      if (eligibleCount <= 0) {
        openAudienceValidationModal(audienceValidation);
        return;
      }
      if (invalidCount > 0) {
        console.warn(
          `Audience validation found ${invalidCount} invalid recipient(s), but continuing with ${eligibleCount} eligible recipient(s).`,
        );
      }

      const payload = {
        broadcast_name: broadcastName.trim(),

        messageType,

        recipients:
          validatedRecipients.length > 0
            ? validatedRecipients
            : recipientPreparation.eligibleRecipients,

        ...(messageType === "template"
          ? {
              templateName,
              language,
              templateContent,
              templateCategory:
                selectedTemplateCategory ||
                audienceValidation.templateCategory ||
                "utility",
              mediaUrl: String(templateHeaderMediaUrl || "").trim(),
              mediaType: String(templateHeaderMediaUrl || "").trim()
                ? "image"
                : "",
            }
          : { customMessage }),
        ...buildPolicyPayload(),
      };

      console.log("🚀 Sending broadcast payload:", payload);

      const result = await apiClient.sendBulkMessages(payload);

      setSendResults(result.data);

      if (result.data.success) {
        const queued = Boolean(result.data.queued);
        if (queued) {
          setShowResultsPopup(false);
        }

        await loadBroadcasts();

        setShowNewBroadcastPopup(false);

        setBroadcastName("");

        setTemplateName("");
        clearTemplateHeaderMedia();

        setCustomMessage("");

        setScheduledTime("");

        setMessageType("template");
        setQuietHoursEnabled(false);
        setQuietHoursStartHour(22);
        setQuietHoursEndHour(9);
        setQuietHoursTimezone("Asia/Kolkata");
        setQuietHoursAction("defer");
        setDeliveryBatchSize(50);
        setRetryPolicyEnabled(true);
        setRetryMaxAttempts(3);
        setRetryBackoffSeconds(45);
        setRespectOptOut(true);
        setSuppressionListRaw("");
        setDeliveryBatchDelaySeconds(5);
      } else {
        alert("Failed to send: " + (result.data.error || result.data.message));
      }
    } catch (error) {
      console.error("Broadcast send error:", error);
      alert(getBroadcastErrorMessage(error));
    } finally {
      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);
    }
  };

  const executeBroadcast = async (broadcastId) => {
    try {
      const result = await apiClient.sendBroadcast(broadcastId);

      if (result.data.success) {
        alert("Broadcast sent successfully!");

        await loadBroadcasts();
      } else {
        alert(
          "Failed to send broadcast: " +
            (result.data.error || result.data.message),
        );
      }
    } catch (error) {
      alert("Failed to send broadcast: " + error.message);
    }
  };

  const stopBroadcast = async (broadcastId) => {
    try {
      const result = await apiClient.cancelBroadcast(broadcastId);

      if (result.data.success) {
        alert("Broadcast stopped successfully!");

        await loadBroadcasts();
      } else {
        alert(
          "Failed to stop broadcast: " +
            (result.data.error || result.data.message),
        );
      }
    } catch (error) {
      alert("Failed to stop broadcast: " + error.message);
    }
  };

  const syncBroadcastStats = async (broadcastId) => {
    try {
      await apiClient.syncBroadcastStats(broadcastId);

      await loadBroadcasts();
    } catch (error) {
      console.warn(`Failed to sync stats for ${broadcastId}`, error);

      throw error;
    }
  };

  const handleResultsPopupClose = () => {
    setShowResultsPopup(false);
  };

  const handleChooseTemplate = () => {
    setMessageType("template");

    setShowBroadcastTypeChoice(false);

    navigate("/broadcast/new/template");
  };

  const getCurrentTime = () => {
    const now = new Date();

    return now.toLocaleTimeString("en-US", {
      hour: "numeric",

      minute: "2-digit",

      hour12: true,
    });
  };

  const handleViewAnalytics = (broadcast) => {
    console.log("📊 View Analytics for broadcast:", broadcast.name);

    setSelectedBroadcast(broadcast);

    setShowAnalyticsModal(true);
  };

  const handleBackToOverview = () => {
    if (composerMode) {
      navigate("/broadcast");
      return;
    }
    setActiveTab("overview");
  };

  const resetComposerForm = () => {
    setBroadcastName("");
    setTemplateName("");
    clearTemplateHeaderMedia();
    setCustomMessage("");
    setScheduledTime("");
    setUploadedFile(null);
    setRecipients([]);
    setShowCampaignAudiencePicker(false);
    setShowContactAudiencePicker(false);
    setFileVariables([]);
    setTemplateVariables([]);
    setMessageType("template");
    setSelectedAudienceMeta({ segmentId: "", segmentName: "" });
    setSelectedCampaignAudience({
      campaignBroadcastId: "",
      campaignName: "",
      campaignStatus: "",
      campaignRecipientCount: 0,
      excludedPhones: [],
      campaignRecipients: [],
      additionalContacts: [],
    });
    setAudienceSourceMode("contacts");
    setQuietHoursEnabled(false);
    setQuietHoursStartHour(22);
    setQuietHoursEndHour(9);
    setQuietHoursTimezone("Asia/Kolkata");
    setQuietHoursAction("defer");
    setDeliveryBatchSize(50);
    setRetryPolicyEnabled(true);
    setRetryMaxAttempts(3);
    setRetryBackoffSeconds(45);
    setRespectOptOut(true);
    setSuppressionListRaw("");
    setDeliveryBatchDelaySeconds(5);
  };

  const buildBroadcastPayloadFromValidation = ({
    validationResult,
    recipientsPayload,
    selectedTemplate,
    mode,
  }) => {
    const templateCategory = validationResult?.templateCategory || "";

    return {
      ...(mode === "send"
        ? {
            broadcast_name: broadcastName.trim(),
            messageType,
            recipients: recipientsPayload,
          }
        : {
            name: broadcastName,
            messageType,
            recipients: recipientsPayload,
          }),
      ...buildAudiencePayload(),
      ...(messageType === "template"
        ? {
            templateName,
            language,
            templateContent: selectedTemplate
              ? extractTemplateBody(selectedTemplate)
              : "",
            templateCategory,
            mediaUrl: String(templateHeaderMediaUrl || "").trim(),
            mediaType: String(templateHeaderMediaUrl || "").trim()
              ? "image"
              : "",
          }
        : mode === "send"
          ? { customMessage }
          : { customMessage }),
      ...(mode === "create" && getScheduledAtIso()
        ? { scheduledAt: getScheduledAtIso() }
        : {}),
      ...buildPolicyPayload(),
    };
  };

  const continueBroadcastWithEligibleRecipients = async () => {
    const validationResult = pendingAudienceValidation;
    if (!validationResult?.validation?.canProceed) {
      closeAudienceValidationModal();
      return;
    }

    if (scheduledTime && !validateScheduledTime()) {
      closeAudienceValidationModal();
      return;
    }

    if (messageType === "text" && !String(customMessage || "").trim()) {
      closeAudienceValidationModal();
      alert("Please enter a custom message.");
      return;
    }

    const recipientPreparation = prepareRecipientsForDelivery();
    if (!validatePreparedRecipients(recipientPreparation)) {
      closeAudienceValidationModal();
      return;
    }
    const validatedRecipients = Array.isArray(
      validationResult?.validation?.eligibleRecipients,
    )
      ? validationResult.validation.eligibleRecipients.filter((recipient) =>
          String(recipient?.phone || "").trim(),
        )
      : [];
    const selectedTemplate =
      messageType === "template"
        ? officialTemplates.find((t) => t.name === templateName) || null
        : null;
    const mode = scheduledTime ? "create" : "send";
    const payload = buildBroadcastPayloadFromValidation({
      validationResult,
      recipientsPayload:
        validatedRecipients.length > 0
          ? validatedRecipients
          : recipientPreparation.eligibleRecipients,
      selectedTemplate,
      mode,
    });

    closeAudienceValidationModal();

    try {
      if (mode === "create") {
        const result = await apiClient.createBroadcast(payload);
        if (result.data.success) {
          alert(
            scheduledTime
              ? "Broadcast scheduled successfully!"
              : "Broadcast created successfully!",
          );
          await loadBroadcasts();
          resetComposerForm();
          setShowNewBroadcastPopup(false);
          return;
        }
        alert("Failed: " + (result.data.error || result.data.message));
        return;
      }

      const result = await apiClient.sendBulkMessages(payload);
      setSendResults(result.data);
      if (result.data.success) {
        setShowResultsPopup(false);
        await loadBroadcasts();
        setShowNewBroadcastPopup(false);
        resetComposerForm();
        return;
      }
      alert("Failed to send: " + (result.data.error || result.data.message));
    } catch (error) {
      console.error("Broadcast continue after validation error:", error);
      alert(
        getBroadcastErrorMessage(
          error,
          "Failed to continue broadcast. Please try again.",
        ),
      );
    } finally {
      broadcastSubmitInFlightRef.current = false;
      setIsSending(false);
    }
  };

  const handleMetaLeadBatchSync = async ({
    leadIdsText = "",
    enableTemplateSend = false,
    dryRun = true,
  } = {}) => {
    const leadIds = Array.from(
      new Set(
        String(leadIdsText || "")
          .split(/[\n,\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );

    if (!leadIds.length) {
      alert("Please enter at least one Meta lead ID.");
      return;
    }

    try {
      setMetaLeadBatchLoading(true);
      setMetaLeadBatchResult(null);

      const payload = {
        leadIds,
        mapping: {
          phoneFieldKeys: [
            "phone number",
            "phone",
            "mobile",
            "whatsapp number",
          ],
          nameFieldKeys: ["full name", "name"],
          emailFieldKeys: ["email", "email address"],
          consentFieldKeys: [
            "whatsapp consent",
            "receive whatsapp updates",
            "consent",
          ],
          consentApprovedValues: ["yes", "true", "checked"],
          consentText: "Meta lead form consent for WhatsApp marketing updates.",
          scope: "marketing",
        },
        dryRun: Boolean(dryRun),
      };

      if (enableTemplateSend) {
        if (!templateName) {
          alert("Select a template before enabling template send.");
          return;
        }

        const selectedTemplate =
          officialTemplates.find((t) => t.name === templateName) || null;
        const firstRecipientVariables = Array.isArray(
          recipients?.[0]?.variables,
        )
          ? recipients[0].variables
          : [];

        payload.sendTemplate = {
          templateName,
          language: language || selectedTemplate?.language || "en_US",
          templateCategory: String(
            selectedTemplate?.category || "utility",
          ).toLowerCase(),
          variables: firstRecipientVariables,
        };
      }

      const result = await apiClient.syncMetaLeadConsentBatch(payload);
      if (!result?.data?.success) {
        throw new Error(result?.data?.error || "Batch sync failed");
      }

      setMetaLeadBatchResult(result.data?.data || null);
    } catch (error) {
      console.error("Meta lead batch sync failed:", error);
      alert(
        `Meta lead batch sync failed: ${error?.response?.data?.error || error.message}`,
      );
    } finally {
      setMetaLeadBatchLoading(false);
    }
  };

  if (composerMode) {
    return (
      <div className="broadcast-page">
        <div className="page-header">
          <div>
            <h2>Create Broadcast Campaign</h2>
            <p>
              Compose, preview and send your WhatsApp broadcast from one page.
            </p>
          </div>
        </div>

        <ScheduleForm
          messageType={messageType}
          broadcastName={broadcastName}
          onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}
          templateName={templateName}
          onTemplateNameChange={handleTemplateNameChange}
          templateFilter={templateFilter}
          onTemplateFilterChange={(value) => setTemplateFilter(value)}
          officialTemplates={officialTemplates}
          filteredTemplates={filteredTemplates}
          onFileUpload={handleFileUpload}
          uploadedFile={uploadedFile}
          recipients={recipients}
          fileVariables={fileVariables}
          csvUploadState={csvUploadState}
          templateHeaderMediaUrl={templateHeaderMediaUrl}
          templateHeaderMediaUploading={templateHeaderMediaUploading}
          templateHeaderMediaError={templateHeaderMediaError}
          onTemplateHeaderMediaUpload={handleTemplateHeaderMediaFileUpload}
          onClearTemplateHeaderMedia={clearTemplateHeaderMedia}
          onClearUpload={handleClearUpload}
          onPrepareCsvReplace={handlePrepareCsvReplace}
          onOpenContactAudiencePicker={openContactAudiencePicker}
          onOpenCampaignAudiencePicker={openCampaignAudiencePicker}
          onClearSelectedAudience={clearSelectedAudience}
          audienceSourceMode={audienceSourceMode}
          onAudienceSourceModeChange={handleAudienceSourceModeChange}
          audienceSourceLabel={audienceSourceLabel}
          selectedCampaignAudienceLabel={selectedCampaignAudience?.campaignName || selectedCampaignAudience?.campaignBroadcastId || ""}
          selectedCampaignAudienceCount={selectedCampaignAudienceCount}
          selectedCampaignAudienceRecipients={selectedCampaignAudienceRecipients}
          onAutoCleanRecipients={handleAutoCleanRecipients}
          selectedTemplateCategory={selectedTemplateCategory}
          scheduledTime={scheduledTime}
          onScheduledTimeChange={(e) => setScheduledTime(e.target.value)}
          isSending={isSending}
          onCreateBroadcast={createBroadcast}
          onSendBroadcast={handleSendBroadcast}
          sendResults={sendResults}
          onBackToOverview={handleBackToOverview}
          onResetForm={resetComposerForm}
          onMetaLeadBatchSync={handleMetaLeadBatchSync}
          metaLeadBatchLoading={metaLeadBatchLoading}
          metaLeadBatchResult={metaLeadBatchResult}
          quietHoursEnabled={quietHoursEnabled}
          onQuietHoursEnabledChange={setQuietHoursEnabled}
          quietHoursStartHour={quietHoursStartHour}
          onQuietHoursStartHourChange={setQuietHoursStartHour}
          quietHoursEndHour={quietHoursEndHour}
          onQuietHoursEndHourChange={setQuietHoursEndHour}
          quietHoursTimezone={quietHoursTimezone}
          onQuietHoursTimezoneChange={setQuietHoursTimezone}
          quietHoursAction={quietHoursAction}
          onQuietHoursActionChange={setQuietHoursAction}
          retryPolicyEnabled={retryPolicyEnabled}
          onRetryPolicyEnabledChange={setRetryPolicyEnabled}
          retryMaxAttempts={retryMaxAttempts}
          onRetryMaxAttemptsChange={setRetryMaxAttempts}
          retryBackoffSeconds={retryBackoffSeconds}
          onRetryBackoffSecondsChange={setRetryBackoffSeconds}
          deliveryBatchSize={deliveryBatchSize}
          onDeliveryBatchSizeChange={setDeliveryBatchSize}
          deliveryBatchDelaySeconds={deliveryBatchDelaySeconds}
          onDeliveryBatchDelaySecondsChange={setDeliveryBatchDelaySeconds}
          respectOptOut={respectOptOut}
          onRespectOptOutChange={setRespectOptOut}
          suppressionListRaw={suppressionListRaw}
          onSuppressionListRawChange={setSuppressionListRaw}
        />
        <ContactAudiencePickerModal
          open={showContactAudiencePicker}
          onClose={closeContactAudiencePicker}
          onConfirm={applyContactAudienceSelection}
          initialSourceType={
            contactAudiencePickerPurpose === "campaign_extra"
              ? "campaign"
              : "all"
          }
          initialSelectedContacts={
            contactAudiencePickerPurpose === "campaign_extra"
              ? selectedCampaignAudience?.additionalContacts || []
              : recipients
          }
        />
        <CampaignAudiencePickerModal
          open={showCampaignAudiencePicker}
          onClose={closeCampaignAudiencePicker}
          onConfirm={applyCampaignAudienceSelection}
          onRequestAddContacts={openCampaignExtraContactsPicker}
          additionalContacts={
            selectedCampaignAudience?.additionalContacts || []
          }
        />
      </div>
    );
  }

  return (
    <div className="broadcast-page">
      <div className="template-pills">
        <button
          type="button"
          className={broadcastMode === "whatsapp" ? "pill active" : "pill"}
          onClick={() => setBroadcastMode("whatsapp")}
        >
          WhatsApp Broadcast
        </button>
        <button
          type="button"
          className={
            broadcastMode === "outbound-local" ? "pill active" : "pill"
          }
          onClick={() => setBroadcastMode("outbound-local")}
        >
          Outbound Voice
        </button>
      </div>

      {broadcastMode === "outbound-local" ? (
        <>
          <div className="phase2-subtabs">
            <button
              type="button"
              className={
                outboundPhaseTab === "quick"
                  ? "phase2-subtab active"
                  : "phase2-subtab"
              }
              onClick={() => setOutboundPhaseTab("quick")}
            >
              Quick
            </button>
            <button
              type="button"
              className={
                outboundPhaseTab === "schedule"
                  ? "phase2-subtab active"
                  : "phase2-subtab"
              }
              onClick={() => setOutboundPhaseTab("schedule")}
            >
              Schedule
            </button>
            <button
              type="button"
              className={
                outboundPhaseTab === "retry"
                  ? "phase2-subtab active"
                  : "phase2-subtab"
              }
              onClick={() => setOutboundPhaseTab("retry")}
            >
              Retry
            </button>
            <button
              type="button"
              className={
                outboundPhaseTab === "abtest"
                  ? "phase2-subtab active"
                  : "phase2-subtab"
              }
              onClick={() => setOutboundPhaseTab("abtest")}
            >
              A/B
            </button>
          </div>

          {outboundPhaseTab === "quick" && <OutboundDialer />}

          {outboundPhaseTab === "schedule" && (
            <>
              <CampaignScheduler
                onSchedule={scheduleCampaign}
                loading={scheduleLoading}
                error={automationError}
                scheduleResponse={scheduleResponse}
              />
              <NumberRotation
                stats={rotationStats}
                loading={rotationLoading}
                onRefresh={loadRotationStats}
                error={automationError}
              />
            </>
          )}

          {outboundPhaseTab === "retry" && (
            <RetryDashboard
              retryStats={retryStats}
              onRetry={triggerRetry}
              loading={retryLoading}
              error={automationError}
            />
          )}

          {outboundPhaseTab === "abtest" && (
            <ABTestCreator
              onCreate={createABTest}
              loading={abTestLoading}
              results={abTestResults}
              error={automationError}
            />
          )}
        </>
      ) : (
        <>
          <BroadcastHeader
            activeTab={activeTab}
            onShowBroadcastTypeChoice={() =>
              navigate("/broadcast/new/template")
            }
          />

          {(isSending || sendResults?.queued) && (
            <div className="broadcast-validation-banner broadcast-validation-banner--success broadcast-send-banner">
              <strong>
                {isSending ? "Sending broadcast..." : "Broadcast queued"}
              </strong>
              <span>
                {isSending
                  ? "We are sending this campaign in the background. You can stay on this page and watch the broadcast list update."
                  : "The campaign is running in the background. You can stay here and watch the progress update."}
              </span>
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                selectedPeriod={selectedPeriod}
                onStartDateChange={(e) => setStartDate(e.target.value)}
                onEndDateChange={(e) => setEndDate(e.target.value)}
                onPeriodChange={(e) => setSelectedPeriod(e.target.value)}
                onApplyFilter={() => setCurrentPage(1)}
                onExportCampaigns={() =>
                  void downloadAllCampaigns(filteredBroadcasts)
                }
                isExportingCampaigns={isExportingCampaigns}
              />

              <OverviewStats stats={mergedOverviewStats} />
              <ReliabilityInsights data={reliabilitySummary} />

              <div className="history-section">
                <BroadcastListControls
                  searchTerm={searchTerm}
                  onSearchChange={(e) => setSearchTerm(e.target.value)}
                  statusFilter={statusFilter}
                  onStatusFilterChange={(value) => setStatusFilter(value)}
                  sortBy={sortBy}
                  onSortByChange={(value) => setSortBy(value)}
                  sortOrder={sortOrder}
                  onSortOrderChange={(value) => setSortOrder(value)}
                  onRefresh={() => loadBroadcasts()}
                  totalBroadcasts={filteredBroadcasts.length}
                  lastUpdated={
                    broadcasts.length > 0
                      ? Math.max(
                          ...broadcasts.map(
                            (b) => new Date(b.updatedAt || b.createdAt),
                          ),
                        )
                      : new Date()
                  }
                  formatLastUpdated={formatLastUpdated}
                />

                <BroadcastTable
                  broadcasts={currentBroadcasts}
                  selectionMode={selectionMode}
                  selectedCampaigns={selectedCampaigns}
                  onSelectAll={handleSelectAll}
                  onCheckboxChange={handleCheckboxChange}
                  getSuccessPercentage={getSuccessPercentage}
                  getReadPercentage={getReadPercentage}
                  getRepliedPercentage={getRepliedPercentage}
                  getStatusClass={getStatusClass}
                  onStopBroadcast={stopBroadcast}
                  onDeleteClick={handleDeleteClick}
                  onViewAnalytics={handleViewAnalytics}
                />

                {totalPages > 1 && (
                  <div className="broadcast-pagination-bar">
                    <div className="broadcast-pagination-info">
                      Showing{" "}
                      <span className="broadcast-pagination-strong">
                        {indexOfFirstItem + 1}-
                        {Math.min(indexOfLastItem, filteredBroadcasts.length)}
                      </span>{" "}
                      of{" "}
                      <span className="broadcast-pagination-strong">
                        {filteredBroadcasts.length}
                      </span>{" "}
                      campaigns
                    </div>

                    <div className="broadcast-pagination-controls">
                      <button
                        type="button"
                        className="broadcast-pagination-btn"
                        onClick={() => paginate(safeCurrentPage - 1)}
                        disabled={safeCurrentPage <= 1}
                      >
                        Prev
                      </button>

                      <div className="broadcast-pagination-pages">
                        {getVisiblePages().map((pageNo) => (
                          <button
                            key={pageNo}
                            type="button"
                            className={`broadcast-pagination-page ${pageNo === safeCurrentPage ? "active" : ""}`}
                            onClick={() => paginate(pageNo)}
                          >
                            {pageNo}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="broadcast-pagination-btn"
                        onClick={() => paginate(safeCurrentPage + 1)}
                        disabled={safeCurrentPage >= totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "schedule" && (
            <ScheduleForm
              messageType={messageType}
              broadcastName={broadcastName}
              onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}
              templateName={templateName}
              onTemplateNameChange={handleTemplateNameChange}
              templateFilter={templateFilter}
              onTemplateFilterChange={(value) => setTemplateFilter(value)}
              officialTemplates={officialTemplates}
              filteredTemplates={filteredTemplates}
              customMessage={customMessage}
              onFileUpload={handleFileUpload}
              uploadedFile={uploadedFile}
              recipients={recipients}
              fileVariables={fileVariables}
              csvUploadState={csvUploadState}
              templateHeaderMediaUrl={templateHeaderMediaUrl}
              templateHeaderMediaUploading={templateHeaderMediaUploading}
              templateHeaderMediaError={templateHeaderMediaError}
              onTemplateHeaderMediaUpload={handleTemplateHeaderMediaFileUpload}
              onClearTemplateHeaderMedia={clearTemplateHeaderMedia}
              onClearUpload={handleClearUpload}
              onPrepareCsvReplace={handlePrepareCsvReplace}
              onOpenContactAudiencePicker={openContactAudiencePicker}
              onOpenCampaignAudiencePicker={openCampaignAudiencePicker}
              onClearSelectedAudience={clearSelectedAudience}
              audienceSourceMode={audienceSourceMode}
              onAudienceSourceModeChange={handleAudienceSourceModeChange}
              audienceSourceLabel={audienceSourceLabel}
              selectedCampaignAudienceLabel={selectedCampaignAudience?.campaignName || selectedCampaignAudience?.campaignBroadcastId || ""}
              selectedCampaignAudienceCount={selectedCampaignAudienceCount}
              selectedCampaignAudienceRecipients={selectedCampaignAudienceRecipients}
              onAutoCleanRecipients={handleAutoCleanRecipients}
              selectedTemplateCategory={selectedTemplateCategory}
              scheduledTime={scheduledTime}
              onScheduledTimeChange={(e) => setScheduledTime(e.target.value)}
              isSending={isSending}
              onCreateBroadcast={createBroadcast}
              onSendBroadcast={handleSendBroadcast}
              sendResults={sendResults}
              onBackToOverview={handleBackToOverview}
              onResetForm={resetComposerForm}
              onMetaLeadBatchSync={handleMetaLeadBatchSync}
              metaLeadBatchLoading={metaLeadBatchLoading}
              metaLeadBatchResult={metaLeadBatchResult}
              quietHoursEnabled={quietHoursEnabled}
              onQuietHoursEnabledChange={setQuietHoursEnabled}
              quietHoursStartHour={quietHoursStartHour}
              onQuietHoursStartHourChange={setQuietHoursStartHour}
              quietHoursEndHour={quietHoursEndHour}
              onQuietHoursEndHourChange={setQuietHoursEndHour}
              quietHoursTimezone={quietHoursTimezone}
              onQuietHoursTimezoneChange={setQuietHoursTimezone}
              quietHoursAction={quietHoursAction}
              onQuietHoursActionChange={setQuietHoursAction}
              retryPolicyEnabled={retryPolicyEnabled}
              onRetryPolicyEnabledChange={setRetryPolicyEnabled}
              retryMaxAttempts={retryMaxAttempts}
              onRetryMaxAttemptsChange={setRetryMaxAttempts}
              retryBackoffSeconds={retryBackoffSeconds}
              onRetryBackoffSecondsChange={setRetryBackoffSeconds}
              deliveryBatchSize={deliveryBatchSize}
              onDeliveryBatchSizeChange={setDeliveryBatchSize}
              respectOptOut={respectOptOut}
              onRespectOptOutChange={setRespectOptOut}
              suppressionListRaw={suppressionListRaw}
              onSuppressionListRawChange={setSuppressionListRaw}
            />
          )}

          <DeleteModal
            showDeleteModal={showDeleteModal}
            selectedCampaigns={selectedCampaigns}
            broadcasts={broadcasts}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={handleDeleteCancel}
          />

          <BroadcastTypeChoice
            showBroadcastTypeChoice={showBroadcastTypeChoice}
            onClose={() => {
              setShowBroadcastTypeChoice(false);
              if (chooserMode) navigate("/broadcast");
            }}
            onChooseTemplate={handleChooseTemplate}
          />

          <NewBroadcastPopup
            showNewBroadcastPopup={showNewBroadcastPopup}
            broadcastName={broadcastName}
            onBroadcastNameChange={(e) => setBroadcastName(e.target.value)}
            messageType={messageType}
            templateName={templateName}
            onTemplateNameChange={handleTemplateNameChange}
            officialTemplates={officialTemplates}
            uploadedFile={uploadedFile}
            recipients={recipients}
            fileVariables={fileVariables}
            csvUploadState={csvUploadState}
            onFileUpload={handleFileUpload}
            onClearUpload={handleClearUpload}
            onPrepareCsvReplace={handlePrepareCsvReplace}
            templateHeaderMediaUrl={templateHeaderMediaUrl}
            templateHeaderMediaUploading={templateHeaderMediaUploading}
            templateHeaderMediaError={templateHeaderMediaError}
            onTemplateHeaderMediaUpload={handleTemplateHeaderMediaFileUpload}
            onClearTemplateHeaderMedia={clearTemplateHeaderMedia}
            onOpenContactAudiencePicker={openContactAudiencePicker}
            onOpenCampaignExtraContactsPicker={openCampaignExtraContactsPicker}
            onOpenCampaignAudiencePicker={openCampaignAudiencePicker}
            onClearSelectedAudience={clearSelectedAudience}
            audienceSourceMode={audienceSourceMode}
            onAudienceSourceModeChange={handleAudienceSourceModeChange}
            audienceSourceLabel={audienceSourceLabel}
            selectedCampaignAudienceLabel={
              selectedCampaignAudience?.campaignName || ""
            }
            selectedCampaignAudienceCount={selectedCampaignAudienceCount}
            selectedCampaignAudienceRecipients={selectedCampaignAudienceRecipients}
            scheduledTime={scheduledTime}
            onScheduledTimeChange={(value) =>
              setScheduledTime(
                typeof value === "string" ? value : value?.target?.value || "",
              )
            }
            isSending={isSending}
            onCreateBroadcast={createBroadcast}
            onSendBroadcast={handleSendBroadcast}
            onClose={() => setShowNewBroadcastPopup(false)}
            onBackToChoice={() => {
              setShowContactAudiencePicker(false);
              setShowCampaignAudiencePicker(false);
              setShowNewBroadcastPopup(false);

              setShowBroadcastTypeChoice(true);
            }}
            getCurrentTime={getCurrentTime}
            quietHoursEnabled={quietHoursEnabled}
            onQuietHoursEnabledChange={setQuietHoursEnabled}
            quietHoursStartHour={quietHoursStartHour}
            onQuietHoursStartHourChange={setQuietHoursStartHour}
            quietHoursEndHour={quietHoursEndHour}
            onQuietHoursEndHourChange={setQuietHoursEndHour}
            quietHoursTimezone={quietHoursTimezone}
            onQuietHoursTimezoneChange={setQuietHoursTimezone}
            quietHoursAction={quietHoursAction}
            onQuietHoursActionChange={setQuietHoursAction}
            retryPolicyEnabled={retryPolicyEnabled}
            onRetryPolicyEnabledChange={setRetryPolicyEnabled}
            retryMaxAttempts={retryMaxAttempts}
            onRetryMaxAttemptsChange={setRetryMaxAttempts}
            retryBackoffSeconds={retryBackoffSeconds}
            onRetryBackoffSecondsChange={setRetryBackoffSeconds}
            deliveryBatchSize={deliveryBatchSize}
            onDeliveryBatchSizeChange={setDeliveryBatchSize}
            deliveryBatchDelaySeconds={deliveryBatchDelaySeconds}
            onDeliveryBatchDelaySecondsChange={setDeliveryBatchDelaySeconds}
            respectOptOut={respectOptOut}
            onRespectOptOutChange={setRespectOptOut}
            suppressionListRaw={suppressionListRaw}
            onSuppressionListRawChange={setSuppressionListRaw}
          />

          <CampaignAudiencePickerModal
            open={showCampaignAudiencePicker}
            onClose={closeCampaignAudiencePicker}
            onConfirm={applyCampaignAudienceSelection}
            onRequestAddContacts={openCampaignExtraContactsPicker}
            additionalContacts={
              selectedCampaignAudience?.additionalContacts || []
            }
          />

          <AllCampaignsPopup
            showAllCampaignsPopup={false}
            broadcasts={broadcasts}
            filteredBroadcasts={filteredBroadcasts}
            searchTerm={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            statusFilter={statusFilter}
            onStatusFilterChange={(value) => setStatusFilter(value)}
            showFilterDropdown={showFilterDropdown}
            onFilterDropdownToggle={() =>
              setShowFilterDropdown(!showFilterDropdown)
            }
            onClose={() => {}}
            getReadPercentage={getReadPercentage}
            getStatusClass={getStatusClass}
            onViewAnalytics={handleViewAnalytics}
            onStopBroadcast={stopBroadcast}
            onDeleteClick={handleDeleteClick}
          />

          <BroadcastAnalyticsModal
            isOpen={showAnalyticsModal}
            onClose={() => setShowAnalyticsModal(false)}
            broadcast={selectedBroadcast}
          />
          <BroadcastAudienceValidationModal
            open={audienceValidationModalOpen}
            validation={pendingAudienceValidation?.validation || null}
            onClose={() => {
              closeAudienceValidationModal();
              broadcastSubmitInFlightRef.current = false;
              setIsSending(false);
            }}
            onProceed={continueBroadcastWithEligibleRecipients}
          />
        </>
      )}
    </div>
  );
};

export default Broadcast;
