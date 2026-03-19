import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./login.css";
import "../styles/theme.css";
import { Mail, ArrowLeft } from "lucide-react";
import authPageLogo from "../assets/logo(new).png";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_ADMIN_URL;

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/api/forgot-password`, { email });
      setSuccess(true);
      setSentTo(email);
      setEmail("");
      setErrors({});
    } catch (err) {
      setErrors({
        general: err.response?.data?.message || "Failed to send reset email. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-shell auth-shell--center">
        <div className="auth-card auth-card--center">
          <div className="auth-brand__center">
            <div className="auth-brand__logo-center">
              <img src={authPageLogo} alt="Nexion" className="logo-image" />
            </div>
            <p className="auth-brand__subtitle">Intelligent communication cloud</p>
          </div>

          <div className="auth-card__header">
            <h2>Check your email</h2>
            <p>We sent a reset link to {sentTo || "your inbox"}.</p>
          </div>

          <div className="auth-success">
            <div className="auth-success__icon">
              <Mail size={28} />
            </div>
            <div>
              <h3>Reset link sent</h3>
              <p>Follow the instructions in the email to set a new password.</p>
            </div>
          </div>

          <div className="auth-section">
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate("/login")}
            >
              Return to Login
            </button>
          </div>

          <p className="auth-card__footer-note">Did not receive it? Check spam or try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell auth-shell--center">
      <form className="auth-card auth-card--center" onSubmit={handleSubmit}>
        <div className="auth-brand__center">
          <div className="auth-brand__logo-center">
            <img src={authPageLogo} alt="Nexion" className="logo-image" />
          </div>
          <p className="auth-brand__subtitle">Intelligent communication cloud</p>
        </div>

        <div className="auth-card__header">
          <h2>Reset your password</h2>
          <p>Enter your email to receive a reset link.</p>
        </div>

        {errors.general && <div className="auth-error">{errors.general}</div>}

        <div className="auth-section">
          <div className="input-group">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? "error" : ""}
              autoComplete="email"
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <button type="submit" className="primary-btn" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Reset Link"}
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

        <p className="auth-card__footer-note">Remember your password? <Link to="/login">Sign In</Link></p>
      </form>
    </div>
  );
};

export default ForgotPassword;

