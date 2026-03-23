import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Mail,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/api";
import "../admin.css";
import "../../styles/theme.css";

const UsersListPage = () => {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_API_URL || "";

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappBusiness, setWhatsappBusiness] = useState("");
  const [metaAppId, setMetaAppId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [metaRedirectUri, setMetaRedirectUri] = useState("");
  const [metaUserAccessToken, setMetaUserAccessToken] = useState("");
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [missedCallWebhook, setMissedCallWebhook] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [showMetaUserToken, setShowMetaUserToken] = useState(false);

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setTwilioAccountSid("");
    setTwilioAuthToken("");
    setTwilioPhoneNumber("");
    setWhatsappId("");
    setWhatsappToken("");
    setWhatsappBusiness("");
    setMetaAppId("");
    setMetaAppSecret("");
    setMetaRedirectUri("");
    setMetaUserAccessToken("");
    setMetaAdAccountId("");
    setPhoneNumber("");
    setMissedCallWebhook("");
    setShowToken(false);
    setShowTwilioToken(false);
    setShowMetaSecret(false);
    setShowMetaUserToken(false);
    setErrors({});
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await apiService.get(`${backendUrl}/api/admin/users`);
      setUsers(res?.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
        }),
    [companyFilter, roleFilter, searchTerm, users]
  );

  const deletableVisibleUsers = useMemo(
    () => filteredUsers.filter((user) => String(user.role || "user") !== "superadmin"),
    [filteredUsers]
  );

  const allVisibleSelected =
    deletableVisibleUsers.length > 0 &&
    deletableVisibleUsers.every((user) => selectedUserIds.includes(user._id));

  const isDeletableUser = (user) => String(user.role || "user") !== "superadmin";

  const toggleUserSelection = (userId, canSelect = true) => {
    if (!canSelect) return;
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !deletableVisibleUsers.some((user) => user._id === id)));
      return;
    }

    setSelectedUserIds((prev) => {
      const visibleIds = deletableVisibleUsers.map((user) => user._id);
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const handleEdit = (selectedUser) => {
    setUsername(selectedUser.username || "");
    setEmail(selectedUser.email || "");
    setEditingUserId(selectedUser._id);
    setTwilioAccountSid(selectedUser.twilioAccountSid ?? selectedUser.twilioaccountsid ?? "");
    setTwilioAuthToken(selectedUser.twilioAuthToken ?? selectedUser.twilioauthtoken ?? "");
    setTwilioPhoneNumber(
      selectedUser.twilioPhoneNumber ??
        selectedUser.twiliophonenumber ??
        selectedUser.phoneNumber ??
        selectedUser.phonenumber ??
        ""
    );
    setWhatsappId(selectedUser.whatsappId ?? selectedUser.whatsappid ?? "");
    setWhatsappToken(selectedUser.whatsappToken ?? selectedUser.whatsapptoken ?? "");
    setWhatsappBusiness(selectedUser.whatsappBusiness ?? selectedUser.whatsappbussiness ?? "");
    setMetaAppId(selectedUser.metaAppId ?? selectedUser.metaappid ?? "");
    setMetaAppSecret(selectedUser.metaAppSecret ?? selectedUser.metaappsecret ?? "");
    setMetaRedirectUri(selectedUser.metaRedirectUri ?? selectedUser.metaredirecturi ?? "");
    setMetaUserAccessToken(selectedUser.metaUserAccessToken ?? selectedUser.metauseraccesstoken ?? "");
    setMetaAdAccountId(selectedUser.metaAdAccountId ?? selectedUser.metaadaccountid ?? "");
    setPhoneNumber(selectedUser.phoneNumber ?? selectedUser.phonenumber ?? "");
    setMissedCallWebhook(selectedUser.missedCallWebhook ?? selectedUser.missedcallwebhook ?? "");
    setErrors({});
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    resetForm();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await apiService.deleteAdmin(id);
      fetchUsers();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleBulkDelete = async () => {
    const deletableSelectedIds = selectedUserIds.filter((id) =>
      users.some((user) => user._id === id && isDeletableUser(user))
    );

    if (deletableSelectedIds.length === 0) {
      window.alert("Only user and admin accounts can be deleted from this selection.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${deletableSelectedIds.length} selected account(s)?`)) return;

    try {
      await Promise.all(deletableSelectedIds.map((id) => apiService.deleteAdmin(id)));
      setSelectedUserIds([]);
      fetchUsers();
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!editingUserId) return;

    if (
      !username ||
      !email ||
      !twilioAccountSid ||
      !twilioPhoneNumber ||
      !whatsappId ||
      !whatsappToken ||
      !whatsappBusiness ||
      !phoneNumber ||
      !missedCallWebhook
    ) {
      setErrors({ register: "All fields are required" });
      return;
    }

    setLoading(true);
    try {
      await apiService.updateAdmin(editingUserId, { username, email, role: "admin" });
      await apiService.saveAdminCredentials({
        adminId: editingUserId,
        twilioAccountSid: String(twilioAccountSid || "").trim(),
        ...(twilioAuthToken ? { twilioAuthToken: String(twilioAuthToken).trim() } : {}),
        twilioPhoneNumber: String(twilioPhoneNumber || "").trim(),
        whatsappId: String(whatsappId || "").trim(),
        whatsappToken: String(whatsappToken || "").trim(),
        whatsappBusiness: String(whatsappBusiness || "").trim(),
        metaAppId: String(metaAppId || "").trim(),
        metaAppSecret: String(metaAppSecret || "").trim(),
        metaRedirectUri: String(metaRedirectUri || "").trim(),
        metaUserAccessToken: String(metaUserAccessToken || "").trim(),
        metaAdAccountId: String(metaAdAccountId || "").trim(),
        phoneNumber: String(phoneNumber || "").trim(),
        missedCallWebhook: String(missedCallWebhook || "").trim()
      });
      closeModal();
      fetchUsers();
    } catch (err) {
      setErrors({ register: err.response?.data?.message || "Update failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="superadmin-shell">
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Admin</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form className="login-box" onSubmit={handleUpdate}>
              <div className="form-row">
                <label>Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Twilio Account SID</label>
                <input value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Twilio Auth Token</label>
                <div className="password-field password-field--compact">
                  <input
                    type={showTwilioToken ? "text" : "password"}
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowTwilioToken((prev) => !prev)}>
                    {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Twilio Phone Number</label>
                <input value={twilioPhoneNumber} onChange={(e) => setTwilioPhoneNumber(e.target.value)} />
              </div>
              <div className="form-row">
                <label>WhatsApp ID</label>
                <input value={whatsappId} onChange={(e) => setWhatsappId(e.target.value)} />
              </div>
              <div className="form-row">
                <label>WhatsApp Token</label>
                <div className="password-field password-field--compact">
                  <input
                    type={showToken ? "text" : "password"}
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowToken((prev) => !prev)}>
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>WhatsApp Business</label>
                <input value={whatsappBusiness} onChange={(e) => setWhatsappBusiness(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Meta App ID</label>
                <input value={metaAppId} onChange={(e) => setMetaAppId(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Meta App Secret</label>
                <div className="password-field password-field--compact">
                  <input
                    type={showMetaSecret ? "text" : "password"}
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowMetaSecret((prev) => !prev)}>
                    {showMetaSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Meta Redirect URI</label>
                <input value={metaRedirectUri} onChange={(e) => setMetaRedirectUri(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Meta User Access Token</label>
                <div className="password-field password-field--compact">
                  <input
                    type={showMetaUserToken ? "text" : "password"}
                    value={metaUserAccessToken}
                    onChange={(e) => setMetaUserAccessToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowMetaUserToken((prev) => !prev)}>
                    {showMetaUserToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Meta Ad Account ID</label>
                <input value={metaAdAccountId} onChange={(e) => setMetaAdAccountId(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Phone Number</label>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Missed Call Webhook</label>
                <input value={missedCallWebhook} onChange={(e) => setMissedCallWebhook(e.target.value)} />
              </div>

              {errors.register && <span className="error-text">{errors.register}</span>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? "Updating..." : "Update Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <h1 className="nx-title">Users List</h1>
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
              <div className="users-bulk-select">
                <span className="users-bulk-select__label">Select</span>
                <button type="button" className="users-select-all-btn" onClick={toggleSelectAllVisible}>
                  {allVisibleSelected ? "Clear All Visible" : "Select All Visible"}
                </button>
                <button
                  type="button"
                  className="users-bulk-delete-btn"
                  onClick={handleBulkDelete}
                  disabled={selectedUserIds.length === 0}
                  aria-label="Delete selected users"
                  title="Delete selected users"
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
              <div className={`users-list-table users-list-table--header ${showFilters ? "users-list-table--selecting" : ""}`}>
                {showFilters ? <span>Select</span> : null}
                <span>User</span>
                <span>Role</span>
                <span>Company</span>
                <span>User ID</span>
                <span>Actions</span>
              </div>
              {filteredUsers.map((listedUser) => (
                <div
                  key={listedUser._id}
                  className={`users-list-table users-list-table--row ${showFilters ? "users-list-table--selecting" : ""}`}
                >
                  {showFilters ? (
                    <div className="users-list-cell users-list-cell--select">
                    <button
                      type="button"
                      className={`users-row-checkbox ${selectedUserIds.includes(listedUser._id) ? "users-row-checkbox--active" : ""} ${!isDeletableUser(listedUser) ? "users-row-checkbox--disabled" : ""}`}
                      onClick={() => toggleUserSelection(listedUser._id, isDeletableUser(listedUser))}
                      aria-pressed={selectedUserIds.includes(listedUser._id)}
                      aria-label={`Select ${listedUser.username || "user"}`}
                      disabled={!isDeletableUser(listedUser)}
                    >
                        {selectedUserIds.includes(listedUser._id) ? <Check size={13} /> : null}
                      </button>
                    </div>
                  ) : null}
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
                  <div className="user-card-actions user-card-actions--list">
                    <button className="edit-btn" onClick={() => handleEdit(listedUser)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default UsersListPage;
