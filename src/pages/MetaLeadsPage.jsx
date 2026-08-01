import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, RefreshCw, Users, ChevronLeft } from "lucide-react";
import { AuthContext } from "./authcontext";
import metaAdsService from "../services/metaAdsService";
import "./MetaLeadsPage.css";

const SAMPLE_LEADS = [
  {
    leadId: "sample-1",
    fullName: "Aarav Sharma",
    phoneNumber: "+91 98765 43210",
    email: "aarav.sharma@example.com",
    phoneVerified: true,
    createdTime: "2026-07-31T09:15:00.000Z",
  },
  {
    leadId: "sample-2",
    fullName: "Priya Mehta",
    phoneNumber: "+91 91234 56789",
    email: "priya.mehta@example.com",
    phoneVerified: false,
    createdTime: "2026-07-31T10:40:00.000Z",
  },
  {
    leadId: "sample-3",
    fullName: "Rahul Verma",
    phoneNumber: "+91 99887 76655",
    email: "rahul.verma@example.com",
    phoneVerified: true,
    createdTime: "2026-07-31T12:05:00.000Z",
  },
  {
    leadId: "sample-4",
    fullName: "Sneha Iyer",
    phoneNumber: "+91 90123 45098",
    email: "sneha.iyer@example.com",
    phoneVerified: true,
    createdTime: "2026-07-31T13:30:00.000Z",
  },
  {
    leadId: "sample-5",
    fullName: "Karan Patel",
    phoneNumber: "+91 90909 80808",
    email: "karan.patel@example.com",
    phoneVerified: false,
    createdTime: "2026-07-31T15:00:00.000Z",
  },
];

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
  const [isSampleData, setIsSampleData] = useState(false);
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
        setLeads(SAMPLE_LEADS);
        setIsSampleData(true);
        setError("Unable to resolve the current user for Meta leads.");
        return;
      }

      const response = await metaAdsService.getMetaLeads(requestParams);
      const receivedLeads = Array.isArray(response?.leads) ? response.leads : [];
      if (receivedLeads.length > 0) {
        setLeads(receivedLeads);
        setIsSampleData(false);
      } else {
        setLeads(SAMPLE_LEADS);
        setIsSampleData(true);
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          requestError.message ||
          "Failed to load leads."
      );
      setLeads(SAMPLE_LEADS);
      setIsSampleData(true);
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
              <strong>{isSampleData ? "Sample data" : "Backend API"}</strong>
            </div>
          </div>

          {isSampleData ? (
            <div className="meta-leads-sample-note">
              Showing 5 dummy leads because no live Meta lead data is currently available.
            </div>
          ) : null}

          {error ? (
            <div className="meta-leads-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="meta-leads-empty">Loading leads...</div>
          ) : leads.length === 0 ? (
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
