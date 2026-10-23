const META_STATUS_LABELS = Object.freeze({
  PENDING_REVIEW: "In Review",
  IN_PROCESS: "Processing",
  ACTIVE: "Active",
  PAUSED: "Paused",
  CAMPAIGN_PAUSED: "Campaign Paused",
  ADSET_PAUSED: "Ad Set Paused",
  DISAPPROVED: "Rejected",
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

export const getMetaDeliverySummary = (snapshot = {}) => {
  if (!snapshot?.campaign) return "Unavailable";
  const records = [snapshot.campaign, ...(snapshot.adSets || []), ...(snapshot.ads || [])].filter(Boolean);
  const labels = records.map((record) => getMetaDeliveryLabel(record));
  const priority = ["Rejected", "In Review", "Processing", "Campaign Paused", "Ad Set Paused", "Paused", "Issues Detected"];
  return priority.find((label) => labels.includes(label)) || labels.find((label) => label !== "Active") || labels[0] || "Unavailable";
};

export const formatMetaSyncTime = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Never synchronized";
  return `Last synced ${new Date(value).toLocaleString()}`;
};
