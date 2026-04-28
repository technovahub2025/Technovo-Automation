import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Mail,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X
} from "lucide-react";
import apiService from "../../services/api";
import socketService from "../../services/socketService";
import "../admin.css";
import "../../styles/theme.css";

const FEATURE_GROUPS = [
  {
    label: "Meta Ads",
    features: ["Ads Manager", "Insights", "Connect Meta"]
  },
  {
    label: "Bulk Message",
    features: ["Broadcast Dashboard", "Team Inbox", "Broadcast", "Templates", "Contacts"]
  },
  {
    label: "Voice",
    features: ["Voice Broadcast", "Inbound Calls / IVR", "Outbound Voice", "Call Analytics"]
  },
  {
    label: "Other",
    features: ["Missed Call", "Email Automation"]
  }
];

const DOCUMENT_UPLOAD_OPTIONS = [
  "GST Registration Certificate",
  "PAN Card (Business)",
  "Certificate of Incorporation (mandatory for Pvt Ltd / LLP)",
  "Shop & Establishment License",
  "Business Bank Statement (last 3 months)",
  "Utility Bill (Electricity / Phone / Internet)",
  "Udyam/MSME Certificate",
  "Articles of Incorporation",
  "Website Screenshot",
  "Address Proof (if mismatch or extra verification needed)",
  "Passport Photo",
  "CAF Form (Customer Application Form)",
  "Aadhaar Card",
  "Voter ID",
  "Driving License",
  "Passport"
];

