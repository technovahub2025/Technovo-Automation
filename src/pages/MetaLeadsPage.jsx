import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, RefreshCw, Users, ChevronLeft } from "lucide-react";
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

const MetaLeadsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const requestParams = useMemo(() => {
    const search = new URLSearchParams(location.search || "");
    const params = {
      adminId: String(search.get("adminId") || "").trim(),
      formId: String(search.get("formId") || search.get("form_id") || "").trim(),
      pageAccessToken: String(search.get("pageAccessToken") || search.get("access_token") || "").trim()
    };

    return Object.fromEntries(Object.entries(params).filter(([, value]) => Boolean(value)));
  }, [location.search]);

  const loadLeads = async ({ silent = false } = {}) => {
    try {
      setError("");
      if (silent) setRefreshing(true);
      else setLoading(true);

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
  }, [location.search]);

  const leadCount = leads.length;

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
              <span>Total leads</span>
              <strong>{leadCount}</strong>
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
          ) : leadCount === 0 ? (
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
                  {leads.map((lead, index) => {
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
