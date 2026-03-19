import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./RegisterDocuments.css";

const RegisterDocuments = () => {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;

  const [formData, setFormData] = useState(() => {
    let storedUsername = "";
    try {
      storedUsername = localStorage.getItem("username") || "";
    } catch {
      storedUsername = "";
    }
    if (storedUsername.includes("@")) {
      storedUsername = "";
    }
    return {
      companyName: "",
      username: storedUsername,
      email: "",
      password: ""
    };
  });
  const [teamSize, setTeamSize] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [docs, setDocs] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const documentFields = [
    { key: "gst_certificate", label: "GST Registration Certificate", required: true },
    { key: "pan_business", label: "PAN Card (Business)", required: true },
    { key: "incorporation_cert", label: "Certificate of Incorporation (mandatory for Pvt Ltd / LLP)", required: true },
    { key: "shop_license", label: "Shop & Establishment License", required: true },
    { key: "bank_statement", label: "Business Bank Statement (last 3 months)", required: true },
    { key: "utility_bill", label: "Utility Bill (Electricity / Phone / Internet)", required: true },
    { key: "udyam_msme", label: "Udyam/MSME Certificate", required: true },
    { key: "articles_incorp", label: "Articles of Incorporation", required: true },
    { key: "website_screenshot", label: "Website Screenshot", required: true },
    { key: "address_proof", label: "Address Proof (if mismatch or extra verification needed)", required: true },
    { key: "passport_photo", label: "Passport Photo", required: true },
    { key: "caf_form", label: "CAF Form (Customer Application Form)", required: true },
    { key: "aadhar_card", label: "Aadhaar Card", required: true },
    { key: "voter_id", label: "Voter ID", required: false },
    { key: "driving_license", label: "Driving License", required: false },
    { key: "passport_doc", label: "Passport", required: false }
  ];

  const validate = () => {
    const next = {};
    if (!formData.companyName.trim()) next.companyName = "Company name is required";
    if (!formData.username.trim()) next.username = "Username is required";
    if (!formData.email.trim()) next.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = "Email is invalid";
    if (!formData.password) next.password = "Password is required";
    else if (formData.password.length < 6) next.password = "Minimum 6 characters";
    if (!teamSize) next.teamSize = "Select team size";
    if (!acceptedTerms) next.terms = "You must accept the terms";
    documentFields.forEach((doc) => {
      if (doc.required && !docs[doc.key]) next[doc.key] = "Required document";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const refreshSuccessMessage = (nextEmail, nextCompany, nextUsername) => {
    try {
      const map = JSON.parse(localStorage.getItem("registerDocsSuccessMap") || "{}");
      const key = `${(nextEmail || "").trim().toLowerCase()}|${(nextCompany || "").trim().toLowerCase()}`;
      const usernameKey = `user:${(nextUsername || "").trim().toLowerCase()}`;
      setSuccessMessage(map[key] || map[usernameKey] || "");
    } catch {
      setSuccessMessage("");
    }
  };

  useEffect(() => {
    refreshSuccessMessage(formData.email, formData.companyName, formData.username);
  }, [formData.email, formData.companyName, formData.username]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      let token = localStorage.getItem("authToken") || localStorage.getItem("token") || "";
      try {
        const res = await axios.post(`${API_URL}/api/nexion/register`, {
          companyName: formData.companyName.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: "user",
          teamSize
        });
        token = res?.data?.token || token;
      } catch (registerError) {
        if (registerError?.response?.status === 409) {
          // User exists: use current session token if available, otherwise try login
          if (!token) {
            const loginRes = await axios.post(`${API_URL}/api/nexion/login`, {
              email: formData.email.trim(),
              password: formData.password
            });
            token = loginRes?.data?.token || "";
          }
        } else {
          throw registerError;
        }
      }
      const companyLabel = formData.companyName.trim() || "company";
      const uploads = documentFields
        .map((doc) => ({
          ...doc,
          file: docs[doc.key],
          labelName: `${companyLabel} - ${doc.label}`
        }))
        .filter((doc) => doc.file);

      if (token && uploads.length > 0) {
        await Promise.all(
          uploads.map((doc) => {
            const payload = new FormData();
            payload.append("file", doc.file);
            payload.append("docType", doc.labelName);
            return axios.post(`${API_URL}/api/meta-documents`, payload, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
          })
        );
      } else if (!token && uploads.length > 0) {
        setErrors((prev) => ({
          ...prev,
          general: "Could not upload documents. Please ensure you are logged in or provide valid user credentials."
        }));
        return;
      }

      const notice = "Your documents will be manually approved in 24 to 48 hours. You will get access once verification is complete.";
      const successKey = `${formData.email.trim().toLowerCase()}|${formData.companyName.trim().toLowerCase()}`;
      const usernameKey = `user:${formData.username.trim().toLowerCase()}`;
      setLoading(false);
      setSuccessMessage(notice);
      try {
        const map = JSON.parse(localStorage.getItem("registerDocsSuccessMap") || "{}");
        map[successKey] = notice;
        if (formData.username.trim()) {
          map[usernameKey] = notice;
        }
        localStorage.setItem("registerDocsSuccessMap", JSON.stringify(map));
      } catch {
        // ignore storage failures
      }
      setFormData((prev) => ({
        ...prev,
        password: ""
      }));
      setTeamSize("");
      setAcceptedTerms(false);
      setDocs({});
      setErrors({});
      // Keep success message visible and stay on the page
    } catch (error) {
      const serverMessage = error.response?.data?.error || error.response?.data?.message;
      setErrors((prev) => ({
        ...prev,
        general: serverMessage || "Registration failed. Please try again."
      }));
    } finally {
      setLoading(false);
    }
  };

  const isSubmitted = !!successMessage;
  return (
    <div className="register-docs">
      <div className="register-docs__header">
        <h1>Register New User</h1>
        <p>Fill in the details and upload required documents. Items 14-16 are optional.</p>
      </div>

      <form className="register-docs__card" onSubmit={handleSubmit} autoComplete="off">
        {errors.general && <div className="register-docs__error">{errors.general}</div>}
        {successMessage && <div className="register-docs__success">{successMessage}</div>}

        <div className="register-docs__grid" autoComplete="off">
          <label>
            Company Name
            <input
              type="text"
              name="companyName"
              autoComplete="organization"
              value={formData.companyName}
              onChange={(e) => {
                const nextValue = e.target.value;
                setFormData((prev) => ({ ...prev, companyName: nextValue }));
                refreshSuccessMessage(formData.email, nextValue);
              }}
            />
            {errors.companyName && <span className="field-error">{errors.companyName}</span>}
          </label>
          <label>
            Username
            <input
              type="text"
              name="new-username"
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </label>
          <label>
            Email
            <input
              type="email"
              name="new-email"
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              value={formData.email}
              onChange={(e) => {
                const nextValue = e.target.value;
                setFormData((prev) => ({ ...prev, email: nextValue }));
                refreshSuccessMessage(nextValue, formData.companyName);
              }}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>
            Password
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute("readOnly")}
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>
          <label>
            Team Size
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
            >
              <option value="">Select team size</option>
              <option value="1-5">1-5</option>
              <option value="6-20">6-20</option>
              <option value="21-50">21-50</option>
              <option value="51-200">51-200</option>
              <option value="200+">200+</option>
            </select>
            {errors.teamSize && <span className="field-error">{errors.teamSize}</span>}
          </label>
        </div>

        <div className="register-docs__section-title">Document Uploads</div>
        <div className="register-docs__note">Max file size: 10 MB per document.</div>
        {errors.idProof && <div className="field-error">{errors.idProof}</div>}
        <div className="register-docs__docs">
          {documentFields.map((doc) => (
            <label key={doc.key} className="register-docs__doc-row">
              <span>
                {(formData.companyName.trim() || "company") + " - " + doc.label}
                {!doc.required && <em>Optional</em>}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  setDocs((prev) => ({ ...prev, [doc.key]: e.target.files?.[0] || null }))
                }
              />
              {errors[doc.key] && <span className="field-error">{errors[doc.key]}</span>}
            </label>
          ))}
        </div>

        <div className="register-docs__actions">
          <label className="register-docs__terms">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>
              I agree to the{" "}
              <a href="#" className="terms-link">
                terms and conditions
              </a>
            </span>
          </label>
          {errors.terms && <span className="field-error">{errors.terms}</span>}
          <button type="button" className="secondary-btn" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={loading || isSubmitted}>
            {loading ? "Creating..." : isSubmitted ? "Submitted" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterDocuments;

