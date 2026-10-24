import { useEffect, useState } from 'react';

const toTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export const useWhatsAppWindowStatus = (conversation = {}, messagingState = {}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nestedContact =
    conversation?.contactId && typeof conversation.contactId === 'object'
      ? conversation.contactId
      : {};
  const contact = { ...nestedContact, ...conversation };
  const lastInboundMessageAt = toTimestamp(
    messagingState?.lastInboundMessageAt || contact?.lastInboundMessageAt
  );
  const inferredCloseAt = lastInboundMessageAt
    ? lastInboundMessageAt + 24 * 60 * 60 * 1000
    : 0;
  const serviceWindowClosesAt = Math.max(
    toTimestamp(messagingState?.serviceWindowClosesAt) || 0,
    toTimestamp(contact?.serviceWindowClosesAt) || 0,
    inferredCloseAt
  ) || null;
  const optedOut =
    Boolean(messagingState?.optedOut) ||
    String(contact?.whatsappOptInStatus || '').trim().toLowerCase() === 'opted_out' ||
    Boolean(contact?.isBlocked);
  const isOpen = !optedOut && (
    serviceWindowClosesAt
      ? serviceWindowClosesAt > now
      : Boolean(messagingState?.freeformAllowed)
  );
  const remainingMs = isOpen && serviceWindowClosesAt ? serviceWindowClosesAt - now : null;
  const expiringSoon = remainingMs !== null && remainingMs <= 60 * 60 * 1000;

  return {
    now,
    optedOut,
    isOpen,
    status: isOpen ? (expiringSoon ? 'Expiring soon' : 'Open') : 'Closed',
    countdown: remainingMs === null ? '' : formatCountdown(remainingMs),
    remainingMs
  };
};
