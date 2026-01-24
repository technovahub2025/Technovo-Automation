import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "./authcontext";
import axios from "axios";
import { Lock, ArrowLeft, Eye, EyeOff, X, ShieldCheck } from "lucide-react";
import "./admin.css";

const AdminMultiStep = () => {
  const [step, setStep] = useState(0);
  const { user } = useContext(AuthContext);
  const currentUserRole = user?.role || "user";

  // ------------------- USER REGISTRATION -------------------
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // ------------------- TWILIO / WHATSAPP -------------------
  const [twilioId, setTwilioId] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappBusiness, setWhatsappBusiness] = useState("");
  const [showToken, setShowToken] = useState(false);

  // ------------------- USERS LIST -------------------
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false); // Modal state

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const backendUrl = "http://localhost:8000";

  // ------------------- FETCH USERS -------------------
  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/getadmin`);
      const allUsers = res.data.users || [];
      setUsers(allUsers);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
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
    if (editingUserId && (!twilioId || !whatsappId || !whatsappToken || !whatsappBusiness)) {
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
        // Update admin + Twilio info
        await axios.put(`${backendUrl}/api/edit/${editingUserId}`, {
          ...payload,
          twilioData: { twilioId, whatsappId, whatsappToken, whatsappBusiness },
        });
        alert("Admin info updated successfully!");
      } else {
        // New admin registration
        const res = await axios.post(`${backendUrl}/registeradmin`, payload);
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
        }
        setStep(2); // Move to Twilio step for new admin
      }

      // Reset all fields
      setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
      setTwilioId(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness("");
      setEditingUserId(null);
      setResettingPassword(false);
      setErrors({});
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setErrors({ register: err.response?.data?.message || "Submission failed" });
    } finally {
      setLoading(false);
    }
  };

  // ------------------- TWILIO FORM FOR NEW ADMIN -------------------
  const handleTwilioSubmit = async (e) => {
    e.preventDefault();
    if (!twilioId || !whatsappId || !whatsappToken || !whatsappBusiness) {
      setErrors({ twilio: "All fields are required" });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${backendUrl}/api/nexionadmin/admindata`,
        { twilioId, whatsappId, whatsappToken, whatsappBusiness },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("Twilio Info Saved:", res.data);
      alert("Admin & Twilio info saved successfully!");
      localStorage.setItem(
        "twilioData",
        JSON.stringify({ twilioId, whatsappId, whatsappToken, whatsappBusiness })
      );

      setStep(0);
      setTwilioId(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness("");
      setErrors({});
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
      await axios.delete(`${backendUrl}/api/delete/${id}`);
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

    setTwilioId(user.twilioId);
    setWhatsappId(user.whatsappId);
    setWhatsappToken(user.whatsappToken);
    setWhatsappBusiness(user.whatsappBusiness);


    setShowEditModal(true);
    setErrors({});
  };

  // ------------------- CLOSE MODAL -------------------
  const closeModal = () => {
    setShowEditModal(false);
    setEditingUserId(null);
    setUsername(""); setEmail(""); setPassword(""); setShowPassword(false);
    setTwilioId(""); setWhatsappId(""); setWhatsappToken(""); setWhatsappBusiness("");
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
    setResettingPassword(false);
    setErrors({});
    setStep(1);
  };

  return (
    <div className="admin-multistep-page">
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
                <label>Twilio SID</label>
                <input
                  type="text"
                  placeholder="Twilio Account SID"
                  value={twilioId}
                  onChange={(e) => setTwilioId(e.target.value)}
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

      {/* USERS LIST */}
      <div className="user-list">
        <h2>All Admins</h2>


        {/* USER ROLE: SHOW SPECIFIC DATA (Example) */}
        {currentUserRole === "user" && (
          <div className="user-specific-data" style={{ marginBottom: "20px", padding: "15px", background: "#f5f5f5", borderRadius: "8px" }}>
            <h3>Your Performance</h3>
            <p>Access Level: Standard User</p>
            <p>No admin actions available.</p>
          </div>
        )}

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
              value={twilioId}
              onChange={(e) => setTwilioId(e.target.value)}
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

            {errors.twilio && <span className="error-text">{errors.twilio}</span>}
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Info"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminMultiStep;