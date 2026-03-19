import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./authcontext";
import apiService from "../services/api";
import { ArrowLeft, EyeOff, Eye, X, ShieldCheck, CreditCard, Users, FileCheck } from "lucide-react";
import "./admin.css";
import "../styles/theme.css";

const AdminMultiStep = () => {
  const [step, setStep] = useState(0);
  const { user, refreshSession } = useContext(AuthContext);
  const currentUserRole = user?.role || "user";
  const navigate = useNavigate();

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
  const [phoneNumber, setPhoneNumber] = useState("");
  const [missedCallWebhook, setMissedCallWebhook] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);

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
    fetchUsers();
  }, []);

  useEffect(() => {
    try {
      const pending = localStorage.getItem("pendingAdminRegistration");
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed?.username || parsed?.email) {
          setUsername(parsed.username || "");
          setEmail(parsed.email || "");
          setPassword(parsed.password || "");
          if (parsed.password) {
            setShowPassword(true);
          }
          setStep(1);
        }
      }
    } catch {
      // ignore invalid data
    }
  }, []);

  const handleRefreshSession = async () => {
    setRefreshMessage("");
    setRefreshingSession(true);
    try {
      const result = await refreshSession();
      setRefreshMessage(result.message || (result.ok ? "Session refreshed" : "Refresh failed"));
    } catch (err) {
      setRefreshMessage(err?.message || "Refresh failed");
    } finally {
      setRefreshingSession(false);
    }
  };

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
          phoneNumber: String(phoneNumber || "").trim(),
          missedCallWebhook: String(missedCallWebhook || "").trim(),
        });

        alert("Admin info updated successfully!");

        // Reset fields after edit flow
        setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
        setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setPhoneNumber(""); setMissedCallWebhook("");
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
        localStorage.removeItem("pendingAdminRegistration");
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
          phoneNumber: String(phoneNumber || "").trim(),
          missedCallWebhook: String(missedCallWebhook || "").trim(),
        }
      );

      console.log("Twilio Info Saved:", res.data);
      alert("Admin & Twilio info saved successfully!");
      localStorage.setItem(
        "twilioData",
        JSON.stringify({ twilioAccountSid, twilioAuthToken, twilioPhoneNumber, whatsappId, whatsappToken, whatsappBusiness, phoneNumber, missedCallWebhook })
      );

      setStep(0);
      setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setPhoneNumber(""); setMissedCallWebhook("");
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
      setUsers((prev) => prev.filter((user) => user._id !== id));
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
    setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setPhoneNumber(""); setMissedCallWebhook("");
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
    setTwilioAccountSid(""); setTwilioAuthToken(""); setTwilioPhoneNumber(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness(""); setPhoneNumber(""); setMissedCallWebhook("");
    setResettingPassword(false);
    setErrors({});
    setStep(1);
  };

  return (
    <div className="superadmin-shell">
      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Admin</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form className="login-box" onSubmit={handleRegisterSubmit}>
              <div className="form-row">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>



              <div className="form-row">
                <label>Twilio Account SID</label>
                <input
                  type="text"
                  placeholder="Twilio Account SID"
                  value={twilioAccountSid}
                  onChange={(e) => setTwilioAccountSid(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Twilio Auth Token</label>
                <div className="password-field">
                  <input
                    type={showTwilioToken ? "text" : "password"}
                    placeholder="Twilio Auth Token"
                    value={twilioAuthToken}
                    onChange={(e) => setTwilioAuthToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowTwilioToken(!showTwilioToken)}>
                    {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>
              <div className="form-row">
                <label>Twilio Phone Number</label>
                <input
                  type="text"
                  placeholder="Twilio Phone Number"
                  value={twilioPhoneNumber}
                  onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>WhatsApp ID</label>
                <input
                  type="text"
                  placeholder="WhatsApp ID"
                  value={whatsappId}
                  onChange={(e) => setWhatsappId(e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>WhatsApp Token</label>
                <div className="password-field">
                  <input
                    type={showToken ? "text" : "password"}
                    placeholder="WhatsApp Token"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                  />
                  <span className="eye-icon" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              </div>

              <div className="form-row">
                <label>WhatsApp Business</label>
                <input
                  type="text"
                  placeholder="WhatsApp Business"
                  value={whatsappBusiness}
                  onChange={(e) => setWhatsappBusiness(e.target.value)}
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

              <div className="form-row">
                <label>Missed Call Webhook</label>
                <input
                  type="text"
                  placeholder="Missed Call Webhook URL"
                  value={missedCallWebhook}
                  onChange={(e) => setMissedCallWebhook(e.target.value)}
                />
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
        <div>
          <h1 className="nx-title">Superadmin Control Center</h1>
          <p className="superadmin-subtitle">
            Manage platform admins, billing, approvals, and operational settings.
          </p>
        </div>
        <div className="superadmin-actions">
          {currentUserRole !== "user" && (
            <button
              type="button"
              className="ghost-btn"
              onClick={handleRefreshSession}
              disabled={refreshingSession}
              title="Refresh Firebase session"
            >
              {refreshingSession ? "Refreshing..." : "Refresh session"}
            </button>
          )}
          <button type="button" className="primary-btn" onClick={handleCreateNewAdmin}>
            Create Admin
          </button>
        </div>
      </header>

      {refreshMessage && <div className="inline-alert">{refreshMessage}</div>}

      <div className="superadmin-grid">
        {/* USERS LIST */}
        <section className="superadmin-panel">
          <div className="panel-header">
            <h2>Admins</h2>
            <span className="panel-meta">{users.length} total</span>
          </div>

          {currentUserRole === "user" && (
            <div className="user-specific-data">
              <h3>Your Performance</h3>
              <p>Access Level: Standard User</p>
              <p>No admin actions available.</p>
            </div>
          )}

          <div className="user-list">
            {users.length === 0 && <p className="no-data">No admins found.</p>}
            {users.map((user) => (
              <div key={user._id} className="user-card admin-details-card">
                <div className="user-card-content">
                  <div className="user-header-info">
                    <strong>{user.username}</strong> <span className="user-email">({user.email})</span>
                  </div>
                </div>
                <div className="user-card-actions">
                  <button className="edit-btn" onClick={() => handleEdit(user)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(user._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="superadmin-panel">
          <div className="panel-header">
            <h2>Admin Setup</h2>
            <span className="panel-meta">Step-based onboarding</span>
          </div>

          <div className="admin-steps">
        {step === 0 && (
          <div className="initial-screen admin-welcome-container">
            <div className="welcome-icon-box">
              <ShieldCheck size={60} strokeWidth={1.5} />
            </div>
            <h3>Create Admin Account</h3>
            <p>You can create login credentials for your admin</p>
            <button onClick={handleCreateNewAdmin}>Create Admin</button>
          </div>
        )}

        {step === 1 && (
          <form className="login-box" onSubmit={handleRegisterSubmit}>
            <div className="step-header">
              <ArrowLeft className="back-icon" onClick={() => setStep(0)} />
              <h2>Admin Registration</h2>
            </div>

            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="eye-icon" onClick={togglePasswordVisibility}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>

            {errors.register && <span className="error-text">{errors.register}</span>}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Register"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="login-box" onSubmit={handleTwilioSubmit}>
            <div className="step-header">
              <ArrowLeft className="back-icon" onClick={() => setStep(1)} />
              <h2>Twilio & WhatsApp Info</h2>
            </div>

            <input
              type="text"
              placeholder="Twilio Account SID"
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
            />
            <div className="password-field">
              <input
                type={showTwilioToken ? "text" : "password"}
                placeholder="Twilio Auth Token"
                value={twilioAuthToken}
                onChange={(e) => setTwilioAuthToken(e.target.value)}
              />
              <span className="eye-icon" onClick={() => setShowTwilioToken(!showTwilioToken)}>
                {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
            <input
              type="text"
              placeholder="Twilio Phone Number"
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
            />
            <input
              type="text"
              placeholder="WhatsApp ID"
              value={whatsappId}
              onChange={(e) => setWhatsappId(e.target.value)}
            />
            <input
              type="text"
              placeholder="WhatsApp Token"
              value={whatsappToken}
              onChange={(e) => setWhatsappToken(e.target.value)}
            />
            <input
              type="text"
              placeholder="WhatsApp Business"
              value={whatsappBusiness}
              onChange={(e) => setWhatsappBusiness(e.target.value)}
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <input
              type="text"
              placeholder="Missed Call Webhook URL"
              value={missedCallWebhook}
              onChange={(e) => setMissedCallWebhook(e.target.value)}
            />

            {errors.twilio && <span className="error-text">{errors.twilio}</span>}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Info"}
            </button>
          </form>
        )}
          </div>
        </section>
      </div>

      <div className="superadmin-control-grid">
        <div className="control-card">
          <div className="control-icon"><Users size={20} /></div>
          <div>
            <h4>Users & Companies</h4>
            <p>View and manage onboarded companies and admins.</p>
          </div>
          <button className="ghost-btn">Open</button>
        </div>
        <div className="control-card">
          <div className="control-icon"><FileCheck size={20} /></div>
          <div>
            <h4>Document Approvals</h4>
            <p>Review Meta verification uploads and approve accounts.</p>
          </div>
          <button className="ghost-btn" onClick={() => navigate("/verification")}>Review</button>
        </div>
        <div className="control-card">
          <div className="control-icon"><CreditCard size={20} /></div>
          <div>
            <h4>Plans & Payments</h4>
            <p>Track subscriptions, invoices, and plan upgrades.</p>
          </div>
          <button className="ghost-btn">Manage</button>
        </div>
      </div>
    </div>
  );
};

export default AdminMultiStep;


