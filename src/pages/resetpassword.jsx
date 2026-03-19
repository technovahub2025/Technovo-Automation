import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./login.css";
import "../styles/theme.css";
import { ShieldCheck, Lock, ArrowLeft } from "lucide-react";
import nexionLogo from "../assets/nexion.jpeg";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const API_URL = import.meta.env.VITE_API_ADMIN_URL;

  const validateForm = () => {
    const newErrors = {};

    if (!password) newErrors.password = "New password is required";
    else if (password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/resetpassword/${token}`, { password });
      navigate("/login", { 
        state: { message: "Password reset successful! You can now login with your new password." }
      });
    } catch (err) {
      setErrors({
        general: err.response?.data?.message || "Invalid or expired token. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <div className="auth-brand__logo">
          <img src={nexionLogo} alt="Nexion" className="logo-image" />
        </div>
        <div className="auth-brand__content">
          <div className="auth-brand__badge">
            <ShieldCheck size={20} />
            <span>AI Communication Platform</span>
          </div>
          <h1>Create New Password</h1>
          <p className="auth-brand__lead">
            Set a strong password to secure your Nexion account.
          </p>
          <div className="auth-feature-grid">
            <div className="auth-feature-card">
              <h4>Strong Security</h4>
              <p>Choose a password with at least 6 characters for better protection.</p>
            </div>
            <div className="auth-feature-card">
              <h4>Easy Recovery</h4>
              <p>If you forget your password, you can easily reset it again.</p>
            </div>
            <div className="auth-feature-card">
              <h4>Instant Access</h4>
              <p>Once set, you can immediately access your account with the new password.</p>
            </div>
          </div>
        </div>
        <div className="cloud-shape-top"></div>
        <div className="cloud-shape-bottom"></div>
      </div>

      <div className="cloud-divider" aria-hidden="true">
        <svg viewBox="0 0 100 600" preserveAspectRatio="none">
          <path
            d="
              M0 0
              Q50 50 0 100
              Q50 150 0 200
              Q50 250 0 300
              Q50 350 0 400
              Q50 450 0 500
              Q50 550 0 600
              L100 600
              L100 0
              Z
            "
          />
        </svg>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card__header">
          <div>
            <h2>Reset Password</h2>
            <p>Enter your new password below.</p>
          </div>
        </div>

        {errors.general && <div className="auth-error">{errors.general}</div>}

        <div className="auth-section">
          <div className="input-group password-group">
            <label>New Password</label>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={errors.password ? "error" : ""}
            />
            <span 
              className="eye-icon" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ top: '50px' }}
            >
              {showPassword ? <Lock size={18} /> : <Lock size={18} />}
            </span>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          <div className="input-group password-group">
            <label>Confirm Password</label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={errors.confirmPassword ? "error" : ""}
            />
            <span 
              className="eye-icon" 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{ top: '50px' }}
            >
              {showConfirmPassword ? <Lock size={18} /> : <Lock size={18} />}
            </span>
            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <div className="auth-social">
          <button
            type="button"
            className="social-btn"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft size={18} />
            Back to Login
          </button>
        </div>

        <p className="signup-link">
          Remember your password? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </div>
  );
};

export default ResetPassword;
