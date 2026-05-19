const DEFAULT_GRANULARITY = "daily";

export const REPORT_FILTER_DEFAULTS = {
  sourceType: "all",
  ownerId: "all",
  status: "all",
  lostReason: "",
  startDate: "",
  endDate: "",
  comparisonPeriod: "last_period",
  comparisonFrom: "",
  comparisonTo: "",
  minDealValue: "0",
  granularity: DEFAULT_GRANULARITY,
  windowDays: "60"
};

export const DATASET_DEFINITIONS = [
  { id: "current", label: "This Period", color: "#0ea44b", dash: "0" },
  { id: "comparison", label: "Comparison", color: "#3b82f6", dash: "6 4" },
  { id: "lastYear", label: "Last Year", color: "#8b5cf6", dash: "2 4" }
];

const toCleanString = (value) => String(value || "").trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfLocalDay = (value) => {
  const parsed = toDateOrNull(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const endOfLocalDay = (value) => {
  const parsed = toDateOrNull(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
};

const toIsoDate = (value) => {
  const parsed = toDateOrNull(value);
  if (!parsed) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

const formatReportLabel = (value) => {
  const normalized = toCleanString(value);
  if (!normalized) return "";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const bucketKeyForDate = (dateValue, granularity = DEFAULT_GRANULARITY) => {
  const date = toDateOrNull(dateValue);
  if (!date) return "";

  const normalizedGranularity = String(granularity || DEFAULT_GRANULARITY).toLowerCase();
  if (normalizedGranularity === "weekly") {
    const weekStart = new Date(date);
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1);
    return toIsoDate(weekStart);
  }

  if (normalizedGranularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return toIsoDate(date);
};

const bucketLabelForKey = (key, granularity = DEFAULT_GRANULARITY) => {
  if (!key) return "-";
  const normalizedGranularity = String(granularity || DEFAULT_GRANULARITY).toLowerCase();
  if (normalizedGranularity === "monthly") {
    const [year, month] = String(key).split("-");
    return new Date(Number(year), Number(month || 1) - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit"
    });
  }
  const parsed = new Date(`${String(key)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(key);
  if (normalizedGranularity === "weekly") {
    return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export const formatIndianCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "\u20B90";
  return `\u20B9${parsed.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

export const formatIndianPercent = (value, fractionDigits = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0%";
  return `${parsed.toFixed(fractionDigits)}%`;
};

export const formatResponseTime = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  if (parsed >= 60) return `${(parsed / 60).toFixed(1)} hrs`;
  return `${parsed.toFixed(1)} mins`;
};

export const normalizeReportFilters = (input = {}) => {
  const source =
    input instanceof URLSearchParams
      ? Object.fromEntries(input.entries())
      : input && typeof input === "object"
        ? input
        : {};

  const sourceType = toCleanString(source.sourceType || REPORT_FILTER_DEFAULTS.sourceType).toLowerCase() || "all";
  const ownerId = toCleanString(source.ownerId || REPORT_FILTER_DEFAULTS.ownerId) || "all";
  const status = toCleanString(source.status || REPORT_FILTER_DEFAULTS.status).toLowerCase() || "all";
  const lostReason = toCleanString(source.lostReason || source.reason || REPORT_FILTER_DEFAULTS.lostReason);
  const startDate = toCleanString(source.startDate || source.from || REPORT_FILTER_DEFAULTS.startDate);
  const endDate = toCleanString(source.endDate || source.to || REPORT_FILTER_DEFAULTS.endDate);
  const comparisonPeriod =
    ["last_period", "last_year", "custom"].includes(
      toCleanString(source.comparisonPeriod || REPORT_FILTER_DEFAULTS.comparisonPeriod).toLowerCase()
    )
      ? toCleanString(source.comparisonPeriod || REPORT_FILTER_DEFAULTS.comparisonPeriod).toLowerCase()
      : REPORT_FILTER_DEFAULTS.comparisonPeriod;
  const comparisonFrom = toCleanString(source.comparisonFrom || source.compareFrom || REPORT_FILTER_DEFAULTS.comparisonFrom);
  const comparisonTo = toCleanString(source.comparisonTo || source.compareTo || REPORT_FILTER_DEFAULTS.comparisonTo);
  const minDealValue = String(Math.max(0, toNumber(source.minDealValue ?? source.dealValueMin, 0))).trim();
  const granularity = ["daily", "weekly", "monthly"].includes(
    toCleanString(source.granularity || REPORT_FILTER_DEFAULTS.granularity).toLowerCase()
  )
    ? toCleanString(source.granularity || REPORT_FILTER_DEFAULTS.granularity).toLowerCase()
    : REPORT_FILTER_DEFAULTS.granularity;
  const windowDaysNumber = toNumber(source.windowDays, toNumber(REPORT_FILTER_DEFAULTS.windowDays, 60));
  const windowDays = String([30, 60, 90, 180].includes(windowDaysNumber) ? windowDaysNumber : 60);

  return {
    sourceType,
    ownerId,
    status,
    lostReason,
    startDate,
    endDate,
    comparisonPeriod,
    comparisonFrom,
    comparisonTo,
    minDealValue,
    granularity,
    windowDays
  };
};

export const formatReportSourceTypeLabel = (value) => {
  const normalized = toCleanString(value).toLowerCase();
  if (!normalized) return "";
  if (normalized === "manual") return "Manual";
  if (normalized === "imported") return "CSV Import";
  if (normalized === "meta_lead_ads") return "Meta Lead Ads";
  if (normalized === "public_opt_in") return "Public Opt-in";
  return formatReportLabel(normalized);
};

export const formatReportStageLabel = (value) => {
  const normalized = toCleanString(value).toLowerCase();
  if (!normalized) return "";
  const labels = {
    new: "New Lead",
    contacted: "Contacted",
    nurturing: "Nurturing",
    qualified: "Qualified",
    proposal: "Proposal",
    won: "Won",
    lost: "Lost",
    discovery: "Discovery",
    open: "Open"
  };
  return labels[normalized] || formatReportLabel(normalized);
};

export const formatReportStatusLabel = (value) => {
  const normalized = toCleanString(value).toLowerCase();
  if (!normalized) return "";
  const labels = {
    new: "New",
    contacted: "Contacted",
    nurturing: "Nurturing",
    qualified: "Qualified",
    proposal: "Proposal",
    open: "Open",
    won: "Won",
    lost: "Lost"
  };
  return labels[normalized] || formatReportLabel(normalized);
};

export const formatReportSourceLabel = (value, sourceType = "") => {
  const sourceText = toCleanString(value);
  const sourceTypeText = toCleanString(sourceType).toLowerCase();
  if (!sourceText || sourceText === "Unspecified") {
    return formatReportSourceTypeLabel(sourceTypeText) || "Unspecified";
  }
  return formatReportLabel(sourceText);
};

export const buildReportSourceTypeOptions = (contacts = []) => {
  const seen = new Set();
  const options = [];

  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    const value = toCleanString(contact?.sourceType).toLowerCase();
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({
      value,
      label: formatReportSourceTypeLabel(value)
    });
  });

  return options.sort((left, right) => left.label.localeCompare(right.label));
};

export const serializeReportFilters = (filters = {}) => {
  const normalized = normalizeReportFilters(filters);
  const params = new URLSearchParams();
  if (normalized.sourceType !== "all") params.set("sourceType", normalized.sourceType);
  if (normalized.ownerId !== "all") params.set("ownerId", normalized.ownerId);
  if (normalized.status !== "all") params.set("status", normalized.status);
  if (normalized.lostReason) params.set("reason", normalized.lostReason);
  if (normalized.startDate) params.set("startDate", normalized.startDate);
  if (normalized.endDate) params.set("endDate", normalized.endDate);
  if (normalized.comparisonPeriod !== REPORT_FILTER_DEFAULTS.comparisonPeriod) {
    params.set("comparisonPeriod", normalized.comparisonPeriod);
  }
  if (normalized.comparisonFrom) params.set("comparisonFrom", normalized.comparisonFrom);
  if (normalized.comparisonTo) params.set("comparisonTo", normalized.comparisonTo);
  if (String(normalized.minDealValue || "0") !== "0") params.set("minDealValue", normalized.minDealValue);
  if (normalized.granularity !== REPORT_FILTER_DEFAULTS.granularity) params.set("granularity", normalized.granularity);
  if (normalized.windowDays !== REPORT_FILTER_DEFAULTS.windowDays) params.set("windowDays", normalized.windowDays);
  return params;
};

export const getActiveReportFilterCount = (filters = {}) => {
  const normalized = normalizeReportFilters(filters);
  let count = 0;
  if (normalized.sourceType !== "all") count += 1;
  if (normalized.ownerId !== "all") count += 1;
  if (normalized.status !== "all") count += 1;
  if (normalized.lostReason) count += 1;
  if (normalized.startDate) count += 1;
  if (normalized.endDate) count += 1;
  if (normalized.comparisonPeriod !== REPORT_FILTER_DEFAULTS.comparisonPeriod) count += 1;
  if (normalized.comparisonPeriod === "custom" && (normalized.comparisonFrom || normalized.comparisonTo)) count += 1;
  if (String(normalized.minDealValue || "0") !== "0") count += 1;
  if (normalized.granularity !== REPORT_FILTER_DEFAULTS.granularity) count += 1;
  if (normalized.windowDays !== REPORT_FILTER_DEFAULTS.windowDays) count += 1;
  return count;
};

export const buildComparisonRange = (filters = {}) => {
  const normalized = normalizeReportFilters(filters);
  const start = toDateOrNull(normalized.startDate);
  const end = toDateOrNull(normalized.endDate);
  if (!start || !end) return { from: null, to: null };

  const span = Math.max(0, end.getTime() - start.getTime());
  if (normalized.comparisonPeriod === "last_year") {
    return {
      from: new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()),
      to: new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
    };
  }

  if (normalized.comparisonPeriod === "custom") {
    return {
      from: toDateOrNull(normalized.comparisonFrom),
      to: toDateOrNull(normalized.comparisonTo)
    };
  }

  const comparisonEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const comparisonStart = new Date(comparisonEnd.getTime() - span);
  return { from: comparisonStart, to: comparisonEnd };
};

const inDateRange = (dateValue, start, end) => {
  const timestamp = toDateOrNull(dateValue)?.getTime();
  if (!Number.isFinite(timestamp)) return false;
  const lower = start ? start.getTime() : -Infinity;
  const upper = end ? end.getTime() : Infinity;
  return timestamp >= lower && timestamp <= upper;
};

const bucketSeries = (rows, { dateKey = "createdAt", valueSelector = () => 1, granularity, start, end, limitPoints = 180 }) => {
  const bucketMap = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const dateValue = row?.[dateKey];
    if (!inDateRange(dateValue, start, end)) return;
    const bucket = bucketKeyForDate(dateValue, granularity);
    if (!bucket) return;
    const existing = bucketMap.get(bucket) || { key: bucket, label: bucketLabelForKey(bucket, granularity), value: 0 };
    existing.value += toNumber(valueSelector(row), 0);
    bucketMap.set(bucket, existing);
  });

  const series = Array.from(bucketMap.values()).sort((left, right) => left.key.localeCompare(right.key));
  return series.slice(Math.max(series.length - limitPoints, 0));
};

export const computeMovingAverage = (series = [], windowSize = 7, valueKey = "value") => {
  const window = Math.max(1, toNumber(windowSize, 7));
  return (Array.isArray(series) ? series : []).map((item, index, list) => {
    const startIndex = Math.max(0, index - window + 1);
    const slice = list.slice(startIndex, index + 1);
    const values = slice.map((row) => toNumber(row?.[valueKey], 0));
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      ...item,
      average: Number(average.toFixed(2))
    };
  });
};

