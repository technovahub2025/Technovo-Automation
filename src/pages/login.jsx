import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./login.css";
import defaultProfileImage from "../../src/assets/nexion.jpeg";
import { Eye, EyeOff } from "lucide-react";
import { AuthContext } from "./authcontext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login: loginUser } = useContext(AuthContext);
  const [showPassword, setShowPassword] = useState(false);

  // ✅ ENV values
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "authToken";

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email is invalid";

    if (!password) newErrors.password = "Password is required";
    else if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      let res;
      let token;
      let user;

      // ✅ Try user/admin login first
      try {
        res = await axios.post(`${API_URL}/api/nexion/login`, {
          email,
          password,
        });
        token = res.data.token;
        user = res.data.user;
      } catch (firstError) {
        // ✅ If regular login fails, try superadmin login
        console.log("Regular login failed, trying superadmin...");

        res = await axios.post(`${API_URL}/superadmin/login`, {
          email,
          password,
        });
        token = res.data.token;
        user = res.data.user;
      }

      if (!token) throw new Error("Login failed");

      // ✅ Save token using ENV token key (optional)
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem("authToken", token);

      // ✅ Update state using context
      loginUser(user, token);

      // ✅ Redirect based on role
      if (user.role === "superadmin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setErrors({
        general:
          err.response?.data?.message || "Login failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-box" onSubmit={handleSubmit} autoComplete="off">
        {/* Hidden fields */}
        <input
          type="text"
          name="fake-user"
          autoComplete="username"
          style={{ display: "none" }}
        />
        <input
          type="password"
          name="fake-pass"
          autoComplete="current-password"
          style={{ display: "none" }}
        />

        <div className="profile-image-container">
          <img
            src={defaultProfileImage}
            alt="Profile"
            className="profile-image"
          />
        </div>

        <h2>Login to Your Account</h2>

        {/* Email */}
        <div className="input-group">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            readOnly
            onFocus={(e) => e.target.removeAttribute("readOnly")}
            onChange={(e) => setEmail(e.target.value)}
            className={errors.email ? "error" : ""}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        {/* Password */}
        <div className="input-group password-group">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            readOnly
            onFocus={(e) => e.target.removeAttribute("readOnly")}
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

          {errors.password && (
            <span className="error-text">{errors.password}</span>
          )}
        </div>

        {/* Remember + Forgot */}
        <div className="login-options">
          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember
          </label>

          <Link to="/forgot-password" className="forgot-link">
            Forgot Password?
          </Link>
        </div>

        {errors.general && <div className="general-error">{errors.general}</div>}

        <button
          type="submit"
          className="login-submit-btn"
          disabled={isLoading}
          style={{ marginBottom: "1rem" }}
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>

        <p className="signup-link">
          Don't have an account? <Link to="/register">Sign Up</Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
