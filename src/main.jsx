import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/global.css'
import './styles/designTokens.css'
import { getAppRouteBase } from './utils/appRouteBase.js'
import { normalizeError } from './utils/errorUtils'

const routerBasename = getAppRouteBase();

// Guard marker to detect accidental self-embedding inside the dashboard iframe.
window.__TECHNOVO_AUTOMATION_APP__ = true;

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