const stageRank = (stage) => {
  const normalized = toCleanString(stage).toLowerCase();
  const order = ["new", "contacted", "nurturing", "qualified", "proposal", "won", "lost"];
  const index = order.indexOf(normalized);
  return index >= 0 ? index : 0;
};

const resolveContactActivityTime = (contact = {}) =>
  contact?.lastStageChangedAt || contact?.updatedAt || contact?.createdAt || null;

const normalizeContactRow = (contact = {}) => ({
  id: toCleanString(contact._id || contact.id || contact.contactId),
  name: toCleanString(contact.name) || "Unassigned",
  phone: toCleanString(contact.phone),
  email: toCleanString(contact.email),
  stage: toCleanString(contact.stage).toLowerCase() || "new",
  status: toCleanString(contact.status).toLowerCase() || "new",
  source: toCleanString(contact.source) || "Unspecified",
  sourceType: toCleanString(contact.sourceType).toLowerCase() || "manual",
  ownerId: toCleanString(contact.ownerId) || "unassigned",
  ownerName: toCleanString(contact.ownerName || contact.ownerLabel || contact.owner) || "Unassigned",
  leadScore: toNumber(contact.leadScore, 0),
  dealValue: toNumber(contact.dealValue, 0),
  lostReason: toCleanString(contact.lostReason),
  nextFollowUpAt: contact.nextFollowUpAt || null,
  lastContactAt: contact.lastContactAt || null,
  lastStageChangedAt: contact.lastStageChangedAt || null,
  createdAt: contact.createdAt || null,
  updatedAt: contact.updatedAt || null,
  responseMinutes: toNumber(contact.responseMinutes, 0),
  stageRank: stageRank(contact.stage),
  activityAt: resolveContactActivityTime(contact)
});

