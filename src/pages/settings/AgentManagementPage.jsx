import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Loader2,
  Mail,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Users,
  X
} from "lucide-react";
import apiService from "../../services/api";
import "./AgentManagementPage.css";

const ROLE_OPTIONS = ["Agent", "Admin"];
const STATUS_OPTIONS = ["all", "enabled", "disabled"];

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  role: "Agent"
};

const normalizeAgent = (agent = {}) => {
  const companyRole = String(agent.companyRole || agent.role || "user").trim().toLowerCase();
  return {
    id: String(agent._id || agent.id || ""),
    name: String(agent.username || agent.name || agent.fullName || "").trim(),
    email: String(agent.email || "").trim(),
    role: String(agent.displayRole || (companyRole === "admin" ? "Admin" : "Agent")).trim() || "Agent",
    isEnabled: typeof agent.isEnabled === "boolean" ? agent.isEnabled : true,
    createdAt: agent.createdAt || agent.updatedAt || null,
    updatedAt: agent.updatedAt || agent.createdAt || null,
    parentUserId: agent.parentUserId || agent.createdBy || null
  };
};

const formatDate = (value) => {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
};

const getAgentSortTime = (agent = {}) => {
  const explicitDate = agent.createdAt || agent.updatedAt;
  const parsedDate = explicitDate ? Date.parse(explicitDate) : NaN;
  if (Number.isFinite(parsedDate)) return parsedDate;
  return 0;
};

