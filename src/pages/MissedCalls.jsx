
import React, { useEffect, useState } from "react";
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
  PhoneOutgoing
} from "lucide-react";
import { apiClient } from "../services/whatsappapi";

const MissedCalls = () => {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [viewMode, setViewMode] = useState("list");
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

      {/* Stats */}
      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon total">
            <Phone size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Calls</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon inbound">
            <PhoneMissed size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.inbound}</h3>
            <p>Inbound</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon outbound">
            <PhoneOutgoing size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.outbound}</h3>
            <p>Outbound</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon missed">
            <Clock size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.missed}</h3>
            <p>Missed</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon resolved">
            <CheckCircle size={20} />
          </div>
          <div className="stat-info">
            <h3>{stats.resolved}</h3>
            <p>Resolved</p>
          </div>
        </div>
      </div>

      {/* Main Content (List/Grid View) */}
      {viewMode !== "details" && (
        <>
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
        </>
      )}

      {/* Call Details View */}
      {viewMode === "details" && selectedCall && (
        <div className="details-container">
          <div className="details-header">
            <button className="back-btn" onClick={() => setViewMode("list")}>
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
      )}
    </div>
  );
};

export default MissedCalls;