const normalizeDealRow = (deal = {}) => ({
  id: toCleanString(deal._id || deal.id || deal.dealId),
  title: toCleanString(deal.title) || "Untitled deal",
  stage: toCleanString(deal.stage).toLowerCase() || "discovery",
  status: toCleanString(deal.status).toLowerCase() || "open",
  value: toNumber(deal.value, 0),
  probability: toNumber(deal.probability, 0),
  currency: toCleanString(deal.currency) || "INR",
  expectedCloseAt: deal.expectedCloseAt || null,
  ownerId: toCleanString(deal.ownerId) || "unassigned",
  ownerName: toCleanString(deal.ownerName || deal.ownerLabel || deal.owner) || "Unassigned",
  source: toCleanString(deal.source) || "Unspecified",
  lostReason: toCleanString(deal.lostReason),
  contactId: toCleanString(deal.contactId?._id || deal.contactId || ""),
  createdAt: deal.createdAt || null,
  updatedAt: deal.updatedAt || null,
  wonAt: deal.wonAt || null,
  lostAt: deal.lostAt || null
});

export const normalizeReportContactRow = normalizeContactRow;
export const normalizeReportDealRow = normalizeDealRow;

export const mergeReportRealtimePayload = (previous = {}, payload = {}) => {
  const type = toCleanString(payload?.type).toLowerCase();
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};

  if (type === "lead_update" || type === "stage_change" || type === "stage_changed") {
    const contactId = toCleanString(data._id || data.id || data.contactId);
    const nextContact = normalizeContactRow({
      ...(Array.isArray(previous.contacts) ? previous.contacts.find((row) => row.id === contactId) || {} : {}),
      ...data,
      _id: contactId
    });
    const contacts = Array.isArray(previous.contacts) ? [...previous.contacts] : [];
    const index = contacts.findIndex((row) => row.id === nextContact.id);
    if (index >= 0) contacts[index] = nextContact;
    else contacts.unshift(nextContact);
    return { ...previous, contacts };
  }

  if (type === "deal_update") {
    const dealId = toCleanString(data._id || data.id || data.dealId);
    const nextDeal = normalizeDealRow({
      ...(Array.isArray(previous.deals) ? previous.deals.find((row) => row.id === dealId) || {} : {}),
      ...data,
      _id: dealId
    });
    const deals = Array.isArray(previous.deals) ? [...previous.deals] : [];
    const index = deals.findIndex((row) => row.id === nextDeal.id);
    if (index >= 0) deals[index] = nextDeal;
    else deals.unshift(nextDeal);
    return { ...previous, deals };
  }

  return previous;
};

