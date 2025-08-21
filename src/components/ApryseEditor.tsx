'use client';
import { useEffect, useRef } from 'react';
import WebViewer from '@pdftron/webviewer';

const APRYSE_VER = '11.6.1'; // must match package.json

async function initWithPath(path: string, el: HTMLElement) {
  console.info('[Apryse] Trying path:', path);
  const instance = await WebViewer({ path, fullAPI: true }, el);
  console.info('[Apryse] SUCCESS with path:', path);
  return instance;
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
      const href = window.location.href;
      // Candidate list: RELATIVE first (inherits /5173/ prefixes), then root, then BASE_URL, then DEV CDN
      const candidates: string[] = [
        // strictly relative (works in most dev hosts with path prefixes)
        new URL('./webviewer/', href).pathname, // e.g., /5173/.../webviewer/
        './webviewer',                           // relative string fallback
        '/webviewer',                            // root (works on plain localhost)
        (import.meta.env.BASE_URL || './').replace(/\/+$/, '') + '/webviewer',
        // DEV-only CDN fallback to guarantee a working editor in weird dev hosts
        ...(import.meta.env.DEV ? [
          `https://cdn.jsdelivr.net/npm/@pdftron/webviewer@${APRYSE_VER}/public`
        ] : [])
      ];

      let chosen: string | null = null;
      let instance: any = null;

      for (const p of candidates) {
        try {
          // Clear any stale DOM before a new attempt
          containerRef.current!.innerHTML = '';
          instance = await initWithPath(p, containerRef.current!);
          chosen = p;
          break;
        } catch (e) {
          console.warn('[Apryse] Path failed:', p, e);
        }
      }

      if (!instance || !chosen) {
        throw new Error('[Apryse] No viable WebViewer path candidates succeeded.');
      }
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