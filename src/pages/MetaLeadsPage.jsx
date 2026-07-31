import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, RefreshCw, Users, ChevronLeft } from "lucide-react";
import { AuthContext } from "./authcontext";
import metaAdsService from "../services/metaAdsService";
import "./MetaLeadsPage.css";

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
const normalizeCampaignLabel = (value) => String(value || "").trim();

const MetaLeadsPage = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCampaignName, setSelectedCampaignName] = useState("");

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
        setError("Unable to resolve the current user for Meta leads.");
        return;
      }

      const response = await metaAdsService.getMetaLeads(requestParams);
      setLeads(Array.isArray(response?.leads) ? response.leads : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to load leads."
      );
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestParams.userId, requestParams.formId]);

  const campaignOptions = useMemo(() => {
    const campaigns = new Map();
    leads.forEach((lead) => {
      const campaignName = normalizeCampaignLabel(lead?.campaign_name || lead?.campaignName);
      if (!campaignName) return;
      const key = campaignName.toLowerCase();
      if (!campaigns.has(key)) {
        campaigns.set(key, campaignName);
      }
    });
    return Array.from(campaigns.values()).sort((left, right) => left.localeCompare(right));
  }, [leads]);

  const visibleLeads = useMemo(() => {
    if (!selectedCampaignName) return leads;
    return leads.filter((lead) => {
      const campaignName = normalizeCampaignLabel(lead?.campaign_name || lead?.campaignName);
      return campaignName === selectedCampaignName;
    });
  }, [leads, selectedCampaignName]);

  const leadCount = visibleLeads.length;

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
              <p>Latest lead submissions fetched from Meta through the backend.</p>
            </div>
          </div>

          <div className="meta-leads-topbar__right">
            <div className="meta-leads-count">
              <span>Visible leads</span>
              <strong>{leadCount}</strong>
              <small>{leads.length ? `${leads.length} total` : "No results"}</small>
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
              <p>Columns are mapped from the Meta Graph API response returned by your backend.</p>
            </div>
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
                        <td>{lead?.campaign_name || lead?.campaignName || "--"}</td>
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
