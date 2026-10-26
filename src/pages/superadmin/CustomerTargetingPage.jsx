import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Target } from 'lucide-react';
import apiService from '../../services/api';
import './CustomerTargetingPage.css';

const formatDate = (value, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
};

const humanize = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const splitNames = (value) => String(value || '').split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
const readableError = (error) => error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unable to load customer targeting.';

const TargetingValues = ({ title, entries = [] }) => (
  <section className="customer-targeting__detail-section">
    <h3>{title}</h3>
    {entries.length ? (
      <ul className="customer-targeting__chips">
        {entries.map((entry, index) => {
          const name = typeof entry === 'string' ? entry : entry?.name;
          const metaId = typeof entry === 'object' ? entry?.metaId || entry?.id : '';
          if (!name) return null;
          return <li key={`${name}-${metaId}-${index}`} title={metaId ? `Meta ID: ${metaId}` : undefined}>
            <span>{name}</span>{metaId ? <small>ID {metaId}</small> : null}
          </li>;
        })}
      </ul>
    ) : <p className="customer-targeting__muted">None selected</p>}
  </section>
);

const CustomerTargetingPage = () => {
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getTargetingCustomers();
      setCustomers(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (loadError) {
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) return customers;
    return customers.filter((customer) =>
      `${customer.name || ''} ${customer.email || ''}`.toLowerCase().includes(search)
    );
  }, [customerSearch, customers]);

  const openCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setSelectedCampaign(null);
    setCampaignDetails(null);
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getTargetingCustomerCampaigns(customer.id);
      setSelectedCustomer(response?.data?.customer || customer);
      setCampaigns(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (loadError) {
      setCampaigns([]);
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  };

  const openCampaign = async (campaign) => {
    if (!selectedCustomer) return;
    setSelectedCampaign(campaign);
    setCampaignDetails(null);
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getCampaignTargetingDetails(selectedCustomer.id, campaign.id);
      setCampaignDetails(response?.data?.data || null);
    } catch (loadError) {
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  };

  const backToCustomers = () => {
    setSelectedCustomer(null);
    setCampaigns([]);
    setSelectedCampaign(null);
    setCampaignDetails(null);
    setError('');
  };

  const backToCampaigns = () => {
    setSelectedCampaign(null);
    setCampaignDetails(null);
    setError('');
  };

  const snapshot = campaignDetails?.targetingSnapshot;
  const interests = snapshot?.interests?.length
    ? snapshot.interests
    : Array.isArray(snapshot?.selectedInterests) ? snapshot.selectedInterests : splitNames(campaignDetails?.interests);
  const behaviors = snapshot?.behaviors?.length
    ? snapshot.behaviors
    : Array.isArray(snapshot?.selectedBehaviors) ? snapshot.selectedBehaviors : splitNames(campaignDetails?.behaviors);
  const locations = Array.isArray(snapshot?.locations) ? snapshot.locations : splitNames(campaignDetails?.targeting);
  const hasTargetingData = Boolean(snapshot
    ? interests.length || behaviors.length || locations.length || snapshot.ageMin != null || snapshot.ageMax != null || snapshot.gender
    : interests.length || behaviors.length || locations.length);

  return (
    <div className="superadmin-shell customer-targeting">
      <header className="superadmin-header">
        <div className="superadmin-hero superadmin-hero--page">
          <div className="superadmin-hero__heading">
            <div>
              <div className="customer-targeting__breadcrumbs">
                <span>Customer Targeting</span>
                {selectedCustomer ? <><span aria-hidden="true">›</span><span>{selectedCustomer.name}</span></> : null}
                {selectedCampaign ? <><span aria-hidden="true">›</span><span>{selectedCampaign.name}</span></> : null}
              </div>
              <h1 className="nx-title">{selectedCampaign ? 'Targeting Details' : selectedCustomer ? 'Customer Campaigns' : 'Customer Targeting'}</h1>
              <p className="superadmin-subtitle">
                {selectedCampaign
                  ? 'Audience settings saved for this campaign.'
                  : selectedCustomer
                    ? 'Choose a campaign to review its saved audience settings.'
                    : 'Review campaign audiences for each customer.'}
              </p>
            </div>
            <div className="customer-targeting__hero-icon"><Target size={22} /><span>Super Admin only</span></div>
          </div>
        </div>
      </header>

      {error ? <div className="customer-targeting__alert" role="alert">{error}</div> : null}
      {loading ? <section className="superadmin-panel superadmin-panel--page customer-targeting__state" aria-live="polite">Loading customer targeting…</section> : null}

      {!loading && !selectedCustomer ? (
        <section className="superadmin-panel superadmin-panel--page">
          <div className="customer-targeting__toolbar">
            <div><h2>Customers</h2><p>Select a customer to see their campaigns.</p></div>
            <label className="customer-targeting__search"><Search size={17} /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer..." /></label>
          </div>
          {customers.length === 0 && !error ? <div className="customer-targeting__empty">No customers found.</div> : null}
          {customers.length > 0 && filteredCustomers.length === 0 ? <div className="customer-targeting__empty">No customers match your search.</div> : null}
          {filteredCustomers.length > 0 ? <div className="customer-targeting__table-wrap"><table className="customer-targeting__table">
            <thead><tr><th>Customer Name</th><th>Email</th><th>Campaigns</th><th>Last Activity</th><th>Action</th></tr></thead>
            <tbody>{filteredCustomers.map((customer) => <tr key={customer.id}>
              <td data-label="Customer Name">{customer.name}</td><td data-label="Email">{customer.email || '—'}</td>
              <td data-label="Campaigns">{Number(customer.campaignCount || 0)}</td><td data-label="Last Activity">{formatDate(customer.lastActivityAt)}</td>
              <td data-label="Action"><button type="button" className="primary-btn customer-targeting__button" onClick={() => openCustomer(customer)}>View</button></td>
            </tr>)}</tbody>
          </table></div> : null}
        </section>
      ) : null}

      {!loading && selectedCustomer && !selectedCampaign ? (
        <section className="superadmin-panel superadmin-panel--page">
          <div className="customer-targeting__toolbar customer-targeting__toolbar--customer">
            <div><button type="button" className="btn-link superadmin-back-link" onClick={backToCustomers}><ArrowLeft size={15} /> Back to Customers</button>
              <h2>{selectedCustomer.name}</h2><p>{selectedCustomer.email || 'Email unavailable'}</p></div>
            <span className="customer-targeting__count">{campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}</span>
          </div>
          {campaigns.length === 0 && !error ? <div className="customer-targeting__empty">This customer has no campaigns.</div> : null}
          {campaigns.length > 0 ? <div className="customer-targeting__table-wrap"><table className="customer-targeting__table">
            <thead><tr><th>Campaign Name</th><th>Status</th><th>Created Date</th><th>Action</th></tr></thead>
            <tbody>{campaigns.map((campaign) => <tr key={campaign.id}>
              <td data-label="Campaign Name">{campaign.name}</td><td data-label="Status"><span className="customer-targeting__status">{humanize(campaign.status)}</span></td>
              <td data-label="Created Date">{formatDate(campaign.createdAt)}</td>
              <td data-label="Action"><button type="button" className="primary-btn customer-targeting__button" onClick={() => openCampaign(campaign)}>View</button></td>
            </tr>)}</tbody>
          </table></div> : null}
        </section>
      ) : null}

      {!loading && selectedCustomer && selectedCampaign && campaignDetails ? (
        <section className="superadmin-panel superadmin-panel--page customer-targeting__details">
          <button type="button" className="btn-link superadmin-back-link" onClick={backToCampaigns}><ArrowLeft size={15} /> Back to Campaigns</button>
          <div className="customer-targeting__campaign-heading"><div><span className="superadmin-dashboard-card__label">Campaign</span><h2>{campaignDetails.name}</h2></div><span className="customer-targeting__status">{humanize(campaignDetails.status)}</span></div>
          <div className="customer-targeting__meta-grid">
            <div><span>Customer</span><strong>{selectedCustomer.name}</strong></div>
            <div><span>Email</span><strong>{selectedCustomer.email || '—'}</strong></div>
            <div><span>Created</span><strong>{formatDate(campaignDetails.createdAt, true)}</strong></div>
          </div>
          {!hasTargetingData ? <div className="customer-targeting__empty">No targeting data available for this campaign.</div> : <div className="customer-targeting__detail-grid">
            <TargetingValues title="Interests" entries={interests} />
            <TargetingValues title="Behaviours" entries={behaviors} />
            <TargetingValues title="Locations" entries={locations} />
            <section className="customer-targeting__detail-section"><h3>Demographics</h3><dl>
              <div><dt>Age minimum</dt><dd>{snapshot?.ageMin ?? campaignDetails.ageMin ?? '—'}</dd></div>
              <div><dt>Age maximum</dt><dd>{snapshot?.ageMax ?? campaignDetails.ageMax ?? '—'}</dd></div>
              <div><dt>Gender</dt><dd>{humanize(snapshot?.gender || campaignDetails.gender || '—')}</dd></div>
            </dl></section>
          </div>}
        </section>
      ) : null}

      {!loading && selectedCustomer && selectedCampaign && !campaignDetails && error ? (
        <section className="superadmin-panel superadmin-panel--page customer-targeting__state">
          <button type="button" className="btn-link superadmin-back-link" onClick={backToCampaigns}><ArrowLeft size={15} /> Back to Campaigns</button>
          <p>Campaign targeting details could not be loaded.</p>
        </section>
      ) : null}
    </div>
  );
};

export default CustomerTargetingPage;
