import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Facebook,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import metaAdsService from "../services/metaAdsService";
import "./MetaAdsManager.css";

const sections = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "campaigns", label: "Campaigns", icon: FolderKanban },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const wizardSteps = [
  { key: 1, label: "Campaign" },
  { key: 2, label: "Ad Set" },
  { key: 3, label: "Ad Creative" },
  { key: 4, label: "Review" },
];

const objectiveOptions = [
  { value: "OUTCOME_TRAFFIC", label: "Traffic" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_ENGAGEMENT", label: "Messages" },
];

const ctaOptions = [
  { value: "WHATSAPP_MESSAGE", label: "WhatsApp Message" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "APPLY_NOW", label: "Apply Now" },
];

const defaultForm = {
  campaignName: "",
  objective: "OUTCOME_LEADS",
  adAccountId: "",
  configuredPageId: "",
  whatsappNumber: "",
  budget: { dailyBudget: 500, currency: "INR" },
  targeting: { countries: ["IN"], ageMin: 21, ageMax: 45 },
  creative: {
    primaryText: "",
    headline: "",
    description: "",
    callToAction: "WHATSAPP_MESSAGE",
    mediaUrl: "",
  },
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getObjectiveLabel = (value) =>
  objectiveOptions.find((option) => option.value === value)?.label || value || "Objective";

const formatAdAccountLabel = (account) => {
  const accountName = String(account?.name || "").trim();
  const accountId = String(account?.id || "").trim();
  return accountName && accountId ? `${accountName} (${accountId})` : accountName || accountId || "Meta ad account";
};

const pickAvailablePageId = (preferredPageId, availablePages = []) => {
  const normalizedPreferred = String(preferredPageId || "").trim();
  const availablePageIds = new Set(
    (availablePages || []).map((page) => String(page?.id || "").trim()).filter(Boolean)
  );

  if (normalizedPreferred && availablePageIds.has(normalizedPreferred)) {
    return normalizedPreferred;
  }

  return String(availablePages?.[0]?.id || "").trim();
};

const hydrateFormFromCampaign = (campaign, fallbackSetup = {}) => ({
  ...defaultForm,
  campaignName: campaign?.campaignName || "",
  objective: campaign?.objective || "OUTCOME_LEADS",
  adAccountId:
    campaign?.meta?.adAccountId ||
    campaign?.setupSnapshot?.selectedAdAccountId ||
    fallbackSetup?.selectedAdAccountId ||
    "",
  configuredPageId:
    pickAvailablePageId(
      campaign?.configuredPageId ||
        campaign?.setupSnapshot?.selectedPageId ||
        fallbackSetup?.selectedPageId ||
        "",
      fallbackSetup?.availablePages || []
    ),
  whatsappNumber:
    campaign?.whatsappNumber ||
    campaign?.setupSnapshot?.linkedWhatsappNumber ||
    fallbackSetup?.linkedWhatsappNumber ||
    "",
  budget: {
    dailyBudget: Number(campaign?.budget?.dailyBudget || 500),
    currency: campaign?.budget?.currency || "INR",
  },
  targeting: {
    countries: campaign?.targeting?.countries?.length ? campaign.targeting.countries : ["IN"],
    ageMin: Number(campaign?.targeting?.ageMin || 21),
    ageMax: Number(campaign?.targeting?.ageMax || 45),
  },
  creative: {
    primaryText: campaign?.creative?.primaryText || "",
    headline: campaign?.creative?.headline || "",
    description: campaign?.creative?.description || "",
    callToAction: campaign?.creative?.callToAction || "WHATSAPP_MESSAGE",
    mediaUrl: campaign?.creative?.mediaUrl || "",
  },
});

const getOAuthHelp = (message = "") => {
  const text = String(message || "").toLowerCase();
  const isDomainIssue =
    text.includes("app domains") ||
    text.includes("can't load url") ||
    text.includes("cannot load url") ||
    text.includes("valid oauth redirect") ||
    text.includes("redirect_uri");

  if (!isDomainIssue) return null;

  const frontendBaseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-frontend-domain";
  const backendBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://your-backend-domain");
  const oauthCallback = `${String(backendBaseUrl).replace(/\/$/, "")}/api/meta-ads/oauth/callback`;

  return [
    `Meta Developer Console > Settings > Basic > Website > Site URL: ${frontendBaseUrl}`,
    `Meta Developer Console > Facebook Login > Settings > Valid OAuth Redirect URIs: ${oauthCallback}`,
    "If Facebook Login still rejects localhost, use your deployed frontend/backend domains or a public HTTPS tunnel for testing.",
    "If the app is in Development mode, add your Facebook account as an admin, developer, or tester.",
  ];
};

const MetaAdsManager = () => {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [connectingFacebook, setConnectingFacebook] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [draftId, setDraftId] = useState("");
  const [wizardSaving, setWizardSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creativeFile, setCreativeFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [form, setForm] = useState(defaultForm);

  const backendOrigin = (() => {
    try {
      return new URL(import.meta.env.VITE_API_BASE_URL || window.location.origin).origin;
    } catch {
      return window.location.origin;
    }
  })();

  const loadOverview = async () => {
    try {
      setLoading(true);
      const data = await metaAdsService.getOverview();
      setOverview(data);
      setForm((current) => ({
        ...current,
        adAccountId: current.adAccountId || data?.setup?.selectedAdAccountId || data?.setup?.availableAdAccounts?.[0]?.id || "",
        configuredPageId: pickAvailablePageId(
          current.configuredPageId || data?.setup?.selectedPageId || "",
          data?.setup?.availablePages || []
        ),
        whatsappNumber:
          current.whatsappNumber ||
          data?.setup?.linkedWhatsappNumber ||
          data?.setup?.availableWhatsappNumbers?.[0]?.display_phone_number ||
          "",
      }));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to load Meta Ads workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (!creativeFile) {
      setPreviewUrl(form.creative.mediaUrl || "");
      return undefined;
    }
    const nextPreviewUrl = URL.createObjectURL(creativeFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [creativeFile, form.creative.mediaUrl]);

  const setup = overview?.setup || {};
  const campaigns = overview?.campaigns || [];
  const summary = overview?.summary || {};
  const wallet = overview?.wallet || { balance: 0, transactions: [] };
  const adAccounts = setup.availableAdAccounts || [];
  const pages = setup.availablePages || [];
  const whatsappNumbers = setup.availableWhatsappNumbers || [];
  const isFacebookConnected = Boolean(setup.connected);
  const hasPageAccess = Boolean(setup.hasPageAccess || pages.length);
  const publishBlockedReason = !isFacebookConnected
    ? "Connect Facebook before publishing."
    : !adAccounts.length
      ? "Select a Meta ad account before publishing."
      : !hasPageAccess
        ? "Reconnect Facebook and grant Facebook Page access before publishing."
        : "";
  const oauthHelp = getOAuthHelp(error);
  const draftCampaigns = campaigns.filter((campaign) => String(campaign.status).toUpperCase() === "DRAFT");
  const liveCampaigns = campaigns.filter((campaign) => String(campaign.status).toUpperCase() !== "DRAFT");
  const progressPercent = useMemo(() => (wizardStep / wizardSteps.length) * 100, [wizardStep]);

  const openNewWizard = () => {
    setError("");
    setSuccess("");
    setWizardOpen(true);
    setWizardStep(1);
    setDraftId("");
    setCreativeFile(null);
    setPreviewUrl("");
    setForm({
      ...defaultForm,
      adAccountId: setup.selectedAdAccountId || adAccounts[0]?.id || "",
      configuredPageId: pickAvailablePageId(setup.selectedPageId || "", pages),
      whatsappNumber: setup.linkedWhatsappNumber || whatsappNumbers[0]?.display_phone_number || "",
    });
    setActiveSection("campaigns");
  };

  const openDraftWizard = (campaign) => {
    setError("");
    setSuccess("");
    setWizardOpen(true);
    setDraftId(campaign?._id || "");
    setWizardStep(Number(campaign?.wizard?.currentStep || 1));
    setCreativeFile(null);
    setForm(hydrateFormFromCampaign(campaign, setup));
    setActiveSection("campaigns");
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setDraftId("");
    setCreativeFile(null);
  };

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateBudget = (key, value) =>
    setForm((current) => ({ ...current, budget: { ...current.budget, [key]: value } }));
  const updateTargeting = (key, value) =>
    setForm((current) => ({ ...current, targeting: { ...current.targeting, [key]: value } }));
  const updateCreative = (key, value) =>
    setForm((current) => ({ ...current, creative: { ...current.creative, [key]: value } }));

  const handleConnect = async () => {
    try {
      setConnectingFacebook(true);
      setError("");
      setSuccess("");
      const response = await metaAdsService.startFacebookAuth(window.location.origin);
      const popup = window.open(response?.authUrl, "meta-facebook-connect", "width=720,height=760,menubar=no,toolbar=no,status=no");

      if (!popup) {
        setError("Popup blocked. Please allow popups and try again.");
        return;
      }

      await new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error("Facebook connection timed out. Please try again."));
        }, 180000);

        const pollId = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error("Facebook connection window was closed before completion."));
          }
        }, 500);

        const handleMessage = async (event) => {
          if (event.origin !== backendOrigin) return;
          const payload = event.data || {};

          if (payload.type === "meta_oauth_success") {
            cleanup();
            await loadOverview();
            setSuccess("Facebook account connected successfully.");
            resolve();
          }

          if (payload.type === "meta_oauth_error") {
            cleanup();
            reject(new Error(payload.error || "Facebook connection failed."));
          }
        };

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          window.clearInterval(pollId);
          window.removeEventListener("message", handleMessage);
          try {
            if (!popup.closed) popup.close();
          } catch {}
        };

        window.addEventListener("message", handleMessage);
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Connection failed.");
    } finally {
      setConnectingFacebook(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSetup(true);
      setError("");
      setSuccess("");
      const response = await metaAdsService.saveSelections({
        adAccountId: form.adAccountId,
        pageId: form.configuredPageId,
        whatsappNumber: form.whatsappNumber,
      });
      setOverview((current) => ({
        ...(current || {}),
        setup: { ...(current?.setup || {}), ...(response?.setup || {}) },
      }));
      setSuccess("Settings saved successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to save settings.");
    } finally {
      setSavingSetup(false);
    }
  };

  const handleRunDiagnostics = async () => {
    try {
      setDiagnosticsLoading(true);
      setError("");
      const response = await metaAdsService.getDiagnostics();
      setDiagnostics(response?.diagnostics || null);
      setSuccess("Diagnostics refreshed.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to run diagnostics.");
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleWizardNext = async () => {
    try {
      setWizardSaving(true);
      setError("");
      setSuccess("");

      if (wizardStep === 1) {
        const response = await metaAdsService.saveCampaignStep({
          draftId,
          campaignName: form.campaignName,
          objective: form.objective,
          adAccountId: form.adAccountId,
        });
        setDraftId(response?.draftId || response?.campaign?._id || "");
        setWizardStep(2);
        setSuccess("Campaign details saved.");
      }

      if (wizardStep === 2) {
        if (!draftId) throw new Error("Save the campaign step first.");
        await metaAdsService.saveAdSetStep({
          draftId,
          countries: form.targeting.countries,
          ageMin: form.targeting.ageMin,
          ageMax: form.targeting.ageMax,
          dailyBudget: form.budget.dailyBudget,
          currency: form.budget.currency,
        });
        setWizardStep(3);
        setSuccess("Ad set details saved.");
      }

      if (wizardStep === 3) {
        if (!draftId) throw new Error("Save the campaign step first.");
        await metaAdsService.saveAdCreativeStep(
          {
            draftId,
            mediaUrl: form.creative.mediaUrl,
            primaryText: form.creative.primaryText,
            headline: form.creative.headline || form.campaignName,
            description: form.creative.description,
            callToAction: form.creative.callToAction,
          },
          creativeFile
        );
        setWizardStep(4);
        setSuccess("Creative details saved.");
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to save this step.");
    } finally {
      setWizardSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      if (!draftId) throw new Error("Save the draft before publishing.");
      if (!hasPageAccess) {
        throw new Error("Reconnect Facebook and grant Facebook Page access before publishing.");
      }
      setPublishing(true);
      setError("");
      setSuccess("");
      await metaAdsService.publishCampaignDraft(draftId);
      await loadOverview();
      closeWizard();
      setSuccess("Campaign published successfully.");
    } catch (requestError) {
      const payload = requestError?.response?.data;
      const stage = payload?.stage ? `${payload.stage}: ` : "";
      setError(stage + (payload?.error || requestError.message || "Failed to publish campaign."));
    } finally {
      setPublishing(false);
    }
  };

  const handleSyncCampaign = async (campaignId) => {
    try {
      setSyncingId(campaignId);
      setError("");
      setSuccess("");
      const response = await metaAdsService.syncCampaign(campaignId);
      await loadOverview();
      setSuccess(response?.warning ? `Sync completed with warning: ${response.warning}` : "Campaign synced successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to sync campaign.");
    } finally {
      setSyncingId("");
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncingAll(true);
      setError("");
      setSuccess("");
      const response = await metaAdsService.syncAllCampaigns();
      await loadOverview();
      setSuccess(
        response?.warnings?.length
          ? `Synced ${response.synced} campaigns with ${response.warnings.length} warning(s).`
          : `Synced ${response?.synced || 0} campaigns successfully.`
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to sync campaigns.");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleStatusUpdate = async (campaignId, status) => {
    try {
      setStatusUpdatingId(campaignId);
      setError("");
      setSuccess("");
      await metaAdsService.updateCampaignStatus(campaignId, status);
      await loadOverview();
      setSuccess(`Campaign ${status === "ACTIVE" ? "activated" : "paused"} successfully.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to update campaign status.");
    } finally {
      setStatusUpdatingId("");
    }
  };

  const handleWalletTopUp = async () => {
    try {
      setWalletSubmitting(true);
      setError("");
      setSuccess("");
      const response = await metaAdsService.topUpWallet(Number(topUpAmount || 0));
      setOverview((current) => ({
        ...(current || {}),
        wallet: response?.wallet || current?.wallet,
      }));
      setSuccess("Wallet credited successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to top up wallet.");
    } finally {
      setWalletSubmitting(false);
    }
  };

  const statCards = [
    { label: "Total Campaigns", value: summary.totalCampaigns || 0 },
    { label: "Live Campaigns", value: summary.activeCampaigns || 0 },
    { label: "Total Spend", value: formatCurrency(summary.totalSpend || 0) },
    { label: "Leads", value: summary.totalLeads || 0 },
  ];

  const renderSectionHeader = () => {
    const titles = {
      dashboard: { title: "Meta Ads Dashboard", copy: "A focused workspace to launch, track, and optimize campaigns." },
      campaigns: { title: "Campaigns", copy: "Manage draft and live campaigns in a clean SaaS-style workspace." },
      analytics: { title: "Analytics", copy: "Monitor campaign delivery, spend, and performance signals." },
      settings: { title: "Settings", copy: "Connect Facebook, choose ad accounts, and configure setup details." },
    };
    return titles[activeSection];
  };

  const header = renderSectionHeader();

  return (
    <div className="meta-ads-saas-page">
      <section className="meta-ads-saas-shell">
        <aside className="meta-ads-sidebar">
          <div className="meta-ads-sidebar-brand">
            <div className="meta-ads-sidebar-badge">
              <Sparkles size={18} />
            </div>
            <div>
              <strong>Technovo Ads</strong>
              <span>Clean Meta campaign workspace</span>
            </div>
          </div>

          <div className="meta-ads-sidebar-menu">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.key}
                  type="button"
                  className={`meta-ads-sidebar-item ${activeSection === section.key ? "active" : ""}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  <Icon size={18} />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="meta-ads-sidebar-card">
            <span className={`connection-dot ${isFacebookConnected ? "connected" : ""}`} />
            <div>
              <strong>{isFacebookConnected ? "Facebook Connected" : "Connection Pending"}</strong>
              <p>{isFacebookConnected ? "Your Meta Ads account is ready for campaign work." : "Connect Facebook in Settings before publishing."}</p>
            </div>
          </div>
        </aside>

        <main className="meta-ads-main">
          <header className="meta-ads-topbar">
            <div>
              <h1>{header.title}</h1>
              <p>{header.copy}</p>
            </div>
            <div className="meta-ads-topbar-actions">
              <div className="meta-ads-credit-pill">
                <Wallet size={16} />
                <span>{formatCurrency(wallet.balance || 0)} credit</span>
              </div>
              <button type="button" className="meta-button meta-button-primary" onClick={openNewWizard}>
                <Plus size={16} />
                <span>Create Campaign</span>
              </button>
            </div>
          </header>

          {error ? (
            <div className="meta-banner meta-banner-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="meta-banner meta-banner-success">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          ) : null}

          {oauthHelp?.length ? (
            <div className="meta-banner meta-banner-info">
              <div>
                <strong>Meta app setup fix needed</strong>
                <div className="meta-help-list">
                  {oauthHelp.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && isFacebookConnected && !hasPageAccess ? (
            <div className="meta-banner meta-banner-info">
              <AlertCircle size={16} />
              <span>No accessible Facebook Page was found for this Meta login. Reconnect Facebook and approve page access, then choose a page in Settings.</span>
            </div>
          ) : null}

          {loading ? (
            <div className="meta-loading-state">
              <CircleDashed className="spin" size={28} />
              <span>Loading your Meta Ads workspace...</span>
            </div>
          ) : null}

          {!loading && activeSection === "dashboard" ? (
            <div className="meta-section-stack">
              <div className="meta-grid meta-grid-stats">
                {statCards.map((card) => (
                  <article key={card.label} className="meta-card meta-stat-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>

              <div className="meta-grid meta-grid-hero">
                <article className="meta-card meta-hero-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Guided campaign setup</h3>
                      <p>Create campaigns in four clean steps with draft saving built in.</p>
                    </div>
                    <button type="button" className="meta-button meta-button-secondary" onClick={openNewWizard}>
                      Start Wizard
                    </button>
                  </div>
                  <div className="meta-step-strip">
                    {wizardSteps.map((step) => (
                      <div key={step.key} className="meta-step-strip-item">
                        <span>{step.key}</span>
                        <strong>{step.label}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="meta-card meta-summary-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Workspace health</h3>
                      <p>Everything you need before a campaign goes live.</p>
                    </div>
                  </div>
                  <div className="meta-status-list">
                    <div><span>Facebook connection</span><strong>{isFacebookConnected ? "Connected" : "Pending"}</strong></div>
                    <div><span>Ad account</span><strong>{setup.selectedAdAccountId || "Not selected"}</strong></div>
                    <div><span>Facebook page</span><strong>{setup.selectedPageId || "Not selected"}</strong></div>
                    <div><span>Wallet balance</span><strong>{formatCurrency(wallet.balance || 0)}</strong></div>
                  </div>
                </article>
              </div>

              <div className="meta-grid meta-grid-lists">
                <article className="meta-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Recent campaigns</h3>
                      <p>Your latest Meta Ads activity at a glance.</p>
                    </div>
                    <button type="button" className="meta-link-button" onClick={() => setActiveSection("campaigns")}>
                      View all
                      <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="meta-mini-list">
                    {(campaigns.slice(0, 4) || []).map((campaign) => (
                      <div key={campaign._id} className="meta-mini-list-item">
                        <div>
                          <strong>{campaign.campaignName}</strong>
                          <span>{getObjectiveLabel(campaign.objective)}</span>
                        </div>
                        <div>
                          <strong>{formatCurrency(campaign.budget?.dailyBudget || 0)}</strong>
                          <span>{campaign.status}</span>
                        </div>
                      </div>
                    ))}
                    {campaigns.length === 0 ? <div className="meta-empty-inline">No campaigns yet. Create your first campaign to get started.</div> : null}
                  </div>
                </article>

                <article className="meta-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Draft campaigns</h3>
                      <p>Pick up where you left off without rebuilding forms.</p>
                    </div>
                  </div>
                  <div className="meta-mini-list">
                    {draftCampaigns.map((campaign) => (
                      <button key={campaign._id} type="button" className="meta-draft-item" onClick={() => openDraftWizard(campaign)}>
                        <div>
                          <strong>{campaign.campaignName}</strong>
                          <span>Step {campaign?.wizard?.currentStep || 1} of 4</span>
                        </div>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    {draftCampaigns.length === 0 ? <div className="meta-empty-inline">No drafts saved yet. The wizard will save each step automatically.</div> : null}
                  </div>
                </article>
              </div>
            </div>
          ) : null}

          {!loading && activeSection === "campaigns" ? (
            <div className="meta-section-stack">
              <article className="meta-card">
                <div className="meta-card-head">
                  <div>
                    <h3>Campaign list</h3>
                    <p>All draft, paused, and active campaigns in one clean table.</p>
                  </div>
                  <button type="button" className="meta-button meta-button-primary" onClick={openNewWizard}>
                    <Plus size={16} />
                    <span>Create Campaign</span>
                  </button>
                </div>

                <div className="meta-table-shell">
                  <div className="meta-table meta-table-head">
                    <span>Campaign</span>
                    <span>Objective</span>
                    <span>Status</span>
                    <span>Daily Budget</span>
                    <span>Spend</span>
                    <span>Created</span>
                    <span>Actions</span>
                  </div>

                  {campaigns.length === 0 ? (
                    <div className="meta-empty-state">
                      <Megaphone size={28} />
                      <strong>No campaigns yet</strong>
                      <span>Create your first campaign with the step-by-step wizard.</span>
                    </div>
                  ) : (
                    campaigns.map((campaign) => {
                      const isDraft = String(campaign.status).toUpperCase() === "DRAFT";
                      const isActive = String(campaign.status).toUpperCase() === "ACTIVE";
                      const isBusy = syncingId === campaign._id || statusUpdatingId === campaign._id;

                      return (
                        <div key={campaign._id} className="meta-table">
                          <div>
                            <strong>{campaign.campaignName}</strong>
                            <span>{campaign.meta?.adAccountId || campaign.setupSnapshot?.selectedAdAccountId || "Meta ad account"}</span>
                          </div>
                          <span>{getObjectiveLabel(campaign.objective)}</span>
                          <span className={`meta-status-pill ${String(campaign.status).toLowerCase()}`}>{campaign.status}</span>
                          <span>{formatCurrency(campaign.budget?.dailyBudget || 0)}</span>
                          <span>{formatCurrency(campaign.analytics?.spend || 0)}</span>
                          <span>{formatDate(campaign.createdAt)}</span>
                          <div className="meta-table-actions">
                            {isDraft ? (
                              <button type="button" className="meta-button meta-button-secondary small" onClick={() => openDraftWizard(campaign)}>
                                Continue
                              </button>
                            ) : (
                              <>
                                <button type="button" className="meta-button meta-button-secondary small" disabled={isBusy} onClick={() => handleSyncCampaign(campaign._id)}>
                                  {syncingId === campaign._id ? <RefreshCw className="spin" size={14} /> : "Sync"}
                                </button>
                                <button
                                  type="button"
                                  className="meta-button meta-button-secondary small"
                                  disabled={isBusy}
                                  onClick={() => handleStatusUpdate(campaign._id, isActive ? "PAUSED" : "ACTIVE")}
                                >
                                  {statusUpdatingId === campaign._id ? <RefreshCw className="spin" size={14} /> : isActive ? "Pause" : "Activate"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </article>
            </div>
          ) : null}

          {!loading && activeSection === "analytics" ? (
            <div className="meta-section-stack">
              <div className="meta-grid meta-grid-stats">
                <article className="meta-card meta-stat-card"><span>Total impressions</span><strong>{summary.totalImpressions || 0}</strong></article>
                <article className="meta-card meta-stat-card"><span>Average CTR</span><strong>{summary.averageCtr || 0}%</strong></article>
                <article className="meta-card meta-stat-card"><span>Total leads</span><strong>{summary.totalLeads || 0}</strong></article>
                <article className="meta-card meta-stat-card"><span>Average CPL</span><strong>{formatCurrency(summary.averageCpl || 0)}</strong></article>
              </div>

              <article className="meta-card">
                <div className="meta-card-head">
                  <div>
                    <h3>Campaign performance</h3>
                    <p>Refresh insights whenever you want a manual sync.</p>
                  </div>
                  <button type="button" className="meta-button meta-button-secondary" disabled={syncingAll} onClick={handleSyncAll}>
                    {syncingAll ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />}
                    <span>{syncingAll ? "Syncing..." : "Sync All"}</span>
                  </button>
                </div>

                <div className="meta-analytics-list">
                  {liveCampaigns.map((campaign) => (
                    <div key={campaign._id} className="meta-analytics-item">
                      <div>
                        <strong>{campaign.campaignName}</strong>
                        <span>{campaign.status}</span>
                      </div>
                      <div>
                        <strong>{campaign.analytics?.clicks || 0} clicks</strong>
                        <span>{campaign.analytics?.ctr || 0}% CTR</span>
                      </div>
                      <div>
                        <strong>{formatCurrency(campaign.analytics?.spend || 0)}</strong>
                        <span>{campaign.analytics?.leads || 0} leads</span>
                      </div>
                    </div>
                  ))}
                  {liveCampaigns.length === 0 ? <div className="meta-empty-inline">No live campaign analytics yet.</div> : null}
                </div>
              </article>
            </div>
          ) : null}

          {!loading && activeSection === "settings" ? (
            <div className="meta-section-stack">
              <div className="meta-grid meta-grid-settings">
                <article className="meta-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Connection</h3>
                      <p>Connect Facebook and keep all Meta API calls safely on the backend.</p>
                    </div>
                    <button type="button" className="meta-button meta-button-facebook" disabled={connectingFacebook} onClick={handleConnect}>
                      <Facebook size={16} />
                      <span>{connectingFacebook ? "Connecting..." : "Connect Facebook"}</span>
                    </button>
                  </div>

                  <div className="meta-settings-grid">
                    <label>
                      <span>Ad Account</span>
                      <select value={form.adAccountId} onChange={(event) => updateField("adAccountId", event.target.value)} disabled={!isFacebookConnected}>
                        <option value="">Choose ad account</option>
                        {adAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {formatAdAccountLabel(account)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Facebook Page</span>
                      <select value={form.configuredPageId} onChange={(event) => updateField("configuredPageId", event.target.value)} disabled={!isFacebookConnected}>
                        <option value="">Choose page</option>
                        {pages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!hasPageAccess ? (
                      <div className="meta-empty-inline">
                        No Facebook Pages are available for this login yet. Reconnect Facebook and approve page access.
                      </div>
                    ) : null}
                    <label>
                      <span>WhatsApp Number</span>
                      <input type="text" value={form.whatsappNumber} onChange={(event) => updateField("whatsappNumber", event.target.value)} placeholder="+91 98765 43210" />
                    </label>
                    <div className="meta-settings-actions">
                      <button type="button" className="meta-button meta-button-primary" disabled={savingSetup} onClick={handleSaveSettings}>
                        {savingSetup ? <RefreshCw className="spin" size={16} /> : "Save Settings"}
                      </button>
                    </div>
                  </div>
                </article>

                <article className="meta-card">
                  <div className="meta-card-head">
                    <div>
                      <h3>Wallet & diagnostics</h3>
                      <p>Monitor setup health and add campaign credits from one place.</p>
                    </div>
                    <button type="button" className="meta-button meta-button-secondary" disabled={diagnosticsLoading} onClick={handleRunDiagnostics}>
                      {diagnosticsLoading ? <RefreshCw className="spin" size={16} /> : "Run Diagnostics"}
                    </button>
                  </div>

                  <div className="meta-wallet-row">
                    <div>
                      <span>Available credit</span>
                      <strong>{formatCurrency(wallet.balance || 0)}</strong>
                    </div>
                    <div className="meta-wallet-input">
                      <input type="number" min="100" step="100" value={topUpAmount} onChange={(event) => setTopUpAmount(Number(event.target.value || 0))} />
                      <button type="button" className="meta-button meta-button-secondary" disabled={walletSubmitting} onClick={handleWalletTopUp}>
                        {walletSubmitting ? <RefreshCw className="spin" size={16} /> : "Add Credit"}
                      </button>
                    </div>
                  </div>

                  <div className="meta-diagnostics-grid">
                    <div><span>Access token</span><strong>{diagnostics?.env?.hasAccessToken ? "Present" : "Unknown"}</strong></div>
                    <div><span>Ad account ID</span><strong>{diagnostics?.env?.hasAdAccountId ? "Present" : "Unknown"}</strong></div>
                    <div><span>Page ID</span><strong>{diagnostics?.env?.hasPageId ? "Present" : "Unknown"}</strong></div>
                    <div><span>Auth source</span><strong>{diagnostics?.env?.authSource || setup.authSource || "env"}</strong></div>
                  </div>
                </article>
              </div>
            </div>
          ) : null}
        </main>
      </section>

      {wizardOpen ? (
        <div className="meta-wizard-backdrop">
          <div className="meta-wizard-panel">
            <div className="meta-wizard-head">
              <div>
                <span className="meta-eyebrow">Campaign builder</span>
                <h2>Create campaign</h2>
                <p>A clean 4-step flow designed to feel like a real SaaS ads manager.</p>
              </div>
              <button type="button" className="meta-close-button" onClick={closeWizard}>
                Close
              </button>
            </div>

            <div className="meta-progress-shell">
              <div className="meta-progress-bar">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="meta-progress-steps">
                {wizardSteps.map((step) => (
                  <div key={step.key} className={`meta-progress-step ${wizardStep >= step.key ? "active" : ""}`}>
                    <span>{step.key}</span>
                    <strong>{step.label}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="meta-wizard-body">
              {wizardStep === 1 ? (
                <div className="meta-form-grid">
                  <label className="full">
                    <span>Campaign Name</span>
                    <input type="text" value={form.campaignName} onChange={(event) => updateField("campaignName", event.target.value)} placeholder="Summer lead generation campaign" />
                  </label>
                  <label>
                    <span>Objective</span>
                    <select value={form.objective} onChange={(event) => updateField("objective", event.target.value)}>
                      {objectiveOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Ad Account</span>
                    <select value={form.adAccountId} onChange={(event) => updateField("adAccountId", event.target.value)}>
                      <option value="">Choose ad account</option>
                      {adAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {formatAdAccountLabel(account)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="meta-form-grid">
                  <label className="full">
                    <span>Country</span>
                    <input
                      type="text"
                      value={form.targeting.countries.join(", ")}
                      onChange={(event) =>
                        updateTargeting(
                          "countries",
                          event.target.value
                            .split(",")
                            .map((item) => item.trim().toUpperCase())
                            .filter(Boolean)
                        )
                      }
                      placeholder="IN"
                    />
                  </label>
                  <label>
                    <span>Minimum Age</span>
                    <input type="number" min="18" max="65" value={form.targeting.ageMin} onChange={(event) => updateTargeting("ageMin", Number(event.target.value))} />
                  </label>
                  <label>
                    <span>Maximum Age</span>
                    <input type="number" min="18" max="65" value={form.targeting.ageMax} onChange={(event) => updateTargeting("ageMax", Number(event.target.value))} />
                  </label>
                  <label className="full">
                    <span>Daily Budget</span>
                    <input type="number" min="100" step="100" value={form.budget.dailyBudget} onChange={(event) => updateBudget("dailyBudget", Number(event.target.value))} />
                  </label>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="meta-form-grid meta-form-grid-creative">
                  <div className="meta-upload-card">
                    <span>Ad image</span>
                    <label className="meta-upload-box">
                      <Upload size={18} />
                      <strong>{creativeFile ? creativeFile.name : "Upload creative image"}</strong>
                      <input type="file" accept="image/*" onChange={(event) => setCreativeFile(event.target.files?.[0] || null)} />
                    </label>
                    <label>
                      <span>Or paste image URL</span>
                      <input type="url" value={form.creative.mediaUrl} onChange={(event) => updateCreative("mediaUrl", event.target.value)} placeholder="https://example.com/ad.jpg" />
                    </label>
                  </div>

                  <div className="meta-preview-card">
                    <span>Preview</span>
                    <div className="meta-preview-media">
                      {previewUrl ? <img src={previewUrl} alt="Ad preview" /> : <Upload size={22} />}
                    </div>
                  </div>

                  <label className="full">
                    <span>Primary Text</span>
                    <textarea rows="4" value={form.creative.primaryText} onChange={(event) => updateCreative("primaryText", event.target.value)} placeholder="Write the main message for your ad..." />
                  </label>
                  <label>
                    <span>Headline</span>
                    <input type="text" value={form.creative.headline} onChange={(event) => updateCreative("headline", event.target.value)} placeholder="High-converting headline" />
                  </label>
                  <label>
                    <span>CTA Button</span>
                    <select value={form.creative.callToAction} onChange={(event) => updateCreative("callToAction", event.target.value)}>
                      {ctaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {wizardStep === 4 ? (
                <div className="meta-review-grid">
                  <article className="meta-review-card">
                    <h3>Campaign</h3>
                    <div><span>Name</span><strong>{form.campaignName || "--"}</strong></div>
                    <div><span>Objective</span><strong>{getObjectiveLabel(form.objective)}</strong></div>
                    <div><span>Ad account</span><strong>{form.adAccountId || "--"}</strong></div>
                  </article>
                  <article className="meta-review-card">
                    <h3>Ad Set</h3>
                    <div><span>Country</span><strong>{form.targeting.countries.join(", ") || "--"}</strong></div>
                    <div><span>Age</span><strong>{form.targeting.ageMin} - {form.targeting.ageMax}</strong></div>
                    <div><span>Daily budget</span><strong>{formatCurrency(form.budget.dailyBudget)}</strong></div>
                  </article>
                  <article className="meta-review-card">
                    <h3>Creative</h3>
                    <div><span>Facebook page</span><strong>{form.configuredPageId || "Reconnect Facebook and select a page"}</strong></div>
                    <div><span>Headline</span><strong>{form.creative.headline || form.campaignName || "--"}</strong></div>
                    <div><span>CTA</span><strong>{ctaOptions.find((option) => option.value === form.creative.callToAction)?.label || "--"}</strong></div>
                    <div><span>Primary text</span><strong>{form.creative.primaryText || "--"}</strong></div>
                  </article>
                </div>
              ) : null}
            </div>

            <div className="meta-wizard-footer">
              <button type="button" className="meta-button meta-button-secondary" disabled={wizardStep === 1 || wizardSaving || publishing} onClick={() => setWizardStep((current) => Math.max(1, current - 1))}>
                Back
              </button>
              <div className="meta-wizard-footer-actions">
                {wizardStep < 4 ? (
                  <button type="button" className="meta-button meta-button-primary" disabled={wizardSaving} onClick={handleWizardNext}>
                    {wizardSaving ? <RefreshCw className="spin" size={16} /> : "Save & Continue"}
                  </button>
                ) : (
                  <button type="button" className="meta-button meta-button-primary" disabled={publishing || Boolean(publishBlockedReason)} onClick={handlePublish} title={publishBlockedReason}>
                    {publishing ? <RefreshCw className="spin" size={16} /> : "Publish Campaign"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MetaAdsManager;
