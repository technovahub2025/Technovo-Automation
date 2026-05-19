import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  TrendingUp,
  Users,
  MessageCircle,
  CheckCircle,
  Eye,
  AlertCircle,
  RefreshCw,
  Upload,
} from "lucide-react";
import "./AudienceBadge.css";
import "./BroadcastAnalyticsModal.css";
import { apiClient } from "../../services/whatsappapi";

const FAILURE_CODE_LABELS = {
  131016: "Template parameter issue",
  131048: "Template or media rejected",
  131049: "Recipient not eligible right now",
  131056: "Temporary WhatsApp delivery issue",
  63018: "Rate limited by provider",
};

const normalizeText = (value) => String(value || "").trim();

const getFailureCodeLabel = (code) => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) return "Unknown provider code";
  return (
    FAILURE_CODE_LABELS[normalizedCode] || `Provider error ${normalizedCode}`
  );
};

const getFailureReasonLabel = (item = {}) => {
  const failureCode = normalizeText(item?.lastFailureCode);
  if (failureCode) {
    return getFailureCodeLabel(failureCode);
  }

  const rawReason = normalizeText(item?.lastFailureReason);
  if (!rawReason) return "";

  const normalized = rawReason.toLowerCase();
  if (
    normalized.includes("opted out") ||
    normalized.includes("suppression") ||
    normalized.includes("compliance")
  ) {
    return "Compliance / opt-out";
  }
  if (normalized.includes("contact record")) {
    return "Contact record missing";
  }
  if (
    normalized.includes("template") &&
    (normalized.includes("missing") ||
      normalized.includes("header") ||
      normalized.includes("variable"))
  ) {
    return "Template validation issue";
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("temporar") ||
    normalized.includes("timeout")
  ) {
    return "Temporary delivery issue";
  }
  if (normalized.includes("media")) {
    return "Media upload issue";
  }
  if (normalized.includes("window")) {
    return "Messaging window / policy issue";
  }
  return rawReason.length > 64 ? `${rawReason.slice(0, 61)}...` : rawReason;
};

const getFailureReasonDetail = (item = {}) => {
  const reason = normalizeText(item?.lastFailureReason);
  const code = normalizeText(item?.lastFailureCode);
  if (code && reason) return `${getFailureCodeLabel(code)} - ${reason}`;
  if (code) return getFailureCodeLabel(code);
  return reason || "";
};

