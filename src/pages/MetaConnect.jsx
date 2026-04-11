import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Facebook, RefreshCw, ShieldCheck, UserCircle2 } from "lucide-react";
import metaAdsApi from "../services/metaAdsApi";
import { setMetaApiRuntimeBaseUrl } from "../services/metaAdsApi";
import "./MetaConnect.css";

const emptySetup = {
  connected: false,
  adAccountId: "",
  pageId: "",
  selectedWhatsappNumber: "",
  pages: [],
  adAccounts: [],
  whatsappNumbers: [],
  businesses: [],
  profileName: "",
  mode: "live",
};

const DEFAULT_LEAD_MAPPING = {
  phoneFieldKeys: "phone number, phone, mobile, whatsapp number",
  nameFieldKeys: "full name, name",
  emailFieldKeys: "email, email address",
  consentFieldKeys: "whatsapp consent, receive whatsapp updates, consent",
  consentApprovedValues: "yes, true, checked",
  consentText: "Meta lead form consent for WhatsApp marketing updates.",
  scope: "marketing",
};

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const extractErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const META_LEAD_MAPPING_STORAGE_KEY = "meta_lead_consent_mapping_v1";

const MetaConnect = () => {
  const popupRef = useRef(null);
  const [setup, setSetup] = useState(emptySetup);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState({
    adAccountId: "",
    pageId: "",
    whatsappNumber: "",
  });
  const [leadSyncForm, setLeadSyncForm] = useState({
    leadId: "",
    ...DEFAULT_LEAD_MAPPING,
  });
  const [leadPreviewLoading, setLeadPreviewLoading] = useState(false);
  const [leadSyncLoading, setLeadSyncLoading] = useState(false);
  const [leadPreview, setLeadPreview] = useState(null);
  const [leadSyncMessage, setLeadSyncMessage] = useState("");
  const [mappingSavedMessage, setMappingSavedMessage] = useState("");

  const isConfigured = useMemo(() => Boolean(form.adAccountId && form.pageId), [form]);
  const pageAccessIssue =
    setup.connected &&
    !form.pageId &&
    (String(setup.setupError || "").trim() || (Array.isArray(setup.pages) && setup.pages.length === 0));

  const syncState = (overviewData, diagnosticsData = null) => {
    const nextSetup = overviewData?.setup || emptySetup;
    setSetup(nextSetup);
    setDiagnostics(diagnosticsData?.diagnostics || diagnosticsData || null);
    setForm({
      adAccountId: nextSetup.adAccountId || "",
      pageId: nextSetup.pageId || "",
      whatsappNumber: nextSetup.selectedWhatsappNumber || "",
    });
  };

  const loadMetaState = async ({ silent = false } = {}) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [overview, diagnosticsData] = await Promise.all([
        metaAdsApi.getMetaOverview(),
        metaAdsApi.getMetaDiagnostics().catch(() => null),
      ]);

      syncState(overview, diagnosticsData);
      return overview?.setup || emptySetup;
    } catch (loadError) {
      setError(extractErrorMessage(loadError, "Unable to load Meta connection details."));
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetaState();
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(META_LEAD_MAPPING_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      setLeadSyncForm((prev) => ({
        ...prev,
        phoneFieldKeys: String(parsed.phoneFieldKeys || prev.phoneFieldKeys),
        nameFieldKeys: String(parsed.nameFieldKeys || prev.nameFieldKeys),
        emailFieldKeys: String(parsed.emailFieldKeys || prev.emailFieldKeys),
        consentFieldKeys: String(parsed.consentFieldKeys || prev.consentFieldKeys),
        consentApprovedValues: String(parsed.consentApprovedValues || prev.consentApprovedValues),
        consentText: String(parsed.consentText || prev.consentText),
        scope: String(parsed.scope || prev.scope)
      }));
    } catch {
      // Ignore malformed local mapping cache.
    }
  }, []);

  useEffect(() => {
    const handleMessage = async (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== "object") return;

      if (payload.type === "meta_oauth_success") {
        setConnecting(false);
        if (payload.backendOrigin) {
          setMetaApiRuntimeBaseUrl(payload.backendOrigin);
        }
        const refreshedSetup = await loadMetaState({ silent: true });
        if (refreshedSetup?.connected) {
          setStatusMessage("Meta account connected successfully. Review your ad account and page selection below.");
        } else {
          setStatusMessage("");
          setError(
            "Meta login completed, but this workspace still shows disconnected. Click Refresh. If it remains disconnected, verify you are using the same backend environment for login and dashboard."
          );
        }
      }

      if (payload.type === "meta_oauth_error") {
        setConnecting(false);
        if (payload.backendOrigin) {
          setMetaApiRuntimeBaseUrl(payload.backendOrigin);
        }
        setError(String(payload.error || "Meta connection failed."));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError("");
      setStatusMessage("");
      const result = await metaAdsApi.getMetaAuthUrl(window.location.origin);
      if (!result?.authUrl) {
        throw new Error("Meta auth URL was not returned.");
      }

      popupRef.current = window.open(
        result.authUrl,
        "meta-oauth",
        "width=720,height=760,menubar=no,toolbar=no,status=no"
      );

      if (!popupRef.current) {
        throw new Error("Popup was blocked. Allow popups for this site and try again.");
      }
    } catch (connectError) {
      setConnecting(false);
      setError(extractErrorMessage(connectError, "Unable to start Meta login."));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setStatusMessage("");
      const result = await metaAdsApi.saveMetaSelections(form);
      syncState(result, diagnostics);
      setStatusMessage("Meta setup saved successfully.");
    } catch (saveError) {
      setError(extractErrorMessage(saveError, "Unable to save Meta selections."));
    } finally {
      setSaving(false);
    }
  };

  const buildLeadMappingPayload = () => ({
    phoneFieldKeys: splitCsv(leadSyncForm.phoneFieldKeys),
    nameFieldKeys: splitCsv(leadSyncForm.nameFieldKeys),
    emailFieldKeys: splitCsv(leadSyncForm.emailFieldKeys),
    consentFieldKeys: splitCsv(leadSyncForm.consentFieldKeys),
    consentApprovedValues: splitCsv(leadSyncForm.consentApprovedValues),
    consentText: leadSyncForm.consentText,
    scope: leadSyncForm.scope,
  });

  const saveLeadMappingPreset = () => {
    try {
      window.localStorage.setItem(
        META_LEAD_MAPPING_STORAGE_KEY,
        JSON.stringify({
          phoneFieldKeys: leadSyncForm.phoneFieldKeys,
          nameFieldKeys: leadSyncForm.nameFieldKeys,
          emailFieldKeys: leadSyncForm.emailFieldKeys,
          consentFieldKeys: leadSyncForm.consentFieldKeys,
          consentApprovedValues: leadSyncForm.consentApprovedValues,
          consentText: leadSyncForm.consentText,
          scope: leadSyncForm.scope
        })
      );
      setMappingSavedMessage("Lead mapping preset saved on this browser.");
      window.setTimeout(() => setMappingSavedMessage(""), 2500);
    } catch (saveError) {
      setError(extractErrorMessage(saveError, "Unable to save lead mapping preset."));
    }
  };

  const resetLeadMappingPreset = () => {
    setLeadSyncForm((prev) => ({
      ...prev,
      ...DEFAULT_LEAD_MAPPING
    }));
    window.localStorage.removeItem(META_LEAD_MAPPING_STORAGE_KEY);
    setMappingSavedMessage("Lead mapping preset reset to defaults.");
    window.setTimeout(() => setMappingSavedMessage(""), 2500);
  };

  const handlePreviewLead = async () => {
    if (!leadSyncForm.leadId.trim()) {
      setError("Enter a Meta lead ID to preview consent mapping.");
      return;
    }

    try {
      setLeadPreviewLoading(true);
      setError("");
      setLeadSyncMessage("");
      const result = await metaAdsApi.previewMetaLeadConsent(leadSyncForm.leadId.trim(), buildLeadMappingPayload());
      setLeadPreview(result?.data || null);
    } catch (previewError) {
      setError(extractErrorMessage(previewError, "Unable to preview Meta lead consent."));
    } finally {
      setLeadPreviewLoading(false);
    }
  };

  const handleSyncLeadConsent = async () => {
    if (!leadSyncForm.leadId.trim()) {
      setError("Enter a Meta lead ID before syncing consent.");
      return;
    }

    try {
      setLeadSyncLoading(true);
      setError("");
      setLeadSyncMessage("");
      const result = await metaAdsApi.syncMetaLeadConsent({
        leadId: leadSyncForm.leadId.trim(),
        mapping: buildLeadMappingPayload(),
      });
      setLeadPreview((prev) => ({
        ...(prev || {}),
        lead: result?.data?.lead || prev?.lead || null,
        resolved: result?.data?.resolved || prev?.resolved || null
      }));
      setLeadSyncMessage(
        `Lead consent synced successfully for ${result?.data?.contact?.phone || "contact"}`
      );
    } catch (syncError) {
      setError(extractErrorMessage(syncError, "Unable to sync Meta lead consent."));
    } finally {
      setLeadSyncLoading(false);
    }
  };

  return (
    <div className="meta-connect-page">
      <div className="meta-connect-shell">
        <section className="meta-connect-hero">
          <div className="meta-connect-copy">
            <span className="meta-connect-kicker">Meta Ads Access</span>
            <h1>Connect your Meta account</h1>
            <p>
              For live SaaS usage, every user should connect their own Facebook account, ad account,
              and page before publishing campaigns.
            </p>
          </div>
          <div className="meta-connect-actions">
            <button className="meta-btn meta-btn-secondary" onClick={() => loadMetaState({ silent: true })} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
            <button className="meta-btn meta-btn-primary" onClick={handleConnect} disabled={connecting}>
              <Facebook size={16} />
              {connecting ? "Opening Meta Login..." : setup.connected ? "Reconnect Meta" : "Connect Meta"}
            </button>
          </div>
        </section>

        {(error || statusMessage) && (
          <div className={`meta-banner ${error ? "meta-banner-error" : "meta-banner-success"}`}>
            {error || statusMessage}
          </div>
        )}

        {pageAccessIssue && (
          <div className="meta-banner meta-banner-warning">
            Facebook page access is missing for this Meta connection. Click <strong>Reconnect Meta</strong>, approve page permissions,
            then select a page and save the setup before publishing campaigns.
          </div>
        )}

        <div className="meta-connect-grid">
          <section className="meta-card">
            <div className="meta-card-header">
              <h2>Connection status</h2>
              <span className={`meta-pill ${setup.connected ? "meta-pill-success" : "meta-pill-muted"}`}>
                {setup.connected ? "Connected" : "Not connected"}
              </span>
            </div>

            <div className="meta-status-list">
              <div className="meta-status-item">
                <UserCircle2 size={18} />
                <div>
                  <strong>Connected profile</strong>
                  <span>{setup.profileName || diagnostics?.profileName || "Not connected yet"}</span>
                </div>
              </div>
              <div className="meta-status-item">
                <ShieldCheck size={18} />
                <div>
                  <strong>Token source</strong>
                  <span>{diagnostics?.authSource || setup.mode || "Unknown"}</span>
                </div>
              </div>
              <div className="meta-status-item">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Selected ad account</strong>
                  <span>{form.adAccountId || "No ad account selected"}</span>
                </div>
              </div>
              <div className="meta-status-item">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Selected page</strong>
                  <span>{form.pageId || "No page selected"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="meta-card">
            <div className="meta-card-header">
              <h2>Meta setup</h2>
              <a className="meta-inline-link" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer">
                Open Ads Manager
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="meta-form-grid">
              <label className="meta-field">
                <span>Ad account</span>
                <select value={form.adAccountId} onChange={(e) => setForm((prev) => ({ ...prev, adAccountId: e.target.value }))}>
                  <option value="">Select ad account</option>
                  {(setup.adAccounts || []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name || account.id} ({account.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="meta-field">
                <span>Facebook page</span>
                <select value={form.pageId} onChange={(e) => setForm((prev) => ({ ...prev, pageId: e.target.value }))}>
                  <option value="">Select page</option>
                  {(setup.pages || []).map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name || page.id} ({page.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="meta-field meta-field-full">
                <span>WhatsApp number (optional)</span>
                <select value={form.whatsappNumber} onChange={(e) => setForm((prev) => ({ ...prev, whatsappNumber: e.target.value }))}>
                  <option value="">No WhatsApp number selected</option>
                  {(setup.whatsappNumbers || []).map((item) => {
                    const value = item.display_phone_number || item.id || "";
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="meta-selection-actions">
              <button className="meta-btn meta-btn-primary" onClick={handleSave} disabled={!isConfigured || saving}>
                {saving ? "Saving..." : "Save Meta Setup"}
              </button>
            </div>
          </section>
        </div>

        <section className="meta-card">
          <div className="meta-card-header">
            <h2>Meta Lead Consent Sync</h2>
            <span className="meta-pill meta-pill-muted">Preview before sync</span>
          </div>

          {leadSyncMessage ? <div className="meta-banner meta-banner-success">{leadSyncMessage}</div> : null}
          {mappingSavedMessage ? <div className="meta-banner meta-banner-success">{mappingSavedMessage}</div> : null}

          <div className="meta-banner meta-banner-warning">
            Use this only for Meta Lead Ads. For website or QR consent collection, use the public opt-in flow.
          </div>

          <div className="meta-form-grid">
            <label className="meta-field meta-field-full">
              <span>Lead ID</span>
              <input
                type="text"
                value={leadSyncForm.leadId}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, leadId: e.target.value }))}
                placeholder="Meta leadgen_id"
              />
            </label>

            <label className="meta-field">
              <span>Phone field keys</span>
              <input
                type="text"
                value={leadSyncForm.phoneFieldKeys}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, phoneFieldKeys: e.target.value }))}
                placeholder="phone number, phone"
              />
            </label>

            <label className="meta-field">
              <span>Name field keys</span>
              <input
                type="text"
                value={leadSyncForm.nameFieldKeys}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, nameFieldKeys: e.target.value }))}
                placeholder="full name, name"
              />
            </label>

            <label className="meta-field">
              <span>Email field keys</span>
              <input
                type="text"
                value={leadSyncForm.emailFieldKeys}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, emailFieldKeys: e.target.value }))}
                placeholder="email, email address"
              />
            </label>

            <label className="meta-field">
              <span>Consent field keys</span>
              <input
                type="text"
                value={leadSyncForm.consentFieldKeys}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, consentFieldKeys: e.target.value }))}
                placeholder="whatsapp consent, receive whatsapp updates"
              />
            </label>

            <label className="meta-field">
              <span>Allowed consent answers</span>
              <input
                type="text"
                value={leadSyncForm.consentApprovedValues}
                onChange={(e) =>
                  setLeadSyncForm((prev) => ({ ...prev, consentApprovedValues: e.target.value }))
                }
                placeholder="yes, true, checked"
              />
            </label>

            <label className="meta-field">
              <span>Consent scope</span>
              <select
                value={leadSyncForm.scope}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, scope: e.target.value }))}
              >
                <option value="marketing">Marketing</option>
                <option value="service">Service</option>
                <option value="both">Both</option>
              </select>
            </label>

            <label className="meta-field meta-field-full">
              <span>Consent text snapshot</span>
              <textarea
                rows="3"
                value={leadSyncForm.consentText}
                onChange={(e) => setLeadSyncForm((prev) => ({ ...prev, consentText: e.target.value }))}
                placeholder="Consent text saved against the lead"
              />
            </label>
          </div>

          <div className="meta-selection-actions meta-selection-actions-start">
            <button className="meta-btn meta-btn-secondary" type="button" onClick={saveLeadMappingPreset}>
              Save Mapping Preset
            </button>
            <button className="meta-btn meta-btn-secondary" type="button" onClick={resetLeadMappingPreset}>
              Reset Defaults
            </button>
            <button className="meta-btn meta-btn-secondary" onClick={handlePreviewLead} disabled={leadPreviewLoading}>
              {leadPreviewLoading ? "Previewing..." : "Preview Lead"}
            </button>
            <button className="meta-btn meta-btn-primary" onClick={handleSyncLeadConsent} disabled={leadSyncLoading}>
              {leadSyncLoading ? "Syncing..." : "Sync Lead Consent"}
            </button>
            <a className="meta-btn meta-btn-secondary" href="/whatsapp-opt-in-demo" target="_blank" rel="noreferrer">
              Open Public Opt-In Demo
            </a>
          </div>

          {leadPreview ? (
            <div className="meta-lead-preview">
              <div className="meta-status-list">
                <div className="meta-status-item">
                  <div>
                    <strong>Resolved phone</strong>
                    <span>{leadPreview?.resolved?.phone || "Not found"}</span>
                  </div>
                </div>
                <div className="meta-status-item">
                  <div>
                    <strong>Resolved name</strong>
                    <span>{leadPreview?.resolved?.name || "Not found"}</span>
                  </div>
                </div>
                <div className="meta-status-item">
                  <div>
                    <strong>Consent answer</strong>
                    <span>
                      {leadPreview?.resolved?.consentRawValue || "Not found"}{" "}
                      {leadPreview?.resolved?.consentApproved ? "(approved)" : "(not approved)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="meta-lead-field-list">
                <strong>Lead fields returned by Meta</strong>
                <ul>
                  {(leadPreview?.resolved?.availableFields || []).map((field) => (
                    <li key={field.fieldName}>
                      <span>{field.fieldName}</span>
                      <code>{(field.values || []).join(", ") || "-"}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </section>

      </div>
    </div>
  );
};

export default MetaConnect;