const matchesFilter = (row = {}, filters = {}) => {
  if (filters.sourceType !== "all" && toCleanString(row.sourceType).toLowerCase() !== filters.sourceType) return false;
  if (filters.ownerId !== "all" && toCleanString(row.ownerId) !== filters.ownerId) return false;
  if (filters.status !== "all" && toCleanString(row.status).toLowerCase() !== filters.status) return false;
  if (filters.lostReason && !toCleanString(row.lostReason).toLowerCase().includes(filters.lostReason.toLowerCase())) return false;
  if (filters.minDealValue && toNumber(row.value ?? row.dealValue, 0) < toNumber(filters.minDealValue, 0)) return false;
  if (filters.startDate && !inDateRange(row.createdAt || row.updatedAt || row.activityAt, toDateOrNull(filters.startDate), toDateOrNull(filters.endDate))) return false;
  return true;
};

const buildSourceAttribution = (contacts = []) => {
  const grouped = new Map();
  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    const key = `${toCleanString(contact.sourceType).toLowerCase() || "manual"}|${toCleanString(contact.source) || "Unspecified"}`;
    const sourceType = toCleanString(contact.sourceType).toLowerCase() || "manual";
    const sourceLabel = formatReportSourceLabel(contact.source, sourceType);
    const current = grouped.get(key) || {
      sourceType,
      sourceTypeLabel: formatReportSourceTypeLabel(sourceType),
      source: toCleanString(contact.source) || "Unspecified",
      sourceLabel,
      leads: 0,
      qualified: 0,
      won: 0
    };
    current.sourceTypeLabel = formatReportSourceTypeLabel(sourceType);
    current.sourceLabel = sourceLabel;
    current.leads += 1;
    if (["qualified", "proposal", "won"].includes(toCleanString(contact.status).toLowerCase()) || ["qualified", "proposal", "won"].includes(toCleanString(contact.stage).toLowerCase())) {
      current.qualified += 1;
    }
    if (toCleanString(contact.status).toLowerCase() === "won" || toCleanString(contact.stage).toLowerCase() === "won") {
      current.won += 1;
    }
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((left, right) => right.leads - left.leads || left.sourceLabel.localeCompare(right.sourceLabel));
};

