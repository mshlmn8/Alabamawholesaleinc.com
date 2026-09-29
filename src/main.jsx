import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installDomGuards } from './lib/domGuard.js';
import { takeAuthLink } from './lib/authLink.js';
import { AuthProvider } from './lib/auth.jsx';
import { redirectLegacyHash } from './lib/router.js';
import './index.css';

// Before React touches the DOM: translated pages must not crash it (AW-039).
installDomGuards();

// A Supabase email link ('#access_token=…', '#error=…') is read and removed
// from the address first (AW-015), so neither the legacy redirect below nor
// the router ever sees its tokens. A recovery link becomes /reset-password.
const authLink = takeAuthLink();

// Old '#/…' links become their path (AW-043).
redirectLegacyHash();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fullPage>
      <AuthProvider link={authLink}>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