const SettingsAgentManagementPage = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchAgents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiService.getMyAgents();
      const nextAgents = Array.isArray(response?.data?.data) ? response.data.data.map(normalizeAgent) : [];
      setAgents(nextAgents);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load agents");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const stats = useMemo(() => {
    const total = agents.length;
    const active = agents.filter((agent) => agent.isEnabled).length;
    const disabled = total - active;
    return { total, active, disabled };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return agents
      .filter((agent) => {
        if (statusFilter === "enabled") return agent.isEnabled;
        if (statusFilter === "disabled") return !agent.isEnabled;
        return true;
      })
      .filter((agent) => roleFilter === "all" || String(agent.role || "").toLowerCase() === roleFilter)
      .filter((agent) => {
        if (!term) return true;
        return (
          String(agent.name || "").toLowerCase().includes(term) ||
          String(agent.email || "").toLowerCase().includes(term) ||
          String(agent.role || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => getAgentSortTime(b) - getAgentSortTime(a));
  }, [agents, roleFilter, searchTerm, statusFilter]);

  const isEmpty = !loading && agents.length === 0;
  const showNoResults = !loading && agents.length > 0 && filteredAgents.length === 0;

  const closeModal = () => {
    setShowModal(false);
    setEditingAgentId(null);
    setForm(EMPTY_FORM);
  };

  const openCreateModal = () => {
    setMessage("");
    setError("");
    setEditingAgentId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (agent) => {
    setMessage("");
    setError("");
    setEditingAgentId(agent.id);
    setForm({
      fullName: agent.name || "",
      email: agent.email || "",
      password: "",
      role: agent.role || "Agent"
    });
    setShowModal(true);
  };

  const handleCreateOrUpdate = async (event) => {
    event.preventDefault();

    const fullName = String(form.fullName || "").trim();
    const email = String(form.email || "").trim();
    const password = String(form.password || "").trim();
    const role = String(form.role || "Agent").trim() || "Agent";

    if (!fullName || !email) {
      setError("Full name and email are required.");
      return;
    }
    if (!editingAgentId && !password) {
      setError("Password is required when creating an agent.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingAgentId) {
        await apiService.updateMyAgent(editingAgentId, {
          fullName,
          email,
          ...(password ? { password } : {}),
          role
        });
        setMessage("Agent updated successfully.");
      } else {
        await apiService.createMyAgent({
          fullName,
          email,
          password,
          role
        });
        setMessage("Agent created successfully.");
      }

      closeModal();
      await fetchAgents();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to save agent.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAgentStatus = async (agent) => {
    if (!agent?.id || saving) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await apiService.updateMyAgent(agent.id, {
        isEnabled: !agent.isEnabled
      });

      const updatedAgent = normalizeAgent(response?.data?.data || response?.data?.agent || response?.data?.user || {});
      setAgents((previous) =>
        previous.map((item) => (item.id === agent.id ? { ...item, ...updatedAgent } : item))
      );
      setMessage(`Agent ${updatedAgent.isEnabled ? "enabled" : "disabled"} successfully.`);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to update agent status.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="superadmin-shell agent-management-page">
      <header className="superadmin-header agent-management-page__header">
        <div className="agent-management-page__back-row">
          <button
            type="button"
            className="btn-link superadmin-back-link"
            onClick={() => window.history.back()}
            aria-label="Back to Control Center"
          >
            <ArrowLeft size={20} /> Back to Control Center
          </button>
        </div>

        <div className="agent-management-page__hero">
          <div className="agent-management-page__hero-copy">
            <span className="agent-management-page__eyebrow">
              <Sparkles size={14} /> Access Administration
            </span>
            <h1 className="agent-management-page__title">Agent Management</h1>
            <p className="agent-management-page__subtitle">
              Manage your team agents, permissions, and workspace access.
            </p>
          </div>

          <div className="agent-management-page__hero-actions">
            <button type="button" className="agent-primary-btn" onClick={openCreateModal}>
              <Plus size={16} />
              Create Agent
            </button>
          </div>
        </div>
      </header>

      <section className="superadmin-panel superadmin-panel--page agent-management-panel">
        <div className="agent-management-stats">
          <article className="agent-stat-card">
            <div className="agent-stat-card__icon agent-stat-card__icon--total">
              <Users size={18} />
            </div>
            <div className="agent-stat-card__content">
              <span className="agent-stat-card__label">Total Agents</span>
              <strong className="agent-stat-card__value">{stats.total}</strong>
            </div>
          </article>

          <article className="agent-stat-card">
            <div className="agent-stat-card__icon agent-stat-card__icon--active">
              <ToggleRight size={18} />
            </div>
            <div className="agent-stat-card__content">
              <span className="agent-stat-card__label">Active Agents</span>
              <strong className="agent-stat-card__value">{stats.active}</strong>
            </div>
          </article>

          <article className="agent-stat-card">
            <div className="agent-stat-card__icon agent-stat-card__icon--disabled">
              <ToggleLeft size={18} />
            </div>
            <div className="agent-stat-card__content">
              <span className="agent-stat-card__label">Disabled Agents</span>
              <strong className="agent-stat-card__value">{stats.disabled}</strong>
            </div>
          </article>
        </div>

        <div className="agent-toolbar">
          <label className="agent-toolbar__search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name, email, or role"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <div className="agent-toolbar__filters">
            <label className="agent-select">
              <SlidersHorizontal size={14} />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All Statuses" : option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>

            <label className="agent-select">
              <UserPlus size={14} />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role.toLowerCase()}>
                    {role}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>

        {(message || error) && (
          <div className={`agent-inline-feedback ${error ? "agent-inline-feedback--error" : "agent-inline-feedback--success"}`}>
            {error || message}
          </div>
        )}

        <div className="agent-table-shell">
          <div className="agent-table-shell__header">
            <div>
              <h2>Agent Directory</h2>
              <p>Track access, role, and onboarding date from one workspace.</p>
            </div>
            <span className="agent-table-shell__count">{filteredAgents.length} shown</span>
          </div>

          {loading ? (
            <div className="agent-empty-state">
              <div className="agent-empty-state__icon">
                <Loader2 size={34} className="agent-spin" />
              </div>
              <h3>Loading agents</h3>
              <p>Fetching your agent directory...</p>
            </div>
          ) : isEmpty ? (
            <div className="agent-empty-state">
              <div className="agent-empty-state__icon">
                <Users size={34} />
              </div>
              <h3>No agents created yet</h3>
              <p>Create your first team agent to begin managing workspace access and roles.</p>
              <button type="button" className="agent-primary-btn" onClick={openCreateModal}>
                <Plus size={16} />
                Create Agent
              </button>
            </div>
          ) : showNoResults ? (
            <div className="agent-empty-state agent-empty-state--compact">
              <div className="agent-empty-state__icon">
                <Search size={32} />
              </div>
              <h3>No matching agents</h3>
              <p>Try changing your search or filters to find an agent.</p>
            </div>
          ) : (
            <div className="agent-table">
              <div className="agent-table__head">
                <span>Agent</span>
                <span>Role</span>
                <span>Status</span>
                <span>Created Date</span>
                <span>Actions</span>
              </div>

              <div className="agent-table__body">
                {filteredAgents.map((agent) => (
                  <article key={agent.id} className="agent-row">
                    <div className="agent-row__cell agent-row__cell--agent">
                      <div className="agent-avatar" aria-hidden="true">
                        {(agent.name || "A").charAt(0).toUpperCase()}
                      </div>
                      <div className="agent-profile">
                        <strong>{agent.name || "Unnamed agent"}</strong>
                        <span>
                          <Mail size={13} />
                          {agent.email || "No email"}
                        </span>
                      </div>
                    </div>

                    <div className="agent-row__cell">
                      <span className="agent-pill agent-pill--role">{agent.role || "Agent"}</span>
                    </div>

                    <div className="agent-row__cell">
                      <span className={`agent-pill ${agent.isEnabled ? "agent-pill--enabled" : "agent-pill--disabled"}`}>
                        {agent.isEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>

                    <div className="agent-row__cell agent-row__cell--date">
                      <CalendarDays size={13} />
                      <span>{formatDate(agent.createdAt)}</span>
                    </div>

                    <div className="agent-row__cell agent-row__cell--actions">
                      <button type="button" className="agent-action-btn agent-action-btn--ghost" onClick={() => openEditModal(agent)} disabled={saving}>
                        <PencilLine size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className={`agent-action-btn ${agent.isEnabled ? "agent-action-btn--disable" : "agent-action-btn--enable"}`}
                        onClick={() => toggleAgentStatus(agent)}
                        disabled={saving}
                      >
                        {agent.isEnabled ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                        {agent.isEnabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="agent-modal-overlay" onClick={closeModal} role="presentation">
          <div
            className="agent-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingAgentId ? "Edit Agent" : "Create Agent"}
          >
            <div className="agent-modal__header">
              <div>
                <span className="agent-modal__eyebrow">{editingAgentId ? "Edit agent" : "Create agent"}</span>
                <h3>{editingAgentId ? "Update Agent Details" : "Create a New Agent"}</h3>
              </div>
              <button className="agent-modal__close" type="button" onClick={closeModal} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>

            <form className="agent-modal__form" onSubmit={handleCreateOrUpdate}>
              <div className="agent-modal__grid">
                <label className="agent-field">
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    placeholder="Enter full name"
                  />
                </label>

                <label className="agent-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="agent@example.com"
                  />
                </label>

                <label className="agent-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder={editingAgentId ? "Leave blank to keep unchanged" : "Set password"}
                  />
                </label>

                <label className="agent-field">
                  <span>Role</span>
                  <select
                    value={form.role}
                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="agent-modal__actions">
                <button type="button" className="agent-secondary-btn" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="agent-primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingAgentId ? "Save Changes" : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsAgentManagementPage;