const buildLeadFunnel = (contacts = []) => {
  const stageCounts = new Map([
    ["new", 0],
    ["qualified", 0],
    ["contacted", 0],
    ["won", 0]
  ]);
  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    const stage = toCleanString(contact.stage).toLowerCase();
    const status = toCleanString(contact.status).toLowerCase();
    if (stageCounts.has("new")) stageCounts.set("new", stageCounts.get("new") + 1);
    if (["qualified", "proposal", "won"].includes(stage) || ["qualified", "proposal", "won"].includes(status)) {
      stageCounts.set("qualified", stageCounts.get("qualified") + 1);
    }
    if (["contacted", "nurturing", "qualified", "proposal", "won"].includes(stage) || ["contacted", "nurturing", "qualified", "proposal", "won"].includes(status)) {
      stageCounts.set("contacted", stageCounts.get("contacted") + 1);
    }
    if (stage === "won" || status === "won") {
      stageCounts.set("won", stageCounts.get("won") + 1);
    }
  });
  return [
    { name: "New Lead", value: stageCounts.get("new") || 0 },
    { name: "Qualified", value: stageCounts.get("qualified") || 0 },
    { name: "Contacted", value: stageCounts.get("contacted") || 0 },
    { name: "Won", value: stageCounts.get("won") || 0 }
  ];
};

