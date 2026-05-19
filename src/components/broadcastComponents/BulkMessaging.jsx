import React, { useState, useEffect, useRef } from "react";
import { Send, FileText, Download, X, RefreshCw } from "lucide-react";
import Papa from "papaparse";
import { apiClient } from "../services/whatsappapi";
import webSocketService from "../../services/websocketService";
import CampaignResults from "./CampaignResults";
import ContactAudiencePickerModal from "./ContactAudiencePickerModal";
import "./BulkMessaging.css";

const normalizeText = (value = "") => String(value || "").trim();

const formatDuration = (ms = 0) => {
  const safeMs = Math.max(0, Number(ms || 0));
  if (!safeMs) return "0s";
  if (safeMs < 1000) return "<1s";
  const totalSeconds = Math.floor(safeMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const csvImportStatusCopy = {
  uploading: {
    title: "Uploading CSV",
    description:
      "The file is being transferred to the server. You can keep browsing while the import continues in the background.",
  },
  queued: {
    title: "Queued for processing",
    description:
      "The CSV has been accepted and is waiting for the background worker.",
  },
  processing: {
    title: "Processing rows",
    description:
      "Rows are being validated and written in batches without blocking the browser.",
  },
  completed: {
    title: "Import complete",
    description:
      "The audience is ready to send. You can submit the broadcast now.",
  },
  cancelled: {
    title: "Import cancelled",
    description: "The upload was stopped before the job finished.",
  },
  failed: {
    title: "Import failed",
    description:
      "Please review the error details below and try uploading the CSV again.",
  },
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

const BulkMessaging = () => {
  const [messageType, setMessageType] = useState("template");
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [customMessage, setCustomMessage] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const [broadcastName, setBroadcastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [csvPreview, setCsvPreview] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [showContactAudiencePicker, setShowContactAudiencePicker] =
    useState(false);
  const [audienceSourceLabel, setAudienceSourceLabel] = useState("");
  const [csvParseStatus, setCsvParseStatus] = useState("idle");
  const [csvParseMessage, setCsvParseMessage] = useState("");
  const [csvUploadProgress, setCsvUploadProgress] = useState(0);
  const [csvImportJob, setCsvImportJob] = useState(null);
  const [csvImportStatus, setCsvImportStatus] = useState("idle");
  const [csvImportError, setCsvImportError] = useState("");
  const [csvImportProgress, setCsvImportProgress] = useState(0);
  const [csvImportProcessed, setCsvImportProcessed] = useState(0);
  const [csvImportTotal, setCsvImportTotal] = useState(0);
  const [csvImportEtaMs, setCsvImportEtaMs] = useState(null);
  const [showCsvImportDetails, setShowCsvImportDetails] = useState(false);
  const [recentCsvImportJobs, setRecentCsvImportJobs] = useState([]);
  const [recentCsvImportsLoading, setRecentCsvImportsLoading] = useState(false);
  const [recentCsvImportsError, setRecentCsvImportsError] = useState("");
  const [csvImportHistoryQuery, setCsvImportHistoryQuery] = useState("");
  const [csvImportHistoryStatusFilter, setCsvImportHistoryStatusFilter] =
    useState("all");
  const [isCsvDragOver, setIsCsvDragOver] = useState(false);
  const csvRecipientsRef = useRef([]);
  const csvImportSessionRef = useRef(0);
  const csvImportAbortRef = useRef(false);
  const csvUploadAbortControllerRef = useRef(null);
  const csvImportJobIdRef = useRef("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    csvImportJobIdRef.current = String(csvImportJob?.id || "").trim();
  }, [csvImportJob?.id]);

  useEffect(() => {
    if (
      csvImportStatus === "completed" ||
      csvImportStatus === "failed" ||
      csvImportStatus === "cancelled"
    ) {
      setShowCsvImportDetails(true);
    }
  }, [csvImportStatus]);

  const loadCsvImportHistory = async () => {
    setRecentCsvImportsLoading(true);
    setRecentCsvImportsError("");

    try {
      const response = await apiClient.getCsvImportJobs({ limit: 6 });
      const jobs = response?.data?.data?.jobs || response?.data?.jobs || [];
      setRecentCsvImportJobs(Array.isArray(jobs) ? jobs : []);
    } catch (error) {
      setRecentCsvImportsError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load recent CSV imports",
      );
    } finally {
      setRecentCsvImportsLoading(false);
    }
  };

  useEffect(() => {
    const ensureSocketConnection = () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");
        const userId = String(
          storedUser?.id ||
            storedUser?._id ||
            localStorage.getItem("userId") ||
            "",
        ).trim();
        if (!userId) return;
        webSocketService.connect(userId).catch(() => {
          // Best effort only; upload progress still falls back to polling.
        });
      } catch {
        // ignore
      }
    };

    ensureSocketConnection();

    const handleImportProgress = (payload = {}) => {
      const importJobId = String(payload?.importJobId || "").trim();
      if (!importJobId || csvImportJobIdRef.current !== importJobId) return;
      setCsvImportStatus(String(payload?.status || "processing"));
      setCsvImportProgress(Number(payload?.percentComplete || 0));
      setCsvImportProcessed(Number(payload?.processedRows || 0));
      setCsvImportTotal(Number(payload?.totalRows || 0));
      setCsvImportEtaMs(
        Number.isFinite(Number(payload?.etaMs)) ? Number(payload.etaMs) : null,
      );
      setCsvImportJob((prev) =>
        prev
          ? {
              ...prev,
              status: String(payload?.status || prev.status || "processing"),
              totalRows: Number(payload?.totalRows || prev.totalRows || 0),
              processedRows: Number(
                payload?.processedRows || prev.processedRows || 0,
              ),
              successCount: Number(
                payload?.successCount || prev.successCount || 0,
              ),
              failedCount: Number(
                payload?.failedCount || prev.failedCount || 0,
              ),
              duplicateCount: Number(
                payload?.duplicateCount || prev.duplicateCount || 0,
              ),
              skippedCount: Number(
                payload?.skippedCount || prev.skippedCount || 0,
              ),
              percentComplete: Number(
                payload?.percentComplete || prev.percentComplete || 0,
              ),
              etaMs: Number.isFinite(Number(payload?.etaMs))
                ? Number(payload.etaMs)
                : (prev.etaMs ?? null),
            }
          : prev,
      );
      setCsvImportError("");
    };

    const handleImportCompleted = (payload = {}) => {
      const importJobId = String(payload?.importJobId || "").trim();
      if (!importJobId || csvImportJobIdRef.current !== importJobId) return;
      setCsvImportStatus("completed");
      setCsvImportProgress(100);
      setCsvImportProcessed(
        Number(payload?.processedRows || csvImportProcessed || 0),
      );
      setCsvImportTotal(Number(payload?.totalRows || csvImportTotal || 0));
      setCsvImportEtaMs(0);
      setCsvImportJob((prev) =>
        prev
          ? {
              ...prev,
              status: "completed",
              totalRows: Number(payload?.totalRows || prev.totalRows || 0),
              processedRows: Number(
                payload?.processedRows || prev.processedRows || 0,
              ),
              successCount: Number(
                payload?.successCount || prev.successCount || 0,
              ),
              failedCount: Number(
                payload?.failedCount || prev.failedCount || 0,
              ),
              duplicateCount: Number(
                payload?.duplicateCount || prev.duplicateCount || 0,
              ),
              skippedCount: Number(
                payload?.skippedCount || prev.skippedCount || 0,
              ),
              percentComplete: 100,
              etaMs: 0,
            }
          : prev,
      );
    };

    const handleImportFailed = (payload = {}) => {
      const importJobId = String(payload?.importJobId || "").trim();
      if (!importJobId || csvImportJobIdRef.current !== importJobId) return;
      setCsvImportStatus("failed");
      setCsvImportError(String(payload?.error || "CSV import failed").trim());
      setCsvImportJob((prev) =>
        prev
          ? {
              ...prev,
              status: "failed",
              errorMessage: String(
                payload?.error || prev.errorMessage || "CSV import failed",
              ).trim(),
            }
          : prev,
      );
    };

    webSocketService.on("csv_import_progress", handleImportProgress);
    webSocketService.on("csv_import_completed", handleImportCompleted);
    webSocketService.on("csv_import_failed", handleImportFailed);

    return () => {
      webSocketService.off("csv_import_progress", handleImportProgress);
      webSocketService.off("csv_import_completed", handleImportCompleted);
      webSocketService.off("csv_import_failed", handleImportFailed);
    };
  }, []);

  useEffect(() => {
    void loadCsvImportHistory();
  }, []);

  useEffect(() => {
    if (!csvImportJob?.id) return undefined;
    if (
      csvImportStatus === "completed" ||
      csvImportStatus === "failed" ||
      csvImportStatus === "cancelled"
    )
      return undefined;

    let cancelled = false;
    const pollJob = async () => {
      try {
        const response = await apiClient.getCsvImportJob(csvImportJob.id);
        if (cancelled) return;
        const job = response?.data?.data?.job || response?.data?.job || null;
        if (!job) return;
        setCsvImportStatus(String(job.status || "processing"));
        setCsvImportProgress(Number(job.percentComplete || 0));
        setCsvImportProcessed(Number(job.processedRows || 0));
        setCsvImportTotal(Number(job.totalRows || 0));
        setCsvImportEtaMs(
          Number.isFinite(Number(job.etaMs)) ? Number(job.etaMs) : null,
        );
        setCsvImportError(String(job.errorMessage || "").trim());
        setCsvImportJob((prev) =>
          prev
            ? {
                ...prev,
                status: String(job.status || prev.status || "processing"),
                totalRows: Number(job.totalRows || prev.totalRows || 0),
                processedRows: Number(
                  job.processedRows || prev.processedRows || 0,
                ),
                successCount: Number(
                  job.successCount || prev.successCount || 0,
                ),
                failedCount: Number(job.failedCount || prev.failedCount || 0),
                duplicateCount: Number(
                  job.duplicateCount || prev.duplicateCount || 0,
                ),
                skippedCount: Number(
                  job.skippedCount || prev.skippedCount || 0,
                ),
                percentComplete: Number(
                  job.percentComplete || prev.percentComplete || 0,
                ),
                etaMs: Number.isFinite(Number(job.etaMs))
                  ? Number(job.etaMs)
                  : (prev.etaMs ?? null),
                errorMessage: String(
                  job.errorMessage || prev.errorMessage || "",
                ).trim(),
              }
            : prev,
        );
      } catch {
        // polling is a fallback only
      }
    };

    void pollJob();
    const timer = window.setInterval(() => {
      void pollJob();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [csvImportJob?.id, csvImportStatus]);

  const fetchTemplates = async () => {
    try {
      const result = await apiClient.getTemplates();
      setTemplates(result.data || []);
    } catch (error) {
      alert("Error fetching templates: " + error.message);
    }
  };

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      const result = await apiClient.syncTemplates();
      if (result.success) {
        await fetchTemplates();
      }
    } catch (error) {
      alert("Error syncing templates: " + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const normalizeContactToRecipient = (contact = {}) => ({
    phone: String(contact?.phone || "").trim(),
    name: String(contact?.name || contact?.displayName || "").trim(),
    contactId: String(contact?._id || contact?.id || "").trim(),
    sourceType: String(contact?.sourceType || "manual").trim() || "manual",
    variables: [],
    data: contact,
    fullData: contact,
  });

  const isCsvImportBusy = ["uploading", "queued", "processing"].includes(
    String(csvImportStatus || "").trim(),
  );

  const startCsvImportUpload = async (file, sessionId) => {
    if (!file) return;

    try {
      setCsvUploadProgress(0);
      setCsvImportError("");
      setCsvImportStatus("uploading");
      const abortController = new AbortController();
      csvUploadAbortControllerRef.current = abortController;

      const response = await apiClient.uploadCSV(file, {
        onUploadProgress: (event) => {
          if (
            csvImportSessionRef.current !== sessionId ||
            csvImportAbortRef.current
          )
            return;
          if (!event?.total) return;
          setCsvUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
        signal: abortController.signal,
      });

      if (
        csvImportSessionRef.current !== sessionId ||
        csvImportAbortRef.current
      )
        return;

      const job =
        response?.data?.data?.importJob ||
        response?.data?.importJob ||
        response?.importJob ||
        null;
      if (job?.id) {
        setCsvImportJob({
          id: String(job.id),
          status: String(job.status || "queued"),
          originalFileName: String(job.originalFileName || "").trim(),
          totalRows: Number(job.totalRows || 0),
          processedRows: Number(job.processedRows || 0),
          successCount: Number(job.successCount || 0),
          failedCount: Number(job.failedCount || 0),
          duplicateCount: Number(job.duplicateCount || 0),
          skippedCount: Number(job.skippedCount || 0),
          errorMessage: String(job.errorMessage || "").trim(),
          createdAt: job.createdAt || null,
          updatedAt: job.updatedAt || null,
        });
        setCsvImportStatus(String(job.status || "queued"));
        setCsvImportProgress(Number(job.percentComplete || 0));
        setCsvImportProcessed(Number(job.processedRows || 0));
        setCsvImportTotal(Number(job.totalRows || 0));
        setCsvImportEtaMs(
          Number.isFinite(Number(job.etaMs)) ? Number(job.etaMs) : null,
        );
        setAudienceSourceLabel("CSV upload");
      }
      setCsvUploadProgress(100);
      void loadCsvImportHistory();
    } catch (error) {
      if (
        csvImportSessionRef.current !== sessionId ||
        csvImportAbortRef.current
      )
        return;
      setCsvImportStatus("failed");
      setCsvImportError(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "CSV import failed",
      );
    } finally {
      if (csvUploadAbortControllerRef.current) {
        csvUploadAbortControllerRef.current = null;
      }
    }
  };

  const applyCsvImportHistorySelection = (job = {}) => {
    const nextJobId = String(job?.id || job?._id || "").trim();
    if (!nextJobId) return;

    csvImportAbortRef.current = true;
    csvImportSessionRef.current = 0;
    if (csvUploadAbortControllerRef.current) {
      csvUploadAbortControllerRef.current.abort();
      csvUploadAbortControllerRef.current = null;
    }
    setCsvFile(null);
    setCsvPreview([]);
    setRecipients([]);
    csvRecipientsRef.current = [];
    setCsvParseStatus("idle");
    setCsvParseMessage("");
    setCsvUploadProgress(100);
    setCsvImportJob({
      id: nextJobId,
      status: String(job?.status || "completed"),
      originalFileName: String(
        job?.originalFileName || job?.storedFileName || "",
      ).trim(),
      totalRows: Number(job?.totalRows || 0),
      processedRows: Number(job?.processedRows || 0),
      successCount: Number(job?.successCount || 0),
      failedCount: Number(job?.failedCount || 0),
      duplicateCount: Number(job?.duplicateCount || 0),
      skippedCount: Number(job?.skippedCount || 0),
      errorMessage: String(job?.errorMessage || "").trim(),
      createdAt: job?.createdAt || null,
      updatedAt: job?.updatedAt || null,
    });
    setCsvImportStatus(String(job?.status || "completed"));
    setCsvImportError(String(job?.errorMessage || "").trim());
    setCsvImportProgress(Number(job?.percentComplete || 0));
    setCsvImportProcessed(Number(job?.processedRows || 0));
    setCsvImportTotal(Number(job?.totalRows || 0));
    setCsvImportEtaMs(
      Number.isFinite(Number(job?.etaMs)) ? Number(job.etaMs) : null,
    );
    setAudienceSourceLabel(
      String(
        job?.originalFileName || job?.storedFileName || "CSV import history",
      ).trim(),
    );
    setShowCsvImportDetails(true);

    const fileInput = document.getElementById("csv-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const recentCsvImportJobsFiltered = recentCsvImportJobs.filter((job) => {
    const status = String(job?.status || "")
      .trim()
      .toLowerCase();
    const label = String(job?.originalFileName || job?.storedFileName || "")
      .trim()
      .toLowerCase();
    const jobId = String(job?.id || job?._id || "")
      .trim()
      .toLowerCase();
    const query = String(csvImportHistoryQuery || "")
      .trim()
      .toLowerCase();
    const statusFilter = String(csvImportHistoryStatusFilter || "all")
      .trim()
      .toLowerCase();

    const matchesQuery =
      !query || label.includes(query) || jobId.includes(query);
    const matchesStatus = statusFilter === "all" || status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  const openContactAudiencePicker = () => {
    setShowContactAudiencePicker(true);
  };

  const closeContactAudiencePicker = () => {
    setShowContactAudiencePicker(false);
  };

  const applyContactAudienceSelection = (selectedContacts = []) => {
    const normalizedRecipients = Array.isArray(selectedContacts)
      ? selectedContacts
          .map((contact) => normalizeContactToRecipient(contact))
          .filter((recipient) => recipient.phone)
      : [];

    csvImportAbortRef.current = true;
    csvImportSessionRef.current = 0;
    if (csvUploadAbortControllerRef.current) {
      csvUploadAbortControllerRef.current.abort();
      csvUploadAbortControllerRef.current = null;
    }
    setCsvFile(null);
    setCsvPreview([]);
    setRecipients(normalizedRecipients);
    setAudienceSourceLabel(
      normalizedRecipients.length > 0 ? "Selected CRM contacts" : "",
    );
    setCsvParseStatus("idle");
    setCsvParseMessage("");
    setCsvUploadProgress(0);
    setCsvImportJob(null);
    setCsvImportStatus("idle");
    setCsvImportError("");
    setCsvImportProgress(0);
    setCsvImportProcessed(0);
    setCsvImportTotal(0);
    setCsvImportEtaMs(null);

    const fileInput = document.getElementById("csv-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const clearAudienceSelection = () => {
    csvImportAbortRef.current = true;
    csvImportSessionRef.current = 0;
    if (csvUploadAbortControllerRef.current) {
      csvUploadAbortControllerRef.current.abort();
      csvUploadAbortControllerRef.current = null;
    }
    setRecipients([]);
    setCsvFile(null);
    setCsvPreview([]);
    setAudienceSourceLabel("");
    setCsvParseStatus("idle");
    setCsvParseMessage("");
    setCsvUploadProgress(0);
    setCsvImportJob(null);
    setCsvImportStatus("idle");
    setCsvImportError("");
    setCsvImportProgress(0);
    setCsvImportProcessed(0);
    setCsvImportTotal(0);
    setCsvImportEtaMs(null);

    const fileInput = document.getElementById("csv-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (isCsvImportBusy) {
      setCsvImportError(
        "CSV upload is already in progress. Please cancel it before uploading another file.",
      );
      e.target.value = "";
      return;
    }

    csvImportAbortRef.current = false;
    const nextSessionId = Date.now() + Math.random();
    csvImportSessionRef.current = nextSessionId;

    setCsvFile(file);
    setCsvPreview([]);
    setCsvParseStatus("parsing");
    setCsvParseMessage("Generating a quick preview...");
    setCsvUploadProgress(0);
    setCsvImportProgress(0);
    setCsvImportProcessed(0);
    setCsvImportTotal(0);
    setCsvImportEtaMs(null);
    setCsvImportStatus("uploading");
    setCsvImportError("");
    setCsvImportJob(null);
    csvRecipientsRef.current = [];

    const previewLines = [];
    let detectedFields = [];
    let rowCount = 0;

    Papa.parse(file, {
      header: true,
      worker: true,
      preview: 12,
      skipEmptyLines: "greedy",
      transformHeader: (header) => String(header || "").trim(),
      step: (results) => {
        const row =
          results?.data && typeof results.data === "object" ? results.data : {};
        if (!detectedFields.length && Array.isArray(results?.meta?.fields)) {
          detectedFields = results.meta.fields;
          if (detectedFields.length > 0) {
            previewLines.push(detectedFields.join(","));
          }
        }

        const fields = detectedFields.length
          ? detectedFields
          : Object.keys(row || {});
        if (previewLines.length < 13 && fields.length > 0) {
          previewLines.push(
            fields.map((field) => normalizeText(row?.[field] || "")).join(","),
          );
        }

        rowCount += 1;
      },
      complete: () => {
        setCsvPreview(previewLines);
        setCsvParseStatus("ready");
        setCsvParseMessage(
          rowCount > 0
            ? `${rowCount.toLocaleString()} preview row${rowCount === 1 ? "" : "s"} loaded. The CSV will finish processing in the background.`
            : "CSV preview ready. Uploading the file for background processing.",
        );
        setAudienceSourceLabel("CSV upload");
      },
      error: (error) => {
        setCsvPreview([]);
        setCsvParseStatus("error");
        setCsvParseMessage(error?.message || "Failed to parse a CSV preview.");
        setAudienceSourceLabel("");
      },
    });

    void startCsvImportUpload(file, nextSessionId);
  };

  const removeFile = () => {
    csvImportAbortRef.current = true;
    csvImportSessionRef.current = 0;
    if (csvUploadAbortControllerRef.current) {
      csvUploadAbortControllerRef.current.abort();
      csvUploadAbortControllerRef.current = null;
    }
    setCsvFile(null);
    setCsvPreview([]);
    setRecipients([]);
    csvRecipientsRef.current = [];
    setCsvParseStatus("idle");
    setCsvParseMessage("");
    setCsvUploadProgress(0);
    setCsvImportJob(null);
    setCsvImportStatus("idle");
    setCsvImportError("");
    setCsvImportProgress(0);
    setCsvImportProcessed(0);
    setCsvImportTotal(0);
    setCsvImportEtaMs(null);
    setAudienceSourceLabel("");
    // Clear the file input
    const fileInput = document.getElementById("csv-upload");
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleCsvDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCsvImportBusy || loading) return;
    setIsCsvDragOver(true);
  };

  const handleCsvDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsCsvDragOver(false);
  };

  const handleCsvDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsCsvDragOver(false);

    if (isCsvImportBusy || loading) return;

    const droppedFile = event.dataTransfer?.files?.[0];
    if (!droppedFile) return;
    if (
      !String(droppedFile.name || "")
        .toLowerCase()
        .endsWith(".csv")
    ) {
      setCsvImportError("Please drop a valid CSV file.");
      return;
    }

    handleFileChange({ target: { files: [droppedFile] } });
  };

  const handleCancelCsvImport = async () => {
    const jobId = String(csvImportJob?.id || "").trim();

    if (
      csvUploadAbortControllerRef.current &&
      csvImportStatus === "uploading"
    ) {
      csvImportAbortRef.current = true;
      csvUploadAbortControllerRef.current.abort();
      csvUploadAbortControllerRef.current = null;
      setCsvImportStatus("cancelled");
      setCsvImportError("");
      setCsvParseStatus("idle");
      setCsvParseMessage("CSV upload cancelled.");
      return;
    }

    if (
      !jobId ||
      !["queued", "processing"].includes(String(csvImportStatus || "").trim())
    ) {
      return;
    }

    try {
      setCsvImportError("");
      const response = await apiClient.cancelCsvImportJob(jobId);
      const job = response?.data?.data?.job || response?.data?.job || null;
      setCsvImportJob(
        job
          ? {
              id: String(job.id || job._id || jobId),
              status: String(job.status || "cancelled"),
              originalFileName: String(
                job.originalFileName || job.storedFileName || "",
              ).trim(),
              totalRows: Number(job.totalRows || 0),
              processedRows: Number(job.processedRows || 0),
              errorMessage: String(job.errorMessage || "").trim(),
              createdAt: job.createdAt || null,
              updatedAt: job.updatedAt || null,
            }
          : csvImportJob,
      );
      setCsvImportStatus("cancelled");
      setCsvImportProgress(
        Number(job?.percentComplete || csvImportProgress || 0),
      );
      setCsvImportProcessed(
        Number(job?.processedRows || csvImportProcessed || 0),
      );
      setCsvImportTotal(Number(job?.totalRows || csvImportTotal || 0));
      setCsvImportEtaMs(null);
      setCsvImportError(
        String(job?.errorMessage || "CSV import cancelled").trim(),
      );
    } catch (error) {
      setCsvImportError(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          "Failed to cancel CSV import",
      );
    }
  };

  const formatJobTime = (value) => {
    if (!value) return "Unknown";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  };

  const handleCopyImportJobId = async () => {
    const jobId = String(csvImportJob?.id || "").trim();
    if (!jobId || !navigator?.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(jobId);
    } catch {
      // Best effort only.
    }
  };

  const validateForm = () => {
    const hasReusableImportJob = Boolean(
      csvImportJob?.id && csvImportStatus === "completed",
    );
    if (!csvFile && recipients.length === 0 && !hasReusableImportJob) {
      alert("Please upload a CSV file or select contacts");
      return false;
    }

    if (csvFile && (csvParseStatus === "parsing" || isCsvImportBusy)) {
      alert("Please wait for the CSV upload to finish");
      return false;
    }

    if (csvFile && csvImportStatus !== "completed") {
      alert("Please wait for the CSV import job to finish");
      return false;
    }

    if (messageType === "template" && !templateName) {
      alert("Please select a template");
      return false;
    }

    if (messageType === "text" && !customMessage.trim()) {
      alert("Please enter a custom message");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setResults(null);

    try {
      const selectedContactIds = Array.from(
        new Set(
          (Array.isArray(recipients) ? recipients : [])
            .map((recipient) => String(recipient?.contactId || "").trim())
            .filter(Boolean),
        ),
      );
      const hasCsvImportJob = Boolean(
        csvImportJob?.id && csvImportStatus === "completed",
      );
      const useCompactAudience =
        hasCsvImportJob || selectedContactIds.length > 0;
      const compactRecipientCount = hasCsvImportJob
        ? Number(csvImportTotal || csvImportProcessed || 0)
        : selectedContactIds.length;

      const audienceSource = hasCsvImportJob
        ? {
            mode: "csv_import_job",
            label: "CSV import job",
            type: "csv_import_job",
            sourceName: "csv_import_job",
            uploadedFileName: String(
              csvFile?.name || csvImportJob?.originalFileName || "",
            ).trim(),
            importJobId: String(csvImportJob?.id || "").trim(),
            recipientCount: compactRecipientCount,
            selectedContactCount: 0,
            hasContactIds: true,
            contactIds: [],
          }
        : selectedContactIds.length > 0
          ? {
              mode: "contacts",
              label: "Selected CRM contacts",
              type: "contacts",
              sourceName: "crm_contacts",
              recipientCount: compactRecipientCount,
              selectedContactCount: selectedContactIds.length,
              hasContactIds: true,
              contactIds: selectedContactIds,
            }
          : {};

      const audienceSnapshot = hasCsvImportJob
        ? {
            mode: "csv_import_job",
            label: "CSV import job",
            sourceType: "csv_import_job",
            sourceName: "csv_import_job",
            uploadedFileName: String(
              csvFile?.name || csvImportJob?.originalFileName || "",
            ).trim(),
            importJobId: String(csvImportJob?.id || "").trim(),
            recipientCount: compactRecipientCount,
            selectedContactCount: 0,
            contactIds: [],
          }
        : selectedContactIds.length > 0
          ? {
              mode: "contacts",
              label: "Selected CRM contacts",
              sourceType: "contacts",
              sourceName: "crm_contacts",
              recipientCount: compactRecipientCount,
              selectedContactCount: selectedContactIds.length,
              contactIds: selectedContactIds,
            }
          : {};

      const audienceRecipients = useCompactAudience ? [] : recipients;

      const bulkData = {
        messageType: messageType,
        recipients: audienceRecipients,
        ...(useCompactAudience ? { audienceSource, audienceSnapshot } : {}),
        ...(messageType === "template"
          ? { templateName, language }
          : { customMessage }),
        broadcastName:
          broadcastName || `Bulk Send - ${new Date().toLocaleString()}`,
      };

      const sendResult = await apiClient.sendBulkMessages(bulkData);
      setResults(sendResult);
    } catch (error) {
      setResults({
        success: false,
        message: error.message || "Failed to send bulk messages",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async (selectedFailedItems = null) => {
    const sourceList =
      Array.isArray(selectedFailedItems) && selectedFailedItems.length > 0
        ? selectedFailedItems
        : (results?.results || []).filter((item) => !item?.success);

    const retryRecipients = sourceList
      .map((item) => ({
        phone: String(item?.phone || "").trim(),
        variables: Array.isArray(item?.variables) ? item.variables : [],
      }))
      .filter((item) => item.phone);

    if (retryRecipients.length === 0) {
      alert("No failed numbers available for retry.");
      return;
    }

    setLoading(true);
    try {
      const retryPayload = {
        messageType,
        recipients: retryRecipients,
        ...(messageType === "template"
          ? { templateName, language }
          : { customMessage }),
        broadcastName: `${broadcastName || "Bulk Send"} - Retry ${new Date().toLocaleString()}`,
      };

      const retryResult = await apiClient.sendBulkMessages(retryPayload);
      setResults(retryResult);
    } catch (error) {
      alert(`Retry failed: ${error?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `phone,var1,var2
+1234567890,John,Doe
+1987654321,Jane,Smith
+1122334456,Bob,Johnson`;

    const blob = new Blob([sampleCSV], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_bulk_messaging.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bulk-messaging">
      <div className="bulk-messaging-header">
        <h2>Bulk Messaging</h2>
        <p>Send personalized messages to multiple contacts at once</p>
      </div>

      <form onSubmit={handleSubmit} className="bulk-messaging-form">
        {/* Broadcast Name */}
        <div className="form-group">
          <label className="form-label">Broadcast Name</label>
          <input
            type="text"
            value={broadcastName}
            onChange={(e) => setBroadcastName(e.target.value)}
            placeholder="Enter broadcast name (optional)"
            className="form-input"
          />
        </div>

        {/* Message Type */}
        <div className="form-group">
          <label className="form-label">Message Type</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                value="template"
                checked={messageType === "template"}
                onChange={(e) => setMessageType(e.target.value)}
                className="radio-input"
              />
              <span>Template Message</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                value="text"
                checked={messageType === "text"}
                onChange={(e) => setMessageType(e.target.value)}
                className="radio-input"
              />
              <span>Custom Text Message</span>
            </label>
          </div>
        </div>

        {/* Template Fields */}
        {messageType === "template" && (
          <div className="template-section">
            <div className="template-header">
              <h3>Template Configuration</h3>
              <button
                type="button"
                onClick={syncTemplates}
                disabled={syncing}
                className="sync-btn"
              >
                <RefreshCw size={16} className={syncing ? "spinning" : ""} />
                {syncing ? "Syncing..." : "Sync Templates"}
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Select Template</label>
              <select
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Select a template...</option>
                {templates
                  .filter((t) => t.status === "approved")
                  .map((template) => (
                    <option
                      key={template._id || template.name}
                      value={template.name}
                    >
                      {template.name}{" "}
                      {template.category && `(${template.category})`}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language Code</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en_US"
                className="form-input"
                required
              />
              <p className="form-help">e.g., en_US, es_ES, fr_FR</p>
            </div>
          </div>
        )}

        {/* Custom Message Fields */}
        {messageType === "text" && (
          <div className="custom-message-section">
            <div className="form-group">
              <label className="form-label">Custom Message</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your custom message here... Use {var1}, {var2}, etc. for variables from CSV"
                rows={6}
                className="form-textarea"
                required
              />
              <p className="form-help">
                Use placeholders like {"{var1}"}, {"{var2}"} for dynamic content
                from CSV columns
              </p>
            </div>
          </div>
        )}

        {/* CSV Upload */}
        <div className="form-group">
          <div className="csv-upload-header">
            <label className="form-label">Audience Source</label>
            <button
              type="button"
              onClick={downloadSampleCSV}
              className="download-sample-btn"
            >
              <Download size={14} />
              Download Sample
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={openContactAudiencePicker}
              className="download-sample-btn"
              disabled={loading || isCsvImportBusy}
            >
              Select from Contacts
            </button>
            {(csvFile || recipients.length > 0) && (
              <button
                type="button"
                onClick={clearAudienceSelection}
                className="download-sample-btn"
                disabled={loading || isCsvImportBusy}
              >
                Clear Audience
              </button>
            )}
          </div>

          <div
            className={`csv-upload-area${isCsvImportBusy ? " is-busy" : ""}${isCsvDragOver ? " is-drag-over" : ""}`}
            onDragOver={handleCsvDragOver}
            onDragLeave={handleCsvDragLeave}
            onDrop={handleCsvDrop}
          >
            {isCsvImportBusy ? (
              <div className="csv-upload-overlay" aria-hidden="true">
                <div className="csv-upload-overlay__spinner" />
                <div className="csv-upload-overlay__text">
                  <strong>
                    {csvImportStatus === "uploading"
                      ? "Uploading CSV..."
                      : csvImportStatus === "queued"
                        ? "Queued for processing..."
                        : "Processing contacts..."}
                  </strong>
                  <span>
                    {csvImportStatus === "uploading"
                      ? `${Math.round(csvUploadProgress)}% uploaded`
                      : csvImportStatus === "queued"
                        ? "Waiting for worker pickup"
                        : `${Math.round(csvImportProgress)}% processed`}
                  </span>
                </div>
              </div>
            ) : null}

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="csv-input"
              id="csv-upload"
              disabled={loading || isCsvImportBusy}
            />
            <label
              htmlFor="csv-upload"
              className={`csv-upload-label${isCsvImportBusy ? " is-busy" : ""}`}
            >
              <p className="upload-text">
                {csvImportStatus === "uploading"
                  ? "Uploading CSV..."
                  : csvImportStatus === "queued"
                    ? "CSV accepted. Waiting for background processing..."
                    : csvImportStatus === "processing"
                      ? "Processing contacts..."
                      : csvImportStatus === "cancelled"
                        ? "Upload cancelled"
                        : csvFile
                          ? csvFile.name
                          : "Click to upload CSV file or choose contacts"}
              </p>
              <p className="upload-help">
                {isCsvImportBusy
                  ? "You can keep browsing while the import runs in the background."
                  : "Format: phone,var1,var2,... or use CRM contacts instead"}
              </p>
            </label>
          </div>

          {csvFile && (
            <div className="file-info">
              <FileText className="file-icon" />
              <span className="file-name">{csvFile.name}</span>
              <button
                type="button"
                onClick={removeFile}
                className="remove-file-btn"
                disabled={isCsvImportBusy}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {csvParseMessage && (
            <p className="form-help">
              {csvParseStatus === "parsing" ? "Parsing CSV..." : "CSV ready"}
              {csvParseMessage ? `: ${csvParseMessage}` : ""}
            </p>
          )}

          {(csvImportJob || csvImportStatus !== "idle") &&
            (() => {
              const statusMeta = csvImportStatusCopy[csvImportStatus] || {
                title: "CSV import",
                description: "Tracking the import job in the background.",
              };
              const progressValue =
                csvImportStatus === "uploading"
                  ? csvUploadProgress
                  : csvImportStatus === "queued"
                    ? 100
                    : csvImportStatus === "completed"
                      ? 100
                      : csvImportProgress;
              const totalRowsLabel = Number(
                csvImportTotal || csvImportJob?.totalRows || 0,
              ).toLocaleString();
              const processedRowsLabel = Number(
                csvImportProcessed || csvImportJob?.processedRows || 0,
              ).toLocaleString();
              const successCountLabel = Number(
                csvImportJob?.successCount || 0,
              ).toLocaleString();
              const failedCountLabel = Number(
                csvImportJob?.failedCount || 0,
              ).toLocaleString();
              const duplicateCountLabel = Number(
                csvImportJob?.duplicateCount || 0,
              ).toLocaleString();
              const skippedCountLabel = Number(
                csvImportJob?.skippedCount || 0,
              ).toLocaleString();

              return (
                <div
                  className="broadcast-validation-banner broadcast-validation-banner--success"
                  style={{ marginBottom: 12, display: "grid", gap: 12 }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{statusMeta.title}</strong>
                    <p style={{ margin: 0 }}>{statusMeta.description}</p>
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(0, Math.min(100, progressValue))}%`,
                        borderRadius: 999,
                        background: "linear-gradient(90deg, #38bdf8, #22c55e)",
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      fontSize: 13,
                      opacity: 0.95,
                    }}
                  >
                    {csvImportJob?.id ? (
                      <span>Job: {csvImportJob.id}</span>
                    ) : null}
                    {csvImportStatus === "uploading" ? (
                      <span>Uploading CSV...</span>
                    ) : null}
                    {csvImportStatus === "uploading" ? (
                      <span>
                        Upload progress: {Math.round(csvUploadProgress)}%
                      </span>
                    ) : null}
                    {csvImportStatus === "queued" ? (
                      <span>Waiting for worker pickup</span>
                    ) : null}
                    {csvImportStatus === "processing" ? (
                      <span>
                        Processed {processedRowsLabel} / {totalRowsLabel} rows
                      </span>
                    ) : null}
                    {csvImportStatus === "processing" ? (
                      <span>Validating numbers...</span>
                    ) : null}
                    {csvImportStatus === "processing" ||
                    csvImportStatus === "completed" ? (
                      <span>
                        Success: {successCountLabel} | Failed:{" "}
                        {failedCountLabel} | Duplicates: {duplicateCountLabel} |
                        Skipped: {skippedCountLabel}
                      </span>
                    ) : null}
                    {csvImportStatus === "completed" ? (
                      <span>Audience ready to send</span>
                    ) : null}
                    {csvImportStatus === "cancelled" ? (
                      <span>Import cancelled</span>
                    ) : null}
                    {csvImportStatus === "failed" ? (
                      <span>{csvImportError || "Import failed."}</span>
                    ) : null}
                    {csvImportStatus === "processing" &&
                    csvImportEtaMs != null ? (
                      <span>ETA: {formatDuration(csvImportEtaMs)}</span>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      className="download-sample-btn"
                      onClick={() => setShowCsvImportDetails((prev) => !prev)}
                    >
                      {showCsvImportDetails ? "Hide Details" : "View Details"}
                    </button>
                    {csvImportJob?.id ? (
                      <button
                        type="button"
                        className="download-sample-btn"
                        onClick={handleCopyImportJobId}
                      >
                        Copy Job ID
                      </button>
                    ) : null}
                    {["uploading", "queued", "processing"].includes(
                      csvImportStatus,
                    ) ? (
                      <button
                        type="button"
                        className="download-sample-btn"
                        onClick={handleCancelCsvImport}
                      >
                        Cancel Upload
                      </button>
                    ) : null}
                    {csvImportStatus === "completed" ||
                    csvImportStatus === "failed" ||
                    csvImportStatus === "cancelled" ? (
                      <button
                        type="button"
                        className="download-sample-btn"
                        onClick={removeFile}
                      >
                        Clear Import
                      </button>
                    ) : null}
                  </div>

                  {showCsvImportDetails ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(15, 23, 42, 0.22)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong>Import details</strong>
                        <span style={{ fontSize: 13, opacity: 0.92 }}>
                          {csvImportJob?.id
                            ? `Tracking background job ${csvImportJob.id}`
                            : "Tracking the current CSV import job."}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Status
                          </div>
                          <div>{csvImportStatus}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            File
                          </div>
                          <div>{csvFile?.name || "Unknown"}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Processed
                          </div>
                          <div>{csvImportProcessed.toLocaleString()} rows</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Total
                          </div>
                          <div>{csvImportTotal.toLocaleString()} rows</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Started
                          </div>
                          <div>
                            {formatJobTime(
                              csvImportJob?.createdAt ||
                                csvImportJob?.startedAt,
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.75 }}>
                            Updated
                          </div>
                          <div>
                            {formatJobTime(
                              csvImportJob?.updatedAt ||
                                csvImportJob?.lastUpdatedAt,
                            )}
                          </div>
                        </div>
                      </div>

                      {csvImportStatus === "failed" ? (
                        <div
                          style={{
                            color: "#fecaca",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          {csvImportError ||
                            "The import failed. Clear the import and try again with a corrected CSV."}
                        </div>
                      ) : null}

                      {csvImportStatus === "cancelled" ? (
                        <div
                          style={{
                            color: "#fde68a",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          The upload was cancelled. You can clear the file or
                          try a new CSV.
                        </div>
                      ) : null}

                      {csvImportStatus === "completed" ? (
                        <div
                          style={{
                            color: "#bbf7d0",
                            fontSize: 13,
                            lineHeight: 1.5,
                          }}
                        >
                          The audience is ready. You can now send the broadcast
                          using the completed import job.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })()}

          <div
            style={{
              marginBottom: 12,
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.55)",
              border: "1px solid rgba(148, 163, 184, 0.16)",
              boxShadow: "0 18px 50px rgba(2, 6, 23, 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <strong style={{ display: "block" }}>Recent CSV Imports</strong>
                <span style={{ fontSize: 13, opacity: 0.82 }}>
                  Reuse a previous audience without uploading the file again.
                </span>
              </div>
              <button
                type="button"
                className="download-sample-btn"
                onClick={() => void loadCsvImportHistory()}
                disabled={recentCsvImportsLoading}
              >
                {recentCsvImportsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <input
                type="search"
                value={csvImportHistoryQuery}
                onChange={(e) => setCsvImportHistoryQuery(e.target.value)}
                placeholder="Search by file name or job id"
                className="form-input"
                style={{ minWidth: 240, flex: "1 1 240px" }}
              />
              <select
                value={csvImportHistoryStatusFilter}
                onChange={(e) =>
                  setCsvImportHistoryStatusFilter(e.target.value)
                }
                className="form-input"
                style={{ minWidth: 180, flex: "0 0 180px" }}
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {recentCsvImportsError ? (
              <p style={{ margin: "0 0 12px", color: "#fecaca", fontSize: 13 }}>
                {recentCsvImportsError}
              </p>
            ) : null}

            {recentCsvImportJobsFiltered.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {recentCsvImportJobsFiltered.map((job) => {
                  const jobId = String(job?.id || job?._id || "").trim();
                  const isActive = jobId && csvImportJob?.id === jobId;
                  const jobLabel = String(
                    job?.originalFileName ||
                      job?.storedFileName ||
                      "CSV import",
                  ).trim();
                  const jobStatus = String(job?.status || "queued").trim();
                  const isReusable = jobStatus === "completed";
                  const processedRows = Number(job?.processedRows || 0);
                  const totalRows = Number(job?.totalRows || 0);
                  const jobPercent = Number(job?.percentComplete || 0);
                  const updatedAt = formatJobTime(
                    job?.updatedAt ||
                      job?.lastProgressAt ||
                      job?.completedAt ||
                      job?.createdAt,
                  );

                  return (
                    <div
                      key={jobId}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: isActive
                          ? "rgba(59, 130, 246, 0.16)"
                          : "rgba(255,255,255,0.04)",
                        border: isActive
                          ? "1px solid rgba(96, 165, 250, 0.45)"
                          : "1px solid rgba(255,255,255,0.08)",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              wordBreak: "break-word",
                            }}
                          >
                            {jobLabel}
                          </strong>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>
                            {jobId || "Unknown job id"} · {jobStatus}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="download-sample-btn"
                          onClick={() => {
                            if (isReusable) {
                              applyCsvImportHistorySelection(job);
                              return;
                            }

                            setShowCsvImportDetails(true);
                            setCsvImportJob({
                              id: jobId,
                              status: jobStatus,
                              originalFileName: String(
                                job?.originalFileName ||
                                  job?.storedFileName ||
                                  "",
                              ).trim(),
                              totalRows: Number(job?.totalRows || 0),
                              processedRows: Number(job?.processedRows || 0),
                              errorMessage: String(
                                job?.errorMessage || "",
                              ).trim(),
                              createdAt: job?.createdAt || null,
                              updatedAt: job?.updatedAt || null,
                              lastUpdatedAt: job?.lastUpdatedAt || null,
                            });
                            setCsvImportStatus(jobStatus);
                            setCsvImportError(
                              String(job?.errorMessage || "").trim(),
                            );
                            setCsvImportProgress(
                              Number(job?.percentComplete || 0),
                            );
                            setCsvImportProcessed(
                              Number(job?.processedRows || 0),
                            );
                            setCsvImportTotal(Number(job?.totalRows || 0));
                            setCsvImportEtaMs(
                              Number.isFinite(Number(job?.etaMs))
                                ? Number(job.etaMs)
                                : null,
                            );
                            setAudienceSourceLabel(
                              String(
                                job?.originalFileName ||
                                  job?.storedFileName ||
                                  "CSV import history",
                              ).trim(),
                            );
                          }}
                        >
                          {isActive
                            ? "Selected"
                            : isReusable
                              ? "Use Audience"
                              : "View Details"}
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          fontSize: 13,
                          opacity: 0.92,
                        }}
                      >
                        <span>{processedRows.toLocaleString()} processed</span>
                        <span>{totalRows.toLocaleString()} total</span>
                        <span>{jobPercent.toLocaleString()}%</span>
                        <span>Updated {updatedAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : recentCsvImportsLoading ? (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                Loading recent imports...
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                No recent CSV imports yet.
              </p>
            )}
          </div>

          {audienceSourceLabel && (
            <p className="form-help">Audience source: {audienceSourceLabel}</p>
          )}

          {csvPreview.length > 0 && (
            <div className="csv-preview">
              <h4>
                CSV Data Table (
                {csvPreview.length > 0 ? csvPreview.length - 1 : 0} rows)
              </h4>
              <div className="csv-table-container">
                <table className="csv-data-table">
                  <thead>
                    <tr>
                      {csvPreview.length > 0 &&
                        csvPreview[0]
                          .split(",")
                          .map((header, index) => (
                            <th key={index}>{header.trim()}</th>
                          ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.slice(1).map((line, rowIndex) => (
                      <tr key={rowIndex}>
                        {line.split(",").map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell.trim()}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            loading ||
            csvParseStatus === "parsing" ||
            isCsvImportBusy ||
            (csvImportStatus !== "completed" && Boolean(csvFile))
          }
          className="submit-btn"
        >
          {loading ? (
            <>
              <div className="spinner"></div>
              <span>Sending Messages...</span>
            </>
          ) : csvParseStatus === "parsing" ? (
            <>
              <div className="spinner"></div>
              <span>Parsing CSV...</span>
            </>
          ) : (
            <>
              <Send className="send-icon" />
              <span>Send Bulk Messages</span>
            </>
          )}
        </button>
      </form>

      {/* Results */}
      {results && (
        <CampaignResults
          results={results}
          broadcastId={results.broadcastId}
          onRetry={handleRetryFailed}
        />
      )}

      <ContactAudiencePickerModal
        open={showContactAudiencePicker}
        onClose={closeContactAudiencePicker}
        onConfirm={applyContactAudienceSelection}
        initialSelectedContacts={recipients}
      />
    </div>
  );
};

export default BulkMessaging;
