'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

async function okNonHtml(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = r.headers.get('content-type') || '';
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

async function resolveViewerPath(): Promise<string> {
  // Try RELATIVE paths first so we inherit any dev prefix (/5173/...), then root
  const bases = [
    new URL('webviewer/', window.location.href).pathname,
    new URL('./webviewer/', window.location.href).pathname,
    '/webviewer/'
  ].map(b => (b.endsWith('/') ? b.slice(0, -1) : b));

  // Probe top-level + deep engine assets; reject anything serving HTML
  const probes = [
    'webviewer.min.js',
    'core/webviewer-core.min.js',
    // Deep engine variants (Apryse build dependent) — we only need any 1–2 to confirm
    'core/pdf/PDFNet.js.mem',
    'core/pdf/PDFNet.res',
    'core/pdf/lean/PDFNetCWasm.br.js.mem',
    'core/pdf/lean/PDFNet.res'
  ];

  for (const base of bases) {
    const topOk =
      await okNonHtml(`${base}/webviewer.min.js`) &&
      await okNonHtml(`${base}/core/webviewer-core.min.js`);

    if (!topOk) continue;

    let deepHits = 0;
    for (const p of probes.slice(2)) {
      if (await okNonHtml(`${base}/${p}`)) deepHits++;
      if (deepHits >= 2) break;
    }
    if (deepHits >= 1) {
      console.info('[Apryse] Using viewer path:', base);
      return base;
    } else {
      console.warn('[Apryse] Deep core not reachable under', base);
    }
  }

  // DEV-only CDN fallback if all local candidates fail
  if (import.meta.env.DEV) {
    console.warn('[Apryse] Using CDN fallback for development');
    return 'https://cdn.jsdelivr.net/npm/@pdftron/webviewer@10.10.0/public';
  }

  console.warn('[Apryse] Falling back to /webviewer (root)');
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

      // Sanity: log the two key files with content-type
      for (const p of [`${path}/webviewer.min.js`, `${path}/core/webviewer-core.min.js`]) {
        fetch(p, { method: 'HEAD' }).then(r => {
          console.info('[Apryse asset]', p, r.status, r.headers.get('content-type'));
        });
      }
    })().catch(err => {
      console.error('WebViewer initialization error:', err);
    }).finally(() => {
      initializingRef.current = false;
    });

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