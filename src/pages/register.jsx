import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./login.css";
import "../styles/theme.css";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "./authcontext";
import { auth, googleProvider } from "../firebase/firebase";
import { signInWithPopup } from "firebase/auth";
import authPageLogo from "../assets/logo(new).png";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const { login: loginUser } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpInputsRef = useRef([]);

  // ✅ ENV values
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const USER_KEY = import.meta.env.VITE_USER_KEY || "user";

  const exchangeFirebaseToken = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const res = await axios.post(`${API_URL}/api/auth/firebase`, { idToken });
    const token = res.data.token;
    const user = res.data.user;

    if (!token) throw new Error("Google registration failed");

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("authToken", token);
    localStorage.setItem("authProvider", "firebase");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    loginUser(user, token, "firebase");

    if (user.role === "superadmin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!username.trim()) newErrors.username = "Username is required";
    else if (username.length < 3)
      newErrors.username = "Username must be at least 3 characters";

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email))
      newErrors.email = "Email is invalid";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    if (!otpModalOpen) return;
    if (otpResendTimer <= 0) return;
    const timerId = setInterval(() => {
      setOtpResendTimer((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timerId);
  }, [otpModalOpen, otpResendTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const res = await axios.post(`${API_URL}/api/nexion/register`, {
        username,
        email,
        password,
        role: "user",
      });

      console.log("API Response:", res.data);

      // ✅ Store values (keys from ENV)
      localStorage.setItem("username", username);
      localStorage.setItem("email", email);

      if (res.data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      }

      if (res.data.token) {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        localStorage.setItem("authToken", res.data.token);
      }

      if (res.data.user && res.data.token) {
        localStorage.setItem("authProvider", "local");
        loginUser(res.data.user, res.data.token, "local");
      }

      setUsername("");
      setEmail("");
      setPassword("");
      setErrors({});

      alert(`Registration successful! Trial activated for ${username}`);

      navigate("/", { replace: true });
    } catch (err) {
      console.error("Registration error:", err);
      setErrors({
        general:
          err.response?.data?.message ||
          "Registration failed. Please try again.",
      });
    }
  };

  const handleGoogleRegister = async () => {
    setErrors((prev) => ({ ...prev, general: undefined }));
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await exchangeFirebaseToken(result.user);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        general:
          err?.message || "Google registration failed. Please try again."
      }));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleOtpStart = async () => {
    if (!otpPhone.trim()) {
      setErrors((prev) => ({ ...prev, otp: "Phone number is required" }));
      return;
    }
    setOtpModalOpen(true);
    setErrors((prev) => ({ ...prev, otp: undefined }));
    setOtpDigits(Array(6).fill(""));
    setOtpCode("");
    setOtpResendTimer(60);
    setOtpLoading(true);
    try {
      await axios.post(`${API_URL}/api/auth/otp/start`, { phoneNumber: otpPhone });
      setOtpSent(true);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        otp: err.response?.data?.message || "Failed to send OTP"
      }));
      setOtpSent(false);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpRegister = async () => {
    if (!otpPhone.trim() || !otpCode.trim()) {
      setErrors((prev) => ({ ...prev, otp: "Phone and OTP are required" }));
      return;
    }
    setOtpLoading(true);
    try {
      const combinedOtp = otpDigits.join("");
      setOtpCode(combinedOtp);
      const res = await axios.post(`${API_URL}/api/auth/otp/register`, {
        phoneNumber: otpPhone,
        code: combinedOtp || otpCode
      });
      const token = res.data.token;
      const user = res.data.user;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("authToken", token);
      localStorage.setItem("authProvider", "local");
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      loginUser(user, token, "local");
      navigate("/", { replace: true });
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        otp: err.response?.data?.message || "OTP registration failed"
      }));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const sanitized = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = sanitized;
    setOtpDigits(nextDigits);
    setOtpCode(nextDigits.join(""));
    if (sanitized && index < otpInputsRef.current.length - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const nextDigits = Array(6).fill("").map((_, idx) => pasted[idx] || "");
    setOtpDigits(nextDigits);
    setOtpCode(nextDigits.join(""));
    const lastIndex = Math.min(pasted.length, 6) - 1;
    if (lastIndex >= 0) {
      otpInputsRef.current[lastIndex]?.focus();
    }
    event.preventDefault();
  };

  return (
    <div className="auth-shell auth-shell--center">
      <div className="auth-card auth-card--center">
        <div className="auth-brand__center">
          <div className="auth-brand__logo-center">
            <img src={authPageLogo} alt="Nexion" className="logo-image" />
          </div>
          <p className="auth-brand__subtitle">Intelligent communication cloud</p>
        </div>

        <div className="auth-toggle">
          <Link to="/login" className="auth-toggle__btn">Sign In</Link>
          <Link to="/register" className="auth-toggle__btn active">Sign Up</Link>
          <span className="auth-toggle__pill auth-toggle__pill--right"></span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
          <div className="auth-card__header">
            <h2>Create your account</h2>
            <p>Start your trial and build your workspace.</p>
          </div>

          {errors.general && <div className="auth-error">{errors.general}</div>}

          <div className="auth-section">
            <div className="input-group otp-phone">
              <label>Username</label>
              <input
                type="text"
                placeholder="Your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={errors.username ? "error" : ""}
                autoComplete="username"
                id="register-username"
                name="usernameregister"
              />
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            <div className="input-group">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "error" : ""}
                autoComplete="email"
                id="register-email"
                name="emailregister"
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="input-group password-group">
              <label>Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? "error" : ""}
              />
              <button
                type="button"
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <button type="submit" className="primary-btn">
              Create Account
            </button>
          </div>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <div className="auth-social">
            <button
              type="button"
              className="social-btn google-btn"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
            >
              {googleLoading ? (
                "Creating Account..."
              ) : (
                <>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.85-1.57 2.42v1.95h2.54c1.48-1.37 2.33-3.38 2.26-5.37z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.71 5.29-1.93l-2.54-1.95c-.71.48-1.61.76-2.75.76-2.11 0-3.9-1.42-4.54-3.33H1.83v2.01C3.15 15.36 5.92 17 8.98 17z"/>
                    <path fill="#FBBC05" d="M4.44 11.55c-.17-.51-.27-1.05-.27-1.6s.1-1.09.27-1.6V6.34H1.83c-.55 1.09-.83 2.32-.83 3.61s.28 2.52.83 3.61l2.61-2.01z"/>
                    <path fill="#EA4335" d="M8.98 6.86c1.2 0 2.27.41 3.12 1.22l2.25-2.25C12.95 4.51 11.14 3.83 8.98 3.83 5.92 3.83 3.15 5.47 1.83 8.34l2.61 2.01c.64-1.91 2.43-3.33 4.54-3.33z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="otpPhone"
                placeholder="+91 98765 43210"
                value={otpPhone}
                onChange={(e) => setOtpPhone(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="social-btn otp-btn"
              onClick={otpSent ? handleOtpRegister : handleOtpStart}
              disabled={otpLoading}
            >
              {otpLoading ? "Processing..." : otpSent ? "Verify OTP" : "Continue with Phone"}
            </button>
            {errors.otp && <div className="auth-error">{errors.otp}</div>}
          </div>

          <p className="auth-card__footer-note">Secure onboarding, access control, and identity checks included.</p>
        </form>
      </div>

      {otpModalOpen && (
        <div className="otp-modal__backdrop" onClick={() => setOtpModalOpen(false)}>
          <div className="otp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="otp-modal__header">
              <h3>Enter verification code</h3>
              <button
                type="button"
                className="otp-modal__close"
                onClick={() => setOtpModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="otp-modal__sub">
              We sent a 6-digit code to <strong>{otpPhone || "your phone"}</strong>.
            </p>
            <div className="otp-modal__inputs" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <input
                  key={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  ref={(el) => { otpInputsRef.current[index] = el; }}
                />
              ))}
            </div>
            {errors.otp && <div className="auth-error">{errors.otp}</div>}
            <button
              type="button"
              className="primary-btn"
              onClick={handleOtpRegister}
              disabled={otpLoading || otpDigits.join("").length !== 6}
            >
              {otpLoading ? "Verifying..." : "Verify OTP"}
            </button>
            <div className="otp-modal__footer">
              <button
                type="button"
                className="otp-modal__resend"
                onClick={handleOtpStart}
                disabled={otpResendTimer > 0 || otpLoading}
              >
                {otpResendTimer > 0 ? `Resend in 00:${String(otpResendTimer).padStart(2, "0")}` : "Resend OTP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
