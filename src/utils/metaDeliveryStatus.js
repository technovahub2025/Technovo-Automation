const META_STATUS_LABELS = Object.freeze({
  PENDING_REVIEW: "In Review",
  IN_PROCESS: "Processing / In Process",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Campaign Paused",
  ADSET_PAUSED: "Ad Set Paused",
  DISAPPROVED: "Rejected / Disapproved",
  WITH_ISSUES: "Issues Detected",
  SCHEDULED: "Scheduled",
  ARCHIVED: "Archived",
  DELETED: "Deleted",
  PREAPPROVED: "Preapproved",
  COMPLETED: "Completed",
});

export const getMetaDeliveryLabel = (record = {}, now = Date.now()) => {
  const status = String(record.effective_status || record.status || record.configured_status || "")
    .trim()
    .toUpperCase();
  const configuredStatus = String(record.configured_status || record.status || "").trim().toUpperCase();
  if (status === "ACTIVE" && configuredStatus === "ACTIVE" && record.start_time && Date.parse(record.start_time) > now) {
    return "Scheduled";
  }
  if (!status) return "Unavailable";
  return META_STATUS_LABELS[status] || status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatMetaSyncTime = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Never synchronized";
  return `Last synced ${new Date(value).toLocaleString()}`;
};
