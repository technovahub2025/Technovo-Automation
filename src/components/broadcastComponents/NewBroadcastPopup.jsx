import React from "react";
import {
  ChevronDown,
  X,
  Upload,
  Calendar,
  Send,
  Clock,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Users,
  Download,
  UserPlus,
} from "lucide-react";
import MessagePreview from "./MessagePreview";
import { downloadCsv } from "../../utils/csvExport";
import "./Modal.css";

const NewBroadcastPopup = ({
  showNewBroadcastPopup,
  broadcastName,
  onBroadcastNameChange,
  messageType,
  templateName,
  onTemplateNameChange,
  officialTemplates,
  uploadedFile,
  recipients,
  fileVariables = [],
  onFileUpload,
  onClearUpload,
  templateHeaderMediaUrl,
  templateHeaderMediaUploading = false,
  templateHeaderMediaError = "",
  onTemplateHeaderMediaUpload,
  onClearTemplateHeaderMedia,
  csvUploadState = {
    phase: "idle",
    message: "",
    percent: 0,
  },
  onOpenContactAudiencePicker,
  onOpenGroupAudiencePicker,
  onOpenCampaignExtraContactsPicker,
  onOpenCampaignAudiencePicker,
  onClearSelectedAudience,
  audienceSourceMode = "contacts",
  onAudienceSourceModeChange,
  audienceSourceLabel = "",
  selectedCampaignAudienceLabel = "",
  selectedCampaignAudienceCount = 0,
  scheduledTime,
  onScheduledTimeChange,
  isSending,
  onSendBroadcast,
  onCreateBroadcast,
  onClose,
  onBackToChoice,
  getCurrentTime,
  quietHoursEnabled,
  onQuietHoursEnabledChange,
  quietHoursStartHour,
  onQuietHoursStartHourChange,
  quietHoursEndHour,
  onQuietHoursEndHourChange,
  quietHoursTimezone,
  onQuietHoursTimezoneChange,
  quietHoursAction,
  onQuietHoursActionChange,
  retryPolicyEnabled,
  onRetryPolicyEnabledChange,
  retryMaxAttempts,
  onRetryMaxAttemptsChange,
  retryBackoffSeconds,
  onRetryBackoffSecondsChange,
  deliveryBatchSize = 50,
  onDeliveryBatchSizeChange = () => {},
  deliveryBatchDelaySeconds = 5,
  onDeliveryBatchDelaySecondsChange = () => {},
  respectOptOut,
  onRespectOptOutChange,
  suppressionListRaw,
  onSuppressionListRawChange,
}) => {
  const [isTemplateHeaderDragOver, setIsTemplateHeaderDragOver] =
    React.useState(false);
  const [showAddRecipientMenu, setShowAddRecipientMenu] =
    React.useState(false);
  const addRecipientMenuRef = React.useRef(null);
  const selectedTemplate =
    (officialTemplates || []).find(
      (template) => template.name === templateName,
    ) || null;
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
  const templateHeaderUploadInputId = "new-broadcast-template-header-upload";
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
        (component) => String(component?.type || "").toUpperCase() === "BODY",
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

  const downloadSampleCsv = () => {
    const variableCount =
      messageType === "template"
        ? getTemplateVariableCount(selectedTemplate)
        : 0;
    const headers = ["phone"];
    for (let i = 1; i <= variableCount; i += 1) {
      headers.push(`var${i}`);
    }

    const emptyRow = headers.map(() => "");
    downloadCsv({
      filename: "broadcast_contacts_sample.csv",
      headers,
      rows: [emptyRow, emptyRow],
      exportType: "broadcast_contacts_sample",
    });
  };

  const selectedTemplateVariableCount =
    messageType === "template" ? getTemplateVariableCount(selectedTemplate) : 0;
  const missingTemplateVariables = Boolean(
    uploadedFile &&
    messageType === "template" &&
    selectedTemplate &&
    selectedTemplateVariableCount > 0 &&
    fileVariables.length === 0,
  );

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

  const triggerCsvPicker = () => {
    const input = document.getElementById("csv-file-popup");
    if (input) input.click();
  };

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

  const handleToggleAddRecipientMenu = () => {
    setShowAddRecipientMenu((current) => !current);
  };

  const handleAddRecipientMenuAction = (action) => {
    if (action === "contacts") {
      triggerAudienceSelection();
    } else if (action === "groups") {
      onOpenGroupAudiencePicker?.();
    } else if (action === "campaign") {
      onOpenCampaignAudiencePicker?.();
    } else if (action === "csv") {
      triggerCsvPicker();
    } else if (action === "clear") {
      onClearSelectedAudience?.();
    }

    setShowAddRecipientMenu(false);
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

  const audienceCountLabel =
    audienceSourceMode === "campaign"
      ? `${Number(selectedCampaignAudienceCount || 0).toLocaleString()} contacts selected`
      : recipients.length > 0
        ? audienceSourceLabel
          ? `${recipients.length} contacts selected`
          : `${recipients.length} recipients loaded`
        : "";

  if (!showNewBroadcastPopup) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-container new-broadcast-popup">
        <div className="popup-header">
          <div className="popup-title">
            <button
              className="back-btn"
              onClick={onBackToChoice}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "4px",
                marginRight: "8px",
              }}
            >
              <ArrowLeft size={24} />
            </button>
            <span>Create New Broadcast</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="popup-content">
          <div className="form-group">
            <label>Campaign Name *</label>
            <input
              type="text"
              value={broadcastName}
              onChange={onBroadcastNameChange}
              placeholder="Enter campaign name"
              className="form-input"
            />
          </div>

          {messageType === "template" && (
            <div className="form-group">
              <label>Template *</label>
              <select
                value={templateName}
                onChange={onTemplateNameChange}
                className="form-input"
              >
                <option value="">Select a template</option>
                {officialTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name} ({template.category}) - {template.status}
                  </option>
                ))}
              </select>
              {selectedTemplate ? (
                <>
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
                        : "This template does not use an image header."}
                    </span>
                  </div>
                  {selectedTemplateHasImageHeader ? (
                    <div
                      className={`template-media-upload-box template-media-upload-box--compact${isTemplateHeaderDragOver ? " is-drag-over" : ""}`}
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
                </>
              ) : null}
            </div>
          )}

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
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
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
                    zIndex: 50,
                    minWidth: 240,
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
          <p className="audience-source-helper">
            {audienceSourceMode === "contacts"
              ? "Audience source: CRM contacts"
                : audienceSourceMode === "campaign"
                  ? "Audience source: previous campaign"
                  : "Audience source: CSV upload"}
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              {audienceSourceMode === "contacts" ? (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={triggerAudienceSelection}
                    >
                      <Users size={16} />
                      Select from Contacts
                    </button>
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="clear-upload-btn"
                        onClick={onClearSelectedAudience}
                      >
                        Clear Selected Contacts
                      </button>
                    ) : null}
                  </div>

                  <div
                    className={`file-upload-area ${csvUploadPhase !== "idle" ? `is-${csvUploadPhase}` : ""}`}
                    onClick={
                      isCsvUploadBusy ? undefined : triggerAudienceSelection
                    }
                    style={{ cursor: isCsvUploadBusy ? "progress" : "pointer" }}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={onFileUpload}
                      id="csv-file-popup"
                      style={{ display: "none" }}
                      disabled={isCsvUploadBusy}
                    />
                    <label
                      htmlFor="csv-file-popup"
                      className="file-upload-label"
                      style={{ pointerEvents: "none" }}
                    >
                      <Upload size={20} />
                      <span>
                        {uploadedFile
                          ? uploadedFile.name
                          : "Select contacts from CRM"}
                      </span>
                    </label>
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

                  {csvUploadPhase !== "idle" ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background:
                          csvUploadPhase === "failed"
                            ? "#fef2f2"
                            : csvUploadPhase === "completed"
                              ? "#f0fdf4"
                              : "#eff6ff",
                        border: `1px solid ${
                          csvUploadPhase === "failed"
                            ? "#fecaca"
                            : csvUploadPhase === "completed"
                              ? "#bbf7d0"
                              : "#bfdbfe"
                        }`,
                        color:
                          csvUploadPhase === "failed"
                            ? "#b91c1c"
                            : csvUploadPhase === "completed"
                              ? "#166534"
                              : "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {csvUploadMessage || "Processing CSV..."}
                      {csvUploadPhase !== "completed" &&
                      csvUploadPhase !== "failed"
                        ? ` ${csvUploadPercent}%`
                        : ""}
                    </div>
                  ) : null}
                </>
              ) : audienceSourceMode === "campaign" ? (
                <>
                  <div className="campaign-audience-summary-card">
                    <div className="campaign-audience-summary-card__label">
                      Selected campaign
                    </div>
                    <div className="campaign-audience-summary-card__title">
                      {selectedCampaignAudienceLabel ||
                        "Choose a completed campaign"}
                    </div>
                    <div className="campaign-audience-summary-card__meta">
                      {audienceCountLabel ||
                        "Campaign audience will load instantly and can be edited."}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={triggerAudienceSelection}
                    >
                      <Calendar size={16} />
                      {selectedCampaignAudienceLabel
                        ? "Change Campaign"
                        : "Select from Campaign"}
                    </button>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={() =>
                        typeof onOpenCampaignExtraContactsPicker ===
                          "function" && onOpenCampaignExtraContactsPicker()
                      }
                    >
                      <Users size={16} />
                      Add CRM Contacts
                    </button>
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="clear-upload-btn"
                        onClick={onClearSelectedAudience}
                      >
                        Clear Selected Campaign
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  {csvUploadPhase !== "idle" ? (
                    <div
                      className={`csv-upload-status-card is-${csvUploadPhase}`}
                    >
                      <div className="csv-upload-status-card__icon">
                        <Upload size={18} />
                      </div>
                      <div className="csv-upload-status-card__body">
                        <div className="csv-upload-status-card__header">
                          <strong>
                            {csvUploadMessage || "Processing CSV..."}
                          </strong>
                          <span>{csvUploadPercent}%</span>
                        </div>
                        <p>
                          {csvUploadPhase === "parsing"
                            ? "Reading the file in the background."
                            : csvUploadPhase === "validating"
                              ? "Checking phone numbers and rows."
                              : csvUploadPhase === "processing"
                                ? "Preparing contacts for broadcast."
                                : csvUploadPhase === "completed"
                                  ? "CSV upload completed successfully."
                                  : csvUploadPhase === "failed"
                                    ? "CSV upload failed. Please try again."
                                    : "Working on the CSV upload."}
                        </p>
                        <div className="csv-upload-status-card__progress">
                          <span style={{ width: `${csvUploadPercent}%` }} />
                        </div>
                        <small>
                          {csvUploadPhase === "completed"
                            ? "You can continue editing or send the broadcast now."
                            : csvUploadPhase === "failed"
                              ? "Please replace the file or retry after fixing the CSV."
                              : "Keep this tab open while the file is processed."}
                        </small>
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="replace-upload-btn"
                      onClick={triggerAudienceSelection}
                    >
                      <Users size={16} />
                      Select from Contacts
                    </button>
                    {typeof onClearSelectedAudience === "function" ? (
                      <button
                        type="button"
                        className="clear-upload-btn"
                        onClick={onClearSelectedAudience}
                      >
                        Clear Selected Contacts
                      </button>
                    ) : null}
                  </div>

                  <div
                    className={`file-upload-area ${csvUploadPhase !== "idle" ? `is-${csvUploadPhase}` : ""}`}
                    onClick={isCsvUploadBusy ? undefined : triggerCsvPicker}
                    style={{ cursor: isCsvUploadBusy ? "progress" : "pointer" }}
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={onFileUpload}
                      id="csv-file-popup"
                      style={{ display: "none" }}
                      disabled={isCsvUploadBusy}
                    />
                    <label
                      htmlFor="csv-file-popup"
                      className="file-upload-label"
                      style={{ pointerEvents: "none" }}
                    >
                      <Upload size={20} />
                      <span>
                        {uploadedFile
                          ? uploadedFile.name
                          : "Upload CSV contacts"}
                      </span>
                    </label>
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

                  {csvUploadPhase !== "idle" ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background:
                          csvUploadPhase === "failed"
                            ? "#fef2f2"
                            : csvUploadPhase === "completed"
                              ? "#f0fdf4"
                              : "#eff6ff",
                        border: `1px solid ${
                          csvUploadPhase === "failed"
                            ? "#fecaca"
                            : csvUploadPhase === "completed"
                              ? "#bbf7d0"
                              : "#bfdbfe"
                        }`,
                        color:
                          csvUploadPhase === "failed"
                            ? "#b91c1c"
                            : csvUploadPhase === "completed"
                              ? "#166534"
                              : "#1d4ed8",
                        fontSize: 12,
                        fontWeight: 600,
                        lineHeight: 1.5,
                      }}
                    >
                      {csvUploadMessage || "Processing CSV..."}
                      {csvUploadPhase !== "completed" &&
                      csvUploadPhase !== "failed"
                        ? ` ${csvUploadPercent}%`
                        : ""}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="replace-upload-btn"
                    onClick={downloadSampleCsv}
                  >
                    <Download size={16} />
                    Download Sample CSV
                  </button>
                </>
              )}
            </div>

            {uploadedFile && fileVariables.length > 0 ? (
              <div className="variable-file-info">
                Variables detected: {fileVariables.join(", ")}
              </div>
            ) : null}

            {missingTemplateVariables ? (
              <div className="submit-block-warning" style={{ marginTop: 12 }}>
                <strong>CSV needs template variables:</strong> this template
                requires {selectedTemplateVariableCount} variable column(s) like{" "}
                <code>var1</code>, <code>var2</code>. Your CSV does not include
                them yet.
              </div>
            ) : null}

            {uploadedFile && (
              <div className="file-action-buttons">
                <button
                  type="button"
                  className="replace-upload-btn"
                  disabled={isCsvUploadBusy}
                  onClick={() => {
                    const fileInput = document.getElementById("csv-file-popup");
                    if (fileInput && !isCsvUploadBusy) {
                      fileInput.value = "";
                      fileInput.click();
                    }
                  }}
                >
                  <RefreshCw size={16} />
                  Replace
                </button>
                <button
                  type="button"
                  className="clear-upload-btn"
                  disabled={isCsvUploadBusy}
                  onClick={onClearUpload}
                >
                  <Trash2 size={16} />
                  Clear Upload
                </button>
              </div>
            )}

            {audienceSourceMode === "campaign" ? (
              <p className="recipients-count">
                {selectedCampaignAudienceLabel
                  ? `${Number(selectedCampaignAudienceCount || 0).toLocaleString()} contacts selected from campaign`
                  : "Select a campaign to reuse its audience"}
              </p>
            ) : (
              recipients.length > 0 && (
                <p className="recipients-count">
                  {audienceSourceLabel
                    ? `${recipients.length} contacts selected`
                    : `${recipients.length} recipients loaded`}
                </p>
              )
            )}

            {audienceSourceLabel ? (
              <p className="recipients-count">
                Audience source: {audienceSourceLabel}
              </p>
            ) : null}
          </div>

          <div className="form-group policy-section">
            <label>Delivery & Compliance</label>

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={quietHoursEnabled}
                  onChange={(event) =>
                    onQuietHoursEnabledChange(event.target.checked)
                  }
                />
                <span>Enable quiet hours</span>
              </label>
            </div>

            {quietHoursEnabled && (
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
                    className="form-input"
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
                    className="form-input"
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
                    className="form-input"
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
                    className="form-input"
                  >
                    <option value="defer">Defer send</option>
                    <option value="skip">Skip send</option>
                  </select>
                </div>
              </div>
            )}

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={retryPolicyEnabled}
                  onChange={(event) =>
                    onRetryPolicyEnabledChange(event.target.checked)
                  }
                />
                <span>Enable retry policy</span>
              </label>
            </div>

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
                  className="form-input"
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
                  className="form-input"
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
                className="form-input"
              />
              <small>
                How many recipients to process before moving to the next batch.
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
                className="form-input"
              />
              <small>
                How long the backend waits before sending the next batch.
              </small>
            </div>

            <div className="policy-toggle">
              <label className="policy-checkbox">
                <input
                  type="checkbox"
                  checked={respectOptOut}
                  onChange={(event) =>
                    onRespectOptOutChange(event.target.checked)
                  }
                />
                <span>Respect opted-out recipients</span>
              </label>
            </div>

            <div className="policy-field">
              <span>Suppression list (comma/newline separated)</span>
              <textarea
                value={suppressionListRaw}
                onChange={(event) =>
                  onSuppressionListRawChange(event.target.value)
                }
                className="form-textarea policy-textarea"
                rows="3"
                placeholder="+919999999999, +919888888888"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Schedule (Optional)</label>
            <div className="schedule-input-group">
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={onScheduledTimeChange}
                className="form-input schedule-input-external"
                min={getCurrentTime()}
              />
              {scheduledTime && (
                <button
                  type="button"
                  className="clear-date-btn-external"
                  onClick={() => onScheduledTimeChange("")}
                  title="Clear schedule"
                >
                  <X size={16} />
                  Clear
                </button>
              )}
            </div>
            <p className={`schedule-hint ${scheduledTime ? "scheduled" : ""}`}>
              {scheduledTime
                ? `Scheduled for ${new Date(scheduledTime).toLocaleString()}`
                : "Send immediately"}
            </p>
          </div>
        </div>

        <div className="popup-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              console.log("🔍 Button clicked");
              console.log("🔍 scheduledTime:", scheduledTime);
              console.log("🔍 isSending:", isSending);
              console.log("🔍 broadcastName:", broadcastName);
              console.log("🔍 recipients.length:", recipients.length);

              if (scheduledTime) {
                console.log("🔍 Calling onCreateBroadcast");
                onCreateBroadcast();
              } else {
                console.log("🔍 Calling onSendBroadcast");
                onSendBroadcast();
              }
            }}
            disabled={isSending || !broadcastName || recipients.length === 0}
          >
            {isSending ? (
              <>
                <div className="spinner"></div>
                Sending...
              </>
            ) : scheduledTime ? (
              "Schedule Broadcast"
            ) : (
              "Send Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewBroadcastPopup;
