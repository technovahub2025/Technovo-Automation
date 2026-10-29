import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './authcontext';
import apiService from '../services/api';

export default function ChangeTemporaryPasswordPage() {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await apiService.changeOwnPassword(password);
      const nextUser = { ...user, mustChangePassword: false };
      const tokenKey = import.meta.env.VITE_TOKEN_KEY || 'authToken';
      const token = localStorage.getItem(tokenKey) || localStorage.getItem('authToken');
      login(nextUser, token, localStorage.getItem('authProvider') || 'local');
      navigate(user?.role === 'superadmin' ? '/admin' : user?.isAgentWorkspace ? '/broadcast-dashboard' : '/', { replace: true });
    } catch (err) { setError(err?.response?.data?.message || 'Unable to change password.'); }
    finally { setSaving(false); }
  };
  return <main className="superadmin-shell"><section className="superadmin-panel superadmin-panel--page" style={{ maxWidth: 540, margin: '8vh auto' }}>
    <h1 className="nx-title">Change your temporary password</h1><p className="superadmin-subtitle">Set a new password to continue to your account.</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} /></label>
      {error && <div role="alert">{error}</div>}
      <button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
    </form>
  </section></main>;
}
