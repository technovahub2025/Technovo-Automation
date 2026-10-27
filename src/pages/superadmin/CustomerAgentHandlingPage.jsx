import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, KeyRound, Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import apiService from '../../services/api';
import './CustomerAgentHandlingPage.css';

const dateLabel = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};
const errorText = (error) => error?.response?.data?.message || error?.response?.data?.error || 'Unable to complete this request.';

export default function CustomerAgentHandlingPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadCustomers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiService.getCustomerAgentCustomers();
      setCustomers(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? customers.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query)) : customers;
  }, [customers, search]);

  const openCustomer = async (item) => {
    setCustomer(item); setAgent(null); setTemporaryPassword(''); setError(''); setLoading(true);
    try {
      const response = await apiService.getCustomerAgentCustomer(item.id);
      setCustomer(response?.data?.customer || item);
      setAgents(Array.isArray(response?.data?.agents) ? response.data.agents : []);
    } catch (err) { setAgents([]); setError(errorText(err)); }
    finally { setLoading(false); }
  };

  const openAgent = async (item) => {
    setAgent(item); setTemporaryPassword(''); setError(''); setLoading(true);
    try {
      const response = await apiService.getCustomerAgentDetails(customer.id, item.id);
      setAgent(response?.data?.agent || item);
    } catch (err) { setAgent(null); setError(errorText(err)); }
    finally { setLoading(false); }
  };

  const resetPassword = async (target) => {
    setResetTarget(target); setTemporaryPassword(''); setCopied(false); setError('');
    try {
      const response = target.type === 'agent'
        ? await apiService.resetCustomerAgentPassword(customer.id, target.id)
        : await apiService.resetCustomerPassword(target.id);
      setTemporaryPassword(response?.data?.temporaryPassword || '');
      if (!response?.data?.temporaryPassword) setError('Password was reset, but no temporary password was returned.');
      else {
        if (target.type === 'agent') setAgent((current) => current ? { ...current, passwordChangedAt: new Date().toISOString() } : current);
        else setCustomer((current) => current ? { ...current, passwordChangedAt: new Date().toISOString() } : current);
      }
    } catch (err) { setError(errorText(err)); }
  };

  const backToCustomers = () => { setCustomer(null); setAgent(null); setTemporaryPassword(''); setError(''); };
  const backToCustomer = () => { setAgent(null); setTemporaryPassword(''); setError(''); };
  return <main className="superadmin-shell customer-agent-handling">
    <header className="superadmin-header"><div className="superadmin-hero superadmin-hero--page">
      <div className="superadmin-hero__heading"><div>
        <div className="customer-agent-handling__eyebrow"><UserRoundCog size={16} /> <span>Customer / Agent Handling</span><span className="customer-agent-handling__only"><ShieldCheck size={14} /> Super Admin only</span></div>
        <h1 className="nx-title">Customer / Agent Handling</h1>
        <p className="superadmin-subtitle">Manage customer accounts, assigned agents, and account access.</p>
      </div></div>
    </div></header>
    {error && <div className="customer-agent-handling__alert" role="alert">{error}</div>}
    {loading && <section className="superadmin-panel superadmin-panel--page customer-agent-handling__state">Loading account information…</section>}

    {!customer && !loading && <section className="superadmin-panel superadmin-panel--page">
      <div className="customer-agent-handling__toolbar"><h2>Customers</h2><label className="customer-agent-handling__search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer" /></label></div>
      {!customers.length && <div className="customer-agent-handling__empty">No customers found.</div>}
      {customers.length > 0 && filteredCustomers.length === 0 && <div className="customer-agent-handling__empty">No customers match your search.</div>}
      {filteredCustomers.length > 0 && <div className="customer-agent-handling__table-wrap"><table className="customer-agent-handling__table"><thead><tr><th>Customer Name</th><th>Email</th><th>Agents</th><th>Account Status</th><th>Action</th></tr></thead><tbody>
        {filteredCustomers.map((item) => <tr key={item.id}><td data-label="Customer Name">{item.name}</td><td data-label="Email">{item.email || '—'}</td><td data-label="Agents">{item.agentCount}</td><td data-label="Account Status"><span className={`customer-agent-handling__status ${item.status === 'Inactive' ? 'is-inactive' : ''}`}>{item.status}</span></td><td data-label="Action"><button className="primary-btn customer-agent-handling__button" onClick={() => openCustomer(item)}>View</button></td></tr>)}
      </tbody></table></div>}
    </section>}

    {customer && !loading && !agent && <section className="superadmin-panel superadmin-panel--page">
      <button className="btn-link superadmin-back-link" onClick={backToCustomers}><ArrowLeft size={18}/> Back to Customers</button>
      <div className="customer-agent-handling__detail-heading"><div><span className="superadmin-dashboard-card__label">Customer Details</span><h2>{customer.name}</h2><p>{customer.email}</p></div><span className={`customer-agent-handling__status ${customer.status === 'Inactive' ? 'is-inactive' : ''}`}>{customer.status}</span></div>
      <div className="customer-agent-handling__facts"><div><span>Login Email</span><strong>{customer.email || 'Not available'}</strong></div><div><span>Account Status</span><strong>{customer.status}</strong></div><div><span>Last Password Changed</span><strong>{dateLabel(customer.passwordChangedAt)}</strong></div><div><span>Last Login</span><strong>{dateLabel(customer.lastLoginAt)}</strong></div><div><span>Account Created</span><strong>{dateLabel(customer.createdAt)}</strong></div></div>
      <div className="customer-agent-handling__section-heading"><h3>Agents</h3><span>{agents.length} assigned</span></div>
      {!agents.length && <div className="customer-agent-handling__empty">This customer has no assigned agents.</div>}
      {!!agents.length && <div className="customer-agent-handling__table-wrap"><table className="customer-agent-handling__table"><thead><tr><th>Agent Name</th><th>Email</th><th>Status</th><th>Last Password Change</th><th>Last Login</th><th>Action</th></tr></thead><tbody>{agents.map((item) => <tr key={item.id}><td data-label="Agent Name">{item.name}</td><td data-label="Email">{item.email}</td><td data-label="Status"><span className={`customer-agent-handling__status ${item.status === 'Inactive' ? 'is-inactive' : ''}`}>{item.status}</span></td><td data-label="Last Password Change">{dateLabel(item.passwordChangedAt)}</td><td data-label="Last Login">{dateLabel(item.lastLoginAt)}</td><td data-label="Action"><button className="primary-btn customer-agent-handling__button" onClick={() => openAgent(item)}>View</button></td></tr>)}</tbody></table></div>}
    </section>}

    {agent && !loading && <section className="superadmin-panel superadmin-panel--page">
      <button className="btn-link superadmin-back-link" onClick={backToCustomer}><ArrowLeft size={18}/> Back to Customer</button>
      <div className="customer-agent-handling__detail-heading"><div><span className="superadmin-dashboard-card__label">Agent Details</span><h2>{agent.name}</h2><p>{agent.email}</p></div><span className={`customer-agent-handling__status ${agent.status === 'Inactive' ? 'is-inactive' : ''}`}>{agent.status}</span></div>
      <div className="customer-agent-handling__facts"><div><span>Agent Name</span><strong>{agent.name}</strong></div><div><span>Email</span><strong>{agent.email}</strong></div><div><span>Assigned Customer</span><strong>{customer.name}</strong></div><div><span>Last Login</span><strong>{dateLabel(agent.lastLoginAt)}</strong></div><div><span>Last Password Changed</span><strong>{dateLabel(agent.passwordChangedAt)}</strong></div><div><span>Account Created</span><strong>{dateLabel(agent.createdAt)}</strong></div></div>
      <div className="customer-agent-handling__password"><div><span>Password</span><strong>••••••••••</strong><small>Current password is never displayed.</small></div><button className="primary-btn customer-agent-handling__button" onClick={() => resetPassword({ type: 'agent', id: agent.id })}><KeyRound size={16}/> Reset Password</button></div>
    </section>}

    {customer && !agent && !loading && <div className="customer-agent-handling__customer-reset"><button className="primary-btn customer-agent-handling__button" onClick={() => resetPassword({ type: 'customer', id: customer.id })}><KeyRound size={16}/> Reset Customer Password</button></div>}
    {temporaryPassword && <section className="customer-agent-handling__temporary" role="status"><div><h3>Temporary Password</h3><p>This temporary password will only be shown once. The account holder will be required to change it after login.</p></div><code>{temporaryPassword}</code><button className="primary-btn customer-agent-handling__button" onClick={() => { navigator.clipboard?.writeText(temporaryPassword); setCopied(true); }}><Copy size={16}/>{copied ? 'Copied' : 'Copy Password'}</button><button className="customer-agent-handling__dismiss" onClick={() => { setTemporaryPassword(''); setResetTarget(null); }}>Dismiss</button></section>}
    {resetTarget && !temporaryPassword && !error && !loading && <div className="customer-agent-handling__success" role="status">Password reset complete.</div>}
  </main>;
}