const UsersListPage = () => {
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
  const [selectedRole, setSelectedRole] = useState("user");
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
  const [showToken, setShowToken] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [showMetaUserToken, setShowMetaUserToken] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizingUser, setCustomizingUser] = useState(null);
  const [customFeatureLabels, setCustomFeatureLabels] = useState([]);
  const [customAmount, setCustomAmount] = useState("");
  const [customCurrency, setCustomCurrency] = useState("INR");
  const [customBillingCycle, setCustomBillingCycle] = useState("monthly");
  const [customRole, setCustomRole] = useState("user");
  const [customPaymentLink, setCustomPaymentLink] = useState(null);
  const [customPackageId, setCustomPackageId] = useState("");
  const [customizeLoading, setCustomizeLoading] = useState(false);
  const [customizeMessage, setCustomizeMessage] = useState("");
  const [customizeError, setCustomizeError] = useState("");
  const [adminDocType, setAdminDocType] = useState(DOCUMENT_UPLOAD_OPTIONS[0]);
  const [adminDocFile, setAdminDocFile] = useState(null);
  const [adminDocUploading, setAdminDocUploading] = useState(false);
  const [expandedFeatureGroups, setExpandedFeatureGroups] = useState({
    "Meta Ads": false,
    "Bulk Message": false,
    Voice: false,
    Other: false
  });

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setSelectedRole("user");
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
    setShowToken(false);
    setShowTwilioToken(false);
    setShowMetaSecret(false);
    setShowMetaUserToken(false);
    setErrors({});
  };

  const resetCustomizeForm = () => {
    setShowCustomizeModal(false);
    setCustomizingUser(null);
    setCustomFeatureLabels([]);
    setCustomAmount("");
    setCustomCurrency("INR");
    setCustomBillingCycle("monthly");
    setCustomRole("user");
    setCustomPaymentLink(null);
    setCustomPackageId("");
    setCustomizeMessage("");
    setCustomizeError("");
    setAdminDocType(DOCUMENT_UPLOAD_OPTIONS[0]);
    setAdminDocFile(null);
  };

  const applyCustomizeSnapshot = (user) => {
    const userCustomFeatures = Array.isArray(user?.customFeatureLabels) ? user.customFeatureLabels : [];
    const activePkg = user?.activeCustomPackage || null;
    setCustomizingUser(user);
    setCustomFeatureLabels(userCustomFeatures);
    setCustomAmount(activePkg?.amount ? String(activePkg.amount) : "");
    setCustomCurrency(activePkg?.currency || "INR");
    setCustomBillingCycle(activePkg?.billingCycle || "monthly");
    setCustomRole(String(user?.role || "user"));
    setCustomPackageId(activePkg?.id || "");
    setCustomPaymentLink(
      activePkg
        ? {
            customPackageId: activePkg.id || "",
            paymentLinkId: "",
            paymentLinkUrl: ""
          }
        : null
    );
    setCustomizeMessage("");
    setCustomizeError("");
    setAdminDocType(DOCUMENT_UPLOAD_OPTIONS[0]);
    setAdminDocFile(null);
    setShowCustomizeModal(true);
  };

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await apiService.getAdminUsers();
      setUsers(res?.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const socket = socketService.connect(import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_SOCKET_URL);
    if (!socket) return undefined;

    const handleRefresh = () => {
      fetchUsers();
    };

    socketService.on("custom.package.updated", handleRefresh);
    socketService.on("custom.package.link.created", handleRefresh);
    socketService.on("custom.package.activated", handleRefresh);
    socketService.on("custom.package.reset", handleRefresh);
    socketService.on("payment.updated", handleRefresh);
    socketService.on("documents.updated", handleRefresh);
    socketService.on("workspace.access.updated", handleRefresh);

    return () => {
      socketService.off("custom.package.updated", handleRefresh);
      socketService.off("custom.package.link.created", handleRefresh);
      socketService.off("custom.package.activated", handleRefresh);
      socketService.off("custom.package.reset", handleRefresh);
      socketService.off("payment.updated", handleRefresh);
      socketService.off("documents.updated", handleRefresh);
      socketService.off("workspace.access.updated", handleRefresh);
      socketService.disconnect();
    };
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

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedUserIds.includes(user._id)),
    [selectedUserIds, users]
  );

  const selectedCustomTarget = useMemo(() => {
    if (selectedUsers.length !== 1) return null;
    if (String(selectedUsers[0]?.role || "").toLowerCase() === "superadmin") return null;
    return selectedUsers[0];
  }, [selectedUsers]);

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
    setSelectedRole(String(selectedUser.role || "user"));
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
    setErrors({});
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    resetForm();
  };

  const toggleCustomFeature = (featureLabel) => {
    setCustomFeatureLabels((prev) =>
      prev.includes(featureLabel) ? prev.filter((label) => label !== featureLabel) : [...prev, featureLabel]
    );
  };

  const handleOpenCustomizeFromFilter = () => {
    if (selectedUsers.length !== 1) {
      window.alert("Please select exactly one user to customize package access.");
      return;
    }
    const user = selectedUsers[0];
    if (String(user.role || "").toLowerCase() === "superadmin") {
      window.alert("Superadmin account cannot be customized.");
      return;
    }
    applyCustomizeSnapshot(user);
  };

  const handleOpenCustomize = (selectedUser) => {
    if (String(selectedUser?.role || "").toLowerCase() === "superadmin") {
      window.alert("Superadmin account cannot be customized.");
      return;
    }
    applyCustomizeSnapshot(selectedUser);
  };

  const handleSaveCustomDraft = async () => {
    if (!customizingUser?._id) return;
    if (!customFeatureLabels.length) {
      setCustomizeError("Select at least one feature before saving draft.");
      return;
    }
    if (!Number(customAmount)) {
      setCustomizeError("Enter a valid amount greater than zero.");
      return;
    }
    setCustomizeLoading(true);
    setCustomizeError("");
    setCustomizeMessage("");
    try {
      if (String(customRole || "") !== String(customizingUser?.role || "")) {
        await apiService.updateAdmin(customizingUser._id, {
          username: customizingUser.username || "",
          email: customizingUser.email || "",
          role: customRole
        });
      }
      const payload = {
        featureLabels: customFeatureLabels,
        amount: Number(customAmount),
        billingCycle: customBillingCycle,
        currency: customCurrency
      };
      const response = await apiService.saveCustomPackageDraft(customizingUser._id, payload);
      setCustomPackageId(String(response?.data?.data?._id || customPackageId || ""));
      setCustomizeMessage("Custom package draft saved. You can now generate payment link.");
      await fetchUsers();
    } catch (err) {
      setCustomizeError(err?.response?.data?.message || "Failed to save custom package draft.");
    } finally {
      setCustomizeLoading(false);
    }
  };

  const handleGeneratePaymentLink = async () => {
    if (!customizingUser?._id) return;
    setCustomizeLoading(true);
    setCustomizeError("");
    setCustomizeMessage("");
    try {
      const response = await apiService.generateCustomPackagePaymentLink(customizingUser._id);
      const payload = response?.data?.data || {};
      setCustomPackageId(String(payload.customPackageId || customPackageId || ""));
      setCustomPaymentLink({
        customPackageId: payload.customPackageId || customPackageId || "",
        paymentLinkId: payload.paymentLinkId || "",
        paymentLinkUrl: payload.paymentLinkUrl || ""
      });
      setCustomizeMessage("Payment link generated. Share this link with the user.");
      await fetchUsers();
    } catch (err) {
      setCustomizeError(err?.response?.data?.message || "Failed to generate payment link.");
    } finally {
      setCustomizeLoading(false);
    }
  };

  const handleVerifyPackagePayment = async () => {
    if (!customPackageId || !customPaymentLink?.paymentLinkId) {
      setCustomizeError("Generate payment link first, then verify payment.");
      return;
    }
    setCustomizeLoading(true);
    setCustomizeError("");
    setCustomizeMessage("");
    try {
      await apiService.verifyCustomPackagePayment({
        customPackageId,
        paymentLinkId: customPaymentLink.paymentLinkId
      });
      setCustomizeMessage("Payment verified. User custom package is now active.");
      await fetchUsers();
    } catch (err) {
      setCustomizeError(err?.response?.data?.message || "Payment verification failed.");
    } finally {
      setCustomizeLoading(false);
    }
  };

  const handleResetCustomPackage = async () => {
    if (!customizingUser?._id) return;
    if (!window.confirm("Reset this user to plan defaults?")) return;
    setCustomizeLoading(true);
    setCustomizeError("");
    setCustomizeMessage("");
    try {
      await apiService.resetCustomPackage(customizingUser._id);
      setCustomFeatureLabels([]);
      setCustomAmount("");
      setCustomPackageId("");
      setCustomPaymentLink(null);
      setCustomizeMessage("Custom package reset. Plan defaults are now active.");
      await fetchUsers();
    } catch (err) {
      setCustomizeError(err?.response?.data?.message || "Failed to reset custom package.");
    } finally {
      setCustomizeLoading(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!customPaymentLink?.paymentLinkUrl) return;
    try {
      await navigator.clipboard.writeText(customPaymentLink.paymentLinkUrl);
      setCustomizeMessage("Payment link copied.");
    } catch {
      setCustomizeError("Unable to copy payment link on this browser.");
    }
  };

  const handleUploadAdminDocument = async () => {
    if (!customizingUser?._id) return;
    if (!adminDocFile) {
      setCustomizeError("Select a document file before uploading.");
      return;
    }
    setAdminDocUploading(true);
    setCustomizeError("");
    setCustomizeMessage("");
    try {
      const payload = new FormData();
      payload.append("file", adminDocFile);
      payload.append("docType", adminDocType);
      await apiService.uploadAdminMetaDocumentForUser(customizingUser._id, payload);
      setAdminDocFile(null);
      setCustomizeMessage("Document uploaded successfully for this user.");
      await fetchUsers();
    } catch (err) {
      setCustomizeError(err?.response?.data?.message || "Document upload failed.");
    } finally {
      setAdminDocUploading(false);
    }
  };

  const toggleFeatureGroup = (groupLabel) => {
    setExpandedFeatureGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel]
    }));
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
      !phoneNumber
    ) {
      setErrors({ register: "All fields are required" });
      return;
    }

    setLoading(true);
    try {
      await apiService.updateAdmin(editingUserId, { username, email, role: selectedRole });
      await apiService.saveAdminCredentials({
        userId: editingUserId,
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
        phoneNumber: String(phoneNumber || "").trim()
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
              <h2>Edit User</h2>
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
              {errors.register && <span className="error-text">{errors.register}</span>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? "Updating..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomizeModal && customizingUser && (
        <div className="modal-overlay" onClick={resetCustomizeForm}>
          <div className="modal-content modal-content--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Customize Package Access</h2>
              <button className="modal-close" onClick={resetCustomizeForm}>
                <X size={20} />
              </button>
            </div>

            <div className="customize-modal-user-strip">
              <div className="customize-modal-user-chip">
                <strong>{customizingUser.username || "User"}</strong>
                <span>{customizingUser.email || "No email"}</span>
              </div>
              <div className="customize-modal-user-chip">
                <strong>Current Plan</strong>
                <span>{String(customizingUser.planCode || "trial").toUpperCase()}</span>
              </div>
              <div className="customize-modal-user-chip">
                <strong>Workspace State</strong>
                <span>{customizingUser.workspaceAccessState || "N/A"}</span>
              </div>
            </div>

            <div className="customize-form-grid">
              <div className="form-row form-row--customize">
                <label>Amount</label>
                <div className="customize-input-wrap">
                  <span className="customize-input-prefix">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter package amount"
                    className="customize-input"
                  />
                </div>
              </div>
              <div className="form-row form-row--customize">
                <label>Billing Cycle</label>
                <select
                  value={customBillingCycle}
                  onChange={(e) => setCustomBillingCycle(e.target.value)}
                  className="customize-select"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-row form-row--customize">
                <label>Role</label>
                <select value={customRole} onChange={(e) => setCustomRole(e.target.value)} className="customize-select">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-row form-row--customize">
                <label>Currency</label>
                <div className="customize-input-wrap customize-input-wrap--currency">
                  <input
                    value={customCurrency}
                    onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
                    className="customize-input"
                    placeholder="INR"
                  />
                  <span className="customize-input-suffix">ISO</span>
                </div>
              </div>
            </div>

            <section className="customize-feature-section">
              <h3>Feature Access</h3>
              <p>Select the feature set to assign for this custom package.</p>
              <div className="customize-feature-groups">
                {FEATURE_GROUPS.map((group) => {
                  const expanded = Boolean(expandedFeatureGroups[group.label]);
                  return (
                    <div key={group.label} className="customize-feature-group">
                      <button
                        type="button"
                        className="customize-feature-group__toggle"
                        onClick={() => toggleFeatureGroup(group.label)}
                      >
                        <span>{group.label}</span>
                        <ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
                      </button>
                      {expanded && (
                        <div className="customize-feature-group__grid">
                          {group.features.map((feature) => (
                            <button
                              type="button"
                              key={feature}
                              className={`custom-feature-chip ${customFeatureLabels.includes(feature) ? "custom-feature-chip--active" : ""}`}
                              onClick={() => toggleCustomFeature(feature)}
                            >
                              {customFeatureLabels.includes(feature) ? <Check size={14} /> : null}
                              <span>{feature}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="customize-feature-section">
              <h3>Documents Upload (Admin)</h3>
              <p>Upload user verification files from superadmin for faster approval workflow.</p>
              <div className="customize-doc-upload">
                <select value={adminDocType} onChange={(e) => setAdminDocType(e.target.value)}>
                  {DOCUMENT_UPLOAD_OPTIONS.map((docType) => (
                    <option key={docType} value={docType}>
                      {docType}
                    </option>
                  ))}
                </select>
                <input
                  type="file"
                  onChange={(event) => setAdminDocFile(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="users-select-all-btn"
                  onClick={handleUploadAdminDocument}
                  disabled={adminDocUploading}
                >
                  <Upload size={15} />
                  <span>{adminDocUploading ? "Uploading..." : "Upload Document"}</span>
                </button>
              </div>
            </section>

            <section className="customize-feature-section">
              <h3>Payment Link</h3>
              <p>Save draft, generate Razorpay payment link, and verify after user payment.</p>
              <div className="customize-payment-actions">
                <button
                  type="button"
                  className="users-select-all-btn"
                  onClick={handleSaveCustomDraft}
                  disabled={customizeLoading}
                >
                  {customizeLoading ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="button"
                  className="users-select-all-btn"
                  onClick={handleGeneratePaymentLink}
                  disabled={customizeLoading}
                >
                  {customizeLoading ? "Working..." : "Generate Payment Link"}
                </button>
                <button
                  type="button"
                  className="users-select-all-btn"
                  onClick={handleVerifyPackagePayment}
                  disabled={customizeLoading}
                >
                  {customizeLoading ? "Verifying..." : "Verify Payment"}
                </button>
                <button
                  type="button"
                  className="users-bulk-delete-btn users-bulk-delete-btn--wide"
                  onClick={handleResetCustomPackage}
                  disabled={customizeLoading}
                >
                  Reset To Plan
                </button>
              </div>
              {customPaymentLink?.paymentLinkUrl ? (
                <div className="customize-payment-link-box">
                  <a href={customPaymentLink.paymentLinkUrl} target="_blank" rel="noreferrer">
                    {customPaymentLink.paymentLinkUrl}
                  </a>
                  <button type="button" className="users-select-all-btn" onClick={handleCopyPaymentLink}>
                    <Copy size={14} />
                    <span>Copy Link</span>
                  </button>
                </div>
              ) : null}
            </section>

            {customizeError ? <div className="pricing-feedback pricing-feedback--error">{customizeError}</div> : null}
            {customizeMessage ? (
              <div className="pricing-feedback pricing-feedback--success">
                <CheckCircle2 size={16} />
                <span>{customizeMessage}</span>
              </div>
            ) : null}
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
                  className="users-select-all-btn"
                  onClick={handleOpenCustomizeFromFilter}
                  disabled={!selectedCustomTarget}
                  title={selectedCustomTarget ? "Customize selected user package" : "Select one user to customize"}
                >
                  Customize
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
