import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, RefreshCw, Users, ChevronLeft } from "lucide-react";
import { AuthContext } from "./authcontext";
import metaAdsService from "../services/metaAdsService";
import "./MetaLeadsPage.css";

const getCampaignId = (campaign) => String(
  campaign?.campaignId || campaign?.meta?.campaignId || campaign?.metaCampaignId || campaign?.id || ""
).trim();

const getCampaignName = (campaign) => String(
  campaign?.campaignName || campaign?.name || ""
).trim();

const formatLeadCreatedTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const formatBooleanLabel = (value) => (value ? "Yes" : "No");

const MetaLeadsPage = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const requestParams = useMemo(() => {
    const search = new URLSearchParams(location.search || "");
    const storedUser = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "null");
      } catch {
        return null;
      }
    })();

    const resolvedUserId = String(
      search.get("userId") ||
      search.get("adminId") ||
      user?.id ||
      user?._id ||
      user?.userId ||
      storedUser?.id ||
      storedUser?._id ||
      localStorage.getItem("userId") ||
      ""
    ).trim();

    const resolvedFormId = String(
      search.get("formId") ||
      search.get("form_id") ||
      user?.metaLeadFormId ||
      user?.metaleadformid ||
      storedUser?.metaLeadFormId ||
      storedUser?.metaleadformid ||
      ""
    ).trim();

    const params = {
      userId: resolvedUserId,
      formId: resolvedFormId
    };

    return Object.fromEntries(Object.entries(params).filter(([, value]) => Boolean(value)));
  }, [location.search, user]);

  const loadLeads = async ({ silent = false } = {}) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

      if (!requestParams.userId) {
        setLeads([]);
        setCampaigns([]);
        setSelectedCampaignId("");
        setError("Unable to resolve the current user for Meta leads.");
        return;
      }

      const response = await metaAdsService.getMetaLeads(requestParams);
      const receivedLeads = Array.isArray(response?.leads) ? response.leads : [];
      setLeads(receivedLeads);
      const campaignsWithLeads = Array.isArray(response?.campaigns) ? response.campaigns : [];
      const campaignNames = new Map(campaignsWithLeads.map((campaign) => [
        getCampaignId(campaign), getCampaignName(campaign)
      ]));
      const mergedCampaigns = new Map();
      receivedLeads.forEach((lead) => {
        const id = String(lead?.campaignId || lead?.campaign_id || "").trim();
        if (!id) return;
        const name = String(lead?.campaignName || lead?.campaign_name || campaignNames.get(id) || "").trim();
        const campaign = mergedCampaigns.get(id);
        if (campaign) {
          campaign.leadCount += 1;
          if (name) campaign.campaignName = name;
        } else {
          mergedCampaigns.set(id, { campaignId: id, campaignName: name || `Campaign ${id}`, leadCount: 1 });
        }
      });
      setCampaigns(Array.from(mergedCampaigns.values()).sort((left, right) =>
        left.campaignName.localeCompare(right.campaignName)
      ));
      setSelectedCampaignId((current) => mergedCampaigns.has(current) ? current : "");
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to load leads."
      );
      setLeads([]);
      setCampaigns([]);
      setSelectedCampaignId("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestParams.userId, requestParams.formId]);

  const leadCount = leads.length;
  const visibleLeads = selectedCampaignId
    ? leads.filter((lead) => String(lead?.campaignId || lead?.campaign_id || "").trim() === selectedCampaignId)
    : leads;

  return (
    <div className="meta-leads-page">
      <section className="meta-leads-shell">
        <header className="meta-leads-topbar">
          <div className="meta-leads-topbar__left">
            <button type="button" className="meta-leads-back-btn" onClick={() => navigate(-1)}>
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
            <div>
              <div className="meta-leads-eyebrow">
                <Users size={16} />
                <span>Meta Leads</span>
              </div>
              <h1>Leads</h1>
              <p>View lead submissions from your Meta lead generation campaigns.</p>
            </div>
          </div>

          <div className="meta-leads-topbar__right">
            <div className="meta-leads-count">
              <span>Total leads</span>
              <strong>{visibleLeads.length}</strong>
              <small>{selectedCampaignId ? `${visibleLeads.length} for selected campaign` : `${leadCount} total`}</small>
            </div>
            <button
              type="button"
              className="meta-leads-refresh-btn"
              onClick={() => loadLeads({ silent: true })}
              disabled={loading || refreshing}
            >
              {loading || refreshing ? <RefreshCw className="spin" size={16} /> : <RefreshCw size={16} />}
              <span>{loading || refreshing ? "Refreshing..." : "Refresh Leads"}</span>
            </button>
          </div>
        </header>

        <article className="meta-leads-card">
          <div className="meta-leads-card__head">
            <div>
              <h2>Lead Data</h2>
              <p>Choose a campaign to view its lead submissions.</p>
            </div>
            <label className="meta-leads-campaign-filter">
              <span>Campaign</span>
              <select value={selectedCampaignId} onChange={(event) => setSelectedCampaignId(event.target.value)}>
                <option value="">All leads</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.campaignName} ({campaign.leadCount} {campaign.leadCount === 1 ? "lead" : "leads"})
                  </option>
                ))}
              </select>
            </label>
            <div className="meta-leads-card__meta">
              <span>Source</span>
              <strong>Backend API</strong>
            </div>
          </div>

          {error ? (
            <div className="meta-leads-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="meta-leads-empty">Loading leads...</div>
          ) : visibleLeads.length === 0 ? (
            <div className="meta-leads-empty">No leads found.</div>
          ) : (
            <div className="meta-leads-table-wrap">
              <table className="meta-leads-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th>Email</th>
                    <th>Phone Verified</th>
                    <th>Created Time</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead, index) => {
                    const key = String(lead?.leadId || lead?.id || `${index}`).trim() || `${index}`;
                    return (
                      <tr key={key}>
                        <td>{lead?.fullName || "--"}</td>
                        <td>{lead?.phoneNumber || "--"}</td>
                        <td>{lead?.email || "--"}</td>
                        <td>{formatBooleanLabel(lead?.phoneVerified)}</td>
                        <td>{formatLeadCreatedTime(lead?.createdTime || lead?.created_time)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default MetaLeadsPage;
