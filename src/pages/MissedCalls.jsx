
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./missedcall.css";
import {
  PhoneMissed, 
  RefreshCcw,
  CheckCircle, 
  Clock, 
  Phone,
  Calendar,
  User,
  ChevronRight,
  Search,
  Filter,
  Mail,
  MapPin,
  FileText,
  MessageCircle,
  ArrowLeft,
  PhoneOutgoing,
  Activity,
  AlertTriangle,
  CalendarDays,
  Send,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { apiClient } from "../services/whatsappapi";

const MissedCalls = ({ page = "all" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCallsOnlyPage = page === "calls";
  const isAutomationOnlyPage = page === "automation";
  const isOverviewOnlyPage = page === "overview";
  const variableSourceOptions = [
    { value: "callerName", label: "Caller Name" },
    { value: "callerPhone", label: "Caller Phone" },
    { value: "businessPhone", label: "Business Phone" },
    { value: "callDate", label: "Call Date" },
    { value: "callTime", label: "Call Time" },
    { value: "static", label: "Static Value" }
  ];

  const [allCalls, setAllCalls] = useState([]);
  const [filteredCalls, setFilteredCalls] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [lastOverviewUpdated, setLastOverviewUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [activeSection, setActiveSection] = useState(() => {
    if (isAutomationOnlyPage) return "automation";
    if (isOverviewOnlyPage) return "overview";
    return "calls";
  });
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [templateOptions, setTemplateOptions] = useState([]);
  const [automationSettings, setAutomationSettings] = useState({
    missedCallAutomationEnabled: true,
    missedCallDelayMinutes: 5,
    missedCallAutomationMode: "immediate",
    missedCallNightHour: 21,
    missedCallNightMinute: 0,
    missedCallTimezone: "Asia/Kolkata",
    missedCallTemplateName: "",
    missedCallTemplateLanguage: "en_US",
    missedCallTemplateVariables: []
  });
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const extractVariableIndexesFromText = (text) => {
    if (!text) return [];
    const regex = /\{\{(\d+)\}\}/g;
    const found = new Set();
    let match;
    while ((match = regex.exec(String(text))) !== null) {
      const idx = Number(match[1]);
      if (Number.isFinite(idx) && idx > 0) found.add(idx);
    }
    return Array.from(found).sort((a, b) => a - b);
  };

  const resolveTemplateBodyText = (template) => {
    if (!template) return "";
    if (template.content?.body) return String(template.content.body);
    if (Array.isArray(template.components)) {
      const body = template.components.find((c) => String(c.type || "").toUpperCase() === "BODY");
      if (body?.text) return String(body.text);
    }
    return String(template.text || "");
  };

  const normalizeTemplateVariables = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, idx) => ({
        index: Number.isFinite(Number(item?.index)) ? Number(item.index) : idx + 1,
        source: String(item?.source || item?.sourceType || "callerName").trim() || "callerName",
        value: String(item?.value || item?.staticValue || "").trim()
      }))
      .sort((a, b) => a.index - b.index);
  };

  const parseTemplateSelection = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return { name: "", language: "" };
    const separator = "||";
    const splitAt = value.lastIndexOf(separator);
    if (splitAt === -1) return { name: value, language: "" };
    return {
      name: value.slice(0, splitAt).trim(),
      language: value.slice(splitAt + separator.length).trim()
    };
  };

  const buildTemplateVariableMappings = (template, existingMappings = []) => {
    const indexes = Array.isArray(template?.variableIndexes)
      ? template.variableIndexes
      : [];
    if (!indexes.length) return [];

    const existing = normalizeTemplateVariables(existingMappings);
    return indexes.map((index) => {
      const match = existing.find((item) => Number(item.index) === Number(index));
      if (match) {
        return {
          index,
          source: String(match.source || "callerName"),
          value: String(match.value || "")
        };
      }
      return { index, source: "callerName", value: "" };
    });
  };
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    status: "missed",
    duration: "",
    callType: "inbound",
    location: "",
    notes: "",
    email: "",
    priority: "medium"
  });

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      if (activeFilter === "missed" || activeFilter === "resolved") {
        params.status = activeFilter;
      }
      if (searchQuery?.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await apiClient.getMissedCalls(params);
      const rows = Array.isArray(response?.data?.data) ? response.data.data : [];

      const mapped = rows.map((row) => {
        const calledAt = row.calledAt || row.createdAt || new Date().toISOString();
        const automation = row.automation || {};
        return {
          id: row._id,
          phone: row.fromNumber || "",
          name: row.callerName || row.fromNumber || "Unknown",
          date: new Date(calledAt).toISOString().split('T')[0],
          displayDate: formatDate(calledAt),
          time: new Date(calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: row.status || "missed",
          duration: row.payload?.duration || "-",
          callType: row.direction || "inbound",
          location: row.payload?.location || "",
          notes: row.notes || row.payload?.notes || "",
          email: row.payload?.email || "",
          priority: row.payload?.priority || "medium",
          automationEnabled: automation.enabled !== false,
          automationStatus: automation.status || "pending",
          automationTemplate: automation.templateName || "-",
          automationLanguage: automation.templateLanguage || "en_US",
          automationDelayMinutes: Number.isFinite(Number(automation.delayMinutes))
            ? Number(automation.delayMinutes)
            : 0,
          automationNextRunAt: automation.nextRunAt || null,
          automationSentAt: automation.sentAt || null,
          automationAttempts: Number.isFinite(Number(automation.attempts))
            ? Number(automation.attempts)
            : 0,
          automationLastError: automation.lastError || ""
        };
      });

      setAllCalls(mapped);
      setFilteredCalls(mapped);
      setLastOverviewUpdated(new Date());
    } catch (error) {
      setAllCalls([]);
      setFilteredCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAutomationSettings = async () => {
    setSettingsLoading(true);
    setSettingsError("");
    try {
      const [settingsRes, templatesRes] = await Promise.all([
        apiClient.getMissedCallSettings(),
        apiClient.getTemplates({ status: 'approved' })
      ]);

      const settingsData = settingsRes?.data?.data || {};
      const templates = Array.isArray(templatesRes?.data?.data) ? templatesRes.data.data : [];

      const normalizedTemplates = templates
        .map((tpl) => {
          const bodyText = resolveTemplateBodyText(tpl);
          return {
            name: String(tpl.name || "").trim(),
            language: String(tpl.language || tpl.languageCode || "en_US").trim() || "en_US",
            bodyText,
            variableIndexes: extractVariableIndexesFromText(bodyText)
          };
        })
        .filter((tpl) => tpl.name);

      setTemplateOptions(normalizedTemplates);
      const savedVariables = normalizeTemplateVariables(settingsData.missedCallTemplateVariables);
      const savedTemplateName = String(settingsData.missedCallTemplateName || '').trim();
      const savedTemplateLanguage = String(settingsData.missedCallTemplateLanguage || 'en_US').trim() || 'en_US';
      const selectedTemplate =
        normalizedTemplates.find(
          (tpl) =>
            tpl.name === savedTemplateName &&
            tpl.language === savedTemplateLanguage
        ) ||
        normalizedTemplates.find((tpl) => tpl.name === savedTemplateName);

      setAutomationSettings({
        missedCallAutomationEnabled: settingsData.missedCallAutomationEnabled !== false,
        missedCallDelayMinutes: Number.isFinite(Number(settingsData.missedCallDelayMinutes))
          ? Number(settingsData.missedCallDelayMinutes)
          : 5,
        missedCallAutomationMode:
          String(settingsData.missedCallAutomationMode || "immediate").toLowerCase() === "night_batch"
            ? "night_batch"
            : "immediate",
        missedCallNightHour: Number.isFinite(Number(settingsData.missedCallNightHour))
          ? Math.max(0, Math.min(23, Number(settingsData.missedCallNightHour)))
          : 21,
        missedCallNightMinute: Number.isFinite(Number(settingsData.missedCallNightMinute))
          ? Math.max(0, Math.min(59, Number(settingsData.missedCallNightMinute)))
          : 0,
        missedCallTimezone: String(settingsData.missedCallTimezone || "Asia/Kolkata").trim() || "Asia/Kolkata",
        missedCallTemplateName: savedTemplateName,
        missedCallTemplateLanguage: savedTemplateLanguage,
        missedCallTemplateVariables: selectedTemplate
          ? buildTemplateVariableMappings(selectedTemplate, savedVariables)
          : savedVariables
      });
    } catch (error) {
      setSettingsError(
        error?.response?.data?.error || "Failed to load missed call automation settings"
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
    loadAutomationSettings();
  }, []);

  useEffect(() => {
    if (isCallsOnlyPage) {
      setViewMode((prev) => (prev === "details" ? prev : "list"));
      setActiveSection((prev) => (prev === "details" ? prev : "calls"));
      return;
    }

    if (isOverviewOnlyPage) {
      setViewMode("list");
      setActiveSection("overview");
      return;
    }

    if (isAutomationOnlyPage) {
      setViewMode("list");
      setActiveSection("automation");
      return;
    }

    const pathname = String(location.pathname || "").toLowerCase();
    if (pathname.startsWith("/missedcalls/automation")) {
      setViewMode("list");
      setActiveSection("automation");
      return;
    }
    if (pathname.startsWith("/missedcalls/overview")) {
      setViewMode("list");
      setActiveSection("overview");
      return;
    }
    if (pathname.startsWith("/missedcalls/calls") || pathname === "/missedcalls") {
      setViewMode((prev) => (prev === "details" ? prev : "list"));
      setActiveSection((prev) => (prev === "details" ? prev : "calls"));
    }
  }, [location.pathname, isCallsOnlyPage, isAutomationOnlyPage, isOverviewOnlyPage]);

  const handleSettingsChange = (key, value) => {
    setAutomationSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleTemplateChange = (templateName) => {
    const parsed = parseTemplateSelection(templateName);
    const selectedTemplate =
      templateOptions.find(
        (tpl) =>
          tpl.name === parsed.name &&
          tpl.language === parsed.language
      ) || templateOptions.find((tpl) => tpl.name === parsed.name);

    setAutomationSettings((prev) => ({
      ...prev,
      missedCallTemplateName: selectedTemplate?.name || parsed.name,
      missedCallTemplateLanguage:
        selectedTemplate?.language ||
        parsed.language ||
        prev.missedCallTemplateLanguage ||
        "en_US",
      missedCallTemplateVariables: buildTemplateVariableMappings(
        selectedTemplate,
        prev.missedCallTemplateVariables
      )
    }));
  };

  const handleVariableMappingChange = (index, key, value) => {
    setAutomationSettings((prev) => ({
      ...prev,
      missedCallTemplateVariables: (prev.missedCallTemplateVariables || []).map((item) =>
        Number(item.index) === Number(index)
          ? {
              ...item,
              [key]: value,
              ...(key === "source" && value !== "static" ? { value: "" } : {})
            }
          : item
      )
    }));
  };

  const saveAutomationSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      const payload = {
        missedCallAutomationEnabled: Boolean(automationSettings.missedCallAutomationEnabled),
        missedCallDelayMinutes: Math.max(0, Number(automationSettings.missedCallDelayMinutes) || 0),
        missedCallAutomationMode:
          String(automationSettings.missedCallAutomationMode || "").toLowerCase() === "night_batch"
            ? "night_batch"
            : "immediate",
        missedCallNightHour: Math.max(0, Math.min(23, Number(automationSettings.missedCallNightHour) || 0)),
        missedCallNightMinute: Math.max(0, Math.min(59, Number(automationSettings.missedCallNightMinute) || 0)),
        missedCallTimezone: String(automationSettings.missedCallTimezone || "Asia/Kolkata").trim() || "Asia/Kolkata",
        missedCallTemplateName: String(automationSettings.missedCallTemplateName || '').trim(),
        missedCallTemplateLanguage: String(automationSettings.missedCallTemplateLanguage || 'en_US').trim() || 'en_US',
        missedCallTemplateVariables: normalizeTemplateVariables(automationSettings.missedCallTemplateVariables)
      };

      const res = await apiClient.updateMissedCallSettings(payload);
      const updated = res?.data?.data || payload;
      setAutomationSettings((prev) => ({
        ...prev,
        missedCallAutomationEnabled: updated.missedCallAutomationEnabled !== false,
        missedCallDelayMinutes: Number.isFinite(Number(updated.missedCallDelayMinutes))
          ? Number(updated.missedCallDelayMinutes)
          : prev.missedCallDelayMinutes,
        missedCallAutomationMode:
          String(updated.missedCallAutomationMode || prev.missedCallAutomationMode || "immediate").toLowerCase() === "night_batch"
            ? "night_batch"
            : "immediate",
        missedCallNightHour: Number.isFinite(Number(updated.missedCallNightHour))
          ? Math.max(0, Math.min(23, Number(updated.missedCallNightHour)))
          : prev.missedCallNightHour,
        missedCallNightMinute: Number.isFinite(Number(updated.missedCallNightMinute))
          ? Math.max(0, Math.min(59, Number(updated.missedCallNightMinute)))
          : prev.missedCallNightMinute,
        missedCallTimezone:
          String(updated.missedCallTimezone || prev.missedCallTimezone || "Asia/Kolkata").trim() || "Asia/Kolkata",
        missedCallTemplateName: String(updated.missedCallTemplateName || prev.missedCallTemplateName || '').trim(),
        missedCallTemplateLanguage: String(updated.missedCallTemplateLanguage || prev.missedCallTemplateLanguage || 'en_US').trim() || 'en_US',
        missedCallTemplateVariables: normalizeTemplateVariables(
          updated.missedCallTemplateVariables || prev.missedCallTemplateVariables
        )
      }));
      setSettingsMessage("Missed call automation settings updated");
    } catch (error) {
      setSettingsError(
        error?.response?.data?.error || "Failed to update missed call automation settings"
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const applyFilter = (filter) => {
    setActiveFilter(filter);
    let filtered = [...allCalls];

    if (filter === "inbound") {
      filtered = filtered.filter(call => call.callType === "inbound");
    } else if (filter === "outbound") {
      filtered = filtered.filter(call => call.callType === "outbound");
    } else if (filter === "missed") {
      filtered = filtered.filter(call => call.status === "missed");
    } else if (filter === "resolved") {
      filtered = filtered.filter(call => call.status === "resolved");
    } else if (filter === "today") {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(call => call.date === today);
    } else if (filter === "pending") {
      filtered = filtered.filter(call => call.automationStatus === "pending");
    } else if (filter === "processing") {
      filtered = filtered.filter(call => call.automationStatus === "processing");
    } else if (filter === "sent") {
      filtered = filtered.filter(call => call.automationStatus === "sent");
    } else if (filter === "failed") {
      filtered = filtered.filter(call => call.automationStatus === "failed");
    }

    // Apply date range filter
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(call => {
        const callDate = new Date(call.date);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return callDate >= startDate && callDate <= endDate;
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(call =>
        call.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredCalls(filtered);
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyDateFilter = () => {
    fetchCalls();
  };

  const clearDateFilter = () => {
    setDateRange({
      startDate: "",
      endDate: ""
    });
    fetchCalls();
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    let filtered = [...allCalls];
    
    // Apply active filter first
    if (activeFilter === "inbound") {
      filtered = filtered.filter(call => call.callType === "inbound");
    } else if (activeFilter === "outbound") {
      filtered = filtered.filter(call => call.callType === "outbound");
    } else if (activeFilter === "missed") {
      filtered = filtered.filter(call => call.status === "missed");
    } else if (activeFilter === "resolved") {
      filtered = filtered.filter(call => call.status === "resolved");
    } else if (activeFilter === "today") {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(call => call.date === today);
    } else if (activeFilter === "pending") {
      filtered = filtered.filter(call => call.automationStatus === "pending");
    } else if (activeFilter === "processing") {
      filtered = filtered.filter(call => call.automationStatus === "processing");
    } else if (activeFilter === "sent") {
      filtered = filtered.filter(call => call.automationStatus === "sent");
    } else if (activeFilter === "failed") {
      filtered = filtered.filter(call => call.automationStatus === "failed");
    }
    
    // Apply date range filter
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(call => {
        const callDate = new Date(call.date);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        return callDate >= startDate && callDate <= endDate;
      });
    }
    
    // Apply search query
    if (query) {
      filtered = filtered.filter(call =>
        call.phone.toLowerCase().includes(query.toLowerCase()) ||
        call.name.toLowerCase().includes(query.toLowerCase()) ||
        call.location.toLowerCase().includes(query.toLowerCase()) ||
        call.email?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    setFilteredCalls(filtered);
  };

  const resolveCall = async (callId) => {
    try {
      await apiClient.resolveMissedCall(callId);
      await fetchCalls();
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall((prev) => (prev ? { ...prev, status: "resolved" } : prev));
      }
    } catch (error) {
      // no-op
    }
  };

  const runNow = async (callId) => {
    try {
      await apiClient.runMissedCallNow(callId);
      await fetchCalls();
      if (selectedCall && selectedCall.id === callId) {
        setSelectedCall((prev) =>
          prev
            ? {
                ...prev,
                automationStatus: "pending",
                automationNextRunAt: new Date().toISOString(),
                automationLastError: ""
              }
            : prev
        );
      }
    } catch (error) {
      // no-op
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newCall = {
      id: allCalls.length + 1,
      ...formData,
      displayDate: formatDate(formData.date)
    };
    
    const updatedCalls = [newCall, ...allCalls];
    setAllCalls(updatedCalls);
    setFilteredCalls(updatedCalls);
    setShowForm(false);
    resetForm();
    applyFilter(activeFilter);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      status: "missed",
      duration: "",
      callType: "inbound",
      location: "",
      notes: "",
      email: "",
      priority: "medium"
    });
  };

  const handleViewDetails = (call) => {
    setSelectedCall(call);
    setViewMode("details");
    setActiveSection("details");
  };

  const stats = {
    total: allCalls.length,
    missed: allCalls.filter(call => call.status === "missed").length,
    resolved: allCalls.filter(call => call.status === "resolved").length,
    inbound: allCalls.filter(call => call.callType === "inbound").length,
    outbound: allCalls.filter(call => call.callType === "outbound").length,
    today: allCalls.filter(call => call.date === new Date().toISOString().split('T')[0]).length,
    pending: allCalls.filter(call => call.automationStatus === "pending").length,
    processing: allCalls.filter(call => call.automationStatus === "processing").length,
    sent: allCalls.filter(call => call.automationStatus === "sent").length,
    failedAutomation: allCalls.filter(call => call.automationStatus === "failed").length
  };

  const safePercent = (value, total) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  const resolvedRate = safePercent(stats.resolved, stats.total);
  const missedRate = safePercent(stats.missed, stats.total);
  const inboundRate = safePercent(stats.inbound, stats.total);
  const outboundRate = safePercent(stats.outbound, stats.total);
  const automationSentRate = safePercent(stats.sent, stats.missed);
  const automationFailedRate = safePercent(stats.failedAutomation, stats.missed);
  const pendingRate = safePercent(stats.pending + stats.processing, stats.missed);
  const pieTotal = Math.max(1, stats.sent + stats.failedAutomation + stats.pending + stats.processing);
  const sentPct = Math.round((stats.sent / pieTotal) * 100);
  const failedPct = Math.round((stats.failedAutomation / pieTotal) * 100);
  const processingPct = Math.round((stats.processing / pieTotal) * 100);
  const pendingPct = Math.max(0, 100 - sentPct - failedPct - processingPct);

  const pieStyle = {
    background: `conic-gradient(
      #22c55e 0 ${sentPct}%,
      #ef4444 ${sentPct}% ${sentPct + failedPct}%,
      #3b82f6 ${sentPct + failedPct}% ${sentPct + failedPct + processingPct}%,
      #f59e0b ${sentPct + failedPct + processingPct}% 100%
    )`
  };

  const topTemplates = Object.entries(
    allCalls.reduce((acc, call) => {
      const key = String(call.automationTemplate || "").trim();
      if (!key || key === "-") return acc;
      if (!acc[key]) acc[key] = 0;
      acc[key] += 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentAutomationRuns = [...allCalls]
    .filter((call) => call.automationStatus)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const isSplitPageMode = isCallsOnlyPage || isAutomationOnlyPage;
  const showSectionTabs = true;
  const showAutomationSection = isAutomationOnlyPage || activeSection === "automation";
  const showOverviewSection = (isOverviewOnlyPage || (!isAutomationOnlyPage && activeSection === "overview"));
  const showCallsSection = !isOverviewOnlyPage && (isCallsOnlyPage || activeSection === "calls") && viewMode !== "details";
  const showDetailsSection =
    !isAutomationOnlyPage &&
    !isOverviewOnlyPage &&
    (activeSection === "details" || viewMode === "details") &&
    selectedCall;

  const handleSectionChange = (section) => {
    if (section === "details" && !selectedCall) return;
    if (section === "automation") {
      navigate("/missedcalls/automation");
    } else if (section === "overview") {
      navigate("/missedcalls/overview");
    } else if (section === "calls") {
      navigate("/missedcalls/calls");
    }
    setActiveSection(section);
    if (section === "details") {
      setViewMode("details");
      return;
    }
    setViewMode("list");
  };

  return (
    <div className="missedcalls-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h2>
            <PhoneMissed size={24} className="header-icon" />
            Missed Calls
          </h2>
          <p>Track and manage all inbound and outbound calls</p>
        </div>
       
      </div>

      {showSectionTabs && (
        <div className="missed-calls-sections-nav">
          <button
            className={`missed-calls-section-tab ${activeSection === "calls" ? "active" : ""}`}
            onClick={() => handleSectionChange("calls")}
            type="button"
          >
            Calls
          </button>
          <button
            className={`missed-calls-section-tab ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => handleSectionChange("overview")}
            type="button"
          >
            Overview
          </button>
          <button
            className={`missed-calls-section-tab ${activeSection === "automation" ? "active" : ""}`}
            onClick={() => handleSectionChange("automation")}
            type="button"
          >
            Automation Settings
          </button>
          {!isSplitPageMode && (
            <>
              <button
                className={`missed-calls-section-tab ${activeSection === "details" ? "active" : ""}`}
                onClick={() => handleSectionChange("details")}
                type="button"
                disabled={!selectedCall}
                title={selectedCall ? "Open selected call details" : "Select a call to view details"}
              >
                Details
              </button>
            </>
          )}
        </div>
      )}

      {showAutomationSection && (
      <section className="missed-calls-section-card">
        <div className="missed-calls-section-header">
          <h3>Automation Settings</h3>
          <p>Configure how missed calls should be auto-processed and replied.</p>
        </div>
      <div className="automation-settings-card">
        <div className="automation-settings-header">
          <h3>Missed Call Automation Settings</h3>
          {settingsLoading ? <span className="settings-muted">Loading...</span> : null}
        </div>
        <div className="automation-settings-grid">
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={automationSettings.missedCallAutomationEnabled}
              onChange={(e) => handleSettingsChange("missedCallAutomationEnabled", e.target.checked)}
            />
            <span>Enable auto-reply for missed calls</span>
          </label>

          <label className="settings-field">
            <span>Delay (minutes)</span>
            <input
              type="number"
              min="0"
              max="1440"
              value={automationSettings.missedCallDelayMinutes}
              onChange={(e) => handleSettingsChange("missedCallDelayMinutes", e.target.value)}
            />
          </label>

          <label className="settings-field">
            <span>Mode</span>
            <select
              value={automationSettings.missedCallAutomationMode}
              onChange={(e) => handleSettingsChange("missedCallAutomationMode", e.target.value)}
            >
              <option value="immediate">Immediate (delay based)</option>
              <option value="night_batch">Night Batch (fixed time)</option>
            </select>
          </label>

          {automationSettings.missedCallAutomationMode === "night_batch" ? (
            <>
              <label className="settings-field">
                <span>Night Hour (0-23)</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={automationSettings.missedCallNightHour}
                  onChange={(e) => handleSettingsChange("missedCallNightHour", e.target.value)}
                />
              </label>

              <label className="settings-field">
                <span>Night Minute (0-59)</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={automationSettings.missedCallNightMinute}
                  onChange={(e) => handleSettingsChange("missedCallNightMinute", e.target.value)}
                />
              </label>

              <label className="settings-field">
                <span>Timezone</span>
                <input
                  type="text"
                  value={automationSettings.missedCallTimezone}
                  onChange={(e) => handleSettingsChange("missedCallTimezone", e.target.value)}
                  placeholder="Asia/Kolkata"
                />
              </label>
            </>
          ) : null}

          <label className="settings-field">
            <span>Template</span>
            <select
              value={
                automationSettings.missedCallTemplateName
                  ? `${automationSettings.missedCallTemplateName}||${automationSettings.missedCallTemplateLanguage || "en_US"}`
                  : ""
              }
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              <option value="">Select template</option>
              {templateOptions.map((tpl, idx) => (
                <option
                  key={`${tpl.name}-${tpl.language}-${idx}`}
                  value={`${tpl.name}||${tpl.language}`}
                >
                  {tpl.name} ({tpl.language})
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Language</span>
            <input
              type="text"
              value={automationSettings.missedCallTemplateLanguage}
              onChange={(e) => handleSettingsChange("missedCallTemplateLanguage", e.target.value)}
              placeholder="en_US"
            />
          </label>
        </div>

        {(automationSettings.missedCallTemplateVariables || []).length > 0 ? (
          <div className="settings-variable-mapping">
            <h4>Template Variable Mapping</h4>
            <p>
              Map each template variable to missed call data. Static value only applies
              when source is <code>Static Value</code>.
            </p>
            <div className="settings-variable-list">
              {(automationSettings.missedCallTemplateVariables || []).map((variable) => (
                <div key={`missed-call-var-${variable.index}`} className="settings-variable-row">
                  <div className="settings-variable-token">{`{{${variable.index}}}`}</div>
                  <select
                    value={variable.source}
                    onChange={(e) =>
                      handleVariableMappingChange(variable.index, "source", e.target.value)
                    }
                  >
                    {variableSourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    disabled={variable.source !== "static"}
                    value={variable.value || ""}
                    onChange={(e) =>
                      handleVariableMappingChange(variable.index, "value", e.target.value)
                    }
                    placeholder={
                      variable.source === "static"
                        ? "Enter static value"
                        : "Enabled only for Static Value"
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="automation-settings-actions">
          <button
            type="button"
            className="primary-btn"
            onClick={saveAutomationSettings}
            disabled={settingsSaving || settingsLoading}
          >
            {settingsSaving ? "Saving..." : "Save Settings"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={loadAutomationSettings}
            disabled={settingsSaving}
          >
            Reload
          </button>
          {settingsMessage ? <span className="settings-success">{settingsMessage}</span> : null}
          {settingsError ? <span className="settings-error">{settingsError}</span> : null}
        </div>
      </div>
      </section>
      )}

      {/* Stats */}
      {showOverviewSection && (
      <section className="missed-calls-section-card dashboard-shell">
        <section className="dash-hero">
          <div>
            <p className="dash-eyebrow"><Sparkles size={14} /> Automation Command Center</p>
            <h1>Missed Calls and Template Automation Overview</h1>
            <p className="dash-subtitle">Live performance snapshot across missed calls, queue states, and template delivery.</p>
          </div>
          <button className="dash-refresh" onClick={fetchCalls}>
            <RefreshCcw size={16} /> Refresh
          </button>
        </section>

        <section className="dash-kpi-grid">
          <article className="dash-kpi-card">
            <div className="kpi-icon"><PhoneMissed size={18} /></div>
            <span>Total Calls</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="dash-kpi-card">
            <div className="kpi-icon danger"><AlertTriangle size={18} /></div>
            <span>Open Missed</span>
            <strong>{stats.missed}</strong>
          </article>
          <article className="dash-kpi-card">
            <div className="kpi-icon success"><CheckCircle size={18} /></div>
            <span>Resolved</span>
            <strong>{stats.resolved}</strong>
          </article>
          <article className="dash-kpi-card">
            <div className="kpi-icon"><Send size={18} /></div>
            <span>Template Sends</span>
            <strong>{stats.sent}</strong>
          </article>
          <article className="dash-kpi-card">
            <div className="kpi-icon warning"><Clock size={18} /></div>
            <span>Pending Queue</span>
            <strong>{stats.pending + stats.processing}</strong>
          </article>
          <article className="dash-kpi-card">
            <div className="kpi-icon"><CalendarDays size={18} /></div>
            <span>Today Calls</span>
            <strong>{stats.today}</strong>
          </article>
        </section>

        <section className="dash-main-grid">
          <article className="dash-panel">
            <div className="dash-panel-head">
              <h3>Automation Status Split</h3>
              <p>Missed call template lifecycle</p>
            </div>
            <div className="pie-wrap">
              <div className="pie-ring" style={pieStyle}>
                <div className="pie-center">
                  <strong>{stats.sent}</strong>
                  <span>Sent</span>
                </div>
              </div>
              <div className="pie-legend">
                <div><i className="dot sent" /> Sent {stats.sent}</div>
                <div><i className="dot failed" /> Failed {stats.failedAutomation}</div>
                <div><i className="dot processing" /> Processing {stats.processing}</div>
                <div><i className="dot pending" /> Pending {stats.pending}</div>
              </div>
            </div>
          </article>

          <article className="dash-panel">
            <div className="dash-panel-head">
              <h3>Call Distribution</h3>
              <p>Inbound and outbound activity</p>
            </div>
            <div className="overview-progress-list">
              <div className="overview-progress-row">
                <span>Inbound</span>
                <div className="overview-progress-bar"><div style={{ width: `${inboundRate}%` }} /></div>
                <strong>{inboundRate}%</strong>
              </div>
              <div className="overview-progress-row">
                <span>Outbound</span>
                <div className="overview-progress-bar"><div style={{ width: `${outboundRate}%` }} /></div>
                <strong>{outboundRate}%</strong>
              </div>
              <div className="overview-progress-row">
                <span>Missed</span>
                <div className="overview-progress-bar"><div style={{ width: `${missedRate}%` }} /></div>
                <strong>{missedRate}%</strong>
              </div>
              <div className="overview-progress-row">
                <span>Resolved</span>
                <div className="overview-progress-bar"><div style={{ width: `${resolvedRate}%` }} /></div>
                <strong>{resolvedRate}%</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="dash-bottom-grid">
          <article className="dash-panel">
            <div className="dash-panel-head">
              <h3>Recent Automation Activity</h3>
              <p>Latest call queue activity</p>
            </div>
            <div className="recent-list">
              {recentAutomationRuns.length ? recentAutomationRuns.map((row) => (
                <div key={`recent-${row.id}`} className="recent-item">
                  <div>
                    <strong>{row.name}</strong>
                    <p>{row.phone}</p>
                  </div>
                  <div className="recent-meta">
                    <span className={`badge ${row.automationStatus || "pending"}`}>
                      {row.automationStatus || "pending"}
                    </span>
                  </div>
                </div>
              )) : <p className="dash-empty">No automation activity yet</p>}
            </div>
          </article>

          <article className="dash-panel">
            <div className="dash-panel-head">
              <h3>Top Templates</h3>
              <p>Most used automation templates</p>
            </div>
            <div className="template-list">
              {topTemplates.length ? topTemplates.map((template) => (
                <div key={template.name} className="template-item">
                  <span>{template.name}</span>
                  <strong>{template.count}</strong>
                </div>
              )) : <p className="dash-empty">No templates used yet</p>}
            </div>
          </article>

          {/* <article className="dash-panel accent">
            <div className="dash-panel-head">
              <h3>Live Health</h3>
              <p>Operational confidence index</p>
            </div>
            <div className="health-stack">
              <div className="health-line">
                <Activity size={16} />
                <span>Delivery Strength</span>
                <strong>{Math.max(0, 100 - failedPct)}%</strong>
              </div>
              <div className="health-line">
                <TrendingUp size={16} />
                <span>Automation Efficiency</span>
                <strong>{sentPct}%</strong>
              </div>
              <div className="health-line muted">
                <Clock size={16} />
                <span>Last Updated</span>
                <strong>{formatDateTime(lastOverviewUpdated)}</strong>
              </div>
            </div>
          </article> */}
        </section>
      </section>
      )}
      {/* Main Content (List/Grid View) */}
      {showCallsSection && (
        <section className="missed-calls-section-card">
          <div className="missed-calls-section-header">
            <h3>Calls</h3>
            <p>Search, filter and review inbound/outbound missed call records.</p>
          </div>
          {/* Controls */}
          <div className="controls-container">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by phone, name, email, or location..."
                value={searchQuery}
                onChange={handleSearch}
                className="search-input"
              />
            </div>

            {/* Date Range Filter */}
            <div className="date-filter-container">
              <div className="filter-group">
                <Calendar size={16} />
                <span>Filter by Date Range:</span>
              </div>
              <div className="date-range-inputs">
                <input
                  type="date"
                  name="startDate"
                  value={dateRange.startDate}
                  onChange={handleDateRangeChange}
                  className="date-input"
                  placeholder="Start Date"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  name="endDate"
                  value={dateRange.endDate}
                  onChange={handleDateRangeChange}
                  className="date-input"
                  placeholder="End Date"
                />
                <button 
                  className="date-filter-btn primary"
                  onClick={applyDateFilter}
                >
                  Apply
                </button>
                <button 
                  className="date-filter-btn secondary"
                  onClick={clearDateFilter}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Call Type & Status Filters */}
            <div className="filters-container">
              <div className="filter-group">
                <Filter size={16} />
                <span>Filter by:</span>
              </div>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${activeFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setActiveFilter("all");
                    setFilteredCalls(allCalls);
                  }}
                >
                  All ({stats.total})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "inbound" ? "active" : ""}`}
                  onClick={() => applyFilter("inbound")}
                >
                  Inbound ({stats.inbound})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "outbound" ? "active" : ""}`}
                  onClick={() => applyFilter("outbound")}
                >
                  Outbound ({stats.outbound})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "missed" ? "active" : ""}`}
                  onClick={() => applyFilter("missed")}
                >
                  Missed ({stats.missed})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "resolved" ? "active" : ""}`}
                  onClick={() => applyFilter("resolved")}
                >
                  Resolved ({stats.resolved})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "today" ? "active" : ""}`}
                  onClick={() => applyFilter("today")}
                >
                  Today ({stats.today})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "pending" ? "active" : ""}`}
                  onClick={() => applyFilter("pending")}
                >
                  Queue Pending ({stats.pending})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "processing" ? "active" : ""}`}
                  onClick={() => applyFilter("processing")}
                >
                  Processing ({stats.processing})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "sent" ? "active" : ""}`}
                  onClick={() => applyFilter("sent")}
                >
                  Sent ({stats.sent})
                </button>
                <button
                  className={`filter-btn ${activeFilter === "failed" ? "active" : ""}`}
                  onClick={() => applyFilter("failed")}
                >
                  Failed ({stats.failedAutomation})
                </button>
              </div>
            </div>
          </div>

          {/* Calls List */}
          <div className="calls-container">
            {loading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading calls...</p>
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="empty-state">
                <PhoneMissed size={48} className="empty-icon" />
                <h3>No calls found</h3>
                <p>Try changing your filters or search terms</p>
              </div>
            ) : (
              <div className="calls-list">
                <table className="calls-table">
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Phone</th>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Automation</th>
                      <th>Template</th>
                      <th>Next Run</th>
                      <th>Attempts</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCalls.map((call) => (
                      <tr key={call.id} className="call-row">
                        <td>
                          <div className="caller-cell">
                            <div className="caller-avatar small">
                              <User size={14} />
                            </div>
                            <div>
                              <div className="caller-name">{call.name}</div>
                              {call.email && (
                                <div className="caller-email">{call.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="phone-cell">
                            <Phone size={12} />
                            {call.phone}
                          </div>
                        </td>
                        <td>
                          <div className="datetime-cell">
                            <div>{call.displayDate}</div>
                            <div className="time">{call.time}</div>
                          </div>
                        </td>
                        <td>
                          <div className={`calltype-cell ${call.callType}`}>
                            {call.callType === "inbound" ? (
                              <>
                                <PhoneMissed size={12} /> Inbound
                              </>
                            ) : (
                              <>
                                <PhoneOutgoing size={12} /> Outbound
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={`status-cell ${call.status}`}>
                            {call.status === "resolved" ? (
                              <>
                                <CheckCircle size={12} /> Resolved
                              </>
                            ) : (
                              <>
                                <Clock size={12} /> Missed
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={`status-cell ${call.automationStatus || "pending"}`}>
                            {call.automationStatus || "pending"}
                          </div>
                        </td>
                        <td>
                          <div className="duration-cell">
                            {call.automationTemplate || "-"}
                          </div>
                        </td>
                        <td>
                          <div className="datetime-cell">
                            <div>{formatDateTime(call.automationNextRunAt)}</div>
                          </div>
                        </td>
                        <td>
                          <div className="duration-cell">
                            {call.automationAttempts ?? 0}
                          </div>
                        </td>
                        <td>
                          <div className="action-cell">
                            {(call.automationStatus === "failed" || call.automationStatus === "pending") && (
                              <button
                                className="view-btn warning"
                                onClick={() => runNow(call.id)}
                              >
                                Run Now
                              </button>
                            )}
                            {call.status === "missed" && (
                              <button
                                className="view-btn success"
                                onClick={() => resolveCall(call.id)}
                              >
                                Resolve
                              </button>
                            )}
                            <button 
                              className="view-btn"
                              onClick={() => handleViewDetails(call)}
                            >
                              View Details
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Call Details View */}
      {showDetailsSection && selectedCall && (
        <section className="missed-calls-section-card">
        <div className="missed-calls-section-header">
          <h3>Call Details</h3>
          <p>Inspect complete call context, automation, and follow-up actions.</p>
        </div>
        <div className="details-container">
          <div className="details-header">
            <button className="back-btn" onClick={() => { setViewMode("list"); setActiveSection("calls"); }}>
              <ArrowLeft size={20} />
              Back to List
            </button>
            <h2>Call Details</h2>
          </div>
          
          <div className="details-content">
            <div className="details-card">
              <div className="details-header-section">
                <div className="caller-details">
                  <div className="caller-avatar large">
                    <User size={24} />
                  </div>
                  <div>
                    <h2>{selectedCall.name}</h2>
                    <p className="caller-phone-large">
                      <Phone size={16} /> {selectedCall.phone}
                    </p>
                  </div>
                </div>
                
                <div className="status-section">
                  <div className={`status-badge large ${selectedCall.status}`}>
                    {selectedCall.status === "resolved" ? (
                      <>
                        <CheckCircle size={16} /> Resolved
                      </>
                    ) : (
                      <>
                        <Clock size={16} /> Missed
                      </>
                    )}
                  </div>
                  <div className={`priority-badge ${selectedCall.priority}`}>
                    {selectedCall.priority} Priority
                  </div>
                  <div className={`calltype-badge ${selectedCall.callType}`}>
                    {selectedCall.callType === "inbound" ? (
                      <PhoneMissed size={14} />
                    ) : (
                      <PhoneOutgoing size={14} />
                    )}
                    {selectedCall.callType}
                  </div>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-section">
                  <h3><Calendar size={18} /> Call Information</h3>
                  <div className="detail-row">
                    <span className="detail-label">Date & Time:</span>
                    <span className="detail-value">{selectedCall.displayDate} at {selectedCall.time}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{selectedCall.duration}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Call Type:</span>
                    <span className="detail-value capitalize">{selectedCall.callType}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h3><User size={18} /> Contact Details</h3>
                  {selectedCall.email && (
                    <div className="detail-row">
                      <span className="detail-label"><Mail size={16} /> Email:</span>
                      <span className="detail-value">{selectedCall.email}</span>
                    </div>
                  )}
                  {selectedCall.location && (
                    <div className="detail-row">
                      <span className="detail-label"><MapPin size={16} /> Location:</span>
                      <span className="detail-value">{selectedCall.location}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section full-width">
                  <h3><FileText size={18} /> Notes</h3>
                  <div className="notes-content">
                    {selectedCall.notes || "No notes available"}
                  </div>
                </div>

                <div className="detail-section full-width">
                  <h3><Clock size={18} /> Automation</h3>
                  <div className="detail-row">
                    <span className="detail-label">Automation Status:</span>
                    <span className="detail-value capitalize">{selectedCall.automationStatus || "pending"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Template:</span>
                    <span className="detail-value">{selectedCall.automationTemplate || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Language:</span>
                    <span className="detail-value">{selectedCall.automationLanguage || "en_US"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Delay:</span>
                    <span className="detail-value">{selectedCall.automationDelayMinutes ?? 0} min</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Next Run:</span>
                    <span className="detail-value">{formatDateTime(selectedCall.automationNextRunAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Attempts:</span>
                    <span className="detail-value">{selectedCall.automationAttempts ?? 0}</span>
                  </div>
                  {selectedCall.automationLastError ? (
                    <div className="detail-row">
                      <span className="detail-label">Last Error:</span>
                      <span className="detail-value">{selectedCall.automationLastError}</span>
                    </div>
                  ) : null}
                </div>

                <div className="detail-section full-width">
                  <h3><MessageCircle size={18} /> Actions</h3>
                  <div className="action-buttons">
                    {selectedCall.status === "missed" && (
                      <button
                        className="action-btn primary"
                        onClick={() => resolveCall(selectedCall.id)}
                      >
                        <CheckCircle size={16} /> Mark Resolved
                      </button>
                    )}
                    <button className="action-btn primary">
                      <Phone size={16} /> Call Back
                    </button>
                    {(selectedCall.automationStatus === "failed" || selectedCall.automationStatus === "pending") && (
                      <button
                        className="action-btn secondary"
                        onClick={() => runNow(selectedCall.id)}
                      >
                        <RefreshCcw size={16} /> Run Automation Now
                      </button>
                    )}
                    <button className="action-btn secondary">
                      <MessageCircle size={16} /> Send SMS
                    </button>
                    <button className="action-btn outline">
                      <Mail size={16} /> Send Email
                    </button>
                    <button className="action-btn outline">
                      <FileText size={16} /> Add Note
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>
      )}
    </div>
  );
};

export default MissedCalls;





