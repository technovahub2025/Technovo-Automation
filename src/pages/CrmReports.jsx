import React, {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useSearchParams } from "react-router-dom";
import { FixedSizeList } from "react-window";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Brush,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  LabelList,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  RefreshCcw,
  RotateCcw,
  ArrowUpDown,
  X
} from "lucide-react";
import { crmService } from "../services/crmService";
import CrmPageSkeleton from "../components/crm/CrmPageSkeleton";
import CrmEmptyState from "../components/crm/CrmEmptyState";
import CrmRealtimeStatus from "../components/crm/CrmRealtimeStatus";
import CrmToast from "../components/crm/CrmToast";
import { resolveCacheUserId, readSidebarPageCache, writeSidebarPageCache } from "../utils/sidebarPageCache";
import webSocketService from "../services/websocketService";
import useCrmDebouncedValue from "../hooks/useCrmDebouncedValue";
import {
  buildComparisonRange,
  buildExportFilename,
  buildKpiTrend,
  buildReportAnalytics,
  buildReportSourceTypeOptions,
  computeMovingAverage,
  createSparklineSeries,
  DATASET_DEFINITIONS,
  formatIndianCurrency,
  formatIndianPercent,
  formatResponseTime,
  formatReportSourceTypeLabel,
  formatReportStageLabel,
  formatReportStatusLabel,
  getActiveReportFilterCount,
  mergeReportRealtimePayload,
  normalizeReportFilters,
  REPORT_FILTER_DEFAULTS,
  serializeReportFilters,
  takeLatestPoints,
  timeRangeForWindow
} from "../utils/crmReportsAnalytics";
import "./CrmWorkspace.css";
import "./CrmReports.css";

const REPORT_CACHE_NAMESPACE = "crm-reports-page";
const REPORT_CACHE_TTL_MS = 7 * 60 * 1000;
const REPORT_PAGE_SIZE_CONTACTS = 200;
const REPORT_PAGE_SIZE_DEALS = 100;
const REPORT_MAX_ROWS = 10000;

const formatDateInput = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const toQueryValue = (value, defaultValue = "") => {
  const stringValue = String(value ?? "").trim();
  return stringValue === String(defaultValue).trim() ? "" : stringValue;
};

const parseIntOr = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const useCountTween = (value, duration = 350) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousRef = useRef(value);

  useEffect(() => {
    const start = Number(previousRef.current || 0);
    const end = Number(value || 0);
    previousRef.current = end;

    let frameId = 0;
    const startedAt = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / Math.max(1, duration));
      const next = start + (end - start) * progress;
      setDisplayValue(next);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, value]);

  return displayValue;
};

const loadAllPages = async ({ loader, pageSize, maxRows }) => {
  const rows = [];
  let cursor = "";
  let safety = 0;
  do {
    const result = await loader({ limit: pageSize, cursorMode: "true", ...(cursor ? { cursor } : {}) });
    if (result?.success === false) {
      throw new Error(result?.error || "Failed to load CRM data");
    }

    const batch = Array.isArray(result?.data) ? result.data : [];
    rows.push(...batch);
    cursor = String(result?.nextCursor || "").trim();
    safety += 1;
    if (!result?.hasMore || !cursor || rows.length >= maxRows || safety > 120) break;
  } while (cursor);

  return rows.slice(0, maxRows);
};

const QueryValue = memo(({ children, tone = "default" }) => (
  <span className={`crm-report-query-value crm-report-query-value--${tone}`}>{children}</span>
));

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="crm-report-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <div key={`${entry.dataKey}-${entry.name}`} className="crm-report-tooltip__row">
          <span className="crm-report-tooltip__dot" style={{ background: entry.color || entry.stroke || "#0ea44b" }} />
          <span>{entry.name || entry.dataKey}</span>
          <strong>
            {String(entry.dataKey || entry.name || "").toLowerCase().includes("rate")
              ? formatIndianPercent(entry.value)
              : String(entry.dataKey || entry.name || "").toLowerCase().includes("response")
                ? formatResponseTime(entry.value)
                : typeof entry.value === "number" || String(entry.value).match(/^[0-9.]+$/)
                  ? formatIndianCurrency(entry.value)
                  : String(entry.value)}
          </strong>
        </div>
      ))}
    </div>
  );
};

const ChartLegend = ({ payload }) => (
  <div className="crm-report-legend">
    {(payload || []).map((item) => (
      <span key={item.value} className="crm-report-legend__pill">
        <span className="crm-report-legend__swatch" style={{ background: item.color }} />
        {item.value}
      </span>
    ))}
  </div>
);

const renderSourceValueLabel = ({ x, y, width, height, value }) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0 || Number(width) < 20) return null;

  return (
    <text
      x={Number(x) + Number(width) + 8}
      y={Number(y) + Number(height) / 2}
      fill="#64748b"
      fontSize={11}
      fontWeight={700}
      dominantBaseline="middle"
    >
      {numericValue.toLocaleString("en-IN")}
    </text>
  );
};

const ReportSectionSkeleton = ({ height = 300 }) => (
  <div className="crm-report-skeleton" style={{ minHeight: height }}>
    <div className="crm-report-skeleton__bar crm-report-skeleton__bar--title" />
    <div className="crm-report-skeleton__chart" />
  </div>
);

const AnimatedMetric = ({ value, prefix = "", suffix = "" }) => {
  const tweened = useCountTween(value);
  const displayValue = typeof value === "number" && Number.isFinite(value) ? tweened : value;
  return (
    <strong>
      {prefix}
      {typeof displayValue === "number"
        ? displayValue >= 1000 || Number.isInteger(displayValue)
          ? Number(displayValue).toLocaleString("en-IN", { maximumFractionDigits: 1 })
          : Number(displayValue).toFixed(1)
        : displayValue}
      {suffix}
    </strong>
  );
};

const normalizeSparklineValues = (values = [], fallbackValue = 0) => {
  const points = (Array.isArray(values) ? values : []).map((value) => Number(value) || 0);
  if (points.length >= 2) return points;

  const base = Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : 0;
  if (base === 0) return [0, 0.1, 0, 0.1];

  const offset = Math.max(Math.abs(base) * 0.08, 1);
  return [Math.max(0, base - offset), base, base + offset, Math.max(0, base + offset * 0.5)];
};

