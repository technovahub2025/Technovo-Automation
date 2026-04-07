import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Facebook,
  FolderKanban,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
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
  { key: 3, label: "Ad" },
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
  campaignConfig: {
    buyingType: "AUCTION",
    specialAdCategories: [],
    initialStatus: "PAUSED",
    spendingLimit: 0,
  },
  configuredPageId: "",
  configuredInstagramActorId: "",
  whatsappNumber: "",
  budget: { dailyBudget: 500, currency: "INR" },
  adSet: { name: "", optimizationGoal: "LINK_CLICKS", billingEvent: "IMPRESSIONS", bidStrategy: "LOWEST_COST_WITH_BID_CAP" },
  targeting: { countries: ["IN"], ageMin: 21, ageMax: 45, genders: [] },
  placement: {
    publisherPlatforms: ["facebook", "instagram"],
    facebookPositions: ["feed", "marketplace", "video_feeds"],
    instagramPositions: ["stream", "story", "reels"],
  },
  schedule: { startTime: "", endTime: "" },
  creative: { adName: "", primaryText: "", headline: "", description: "", callToAction: "WHATSAPP_MESSAGE", destinationUrl: "", displayLink: "", mediaUrl: "", mediaHash: "" },
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const buildListKey = (...parts) =>
  parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(":");

const pickAvailablePageId = (preferredPageId, availablePages = []) => {
  const preferred = String(preferredPageId || "").trim();
  if (preferred && availablePages.some((page) => String(page?.id || "") === preferred)) return preferred;
  if (preferred) return preferred;
  return String(availablePages?.[0]?.id || "");
};

