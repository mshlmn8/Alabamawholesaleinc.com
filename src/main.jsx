import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installDomGuards } from './lib/domGuard.js';
import { redirectLegacyHash } from './lib/router.js';
import './index.css';

// Before React touches the DOM: translated pages must not crash it (AW-039).
installDomGuards();

// Old '#/…' links become their path (AW-043). By now useAuth has read any
// Supabase '#access_token=…' or '#error=…' fragment at import time, and those
// fragments are never rewritten anyway: they do not start with '/'.
redirectLegacyHash();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fullPage>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
