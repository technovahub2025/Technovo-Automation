import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Banknote,
  BadgeDollarSign,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X
} from "lucide-react";
import apiService from "../../services/api";
import socketService from "../../services/socketService";
import resolveAdminApiUrl from "../../services/adminApiUrl";
import { SIDEBAR_ACCESS_GROUPS, buildSidebarFeatureFlags, collapseSidebarFeatureFlags, isSidebarAccessGroupEnabled } from "../../utils/sidebarFeatureFlags";
import "../admin.css";
import "../../styles/theme.css";

const CRM_FEATURES = [
  "CRM Home",
  "Pipeline",
  "Tasks",
  "Deals",
  "Meetings",
  "Reports",
  "Follow-up Ops",
  "Lead Scoring Settings",
  "Task Calendar"
];

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
    label: "CRM",
    features: CRM_FEATURES
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

const PLAN_OPTIONS = [
  { value: "basic", label: "Basic" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" }
];

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" }
];

const normalizePlanCode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return PLAN_OPTIONS.some((option) => option.value === normalized) ? normalized : "basic";
};

const normalizeBillingCycle = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return BILLING_CYCLE_OPTIONS.some((option) => option.value === normalized) ? normalized : "monthly";
};

const resolvePlanLabel = (value) => {
  const normalized = normalizePlanCode(value);
  return PLAN_OPTIONS.find((option) => option.value === normalized)?.label || "Basic";
};

const resolveBillingCycleLabel = (value) => {
  const normalized = normalizeBillingCycle(value);
  return BILLING_CYCLE_OPTIONS.find((option) => option.value === normalized)?.label || "Monthly";
};

const resolveSafeExternalUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const formatCurrencyAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(amount);
};

const resolvePaymentStatus = (user = {}) => {
  const subscriptionStatus = String(user.subscriptionStatus || "").trim().toLowerCase();
  const workspaceState = String(user.workspaceAccessState || "").trim().toLowerCase();
  const paymentMethod = String(user.latestPaymentMethod || "").trim().toLowerCase();
  const paymentStatus = String(user.latestPaymentStatus || "").trim().toLowerCase();
  const active = subscriptionStatus === "active" || workspaceState === "active" || Boolean(user.canPerformActions);

  if (active && paymentMethod === "cash") {
    return { label: "Active via Cash", tone: "success" };
  }

  if (active) {
    return { label: "Active", tone: "success" };
  }

  if (paymentStatus === "captured" || paymentStatus === "paid") {
    return { label: "Payment Captured", tone: "warning" };
  }

  if (subscriptionStatus === "payment_pending") {
    return { label: "Payment Pending", tone: "warning" };
  }

  if (subscriptionStatus === "trial" || subscriptionStatus === "trialing") {
    return { label: "Trial", tone: "neutral" };
  }

  return { label: "No Active Access", tone: "warning" };
};

const resolvePaymentMethodLabel = (user = {}) => {
  const method = String(user.latestPaymentMethod || "").trim().toLowerCase();
  if (!method) return "No recent payment";
  if (method === "cash") return "Cash";
  return method.charAt(0).toUpperCase() + method.slice(1);
};

const resolvePaymentSnapshot = (user = {}) => {
  const planCode = normalizePlanCode(user.latestPaymentPlanCode || user.planCode || "basic");
  const billingCycle = normalizeBillingCycle(user.latestPaymentBillingCycle || "monthly");
  const amount = Number(user.latestPaymentAmount || 0);
  const paymentReference = String(user.latestPaymentReference || "").trim();
  const paymentMethod = String(user.latestPaymentMethod || "").trim().toLowerCase();
  const status = resolvePaymentStatus(user);

  return {
    planCode,
    planLabel: resolvePlanLabel(planCode),
    billingCycle,
    billingCycleLabel: resolveBillingCycleLabel(billingCycle),
    amount,
    amountLabel: amount > 0 ? `INR ${formatCurrencyAmount(amount)}` : "Not recorded",
    paymentReference: paymentReference || "Not recorded",
    paymentMethod,
    paymentMethodLabel: resolvePaymentMethodLabel(user),
    statusLabel: status.label,
    statusTone: status.tone
  };
};

