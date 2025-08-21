'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

async function okNonHtml(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

function abs(href: string, rel: string) {
  // Always build URLs using an ABSOLUTE base to avoid "Invalid base URL"
  return new URL(rel, href).pathname.replace(/\/+$/, ''); // normalize, drop trailing slash
}

async function resolveViewerPath(): Promise<string> {
  const href = window.location.href; // absolute base (required by URL())
  // Build prefix-aware candidates using ABSOLUTE base
  const candidates = [
    abs(href, './webviewer/'),
    abs(href, 'webviewer/'),
    '/webviewer' // root fallback
  ];

  const top = ['webviewer.min.js', 'core/webviewer-core.min.js'];
  const deep = [
    'core/pdf/PDFNet.js.mem', 'core/pdf/PDFNet.res',
    'core/pdf/lean/PDFNetCWasm.br.js.mem', 'core/pdf/lean/PDFNet.res'
  ];

  for (const base of candidates) {
    const topOk = await okNonHtml(`${base}/${top[0]}`) && await okNonHtml(`${base}/${top[1]}`);
    if (!topOk) continue;

    let deepOk = false;
    for (const d of deep) {
      if (await okNonHtml(`${base}/${d}`)) { deepOk = true; break; }
    }
    if (!deepOk) {
      console.warn('[Apryse] Deep core not reachable under', base);
      continue;
    }

    console.info('[Apryse] Using viewer path:', base);
    return base;
  }

  console.warn('[Apryse] Falling back to /webviewer');
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

      // Sanity: confirm not HTML
      for (const p of [`${path}/webviewer.min.js`, `${path}/core/webviewer-core.min.js`]) {
        fetch(p, { method: 'HEAD' })
          .then(r => console.info('[Apryse asset]', p, r.status, r.headers.get('content-type')));
      }
    })()
      .catch(err => console.error('WebViewer initialization error:', err))
      .finally(() => { initializingRef.current = false; });

    return () => {
      cancelled = true;
      try { instanceRef.instance?.UI?.dispose?.(); } catch {}
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