const buildPipelineConversion = (contacts = [], filters = {}, targetWinRate = 25) => {
  const normalized = normalizeReportFilters(filters);
  const start = toDateOrNull(normalized.startDate);
  const end = toDateOrNull(normalized.endDate);
  const granularity = normalized.granularity;
  const series = bucketSeries(contacts, {
    dateKey: "createdAt",
    granularity,
    start,
    end,
    valueSelector: (row) => (["qualified", "won"].includes(toCleanString(row.status).toLowerCase()) ? 1 : 0),
    limitPoints: Number(normalized.windowDays || 60)
  });
  const counts = bucketSeries(contacts, {
    dateKey: "createdAt",
    granularity,
    start,
    end,
    valueSelector: () => 1,
    limitPoints: Number(normalized.windowDays || 60)
  });
  const countMap = new Map(counts.map((item) => [item.key, item.value]));
  const qualifiedMap = new Map(series.map((item) => [item.key, item.value]));
  const timeline = counts.map((item) => {
    const qualified = qualifiedMap.get(item.key) || 0;
    const total = countMap.get(item.key) || 0;
    const winRate = total ? (qualified / total) * 100 : 0;
    return {
      ...item,
      qualified,
      winRate: Number(winRate.toFixed(2)),
      targetWinRate
    };
  });
  return timeline;
};

const buildDealsRevenueSeries = (deals = [], filters = {}) => {
  const normalized = normalizeReportFilters(filters);
  const start = toDateOrNull(normalized.startDate);
  const end = toDateOrNull(normalized.endDate);
  const granularity = normalized.granularity;
  const baseSeries = bucketSeries(deals, {
    dateKey: "createdAt",
    granularity,
    start,
    end,
    valueSelector: (row) => row.value,
    limitPoints: Number(normalized.windowDays || 60)
  });
  let cumulative = 0;
  const totalDealValue = baseSeries.reduce((sum, item) => sum + toNumber(item.value, 0), 0);
  const averageDealValue = baseSeries.length ? totalDealValue / baseSeries.length : 0;
  const cumulativeSeries = baseSeries.map((item, index) => {
    cumulative += toNumber(item.value, 0);
    return {
      ...item,
      dealValue: toNumber(item.value, 0),
      cumulativeRevenue: Number(cumulative.toFixed(2)),
      averageDealValue: Number(averageDealValue.toFixed(2)),
      order: index + 1
    };
  });
  return computeMovingAverage(cumulativeSeries, 7, "dealValue").map((item) => ({
    ...item,
    movingAverage: Number(toNumber(item.average, 0).toFixed(2))
  }));
};

