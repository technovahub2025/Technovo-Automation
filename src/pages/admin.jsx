import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import {
  ArrowUpRight,
  BadgeCheck,
  CreditCard,
  Fingerprint,
  Settings2,
  Shield,
  ShieldCheck,
  UsersRound,
  WalletCards
} from 'lucide-react';
import './admin.css';
import '../styles/theme.css';

const ADMIN_CARDS = [
  {
    key: 'users',
    icon: UsersRound,
    label: 'User operations',
    title: 'Users List',
    description:
      'Open the full users and admins list, review account status, and manage edits from one place.',
    path: '/admin/users',
    action: 'Open Users',
    meta: 'Search + role filters',
    accent: 'superadmin-dashboard-card--users'
  },
  {
    key: 'setup',
    icon: Settings2,
    label: 'Admin onboarding',
    title: 'Admin Creation',
    description:
      'Create a new admin account and finish Twilio and WhatsApp setup in a dedicated workflow.',
    path: '/admin/admin-setup',
    action: 'Create Admin',
    meta: 'Guided setup flow',
    accent: 'superadmin-dashboard-card--setup'
  },
  {
    key: 'payments',
    icon: WalletCards,
    label: 'Billing control',
    title: 'Payments Details',
    description:
      'Manage plan pricing and review the live payments ledger with socket-based refresh updates.',
    path: '/admin/payments',
    action: 'Open Payments',
    meta: 'Pricing + ledger tabs',
    accent: 'superadmin-dashboard-card--payments'
  },
  {
    key: 'verification',
    icon: ShieldCheck,
    label: 'Verification review',
    title: 'Verification Docs',
    description:
      'Review submitted registration documents, approve verification items, and move verified users into admin setup.',
    path: '/verification',
    action: 'Open Verification',
    meta: 'Document review queue',
    accent: 'superadmin-dashboard-card--verification'
  }
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [socketConnected, setSocketConnected] = useState(() =>
    Boolean(socketService.getSocket()?.connected)
  );

  useEffect(() => {
    const socket = socketService.connect(import.meta.env.VITE_SOCKET_URL);

    const syncSocketStatus = () =>
      setSocketConnected(Boolean(socketService.getSocket()?.connected));

    socket?.on('connect', syncSocketStatus);
    socket?.on('disconnect', syncSocketStatus);

    return () => {
      socket?.off('connect', syncSocketStatus);
      socket?.off('disconnect', syncSocketStatus);
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="superadmin-shell">
      <header className="superadmin-header">
        <div className="superadmin-hero">
          <div className="superadmin-hero__eyebrow">
            <BadgeCheck size={16} />
            <span>Superadmin workspace</span>
          </div>
          <div className="superadmin-hero__heading">
            <div>
              <h1 className="nx-title">Superadmin Control Center</h1>
              <p className="superadmin-subtitle">
                A full-width operations hub for user control, admin onboarding, and billing
                workflows with live system visibility.
              </p>
            </div>
            <div className="superadmin-hero__pulse">
              <div className="superadmin-hero__pulse-ring" />
              <span>{socketConnected ? 'System online' : 'Reconnecting services'}</span>
            </div>
          </div>
          <div className="superadmin-overview-grid">
            <article className="superadmin-overview-card">
              <div className="superadmin-overview-card__icon">
                <UsersRound size={18} />
              </div>
              <div>
                <strong>User governance</strong>
                <span>Account review, access control, and role-level management.</span>
              </div>
            </article>
            <article className="superadmin-overview-card">
              <div className="superadmin-overview-card__icon">
                <Fingerprint size={18} />
              </div>
              <div>
                <strong>Secure onboarding</strong>
                <span>Provision new admins with setup steps aligned to your workflow.</span>
              </div>
            </article>
            <article className="superadmin-overview-card">
              <div className="superadmin-overview-card__icon">
                <CreditCard size={18} />
              </div>
              <div>
                <strong>Billing visibility</strong>
                <span>Keep pricing controls and live payment activity in one place.</span>
              </div>
            </article>
          </div>
        </div>
      </header>

      <div className="superadmin-dashboard-grid">
        {ADMIN_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.key} className={`superadmin-dashboard-card ${card.accent}`}>
              <div className="superadmin-dashboard-card__top">
                <div className="superadmin-dashboard-card__icon-wrap">
                  <div className="superadmin-dashboard-card__icon">
                    <Icon size={20} />
                  </div>
                  <span className="superadmin-dashboard-card__label">{card.label}</span>
                </div>
                <span className="superadmin-dashboard-card__meta">{card.meta}</span>
              </div>
              <div className="superadmin-dashboard-card__content">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
              <div className="superadmin-dashboard-card__footer">
                <div className="superadmin-dashboard-card__hint">
                  <Shield size={15} />
                  <span>Production-ready workflow</span>
                </div>
                <button
                  className="primary-btn superadmin-dashboard-card__action"
                  onClick={() => navigate(card.path)}
                >
                  <span>{card.action}</span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboard;
