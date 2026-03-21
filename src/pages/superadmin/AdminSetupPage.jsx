import React, { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  EyeOff,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  UserRoundPlus
} from "lucide-react";
import apiService from "../../services/api";
import "../admin.css";
import "../../styles/theme.css";

const AdminSetupPage = () => {
  const [step, setStep] = useState(0);
  const [editingUserId, setEditingUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState("");
  const [whatsappId, setWhatsappId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");
  const [whatsappBusiness, setWhatsappBusiness] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [missedCallWebhook, setMissedCallWebhook] = useState("");
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");

  const setupSteps = [
    {
      key: "account",
      title: "Create account",
      description: "Register the admin login and email identity.",
      icon: UserRoundPlus
    },
    {
      key: "channels",
      title: "Attach channels",
      description: "Connect Twilio calling and WhatsApp credentials.",
      icon: PhoneCall
    },
    {
      key: "complete",
      title: "Go live",
      description: "Save the setup and return with everything linked.",
      icon: BadgeCheck
    }
  ];

  const currentStage = step === 0 ? 0 : step === 1 ? 1 : 2;

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setTwilioAccountSid("");
    setTwilioAuthToken("");
    setTwilioPhoneNumber("");
    setWhatsappId("");
    setWhatsappToken("");
    setWhatsappBusiness("");
    setPhoneNumber("");
    setMissedCallWebhook("");
    setErrors({});
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!username || !email || !password) {
      setErrors({ register: "Username, email, and password are required" });
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.registerAdmin({ username, email, password, role: "admin" });
      const createdAdminId = res?.data?.user?.id || res?.data?.user?._id;

      if (!createdAdminId) {
        throw new Error("Admin created but user id is missing in response");
      }

      setEditingUserId(createdAdminId);
      setPassword("");
      setShowPassword(false);
      setErrors({});
      setMessage("Admin account created. Complete channel setup below.");
      setMessageTone("success");
      setStep(2);
    } catch (err) {
      setErrors({ register: err.response?.data?.message || err.message || "Submission failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleTwilioSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (
      !editingUserId ||
      !twilioAccountSid ||
      !twilioAuthToken ||
      !twilioPhoneNumber ||
      !whatsappId ||
      !whatsappToken ||
      !whatsappBusiness ||
      !phoneNumber ||
      !missedCallWebhook
    ) {
      setErrors({ twilio: "All fields are required" });
      return;
    }

    setLoading(true);
    try {
      await apiService.saveAdminCredentials({
        adminId: editingUserId,
        twilioAccountSid: String(twilioAccountSid || "").trim(),
        twilioAuthToken: String(twilioAuthToken || "").trim(),
        twilioPhoneNumber: String(twilioPhoneNumber || "").trim(),
        whatsappId: String(whatsappId || "").trim(),
        whatsappToken: String(whatsappToken || "").trim(),
        whatsappBusiness: String(whatsappBusiness || "").trim(),
        phoneNumber: String(phoneNumber || "").trim(),
        missedCallWebhook: String(missedCallWebhook || "").trim()
      });

      setMessage("Admin and channel credentials saved successfully.");
      setMessageTone("success");
      setStep(0);
      setEditingUserId(null);
      resetForm();
    } catch (err) {
      setErrors({ twilio: err.response?.data?.message || "Twilio submission failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewAdmin = () => {
    resetForm();
    setMessage("");
    setStep(1);
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
              <h1 className="nx-title">Admin Creation</h1>
              <p className="superadmin-subtitle">
                Create administrator access, then complete Twilio and WhatsApp channel configuration in one guided flow.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="superadmin-panel superadmin-panel--page">
        <div className="panel-header">
          <div>
            <h2>Admin Setup</h2>
            <span className="panel-meta">Create a new admin account without mixing it with users or payments.</span>
          </div>
        </div>

        {message && <div className={`pricing-feedback pricing-feedback--${messageTone}`}>{message}</div>}

        <div className="admin-steps admin-steps--page">
          <div className="admin-setup-stage">
            {setupSteps.map((setupStep, index) => {
              const StepIcon = setupStep.icon;
              const state =
                index < currentStage ? "done" : index === currentStage ? "active" : "pending";

              return (
                <div key={setupStep.key} className={`admin-setup-stage__item admin-setup-stage__item--${state}`}>
                  <span className="admin-setup-stage__icon">
                    <StepIcon size={16} />
                  </span>
                  <div className="admin-setup-stage__text">
                    <strong>{setupStep.title}</strong>
                    <span>{setupStep.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {step === 0 ? (
            <div className="admin-setup-empty-layout">
              <div className="admin-setup-hero-card">
                <div className="admin-setup-hero-card__icon">
                  <ShieldCheck size={44} strokeWidth={1.7} />
                </div>
                <div className="admin-setup-hero-card__content">
                  <h3>Create Admin Account</h3>
                  <p>Create login credentials first, then continue with Twilio and WhatsApp setup.</p>
                </div>
                <button className="primary-btn admin-setup-btn" onClick={handleCreateNewAdmin}>
                  Create Admin
                </button>
              </div>

              <aside className="admin-setup-sidecard">
                <div className="admin-setup-sidecard__header">
                  <span className="admin-setup-sidecard__eyebrow">Setup flow</span>
                  <h3>Single-page onboarding</h3>
                  <p>Everything stays inside one focused workspace, so the setup feels like a proper SPA instead of separate screens.</p>
                </div>

                <div className="admin-setup-sidecard__summary">
                  <div className="admin-setup-sidecard__summary-item">
                    <strong>3 steps</strong>
                    <span>Account, channels, finish</span>
                  </div>
                  <div className="admin-setup-sidecard__summary-item">
                    <strong>SPA flow</strong>
                    <span>No route jump during setup</span>
                  </div>
                </div>

                <div className="admin-setup-sidecard__list">
                  <div className="admin-setup-sidecard__item">
                    <span className="admin-setup-sidecard__bullet">
                      <UserRoundPlus size={15} />
                    </span>
                    <div>
                      <strong>Account first</strong>
                      <span>Create the admin identity with email and password.</span>
                    </div>
                  </div>
                  <div className="admin-setup-sidecard__item">
                    <span className="admin-setup-sidecard__bullet">
                      <PhoneCall size={15} />
                    </span>
                    <div>
                      <strong>Channels next</strong>
                      <span>Save Twilio and WhatsApp credentials in the next step.</span>
                    </div>
                  </div>
                  <div className="admin-setup-sidecard__item">
                    <span className="admin-setup-sidecard__bullet">
                      <MessageSquareText size={15} />
                    </span>
                    <div>
                      <strong>Production ready</strong>
                      <span>Finish setup and return with the admin fully prepared for calling and messaging workflows.</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="admin-setup-form-layout">
              {step === 1 ? (
                <form className="login-box admin-form-page admin-form-shell" onSubmit={handleRegisterSubmit}>
                  <div className="step-header">
                    <ArrowLeft className="back-icon" onClick={() => setStep(0)} />
                    <div>
                      <h2>Admin Registration</h2>
                      <p className="admin-form-shell__subtitle">Set the core login credentials for the new admin account.</p>
                    </div>
                  </div>

                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                    <span className="eye-icon" onClick={() => setShowPassword((prev) => !prev)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  </div>

                  {errors.register && <span className="error-text">{errors.register}</span>}
                  <button type="submit" disabled={loading} className="admin-form-submit">
                    {loading ? "Saving..." : "Register"}
                  </button>
                </form>
              ) : (
                <form className="login-box admin-form-page admin-form-shell" onSubmit={handleTwilioSubmit}>
                  <div className="step-header">
                    <ArrowLeft className="back-icon" onClick={() => setStep(1)} />
                    <div>
                      <h2>Twilio & WhatsApp Info</h2>
                      <p className="admin-form-shell__subtitle">Attach calling and messaging credentials to complete setup.</p>
                    </div>
                  </div>

                  <input value={twilioAccountSid} onChange={(e) => setTwilioAccountSid(e.target.value)} placeholder="Twilio Account SID" />
                  <div className="password-field">
                    <input
                      type={showTwilioToken ? "text" : "password"}
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      placeholder="Twilio Auth Token"
                    />
                    <span className="eye-icon" onClick={() => setShowTwilioToken((prev) => !prev)}>
                      {showTwilioToken ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  </div>
                  <input value={twilioPhoneNumber} onChange={(e) => setTwilioPhoneNumber(e.target.value)} placeholder="Twilio Phone Number" />
                  <input value={whatsappId} onChange={(e) => setWhatsappId(e.target.value)} placeholder="WhatsApp ID" />
                  <input value={whatsappToken} onChange={(e) => setWhatsappToken(e.target.value)} placeholder="WhatsApp Token" />
                  <input value={whatsappBusiness} onChange={(e) => setWhatsappBusiness(e.target.value)} placeholder="WhatsApp Business" />
                  <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone Number" />
                  <input value={missedCallWebhook} onChange={(e) => setMissedCallWebhook(e.target.value)} placeholder="Missed Call Webhook URL" />

                  {errors.twilio && <span className="error-text">{errors.twilio}</span>}
                  <button type="submit" disabled={loading} className="admin-form-submit">
                    {loading ? "Saving..." : "Save Info"}
                  </button>
                </form>
              )}

              <aside className="admin-setup-sidecard admin-setup-sidecard--context">
                <div className="admin-setup-sidecard__header">
                  <span className="admin-setup-sidecard__eyebrow">Current step</span>
                  <h3>{step === 1 ? "Create the admin identity" : "Connect channels and credentials"}</h3>
                  <p>
                    {step === 1
                      ? "Finish the login details first, then the same page moves directly into channel configuration."
                      : "This step links calling and WhatsApp setup to the newly created admin account without leaving the workflow."}
                  </p>
                </div>

                <div className="admin-setup-sidecard__summary">
                  <div className="admin-setup-sidecard__summary-item">
                    <strong>{step === 1 ? "Step 1 of 3" : "Step 2 of 3"}</strong>
                    <span>{step === 1 ? "Core access details" : "Calling and WhatsApp details"}</span>
                  </div>
                  <div className="admin-setup-sidecard__summary-item">
                    <strong>Focused view</strong>
                    <span>Only the active form is visible</span>
                  </div>
                </div>

                <div className="admin-setup-sidecard__list">
                  <div className="admin-setup-sidecard__item">
                    <span className="admin-setup-sidecard__bullet">
                      <ShieldCheck size={15} />
                    </span>
                    <div>
                      <strong>Guided setup</strong>
                      <span>Only the active section is shown, so the page stays focused and clean.</span>
                    </div>
                  </div>
                  <div className="admin-setup-sidecard__item">
                    <span className="admin-setup-sidecard__bullet">
                      <BadgeCheck size={15} />
                    </span>
                    <div>
                      <strong>SPA flow</strong>
                      <span>The admin creation flow remains in this single-page workspace from start to finish.</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminSetupPage;
