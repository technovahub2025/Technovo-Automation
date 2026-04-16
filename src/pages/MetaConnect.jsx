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
const OPTIN_LINK_STORAGE_KEY = "meta_optin_link_builder_v1";

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
  const [batchLeadIdsText, setBatchLeadIdsText] = useState("");
  const [batchSyncLoading, setBatchSyncLoading] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState(null);
  const [batchTemplateForm, setBatchTemplateForm] = useState({
    enabled: false,
    templateName: "",
    language: "en_US",
    templateCategory: "marketing",
    variablesCsv: "",
    dryRun: true
  });
  const [mappingSavedMessage, setMappingSavedMessage] = useState("");
  const [optInBuilder, setOptInBuilder] = useState(() => {
    if (typeof window === "undefined") {
      return {
        baseUrl: "",
        publicKey: "",
        userId: "",
        companyId: "",
        companyName: "Technovohub",
        source: "landing_page",
        scope: "marketing"
      };
    }

    const stored = window.localStorage.getItem(OPTIN_LINK_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          return {
            baseUrl: parsed.baseUrl || `${window.location.origin}/whatsapp-opt-in`,
            publicKey: parsed.publicKey || "",
            userId: parsed.userId || "",
            companyId: parsed.companyId || "",
            companyName: parsed.companyName || "Technovohub",
            source: parsed.source || "landing_page",
            scope: parsed.scope || "marketing"
          };
        }
      } catch {
        // ignore local cache errors
      }
    }

    let storedUser = null;
    try {
      storedUser = JSON.parse(window.localStorage.getItem("user") || "null");
    } catch {
      storedUser = null;
    }
    const userId =
      storedUser?.id ||
      storedUser?._id ||
      window.localStorage.getItem("userId") ||
      "";

    return {
      baseUrl: `${window.location.origin}/whatsapp-opt-in`,
      publicKey: "",
      userId: userId ? String(userId) : "",
      companyId: storedUser?.companyId ? String(storedUser.companyId) : "",
      companyName: storedUser?.companyName || "Technovohub",
      source: "landing_page",
      scope: "marketing"
    };
  });
  const [optInLinkMessage, setOptInLinkMessage] = useState("");

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
      window.localStorage.setItem(OPTIN_LINK_STORAGE_KEY, JSON.stringify(optInBuilder));
    } catch {
      // ignore localStorage write errors
    }
  }, [optInBuilder]);

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

  useEffect(() => {
    if (!connecting) return undefined;

    const intervalId = window.setInterval(() => {
      const popup = popupRef.current;
      if (!popup) return;
      if (popup.closed) {
        popupRef.current = null;
        setConnecting(false);
      }
    }, 600);

    return () => window.clearInterval(intervalId);
  }, [connecting]);

  const handleConnect = async () => {
    const popupFeatures = "width=720,height=760,menubar=no,toolbar=no,status=no";
    const popupShell = window.open("", "meta-oauth", popupFeatures);

    try {
      setConnecting(true);
      setError("");
      setStatusMessage("");
      popupRef.current = popupShell || null;

      if (popupShell) {
        popupShell.document.title = "Opening Meta Login...";
        popupShell.document.body.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";
        popupShell.document.body.style.margin = "0";
        popupShell.document.body.style.padding = "24px";
        popupShell.document.body.innerHTML =
          "<p style='margin:0;color:#334155'>Redirecting to Meta login...</p>";
      }

      const result = await metaAdsApi.getMetaAuthUrl(window.location.origin);
      if (!result?.authUrl) {
        throw new Error("Meta auth URL was not returned.");
      }

      if (!popupShell || popupShell.closed) {
        // Fallback for strict browsers/extensions blocking popup windows.
        setStatusMessage("Popup was blocked. Redirecting in the same tab...");
        window.location.assign(result.authUrl);
        return;
      }

      popupShell.location.href = result.authUrl;
    } catch (connectError) {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
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

  const parseBatchLeadIds = () =>
    Array.from(
      new Set(
        String(batchLeadIdsText || "")
          .split(/[\n,\s]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

  const handleBatchSyncConsent = async () => {
    const leadIds = parseBatchLeadIds();
    if (!leadIds.length) {
      setError("Enter at least one lead ID for batch sync.");
      return;
    }

    try {
      setBatchSyncLoading(true);
      setError("");
      setLeadSyncMessage("");
      setBatchSyncResult(null);

      const payload = {
        leadIds,
        mapping: buildLeadMappingPayload()
      };

      if (batchTemplateForm.enabled && batchTemplateForm.templateName.trim()) {
        payload.sendTemplate = {
          templateName: batchTemplateForm.templateName.trim(),
          language: String(batchTemplateForm.language || "en_US").trim() || "en_US",
          templateCategory: String(batchTemplateForm.templateCategory || "marketing").trim() || "marketing",
          variables: splitCsv(batchTemplateForm.variablesCsv)
        };
      }

      payload.dryRun = Boolean(batchTemplateForm.dryRun);

      const result = await metaAdsApi.syncMetaLeadConsentBatch(payload);
      setBatchSyncResult(result?.data || null);
      setLeadSyncMessage("Batch sync completed. Review the result summary below.");
    } catch (syncError) {
      setError(extractErrorMessage(syncError, "Unable to run batch lead sync."));
    } finally {
      setBatchSyncLoading(false);
    }
  };

  const optInLink = useMemo(() => {
    const baseUrl = String(optInBuilder.baseUrl || "").trim();
    if (!baseUrl) return "";
    let url = baseUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const params = new URLSearchParams();
    if (optInBuilder.publicKey) params.set("publicKey", optInBuilder.publicKey);
    if (optInBuilder.userId) params.set("userId", optInBuilder.userId);
    if (optInBuilder.companyId) params.set("companyId", optInBuilder.companyId);
    if (optInBuilder.companyName) params.set("companyName", optInBuilder.companyName);
    if (optInBuilder.source) params.set("source", optInBuilder.source);
    if (optInBuilder.scope) params.set("scope", optInBuilder.scope);
    const query = params.toString();
    return query ? `${url}?${query}` : url;
  }, [optInBuilder]);

  const handleCopyOptInLink = async () => {
    if (!optInLink) {
      setOptInLinkMessage("Enter a valid landing page URL first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(optInLink);
      setOptInLinkMessage("Opt-in link copied.");
      window.setTimeout(() => setOptInLinkMessage(""), 2000);
    } catch {
      setOptInLinkMessage("Unable to copy. Select and copy the link manually.");
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

          <div className="meta-batch-sync-panel">
            <h3>Batch Lead Sync + Optional Template Send</h3>
            <p>
              Paste multiple lead IDs (comma, space, or new line). Sync will always run first.
              Template send runs only if enabled and template name is given.
            </p>

            <label className="meta-field meta-field-full">
              <span>Lead IDs</span>
              <textarea
                rows="4"
                value={batchLeadIdsText}
                onChange={(e) => setBatchLeadIdsText(e.target.value)}
                placeholder="lead_id_1, lead_id_2"
              />
            </label>

            <div className="meta-form-grid">
              <label className="meta-field">
                <span>Enable template send</span>
                <select
                  value={batchTemplateForm.enabled ? "yes" : "no"}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, enabled: e.target.value === "yes" }))
                  }
                >
                  <option value="no">No (sync only)</option>
                  <option value="yes">Yes (sync and send)</option>
                </select>
              </label>

              <label className="meta-field">
                <span>Dry run</span>
                <select
                  value={batchTemplateForm.dryRun ? "yes" : "no"}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, dryRun: e.target.value === "yes" }))
                  }
                >
                  <option value="yes">Yes (no send)</option>
                  <option value="no">No (send for eligible)</option>
                </select>
              </label>

              <label className="meta-field">
                <span>Template name</span>
                <input
                  type="text"
                  value={batchTemplateForm.templateName}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, templateName: e.target.value }))
                  }
                  placeholder="approved_template_name"
                />
              </label>

              <label className="meta-field">
                <span>Language</span>
                <input
                  type="text"
                  value={batchTemplateForm.language}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, language: e.target.value }))
                  }
                  placeholder="en_US"
                />
              </label>

              <label className="meta-field">
                <span>Template category</span>
                <select
                  value={batchTemplateForm.templateCategory}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, templateCategory: e.target.value }))
                  }
                >
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                  <option value="authentication">Authentication</option>
                </select>
              </label>

              <label className="meta-field">
                <span>Variables (CSV)</span>
                <input
                  type="text"
                  value={batchTemplateForm.variablesCsv}
                  onChange={(e) =>
                    setBatchTemplateForm((prev) => ({ ...prev, variablesCsv: e.target.value }))
                  }
                  placeholder="John, Chennai"
                />
              </label>
            </div>

            <div className="meta-selection-actions meta-selection-actions-start">
              <button
                className="meta-btn meta-btn-primary"
                type="button"
                onClick={handleBatchSyncConsent}
                disabled={batchSyncLoading}
              >
                {batchSyncLoading ? "Running batch sync..." : "Run Batch Sync"}
              </button>
            </div>

            {batchSyncResult ? (
              <div className="meta-batch-summary">
                <strong>Batch Summary</strong>
                <code>
                  {`leadIds=${batchSyncResult?.summary?.totalLeadIds || 0}, synced=${batchSyncResult?.summary?.syncedSuccess || 0}, syncFailed=${batchSyncResult?.summary?.syncedFailed || 0}, sendSuccess=${batchSyncResult?.summary?.templateSendSuccess || 0}, sendFailed=${batchSyncResult?.summary?.templateSendFailed || 0}`}
                </code>
              </div>
            ) : null}
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

        <section className="meta-card">
          <div className="meta-card-header">
            <h2>Public Opt-In Link Builder</h2>
            <span className="meta-pill meta-pill-muted">Landing page</span>
          </div>

          <div className="meta-banner meta-banner-warning">
            Share this link to capture WhatsApp consent with proof. This does not affect live users unless they open the link.
          </div>

          <div className="meta-form-grid meta-form-grid-optin">
            <label className="meta-field">
              <span>Landing URL</span>
              <input
                type="text"
                value={optInBuilder.baseUrl}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://yourdomain/whatsapp-opt-in"
              />
            </label>
            <label className="meta-field">
              <span>Public Key</span>
              <input
                type="text"
                value={optInBuilder.publicKey}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, publicKey: e.target.value }))}
                placeholder="WHATSAPP_OPTIN_PUBLIC_KEY"
              />
            </label>
            <label className="meta-field">
              <span>User ID</span>
              <input
                type="text"
                value={optInBuilder.userId}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, userId: e.target.value }))}
                placeholder="Owner user id"
              />
            </label>
            <label className="meta-field">
              <span>Company ID</span>
              <input
                type="text"
                value={optInBuilder.companyId}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, companyId: e.target.value }))}
                placeholder="Optional company id"
              />
            </label>
            <label className="meta-field">
              <span>Company Name</span>
              <input
                type="text"
                value={optInBuilder.companyName}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="Brand name"
              />
            </label>
            <label className="meta-field">
              <span>Source</span>
              <select
                value={optInBuilder.source}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, source: e.target.value }))}
              >
                <option value="landing_page">Landing page</option>
                <option value="website_form">Website form</option>
                <option value="qr_page">QR page</option>
              </select>
            </label>
            <label className="meta-field">
              <span>Scope</span>
              <select
                value={optInBuilder.scope}
                onChange={(e) => setOptInBuilder((prev) => ({ ...prev, scope: e.target.value }))}
              >
                <option value="marketing">Marketing</option>
                <option value="service">Service</option>
                <option value="both">Both</option>
              </select>
            </label>
          </div>

          <div className="meta-optin-link-row">
            <input type="text" readOnly value={optInLink || ""} />
            <div className="meta-optin-link-actions">
              <button className="meta-btn meta-btn-secondary" type="button" onClick={handleCopyOptInLink}>
                Copy Link
              </button>
              <a
                className="meta-btn meta-btn-primary"
                href={optInLink || "#"}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
          </div>

          {optInLinkMessage ? <div className="meta-banner meta-banner-success">{optInLinkMessage}</div> : null}
        </section>

      </div>
    </div>
  );
};

export default MetaConnect;
