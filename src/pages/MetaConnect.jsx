import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Facebook, RefreshCw, ShieldCheck, UserCircle2 } from "lucide-react";
import metaAdsApi from "../services/metaAdsApi";
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

const extractErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

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
    } catch (loadError) {
      setError(extractErrorMessage(loadError, "Unable to load Meta connection details."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetaState();
  }, []);

  useEffect(() => {
    const handleMessage = async (event) => {
      const payload = event?.data;
      if (!payload || typeof payload !== "object") return;

      if (payload.type === "meta_oauth_success") {
        setConnecting(false);
        setStatusMessage("Meta account connected successfully. Review your ad account and page selection below.");
        await loadMetaState({ silent: true });
      }

      if (payload.type === "meta_oauth_error") {
        setConnecting(false);
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

      </div>
    </div>
  );
};

export default MetaConnect;
