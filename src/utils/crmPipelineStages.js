export const DEFAULT_PIPELINE_STAGE_OPTIONS = [
  { key: "new", label: "New Lead", color: "#5f8fc3", order: 0 },
  { key: "contacted", label: "Contacted", color: "#4a8bbd", order: 1 },
  { key: "nurturing", label: "Nurturing", color: "#6f7bd0", order: 2 },
  { key: "qualified", label: "Qualified", color: "#4f9d6c", order: 3 },
  { key: "proposal", label: "Proposal Sent", color: "#d18a3a", order: 4 },
  { key: "won", label: "Won", color: "#1d9b5e", order: 5 },
  { key: "lost", label: "Lost", color: "#c45a5a", order: 6 }
];

export const normalizePipelineStageOption = (stage = {}, index = 0) => ({
  key: String(stage?.key || "").trim().toLowerCase(),
  label: String(stage?.label || "").trim() || DEFAULT_PIPELINE_STAGE_OPTIONS[index]?.label || "New Lead",
  color:
    String(stage?.color || "").trim() ||
    DEFAULT_PIPELINE_STAGE_OPTIONS[index]?.color ||
    "#5f8fc3",
  order: Number.isFinite(Number(stage?.order)) ? Number(stage.order) : index,
  isArchived: Boolean(stage?.isArchived),
  contactCount: Number.isFinite(Number(stage?.contactCount)) ? Number(stage.contactCount) : 0
});

export const getPipelineStageLabel = (stageKey, stageOptions = DEFAULT_PIPELINE_STAGE_OPTIONS) => {
  const normalizedKey = String(stageKey || "").trim().toLowerCase();
  const matchedStage = (Array.isArray(stageOptions) && stageOptions.length
    ? stageOptions
    : DEFAULT_PIPELINE_STAGE_OPTIONS
  ).find((stage) => String(stage?.key || "").trim().toLowerCase() === normalizedKey);
  if (matchedStage) return String(matchedStage.label || "").trim() || "New Lead";
  return normalizedKey ? normalizedKey.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "New Lead";
};