const buildOwnerPerformance = (contacts = [], deals = []) => {
  const ownerMap = new Map();
  const ensureOwner = (ownerId, ownerName) => {
    const key = ownerId || "unassigned";
    const current = ownerMap.get(key) || {
      ownerId: key,
      ownerName: ownerName || "Unassigned",
      leads: 0,
      qualified: 0,
      won: 0,
      pipelineValue: 0,
      responseMinutes: 0,
      responseCount: 0,
      openDeals: 0,
      overdueFollowUps: 0,
      needsReply: 0
    };
    if (ownerName && current.ownerName === "Unassigned") current.ownerName = ownerName;
    ownerMap.set(key, current);
    return current;
  };

  (Array.isArray(contacts) ? contacts : []).forEach((contact) => {
    const owner = ensureOwner(contact.ownerId, contact.ownerName);
    owner.leads += 1;
    if (["qualified", "proposal", "won"].includes(toCleanString(contact.status).toLowerCase()) || ["qualified", "proposal", "won"].includes(toCleanString(contact.stage).toLowerCase())) {
      owner.qualified += 1;
    }
    if (toCleanString(contact.status).toLowerCase() === "won" || toCleanString(contact.stage).toLowerCase() === "won") {
      owner.won += 1;
    }
    if (toNumber(contact.responseMinutes, 0) > 0) {
      owner.responseMinutes += toNumber(contact.responseMinutes, 0);
      owner.responseCount += 1;
    }
    if (contact.nextFollowUpAt && new Date(contact.nextFollowUpAt).getTime() < Date.now()) {
      owner.overdueFollowUps += 1;
    }
    if (contact.lastContactAt && contact.lastStageChangedAt && new Date(contact.lastContactAt).getTime() < new Date(contact.lastStageChangedAt).getTime()) {
      owner.needsReply += 1;
    }
  });

  (Array.isArray(deals) ? deals : []).forEach((deal) => {
    const owner = ensureOwner(deal.ownerId, deal.ownerName);
    if (toCleanString(deal.status).toLowerCase() === "open") owner.openDeals += 1;
    owner.pipelineValue += toNumber(deal.value, 0);
  });

  const rows = Array.from(ownerMap.values())
    .map((owner) => ({
      ...owner,
      responseAvg: owner.responseCount ? owner.responseMinutes / owner.responseCount : 0,
      winRate: owner.leads ? (owner.won / owner.leads) * 100 : 0
    }))
    .sort((left, right) => right.pipelineValue - left.pipelineValue || right.leads - left.leads);

  const radarOwners = rows.slice(0, 5).map((owner, index) => ({
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    color: ["#1D9E75", "#378ADD", "#EF9F27", "#D85A30", "#7F77DD"][index % 5]
  }));
  const radarSubjects = [
    { subject: "Leads", key: "leads" },
    { subject: "Qualified", key: "qualified" },
    { subject: "Wins", key: "won" },
    { subject: "Pipeline", key: "pipelineValue" },
    { subject: "Overdue", key: "overdueFollowUps" },
    { subject: "Needs Reply", key: "needsReply" }
  ];
  const fullMark = Math.max(
    1,
    ...radarOwners.flatMap((owner) =>
      radarSubjects.map((subject) => {
        const source = rows.find((row) => row.ownerId === owner.ownerId) || {};
        return toNumber(source[subject.key], 0);
      })
    )
  );
  const radar = radarSubjects.map((subject) => {
    const entry = { subject: subject.subject, fullMark };
    radarOwners.forEach((owner) => {
      const source = rows.find((row) => row.ownerId === owner.ownerId) || {};
      entry[owner.ownerName] = toNumber(source[subject.key], 0);
    });
    return entry;
  });

  return { rows, radar, radarOwners, fullMark };
};

const buildBottomTableRows = (contacts = [], deals = []) => {
  const dealByContact = new Map();
  (Array.isArray(deals) ? deals : []).forEach((deal) => {
    const contactId = toCleanString(deal.contactId);
    if (!contactId) return;
    const existing = dealByContact.get(contactId) || [];
    existing.push(deal);
    dealByContact.set(contactId, existing);
  });

  return (Array.isArray(contacts) ? contacts : []).map((contact) => {
    const contactDeals = dealByContact.get(contact.id) || [];
    const openDeals = contactDeals.filter((deal) => toCleanString(deal.status).toLowerCase() === "open").length;
    const wonDeals = contactDeals.filter((deal) => toCleanString(deal.status).toLowerCase() === "won").length;
    const totalValue = contactDeals.reduce((sum, deal) => sum + toNumber(deal.value, 0), 0);
    const sourceType = toCleanString(contact.sourceType).toLowerCase() || "manual";
    return {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      source: contact.source,
      sourceType,
      sourceLabel: formatReportSourceLabel(contact.source, sourceType),
      sourceTypeLabel: formatReportSourceTypeLabel(sourceType),
      ownerName: contact.ownerName,
      status: contact.status,
      statusLabel: formatReportStatusLabel(contact.status),
      stage: contact.stage,
      stageLabel: formatReportStageLabel(contact.stage),
      lostReason: contact.lostReason,
      leadScore: contact.leadScore,
      dealValue: contact.dealValue,
      openDeals,
      wonDeals,
      totalDealValue: totalValue,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt
    };
  });
};

