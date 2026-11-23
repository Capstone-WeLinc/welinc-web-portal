import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';
import './index.css';
import App from './App.tsx';
import { CrashBoundary } from './components/monitoring/CrashBoundary';
import { installChunkReload } from './lib/monitoring/chunkReload';
import { initMonitoring, rootErrorHandlers } from './lib/monitoring/sentry';

// VRMS spec 0025: error monitoring starts before React (off with no VITE_SENTRY_DSN), and a lazy
// file that vanished after a deploy reloads the page once (AC-8)
initMonitoring();
installChunkReload();

// AC-7: a crash outside a shell (the sign in pages, or a shell itself) shows the full page screen
createRoot(document.getElementById('root')!, rootErrorHandlers).render(
  <StrictMode>
    <CrashBoundary variant="full">
      <App />
    </CrashBoundary>
  </StrictMode>,
);