const DOCUMENT_UPLOAD_OPTIONS = [
  { value: "GST Registration Certificate", label: "GST Registration Certificate", alert: true },
  { value: "PAN Card (Business)", label: "PAN Card (Business)", alert: true },
  {
    value: "Certificate of Incorporation (mandatory for Pvt Ltd / LLP)",
    label: "Certificate of Incorporation (mandatory for Pvt Ltd / LLP)",
    alert: false
  },
  { value: "Shop & Establishment License", label: "Shop & Establishment License", alert: false },
  { value: "Business Bank Statement (last 3 months)", label: "Business Bank Statement (last 3 months)", alert: false },
  { value: "Utility Bill (Electricity / Phone / Internet)", label: "Utility Bill (Electricity / Phone / Internet)", alert: true },
  { value: "Udyam/MSME Certificate", label: "Udyam/MSME Certificate", alert: false },
  { value: "Articles of Incorporation", label: "Articles of Incorporation", alert: false },
  { value: "Website Screenshot", label: "Website Screenshot", alert: false },
  { value: "Address Proof (if mismatch or extra verification needed)", label: "Address Proof (if mismatch or extra verification needed)", alert: false },
  { value: "Passport Photo", label: "Passport Photo", alert: false },
  { value: "CAF Form (Customer Application Form)", label: "CAF Form (Customer Application Form)", alert: false },
  { value: "Aadhaar Card", label: "Aadhaar Card", alert: false },
  { value: "Voter ID", label: "Voter ID", alert: false },
  { value: "Driving License", label: "Driving License", alert: false },
  { value: "Passport", label: "Passport", alert: true }
];

const resolveDocumentOptionLabel = (option) => {
  const label = String(option?.label || option?.value || "").trim();
  if (!label) return "";
  return label;
};

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