const MetricCard = memo(({ title, value, delta, sparkline, tone, format = "number" }) => {
  const deltaPositive = Number(delta) >= 0;
  return (
    <article className="crm-report-metric-card">
      <div className="crm-report-metric-card__header">
        <div>
          <span className="crm-report-metric-card__label">{title}</span>
          {format === "currency" ? (
            <AnimatedMetric value={value} prefix="₹" />
          ) : format === "percent" ? (
            <AnimatedMetric value={value} suffix="%" />
          ) : format === "duration" ? (
            <AnimatedMetric value={value} />
          ) : (
            <AnimatedMetric value={value} />
          )}
        </div>
        <span className={`crm-report-delta ${deltaPositive ? "crm-report-delta--up" : "crm-report-delta--down"}`}>
          {deltaPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {deltaPositive ? "+" : ""}
          {Number(delta || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="crm-report-metric-card__sparkline">
        <ResponsiveContainer width="100%" height={48}>
          <LineChart data={sparkline}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={tone}
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
});

const ChartCard = memo(({ title, subtitle, actions, children, chartRef, ariaLabel, height = 300, id }) => (
  <section id={id} className="crm-report-card" ref={chartRef} aria-label={ariaLabel}>
    <header className="crm-report-card__header">
      <div>
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="crm-report-card__actions">{actions}</div>
    </header>
    <div className="crm-report-card__body" style={{ minHeight: height }}>
      {children}
    </div>
  </section>
));

const ChartFrame = memo(({ children, ariaLabel }) => (
  <div className="crm-report-chart-frame" aria-label={ariaLabel}>
    {children}
  </div>
));

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="crm-report-chart-error" role="alert">
          <strong>Chart failed to load - retry</strong>
          <button type="button" className="crm-btn crm-btn-secondary" onClick={() => this.setState({ hasError: false })}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const LegendPills = memo(({ items }) => (
  <div className="crm-report-legend" aria-hidden="false">
    {(items || []).map((item) => (
      <span key={item.label} className="crm-report-legend__pill">
        <span className="crm-report-legend__swatch" style={{ background: item.color, borderRadius: item.shape === "line" ? 999 : item.shape === "dash" ? 2 : 999, borderStyle: item.shape === "dot" ? "dotted" : item.shape === "dash" ? "dashed" : "solid", borderWidth: item.shape === "line" ? 0 : 1, borderColor: item.color }} />
        {item.label}
      </span>
    ))}
  </div>
));

const ReportCharts = memo(({ analytics, comparisonAnalytics, lastYearAnalytics, visibleDatasets, chartRefs, onChartCapture, onToggleDataset, activeDatasets, ownerRows, ownerSort, onOwnerSort }) => {
  const currentPipeline = analytics?.pipelineConversion || [];
  const currentRevenue = analytics?.dealsRevenue || [];
  const comparisonPipeline = comparisonAnalytics?.pipelineConversion || [];
  const comparisonRevenue = comparisonAnalytics?.dealsRevenue || [];
  const lastYearPipeline = lastYearAnalytics?.pipelineConversion || [];
  const lastYearRevenue = lastYearAnalytics?.dealsRevenue || [];
  const targetWinRate = Number(analytics?.pipelineConversion?.[0]?.targetWinRate || analytics?.kpis?.qualifiedRate || 25);
  const revenueAverage = Number(currentRevenue?.[0]?.averageDealValue || 0);

  const datasetStyles = useMemo(
    () => ({
      current: { color: "#1D9E75", dash: "0" },
      comparison: { color: "#378ADD", dash: "5 3" },
      lastYear: { color: "#EF9F27", dash: "2 2" }
    }),
    []
  );

  const activeDatasetIds = useMemo(
    () => activeDatasets.filter((datasetId) => visibleDatasets.has(datasetId)),
    [activeDatasets, visibleDatasets]
  );

  const pipelineData = useMemo(() => {
    const merged = new Map();
    const addSeries = (series, prefix) => {
      (series || []).forEach((point) => {
        const key = point.key || point.label || "";
        const current = merged.get(key) || { key, label: point.label || key };
        current[`${prefix}Value`] = Number(point.value || 0);
        current[`${prefix}Qualified`] = Number(point.qualified || 0);
        current[`${prefix}WinRate`] = Number(point.winRate || 0);
        current[`${prefix}Target`] = Number(point.targetWinRate || targetWinRate);
        merged.set(key, current);
      });
    };

    if (visibleDatasets.has("current")) addSeries(currentPipeline, "current");
    if (visibleDatasets.has("comparison")) addSeries(comparisonPipeline, "comparison");
    if (visibleDatasets.has("lastYear")) addSeries(lastYearPipeline, "lastYear");
    return Array.from(merged.values()).sort((left, right) => String(left.key).localeCompare(String(right.key)));
  }, [comparisonPipeline, currentPipeline, lastYearPipeline, targetWinRate, visibleDatasets]);

  const revenueData = useMemo(() => {
    const merged = new Map();
    const addSeries = (series, prefix) => {
      (series || []).forEach((point) => {
        const key = point.key || point.label || "";
        const current = merged.get(key) || { key, label: point.label || key };
        current[`${prefix}DealValue`] = Number(point.dealValue ?? point.value ?? 0);
        current[`${prefix}CumulativeRevenue`] = Number(point.cumulativeRevenue || 0);
        current[`${prefix}MovingAverage`] = Number(point.movingAverage || point.average || 0);
        current[`${prefix}AverageDealValue`] = Number(point.averageDealValue || point.average || 0);
        merged.set(key, current);
      });
    };

    if (visibleDatasets.has("current")) addSeries(currentRevenue, "current");
    if (visibleDatasets.has("comparison")) addSeries(comparisonRevenue, "comparison");
    if (visibleDatasets.has("lastYear")) addSeries(lastYearRevenue, "lastYear");
    return Array.from(merged.values()).sort((left, right) => String(left.key).localeCompare(String(right.key)));
  }, [comparisonRevenue, currentRevenue, lastYearRevenue, visibleDatasets]);

  const sourceAttribution = analytics?.sourceAttribution || [];
  const leadFunnel = analytics?.leadFunnel || [];
  const ownerRadar = analytics?.ownerPerformance?.radar || [];
  const ownerRadarOwners = analytics?.ownerPerformance?.radarOwners || [];

  const chartAction = (key, label) => (
    <button type="button" className="crm-report-chart-action" aria-label={label} onClick={() => onChartCapture(key)}>
      <Camera size={14} />
    </button>
  );

  const datasetPills = (ids = activeDatasetIds, onToggle) => (
    <div className="crm-report-datasets crm-report-datasets--inline" role="group" aria-label="Dataset toggles">
      {["current", "comparison", "lastYear"].map((id) => {
        const style = datasetStyles[id];
        const active = ids.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={`crm-report-dataset-pill ${active ? "is-active" : ""}`}
            style={active ? { background: `${style.color}26`, borderColor: style.color, color: "#0f172a" } : undefined}
            onClick={() => onToggle(id)}
            aria-pressed={active}
          >
            <span className="crm-report-dataset-pill__swatch" style={{ background: style.color }} />
            {id === "current" ? "This Period" : id === "comparison" ? "Comparison" : "Last Year"}
          </button>
        );
      })}
    </div>
  );

  const sourceLegend = [
    { label: "Leads", color: "#1D9E75" },
    { label: "Qualified", color: "#378ADD" },
    { label: "Won", color: "#EF9F27" }
  ];

  const funnelLegend = [
    { label: "New Lead", color: "#1D9E75" },
    { label: "Qualified", color: "#378ADD" },
    { label: "Contacted", color: "#EF9F27" },
    { label: "Lost", color: "#E24B4A" },
    { label: "Won", color: "#639922" }
  ];

  const pipelineLegend = activeDatasetIds.map((id) => ({
    label: id === "current" ? "This Period" : id === "comparison" ? "Comparison" : "Last Year",
    color: datasetStyles[id].color,
    shape: id === "current" ? "line" : id === "comparison" ? "dash" : "dot"
  }));

  const revenueLegend = [
    ...pipelineLegend,
    { label: "7-Period MA", color: "#EF9F27", shape: "dash" },
    { label: "Avg", color: "#E24B4A", shape: "line" }
  ];

  const ownerLegend = ownerRadarOwners.map((owner) => ({ label: owner.ownerName, color: owner.color }));

  const sourceChart = (
    <ChartErrorBoundary>
      <ChartFrame ariaLabel="Source attribution chart">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sourceAttribution} layout="vertical" margin={{ left: 0, right: 40, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" strokeOpacity={0.5} horizontal={false} />
            <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="sourceLabel" width={160} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
            <Bar dataKey="leads" name="Leads" stackId="a" fill="#1D9E75" radius={[0, 0, 0, 0]} animationDuration={600}>
              <LabelList content={renderSourceValueLabel} />
            </Bar>
            <Bar dataKey="qualified" name="Qualified" stackId="a" fill="#378ADD" radius={[0, 0, 0, 0]} animationDuration={600}>
              <LabelList content={() => null} />
            </Bar>
            <Bar dataKey="won" name="Won" stackId="a" fill="#EF9F27" radius={[0, 8, 8, 0]} animationDuration={600}>
              <LabelList content={() => null} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <LegendPills items={sourceLegend} />
      </ChartFrame>
    </ChartErrorBoundary>
  );

  const funnelChart = (
    <ChartErrorBoundary>
      <ChartFrame ariaLabel="Lead funnel chart">
        <ResponsiveContainer width="100%" height={300}>
          <FunnelChart>
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15, 23, 42, 0.04)" }} />
            <Funnel dataKey="value" data={leadFunnel} isAnimationActive animationDuration={600} label={({ name, value }) => `${name} · ${value}`}>
              {leadFunnel.map((entry, index) => (
                <Cell
                  key={`funnel-${entry.name}-${index}`}
                  fill={["#1D9E75", "#378ADD", "#EF9F27", "#E24B4A", "#639922"][index % 5]}
                />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
        <LegendPills items={funnelLegend.slice(0, leadFunnel.length)} />
      </ChartFrame>
    </ChartErrorBoundary>
  );

  const pipelineChart = (
    <ChartErrorBoundary>
      <ChartFrame ariaLabel="Pipeline conversion chart">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={pipelineData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pipelineGradientCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pipelineGradientComparison" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#378ADD" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#378ADD" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pipelineGradientLastYear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF9F27" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#EF9F27" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" strokeOpacity={0.5} />
            <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={targetWinRate} stroke="#E24B4A" strokeDasharray="3 3" label={{ value: "Target", position: "insideTopRight", fontSize: 11, fill: "#9ca3af" }} />
            {visibleDatasets.has("current") ? (
              <Area type="monotone" dataKey="currentWinRate" name="This Period" stroke="#1D9E75" fill="url(#pipelineGradientCurrent)" strokeWidth={2} animationDuration={600} />
            ) : null}
            {visibleDatasets.has("comparison") ? (
              <Area type="monotone" dataKey="comparisonWinRate" name="Comparison" stroke="#378ADD" fill="url(#pipelineGradientComparison)" strokeWidth={2} strokeDasharray="5 3" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("lastYear") ? (
              <Area type="monotone" dataKey="lastYearWinRate" name="Last Year" stroke="#EF9F27" fill="url(#pipelineGradientLastYear)" strokeWidth={2} strokeDasharray="2 2" animationDuration={600} />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
        <LegendPills items={pipelineLegend.concat([{ label: "Target", color: "#E24B4A", shape: "line" }])} />
      </ChartFrame>
    </ChartErrorBoundary>
  );

  const revenueChart = (
    <ChartErrorBoundary>
      <ChartFrame ariaLabel="Deals and revenue chart">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={revenueData} margin={{ top: 10, right: 24, left: 0, bottom: 26 }}>
            <CartesianGrid stroke="#f3f4f6" strokeDasharray="4 2" horizontal vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => value} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatIndianCurrency(value)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatIndianCurrency(value)} />
            <Tooltip content={<ChartTooltip />} />
            {visibleDatasets.has("current") ? (
              <Bar dataKey="currentDealValue" name="This Period Deal Value" fill="#1D9E75" radius={[3, 3, 0, 0]} maxBarSize={24} animationDuration={600} />
            ) : null}
            {visibleDatasets.has("comparison") ? (
              <Bar dataKey="comparisonDealValue" name="Comparison Deal Value" fill="#378ADD" radius={[3, 3, 0, 0]} maxBarSize={24} opacity={0.7} animationDuration={600} />
            ) : null}
            {visibleDatasets.has("lastYear") ? (
              <Bar dataKey="lastYearDealValue" name="Last Year Deal Value" fill="#EF9F27" radius={[3, 3, 0, 0]} maxBarSize={24} opacity={0.7} animationDuration={600} />
            ) : null}
            {visibleDatasets.has("current") ? (
              <Line yAxisId="right" dataKey="currentCumulativeRevenue" name="Cumulative Revenue" stroke="#378ADD" strokeWidth={2} dot={false} type="monotone" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("comparison") ? (
              <Line yAxisId="right" dataKey="comparisonCumulativeRevenue" name="Comparison Revenue" stroke="#378ADD" strokeWidth={2} dot={false} strokeDasharray="5 3" type="monotone" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("lastYear") ? (
              <Line yAxisId="right" dataKey="lastYearCumulativeRevenue" name="Last Year Revenue" stroke="#EF9F27" strokeWidth={2} dot={false} strokeDasharray="2 2" type="monotone" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("current") ? (
              <Line dataKey="currentMovingAverage" name="7-Period MA" stroke="#EF9F27" strokeWidth={1.5} dot={false} strokeDasharray="5 3" type="monotone" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("comparison") ? (
              <Line dataKey="comparisonMovingAverage" name="Comparison MA" stroke="#EF9F27" strokeWidth={1.5} dot={false} strokeDasharray="2 2" type="monotone" animationDuration={600} />
            ) : null}
            {visibleDatasets.has("lastYear") ? (
              <Line dataKey="lastYearMovingAverage" name="Last Year MA" stroke="#EF9F27" strokeWidth={1.5} dot={false} strokeDasharray="1 3" type="monotone" animationDuration={600} />
            ) : null}
            <ReferenceLine y={revenueAverage || undefined} stroke="#E24B4A" strokeDasharray="3 3" label={{ value: "Avg", position: "insideTopRight", fontSize: 11, fill: "#9ca3af" }} />
            <Brush dataKey="label" height={20} stroke="#cbd5e1" travellerWidth={8} />
          </ComposedChart>
        </ResponsiveContainer>
        <LegendPills items={revenueLegend} />
      </ChartFrame>
    </ChartErrorBoundary>
  );

  const ownerRadarChart = (
    <ChartErrorBoundary>
      <ChartFrame ariaLabel="Owner performance radar chart">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={ownerRadar} outerRadius="72%">
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
            <Tooltip content={<ChartTooltip />} />
            {ownerRadarOwners.map((owner, index) => (
              <Radar
                key={owner.ownerId}
                name={owner.ownerName}
                dataKey={owner.ownerName}
                stroke={owner.color}
                fill={owner.color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 3, fill: owner.color }}
                animationDuration={600}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
        <LegendPills items={ownerLegend} />
      </ChartFrame>
    </ChartErrorBoundary>
  );

  return (
    <div className="crm-report-grid">
      <div className="crm-report-grid__column">
        <ChartCard
          title="Source Performance"
          subtitle="Keep the existing data, but render it as a multi-series acquisition view."
          id="source-chart"
          chartRef={chartRefs.source}
          ariaLabel="Source attribution report"
          actions={chartAction("source", "Export source performance as PNG")}
        >
          {sourceAttribution.length ? sourceChart : <CrmEmptyState title="No source data" description="Try changing filters or wait for more leads to arrive." />}
        </ChartCard>
        <ChartCard
          title="Lead Journey"
          subtitle="New lead to won progression."
          id="funnel-chart"
          chartRef={chartRefs.funnel}
          ariaLabel="Lead funnel report"
          actions={chartAction("funnel", "Export lead journey as PNG")}
        >
          {leadFunnel.length ? funnelChart : <CrmEmptyState title="No funnel data" description="No leads are available for the selected scope." />}
        </ChartCard>
      </div>
      <div className="crm-report-grid__column">
        <ChartCard
          title="Win Rate Trend"
          subtitle="Stage movement over time with a target line."
          id="pipeline-chart"
          chartRef={chartRefs.pipeline}
          ariaLabel="Pipeline conversion report"
          actions={
            <>
              {datasetPills(activeDatasetIds, onToggleDataset)}
              {chartAction("pipeline", "Export win-rate trend as PNG")}
            </>
          }
        >
          {pipelineData.length ? pipelineChart : <CrmEmptyState title="No trend data" description="No lead activity exists for the selected range." />}
        </ChartCard>
        <ChartCard
          title="Owner Performance"
          subtitle="Radar chart and sortable table."
          id="owner-chart"
          chartRef={chartRefs.owner}
          ariaLabel="Owner performance report"
          actions={chartAction("owner", "Export owner performance as PNG")}
        >
          <div className="crm-report-owner-grid">
            {ownerRadar.length ? ownerRadarChart : <CrmEmptyState title="No owner data" description="Owner analytics will appear once leads are assigned." />}
            <div className="crm-report-table-wrap">
              <table className="crm-owner-table">
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th role="button" tabIndex={0} onClick={() => onOwnerSort("leads")}>Lead Count <ArrowUpDown size={12} /></th>
                    <th role="button" tabIndex={0} onClick={() => onOwnerSort("qualified")}>Qualified Leads <ArrowUpDown size={12} /></th>
                    <th role="button" tabIndex={0} onClick={() => onOwnerSort("won")}>Won Deals <ArrowUpDown size={12} /></th>
                    <th role="button" tabIndex={0} onClick={() => onOwnerSort("pipelineValue")}>Pipeline Value <ArrowUpDown size={12} /></th>
                  </tr>
                </thead>
                <tbody>
                  {ownerRows.length ? ownerRows.map((owner) => (
                    <tr key={owner.ownerId}>
                      <td>
                        <strong>{owner.ownerName}</strong>
                        <span>{owner.ownerId}</span>
                      </td>
                      <td>{owner.leads}</td>
                      <td>{owner.qualified}</td>
                      <td>{owner.won}</td>
                      <td>{formatIndianCurrency(owner.pipelineValue)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="crm-empty-row">No owners match the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ChartCard>
      </div>
      <div className="crm-report-grid__wide">
        <ChartCard
          title="Deals and Revenue"
          subtitle="Trading-style revenue view with cumulative lines."
          id="deals-chart"
          chartRef={chartRefs.revenue}
          ariaLabel="Deals and revenue report"
          actions={
            <>
              {datasetPills(activeDatasetIds, onToggleDataset)}
              {chartAction("revenue", "Export deals and revenue as PNG")}
            </>
          }
        >
          {revenueData.length ? revenueChart : <CrmEmptyState title="No revenue data" description="The selected filters returned no deals." />}
        </ChartCard>
        </div>
    </div>
  );
});

const LazyReportCharts = lazy(() => Promise.resolve({ default: ReportCharts }));

const DatasetPills = memo(({ datasets, onToggle }) => (
  <div className="crm-report-datasets" role="group" aria-label="Dataset toggles">
    {Array.from(datasets.values()).map((dataset) => (
      <button
        key={dataset.id}
        type="button"
        className={`crm-report-dataset-pill ${dataset.isVisible ? "is-active" : ""}`}
        style={dataset.isVisible ? { background: `${dataset.color}26`, borderColor: dataset.color } : undefined}
        onClick={() => onToggle(dataset.id)}
        aria-pressed={dataset.isVisible}
      >
        <span className="crm-report-dataset-pill__swatch" style={{ background: dataset.color }} />
        {dataset.label}
      </button>
    ))}
  </div>
));

const ReportTable = memo(({ rows, ariaLabel, sortConfig, onSort }) => {
  const isCompact = typeof window !== "undefined" && window.innerWidth <= 768;

  const Row = ({ index, style }) => {
    const row = rows[index];
    if (!row) return null;
    const rowStyle = {
      ...style,
      background: index % 2 === 0 ? "transparent" : "var(--color-background-secondary, #f8fafc)"
    };
    if (isCompact) {
      return (
        <div style={rowStyle} className="crm-report-card-row">
          <strong>{row.name}</strong>
          <span>{row.phone || "No phone"}</span>
          <span>
            {row.sourceLabel || row.source || "Unspecified"} · {row.sourceTypeLabel || formatReportSourceTypeLabel(row.sourceType)}
          </span>
          <span>{row.ownerName}</span>
          <span>
            {row.stageLabel || formatReportStageLabel(row.stage)} · {row.statusLabel || formatReportStatusLabel(row.status)}
          </span>
          <span>{formatIndianCurrency(row.totalDealValue || row.dealValue || 0)}</span>
        </div>
      );
    }

    return (
      <div style={rowStyle} className="crm-report-table-row crm-report-table-row--body">
        <span>
          <strong>{row.name}</strong>
          <small>{row.phone || "No phone"}</small>
        </span>
        <span>{row.sourceLabel || row.source || "Unspecified"}</span>
        <span>{row.ownerName}</span>
        <span>{row.stageLabel || formatReportStageLabel(row.stage)}</span>
        <span>{row.statusLabel || formatReportStatusLabel(row.status)}</span>
        <span>{row.leadScore}</span>
        <span>{formatIndianCurrency(row.totalDealValue || row.dealValue || 0)}</span>
      </div>
    );
  };

  const HeaderCell = ({ label, sortKey }) => (
    <button type="button" className="crm-report-table-sort" onClick={() => onSort(sortKey)}>
      <span>{label}</span>
      <ArrowUpDown size={12} />
    </button>
  );

  if (!rows.length) {
    return <CrmEmptyState title="No rows to display" description="No records matched the current filter combination." />;
  }

  return (
    <div className="crm-report-table-shell" aria-label={ariaLabel}>
      {!isCompact ? (
        <div className="crm-report-table-row crm-report-table-row--header">
          <HeaderCell label="Lead" sortKey="name" />
          <HeaderCell label="Source" sortKey="source" />
          <HeaderCell label="Owner" sortKey="ownerName" />
          <HeaderCell label="Stage" sortKey="stage" />
          <HeaderCell label="Status" sortKey="status" />
          <HeaderCell label="Score" sortKey="leadScore" />
          <HeaderCell label="Value" sortKey="totalDealValue" />
        </div>
      ) : null}
      <FixedSizeList height={isCompact ? 420 : 480} width="100%" itemCount={rows.length} itemSize={isCompact ? 120 : 52}>
        {Row}
      </FixedSizeList>
    </div>
  );
});

const ReportFiltersBar = memo(({ filters, onChange, expanded, sourceTypeOptions = [] }) => {
  const dateSummary = `${filters.startDate || "Start"} -> ${filters.endDate || "End"}`;
  return (
    <div id="crm-report-filters-advanced" className="crm-report-filters is-expanded">
      <div className="crm-report-filters__body" aria-hidden={!expanded}>
        <div className="crm-report-filters__row crm-report-filters__row--primary">
        <label className="crm-report-filter">
          <span>Source Type</span>
          <select
            value={sourceTypeOptions.some((option) => option.value === filters.sourceType) ? filters.sourceType : "all"}
            onChange={(event) => onChange({ sourceType: event.target.value })}
          >
            <option value="all">All source types</option>
            {sourceTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="crm-report-filter">
          <span>Owner</span>
          <input value={filters.ownerId} onChange={(event) => onChange({ ownerId: event.target.value })} placeholder="all" />
        </label>
        <label className="crm-report-filter">
          <span>Lead Status</span>
          <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
            <option value="all">All statuses</option>
            <option value="new">New Lead</option>
            <option value="contacted">Contacted</option>
            <option value="nurturing">Nurturing</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </label>
        <label className="crm-report-filter">
          <span>Lost Reason</span>
          <input value={filters.lostReason} onChange={(event) => onChange({ lostReason: event.target.value })} placeholder="filter lost reason" />
        </label>
        <label className="crm-report-filter crm-report-filter--date">
          <span>Date Range</span>
          <div className="crm-report-date-range">
            <CalendarDays size={14} />
            <input type="date" value={filters.startDate} onChange={(event) => onChange({ startDate: event.target.value })} />
            <span className="crm-report-date-range__separator">{"->"}</span>
            <input type="date" value={filters.endDate} onChange={(event) => onChange({ endDate: event.target.value })} />
          </div>
          <small>{dateSummary}</small>
        </label>
        <label className="crm-report-filter">
          <span>Comparison</span>
          <select value={filters.comparisonPeriod} onChange={(event) => onChange({ comparisonPeriod: event.target.value })}>
            <option value="last_period">Vs last period</option>
            <option value="last_year">Vs last year</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="crm-report-filter crm-report-filter--slider">
          <span>Min Deal {"₹"}</span>
          <div className="crm-report-slider-row">
            {(() => {
              const minDealValue = Number(filters.minDealValue || 0);
              const minDealPercent = Math.max(0, Math.min(100, (minDealValue / 100000) * 100));
              const minDealTrack = `linear-gradient(90deg, #bfdbfe 0%, #bfdbfe ${minDealPercent}%, #d1d5db ${minDealPercent}%, #d1d5db 100%)`;
              const minDealSummary = minDealValue >= 100000 ? "₹0 - ₹1,00,000+" : `${formatIndianCurrency(minDealValue)} - ₹1,00,000+`;
              return (
                <>
                  <input
                    type="range"
                    min="0"
                    max="100000"
                    step="1000"
                    value={minDealValue}
                    onChange={(event) => onChange({ minDealValue: event.target.value })}
                    style={{ background: minDealTrack }}
                  />
                  <small>{minDealSummary}</small>
                </>
              );
            })()}
          </div>
        </label>
        <label className="crm-report-filter">
          <span>Granularity</span>
          <select value={filters.granularity} onChange={(event) => onChange({ granularity: event.target.value })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="crm-report-filter">
          <span>Window</span>
          <select value={filters.windowDays} onChange={(event) => onChange({ windowDays: event.target.value })}>
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="90">90</option>
            <option value="180">180</option>
          </select>
        </label>
        </div>
      </div>
    </div>
  );
});
const ScheduleExportModal = memo(({ open, onClose, onSubmit, submitting }) => {
  const [frequency, setFrequency] = useState("daily");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="crm-report-modal" role="dialog" aria-modal="true">
      <div className="crm-report-modal__panel">
        <h3>Schedule export</h3>
        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ops@company.com" />
        </label>
        <label>
          <span>Frequency</span>
          <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <div className="crm-report-modal__actions">
          <button type="button" className="crm-btn crm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={submitting || !email.trim()}
            onClick={() => onSubmit({ email: email.trim(), frequency })}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
});

const CrmReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [stageOptions, setStageOptions] = useState([]);
  const [datasets, setDatasets] = useState(() => new Map(DATASET_DEFINITIONS.map((dataset) => [dataset.id, { ...dataset, data: null, isVisible: dataset.id === "current", isLoading: true }])));
  const [activeDatasets, setActiveDatasets] = useState(["current"]);
  const [tableSort, setTableSort] = useState({ key: "pipelineValue", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [websocketStatus, setWebsocketStatus] = useState("reconnecting");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const cacheUserId = resolveCacheUserId();
  const datasetsRef = useRef(datasets);
  const chartsRef = {
    source: useRef(null),
    funnel: useRef(null),
    pipeline: useRef(null),
    owner: useRef(null),
    revenue: useRef(null)
  };
  const currentFilters = useMemo(() => normalizeReportFilters(searchParams), [searchParams]);
  const debouncedFilters = useCrmDebouncedValue(currentFilters, 300);
  const hasHydratedCacheRef = useRef(false);
  const workerRef = useRef(null);
  const reloadIdRef = useRef(0);
  const hadDisconnectRef = useRef(false);

  const updateQuery = useCallback(
    (nextValues = {}) => {
      const nextParams = serializeReportFilters({
        ...currentFilters,
        ...nextValues
      });
      setSearchParams(nextParams, { replace: true });
    },
    [currentFilters, setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const activeFilterCount = useMemo(() => getActiveReportFilterCount(currentFilters), [currentFilters]);
  const sourceTypeOptions = useMemo(() => buildReportSourceTypeOptions(contacts), [contacts]);
  const comparisonFilters = useMemo(() => {
    const currentRange =
      debouncedFilters.startDate && debouncedFilters.endDate
        ? {
            from: new Date(debouncedFilters.startDate),
            to: new Date(debouncedFilters.endDate)
          }
        : timeRangeForWindow(debouncedFilters);
    if (!currentRange?.from || !currentRange?.to) return null;

    const spanMs = Math.max(24 * 60 * 60 * 1000, currentRange.to.getTime() - currentRange.from.getTime());
    const comparisonTo = new Date(currentRange.from.getTime() - 24 * 60 * 60 * 1000);
    const comparisonFrom = new Date(comparisonTo.getTime() - spanMs);

    return {
      ...debouncedFilters,
      startDate: formatDateInput(comparisonFrom),
      endDate: formatDateInput(comparisonTo)
    };
  }, [debouncedFilters]);
  const lastYearFilters = useMemo(() => {
    const range = debouncedFilters.startDate && debouncedFilters.endDate
      ? {
          from: new Date(debouncedFilters.startDate),
          to: new Date(debouncedFilters.endDate)
        }
      : timeRangeForWindow(debouncedFilters);
    if (!range?.from || !range?.to) return null;
    return {
      ...debouncedFilters,
      startDate: formatDateInput(new Date(range.from.getFullYear() - 1, range.from.getMonth(), range.from.getDate())),
      endDate: formatDateInput(new Date(range.to.getFullYear() - 1, range.to.getMonth(), range.to.getDate()))
    };
  }, [debouncedFilters]);

  const persistCache = useCallback(
    (nextSummary, nextContacts, nextDeals, nextStages) => {
      writeSidebarPageCache(
        REPORT_CACHE_NAMESPACE,
        {
          summary: nextSummary || null,
          contacts: Array.isArray(nextContacts) ? nextContacts : [],
          deals: Array.isArray(nextDeals) ? nextDeals : [],
          stageOptions: Array.isArray(nextStages) ? nextStages : []
        },
        { currentUserId: cacheUserId, ttlMs: REPORT_CACHE_TTL_MS }
      );
    },
    [cacheUserId]
  );

  const loadReportData = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++reloadIdRef.current;
    try {
      if (!silent) setLoading(true);
      setError("");

      const [summaryResult, stagesResult] = await Promise.all([
        crmService.getReportsSummary(),
        crmService.getPipelineStages()
      ]);
      if (summaryResult?.success === false) throw new Error(summaryResult?.error || "Failed to load CRM reports");

      const nextSummary = summaryResult?.data || {};
      const nextStages = Array.isArray(stagesResult?.data?.stages) && stagesResult.data.stages.length
        ? stagesResult.data.stages
        : [];

      const [contactRows, dealRows] = await Promise.all([
        loadAllPages({
          loader: (params) => crmService.getContacts(params),
          pageSize: REPORT_PAGE_SIZE_CONTACTS,
          maxRows: REPORT_MAX_ROWS
        }),
        loadAllPages({
          loader: (params) => crmService.getDeals(params),
          pageSize: REPORT_PAGE_SIZE_DEALS,
          maxRows: REPORT_MAX_ROWS
        })
      ]);

      if (requestId !== reloadIdRef.current) return;

      setSummary(nextSummary);
      setContacts(Array.isArray(contactRows) ? contactRows : []);
      setDeals(Array.isArray(dealRows) ? dealRows : []);
      setStageOptions(nextStages);
      persistCache(nextSummary, contactRows, dealRows, nextStages);
    } catch (loadError) {
      if (requestId !== reloadIdRef.current) return;
      setError(loadError?.message || "Failed to load CRM reports");
    } finally {
      if (requestId !== reloadIdRef.current) return;
      setLoading(false);
    }
  }, [persistCache]);

  useEffect(() => {
    if (hasHydratedCacheRef.current) return;
    hasHydratedCacheRef.current = true;
    const cached = readSidebarPageCache(REPORT_CACHE_NAMESPACE, { currentUserId: cacheUserId, allowStale: true });
    if (cached?.data) {
      setSummary(cached.data.summary || null);
      setContacts(Array.isArray(cached.data.contacts) ? cached.data.contacts : []);
      setDeals(Array.isArray(cached.data.deals) ? cached.data.deals : []);
      setStageOptions(Array.isArray(cached.data.stageOptions) ? cached.data.stageOptions : []);
      setLoading(false);
    }
    loadReportData({ silent: Boolean(cached?.data) });
  }, [cacheUserId, loadReportData]);

  useEffect(() => {
    datasetsRef.current = datasets;
  }, [datasets]);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/crmReports.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const payload = event?.data || {};
      if (!payload?.success) {
        setError(payload?.error || "Failed to compute CRM report analytics");
        return;
      }

      const nextMap = new Map();
      const appendDataset = (entry, fallbackId) => {
        const dataset = entry || null;
        if (!dataset) return;
        nextMap.set(fallbackId, {
          id: fallbackId,
          label: DATASET_DEFINITIONS.find((item) => item.id === fallbackId)?.label || fallbackId,
          color: DATASET_DEFINITIONS.find((item) => item.id === fallbackId)?.color || "#0ea44b",
          data: dataset,
          isVisible: datasetsRef.current.get(fallbackId)?.isVisible ?? fallbackId === "current",
          isLoading: false
        });
      };

      appendDataset(payload.data?.current, "current");
      appendDataset(payload.data?.comparison, "comparison");
      appendDataset(payload.data?.lastYear, "lastYear");

      setDatasets((previous) => {
        const merged = new Map(previous);
        nextMap.forEach((value, key) => {
          const previousValue = merged.get(key) || {};
          merged.set(key, { ...previousValue, ...value, isVisible: previousValue.isVisible ?? value.isVisible });
        });
        return merged;
      });
    };
    return () => worker.terminate();
  }, []);

  const activeDatasetIds = useMemo(() => activeDatasets, [activeDatasets]);
  const visibleDatasets = useMemo(() => new Set(activeDatasetIds), [activeDatasetIds]);

  const currentAnalytics = useMemo(
    () => buildReportAnalytics({ summary, contacts, deals, filters: debouncedFilters }),
    [contacts, deals, debouncedFilters, summary]
  );

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({
      summary,
      contacts,
      deals,
      filters: debouncedFilters,
      comparisonFilters,
      lastYearFilters
    });
  }, [comparisonFilters, contacts, deals, debouncedFilters, lastYearFilters, summary]);

  const currentDataset = datasets.get("current")?.data || currentAnalytics;
  const comparisonDataset = datasets.get("comparison")?.data || null;
  const lastYearDataset = datasets.get("lastYear")?.data || null;

  const ownerRowsSorted = useMemo(() => {
    const rows = Array.isArray(currentDataset?.ownerPerformance?.rows) ? [...currentDataset.ownerPerformance.rows] : [];
    const direction = tableSort.direction === "asc" ? 1 : -1;
    rows.sort((left, right) => {
      const leftValue = left?.[tableSort.key];
      const rightValue = right?.[tableSort.key];
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
    });
    return rows;
  }, [currentDataset?.ownerPerformance?.rows, tableSort]);

  useEffect(() => {
    const handleConnected = () => {
      setWebsocketStatus("connected");
      if (hadDisconnectRef.current) {
        setToast({ type: "success", message: "Realtime connection restored." });
      }
      hadDisconnectRef.current = false;
    };
    const handleDisconnected = () => {
      hadDisconnectRef.current = true;
      setWebsocketStatus("reconnecting");
    };
    const handleConnectError = () => {
      hadDisconnectRef.current = true;
      setWebsocketStatus("reconnecting");
    };
    const handleOffline = () => setWebsocketStatus("offline");
    const handleOnline = () => setWebsocketStatus(webSocketService.isConnected?.() ? "connected" : "reconnecting");
    const handleRealtimePayload = (payload = {}) => {
      if (!["lead_update", "deal_update", "stage_change", "stage_changed"].includes(String(payload?.type || "").trim())) return;
      setContacts((previous) => {
        const merged = mergeReportRealtimePayload({ contacts: previous }, payload);
        return Array.isArray(merged.contacts) ? merged.contacts : previous;
      });
      setDeals((previous) => {
        const merged = mergeReportRealtimePayload({ deals: previous }, payload);
        return Array.isArray(merged.deals) ? merged.deals : previous;
      });
    };

    setWebsocketStatus(webSocketService.isConnected?.() ? "connected" : "reconnecting");
    webSocketService.on("connected", handleConnected);
    webSocketService.on("disconnected", handleDisconnected);
    webSocketService.on("connect_error", handleConnectError);
    webSocketService.on("offline", handleOffline);
    webSocketService.on("online", handleOnline);
    webSocketService.on("crm_changed", handleRealtimePayload);
    webSocketService.on("lead_update", handleRealtimePayload);
    webSocketService.on("deal_update", handleRealtimePayload);
    webSocketService.on("stage_change", handleRealtimePayload);
    webSocketService.on("stage_changed", handleRealtimePayload);

    webSocketService.connect(cacheUserId).catch(() => setWebsocketStatus("offline"));

    return () => {
      webSocketService.off("connected", handleConnected);
      webSocketService.off("disconnected", handleDisconnected);
      webSocketService.off("connect_error", handleConnectError);
      webSocketService.off("offline", handleOffline);
      webSocketService.off("online", handleOnline);
      webSocketService.off("crm_changed", handleRealtimePayload);
      webSocketService.off("lead_update", handleRealtimePayload);
      webSocketService.off("deal_update", handleRealtimePayload);
      webSocketService.off("stage_change", handleRealtimePayload);
      webSocketService.off("stage_changed", handleRealtimePayload);
      webSocketService.disconnect();
    };
  }, [cacheUserId]);

  useEffect(() => {
    if (!summary) return;
    persistCache(summary, contacts, deals, stageOptions);
  }, [contacts, deals, persistCache, stageOptions, summary]);

  useEffect(() => {
    if (!toast?.message) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const toggleDataset = useCallback((datasetId) => {
    setActiveDatasets((previous) => {
      const isActive = previous.includes(datasetId);
      if (isActive && previous.length === 1) return previous;
      const nextActive = isActive ? previous.filter((id) => id !== datasetId) : [...previous, datasetId];
      setDatasets((currentMap) => {
        const next = new Map(currentMap);
        next.forEach((dataset, id) => {
          next.set(id, { ...dataset, isVisible: nextActive.includes(id) });
        });
        return next;
      });
      return nextActive;
    });
  }, []);

  const workerAnalytics = currentDataset || currentAnalytics;
  const comparisonAnalytics = comparisonDataset || null;
  const lastYearAnalytics = lastYearDataset || null;

  const kpiCards = useMemo(() => {
    const currentKpis = workerAnalytics?.kpis || {};
    const comparisonKpis = comparisonAnalytics?.kpis || {};
    const totalTrend = buildKpiTrend(currentKpis.totalLeads || 0, comparisonKpis.totalLeads || 0);
    const qualifiedTrend = buildKpiTrend(currentKpis.qualifiedRate || 0, comparisonKpis.qualifiedRate || 0);
    const pipelineTrend = buildKpiTrend(currentKpis.openPipeline || 0, comparisonKpis.openPipeline || 0);
    const responseTrend = buildKpiTrend(currentKpis.avgResponseTime || 0, comparisonKpis.avgResponseTime || 0);
    const totalSpark = createSparklineSeries(
      normalizeSparklineValues(takeLatestPoints((workerAnalytics?.pipelineConversion || []).map((item) => item.value || 0), 12), currentKpis.totalLeads || 0),
      "total"
    );
    const qualifiedSpark = createSparklineSeries(
      normalizeSparklineValues(takeLatestPoints((workerAnalytics?.pipelineConversion || []).map((item) => item.winRate || 0), 12), currentKpis.qualifiedRate || 0),
      "qualified"
    );
    const pipelineSpark = createSparklineSeries(
      normalizeSparklineValues(takeLatestPoints((workerAnalytics?.dealsRevenue || []).map((item) => item.cumulativeRevenue || 0), 12), currentKpis.openPipeline || 0),
      "pipeline"
    );
    const responseSpark = createSparklineSeries(
      normalizeSparklineValues(takeLatestPoints((workerAnalytics?.ownerPerformance?.rows || []).map((item) => item.responseAvg || 0), 12), currentKpis.avgResponseTime || 0),
      "response"
    );

    return [
      { title: "Total Leads", value: currentKpis.totalLeads || 0, delta: totalTrend.deltaPercent, sparkline: totalSpark, tone: "#1D9E75", format: "number" },
      { title: "Qualified Rate", value: currentKpis.qualifiedRate || 0, delta: qualifiedTrend.deltaPercent, sparkline: qualifiedSpark, tone: "#378ADD", format: "percent" },
      { title: "Pipeline Value", value: currentKpis.openPipeline || 0, delta: pipelineTrend.deltaPercent, sparkline: pipelineSpark, tone: "#EF9F27", format: "currency" },
      { title: "Average Response Time", value: currentKpis.avgResponseTime || 0, delta: responseTrend.deltaPercent, sparkline: responseSpark, tone: "#7F77DD", format: "duration" }
    ];
  }, [comparisonAnalytics, workerAnalytics]);

  const exportCsv = useCallback(() => {
    const rows = workerAnalytics?.tableRows || [];
    if (!rows.length) {
      setToast({ type: "info", message: "No rows to export." });
      return;
    }

    const headers = ["Lead", "Phone", "Source", "Owner", "Lead Stage", "Lead Status", "Lead Score", "Deal Value"];
    const csv = "﻿" + [headers, ...rows.map((row) => [
      row.name,
      row.phone,
      row.source,
      row.ownerName,
      row.stage,
      row.status,
      row.leadScore,
      Number(row.totalDealValue || row.dealValue || 0).toLocaleString("en-IN")
    ])].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildExportFilename("crm-report", "csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [workerAnalytics?.tableRows]);

  const exportChartPNG = useCallback(async (elementId, chartName) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const a = document.createElement("a");
    a.download = `${chartName}.png`;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);

  const exportPng = useCallback(
    async (key) => {
      const targetId = key === "revenue" ? "deals-chart" : `${key}-chart`;
      await exportChartPNG(targetId, `crm-report-${key}`);
    },
    [exportChartPNG]
  );

  const exportPdf = useCallback(async () => {
    try {
      setToast({ type: "info", message: "Generating PDF..." });
      const sections = ["kpi-section", "source-chart", "pipeline-chart", "funnel-chart", "deals-chart", "owner-chart"];
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      let y = 15;
      pdf.setFontSize(14);
      pdf.text(`CRM Report - ${new Date().toLocaleDateString("en-IN")}`, 14, y);
      y += 10;
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Filters: ${serializeReportFilters(currentFilters).toString() || "none"}`, 14, y);
      y += 8;
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const imgH = (canvas.height * (pageW - 28)) / canvas.width;
        if (y + imgH > 280) {
          pdf.addPage();
          y = 15;
        }
        pdf.addImage(imgData, "PNG", 14, y, pageW - 28, imgH);
        y += imgH + 6;
      }
      pdf.save(buildExportFilename("crm-report", "pdf"));
      setToast({ type: "success", message: "PDF export complete." });
    } catch (pdfError) {
      setToast({ type: "error", message: pdfError?.message || "Failed to export PDF." });
    }
  }, [currentFilters]);

  const handleScheduleExport = useCallback(async ({ email, frequency }) => {
    try {
      setScheduleSaving(true);
      const result = await crmService.scheduleReportExport?.({
        email,
        frequency,
        filters: currentFilters,
        datasets: activeDatasets
      });
      if (result?.success === false) throw new Error(result?.error || "Failed to schedule export");
      setToast({ type: "success", message: "Export schedule saved." });
      setScheduleOpen(false);
    } catch (scheduleError) {
      setToast({ type: "error", message: scheduleError?.message || "Failed to schedule export." });
    } finally {
      setScheduleSaving(false);
    }
  }, [activeDatasets, currentFilters]);

  const liveTone = websocketStatus === "connected" ? "connected" : "reconnecting";
  const dataTableRows = workerAnalytics?.tableRows || [];
  const pipelineSummary = workerAnalytics?.kpis || {};

  if (loading && !summary && !contacts.length) {
    return <CrmPageSkeleton variant="ops" />;
  }

  return (
    <div className="crm-workspace crm-workspace--reports">
      <div className="crm-workspace-header crm-report-page-header">
        <div>
          <h1>CRM Reports</h1>
          <p>Realtime analytics for leads, pipeline value, owner performance, and revenue movement.</p>
        </div>
        <div className="crm-report-header-actions">
          <CrmRealtimeStatus status={liveTone} />
          <div className="crm-report-export-menu">
            <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setExportOpen((value) => !value)} aria-label="Open export menu">
              <Download size={14} />
              Export
              <ChevronDown size={14} />
            </button>
            {exportOpen ? (
              <div className="crm-report-export-menu__panel" role="menu">
                <button type="button" onClick={exportCsv}>Export as CSV</button>
                <button type="button" onClick={exportPdf}>Export as PDF</button>
                <button type="button" onClick={() => setScheduleOpen(true)}>Schedule export</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="crm-report-toolbar">
        <div className="crm-report-toolbar__group">
          <button type="button" className="crm-btn crm-btn-secondary" onClick={() => setFiltersExpanded((value) => !value)} aria-label="Toggle filters" aria-expanded={filtersExpanded} aria-controls="crm-report-filters-advanced">
            <Filter size={14} />
            Filters
          </button>
          <button type="button" className="crm-btn crm-btn-secondary" onClick={resetFilters} aria-label="Reset filters">
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
        <span className="crm-report-filter-count crm-report-filter-count--pill">{activeFilterCount} filters active</span>
      </div>

      {filtersExpanded ? (
        <ReportFiltersBar filters={currentFilters} onChange={updateQuery} expanded sourceTypeOptions={sourceTypeOptions} />
      ) : null}

      <div id="kpi-section" className="crm-report-kpi-grid">
        {kpiCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </div>

      {error ? (
        <div className="crm-alert crm-alert-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <Suspense fallback={<ReportSectionSkeleton height={320} />}>
        <LazyReportCharts
          analytics={workerAnalytics}
          comparisonAnalytics={comparisonAnalytics}
          lastYearAnalytics={lastYearAnalytics}
          visibleDatasets={visibleDatasets}
          chartRefs={chartsRef}
          onChartCapture={exportPng}
          onToggleDataset={toggleDataset}
          activeDatasets={activeDatasets}
          ownerRows={ownerRowsSorted}
          ownerSort={tableSort}
          onOwnerSort={(key) =>
            setTableSort((previous) => ({
              key,
              direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc"
            }))
          }
        />
      </Suspense>

      <ChartCard
        title="Live Lead List"
        subtitle="Virtualized lead and deal rows for large datasets."
        chartRef={null}
        ariaLabel="Live lead data table"
        height={520}
      >
        <div className="crm-report-table-header">
          <strong>{dataTableRows.length.toLocaleString("en-IN")} rows</strong>
          <span>{formatIndianCurrency(pipelineSummary.openPipeline || 0)} pipeline value</span>
        </div>
        {dataTableRows.length ? (
          <ReportTable rows={dataTableRows} ariaLabel="CRM report data table" sortConfig={tableSort} onSort={(key) => setTableSort((previous) => ({ key, direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc" }))} />
        ) : (
          <CrmEmptyState title="No rows available" description="No records match the current report scope." />
        )}
      </ChartCard>

      <ScheduleExportModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        submitting={scheduleSaving}
        onSubmit={handleScheduleExport}
      />

      {toast?.message ? <CrmToast toast={toast} /> : null}
    </div>
  );
};

export default CrmReports;
