'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

const APRYSE_VER = '11.6.1'; // must match package.json
const DEV_CDN = `https://cdn.jsdelivr.net/npm/@pdftron/webviewer@${APRYSE_VER}/public`;

async function isNonHtml(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return r.ok && !ct.includes('text/html');
  } catch { return false; }
}

function normPath(p: string) {
  return p.replace(/\/+$/, '');
}

function rel(baseHref: string, relPath: string) {
  // Always build with absolute base to avoid "Invalid base URL"
  return normPath(new URL(relPath, baseHref).pathname);
}

async function resolveLocalViewerPath(): Promise<string | null> {
  const href = window.location.href;
  const candidates = [
    rel(href, './webviewer/'),
    rel(href, 'webviewer/'),
    '/webviewer'
  ];

  const top = ['webviewer.min.js', 'core/webviewer-core.min.js'];
  const deep = [
    'core/pdf/PDFNet.js.mem', 'core/pdf/PDFNet.res',
    'core/pdf/lean/PDFNetCWasm.br.js.mem', 'core/pdf/lean/PDFNet.res'
  ];

  for (const base of candidates) {
    const topOk = await isNonHtml(`${base}/${top[0]}`) && await isNonHtml(`${base}/${top[1]}`);
    if (!topOk) continue;
    let deepOk = false;
    for (const d of deep) {
      if (await isNonHtml(`${base}/${d}`)) { deepOk = true; break; }
    }
    if (!deepOk) {
      console.warn('[Apryse] Local deep core not reachable under', base);
      continue;
    }
    console.info('[Apryse] Using LOCAL viewer path:', base);
    return base;
  }
  return null;
}

async function resolveViewerPath(): Promise<string> {
  // Prefer local in all cases
  const local = await resolveLocalViewerPath();
  if (local) return local;

  // DEV-only fallback to CDN (to guarantee a working editor during development)
  if (import.meta.env.DEV) {
    const topOk =
      await isNonHtml(`${DEV_CDN}/webviewer.min.js`) &&
      await isNonHtml(`${DEV_CDN}/core/webviewer-core.min.js`);
    if (topOk) {
      console.warn('[Apryse] Falling back to DEV CDN path:', DEV_CDN);
      return DEV_CDN;
    }
  }

  // Last resort (will likely fail, but we log it)
  console.error('[Apryse] No valid viewer path found (local or CDN).');
  return '/webviewer';
}

export default function ApryseEditor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    if (initializingRef.current || instanceRef.current) return;
    initializingRef.current = true;

    containerRef.current.innerHTML = '';
    let cancelled = false;

    (async () => {
      const path = await resolveViewerPath();

      const instance = await WebViewer({ path, fullAPI: true }, containerRef.current!);
      if (cancelled) return;

      instanceRef.current = instance;
      const { UI, Core } = instance;

      UI.setTheme('dark');
      UI.enableFeatures([UI.Feature.ContentEdit]);
      UI.setToolbarGroup(UI.ToolbarGroup.EDIT_TEXT);

      if (Core?.PDFNet?.initialize) {
        await Core.PDFNet.initialize();
      }

      // Sanity: log CT for top assets
      for (const p of [`${path}/webviewer.min.js`, `${path}/core/webviewer-core.min.js`]) {
        fetch(p, { method: 'HEAD' }).then(r =>
          console.info('[Apryse asset]', p, r.status, r.headers.get('content-type'))
        );
      }
    })()
      .catch(err => console.error('WebViewer initialization error:', err))
      .finally(() => { initializingRef.current = false; });

    return () => {
      cancelled = true;
      try { instanceRef.current?.UI?.dispose?.(); } catch {}
      instanceRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div id="apryse-shell" className="fixed inset-0 w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}