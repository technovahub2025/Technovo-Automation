import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./login.css";
import defaultProfileImage from "../../src/assets/nexion.jpeg";
import { Eye, EyeOff } from "lucide-react";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  // ✅ ENV values
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const TOKEN_KEY = import.meta.env.VITE_TOKEN_KEY || "token";
  const USER_KEY = import.meta.env.VITE_USER_KEY || "user";

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
      }

      setUsername("");
      setEmail("");
      setPassword("");
      setErrors({});

      alert(`Registration successful! Welcome ${username}`);

      navigate("/login");
    } catch (err) {
      console.error("Registration error:", err);
      setErrors({
        general:
          err.response?.data?.message ||
          "Registration failed. Please try again.",
      });
    }
  };

  return (
    <div className="login-container">
      <form className="login-box" onSubmit={handleSubmit} autoComplete="on">
        <h2>Register</h2>

        <div className="profile-image-container">
          <img
            src={defaultProfileImage}
            alt="Profile"
            className="profile-image"
          />
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={errors.username ? "error" : ""}
            autoComplete="username"
            id="register-username"
            name="usernameregister"
          />
          {errors.username && (
            <span className="error-text">{errors.username}</span>
          )}
        </div>

        <div className="input-group">
          <input
            type="email"
            placeholder="Email Address"
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
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            readOnly
            onFocus={(e) => e.target.removeAttribute("readOnly")}
            onChange={(e) => setPassword(e.target.value)}
            className={errors.password ? "error" : ""}
          />

          <span
            className="eye-icon"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </span>

          {errors.password && (
            <span className="error-text">{errors.password}</span>
          )}
        </div>

        {errors.general && <div className="general-error">{errors.general}</div>}

        <button
          type="submit"
          className="login-submit-btn"
          style={{ marginBottom: "1rem" }}
        >
          Register
        </button>

        <p className="signup-link">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
