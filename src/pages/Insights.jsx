import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, AlertCircle, RefreshCw, BarChart3, Facebook } from 'lucide-react';
import InsightCard from '../components/InsightCard';
import PerformanceChart from '../components/PerformanceChart';
import DemographicsChart from '../components/DemographicsChart';
import { fetchInsightFilters, fetchInsights } from '../services/insightsApi';
import { getMetaOverview } from '../services/metaAdsApi';
import './Insights.css';

const numberFormatter = new Intl.NumberFormat('en-IN');
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const InsightSkeleton = () => (
  <div className="insights-page">
    <div className="insights-topbar skeleton-block" />
    <div className="insights-workspace">
      <div className="insights-sidebar insight-skeleton-panel" />
      <div className="insights-main">
        <div className="insights-metrics-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="insight-card insight-skeleton-card">
              <div className="skeleton-line short" />
              <div className="skeleton-line long" />
              <div className="skeleton-line medium" />
            </div>
          ))}
        </div>
        <div className="insights-stack">
          <div className="insights-panel insight-skeleton-panel" />
          <div className="insights-panel insight-skeleton-panel" />
        </div>
      </div>
    </div>
  </div>
);

const Insights = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ campaigns: [] });
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedAdSet, setSelectedAdSet] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [granularity, setGranularity] = useState('day');
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metaSetupReady, setMetaSetupReady] = useState(true);
  const [metaSetupLoading, setMetaSetupLoading] = useState(true);
  const [metaSetupMessage, setMetaSetupMessage] = useState('');

  const adSetOptions = useMemo(() => {
    const selected = filters.campaigns.find((campaign) => campaign.id === selectedCampaign);
    return selected?.adSets || [{ id: 'all', name: 'All Ad Sets' }];
  }, [filters.campaigns, selectedCampaign]);

  const campaignList = useMemo(
    () => (filters.campaigns || []).filter((campaign) => campaign.id !== 'all'),
    [filters.campaigns]
  );

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      try {
        const response = await fetchInsightFilters();
        if (!isMounted) return;
        setFilters(response);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.response?.data?.message || 'Unable to load insight filters.');
      }
    };

    loadFilters();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMetaSetup = async () => {
      setMetaSetupLoading(true);
      try {
        const response = await getMetaOverview();
        if (!isMounted) return;
        const setup = response?.setup || {};
        const isReady = Boolean(setup.connected && setup.adAccountId && setup.pageId);
        setMetaSetupReady(isReady);
        setMetaSetupMessage(
          setup.setupError || 'Connect Meta, select an ad account and Facebook page to continue.'
        );
      } catch (loadError) {
        if (!isMounted) return;
        setMetaSetupReady(false);
        setMetaSetupMessage(
          loadError?.response?.data?.error ||
          loadError?.response?.data?.message ||
          'Connect Meta to unlock Insights.'
        );
      } finally {
        if (isMounted) {
          setMetaSetupLoading(false);
        }
      }
    };

    loadMetaSetup();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedAdSet('all');
  }, [selectedCampaign]);

  useEffect(() => {
    let isMounted = true;

    const loadInsights = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetchInsights({
          range: dateRange,
          campaignId: selectedCampaign,
          adSetId: selectedAdSet
        });

        if (!isMounted) return;
        setInsights(response);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError?.response?.data?.message || 'Unable to load insights right now.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInsights();
    return () => {
      isMounted = false;
    };
  }, [dateRange, selectedCampaign, selectedAdSet]);

  if (loading && !insights) {
    return <InsightSkeleton />;
  }

  const summary = insights?.summary || {
    reach: 0,
    impressions: 0,
    spend: 0,
    ctr: 0
  };
  const selectedCampaignItem = campaignList.find((campaign) => campaign.id === selectedCampaign);

  return (
    <div className="meta-access-shell">
    <div className={`insights-page ${!metaSetupLoading && !metaSetupReady ? 'meta-access-blurred' : ''}`}>
      <div className="insights-topbar">
        <div className="insights-title-wrap">
          <div className="insights-page-icon">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1>Insights</h1>
            <p>Monitor campaign delivery, spend efficiency, and audience reach.</p>
          </div>
        </div>

        <div className="insights-filters">
          <label className="insights-filter control-date">
            <span>
              <CalendarRange size={16} />
              Date Range
            </span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </label>

          <label className="insights-filter">
            <span>Ad Set</span>
            <select value={selectedAdSet} onChange={(event) => setSelectedAdSet(event.target.value)}>
              {adSetOptions.map((adSet) => (
                <option key={adSet.id} value={adSet.id}>
                  {adSet.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className="insights-error">
          <div className="insights-error-copy">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <div className="insights-inline-loading">Refreshing insights...</div> : null}

      <div className="insights-workspace">
        <aside className="insights-sidebar">
          <div className="insights-panel insights-campaign-list-panel">
            <div className="insights-panel-header">
              <div>
                <h2>Campaign List</h2>
                <p>Select a campaign to update the charts on the right.</p>
              </div>
              <span className="insights-list-count">
                {campaignList.length} Campaign{campaignList.length === 1 ? '' : 's'}
              </span>
            </div>

            {campaignList.length === 0 ? (
              <div className="insights-empty-list">No campaigns available for insights yet.</div>
            ) : (
              <div className="insights-campaign-list insights-campaign-list-sidebar">
                {campaignList.map((campaign) => {
                  const isSelected = campaign.id === selectedCampaign;
                  const adSetCount = Math.max(0, (campaign.adSets || []).filter((adSet) => adSet.id !== 'all').length);

                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      className={`insights-campaign-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedCampaign(campaign.id)}
                    >
                      <div className="insights-campaign-copy">
                        <strong>{campaign.name}</strong>
                        <span>{campaign.id}</span>
                      </div>
                      <div className="insights-campaign-meta">
                        <span>{adSetCount} Ad Set{adSetCount === 1 ? '' : 's'}</span>
                        {isSelected ? <em>Selected</em> : <em>View Insights</em>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="insights-main">
          {selectedCampaignItem ? (
            <div className="insights-selection-banner">
              <strong>{selectedCampaignItem.name}</strong>
              <span>{selectedCampaignItem.id}</span>
            </div>
          ) : null}

          <div className="insights-metrics-grid">
            <InsightCard
              label="Reach"
              value={numberFormatter.format(summary.reach || 0)}
              helper="Unique accounts reached"
            />
            <InsightCard
              label="Impressions"
              value={numberFormatter.format(summary.impressions || 0)}
              accent="indigo"
              helper="Total ad views served"
            />
            <InsightCard
              label="Amount Spent"
              value={currencyFormatter.format(summary.spend || 0)}
              accent="teal"
              helper="Total spend in selected range"
            />
            <InsightCard
              label="CTR"
              value={`${summary.ctr || 0}%`}
              accent="violet"
              helper="Click-through rate"
            />
          </div>

          <div className="insights-stack">
            <PerformanceChart
              data={insights?.timeseries || []}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <DemographicsChart data={insights?.demographics || []} />
          </div>
        </section>
      </div>
    </div>
    {!metaSetupLoading && !metaSetupReady ? (
      <div className="meta-access-overlay">
        <div className="meta-access-card">
          <div className="meta-access-icon">
            <Facebook size={24} />
          </div>
          <h2>Connect Meta to unlock Insights</h2>
          <p>{metaSetupMessage}</p>
          <button type="button" onClick={() => navigate('/meta-connect')}>
            <Facebook size={18} />
            Connect Meta
          </button>
        </div>
      </div>
    ) : null}
    </div>
  );
};

export default Insights;
