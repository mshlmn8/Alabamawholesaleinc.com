import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installDomGuards } from './lib/domGuard.js';
import './index.css';

// Before React touches the DOM: translated pages must not crash it (AW-039).
installDomGuards();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fullPage>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
