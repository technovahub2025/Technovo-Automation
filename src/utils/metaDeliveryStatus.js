const META_STATUS_LABELS = Object.freeze({
  PENDING_REVIEW: "In Review",
  IN_REVIEW: "In Review",
  IN_PROCESS: "Processing",
  PROCESSING: "Processing",
  PREPARING: "Preparing",
  PREPARATION: "Preparing",
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
  const stopTime = record.stop_time || record.end_time;
  if (status === "ACTIVE" && stopTime && Date.parse(stopTime) <= now) return "Completed";
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
  const campaignLabel = getMetaDeliveryLabel(snapshot.campaign);
  if (["Completed", "Deleted", "Archived"].includes(campaignLabel)) return campaignLabel;
  const priority = ["Rejected", "In Review", "Processing", "Preparing", "Campaign Paused", "Ad Set Paused", "Paused", "Issues Detected"];
  return priority.find((label) => labels.includes(label)) || labels.find((label) => label !== "Active") || labels[0] || "Unavailable";
};

export const formatMetaSyncTime = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Never synchronized";
  return `Last synced ${new Date(value).toLocaleString()}`;
};