const hydrateFormFromCampaign = (campaign, setup = {}) => ({
  ...defaultForm,
  campaignName: campaign?.campaignName || "",
  objective: campaign?.objective || "OUTCOME_LEADS",
  adAccountId: campaign?.meta?.adAccountId || campaign?.setupSnapshot?.selectedAdAccountId || setup?.selectedAdAccountId || "",
  campaignConfig: {
    buyingType: campaign?.campaignConfig?.buyingType || "AUCTION",
    specialAdCategories: campaign?.campaignConfig?.specialAdCategories?.length ? campaign.campaignConfig.specialAdCategories : [],
    initialStatus: campaign?.campaignConfig?.initialStatus || "PAUSED",
    spendingLimit: Number(campaign?.campaignConfig?.spendingLimit || 0),
  },
  configuredPageId: pickAvailablePageId(campaign?.configuredPageId || campaign?.setupSnapshot?.selectedPageId || setup?.selectedPageId || "", setup?.availablePages || []),
  configuredInstagramActorId: campaign?.configuredInstagramActorId || "",
  whatsappNumber: campaign?.whatsappNumber || campaign?.setupSnapshot?.linkedWhatsappNumber || setup?.linkedWhatsappNumber || "",
  budget: { dailyBudget: Number(campaign?.budget?.dailyBudget || 500), currency: campaign?.budget?.currency || "INR" },
  adSet: {
    name: campaign?.adSet?.name || `${campaign?.campaignName || "Campaign"} - Ad Set`,
    optimizationGoal: campaign?.adSet?.optimizationGoal || "LINK_CLICKS",
    billingEvent: campaign?.adSet?.billingEvent || "IMPRESSIONS",
    bidStrategy: campaign?.adSet?.bidStrategy || "LOWEST_COST_WITH_BID_CAP",
  },
  targeting: {
    countries: campaign?.targeting?.countries?.length ? campaign.targeting.countries : ["IN"],
    ageMin: Number(campaign?.targeting?.ageMin || 21),
    ageMax: Number(campaign?.targeting?.ageMax || 45),
    genders: campaign?.targeting?.genders?.length ? campaign.targeting.genders.map((value) => String(value)) : [],
  },
  placement: {
    publisherPlatforms: campaign?.placement?.publisherPlatforms?.length ? campaign.placement.publisherPlatforms : ["facebook", "instagram"],
    facebookPositions: campaign?.placement?.facebookPositions?.length ? campaign.placement.facebookPositions : ["feed", "marketplace", "video_feeds"],
    instagramPositions: campaign?.placement?.instagramPositions?.length ? campaign.placement.instagramPositions : ["stream", "story", "reels"],
  },
  schedule: {
    startTime: campaign?.schedule?.startTime ? new Date(campaign.schedule.startTime).toISOString().slice(0, 16) : "",
    endTime: campaign?.schedule?.endTime ? new Date(campaign.schedule.endTime).toISOString().slice(0, 16) : "",
  },
  creative: {
    adName: campaign?.creative?.adName || `${campaign?.campaignName || "Campaign"} - Ad`,
    primaryText: campaign?.creative?.primaryText || "",
    headline: campaign?.creative?.headline || "",
    description: campaign?.creative?.description || "",
    callToAction: campaign?.creative?.callToAction || "WHATSAPP_MESSAGE",
    destinationUrl: campaign?.creative?.destinationUrl || "",
    displayLink: campaign?.creative?.displayLink || "",
    mediaUrl: campaign?.creative?.mediaUrl || "",
    mediaHash: campaign?.creative?.mediaHash || "",
  },
});

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
  const [metaCampaigns, setMetaCampaigns] = useState([]);
  const [adSets, setAdSets] = useState([]);
  const [ads, setAds] = useState([]);
  const [selectedCampaignRef, setSelectedCampaignRef] = useState("");
  const [selectedAdSetId, setSelectedAdSetId] = useState("");
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);

  const setup = overview?.setup || {};
  const campaigns = overview?.campaigns || [];
  const draftCampaigns = campaigns.filter((campaign) => String(campaign.status).toUpperCase() === "DRAFT");
  const liveCampaigns = campaigns.filter((campaign) => String(campaign.status).toUpperCase() !== "DRAFT");
  const wallet = overview?.wallet || { balance: 0 };
  const adAccounts = setup.availableAdAccounts || [];
  const pages = setup.availablePages || [];
  const whatsappNumbers = setup.availableWhatsappNumbers || [];
  const effectiveConfiguredPageId = String(
    form.configuredPageId || setup.selectedPageId || pages?.[0]?.id || ""
  ).trim();
  const resolvedPages =
    pages.length || !effectiveConfiguredPageId
      ? pages
      : [{ id: effectiveConfiguredPageId, name: `Configured Page (${effectiveConfiguredPageId})` }];
  const hasPageAccess = Boolean(setup.hasPageAccess || resolvedPages.length || effectiveConfiguredPageId);
  const step3MissingFields = [
    !effectiveConfiguredPageId ? "Facebook Page" : "",
    !String(form.creative.primaryText || "").trim() ? "Primary Text" : "",
  ].filter(Boolean);
  const reviewMissingFields = [
    !String(form.campaignName || "").trim() ? "Campaign Name" : "",
    !String(form.adAccountId || "").trim() ? "Ad Account" : "",
    !String(form.adSet.name || "").trim() ? "Ad Set Name" : "",
    !effectiveConfiguredPageId ? "Facebook Page" : "",
    !String(form.creative.primaryText || "").trim() ? "Primary Text" : "",
    !String(form.creative.destinationUrl || form.whatsappNumber || "").trim() ? "Destination URL or WhatsApp Number" : "",
  ].filter(Boolean);
  const publishBlockedReason = !setup.connected ? "Meta connection is not ready." : !adAccounts.length ? "Select a Meta ad account." : !hasPageAccess ? "Select or configure a Facebook page before publishing." : "";
  const progressPercent = useMemo(() => (wizardStep / wizardSteps.length) * 100, [wizardStep]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const data = await metaAdsService.getOverview();
      setOverview(data);
      setForm((current) => ({
        ...current,
        adAccountId: current.adAccountId || data?.setup?.selectedAdAccountId || data?.setup?.availableAdAccounts?.[0]?.id || "",
        configuredPageId: pickAvailablePageId(current.configuredPageId || data?.setup?.selectedPageId || "", data?.setup?.availablePages || []),
        whatsappNumber: current.whatsappNumber || data?.setup?.linkedWhatsappNumber || data?.setup?.availableWhatsappNumbers?.[0]?.display_phone_number || "",
      }));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to load Meta Ads workspace.");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      setHierarchyLoading(true);
      const response = await metaAdsService.getCampaigns();
      const nextCampaigns = response?.campaigns || [];
      setMetaCampaigns(nextCampaigns);
      setSelectedCampaignRef((current) => (current && nextCampaigns.some((item) => (item.localCampaignId || item.id) === current) ? current : (nextCampaigns[0]?.localCampaignId || nextCampaigns[0]?.id || "")));
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to load campaigns.");
    } finally {
      setHierarchyLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!selectedCampaignRef) {
      setAdSets([]);
      setSelectedAdSetId("");
      return;
    }
    (async () => {
      try {
        setAdSetsLoading(true);
        const response = await metaAdsService.getCampaignAdSets(selectedCampaignRef);
        const nextAdSets = response?.adsets || [];
        setAdSets(nextAdSets);
        setSelectedAdSetId((current) => (current && nextAdSets.some((item) => item.id === current) ? current : (nextAdSets[0]?.id || "")));
      } catch (requestError) {
        setError(requestError?.response?.data?.error || requestError.message || "Failed to load ad sets.");
      } finally {
        setAdSetsLoading(false);
      }
    })();
  }, [selectedCampaignRef]);

  useEffect(() => {
    if (!selectedAdSetId) {
      setAds([]);
      return;
    }
    (async () => {
      try {
        setAdsLoading(true);
        const response = await metaAdsService.getAdSetAds(selectedAdSetId);
        setAds(response?.ads || []);
      } catch (requestError) {
        setError(requestError?.response?.data?.error || requestError.message || "Failed to load ads.");
      } finally {
        setAdsLoading(false);
      }
    })();
  }, [selectedAdSetId]);

  useEffect(() => {
    if (!creativeFile) {
      setPreviewUrl(form.creative.mediaUrl || "");
      return undefined;
    }
    const nextPreview = URL.createObjectURL(creativeFile);
    setPreviewUrl(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [creativeFile, form.creative.mediaUrl]);

  const refreshAll = async () => Promise.all([loadOverview(), loadCampaigns()]);
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateCampaignConfig = (key, value) => setForm((current) => ({ ...current, campaignConfig: { ...current.campaignConfig, [key]: value } }));
  const updateBudget = (key, value) => setForm((current) => ({ ...current, budget: { ...current.budget, [key]: value } }));
  const updateAdSet = (key, value) => setForm((current) => ({ ...current, adSet: { ...current.adSet, [key]: value } }));
  const updateTargeting = (key, value) => setForm((current) => ({ ...current, targeting: { ...current.targeting, [key]: value } }));
  const updatePlacement = (key, value) => setForm((current) => ({ ...current, placement: { ...current.placement, [key]: value } }));
  const updateSchedule = (key, value) => setForm((current) => ({ ...current, schedule: { ...current.schedule, [key]: value } }));
  const updateCreative = (key, value) => setForm((current) => ({ ...current, creative: { ...current.creative, [key]: value } }));

  const openNewWizard = () => {
    setError("");
    setSuccess("");
    setWizardOpen(true);
    setWizardStep(1);
    setDraftId("");
    setCreativeFile(null);
    setForm({
      ...defaultForm,
      adAccountId: setup.selectedAdAccountId || adAccounts[0]?.id || "",
      adSet: { ...defaultForm.adSet, name: `${form.campaignName || "Campaign"} - Ad Set` },
      configuredPageId: pickAvailablePageId(setup.selectedPageId || "", pages),
      whatsappNumber: setup.linkedWhatsappNumber || whatsappNumbers[0]?.display_phone_number || "",
    });
  };

  const openDraftWizard = (campaign) => {
    setError("");
    setSuccess("");
    setWizardOpen(true);
    setDraftId(campaign?._id || "");
    setWizardStep(Number(campaign?.wizard?.currentStep || 1));
    setCreativeFile(null);
    setForm(hydrateFormFromCampaign(campaign, setup));
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setDraftId("");
    setCreativeFile(null);
  };

  const handleConnect = async () => {
    try {
      setConnectingFacebook(true);
      setError("");
      const response = await metaAdsService.startFacebookAuth(window.location.origin);
      if (response?.authUrl) window.open(response.authUrl, "meta-facebook-connect", "width=720,height=760");
      setSuccess("Facebook login window opened. Current env-token architecture is already active.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to start Facebook Login.");
    } finally {
      setConnectingFacebook(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSetup(true);
      setError("");
      await metaAdsService.saveSelections({
        adAccountId: form.adAccountId,
        pageId: form.configuredPageId,
        whatsappNumber: form.whatsappNumber,
      });
      await refreshAll();
      setSuccess("Meta Ads settings saved.");
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
      if (wizardStep === 1) {
        const response = await metaAdsService.saveCampaignStep({
          draftId,
          campaignName: form.campaignName,
          objective: form.objective,
          adAccountId: form.adAccountId,
          buyingType: form.campaignConfig.buyingType,
          specialAdCategories: form.campaignConfig.specialAdCategories,
          initialStatus: form.campaignConfig.initialStatus,
          spendingLimit: form.campaignConfig.spendingLimit,
        });
        setDraftId(response?.draftId || response?.campaign?._id || "");
        setWizardStep(2);
      } else if (wizardStep === 2) {
        await metaAdsService.saveAdSetStep({
          draftId,
          adSetName: form.adSet.name || `${form.campaignName || "Campaign"} - Ad Set`,
          optimizationGoal: form.adSet.optimizationGoal,
          billingEvent: form.adSet.billingEvent,
          bidStrategy: form.adSet.bidStrategy,
          countries: form.targeting.countries,
          ageMin: form.targeting.ageMin,
          ageMax: form.targeting.ageMax,
          genders: form.targeting.genders,
          dailyBudget: form.budget.dailyBudget,
          currency: form.budget.currency,
          publisherPlatforms: form.placement.publisherPlatforms,
          facebookPositions: form.placement.facebookPositions,
          instagramPositions: form.placement.instagramPositions,
          startTime: form.schedule.startTime,
          endTime: form.schedule.endTime,
        });
        setWizardStep(3);
      } else if (wizardStep === 3) {
        const response = await metaAdsService.saveAdCreativeStep({
          draftId,
          adName: form.creative.adName || `${form.campaignName || "Campaign"} - Ad`,
          mediaUrl: form.creative.mediaUrl,
          primaryText: form.creative.primaryText,
          headline: form.creative.headline || form.campaignName,
          description: form.creative.description,
          callToAction: form.creative.callToAction,
          destinationUrl: form.creative.destinationUrl,
          displayLink: form.creative.displayLink,
          pageId: form.configuredPageId || setup.selectedPageId || "",
          instagramActorId: form.configuredInstagramActorId || "",
        }, creativeFile);
        const uploadedImageHash = response?.campaign?.creative?.mediaHash || "";
        if (uploadedImageHash) {
          updateCreative("mediaHash", uploadedImageHash);
        }
        if (creativeFile && uploadedImageHash) {
          setSuccess(`Image uploaded to Meta successfully. image_hash: ${uploadedImageHash}`);
        } else if (creativeFile) {
          setSuccess("Image uploaded to Meta successfully.");
        }
        setWizardStep(4);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to save this step.");
    } finally {
      setWizardSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      setError("");
      if (reviewMissingFields.length) {
        setError(`Complete these fields before publishing: ${reviewMissingFields.join(", ")}.`);
        return;
      }
      await metaAdsService.publishCampaignDraft(draftId);
      await refreshAll();
      closeWizard();
      setSuccess("Campaign published successfully.");
    } catch (requestError) {
      const payload = requestError?.response?.data;
      setError((payload?.stage ? `${payload.stage}: ` : "") + (payload?.error || requestError.message || "Failed to publish campaign."));
    } finally {
      setPublishing(false);
    }
  };

  const handleSyncCampaign = async (campaignId) => {
    try {
      setSyncingId(campaignId);
      setError("");
      await metaAdsService.syncCampaign(campaignId);
      await refreshAll();
      setSuccess("Campaign synced successfully.");
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
      await metaAdsService.syncAllCampaigns();
      await refreshAll();
      setSuccess("All campaigns synced.");
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
      await metaAdsService.updateCampaignStatus(campaignId, status);
      await refreshAll();
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
      const response = await metaAdsService.topUpWallet(Number(topUpAmount || 0));
      setOverview((current) => ({ ...(current || {}), wallet: response?.wallet || current?.wallet }));
      setSuccess("Wallet credited successfully.");
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || "Failed to top up wallet.");
    } finally {
      setWalletSubmitting(false);
    }
  };

  return (
    <div className="meta-ads-saas-page">
      <section className="meta-ads-saas-shell">
        <aside className="meta-ads-sidebar">
          <div className="meta-ads-sidebar-brand"><div className="meta-ads-sidebar-badge">M</div><div><strong>Meta Ads</strong><span>{setup.authSource === "user" ? "Facebook Login Ready" : "Env Token Ready"}</span></div></div>
          <div className="meta-ads-sidebar-menu">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return <button key={buildListKey("section", section.key, index)} type="button" className={`meta-ads-sidebar-item ${activeSection === section.key ? "active" : ""}`} onClick={() => setActiveSection(section.key)}><Icon size={18} /><span>{section.label}</span></button>;
            })}
          </div>
        </aside>

        <main className="meta-ads-main">
          <header className="meta-ads-topbar">
            <div><h1>Meta Ads Manager</h1><p>Backend-owned Meta token now, Facebook Login later with the same API structure.</p></div>
            <div className="meta-ads-topbar-actions">
              <div className="meta-ads-credit-pill"><Wallet size={16} /><span>{formatCurrency(wallet.balance || 0)}</span></div>
              <button type="button" className="meta-button meta-button-primary" onClick={openNewWizard}><Plus size={16} /><span>Create Campaign</span></button>
            </div>
          </header>

          {error ? <div className="meta-alert meta-alert-error"><AlertCircle size={16} /><span>{error}</span></div> : null}
          {success ? <div className="meta-alert meta-alert-success"><CheckCircle2 size={16} /><span>{success}</span></div> : null}

          {!loading && activeSection === "dashboard" ? <div className="meta-grid meta-grid-stats">
            <article className="meta-card meta-stat-card"><span>Total Campaigns</span><strong>{overview?.summary?.totalCampaigns || 0}</strong></article>
            <article className="meta-card meta-stat-card"><span>Live Campaigns</span><strong>{overview?.summary?.activeCampaigns || 0}</strong></article>
            <article className="meta-card meta-stat-card"><span>Total Spend</span><strong>{formatCurrency(overview?.summary?.totalSpend || 0)}</strong></article>
            <article className="meta-card meta-stat-card"><span>Total Leads</span><strong>{overview?.summary?.totalLeads || 0}</strong></article>
          </div> : null}

          {!loading && activeSection === "campaigns" ? <div className="meta-section-stack">
            <article className="meta-card">
              <div className="meta-card-head"><div><h3>Campaign Hierarchy</h3><p>Campaign -&gt; Ad Set -&gt; Ad</p></div><button type="button" className="meta-button meta-button-secondary" disabled={hierarchyLoading} onClick={loadCampaigns}>{hierarchyLoading ? <RefreshCw className="spin" size={16} /> : "Refresh"}</button></div>
              <div className="meta-hierarchy-grid">
                <div className="meta-hierarchy-column"><div className="meta-hierarchy-head"><strong>Campaigns</strong><span>{metaCampaigns.length}</span></div><div className="meta-hierarchy-list">{hierarchyLoading ? <div className="meta-empty-inline">Loading campaigns...</div> : metaCampaigns.map((campaign, index) => { const ref = campaign.localCampaignId || campaign.id; return <button key={buildListKey("campaign", ref, campaign.name || campaign.campaignName, index)} type="button" className={`meta-hierarchy-item ${selectedCampaignRef === ref ? "active" : ""}`} onClick={() => setSelectedCampaignRef(ref)}><strong>{campaign.name || campaign.campaignName}</strong><span>{campaign.objective || "--"}</span><small>{campaign.status || campaign.effective_status || "--"}</small></button>; })}</div></div>
                <div className="meta-hierarchy-column"><div className="meta-hierarchy-head"><strong>Ad Sets</strong><span>{adSets.length}</span></div><div className="meta-hierarchy-list">{adSetsLoading ? <div className="meta-empty-inline">Loading ad sets...</div> : adSets.map((adSet, index) => <button key={buildListKey("adset", adSet.id, adSet.name, index)} type="button" className={`meta-hierarchy-item ${selectedAdSetId === adSet.id ? "active" : ""}`} onClick={() => setSelectedAdSetId(adSet.id)}><strong>{adSet.name || "Ad Set"}</strong><span>{adSet.optimization_goal || "--"}</span><small>{adSet.status || adSet.effective_status || "--"}</small></button>)}</div></div>
                <div className="meta-hierarchy-column"><div className="meta-hierarchy-head"><strong>Ads</strong><span>{ads.length}</span></div><div className="meta-hierarchy-list">{adsLoading ? <div className="meta-empty-inline">Loading ads...</div> : ads.map((ad, index) => <div key={buildListKey("ad", ad.id, ad.name, index)} className="meta-hierarchy-item static"><strong>{ad.name || "Ad"}</strong><span>{ad.creative?.name || ad.creativeId || "Creative linked"}</span><small>{ad.status || ad.effective_status || "--"}</small></div>)}</div></div>
              </div>
            </article>

            <div className="meta-grid meta-grid-settings">
              <article className="meta-card"><div className="meta-card-head"><div><h3>Drafts</h3><p>Wizard-based creation flow.</p></div></div><div className="meta-analytics-list">{draftCampaigns.length === 0 ? <div className="meta-empty-inline">No drafts yet.</div> : draftCampaigns.map((campaign, index) => <div key={buildListKey("draft", campaign._id, campaign.campaignName, index)} className="meta-analytics-item"><div><strong>{campaign.campaignName}</strong><span>Step {campaign?.wizard?.currentStep || 1}</span></div><button type="button" className="meta-button meta-button-secondary small" onClick={() => openDraftWizard(campaign)}>Continue</button></div>)}</div></article>
              <article className="meta-card"><div className="meta-card-head"><div><h3>Published Campaigns</h3><p>Sync and control existing campaigns.</p></div><button type="button" className="meta-button meta-button-secondary" disabled={syncingAll} onClick={handleSyncAll}>{syncingAll ? <RefreshCw className="spin" size={16} /> : "Sync All"}</button></div><div className="meta-analytics-list">{liveCampaigns.length === 0 ? <div className="meta-empty-inline">No published campaigns yet.</div> : liveCampaigns.map((campaign, index) => { const isActive = String(campaign.status).toUpperCase() === "ACTIVE"; const isBusy = syncingId === campaign._id || statusUpdatingId === campaign._id; return <div key={buildListKey("live", campaign._id, campaign.campaignName, index)} className="meta-analytics-item"><div><strong>{campaign.campaignName}</strong><span>{formatDate(campaign.createdAt)}</span></div><div className="meta-inline-actions"><button type="button" className="meta-button meta-button-secondary small" disabled={isBusy} onClick={() => handleSyncCampaign(campaign._id)}>{syncingId === campaign._id ? <RefreshCw className="spin" size={14} /> : "Sync"}</button><button type="button" className="meta-button meta-button-secondary small" disabled={isBusy} onClick={() => handleStatusUpdate(campaign._id, isActive ? "PAUSED" : "ACTIVE")}>{statusUpdatingId === campaign._id ? <RefreshCw className="spin" size={14} /> : isActive ? "Pause" : "Activate"}</button></div></div>; })}</div></article>
            </div>
          </div> : null}

          {!loading && activeSection === "analytics" ? <div className="meta-grid meta-grid-stats">
            <article className="meta-card meta-stat-card"><span>Total impressions</span><strong>{overview?.summary?.totalImpressions || 0}</strong></article>
            <article className="meta-card meta-stat-card"><span>Average CTR</span><strong>{overview?.summary?.averageCtr || 0}%</strong></article>
            <article className="meta-card meta-stat-card"><span>Total leads</span><strong>{overview?.summary?.totalLeads || 0}</strong></article>
            <article className="meta-card meta-stat-card"><span>Average CPL</span><strong>{formatCurrency(overview?.summary?.averageCpl || 0)}</strong></article>
          </div> : null}

          {!loading && activeSection === "settings" ? <div className="meta-grid meta-grid-settings">
            <article className="meta-card"><div className="meta-card-head"><div><h3>Connection</h3><p>Use env token now and keep the API ready for Facebook Login later.</p></div><button type="button" className="meta-button meta-button-facebook" disabled={connectingFacebook} onClick={handleConnect}><Facebook size={16} /><span>{connectingFacebook ? "Connecting..." : "Connect Facebook"}</span></button></div><div className="meta-settings-grid"><label><span>Ad Account</span><select value={form.adAccountId} onChange={(event) => updateField("adAccountId", event.target.value)}><option value="">Choose ad account</option>{adAccounts.map((account, index) => <option key={buildListKey("account", account.id, account.name, index)} value={account.id}>{account.name || account.id}</option>)}</select></label><label><span>Facebook Page</span><select value={form.configuredPageId || effectiveConfiguredPageId} onChange={(event) => updateField("configuredPageId", event.target.value)}><option value="">Choose page</option>{resolvedPages.map((page, index) => <option key={buildListKey("page", page.id, page.name, index)} value={page.id}>{page.name}</option>)}</select></label><label><span>WhatsApp Number</span><input type="text" value={form.whatsappNumber} onChange={(event) => updateField("whatsappNumber", event.target.value)} placeholder="+91 98765 43210" /></label><div className="meta-settings-actions"><button type="button" className="meta-button meta-button-primary" disabled={savingSetup} onClick={handleSaveSettings}>{savingSetup ? <RefreshCw className="spin" size={16} /> : "Save Settings"}</button></div></div></article>
            <article className="meta-card"><div className="meta-card-head"><div><h3>Wallet & Diagnostics</h3><p>Backend token health and credits.</p></div><button type="button" className="meta-button meta-button-secondary" disabled={diagnosticsLoading} onClick={handleRunDiagnostics}>{diagnosticsLoading ? <RefreshCw className="spin" size={16} /> : "Run Diagnostics"}</button></div><div className="meta-wallet-row"><div><span>Available credit</span><strong>{formatCurrency(wallet.balance || 0)}</strong></div><div className="meta-wallet-input"><input type="number" min="100" step="100" value={topUpAmount} onChange={(event) => setTopUpAmount(Number(event.target.value || 0))} /><button type="button" className="meta-button meta-button-secondary" disabled={walletSubmitting} onClick={handleWalletTopUp}>{walletSubmitting ? <RefreshCw className="spin" size={16} /> : "Add Credit"}</button></div></div><div className="meta-diagnostics-grid"><div><span>Access token</span><strong>{diagnostics?.env?.hasAccessToken ? "Present" : "Unknown"}</strong></div><div><span>Ad account ID</span><strong>{diagnostics?.env?.hasAdAccountId ? "Present" : "Unknown"}</strong></div><div><span>Page ID</span><strong>{diagnostics?.env?.hasPageId ? "Present" : "Unknown"}</strong></div><div><span>Auth source</span><strong>{diagnostics?.env?.authSource || setup.authSource || "env"}</strong></div></div></article>
          </div> : null}
        </main>
      </section>

      {wizardOpen ? <div className="meta-wizard-backdrop"><div className="meta-wizard-panel"><div className="meta-wizard-head"><div><span className="meta-eyebrow">Campaign Builder</span><h2>Create campaign</h2><p>Step-by-step Campaign -&gt; Ad Set -&gt; Ad flow.</p></div><button type="button" className="meta-close-button" onClick={closeWizard}>Close</button></div><div className="meta-progress-shell"><div className="meta-progress-bar"><span style={{ width: `${progressPercent}%` }} /></div><div className="meta-progress-steps">{wizardSteps.map((step, index) => <div key={buildListKey("wizard-step", step.key, index)} className={`meta-progress-step ${wizardStep >= step.key ? "active" : ""}`}><span>{step.key}</span><strong>{step.label}</strong></div>)}</div></div><div className="meta-wizard-body">{wizardStep === 3 && step3MissingFields.length ? <div className="meta-wizard-inline-error"><strong>Complete Ad Step</strong><span>{step3MissingFields.join(", ")}</span></div> : null}{wizardStep === 4 && reviewMissingFields.length ? <div className="meta-wizard-inline-error"><strong>Missing Before Publish</strong><span>{reviewMissingFields.join(", ")}</span></div> : null}{wizardStep === 1 ? <div className="meta-form-grid"><label className="full"><span>Campaign Name</span><input type="text" value={form.campaignName} onChange={(event) => updateField("campaignName", event.target.value)} placeholder="Summer lead generation campaign" /></label><label><span>Objective</span><select value={form.objective} onChange={(event) => updateField("objective", event.target.value)}>{objectiveOptions.map((option, index) => <option key={buildListKey("objective", option.value, index)} value={option.value}>{option.label}</option>)}</select></label><label><span>Ad Account</span><select value={form.adAccountId} onChange={(event) => updateField("adAccountId", event.target.value)}><option value="">Choose ad account</option>{adAccounts.map((account, index) => <option key={buildListKey("account", account.id, account.name, index)} value={account.id}>{account.name || account.id}</option>)}</select></label><label><span>Buying Type</span><select value={form.campaignConfig.buyingType} onChange={(event) => updateCampaignConfig("buyingType", event.target.value)}><option value="AUCTION">Auction</option><option value="RESERVED">Reserved</option></select></label><label><span>Initial Status</span><select value={form.campaignConfig.initialStatus} onChange={(event) => updateCampaignConfig("initialStatus", event.target.value)}><option value="PAUSED">Paused</option><option value="ACTIVE">Active</option></select></label><label><span>Special Ad Category</span><select value={form.campaignConfig.specialAdCategories[0] || ""} onChange={(event) => updateCampaignConfig("specialAdCategories", event.target.value ? [event.target.value] : [])}><option value="">None</option><option value="HOUSING">Housing</option><option value="EMPLOYMENT">Employment</option><option value="CREDIT">Credit</option><option value="ISSUES_ELECTIONS_POLITICS">Issues, Elections or Politics</option></select></label><label><span>Campaign Spending Limit</span><input type="number" min="0" step="100" value={form.campaignConfig.spendingLimit} onChange={(event) => updateCampaignConfig("spendingLimit", Number(event.target.value || 0))} placeholder="0" /></label></div> : null}{wizardStep === 2 ? <div className="meta-form-grid"><label className="full"><span>Ad Set Name</span><input type="text" value={form.adSet.name} onChange={(event) => updateAdSet("name", event.target.value)} placeholder={`${form.campaignName || "Campaign"} - Ad Set`} /></label><label className="full"><span>Country</span><input type="text" value={form.targeting.countries.join(", ")} onChange={(event) => updateTargeting("countries", event.target.value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean))} placeholder="IN" /></label><label><span>Minimum Age</span><input type="number" min="18" max="65" value={form.targeting.ageMin} onChange={(event) => updateTargeting("ageMin", Number(event.target.value))} /></label><label><span>Maximum Age</span><input type="number" min="18" max="65" value={form.targeting.ageMax} onChange={(event) => updateTargeting("ageMax", Number(event.target.value))} /></label><label><span>Gender</span><select value={form.targeting.genders[0] || ""} onChange={(event) => updateTargeting("genders", event.target.value ? [event.target.value] : [])}><option value="">All</option><option value="1">Male</option><option value="2">Female</option></select></label><label><span>Daily Budget</span><input type="number" min="100" step="100" value={form.budget.dailyBudget} onChange={(event) => updateBudget("dailyBudget", Number(event.target.value))} /></label><label><span>Optimization Goal</span><select value={form.adSet.optimizationGoal} onChange={(event) => updateAdSet("optimizationGoal", event.target.value)}><option value="LINK_CLICKS">Link Clicks</option><option value="REACH">Reach</option><option value="IMPRESSIONS">Impressions</option></select></label><label><span>Bid Strategy</span><select value={form.adSet.bidStrategy} onChange={(event) => updateAdSet("bidStrategy", event.target.value)}><option value="LOWEST_COST_WITH_BID_CAP">Lowest Cost With Bid Cap</option><option value="LOWEST_COST_WITHOUT_CAP">Lowest Cost Without Cap</option></select></label><label><span>Start Time</span><input type="datetime-local" value={form.schedule.startTime} onChange={(event) => updateSchedule("startTime", event.target.value)} /></label><label><span>End Time</span><input type="datetime-local" value={form.schedule.endTime} onChange={(event) => updateSchedule("endTime", event.target.value)} /></label><label><span>Platforms</span><select value={form.placement.publisherPlatforms.join(",")} onChange={(event) => updatePlacement("publisherPlatforms", event.target.value ? event.target.value.split(",") : [])}><option value="facebook,instagram">Facebook + Instagram</option><option value="facebook">Facebook Only</option><option value="instagram">Instagram Only</option></select></label><label><span>Facebook Placements</span><input type="text" value={form.placement.facebookPositions.join(", ")} onChange={(event) => updatePlacement("facebookPositions", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="feed, marketplace, video_feeds" /></label><label><span>Instagram Placements</span><input type="text" value={form.placement.instagramPositions.join(", ")} onChange={(event) => updatePlacement("instagramPositions", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder="stream, story, reels" /></label></div> : null}{wizardStep === 3 ? <div className="meta-form-grid meta-form-grid-creative"><div className="meta-upload-card"><span>Ad image</span><label className="meta-upload-box"><Upload size={18} /><strong>{creativeFile ? creativeFile.name : "Upload creative image"}</strong><input type="file" accept="image/*" onChange={(event) => setCreativeFile(event.target.files?.[0] || null)} /></label><label><span>Or paste image URL</span><input type="url" value={form.creative.mediaUrl} onChange={(event) => updateCreative("mediaUrl", event.target.value)} placeholder="https://example.com/ad.jpg" /></label></div><div className="meta-preview-card"><span>Preview</span><div className="meta-preview-media">{previewUrl ? <img src={previewUrl} alt="Ad preview" /> : <Upload size={22} />}</div></div><label><span>Ad Name</span><input type="text" value={form.creative.adName} onChange={(event) => updateCreative("adName", event.target.value)} placeholder={`${form.campaignName || "Campaign"} - Ad`} /></label><label><span>Facebook Page</span><select value={form.configuredPageId || effectiveConfiguredPageId} onChange={(event) => updateField("configuredPageId", event.target.value)}><option value="">Choose page</option>{resolvedPages.map((page, index) => <option key={buildListKey("wizard-page", page.id, page.name, index)} value={page.id}>{page.name}</option>)}</select></label><label><span>Instagram Actor ID</span><input type="text" value={form.configuredInstagramActorId} onChange={(event) => updateField("configuredInstagramActorId", event.target.value)} placeholder="Optional Instagram business actor id" /></label><label className="full"><span>Primary Text</span><textarea rows="4" value={form.creative.primaryText} onChange={(event) => updateCreative("primaryText", event.target.value)} placeholder="Write the main message for your ad..." /></label><label><span>Headline</span><input type="text" value={form.creative.headline} onChange={(event) => updateCreative("headline", event.target.value)} placeholder="High-converting headline" /></label><label><span>Description</span><input type="text" value={form.creative.description} onChange={(event) => updateCreative("description", event.target.value)} placeholder="Short supporting description" /></label><label><span>CTA Button</span><select value={form.creative.callToAction} onChange={(event) => updateCreative("callToAction", event.target.value)}>{ctaOptions.map((option, index) => <option key={buildListKey("cta", option.value, index)} value={option.value}>{option.label}</option>)}</select></label><label><span>Destination URL</span><input type="url" value={form.creative.destinationUrl} onChange={(event) => updateCreative("destinationUrl", event.target.value)} placeholder="https://example.com/landing-page" /></label><label><span>Display Link</span><input type="text" value={form.creative.displayLink} onChange={(event) => updateCreative("displayLink", event.target.value)} placeholder="example.com" /></label></div> : null}{wizardStep === 4 ? <div className="meta-review-grid"><article className="meta-review-card"><h3>Campaign</h3><div><span>Name</span><strong>{form.campaignName || "--"}</strong></div><div><span>Objective</span><strong>{form.objective}</strong></div><div><span>Ad account</span><strong>{form.adAccountId || "--"}</strong></div><div><span>Buying type</span><strong>{form.campaignConfig.buyingType}</strong></div><div><span>Initial status</span><strong>{form.campaignConfig.initialStatus}</strong></div><div><span>Special category</span><strong>{form.campaignConfig.specialAdCategories[0] || "None"}</strong></div><div><span>Spend limit</span><strong>{formatCurrency(form.campaignConfig.spendingLimit || 0)}</strong></div></article><article className="meta-review-card"><h3>Ad Set</h3><div><span>Name</span><strong>{form.adSet.name || "--"}</strong></div><div><span>Country</span><strong>{form.targeting.countries.join(", ") || "--"}</strong></div><div><span>Age</span><strong>{form.targeting.ageMin} - {form.targeting.ageMax}</strong></div><div><span>Gender</span><strong>{form.targeting.genders[0] === "1" ? "Male" : form.targeting.genders[0] === "2" ? "Female" : "All"}</strong></div><div><span>Optimization</span><strong>{form.adSet.optimizationGoal}</strong></div><div><span>Daily budget</span><strong>{formatCurrency(form.budget.dailyBudget)}</strong></div></article><article className="meta-review-card"><h3>Ad</h3><div><span>Ad Name</span><strong>{form.creative.adName || `${form.campaignName || "Campaign"} - Ad`}</strong></div><div><span>Page</span><strong>{resolvedPages.find((page) => page.id === effectiveConfiguredPageId)?.name || effectiveConfiguredPageId || "--"}</strong></div><div><span>Headline</span><strong>{form.creative.headline || form.campaignName || "--"}</strong></div><div><span>CTA</span><strong>{form.creative.callToAction}</strong></div><div><span>Destination</span><strong>{form.creative.destinationUrl || (form.whatsappNumber ? `https://wa.me/${String(form.whatsappNumber).replace(/[^\d]/g, "")}` : "--")}</strong></div><div><span>Primary text</span><strong>{form.creative.primaryText || "--"}</strong></div></article></div> : null}{wizardStep === 4 && reviewMissingFields.length ? <div className="meta-review-missing"><span>Missing fields</span><strong>{reviewMissingFields.join(", ")}</strong></div> : null}</div><div className="meta-wizard-footer"><button type="button" className="meta-button meta-button-secondary" disabled={wizardStep === 1 || wizardSaving || publishing} onClick={() => setWizardStep((current) => Math.max(1, current - 1))}>Back</button><div className="meta-wizard-footer-actions">{wizardStep < 4 ? <button type="button" className="meta-button meta-button-primary" disabled={wizardSaving || (wizardStep === 3 && step3MissingFields.includes("Primary Text"))} onClick={handleWizardNext}>{wizardSaving ? <RefreshCw className="spin" size={16} /> : "Save & Continue"}</button> : <button type="button" className="meta-button meta-button-primary" disabled={publishing || Boolean(publishBlockedReason) || Boolean(reviewMissingFields.length)} onClick={handlePublish} title={reviewMissingFields.length ? `Complete: ${reviewMissingFields.join(", ")}` : publishBlockedReason}>{publishing ? <RefreshCw className="spin" size={16} /> : "Publish Campaign"}</button>}</div></div></div></div> : null}
    </div>
  );
};

export default MetaAdsManager;
