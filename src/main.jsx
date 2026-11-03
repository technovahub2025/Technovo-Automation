import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/global.css'
import './styles/designTokens.css'
import { getAppRouteBase } from './utils/appRouteBase.js'
import { normalizeError } from './utils/errorUtils'

const routerBasename = getAppRouteBase();
const CHUNK_RELOAD_GUARD_KEY = 'nexion:chunk-reload-at';

// Guard marker to detect accidental self-embedding inside the dashboard iframe.
window.__TECHNOVO_AUTOMATION_APP__ = true;

const installStaleChunkRecovery = () => {
  try {
    const storedReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || 0) || 0;
    const remainingGuardMs = 60_000 - (Date.now() - storedReloadAt);
    if (storedReloadAt && remainingGuardMs > 0) {
      window.setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY), remainingGuardMs);
    } else if (storedReloadAt) {
      sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
    }
  } catch {
    // Ignore session storage access errors.
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    const now = Date.now();
    let previousReloadAt = 0;
    try {
      previousReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || 0) || 0;
    } catch {
      // Reload recovery remains best-effort when session storage is unavailable.
    }
    if (previousReloadAt && now - previousReloadAt < 60_000) {
      console.error('Team Inbox could not load a deployment asset after one automatic refresh. Reload the page again to retry.');
      return;
    }
    try {
      sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now));
    } catch {
      // Avoid a reload loop if storage is unavailable.
    }
    console.warn('A deployment asset is out of date; refreshing the application once.');
    window.location.reload();
  });
};

const installRuntimeErrorGuards = () => {
  if (window.__TECHNOVO_RUNTIME_ERROR_GUARDS_INSTALLED__) return;
  window.__TECHNOVO_RUNTIME_ERROR_GUARDS_INSTALLED__ = true;

  window.addEventListener('unhandledrejection', (event) => {
    const normalized = normalizeError(event?.reason, 'Unhandled promise rejection');
    const message = String(normalized?.message || '').toLowerCase();
    const isAbortError = String(normalized?.name || '').toLowerCase() === 'aborterror';
    const isTimeoutError =
      String(normalized?.code || '').toUpperCase() === 'ECONNABORTED' ||
      message.includes('timeout') ||
      message.includes('network error');
    const isPlainObjectRejection =
      normalized && typeof normalized === 'object' && normalized.constructor === Object;

    if (isAbortError || isTimeoutError || isPlainObjectRejection) {
      event.preventDefault();
      console.warn('Suppressed unhandled promise rejection:', normalized);
      return;
    }

    event.preventDefault();
    console.error('Unhandled promise rejection:', normalized);
  });
};

installRuntimeErrorGuards();
installStaleChunkRecovery();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
