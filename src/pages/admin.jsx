import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import socketService from "../services/socketService";
import { ArrowUpRight, BadgeCheck, CreditCard, Eye, EyeOff, Fingerprint, Settings2, Shield, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import "./admin.css";
import "../styles/theme.css";

const ADMIN_CARDS = [
  {
    key: "users",
    icon: UsersRound,
    label: "User operations",
    title: "Users List",
    description: "Open the full users and admins list, review account status, and manage edits from one place.",
    path: "/admin/users",
    action: "Open Users",
    meta: "Search + role filters",
    accent: "superadmin-dashboard-card--users"
  },
  {
    key: "setup",
    icon: Settings2,
    label: "Admin onboarding",
    title: "Admin Creation",
    description: "Create a new admin account and finish Twilio and WhatsApp setup in a dedicated workflow.",
    path: "/admin/admin-setup",
    action: "Create Admin",
    meta: "Guided setup flow",
    accent: "superadmin-dashboard-card--setup"
  },
  {
    key: "payments",
    icon: WalletCards,
    label: "Billing control",
    title: "Payments Details",
    description: "Manage plan pricing and review the live payments ledger with socket-based refresh updates.",
    path: "/admin/payments",
    action: "Open Payments",
    meta: "Pricing + ledger tabs",
    accent: "superadmin-dashboard-card--payments"
  },
  {
    key: "verification",
    icon: ShieldCheck,
    label: "Verification review",
    title: "Verification Docs",
    description: "Review submitted registration documents, approve verification items, and move verified users into admin setup.",
    path: "/verification",
    action: "Open Verification",
    meta: "Document review queue",
    accent: "superadmin-dashboard-card--verification"
  }
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [socketConnected, setSocketConnected] = useState(false);

  // ------------------- USER REGISTRATION -------------------
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // ------------------- TWILIO / WHATSAPP -------------------
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

  // ------------------- USERS LIST -------------------
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false); // Modal state

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");

  const backendUrl = import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_API_URL || "";

  // ------------------- FETCH USERS -------------------
  const fetchUsers = async () => {
    try {
      const res = await apiService.get(`${backendUrl}/api/getadmin`);
      const allUsers = res.data.users || [];
      setUsers(allUsers);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    const socket = socketService.connect(import.meta.env.VITE_SOCKET_URL);
    setSocketConnected(Boolean(socket?.connected));

    const syncSocketStatus = () => setSocketConnected(Boolean(socketService.getSocket()?.connected));
    socket?.on("connect", syncSocketStatus);
    socket?.on("disconnect", syncSocketStatus);

    return () => {
      socket?.off("connect", syncSocketStatus);
      socket?.off("disconnect", syncSocketStatus);
      socketService.disconnect();
    };
  }, []);

  // ------------------- REGISTER / EDIT ADMIN -------------------
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!username || !email) {
      setErrors({ register: "Username and email are required" });
      return;
    }

    if (!editingUserId && !password) {
      setErrors({ register: "Password is required for new admin" });
      return;
    }

    // For Twilio editing inside modal, make sure all fields are filled
    if (editingUserId && (!twilioAccountSid || !twilioPhoneNumber || !whatsappId || !whatsappToken || !whatsappBusiness || !phoneNumber || !missedCallWebhook)) {
      setErrors({ register: "All Twilio & WhatsApp fields are required" });
      return;
    }

    setLoading(true);
    try {
      const payload = { username, email, role: "admin" };

      if (!editingUserId || resettingPassword) {
        payload.password = password;
      }

      if (editingUserId) {
        // 1) Update basic admin profile
        await apiService.put(`${backendUrl}/api/edit/${editingUserId}`, payload);

        // 2) Update Twilio/WhatsApp credentials via dedicated backend API
        await apiService.post(`${backendUrl}/api/nexionadmin/admindata`, {
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
          missedCallWebhook: String(missedCallWebhook || "").trim(),
        });

        alert("Admin info updated successfully!");

        // Reset fields after edit flow
        setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
        setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setMetaAppId(""); setMetaAppSecret(""); setMetaRedirectUri(""); setMetaUserAccessToken(""); setMetaAdAccountId(""); setPhoneNumber(""); setMissedCallWebhook("");
        setEditingUserId(null);
        setResettingPassword(false);
        setErrors({});
        setShowEditModal(false);
        fetchUsers();
      } else {
        // New admin registration
        const res = await apiService.post(`${backendUrl}/registeradmin`, payload);
        const createdAdminId = res?.data?.user?.id || res?.data?.user?._id;
        if (!createdAdminId) {
          throw new Error("Admin created but user id is missing in response");
        }
        setEditingUserId(createdAdminId);
        setPassword("");
        setShowPassword(false);
        setErrors({});
        setStep(2); // Move to Twilio step for new admin
      }
    } catch (err) {
      setErrors({ register: err.response?.data?.message || "Submission failed" });
    } finally {
      setLoading(false);
    }
  };

  // ------------------- TWILIO FORM FOR NEW ADMIN -------------------
  const handleTwilioSubmit = async (e) => {
    e.preventDefault();
    if (!editingUserId) {
      setErrors({ twilio: "Admin ID missing. Please create/edit admin again." });
      return;
    }
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber || !whatsappId || !whatsappToken || !whatsappBusiness || !phoneNumber || !missedCallWebhook) {
      setErrors({ twilio: "All fields are required" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.post(
        `${backendUrl}/api/nexionadmin/admindata`,
        {
          adminId: editingUserId,
          twilioAccountSid: String(twilioAccountSid || "").trim(),
          twilioAuthToken: String(twilioAuthToken || "").trim(),
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
          missedCallWebhook: String(missedCallWebhook || "").trim(),
        }
      );

      console.log("Twilio Info Saved:", res.data);
      alert("Admin & Twilio info saved successfully!");
      localStorage.setItem(
        "twilioData",
        JSON.stringify({ twilioAccountSid, twilioAuthToken, twilioPhoneNumber, whatsappId, whatsappToken, whatsappBusiness, metaAppId, metaAppSecret, metaRedirectUri, metaUserAccessToken, metaAdAccountId, phoneNumber, missedCallWebhook })
      );

      setStep(0);
      setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setMetaAppId(""); setMetaAppSecret(""); setMetaRedirectUri(""); setMetaUserAccessToken(""); setMetaAdAccountId(""); setPhoneNumber(""); setMissedCallWebhook("");
      setErrors({});
      fetchUsers();
    } catch (err) {
      setErrors({ twilio: err.response?.data?.message || "Twilio submission failed" });
    } finally {
      setLoading(false);
    }
  };

  // ------------------- DELETE USER -------------------
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiService.delete(`${backendUrl}/api/delete/${id}`);
      fetchUsers();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ------------------- EDIT USER -------------------
  const handleEdit = (user) => {
    setUsername(user.username);
    setEmail(user.email);
    setPassword(""); // Clear password field for security
    setShowPassword(false);
    setResettingPassword(false);
    setEditingUserId(user._id);

    // Populate Twilio info if exists

    setTwilioAccountSid(user.twilioAccountSid ?? user.twilioaccountsid ?? "");
    setTwilioAuthToken(user.twilioAuthToken ?? user.twilioauthtoken ?? "");
    setTwilioPhoneNumber(user.twilioPhoneNumber ?? user.twiliophonenumber ?? user.phoneNumber ?? user.phonenumber ?? "");
    setWhatsappId(user.whatsappId ?? user.whatsappid ?? "");
    setWhatsappToken(user.whatsappToken ?? user.whatsapptoken ?? "");
    setWhatsappBusiness(user.whatsappBusiness ?? user.whatsappbussiness ?? "");
    setMetaAppId(user.metaAppId ?? user.metaappid ?? "");
    setMetaAppSecret(user.metaAppSecret ?? user.metaappsecret ?? "");
    setMetaRedirectUri(user.metaRedirectUri ?? user.metaredirecturi ?? "");
    setMetaUserAccessToken(user.metaUserAccessToken ?? user.metauseraccesstoken ?? "");
    setMetaAdAccountId(user.metaAdAccountId ?? user.metaadaccountid ?? "");
    setPhoneNumber(user.phoneNumber ?? user.phonenumber ?? "");
    setMissedCallWebhook(user.missedCallWebhook ?? user.missedcallwebhook ?? "");


    setShowEditModal(true);
    setErrors({});
  };

  // ------------------- CLOSE MODAL -------------------
  const closeModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
    setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setMetaAppId(""); setMetaAppSecret(""); setMetaRedirectUri(""); setMetaUserAccessToken(""); setMetaAdAccountId(""); setPhoneNumber(""); setMissedCallWebhook("");
    setErrors({});
  };

  // ------------------- TOGGLE PASSWORD -------------------
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // ------------------- CREATE NEW ADMIN -------------------
  const handleCreateNewAdmin = () => {
    setEditingUserId(null);
    setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
    setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setMetaAppId(""); setMetaAppSecret(""); setMetaRedirectUri(""); setMetaUserAccessToken(""); setMetaAdAccountId(""); setPhoneNumber(""); setMissedCallWebhook("");
    setResettingPassword(false);
    setErrors({});
    setStep(1);
  };

  return (
    <div className="superadmin-shell">
      <header className="superadmin-header">
        <div className="superadmin-hero">
          <div className="superadmin-hero__eyebrow">
            <BadgeCheck size={16} />
            <span>Superadmin workspace</span>
          </div>
          <div className="superadmin-hero__heading">
            <div>
              <h1 className="nx-title">Superadmin Control Center</h1>
              <p className="superadmin-subtitle">
                A full-width operations hub for user control, admin onboarding, and billing workflows with live system visibility.
              </p>
            </div>
            <div className="superadmin-hero__pulse">
              <div className="superadmin-hero__pulse-ring" />
              <span>{socketConnected ? "System online" : "Reconnecting services"}</span>
            </div>
          </div>
          <div className="superadmin-overview-grid">
            <article className="superadmin-overview-card">
              <div className="superadmin-overview-card__icon">
                <UsersRound size={18} />
              </div>
              <div>
                <strong>User governance</strong>
                <span>Account review, access control, and role-level management.</span>
              </div>
            </article>
            <article className="superadmin-overview-card">
              <div className="superadmin-overview-card__icon">
                <Fingerprint size={18} />
              </div>
              <div>
                <strong>Secure onboarding</strong>
                <span>Provision new admins with setup steps aligned to your workflow.</span>
              </div>

              <div className="form-row">
                <label>Meta App ID</label>
                <input
                  type="text"
                  placeholder="Meta App ID"
                  value={metaAppId}
                  onChange={(e) => setMetaAppId(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Meta App Secret</label>
                <div className="password-field">
                  <input
                    type={showMetaSecret ? "text" : "password"}
                    placeholder="Meta App Secret"
                    value={metaAppSecret}
                    onChange={(e) => setMetaAppSecret(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowMetaSecret(!showMetaSecret)}>
                    {showMetaSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>

              <div className="form-row">
                <label>Meta Redirect URI</label>
                <input
                  type="text"
                  placeholder="Meta Redirect URI"
                  value={metaRedirectUri}
                  onChange={(e) => setMetaRedirectUri(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Meta User Access Token</label>
                <div className="password-field">
                  <input
                    type={showMetaUserToken ? "text" : "password"}
                    placeholder="Meta User Access Token"
                    value={metaUserAccessToken}
                    onChange={(e) => setMetaUserAccessToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowMetaUserToken(!showMetaUserToken)}>
                    {showMetaUserToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>

              <div className="form-row">
                <label>Meta Ad Account ID</label>
                <input
                  type="text"
                  placeholder="Meta Ad Account ID"
                  value={metaAdAccountId}
                  onChange={(e) => setMetaAdAccountId(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div>
                <strong>Billing visibility</strong>
                <span>Keep pricing controls and live payment activity in one place.</span>
              </div>
            </article>
          </div>
        </div>
      </header>

      <div className="superadmin-dashboard-grid">
        {ADMIN_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.key} className={`superadmin-dashboard-card ${card.accent}`}>
              <div className="superadmin-dashboard-card__top">
                <div className="superadmin-dashboard-card__icon-wrap">
                  <div className="superadmin-dashboard-card__icon">
                    <Icon size={20} />
                  </div>
                  <span className="superadmin-dashboard-card__label">{card.label}</span>
                </div>
                <span className="superadmin-dashboard-card__meta">{card.meta}</span>
              </div>
              <div className="superadmin-dashboard-card__content">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
              <div className="superadmin-dashboard-card__footer">
                <div className="superadmin-dashboard-card__hint">
                  <Shield size={15} />
                  <span>Production-ready workflow</span>
                </div>
                <button className="primary-btn superadmin-dashboard-card__action" onClick={() => navigate(card.path)}>
                  <span>{card.action}</span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboard;
