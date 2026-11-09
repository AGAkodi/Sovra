import './polyfills';
import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from './landing/LandingPage';
import './index.css';

// The dashboard carries the NEAR wallet code; load it only when someone opens it.
const App = lazy(() => import('./App'));

const isDashboard = window.location.pathname.startsWith('/app');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDashboard ? (
      <Suspense fallback={<div className="h-dvh bg-canvas" aria-busy="true" />}>
        <App />
      </Suspense>
    ) : (
      <LandingPage />
    )}
  </React.StrictMode>
);
