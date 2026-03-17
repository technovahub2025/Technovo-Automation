import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/global.css'

const configuredBase = import.meta.env.VITE_APP_BASENAME;
const inferredBase = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';
const routerBasename = configuredBase || inferredBase;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
