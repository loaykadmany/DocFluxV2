'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

async function resolveViewerPath(): Promise<string> {
  const candidates = [
    new URL('webviewer/', window.location.href).pathname,
    new URL('./webviewer/', window.location.href).pathname,
    '/webviewer/'
  ];
  for (const p of candidates) {
    try {
      const base = p.endsWith('/') ? p : p + '/';
      const res = await fetch(base + 'webviewer.min.js', { method: 'HEAD' });
      if (res.ok) {
        console.info('[Apryse] Using viewer path:', base);
        return base.replace(/\/$/, '');
      }
    } catch {}
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
    })()
      .catch(err => console.error('WebViewer init error:', err))
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