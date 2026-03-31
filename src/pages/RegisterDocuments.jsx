import React, { useContext, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "./authcontext";
import "./RegisterDocuments.css";

const RegisterDocuments = ({ embedded = false, onComplete = null, onCancel = null }) => {
  const navigate = useNavigate();
  const { refreshFromBackend } = useContext(AuthContext);
  const API_URL = import.meta.env.VITE_API_ADMIN_URL;
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
  const existingToken =
    localStorage.getItem(tokenKey) ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    "";
  const isExistingWorkspaceUser = Boolean(existingToken && storedUser?.companyId);

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
      companyName: storedUser?.companyName || storedUser?.company?.name || "Workspace",
      username: storedUser?.username || storedUser?.name || storedUsername,
      email: storedUser?.email || "",
      password: "",
      facebookUserId: "",
      facebookPassword: ""
    };
  });
  const [teamSize, setTeamSize] = useState(storedUser?.teamSize || "");
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
    if (!isExistingWorkspaceUser && !formData.companyName.trim()) next.companyName = "Company name is required";
    if (!isExistingWorkspaceUser) {
      if (!formData.username.trim()) next.username = "Username is required";
      if (!formData.email.trim()) next.email = "Email is required";
      else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = "Email is invalid";
      if (!formData.password) next.password = "Password is required";
      else if (formData.password.length < 6) next.password = "Minimum 6 characters";
      if (!teamSize) next.teamSize = "Select team size";
    }
    if (!acceptedTerms) next.terms = "You must accept the terms";
    if (!formData.facebookUserId.trim()) next.facebookUserId = "Facebook user ID is required";
    documentFields.forEach((doc) => {
      if (doc.required && !docs[doc.key]) next[doc.key] = "Required document";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const resolvedCompanyName = formData.companyName.trim() || storedUser?.companyName || storedUser?.company?.name || "Workspace";
      let token = existingToken;
      let registeredUser = null;
      if (!isExistingWorkspaceUser) {
        try {
          const res = await axios.post(`${API_URL}/api/nexion/register`, {
            companyName: resolvedCompanyName,
            username: formData.username.trim(),
            email: formData.email.trim(),
            password: formData.password,
            facebookUserId: formData.facebookUserId.trim(),
            facebookPassword: formData.facebookPassword,
            role: "user",
            teamSize
          });
          token = res?.data?.token || token;
          registeredUser = res?.data?.user || res?.data?.data?.user || null;
        } catch (registerError) {
          if (registerError?.response?.status === 409) {
            if (!token) {
              const loginRes = await axios.post(`${API_URL}/api/nexion/login`, {
                email: formData.email.trim(),
                password: formData.password
              });
              token = loginRes?.data?.token || "";
              registeredUser = loginRes?.data?.user || loginRes?.data?.data?.user || null;
            }
          } else {
            throw registerError;
          }
        }
      }
      const companyLabel = resolvedCompanyName || "company";
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
            payload.append("facebookUserId", formData.facebookUserId.trim());
            payload.append("facebookPassword", formData.facebookPassword);
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
      try {
        const saved = JSON.parse(localStorage.getItem("nexionFacebookCredentials") || "{}");
        const facebookUserId = String(formData.facebookUserId || "").trim();
        const facebookPassword = String(formData.facebookPassword || "");
        const resolvedUserId = String(
          registeredUser?._id ||
            registeredUser?.id ||
            storedUser?._id ||
            storedUser?.id ||
            ""
        ).trim();
        const resolvedEmail = String(formData.email || storedUser?.email || "")
          .trim()
          .toLowerCase();
        if (facebookUserId || facebookPassword) {
          const entry = {
            facebookUserId,
            facebookPassword,
            updatedAt: new Date().toISOString()
          };
          if (resolvedUserId) saved[`id:${resolvedUserId}`] = entry;
          if (resolvedEmail) saved[`email:${resolvedEmail}`] = entry;
          localStorage.setItem("nexionFacebookCredentials", JSON.stringify(saved));
        }
      } catch {
        // ignore local storage issues
      }

      const notice = "Your documents were submitted successfully. Verification usually completes within 24 to 48 hours.";
      setLoading(false);
      setSuccessMessage(notice);
      setFormData((prev) => ({
        ...prev,
        password: "",
        facebookUserId: "",
        facebookPassword: ""
      }));
      setTeamSize("");
      setAcceptedTerms(false);
      setDocs({});
      setErrors({});
      await refreshFromBackend();
      if (typeof onComplete === "function") {
        onComplete({ status: "submitted", message: notice });
      }
      if (embedded && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "nexion-documents-submitted" }, "*");
      }
      if (!embedded) {
        navigate("/", { replace: true });
      }
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
    <div className={`register-docs ${embedded ? "register-docs--embedded" : ""}`}>
      {!embedded ? (
        <div className="register-docs__header">
          <h1>{isExistingWorkspaceUser ? "Document Upload" : "Register New User"}</h1>
          {!isExistingWorkspaceUser ? (
            <p>Fill in the details and upload required documents. Items 14-16 are optional.</p>
          ) : (
            <p>Upload the required documents below. Our team will review them and activate your workspace after verification.</p>
          )}
        </div>
      ) : null}

      <form className="register-docs__card" onSubmit={handleSubmit} autoComplete="off">
        {errors.general && <div className="register-docs__error">{errors.general}</div>}
        {successMessage && <div className="register-docs__success">{successMessage}</div>}

        {isExistingWorkspaceUser ? (
          <div className="register-docs__summary">
            <div>
              <span>Company</span>
              <strong>{formData.companyName || storedUser?.companyName || storedUser?.company?.name || "Workspace"}</strong>
            </div>
            <div>
              <span>User</span>
              <strong>{formData.username || formData.email || "Current user"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{formData.email || "-"}</strong>
            </div>
          </div>
        ) : (
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
                  setFormData((prev) => ({ ...prev, email: e.target.value }));
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
        )}

        <div className="register-docs__section-title">Facebook Details For Meta Ad</div>
        <div className="register-docs__grid" autoComplete="off">
          <label>
            Facebook User ID
            <input
              type="text"
              name="facebook-user-id"
              autoComplete="off"
              value={formData.facebookUserId}
              onChange={(e) => setFormData((prev) => ({ ...prev, facebookUserId: e.target.value }))}
            />
            {errors.facebookUserId && <span className="field-error">{errors.facebookUserId}</span>}
          </label>
          <label>
            Facebook Password (Optional)
            <input
              type="password"
              name="facebook-password"
              autoComplete="new-password"
              value={formData.facebookPassword}
              onChange={(e) => setFormData((prev) => ({ ...prev, facebookPassword: e.target.value }))}
            />
            {errors.facebookPassword && <span className="field-error">{errors.facebookPassword}</span>}
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
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              if (embedded && typeof onCancel === "function") {
                onCancel();
                return;
              }
              navigate(-1);
            }}
          >
            {embedded ? "Back" : "Cancel"}
          </button>
          <button type="submit" className="primary-btn" disabled={loading || isSubmitted}>
            {loading
              ? "Submitting..."
              : isSubmitted
                ? "Submitted"
                : isExistingWorkspaceUser
                  ? "Submit Documents"
                  : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterDocuments;