export const buildReportAnalytics = ({
  summary = {},
  contacts = [],
  deals = [],
  filters = {}
} = {}) => {
  const normalizedFilters = normalizeReportFilters(filters);
  const filteredContacts = (Array.isArray(contacts) ? contacts : [])
    .map(normalizeContactRow)
    .filter((row) => matchesFilter(row, normalizedFilters));
  const filteredDeals = (Array.isArray(deals) ? deals : [])
    .map(normalizeDealRow)
    .filter((row) => matchesFilter(row, normalizedFilters));

  const sourceAttribution = buildSourceAttribution(filteredContacts);
  const leadFunnel = buildLeadFunnel(filteredContacts);
  const pipelineConversion = buildPipelineConversion(filteredContacts, normalizedFilters, Number(summary?.pipeline?.qualifiedRate || 25));
  const dealsRevenue = buildDealsRevenueSeries(filteredDeals, normalizedFilters);
  const ownerPerformance = buildOwnerPerformance(filteredContacts, filteredDeals);
  const tableRows = buildBottomTableRows(filteredContacts, filteredDeals);

  const totalLeads = Number(summary?.pipeline?.totalContacts || filteredContacts.length || 0);
  const qualifiedRate = Number(summary?.pipeline?.qualifiedRate || (filteredContacts.length ? (filteredContacts.filter((row) => ["qualified", "proposal", "won"].includes(row.status) || ["qualified", "proposal", "won"].includes(row.stage)).length / filteredContacts.length) * 100 : 0));
  const openPipeline = Number(summary?.pipeline?.deals?.pipelineValue || filteredDeals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.value, 0));
  const avgResponseTime = Number(summary?.response?.avgResponseMinutes || (filteredContacts.length ? filteredContacts.reduce((sum, row) => sum + toNumber(row.responseMinutes, 0), 0) / Math.max(1, filteredContacts.filter((row) => row.responseMinutes > 0).length) : 0));

  return {
    filters: normalizedFilters,
    sourceAttribution,
    leadFunnel,
    pipelineConversion,
    dealsRevenue,
    ownerPerformance,
    tableRows,
    kpis: {
      totalLeads,
      qualifiedRate: Number(qualifiedRate.toFixed ? qualifiedRate.toFixed(1) : qualifiedRate),
      openPipeline,
      avgResponseTime
    },
    summary
  };
};

export const deriveComparisonLabel = (period = "") => {
  const normalized = String(period || "").trim().toLowerCase();
  if (normalized === "last_year") return "Last Year";
  if (normalized === "custom") return "Comparison";
  return "Last Period";
};

export const buildKpiTrend = (currentValue = 0, previousValue = 0) => {
  const current = toNumber(currentValue, 0);
  const previous = toNumber(previousValue, 0);
  const delta = current - previous;
  const deltaPercent = previous ? (delta / previous) * 100 : 0;
  return {
    delta,
    deltaPercent,
    isPositive: delta >= 0
  };
};

export const createSparklineSeries = (values = [], label = "value") =>
  (Array.isArray(values) ? values : []).map((value, index) => ({
    name: `${label}-${index + 1}`,
    value: toNumber(value, 0)
  }));

export const timeRangeForWindow = (filters = {}, now = new Date()) => {
  const normalized = normalizeReportFilters(filters);
  const windowDays = Math.max(30, toNumber(normalized.windowDays, 60));
  const end = endOfLocalDay(normalized.endDate || now);
  const start = startOfLocalDay(normalized.startDate) || new Date(end.getFullYear(), end.getMonth(), end.getDate() - windowDays + 1);
  return { start, end };
};

export const takeLatestPoints = (series = [], windowDays = 60) => {
  const points = Array.isArray(series) ? series : [];
  const size = Math.max(1, toNumber(windowDays, 60));
  return points.slice(Math.max(points.length - size, 0));
};

export const buildExportFilename = (prefix, extension) => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}.${extension}`;
};
