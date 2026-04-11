import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/global.css'

const normalizeBase = (value) => {
  if (!value || value === '/') {
    return '/';
  }

  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const detectPathBase = () => {
  if (typeof window === 'undefined') {
    return '/';
  }

  if (window.location.pathname === '/nexion' || window.location.pathname.startsWith('/nexion/')) {
    return '/nexion';
  }

  return '/';
};

const configuredBase = normalizeBase(import.meta.env.VITE_APP_BASENAME);
const inferredBase = normalizeBase(import.meta.env.BASE_URL || '/');
const routerBasename = configuredBase !== '/' ? configuredBase : inferredBase !== '/' ? inferredBase : detectPathBase();

// Guard marker to detect accidental self-embedding inside the dashboard iframe.
window.__TECHNOVO_AUTOMATION_APP__ = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
