'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

// Treat anything with content-type HTML as invalid (it will cause "<" errors)
async function okNonHtml(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

async function resolveViewerPath(): Promise<string> {
  // Start from Vite's base (relative), then fall back to relative-from-page, finally root
  const basePrefix = new URL(import.meta.env.BASE_URL || './', window.location.href).pathname;
  const candidates = [
    new URL('webviewer/', basePrefix).pathname,                    // <base>/webviewer/
    new URL('./webviewer/', window.location.href).pathname,         // ./webviewer/
    '/webviewer/'                                                   // root fallback
  ].map(p => (p.endsWith('/') ? p.slice(0, -1) : p));

  const top = ['webviewer.min.js', 'core/webviewer-core.min.js'];
  const deep = [
    'core/pdf/PDFNet.js.mem', 'core/pdf/PDFNet.res',
    'core/pdf/lean/PDFNetCWasm.br.js.mem', 'core/pdf/lean/PDFNet.res'
  ];

  for (const base of candidates) {
    const topOk = await okNonHtml(`${base}/${top[0]}`) && await okNonHtml(`${base}/${top[1]}`);
    if (!topOk) continue;

    // Accept if at least one deep core file is non-HTML (varies by build)
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

      // Sanity: log content-type to confirm no HTML
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