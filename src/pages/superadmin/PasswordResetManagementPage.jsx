import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Search, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import './PasswordResetManagementPage.css';

const PAGE_SIZE = 25;
const ROLE_OPTIONS = [
  ['admin', 'Admin'],
  ['client', 'Client'],
  ['employee', 'Employee'],
  ['user', 'User'],
  ['superadmin', 'Super Admin']
];

const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

export default function PasswordResetManagementPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', role: '', companyId: '', status: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.listPasswordResetAccounts({
        page,
        pageSize: PAGE_SIZE,
        search: filters.search.trim() || undefined,
        role: filters.role || undefined,
        companyId: filters.companyId || undefined,
        status: filters.status || undefined
      });
      const payload = response?.data || {};
      setAccounts(Array.isArray(payload.data) ? payload.data : []);
      setPagination(payload.pagination || { page, total: 0, totalPages: 1 });
      setTenants(Array.isArray(payload.filters?.tenants) ? payload.filters.tenants : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to load accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const timer = window.setTimeout(loadAccounts, 250);
    return () => window.clearTimeout(timer);
  }, [loadAccounts]);

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setSelected(null);
    setNewPassword('');
    setConfirmPassword('');
    setMustChangePassword(false);
    setShowPasswords(false);
  };

  const validationMessage = useMemo(() => {
    if (newPassword.length > 0 && newPassword.length < 10) return 'Use at least 10 characters.';
    if (newPassword && new TextEncoder().encode(newPassword).length > 72) return 'Password must be no more than 72 UTF-8 bytes.';
    if (confirmPassword && newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  }, [newPassword, confirmPassword]);

  const submitReset = async (event) => {
    event.preventDefault();
    setError('');
    if (!selected || selected.isProtected) return;
    if (newPassword.length < 10 || new TextEncoder().encode(newPassword).length > 72 || newPassword !== confirmPassword) {
      return;
    }
    const confirmed = window.confirm(
      `Permanently update the login password for ${selected.name} (${selected.email || 'no email'})?`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await apiService.resetAccountPassword(selected.id, {
        newPassword,
        mustChangePassword,
        accountType: selected.accountType
      });
      const successMessage = `Password updated for ${selected.name}.`;
      closeModal(true);
      setNotice(successMessage);
      await loadAccounts();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to update this account password.');
    } finally {
      setSaving(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setNotice('');
  };

  return (
    <main className="superadmin-shell password-reset-management">
      <header className="superadmin-header">
        <div className="superadmin-hero superadmin-hero--page">
          <button type="button" className="btn-link superadmin-back-link" onClick={() => navigate('/admin')}>
            <ArrowLeft size={18} /> Back to Control Center
          </button>
          <div className="password-reset-management__heading">
            <div className="superadmin-hero__eyebrow"><LockKeyhole size={16} /> Account security</div>
            <h1 className="nx-title">Password Reset Management</h1>
            <p className="superadmin-subtitle">View registered accounts and securely assign or reset their login passwords.</p>
          </div>
        </div>
      </header>

      <section className="superadmin-panel superadmin-panel--page">
        <div className="password-reset-management__session-note">
          Password changes apply to the next sign-in. Existing JWT sessions are not revoked by the current authentication system.
        </div>
        <div className="password-reset-management__toolbar">
          <label className="password-reset-management__search">
            <Search size={17} />
            <span className="password-reset-management__sr-only">Search accounts</span>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search name, email, or phone" />
          </label>
          <select aria-label="Filter by account type" value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            <option value="">All account types</option>
            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Filter by tenant" value={filters.companyId} onChange={(event) => updateFilter('companyId', event.target.value)}>
            <option value="">All tenants</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
          <select aria-label="Filter by account status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {notice && <div className="password-reset-management__notice" role="status"><ShieldCheck size={17} /> {notice}</div>}
        <div className="password-reset-management__table-wrap">
          <table className="password-reset-management__table">
            <thead><tr><th>Account</th><th>Type</th><th>Tenant</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="password-reset-management__state"><Loader2 className="is-spinning" size={20} /> Loading accounts…</td></tr>
              ) : error ? (
                <tr><td colSpan="6" className="password-reset-management__state">{error}</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan="6" className="password-reset-management__state">No accounts match these filters.</td></tr>
              ) : accounts.map((account) => (
                <tr key={account.id}>
                  <td><strong>{account.name}</strong><span>{account.email || 'No email address'}</span>{account.phoneNumber && <small>{account.phoneNumber}</small>}</td>
                  <td>{account.accountType}</td>
                  <td>{account.companyName || 'Unassigned'}</td>
                  <td><span className={`password-reset-management__status ${account.status === 'Inactive' ? 'is-inactive' : ''}`}>{account.status}</span></td>
                  <td>{dateLabel(account.createdAt)}</td>
                  <td>
                    <button type="button" className="password-reset-management__action" disabled={account.isProtected} onClick={() => { setSelected(account); setError(''); setNotice(''); }} title={account.isProtected ? 'Protected Super Admin account' : 'Change password'}>
                      <KeyRound size={15} /> {account.isProtected ? 'Protected' : 'Reset Password'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="password-reset-management__pagination">
          <span>{pagination.total} account{pagination.total === 1 ? '' : 's'}</span>
          <div>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1}>Previous</button>
            <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(pagination.totalPages || 1, value + 1))} disabled={loading || page >= (pagination.totalPages || 1)}>Next</button>
          </div>
        </footer>
      </section>

      {selected && (
        <div className="password-reset-management__backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className="password-reset-management__modal" role="dialog" aria-modal="true" aria-labelledby="password-reset-modal-title">
            <header><div><span><KeyRound size={17} /> Reset login password</span><h2 id="password-reset-modal-title">{selected.name}</h2><p>{selected.email || 'No email address'} · {selected.accountType} · {selected.companyName || 'Unassigned'}</p></div><button type="button" aria-label="Close" onClick={closeModal} disabled={saving}><X size={20} /></button></header>
            {error && <div className="password-reset-management__error" role="alert">{error}</div>}
            <form onSubmit={submitReset}>
              <label>New login password<div className="password-reset-management__password-field"><input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={10} maxLength={72} /><button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? 'Hide password' : 'Show password'}>{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label>Confirm new login password<input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={10} maxLength={72} /></label>
              {validationMessage ? <p className="password-reset-management__validation" role="status">{validationMessage}</p> : <p className="password-reset-management__help">Use at least 10 characters. Passwords are never displayed after saving.</p>}
              <label className="password-reset-management__checkbox"><input type="checkbox" checked={mustChangePassword} onChange={(event) => setMustChangePassword(event.target.checked)} /><span>Require user to change password at next login</span></label>
              <div className="password-reset-management__modal-actions"><button type="button" className="password-reset-management__cancel" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="password-reset-management__confirm" disabled={saving || newPassword.length < 10 || new TextEncoder().encode(newPassword).length > 72 || newPassword !== confirmPassword}>{saving ? <><Loader2 className="is-spinning" size={17} /> Updating…</> : <><KeyRound size={16} /> Confirm Password Reset</>}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