const isAgentLikeUser = (user = {}) => {
  const normalizedRole = String(user.role || "").trim().toLowerCase();
  const normalizedCompanyRole = String(user.companyRole || "").trim().toLowerCase();

  const hasAgentMarkers = Boolean(
    user.isAgentWorkspace === true ||
      user.createdBy ||
      user.ownerId ||
      user.parentUserId ||
      normalizedCompanyRole === "agent" ||
      normalizedCompanyRole === "user" ||
      normalizedRole === "agent" ||
      String(user.workspaceAccessState || "").trim().toLowerCase() === "agent_workspace"
  );

  if (hasAgentMarkers) {
    return true;
  }

  if (["superadmin", "admin", "manager"].includes(normalizedRole) || normalizedCompanyRole === "admin") {
    return false;
  }

  return normalizedRole === "user";
};

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
  const [metaLeadFormId, setMetaLeadFormId] = useState("");
  const [metaPageAccessToken, setMetaPageAccessToken] = useState("");
  const [metaPaymentFundUrl, setMetaPaymentFundUrl] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sidebarFeatureFlags, setSidebarFeatureFlags] = useState(buildSidebarFeatureFlags());
  const [showToken, setShowToken] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [showMetaSecret, setShowMetaSecret] = useState(false);
  const [showMetaUserToken, setShowMetaUserToken] = useState(false);
  const [showMetaPageToken, setShowMetaPageToken] = useState(false);
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
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [cashPaymentUser, setCashPaymentUser] = useState(null);
  const [cashPaymentPlanCode, setCashPaymentPlanCode] = useState("basic");
  const [cashPaymentBillingCycle, setCashPaymentBillingCycle] = useState("monthly");
  const [cashPaymentAmount, setCashPaymentAmount] = useState("");
  const [cashPaymentReference, setCashPaymentReference] = useState("");
  const [cashPaymentLoading, setCashPaymentLoading] = useState(false);
  const [cashPaymentMessage, setCashPaymentMessage] = useState("");
  const [cashPaymentError, setCashPaymentError] = useState("");
  const [adminDocType, setAdminDocType] = useState(DOCUMENT_UPLOAD_OPTIONS[0].value);
  const [adminDocFile, setAdminDocFile] = useState(null);
  const [adminDocUploading, setAdminDocUploading] = useState(false);
  const [expandedFeatureGroups, setExpandedFeatureGroups] = useState({
    "Meta Ads": false,
    "Bulk Message": false,
    Voice: false,
    CRM: false,
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
    setMetaLeadFormId("");
    setMetaPageAccessToken("");
    setMetaPaymentFundUrl("");
    setPhoneNumber("");
    setSidebarFeatureFlags(buildSidebarFeatureFlags());
    setShowToken(false);
    setShowTwilioToken(false);
    setShowMetaSecret(false);
    setShowMetaUserToken(false);
    setShowMetaPageToken(false);
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
    setAdminDocType(DOCUMENT_UPLOAD_OPTIONS[0].value);
    setAdminDocFile(null);
  };

  const resetCashPaymentForm = () => {
    setShowCashPaymentModal(false);
    setCashPaymentUser(null);
    setCashPaymentPlanCode("basic");
    setCashPaymentBillingCycle("monthly");
    setCashPaymentAmount("");
    setCashPaymentReference("");
    setCashPaymentLoading(false);
    setCashPaymentMessage("");
    setCashPaymentError("");
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
    setAdminDocType(DOCUMENT_UPLOAD_OPTIONS[0].value);
    setAdminDocFile(null);
    setShowCustomizeModal(true);
  };

  const applyCashPaymentSnapshot = (user) => {
    const existingPlanCode = normalizePlanCode(user?.latestPaymentPlanCode || user?.planCode || "basic");
    const existingBillingCycle = normalizeBillingCycle(user?.latestPaymentBillingCycle || "monthly");
    const existingAmount = Number(user?.latestPaymentAmount || 0);

    setCashPaymentUser(user);
    setCashPaymentPlanCode(existingPlanCode);
    setCashPaymentBillingCycle(existingBillingCycle);
    setCashPaymentAmount(existingAmount > 0 ? String(existingAmount) : "");
    setCashPaymentReference(String(user?.latestPaymentReference || "").trim());
    setCashPaymentMessage("");
    setCashPaymentError("");
    setShowCashPaymentModal(true);
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
    const socket = socketService.connect(resolveAdminApiUrl() || import.meta.env.VITE_SOCKET_URL);
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
        })
        .sort((a, b) => getUserLifoTime(b) - getUserLifoTime(a)),
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
    setMetaLeadFormId(selectedUser.metaLeadFormId ?? selectedUser.metaleadformid ?? "");
    setMetaPageAccessToken(selectedUser.metaPageAccessToken ?? selectedUser.metapageaccesstoken ?? "");
    setMetaPaymentFundUrl(selectedUser.metaPaymentFundUrl ?? selectedUser.metapaymentfundurl ?? "");
    setPhoneNumber(selectedUser.phoneNumber ?? selectedUser.phonenumber ?? "");
    setSidebarFeatureFlags(buildSidebarFeatureFlags(selectedUser.sidebarFeatureFlags || {}));
    setShowToken(false);
    setShowTwilioToken(false);
    setShowMetaSecret(false);
    setShowMetaUserToken(false);
    setShowMetaPageToken(false);
    setErrors({});
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    resetForm();
  };

  const toggleSidebarAccessGroup = (group) => {
    setSidebarFeatureFlags((previous) => {
      const enabled = isSidebarAccessGroupEnabled(previous, group);
      const next = { ...previous };
      group.flags.forEach((flag) => {
        next[flag] = !enabled;
      });
      return next;
    });
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

  const handleOpenCashPayment = (selectedUser) => {
    if (String(selectedUser?.role || "").toLowerCase() === "superadmin") {
      window.alert("Superadmin account cannot receive manual cash payments.");
      return;
    }
    applyCashPaymentSnapshot(selectedUser);
  };

  const updateUserFromCashPayment = (userId, paymentPayload, responseData = {}) => {
    const planCode = normalizePlanCode(responseData.planCode || paymentPayload.planCode);
    const billingCycle = normalizeBillingCycle(responseData.billingCycle || paymentPayload.billingCycle);
    const amount = Number(responseData.amount || paymentPayload.amount || 0);
    const paymentReference = String(responseData.paymentReference || paymentPayload.paymentReference || "").trim();

    setUsers((previousUsers) =>
      previousUsers.map((user) => {
        if (String(user._id || "") !== String(userId || "")) return user;

        return {
          ...user,
          planCode,
          subscriptionStatus: responseData.subscriptionStatus || "active",
          workspaceAccessState: responseData.context?.workspaceAccessState || "active",
          canPerformActions: responseData.context?.canPerformActions ?? true,
          canViewAnalytics: responseData.context?.canViewAnalytics ?? true,
          latestPaymentMethod: "cash",
          latestPaymentStatus: responseData.latestPaymentStatus || "captured",
          latestPaymentAmount: Number.isFinite(amount) ? amount : Number(paymentPayload.amount || 0),
          latestPaymentPlanCode: planCode,
          latestPaymentBillingCycle: billingCycle,
          latestPaymentReference: paymentReference || paymentPayload.paymentReference || "",
          latestPaymentCurrency: responseData.latestPaymentCurrency || user.latestPaymentCurrency || "INR"
        };
      })
    );
  };

  const handleSubmitCashPayment = async (event) => {
    event.preventDefault();

    if (!cashPaymentUser?._id || cashPaymentLoading) return;

    const planCode = normalizePlanCode(cashPaymentPlanCode);
    const billingCycle = normalizeBillingCycle(cashPaymentBillingCycle);
    const amount = Number(cashPaymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setCashPaymentError("Enter a valid amount greater than zero.");
      return;
    }

    setCashPaymentLoading(true);
    setCashPaymentError("");
    setCashPaymentMessage("");

    const payload = {
      planCode,
      billingCycle,
      amount,
      paymentReference: String(cashPaymentReference || "").trim()
    };

    try {
      const response = await apiService.createCashPayment(cashPaymentUser._id, payload);
      const responseData = response?.data?.data || {};
      updateUserFromCashPayment(cashPaymentUser._id, payload, responseData);
      setCashPaymentMessage(response?.data?.message || "Cash payment recorded and access activated.");
      await fetchUsers();
    } catch (error) {
      setCashPaymentError(error?.response?.data?.message || "Failed to record cash payment.");
    } finally {
      setCashPaymentLoading(false);
    }
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
      const paymentFundUrl = String(metaPaymentFundUrl || "").trim();
      await apiService.updateAdmin(editingUserId, {
        username,
        email,
        role: selectedRole,
        ...(paymentFundUrl ? { metaPaymentFundUrl: paymentFundUrl } : {}),
        sidebarFeatureFlags: collapseSidebarFeatureFlags(sidebarFeatureFlags)
      });
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
        metaLeadFormId: String(metaLeadFormId || "").trim(),
        metaPageAccessToken: String(metaPageAccessToken || "").trim(),
        ...(paymentFundUrl ? { metaPaymentFundUrl: paymentFundUrl } : {}),
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

  const cashPaymentPreview = cashPaymentUser ? resolvePaymentSnapshot(cashPaymentUser) : null;

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
                <label>Meta Lead Form ID</label>
                <input value={metaLeadFormId} onChange={(e) => setMetaLeadFormId(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Meta Page Access Token</label>
                <div className="password-field password-field--compact">
                  <input
                    type={showMetaPageToken ? "text" : "password"}
                    value={metaPageAccessToken}
                    onChange={(e) => setMetaPageAccessToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowMetaPageToken((prev) => !prev)}>
                    {showMetaPageToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Meta Payment Fund URL</label>
                <input
                  type="url"
                  value={metaPaymentFundUrl}
                  onChange={(e) => setMetaPaymentFundUrl(e.target.value)}
                  placeholder="https://business.facebook.com/..."
                />
              </div>
              <div className="form-row">
                <label>Phone Number</label>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
              <section className="customize-feature-section">
                <h3>Sidebar Access</h3>
                <p>Choose which sidebar modules this user can see.</p>
                <div className="customize-feature-groups">
                  {SIDEBAR_ACCESS_GROUPS.map((group) => {
                    const enabled = isSidebarAccessGroupEnabled(sidebarFeatureFlags, group);
                    return (
                      <button
                        key={group.key}
                        type="button"
                        className={`custom-feature-chip ${enabled ? "custom-feature-chip--active" : ""}`}
                        onClick={() => toggleSidebarAccessGroup(group)}
                        title={group.description}
                      >
                        {enabled ? <Check size={14} /> : null}
                        <span>{group.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
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
                  <span className="customize-input-prefix">INR</span>
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
              <div className="customize-doc-upload__notice">
                Important documents are shown in green in the dropdown.
              </div>
              <div className="customize-doc-upload">
                <select value={adminDocType} onChange={(e) => setAdminDocType(e.target.value)}>
                  {DOCUMENT_UPLOAD_OPTIONS.map((docType) => (
                    <option
                      key={docType.value}
                      value={docType.value}
                      style={docType.alert ? { color: "#15803d", fontWeight: 600 } : undefined}
                    >
                      {resolveDocumentOptionLabel(docType)}
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

      {showCashPaymentModal && cashPaymentUser && cashPaymentPreview && (
        <div className="modal-overlay" onClick={resetCashPaymentForm}>
          <div className="modal-content modal-content--wide cash-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Cash Payment / Activate Plan</h2>
                <p className="superadmin-subtitle" style={{ marginTop: 6 }}>
                  Record a manual payment for this user and activate the selected plan immediately.
                </p>
              </div>
              <button className="modal-close" onClick={resetCashPaymentForm}>
                <X size={20} />
              </button>
            </div>

            <div className="cash-payment-alert">
              If the user already has an active subscription, this payment will replace the plan with the new one you assign below.
            </div>

            <div className="customize-modal-user-strip cash-payment-user-strip">
              <div className="customize-modal-user-chip">
                <strong>{cashPaymentUser.username || "User"}</strong>
                <span>{cashPaymentUser.email || "No email"}</span>
              </div>
              <div className="customize-modal-user-chip">
                <strong>Current Plan</strong>
                <span>{resolvePlanLabel(cashPaymentUser.latestPaymentPlanCode || cashPaymentUser.planCode || "basic")}</span>
              </div>
              <div className="customize-modal-user-chip">
                <strong>Current Access</strong>
                <span>{resolvePaymentStatus(cashPaymentUser).label}</span>
              </div>
            </div>

            <form className="cash-payment-form" onSubmit={handleSubmitCashPayment}>
              <div className="cash-payment-grid">
                <div className="form-row form-row--customize">
                  <label>Plan</label>
                  <select
                    value={cashPaymentPlanCode}
                    onChange={(e) => setCashPaymentPlanCode(e.target.value)}
                    className="customize-select"
                  >
                    {PLAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row form-row--customize">
                  <label>Billing Cycle</label>
                  <select
                    value={cashPaymentBillingCycle}
                    onChange={(e) => setCashPaymentBillingCycle(e.target.value)}
                    className="customize-select"
                  >
                    {BILLING_CYCLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row form-row--customize">
                  <label>Amount</label>
                  <div className="customize-input-wrap">
                    <span className="customize-input-prefix">INR</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashPaymentAmount}
                      onChange={(e) => setCashPaymentAmount(e.target.value)}
                      placeholder="Enter payment amount"
                      className="customize-input"
                    />
                  </div>
                </div>
                <div className="form-row form-row--customize">
                  <label>Payment Reference / Receipt No.</label>
                  <div className="cash-payment-reference-wrap">
                    <CreditCard size={14} />
                    <input
                      value={cashPaymentReference}
                      onChange={(e) => setCashPaymentReference(e.target.value)}
                      placeholder="Optional receipt or reference number"
                    />
                  </div>
                </div>
              </div>

              <section className="cash-payment-summary">
                <h3>Confirm Assignment</h3>
                <div className="cash-payment-summary__grid">
                  <div>
                    <span>New Plan</span>
                    <strong>{resolvePlanLabel(cashPaymentPlanCode)}</strong>
                  </div>
                  <div>
                    <span>Billing Cycle</span>
                    <strong>{resolveBillingCycleLabel(cashPaymentBillingCycle)}</strong>
                  </div>
                  <div>
                    <span>Amount</span>
                    <strong>{cashPaymentAmount ? `INR ${formatCurrencyAmount(cashPaymentAmount)}` : "Enter amount"}</strong>
                  </div>
                  <div>
                    <span>Reference</span>
                    <strong>{cashPaymentReference.trim() || "Auto-generated"}</strong>
                  </div>
                </div>
                <div className="cash-payment-summary__note">
                  This will mark the user as active via cash, update the latest payment details, and refresh access right away.
                </div>
              </section>

              {cashPaymentError ? <div className="pricing-feedback pricing-feedback--error">{cashPaymentError}</div> : null}
              {cashPaymentMessage ? (
                <div className="pricing-feedback pricing-feedback--success">
                  <CheckCircle2 size={16} />
                  <span>{cashPaymentMessage}</span>
                </div>
              ) : null}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={resetCashPaymentForm} disabled={cashPaymentLoading}>
                  Close
                </button>
                <button type="submit" className="btn-submit" disabled={cashPaymentLoading}>
                  {cashPaymentLoading ? (
                    <>
                      <Loader2 size={16} className="spin-icon" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Banknote size={16} />
                      <span>Record Cash Payment</span>
                    </>
                  )}
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
                <span>Billing / Payment</span>
                <span>User ID</span>
                <span>Actions</span>
              </div>
              {filteredUsers.map((listedUser) => (
                <div
                  key={listedUser._id}
                  className={`users-list-table users-list-table--row ${showFilters ? "users-list-table--selecting" : ""}`}
                >
                  {(() => {
                    const paymentSnapshot = resolvePaymentSnapshot(listedUser);
                    return (
                      <>
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
                    <div className="user-payment-stack">
                      <span className="status-chip status-chip--neutral">
                        {isAgentLikeUser(listedUser) ? "Agent" : String(listedUser.role || "user")}
                      </span>
                      <span className={`status-chip ${paymentSnapshot.statusTone === "success" ? "status-chip--success" : paymentSnapshot.statusTone === "warning" ? "status-chip--warning" : "status-chip--neutral"}`}>
                        {paymentSnapshot.statusLabel}
                      </span>
                    </div>
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
                  <div className="users-list-cell">
                    <div className="user-payment-details">
                      <div className="user-payment-details__line">
                        <BadgeDollarSign size={13} />
                        <span>{paymentSnapshot.planLabel}</span>
                      </div>
                      <div className="user-payment-details__line">
                        <span className="user-payment-details__label">Amount</span>
                        <strong>{paymentSnapshot.amountLabel}</strong>
                      </div>
                      <div className="user-payment-details__line">
                        <span className="user-payment-details__label">Cycle</span>
                        <strong>{paymentSnapshot.billingCycleLabel}</strong>
                      </div>
                      <div className="user-payment-details__line">
                        <span className="user-payment-details__label">Method</span>
                        <strong>{paymentSnapshot.paymentMethodLabel}</strong>
                      </div>
                      <div className="user-payment-details__line user-payment-details__line--subtle">
                        <span className="user-payment-details__label">Ref</span>
                        <strong>{paymentSnapshot.paymentReference}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="users-list-cell users-list-cell--mono">
                    {listedUser._id?.slice(-8) || "N/A"}
                  </div>
                  <div className="users-list-cell users-list-cell--actions user-card-actions user-card-actions--list">
                    {resolveSafeExternalUrl(listedUser.metaPaymentFundUrl || listedUser.metapaymentfundurl) ? (
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => window.open(resolveSafeExternalUrl(listedUser.metaPaymentFundUrl || listedUser.metapaymentfundurl), "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink size={14} />
                        <span>Add Funds</span>
                      </button>
                    ) : null}
                    {!isAgentLikeUser(listedUser) && (
                      <button className="edit-btn" onClick={() => handleEdit(listedUser)}>
                        Edit
                      </button>
                    )}
                    <button type="button" className="cash-payment-btn" onClick={() => handleOpenCashPayment(listedUser)}>
                      <Banknote size={14} />
                      <span>Cash Payment / Activate Plan</span>
                    </button>
                  </div>
                      </>
                    );
                  })()}
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
