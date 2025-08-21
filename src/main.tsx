import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV) {
  window.addEventListener('error', (ev: any) => {
    const t = ev?.target as HTMLScriptElement | HTMLLinkElement | null;
    const src = (t && ('src' in t)) ? (t as any).src : null;
    if (src) {
      console.error('[Asset load error]', src);
      fetch(src, { method: 'HEAD' })
        .then(r => console.error('[Asset HEAD]', src, r.status, r.headers.get('content-type')))
        .catch(() => {});
    }
  }, true);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
  }
}

if (import.meta.env.DEV) {
  window.addEventListener('error', (ev: any) => {
    const t = ev?.target as HTMLScriptElement | HTMLLinkElement | null;
    const src = (t && ('src' in t)) ? (t as any).src : null;
    if (src) {
      console.error('[Asset load error]', src);
      fetch(src, { method: 'HEAD' })
        .then(r => console.error('[Asset HEAD]', src, r.status, r.headers.get('content-type')))
        .catch(() => {});
    }
  }, true);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations?.().then(rs => rs.forEach(r => r.unregister()));
  }
}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
