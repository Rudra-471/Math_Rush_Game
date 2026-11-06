import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev-only handle for debugging / automated play-tests.
if (import.meta.env.DEV) {
  void Promise.all([import('./game/runtime'), import('./store/gameStore'), import('./game/intro/director')]).then(([r, s, d]) =>
    Object.assign(window, { __mr: { game: r.game, useGame: s.useGame, intro: d.intro } }),
  );
}

// Offline support (PWA): register the service worker in production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