const BroadcastAnalyticsModal = ({ isOpen, onClose, broadcast }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [recipientDetails, setRecipientDetails] = useState([]);
  const [isRecipientLoading, setIsRecipientLoading] = useState(false);
  const [broadcastDetails, setBroadcastDetails] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairMessage, setRepairMessage] = useState("");
  const repairHeaderInputRef = useRef(null);
  const safeBroadcast = broadcast || {};
  const mergedBroadcast = broadcastDetails || safeBroadcast;
  const stats = mergedBroadcast.stats || {};
  const totalRecipients =
    mergedBroadcast.recipientCount || mergedBroadcast.recipients?.length || 0;
  const statusBreakdown = mergedBroadcast.statusBreakdown || {};
  const retrySummary = mergedBroadcast.retrySummary || {};
  const reliabilityAnalytics = retrySummary.analytics || {};
  const retryPolicy = retrySummary.retryPolicy || {};
  const deliveryPolicy = retrySummary.deliveryPolicy || {};
  const compliancePolicy = retrySummary.compliancePolicy || {};
  const quietHours = deliveryPolicy.quietHours || {};
  const failureCodeBreakdown = reliabilityAnalytics.failureCodeBreakdown || {};
  const audienceSource = mergedBroadcast.audienceSource || {};
  const audienceSnapshot = mergedBroadcast.audienceSnapshot || {};
  const audienceMode = String(
    audienceSource?.type || audienceSnapshot?.sourceType || "",
  )
    .trim()
    .toLowerCase();
  const audienceLabel = (() => {
    const explicitLabel = String(
      audienceSource?.label || audienceSnapshot?.label || "",
    ).trim();
    if (explicitLabel) return explicitLabel;
    const segmentName = String(
      audienceSnapshot?.segmentName || audienceSource?.segmentName || "",
    ).trim();
    if (segmentName) return `Saved segment: ${segmentName}`;
    if (audienceMode === "csv") return "CSV upload";
    if (audienceMode === "saved_segment") return "Saved segment";
    if (audienceMode === "contacts") return "CRM contacts";
    if (audienceMode === "manual") return "Manual audience";
    return "";
  })();
  const audienceChipLabel = (() => {
    if (audienceMode === "csv") return "CSV";
    if (audienceMode === "saved_segment") return "Segment";
    if (audienceMode === "contacts") return "Contacts";
    if (audienceMode === "manual") return "Manual";
    return "Audience";
  })();
  const audienceChipClass = audienceMode || "unknown";
  const failureCodeRows = Object.entries(failureCodeBreakdown)
    .map(([code, count]) => ({ code, count: Number(count || 0) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const failureReasonBreakdown = recipientDetails.reduce(
    (accumulator, item) => {
      if (
        !item?.failed &&
        !normalizeText(item?.lastFailureReason) &&
        !normalizeText(item?.lastFailureCode)
      ) {
        return accumulator;
      }
      const key = getFailureReasonLabel(item);
      if (!key) return accumulator;
      accumulator[key] = Number(accumulator[key] || 0) + 1;
      return accumulator;
    },
    {},
  );
  const failureReasonRows = Object.entries(failureReasonBreakdown)
    .map(([reason, count]) => ({ reason, count: Number(count || 0) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  const topFailureReason = failureReasonRows[0] || null;
  const topFailureReasonText = String(
    topFailureReason?.reason || "",
  ).toLowerCase();
  const missingHeaderMedia =
    String(mergedBroadcast.mediaType || "").toLowerCase() === "image" &&
    !String(mergedBroadcast.mediaUrl || "").trim();
  const canRepairHeader =
    Boolean(mergedBroadcast?.templateName) &&
    ["failed", "completed_with_errors"].includes(
      String(mergedBroadcast?.status || "").toLowerCase(),
    );
  const showsHeaderRepairHint =
    missingHeaderMedia ||
    topFailureReasonText.includes("image header") ||
    topFailureReasonText.includes("header media url");

  // Calculate percentages
  const deliveryRate =
    totalRecipients > 0
      ? Math.round((stats.delivered / totalRecipients) * 100)
      : 0;
  const readRate =
    totalRecipients > 0 ? Math.round((stats.read / totalRecipients) * 100) : 0;
  const replyRate =
    totalRecipients > 0
      ? Math.round((stats.replied / totalRecipients) * 100)
      : 0;
  const failureRate =
    totalRecipients > 0
      ? Math.round((stats.failed / totalRecipients) * 100)
      : 0;

  // Pie chart data
  const pieData = [
    { label: "Delivered", value: stats.delivered, color: "#10b981" },
    { label: "Read", value: stats.read, color: "#3b82f6" },
    { label: "Failed", value: stats.failed, color: "#ef4444" },
    {
      label: "Pending",
      value: totalRecipients - stats.delivered - stats.failed,
      color: "#6b7280",
    },
  ].filter((item) => item.value > 0);

  // Bar chart data
  const barData = [
    { label: "Sent", value: stats.sent, color: "#8b5cf6" },
    { label: "Delivered", value: stats.delivered, color: "#10b981" },
    { label: "Read", value: stats.read, color: "#3b82f6" },
    { label: "Replied", value: stats.replied, color: "#f59e0b" },
    { label: "Failed", value: stats.failed, color: "#ef4444" },
  ];

  const mapRecipientsToRows = (items = []) =>
    (Array.isArray(items) ? items : [])
      .map((recipient) => {
        const phone = recipient?.phone || recipient;
        if (!phone) return null;
        return {
          phone,
          name: recipient?.name || "",
          sent: false,
          delivered: false,
          read: false,
          failed: false,
          replied: false,
          replyCount: 0,
          status: "pending",
          lastStatusAt: null,
          lastReplyAt: null,
        };
      })
      .filter(Boolean);

  const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

  const buildNameMap = useCallback((items = []) => {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((recipient) => {
      const rawPhone = recipient?.phone || recipient;
      const key = normalizePhone(rawPhone);
      const name = String(recipient?.name || "").trim();
      if (key && name) {
        map.set(key, name);
      }
    });
    return map;
  }, []);

  const applyRecipientNames = useCallback(
    (rows = [], nameMap = new Map()) =>
      (Array.isArray(rows) ? rows : []).map((row) => {
        const currentName = String(row?.name || "").trim();
        if (currentName) return row;
        const mappedName = nameMap.get(normalizePhone(row?.phone));
        return {
          ...row,
          name: mappedName || "",
        };
      }),
    [],
  );

  const loadRecipientDetails = useCallback(async () => {
    if (!isOpen || !safeBroadcast?._id) {
      setBroadcastDetails(null);
      setRetryMessage("");
      return;
    }
    setIsRecipientLoading(true);
    try {
      const broadcastResult = await apiClient.getBroadcast(safeBroadcast._id);

      const response = broadcastResult || null;

      const payload = response?.data?.data || response?.data || {};
      setBroadcastDetails(payload);
      const apiRows = Array.isArray(payload?.recipientDetails)
        ? payload.recipientDetails
        : [];
      const fallbackRows = mapRecipientsToRows(payload?.recipients);
      const localFallbackRows = mapRecipientsToRows(safeBroadcast?.recipients);
      const mergedNameMap = new Map([
        ...buildNameMap(payload?.recipients),
        ...buildNameMap(safeBroadcast?.recipients),
      ]);
      const rows = apiRows.length
        ? apiRows
        : fallbackRows.length
          ? fallbackRows
          : localFallbackRows;
      setRecipientDetails(applyRecipientNames(rows, mergedNameMap));
    } catch (error) {
      console.error("Failed to load recipient details:", error);
      const fallbackRows = mapRecipientsToRows(safeBroadcast?.recipients);
      setRecipientDetails(
        applyRecipientNames(
          fallbackRows,
          buildNameMap(safeBroadcast?.recipients),
        ),
      );
    } finally {
      setIsRecipientLoading(false);
    }
  }, [
    isOpen,
    safeBroadcast?._id,
    safeBroadcast?.recipients,
    applyRecipientNames,
    buildNameMap,
  ]);

  useEffect(() => {
    loadRecipientDetails();
  }, [loadRecipientDetails]);

  const handleRetryFailedRecipients = async () => {
    if (!safeBroadcast?._id) return;
    setRetryLoading(true);
    setRetryMessage("");

    try {
      const response = await apiClient.retryFailedBroadcastRecipients(
        safeBroadcast._id,
      );
      const payload = response?.data?.data || response?.data || {};
      const retriedCount = Number(payload?.retriedRecipients || 0);
      setRetryMessage(
        retriedCount > 0
          ? `Retry started for ${retriedCount} recipients.`
          : "Retry request completed.",
      );
      await loadRecipientDetails();
      setActiveTab("recipients");
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.message || "Retry failed";
      setRetryMessage(message);
    } finally {
      setRetryLoading(false);
    }
  };

  const handleRepairHeaderClick = () => {
    if (!repairHeaderInputRef.current) return;
    repairHeaderInputRef.current.value = "";
    repairHeaderInputRef.current.click();
  };

  const handleRepairHeaderUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !safeBroadcast?._id) return;

    setRepairLoading(true);
    setRepairMessage("");

    try {
      const uploadResult = await apiClient.uploadBroadcastTemplateMedia(file);
      const mediaUrl = String(
        uploadResult?.data?.data?.mediaUrl ||
          uploadResult?.data?.mediaUrl ||
          "",
      ).trim();
      if (!mediaUrl) {
        throw new Error("Failed to upload header image.");
      }

      const response = await apiClient.repairBroadcastTemplateHeaderAndRetry(
        safeBroadcast._id,
        {
          mediaUrl,
          mediaType: "image",
        },
      );
      const payload = response?.data?.data || response?.data || {};
      const retriedCount = Number(payload?.retriedRecipients || 0);
      setRepairMessage(
        retriedCount > 0
          ? `Header repaired and retry started for ${retriedCount} recipient${retriedCount === 1 ? "" : "s"}.`
          : "Header repaired successfully.",
      );
      await loadRecipientDetails();
      setActiveTab("recipients");
    } catch (error) {
      const message =
        error?.response?.data?.error || error?.message || "Repair failed";
      setRepairMessage(message);
    } finally {
      if (event?.target) {
        event.target.value = "";
      }
      setRepairLoading(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString();
  };

  const formatBoolean = (value) => (value ? "Enabled" : "Disabled");

  const formatQuietHours = () => {
    if (!quietHours?.enabled) return "Disabled";
    const startHour = Number(quietHours.startHour);
    const endHour = Number(quietHours.endHour);
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour))
      return "Enabled";
    return `${startHour}:00 - ${endHour}:00 (${quietHours.timezone || "UTC"})`;
  };

  if (!isOpen || !broadcast) return null;

  const renderPieChart = () => {
    const total = pieData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="no-data">No data available</div>;

    let currentAngle = -90; // Start from top

    return (
      <div className="pie-chart-container">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {pieData.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;

            const x1 = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
            const y1 = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);

            currentAngle += angle;

            const x2 = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
            const y2 = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);

            const largeArcFlag = angle > 180 ? 1 : 0;

            return (
              <g key={index}>
                <path
                  d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={
                    100 +
                    50 * Math.cos(((currentAngle - angle / 2) * Math.PI) / 180)
                  }
                  y={
                    100 +
                    50 * Math.sin(((currentAngle - angle / 2) * Math.PI) / 180)
                  }
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {percentage.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
        <div className="pie-legend">
          {pieData.map((item, index) => (
            <div key={index} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="legend-label">
                {item.label}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    const maxValue = Math.max(...barData.map((item) => item.value));
    if (maxValue === 0) return <div className="no-data">No data available</div>;

    return (
      <div className="bar-chart-container">
        <div className="bar-chart">
          {barData.map((item, index) => {
            const height = maxValue > 0 ? (item.value / maxValue) * 150 : 0;
            return (
              <div key={index} className="bar-wrapper">
                <div
                  className="bar"
                  style={{
                    height: `${height}px`,
                    backgroundColor: item.color,
                  }}
                >
                  <span className="bar-value">{item.value}</span>
                </div>
                <span className="bar-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="analytics-modal-overlay">
      <div className="analytics-modal">
        <div className="analytics-header">
          <h2>
            <TrendingUp size={20} />
            Campaign Analytics
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="campaign-info">
          <h3>{broadcast.name}</h3>
          <p>
            Status:{" "}
            <span className={`badge ${broadcast.status}`}>
              {broadcast.status}
            </span>
          </p>
          {audienceLabel ? (
            <p className="audience-source-line">
              Audience source:{" "}
              <span
                className={`audience-badge audience-badge--${audienceChipClass}`}
              >
                <span className="audience-badge__label">
                  {audienceChipLabel}
                </span>
                <span className="audience-badge__text">{audienceLabel}</span>
              </span>
            </p>
          ) : null}
          <p>Total Recipients: {totalRecipients}</p>
          <p>Retry Candidates: {Number(retrySummary.retryCandidates || 0)}</p>
          <p>Suppressed: {Number(reliabilityAnalytics.suppressed || 0)}</p>
          <p>Deferred: {Number(reliabilityAnalytics.deferred || 0)}</p>
          <p>Retried: {Number(reliabilityAnalytics.retried || 0)}</p>
          {broadcast.status === "completed_with_errors" ? (
            <p className="failure-summary-line">
              Completed with errors. {Number(stats.failed || 0)} recipient
              {Number(stats.failed || 0) === 1 ? "" : "s"} failed
              {topFailureReason
                ? ` - top reason: ${topFailureReason.reason}`
                : ""}
              .
            </p>
          ) : null}
          {broadcast.scheduledAt && (
            <p>Scheduled: {new Date(broadcast.scheduledAt).toLocaleString()}</p>
          )}
          <div className="retry-actions">
            <button
              type="button"
              className="retry-failed-btn"
              onClick={handleRetryFailedRecipients}
              disabled={retryLoading || !retrySummary.canRetry}
            >
              {retryLoading ? "Retrying..." : "Retry Failed Recipients"}
            </button>
            {canRepairHeader ? (
              <button
                type="button"
                className="repair-header-btn"
                onClick={handleRepairHeaderClick}
                disabled={repairLoading}
              >
                {repairLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Repairing...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Repair Header & Retry
                  </>
                )}
              </button>
            ) : null}
            {retryMessage ? (
              <small className="retry-message">{retryMessage}</small>
            ) : null}
            {repairMessage ? (
              <small className="retry-message">{repairMessage}</small>
            ) : null}
          </div>
          <input
            ref={repairHeaderInputRef}
            type="file"
            accept="image/*"
            className="hidden-file-input"
            onChange={handleRepairHeaderUpload}
          />
        </div>

        <div className="analytics-tabs">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === "charts" ? "active" : ""}`}
            onClick={() => setActiveTab("charts")}
          >
            Charts
          </button>
          <button
            className={`tab-btn ${activeTab === "details" ? "active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Details
          </button>
          <button
            className={`tab-btn ${activeTab === "recipients" ? "active" : ""}`}
            onClick={() => setActiveTab("recipients")}
          >
            Recipients
          </button>
        </div>

        <div className="analytics-content">
          {activeTab === "overview" && (
            <div className="overview-grid">
              <div className="metric-card">
                <div className="metric-icon sent">
                  <MessageCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.sent}</h4>
                  <p>Total Sent</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon delivered">
                  <CheckCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.delivered}</h4>
                  <p>Delivered ({deliveryRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon read">
                  <Eye size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.read}</h4>
                  <p>Read ({readRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon replied">
                  <Users size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.replied}</h4>
                  <p>Replied ({replyRate}%)</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon failed">
                  <AlertCircle size={24} />
                </div>
                <div className="metric-info">
                  <h4>{stats.failed}</h4>
                  <p>Failed ({failureRate}%)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "charts" && (
            <div className="charts-grid">
              <div className="chart-card">
                <h4>Delivery Status Distribution</h4>
                {renderPieChart()}
              </div>

              <div className="chart-card">
                <h4>Message Metrics Comparison</h4>
                {renderBarChart()}
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="details-grid">
              <div className="detail-card">
                <h4>Message Performance</h4>
                <div className="detail-row">
                  <span>Delivery Rate:</span>
                  <span>{deliveryRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Read Rate:</span>
                  <span>{readRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Reply Rate:</span>
                  <span>{replyRate}%</span>
                </div>
                <div className="detail-row">
                  <span>Failure Rate:</span>
                  <span>{failureRate}%</span>
                </div>
              </div>

              <div className="detail-card">
                <h4>Campaign Details</h4>
                <div className="detail-row">
                  <span>Message Type:</span>
                  <span>{broadcast.messageType || "N/A"}</span>
                </div>
                <div className="detail-row">
                  <span>Template:</span>
                  <span>{broadcast.templateName || "Custom Message"}</span>
                </div>
                <div className="detail-row">
                  <span>Audience Source:</span>
                  <span>{audienceLabel || "Unknown"}</span>
                </div>
                {String(audienceSnapshot?.segmentName || "").trim() ? (
                  <div className="detail-row">
                    <span>Segment:</span>
                    <span>{audienceSnapshot.segmentName}</span>
                  </div>
                ) : null}
                <div className="detail-row">
                  <span>Created:</span>
                  <span>{new Date(broadcast.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span>Last Updated:</span>
                  <span>{new Date(broadcast.updatedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="detail-card">
                <h4>Status Breakdown</h4>
                <div className="detail-row">
                  <span>Pending:</span>
                  <span>{Number(statusBreakdown.pending || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Sent:</span>
                  <span>{Number(statusBreakdown.sent || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Delivered:</span>
                  <span>{Number(statusBreakdown.delivered || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Read:</span>
                  <span>{Number(statusBreakdown.read || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Failed:</span>
                  <span>{Number(statusBreakdown.failed || 0)}</span>
                </div>
              </div>

              <div className="detail-card">
                <h4>Reliability Policy</h4>
                <div className="detail-row">
                  <span>Quiet Hours:</span>
                  <span>{formatQuietHours()}</span>
                </div>
                <div className="detail-row">
                  <span>Quiet Action:</span>
                  <span>
                    {String(quietHours.action || "defer").toUpperCase()}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Retry Policy:</span>
                  <span>{formatBoolean(retryPolicy.enabled)}</span>
                </div>
                <div className="detail-row">
                  <span>Max Attempts:</span>
                  <span>{Number(retryPolicy.maxAttempts || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Backoff (sec):</span>
                  <span>{Number(retryPolicy.backoffSeconds || 0)}</span>
                </div>
                <div className="detail-row">
                  <span>Respect Opt-out:</span>
                  <span>{formatBoolean(compliancePolicy.respectOptOut)}</span>
                </div>
                <div className="detail-row">
                  <span>Suppression List:</span>
                  <span>
                    {Number(compliancePolicy.suppressionListCount || 0)}
                  </span>
                </div>
              </div>

              <div className="detail-card">
                <h4>Failure Codes</h4>
                {showsHeaderRepairHint ? (
                  <div className="failure-alert">
                    This broadcast is missing the image header URL. Repair it
                    and retry with a fresh uploaded image.
                  </div>
                ) : null}
                {failureCodeRows.length ? (
                  <div className="failure-code-list">
                    {failureCodeRows.map((item) => (
                      <div key={item.code} className="failure-code-item">
                        <span className="failure-code-pill">{item.code}</span>
                        <span className="failure-code-label">
                          {getFailureCodeLabel(item.code)}
                        </span>
                        <span className="failure-code-count">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data compact">
                    No failure codes recorded
                  </div>
                )}
              </div>

              <div className="detail-card">
                <h4>Failure Reasons</h4>
                {failureReasonRows.length ? (
                  <div className="failure-reason-list">
                    {failureReasonRows.map((item) => (
                      <div key={item.reason} className="failure-reason-item">
                        <span className="failure-reason-label">
                          {item.reason}
                        </span>
                        <span className="failure-reason-count">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-data compact">
                    No failure reasons recorded
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "recipients" && (
            <div className="recipient-details-section">
              {isRecipientLoading ? (
                <div className="no-data">Loading recipient details...</div>
              ) : recipientDetails.length === 0 ? (
                <div className="no-data">No recipient details available</div>
              ) : (
                <div className="recipient-table-wrap">
                  <table className="recipient-table">
                    <thead>
                      <tr>
                        <th>Phone</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Delivered</th>
                        <th>Read</th>
                        <th>Replied</th>
                        <th>Failed</th>
                        <th>Failure Reason</th>
                        <th>Reply Count</th>
                        <th>Last Status</th>
                        <th>Last Reply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipientDetails.map((item, index) => (
                        <tr key={`${item.phone}-${index}`}>
                          <td>{item.phone || "-"}</td>
                          <td>{String(item.name || "").trim() || "Unknown"}</td>
                          <td>
                            <span
                              className={`recipient-status ${String(item.status || "pending").toLowerCase()}`}
                            >
                              {String(item.status || "pending").toUpperCase()}
                            </span>
                          </td>
                          <td>{item.delivered ? "Yes" : "No"}</td>
                          <td>{item.read ? "Yes" : "No"}</td>
                          <td>{item.replied ? "Yes" : "No"}</td>
                          <td>{item.failed ? "Yes" : "No"}</td>
                          <td
                            className="recipient-failure-cell"
                            title={getFailureReasonDetail(item) || undefined}
                          >
                            {getFailureReasonDetail(item) || "-"}
                          </td>
                          <td>{item.replyCount || 0}</td>
                          <td>{formatDateTime(item.lastStatusAt)}</td>
                          <td>{formatDateTime(item.lastReplyAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastAnalyticsModal;
