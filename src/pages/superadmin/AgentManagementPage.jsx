import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, ChevronDown, Eye, Mail, Search, SlidersHorizontal, X, Save } from "lucide-react";
import apiService from "../../services/api";
import { buildAgentAccessPayload, resolveAgentAccessState } from "../../utils/agentAccess";
import "../admin.css";
import "../../styles/theme.css";

const getUserLifoTime = (user = {}) => {
  const explicitDate = user.createdAt || user.updatedAt || user.registeredAt || user.created_at || user.updated_at;
  const parsedDate = explicitDate ? Date.parse(explicitDate) : NaN;
  if (Number.isFinite(parsedDate)) return parsedDate;

  const objectId = String(user._id || user.id || "");
  if (/^[a-f\d]{24}$/i.test(objectId)) {
    return parseInt(objectId.slice(0, 8), 16) * 1000;
  }

  return 0;
};

const getAccessStatus = (user = {}) => {
  const isEnabled = resolveAgentAccessState(user);
  return isEnabled ? "Enabled" : "Disabled";
};

const getDisplayRole = (user = {}) => {
  const normalizedRole = String(user.role || "").trim().toLowerCase();
  const normalizedCompanyRole = String(user.companyRole || "").trim().toLowerCase();

  if (normalizedRole === "superadmin") return "Superadmin";
  if (normalizedRole === "admin" || normalizedCompanyRole === "admin") return "Admin";
  if (
    user.isAgentWorkspace === true ||
    normalizedRole === "agent" ||
    normalizedCompanyRole === "agent" ||
    normalizedRole === "user" ||
    normalizedCompanyRole === "user" ||
    user.createdBy ||
    user.ownerId ||
    user.parentUserId
  ) {
    return "Agent";
  }

  if (!normalizedRole) return "User";
  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
};

const getAccessStatusStyles = (status) => {
  if (status === "Enabled") {
    return {
      background: "linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08))",
      color: "#15803d",
      border: "1px solid rgba(34, 197, 94, 0.22)"
    };
  }

  return {
    background: "linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(239, 68, 68, 0.08))",
    color: "#b91c1c",
    border: "1px solid rgba(148, 163, 184, 0.28)"
  };
};

const normalizeAgentLimit = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

const AgentManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [agentSearchTerm, setAgentSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState("");
  const [viewingUser, setViewingUser] = useState(null);
  const [maxAgentsDraft, setMaxAgentsDraft] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");
  const [limitError, setLimitError] = useState("");

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiService.getAdminUsers();
      const nextUsers = Array.isArray(res?.data?.data)
        ? res.data.data.map((user) => {
            return {
              ...user,
              ...buildAgentAccessPayload(user)
            };
          })
        : [];
      setUsers(nextUsers);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const refreshUserRow = useCallback(async () => {
    try {
      const res = await apiService.getAdminUsers();
      const nextUsers = Array.isArray(res?.data?.data)
        ? res.data.data.map((user) => {
            return {
              ...user,
              ...buildAgentAccessPayload(user)
            };
          })
        : [];
      setUsers(nextUsers);
    } catch (err) {
      console.error("Failed to refresh users after toggle:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(
    () =>
      users
        .filter((user) => getDisplayRole(user) === "Admin")
        .filter((user) => roleFilter === "all" || String(user.role || "user") === roleFilter)
        .filter((user) => {
          if (companyFilter === "with") return Boolean(user.companyId);
          if (companyFilter === "without") return !user.companyId;
          return true;
        })
        .filter((user) => {
          const term = searchTerm.trim().toLowerCase();
          if (!term) return true;
          return (
            String(user.username || "").toLowerCase().includes(term) ||
            String(user.email || "").toLowerCase().includes(term) ||
            String(user.companyId || "").toLowerCase().includes(term)
          );
        })
        .sort((a, b) => getUserLifoTime(b) - getUserLifoTime(a)),
    [companyFilter, roleFilter, searchTerm, users]
  );

  const viewableAgents = useMemo(() => {
    if (!viewingUser?._id) return [];
    const selectedId = String(viewingUser._id);
    return users.filter(
      (user) =>
        String(user.createdBy || "") === selectedId &&
        String(user.role || "").toLowerCase() !== "superadmin" &&
        Boolean(user.isAgentWorkspace === true || resolveAgentAccessState(user) || String(user.companyRole || "").toLowerCase() === "user")
    );
  }, [users, viewingUser]);

  const viewableAgentStats = useMemo(() => {
    const total = viewableAgents.length;
    const enabled = viewableAgents.filter((agent) => resolveAgentAccessState(agent)).length;
    const disabled = total - enabled;
    const limit = normalizeAgentLimit(viewingUser?.maxAgentsAllowed);
    const remaining = limit === null ? null : Math.max(0, limit - total);

    return { total, enabled, disabled, limit, remaining };
  }, [viewingUser?.maxAgentsAllowed, viewableAgents]);

  const filteredViewableAgents = useMemo(() => {
    const term = agentSearchTerm.trim().toLowerCase();
    if (!term) return viewableAgents;

    return viewableAgents.filter((agent) => {
      return (
        String(agent.username || "").toLowerCase().includes(term) ||
        String(agent.email || "").toLowerCase().includes(term) ||
        String(agent.companyRole || agent.role || "").toLowerCase().includes(term) ||
        String(agent._id || "").toLowerCase().includes(term)
      );
    });
  }, [agentSearchTerm, viewableAgents]);

  const handleToggleAccess = async (listedUser) => {
    if (!listedUser?._id) return;
    const isSuperadmin = String(listedUser.role || "").toLowerCase() === "superadmin";
    if (isSuperadmin) return;

    const currentValue = resolveAgentAccessState(listedUser);
    const nextValue = !currentValue;

    setTogglingUserId(listedUser._id);
    setUsers((prev) =>
      prev.map((user) =>
        user._id === listedUser._id
          ? {
              ...user,
              isEnabled: nextValue,
              canAccessUserManagement: nextValue,
              canAccessAgentManagement: nextValue
            }
          : user
      )
    );
    try {
      const response = await apiService.updateAdmin(listedUser._id, {
        isEnabled: nextValue,
        canAccessUserManagement: nextValue,
        canAccessAgentManagement: nextValue
      });

      const updatedUser = response?.data?.user || response?.data?.data?.user || response?.data?.data || null;
      const normalizedAccess = resolveAgentAccessState(updatedUser || { isEnabled: nextValue });

      setUsers((prev) =>
        prev.map((user) =>
          user._id === listedUser._id
            ? {
                ...user,
                isEnabled: normalizedAccess,
                canAccessUserManagement: normalizedAccess,
                canAccessAgentManagement: normalizedAccess
              }
            : user
        )
      );

      await refreshUserRow();
    } catch (err) {
      setUsers((prev) =>
        prev.map((user) =>
          user._id === listedUser._id
            ? {
                ...user,
                isEnabled: currentValue,
                canAccessUserManagement: currentValue,
                canAccessAgentManagement: currentValue
              }
            : user
        )
      );
      console.error("Failed to update user management access:", err);
    } finally {
      setTogglingUserId("");
    }
  };

  const openViewModal = (listedUser) => {
    setViewingUser(listedUser);
    setMaxAgentsDraft(
      typeof listedUser?.maxAgentsAllowed === "number" && Number.isFinite(listedUser.maxAgentsAllowed)
        ? String(listedUser.maxAgentsAllowed)
        : ""
    );
    setAgentSearchTerm("");
    setLimitMessage("");
    setLimitError("");
  };

  const closeViewModal = () => {
    setViewingUser(null);
    setMaxAgentsDraft("");
    setLimitMessage("");
    setLimitError("");
  };

  const handleSaveMaxAgents = async () => {
    if (!viewingUser?._id) return;
    const nextLimit = normalizeAgentLimit(maxAgentsDraft);
    if (maxAgentsDraft !== "" && nextLimit === null) {
      setLimitError("Enter a valid agent limit or leave it blank for unlimited.");
      return;
    }

    setLimitSaving(true);
    setLimitError("");
    setLimitMessage("");
    try {
      await apiService.updateAdmin(viewingUser._id, {
        maxAgentsAllowed: nextLimit
      });

      const response = await apiService.getAdminUsers();
      const nextUsers = Array.isArray(response?.data?.data)
        ? response.data.data.map((user) => ({
            ...user,
            ...buildAgentAccessPayload(user)
          }))
        : [];
      setUsers(nextUsers);

      const refreshedUser = nextUsers.find((user) => String(user._id) === String(viewingUser._id)) || {
        ...viewingUser,
        maxAgentsAllowed: nextLimit
      };
      setViewingUser(refreshedUser);
      setMaxAgentsDraft(nextLimit === null ? "" : String(nextLimit));
      setLimitMessage(
        nextLimit === null
          ? "Agent limit cleared. This admin can now add unlimited agents."
          : `Agent limit saved. This admin can manage up to ${nextLimit} agent${nextLimit === 1 ? "" : "s"}.`
      );
    } catch (err) {
      setLimitError(err?.response?.data?.message || "Failed to save agent limit.");
    } finally {
      setLimitSaving(false);
    }
  };

  return (
    <div className="superadmin-shell">
      <header className="superadmin-header">
        <div className="superadmin-hero superadmin-hero--page">
          <div className="superadmin-hero__heading">
            <div>
              <button
                type="button"
                className="btn-link superadmin-back-link"
                onClick={() => window.history.back()}
                aria-label="Back to Control Center"
              >
                <ArrowLeft size={20} /> Back to Control Center
              </button>
              <h1 className="nx-title">Agent Management</h1>
              <p className="superadmin-subtitle">
                Manage platform users, review admin profiles, and track company assignment status from one workspace.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="superadmin-panel superadmin-panel--page">
        <div className="panel-header">
          <div>
            <h2>All Users</h2>
            <span className="panel-meta">Use search and filters to quickly find users, admins, and company states.</span>
          </div>
          <span className="panel-meta panel-meta--strong">{users.length} total</span>
        </div>

        <div className="users-toolbar-surface">
          <div className="page-toolbar users-page-toolbar">
            <div className="users-toolbar-control">
              <label className="page-search users-page-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search by username, email, or company id"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={`users-filter-toggle ${showFilters ? "users-filter-toggle--active" : ""}`}
                onClick={() => setShowFilters((prev) => !prev)}
                aria-expanded={showFilters}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
                <ChevronDown size={15} />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="page-filters users-page-filters users-page-filters--expand">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">Select All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
                <option value="all">Select All Company States</option>
                <option value="with">With Company</option>
                <option value="without">Without Company</option>
              </select>
            </div>
          )}

          <div className="page-stats-row users-page-stats">
            <span className="status-chip status-chip--neutral">Showing {filteredUsers.length} users</span>
            <span className="status-chip status-chip--success">
              {users.filter((user) => String(user.role || "user") === "admin").length} admins
            </span>
            <span className="status-chip status-chip--warning">
              {users.filter((user) => !user.companyId).length} company pending
            </span>
          </div>
        </div>

        <div className="user-list user-list--page">
          {usersLoading ? (
            <div className="pricing-empty-state">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="pricing-empty-state">No users found.</div>
          ) : (
            <>
              <div
                className="users-list-table users-list-table--header"
                style={{
                  gridTemplateColumns:
                    "minmax(300px, 2.3fr) minmax(120px, 0.8fr) minmax(190px, 1.05fr) minmax(120px, 0.75fr) minmax(140px, 0.8fr) minmax(220px, 1.05fr)"
                }}
              >
                <span>User</span>
                <span>Role</span>
                <span>Company</span>
                <span>User ID</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filteredUsers.map((listedUser) => {
                const isSuperadmin = String(listedUser.role || "").toLowerCase() === "superadmin";
                const accessStatus = getAccessStatus(listedUser);

                return (
                  <div
                    key={listedUser._id}
                    className="users-list-table users-list-table--row"
                    style={{
                      gridTemplateColumns:
                        "minmax(300px, 2.3fr) minmax(120px, 0.8fr) minmax(190px, 1.05fr) minmax(120px, 0.75fr) minmax(140px, 0.8fr) minmax(220px, 1.05fr)"
                    }}
                  >
                    <div className="users-list-cell users-list-cell--user">
                      <div className="user-card__avatar user-card__avatar--list">
                        {(listedUser.username || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="user-card-content">
                        <div className="user-header-info">
                          <strong>{listedUser.username || "Unnamed user"}</strong>
                          <span className="user-email">
                            <Mail size={13} /> {listedUser.email || "No email"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="users-list-cell">
                      <span className="status-chip status-chip--neutral">
                        {getDisplayRole(listedUser)}
                      </span>
                    </div>
                    <div className="users-list-cell">
                      {listedUser.companyId ? (
                        <span className="status-chip status-chip--success">
                          <Building2 size={12} /> Company linked
                        </span>
                      ) : (
                        <span className="missing-pill missing-pill--inline">Company pending</span>
                      )}
                    </div>
                    <div className="users-list-cell users-list-cell--mono">
                      {listedUser._id?.slice(-8) || "N/A"}
                    </div>
                    <div className="users-list-cell">
                      <span
                        className="status-chip"
                        style={getAccessStatusStyles(accessStatus)}
                      >
                        {accessStatus}
                      </span>
                    </div>
                    <div className="user-card-actions user-card-actions--list">
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => openViewModal(listedUser)}
                        title="View this admin's agents"
                        aria-label={`View agents for ${listedUser.username || "this admin"}`}
                      >
                        <Eye size={14} />
                        View Agents
                      </button>
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => handleToggleAccess(listedUser)}
                        disabled={togglingUserId === listedUser._id || isSuperadmin}
                        title={isSuperadmin ? "Superadmin access is always enabled" : ""}
                      >
                        {accessStatus === "Enabled" ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {viewingUser && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="modal-content modal-content--wide" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Admin Agent View</h2>
              <button className="modal-close" onClick={closeViewModal}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gap: "16px" }}>
              <div className="customize-modal-user-strip">
                <div className="customize-modal-user-chip">
                  <strong>{viewingUser.username || "Unnamed user"}</strong>
                  <span>{viewingUser.email || "No email"}</span>
                </div>
                <div className="customize-modal-user-chip">
                  <strong>Role</strong>
                  <span>{String(viewingUser.companyRole || viewingUser.role || "user")}</span>
                </div>
                <div className="customize-modal-user-chip">
                  <strong>Agents</strong>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span>
                      {viewableAgentStats.total}
                      {viewableAgentStats.limit === null ? " / Unlimited" : ` / ${viewableAgentStats.limit}`}
                    </span>
                    <span
                      className={`status-chip ${
                        viewableAgentStats.limit === null
                          ? "status-chip--neutral"
                          : viewableAgentStats.remaining === 0
                            ? "status-chip--warning"
                            : "status-chip--success"
                      }`}
                    >
                      {viewableAgentStats.limit === null
                        ? "Unlimited slots"
                        : viewableAgentStats.remaining === 0
                          ? "No slots left"
                          : `${viewableAgentStats.remaining} slot${viewableAgentStats.remaining === 1 ? "" : "s"} left`}
                    </span>
                  </span>
                </div>
              </div>

              <div className="customize-form-grid" style={{ alignItems: "start" }}>
                <div className="form-row form-row--customize">
                  <label>Max Agents Allowed</label>
                  <div className="customize-input-wrap">
                    <input
                      type="number"
                      min="0"
                      value={maxAgentsDraft}
                      onChange={(event) => setMaxAgentsDraft(event.target.value)}
                      placeholder="Leave blank for unlimited"
                      className="customize-input"
                    />
                  </div>
                  <p className="superadmin-subtitle" style={{ margin: "8px 0 0", fontSize: "12px" }}>
                    Blank means unlimited. This limit is checked when creating new agents for this admin.
                  </p>
                </div>

                <div className="form-row form-row--customize">
                  <label>Current Summary</label>
                  <div
                    style={{
                      border: "1px solid var(--nx-border)",
                      borderRadius: "14px",
                      background: "#fff",
                      padding: "14px",
                      display: "grid",
                      gap: "10px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <span>Total Agents</span>
                      <strong>{viewableAgentStats.total}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <span>Enabled</span>
                      <strong>{viewableAgentStats.enabled}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <span>Disabled</span>
                      <strong>{viewableAgentStats.disabled}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <span>Remaining Slots</span>
                      <strong>{viewableAgentStats.remaining === null ? "Unlimited" : viewableAgentStats.remaining}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {(limitError || limitMessage) && (
                <div
                  className={`agent-inline-feedback ${
                    limitError ? "agent-inline-feedback--error" : "agent-inline-feedback--success"
                  }`}
                >
                  {limitError || limitMessage}
                </div>
              )}

              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Agents under this admin</h3>
                    <p className="superadmin-subtitle" style={{ margin: "4px 0 0" }}>
                      {viewableAgents.length === 0
                        ? "No agents assigned to this admin yet."
                        : `${filteredViewableAgents.length} agent${filteredViewableAgents.length === 1 ? "" : "s"} shown.`}
                    </p>
                  </div>
                </div>

                <div className="form-row form-row--customize" style={{ marginBottom: 0 }}>
                  <label>Search Agents</label>
                  <div className="customize-input-wrap">
                    <span className="customize-input-prefix">
                      <Search size={14} />
                    </span>
                    <input
                      type="text"
                      value={agentSearchTerm}
                      onChange={(event) => setAgentSearchTerm(event.target.value)}
                      placeholder="Search by name, email, role, or ID"
                      className="customize-input"
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid var(--nx-border)",
                    borderRadius: "14px",
                    overflow: "hidden",
                    background: "#fff"
                  }}
                >
                  {viewableAgents.length === 0 ? (
                    <div style={{ padding: "18px", color: "var(--nx-muted)" }}>No agents to display.</div>
                  ) : filteredViewableAgents.length === 0 ? (
                    <div style={{ padding: "18px", color: "var(--nx-muted)" }}>No agents match this search.</div>
                  ) : (
                    filteredViewableAgents.map((agent) => (
                      <div
                        key={agent._id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.6fr 0.8fr 0.8fr 0.7fr",
                          gap: "12px",
                          alignItems: "center",
                          padding: "14px 18px",
                          borderTop: "1px solid rgba(226, 232, 240, 0.85)"
                        }}
                      >
                        <div>
                          <strong>{agent.username || "Unnamed agent"}</strong>
                          <div className="superadmin-subtitle" style={{ marginTop: "4px" }}>
                            {agent.email || "No email"}
                          </div>
                        </div>
                        <span className="status-chip status-chip--neutral">{String(agent.companyRole || agent.role || "user")}</span>
                        <span
                          className="status-chip"
                          style={getAccessStatusStyles(getAccessStatus(agent))}
                        >
                          {getAccessStatus(agent)}
                        </span>
                        <span className="superadmin-subtitle" style={{ textAlign: "right" }}>
                          {agent._id?.slice(-8) || "N/A"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeViewModal}>
                  Close
                </button>
                <button type="button" className="btn-submit" onClick={handleSaveMaxAgents} disabled={limitSaving}>
                  {limitSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentManagementPage;
