import React, { useMemo, useState } from "react";
import { normalizeApiBaseUrl, resolveApiBaseUrl } from "../services/apiBaseUrl";
import {
  canUseLocalDevOptInFallback,
  DEFAULT_PUBLIC_OPTIN_KEY,
  resolvePreferredPublicKey,
  shouldIncludePublicKeyInUrl
} from "../utils/publicOptIn";
import "./PublicWhatsAppOptInDemo.css";

const INITIAL_FORM = {
  backendUrl: "",
  publicKey: DEFAULT_PUBLIC_OPTIN_KEY,
  userId: "",
  companyId: "",
  name: "",
  phone: "",
  email: "",
  source: "website_form",
  scope: "marketing",
  pageUrl: typeof window !== "undefined" ? window.location.href : "",
  proofId: "",
  consentText: "I agree to receive WhatsApp updates from Technovohub. I can reply STOP anytime to opt out."
};

const isValidMongoObjectId = (value = "") =>
  /^[a-f\d]{24}$/i.test(String(value || "").trim());

function PublicWhatsAppOptInDemo() {
  const getInitialFormState = () => {
    if (typeof window === "undefined") return INITIAL_FORM;
    const params = new URLSearchParams(window.location.search);
    return {
      ...INITIAL_FORM,
      backendUrl: params.get("backendUrl") || INITIAL_FORM.backendUrl,
      publicKey: resolvePreferredPublicKey(
        params.get("publicKey"),
        DEFAULT_PUBLIC_OPTIN_KEY
      ),
      userId: params.get("userId") || INITIAL_FORM.userId,
      companyId: params.get("companyId") || INITIAL_FORM.companyId,
      name: params.get("name") || INITIAL_FORM.name,
      phone: params.get("phone") || INITIAL_FORM.phone,
      email: params.get("email") || INITIAL_FORM.email,
      source: params.get("source") || INITIAL_FORM.source,
      scope: params.get("scope") || INITIAL_FORM.scope,
      pageUrl: params.get("pageUrl") || INITIAL_FORM.pageUrl,
      proofId: params.get("proofId") || INITIAL_FORM.proofId,
      consentText: params.get("consentText") || INITIAL_FORM.consentText
    };
  };

  const [form, setForm] = useState(getInitialFormState);
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const endpointUrl = useMemo(
    () => {
      const resolvedBaseUrl = normalizeApiBaseUrl(form.backendUrl) || resolveApiBaseUrl();
      return `${resolvedBaseUrl}/api/public/whatsapp-opt-in`;
    },
    [form.backendUrl]
  );
  const allowLocalDevFallback = useMemo(
    () =>
      canUseLocalDevOptInFallback({
        pageUrl: typeof window !== "undefined" ? window.location.href : "",
        endpointUrl,
        backendUrl: form.backendUrl
      }),
    [endpointUrl, form.backendUrl]
  );

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    const normalizedPublicKey = resolvePreferredPublicKey(form.publicKey);
    const sendPublicKey = shouldIncludePublicKeyInUrl(normalizedPublicKey);

    if (!sendPublicKey && !allowLocalDevFallback) {
      setError("Public opt-in key is missing or placeholder. Add the real WHATSAPP_OPTIN_PUBLIC_KEY.");
      setSubmitting(false);
      return;
    }

    if (!String(form.userId || "").trim()) {
      setError("User ID is required to save opt-in to the correct workspace.");
      setSubmitting(false);
      return;
    }

    if (!isValidMongoObjectId(form.userId)) {
      setError("User ID must be a valid 24-character Mongo ObjectId.");
      setSubmitting(false);
      return;
    }

    if (String(form.companyId || "").trim() && !isValidMongoObjectId(form.companyId)) {
      setError("Company ID must be a valid 24-character Mongo ObjectId or be left blank.");
      setSubmitting(false);
      return;
    }

    try {
      const headers = {
        "Content-Type": "application/json"
      };

      if (sendPublicKey) {
        headers["x-opt-in-public-key"] = normalizedPublicKey;
      }

      const response = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          publicKey: sendPublicKey ? normalizedPublicKey : undefined,
          userId: form.userId,
          companyId: form.companyId || undefined,
          name: form.name,
          phone: form.phone,
          email: form.email,
          consentChecked,
          consentText: form.consentText,
          source: form.source,
          scope: form.scope,
          pageUrl: form.pageUrl,
          proofId: form.proofId || undefined,
          metadata: {
            demoPage: true
          }
        })
      });

      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        if (response.status === 401) {
          throw new Error(
            allowLocalDevFallback
              ? "Invalid public opt-in key. Localhost fallback was not accepted. Restart the backend after env changes and verify WHATSAPP_OPTIN_PUBLIC_KEY."
              : "Invalid public opt-in key. Verify WHATSAPP_OPTIN_PUBLIC_KEY in backend and this page."
          );
        }
        throw new Error(payload?.error || "Failed to save WhatsApp opt-in.");
      }

      setMessage(
        `Opt-in saved successfully for ${payload?.data?.phone || form.phone}. Contact ID: ${
          payload?.data?.contactId || "created"
        }`
      );
      setConsentChecked(false);
      setForm((prev) => ({
        ...prev,
        name: "",
        phone: "",
        email: "",
        proofId: ""
      }));
    } catch (submitError) {
      setError(submitError.message || "Failed to save WhatsApp opt-in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="public-optin-page">
      <div className="public-optin-card">
        <div className="public-optin-header">
          <span className="public-optin-eyebrow">Public Opt-In Demo</span>
          <h1>WhatsApp Consent Capture Example</h1>
          <p>
            This sample page shows how a landing page or QR page can collect consent and store it in
            your backend before marketing templates are sent.
          </p>
        </div>

        <form className="public-optin-form" onSubmit={handleSubmit}>
          <div className="public-optin-grid">
            <label>
              <span>Backend URL</span>
              <input
                type="url"
                value={form.backendUrl}
                onChange={(event) => handleChange("backendUrl", event.target.value)}
                placeholder="Leave empty to use current app API base"
              />
            </label>
            <label>
              <span>Public Key</span>
              <input
                type="text"
                value={form.publicKey}
                onChange={(event) => handleChange("publicKey", event.target.value)}
                placeholder="WHATSAPP_OPTIN_PUBLIC_KEY"
                required={!allowLocalDevFallback}
              />
            </label>
            <label>
              <span>User ID</span>
              <input
                type="text"
                value={form.userId}
                onChange={(event) => handleChange("userId", event.target.value)}
                placeholder="Owner user ID"
                required
              />
            </label>
            <label>
              <span>Company ID</span>
              <input
                type="text"
                value={form.companyId}
                onChange={(event) => handleChange("companyId", event.target.value)}
                placeholder="Optional company ID"
              />
            </label>
            <label>
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="Customer name"
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => handleChange("phone", event.target.value)}
                placeholder="919876543210"
                required
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label>
              <span>Source</span>
              <select value={form.source} onChange={(event) => handleChange("source", event.target.value)}>
                <option value="website_form">Website form</option>
                <option value="landing_page">Landing page</option>
                <option value="qr_page">QR page</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label>
              <span>Scope</span>
              <select value={form.scope} onChange={(event) => handleChange("scope", event.target.value)}>
                <option value="marketing">Marketing</option>
                <option value="service">Service</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label>
              <span>Page URL</span>
              <input
                type="url"
                value={form.pageUrl}
                onChange={(event) => handleChange("pageUrl", event.target.value)}
                placeholder="https://technovahub.in/demo"
              />
            </label>
            <label>
              <span>Proof ID</span>
              <input
                type="text"
                value={form.proofId}
                onChange={(event) => handleChange("proofId", event.target.value)}
                placeholder="campaign-landing-001"
              />
            </label>
          </div>

          <label className="public-optin-consent-text">
            <span>Consent text snapshot</span>
            <textarea
              value={form.consentText}
              onChange={(event) => handleChange("consentText", event.target.value)}
              rows={4}
              required
            />
          </label>

          <label className="public-optin-checkbox">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              required
            />
            <span>{form.consentText}</span>
          </label>

          {message ? <div className="public-optin-success">{message}</div> : null}
          {error ? <div className="public-optin-error">{error}</div> : null}

          <div className="public-optin-actions">
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving consent..." : "Save WhatsApp Opt-In"}
            </button>
            <code>{endpointUrl}</code>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PublicWhatsAppOptInDemo;
