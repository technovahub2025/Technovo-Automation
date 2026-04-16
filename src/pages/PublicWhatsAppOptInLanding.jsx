import React, { useMemo, useState } from "react";
import { normalizeApiBaseUrl, resolveApiBaseUrl } from "../services/apiBaseUrl";
import "./PublicWhatsAppOptInLanding.css";

const DEFAULT_CONSENT_TEXT =
  "I agree to receive WhatsApp updates from Technovohub. I can reply STOP anytime to opt out.";

const buildInitialState = () => {
  if (typeof window === "undefined") {
    return {
      backendUrl: "",
      publicKey: "",
      userId: "",
      companyId: "",
      companyName: "Technovohub",
      source: "landing_page",
      scope: "marketing",
      consentText: DEFAULT_CONSENT_TEXT
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    backendUrl: params.get("backendUrl") || "",
    publicKey: params.get("publicKey") || "",
    userId: params.get("userId") || "",
    companyId: params.get("companyId") || "",
    companyName: params.get("companyName") || "Technovohub",
    source: params.get("source") || "landing_page",
    scope: params.get("scope") || "marketing",
    consentText: params.get("consentText") || DEFAULT_CONSENT_TEXT
  };
};

function PublicWhatsAppOptInLanding() {
  const [form, setForm] = useState(() => ({
    ...buildInitialState(),
    name: "",
    phone: "",
    email: ""
  }));
  const [consentChecked, setConsentChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const successRedirectUrl = useMemo(() => {
    if (typeof window === "undefined") return "/whatsapp-opt-in/success";
    const params = new URLSearchParams(window.location.search);
    return params.get("successRedirect") || "/whatsapp-opt-in/success";
  }, []);

  const endpointUrl = useMemo(() => {
    const resolvedBaseUrl = normalizeApiBaseUrl(form.backendUrl) || resolveApiBaseUrl();
    return `${resolvedBaseUrl}/api/public/whatsapp-opt-in`;
  }, [form.backendUrl]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    if (form.backendUrl) url.searchParams.set("backendUrl", form.backendUrl);
    if (form.publicKey) url.searchParams.set("publicKey", form.publicKey);
    if (form.userId) url.searchParams.set("userId", form.userId);
    if (form.companyId) url.searchParams.set("companyId", form.companyId);
    if (form.companyName) url.searchParams.set("companyName", form.companyName);
    if (form.scope) url.searchParams.set("scope", form.scope);
    if (form.consentText) url.searchParams.set("consentText", form.consentText);
    url.searchParams.set("source", "qr_page");
    return url.toString();
  }, [
    form.backendUrl,
    form.publicKey,
    form.userId,
    form.companyId,
    form.companyName,
    form.scope,
    form.consentText
  ]);

  const qrImageUrl = useMemo(() => {
    if (!shareUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
      shareUrl
    )}`;
  }, [shareUrl]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopyLink = async () => {
    if (!shareUrl || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      console.error("Failed to copy opt-in link", copyError);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-opt-in-public-key": form.publicKey
        },
        body: JSON.stringify({
          userId: form.userId,
          companyId: form.companyId || undefined,
          name: form.name,
          phone: form.phone,
          email: form.email,
          consentChecked,
          consentText: form.consentText,
          source: form.source,
          scope: form.scope,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          metadata: {
            landingPage: true,
            companyName: form.companyName
          }
        })
      });

      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || "Failed to save WhatsApp opt-in.");
      }

      setMessage(
        `Thanks! Your WhatsApp consent is confirmed for ${payload?.data?.phone || form.phone}.`
      );
      setRedirecting(true);
      window.setTimeout(() => {
        window.location.assign(successRedirectUrl);
      }, 1200);
      setConsentChecked(false);
      setForm((prev) => ({
        ...prev,
        name: "",
        phone: "",
        email: ""
      }));
    } catch (submitError) {
      setError(submitError.message || "Failed to save WhatsApp opt-in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="public-optin-landing">
      <div className="public-optin-landing-card">
        <header className="public-optin-landing-hero">
          <span className="public-optin-landing-eyebrow">WhatsApp Opt-In</span>
          <h1>
            Stay connected with {form.companyName || "Technovohub"}
          </h1>
          <p>
            Share your details and consent to receive WhatsApp updates. You can opt out anytime by
            replying STOP.
          </p>
        </header>

        <form className="public-optin-landing-form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder="Your name"
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
            <span>Email (optional)</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <div className="public-optin-landing-consent">
            <label>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
                required
              />
              <span>{form.consentText}</span>
            </label>
            <p className="public-optin-landing-hint">
              We use your phone number only for WhatsApp updates you opted into.
            </p>
          </div>

          {message ? <div className="public-optin-landing-success">{message}</div> : null}
          {error ? <div className="public-optin-landing-error">{error}</div> : null}
          {redirecting ? (
            <div className="public-optin-landing-success">
              Redirecting to confirmation page...
            </div>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Saving consent..." : "Confirm WhatsApp Opt-In"}
          </button>
          <small>Powered by Technovohub</small>
        </form>

        <section className="public-optin-landing-share">
          <div>
            <h2>Share this opt-in link</h2>
            <p>
              Use this link or QR code on your website, QR poster, or ads to capture WhatsApp
              consent safely.
            </p>
            <div className="public-optin-landing-share-row">
              <input type="text" value={shareUrl} readOnly />
              <button type="button" onClick={handleCopyLink} disabled={!shareUrl}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
          <div className="public-optin-landing-qr">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt="WhatsApp opt-in QR" />
            ) : (
              <div className="public-optin-landing-qr-placeholder">
                Add public key + user id to generate QR
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default PublicWhatsAppOptInLanding;
