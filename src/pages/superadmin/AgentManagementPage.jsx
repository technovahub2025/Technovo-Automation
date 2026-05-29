import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, ChevronDown, Mail, Search, SlidersHorizontal } from "lucide-react";
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

const AgentManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState("");

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
                    "minmax(300px, 2.5fr) minmax(120px, 0.8fr) minmax(190px, 1.1fr) minmax(120px, 0.8fr) minmax(140px, 0.8fr) minmax(110px, 0.6fr)"
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
                        "minmax(300px, 2.5fr) minmax(120px, 0.8fr) minmax(190px, 1.1fr) minmax(120px, 0.8fr) minmax(140px, 0.8fr) minmax(110px, 0.6fr)"
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
                        {String(listedUser.role || "user")}
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
    </div>
  );
};

export default AgentManagementPage;
