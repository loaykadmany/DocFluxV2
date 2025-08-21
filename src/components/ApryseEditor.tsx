'use client';
import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';

const APRYSE_VER = '11.6.1'; // must match package.json @pdftron/webviewer version
const CACHE_KEY = 'apryse_viewer_path_v1';

type Status =
  | { phase: 'initializing'; note?: string }
  | { phase: 'ready'; path: string }
  | { phase: 'error'; message: string; attempts: Array<{ path: string; error: string }> };

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

async function tryInit(path: string, el: HTMLElement) {
  // Try to initialize WebViewer with this path
  const instance = await WebViewer({ path, fullAPI: true }, el);
  return instance;
}

export default function ApryseEditor() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const [status, setStatus] = useState<Status>({ phase: 'initializing', note: 'Booting editor…' });

  useEffect(() => {
    if (!containerRef.current) return;
    if (initializingRef.current || instanceRef.current) return;
    initializingRef.current = true;

    containerRef.current.innerHTML = '';
    let cancelled = false;

    (async () => {
      const href = window.location.href;
      const cached = (() => {
        try { return sessionStorage.getItem(CACHE_KEY) || undefined; } catch { return undefined; }
      })();

      // Candidate order: cached → prefix-aware relative → relative → root → DEV CDN (dev-only)
      const candidates: string[] = [
        ...(cached ? [cached] : []),
        new URL('./webviewer/', href).pathname,  // e.g. /5173/.../webviewer/
        './webviewer',
        '/webviewer',
        ...(import.meta.env.DEV ? [
          `https://cdn.jsdelivr.net/npm/@pdftron/webviewer@${APRYSE_VER}/public`
        ] : [])
      ];

      const attempts: Array<{ path: string; error: string }> = [];
      let chosen: string | null = null;
      let instance: any = null;

      for (const p of candidates) {
        try {
          // Prevent stacked UIs between attempts
          containerRef.current!.innerHTML = '';
          setStatus({ phase: 'initializing', note: `Starting viewer at: ${p}` });
          instance = await tryInit(p, containerRef.current!);
          chosen = p;
          break;
        } catch (e: any) {
          attempts.push({ path: p, error: e?.message || String(e) });
          // If the cached path failed, drop it so future mounts don't keep failing silently
          if (p === cached) { clearCache(); }
        }
      }

      if (!instance || !chosen) {
        setStatus({
          phase: 'error',
          message: 'Could not initialize the PDF editor. See attempts below.',
          attempts,
        });
        throw new Error('No viable WebViewer path candidates succeeded.');
      }
      if (cancelled) return;

      // Cache the successful path for fast future inits
      try { sessionStorage.setItem(CACHE_KEY, chosen); } catch {}

      instanceRef.current = instance;
      const { UI, Core } = instance;

      UI.setTheme('dark');
      UI.enableFeatures([UI.Feature.ContentEdit]);
      UI.setToolbarGroup(UI.ToolbarGroup.EDIT_TEXT);

      // Initialize PDFNet when available, but do not call unsupported APIs
      if (Core?.PDFNet?.initialize) {
        await Core.PDFNet.initialize();
      }

      setStatus({ phase: 'ready', path: chosen });
    })()
      .catch((err) => {
        console.error('WebViewer initialization error:', err);
      })
      .finally(() => {
        initializingRef.current = false;
      });

    return () => {
      cancelled = true;
      try { instanceRef.current?.UI?.dispose?.(); } catch {}
      instanceRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="apryse-fullscreen">
      {/* Viewer host */}
      <div ref={containerRef} className="w-full h-full min-h-[100vh] bg-neutral-900" />

      {/* Overlay: initializing / error */}
      {status.phase !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto max-w-lg w-[90%] rounded-xl bg-black/80 text-white p-4 shadow-xl border border-white/10">
            {status.phase === 'initializing' && (
              <>
                <div className="text-lg font-semibold">Starting PDF Editor…</div>
                <div className="mt-2 text-sm opacity-80">{status.note ?? 'Loading…'}</div>
                <div className="mt-3 text-xs opacity-60">If this takes unusually long, click "Reset Path Cache".</div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                    onClick={() => { clearCache(); location.reload(); }}
                  >
                    Reset Path Cache
                  </button>
                </div>
              </>
            )}
            {status.phase === 'error' && (
              <>
                <div className="text-lg font-semibold text-red-300">Couldn't start the PDF Editor</div>
                <div className="mt-2 text-sm opacity-80">{status.message}</div>
                <div className="mt-3 text-xs opacity-70">
                  <div className="font-semibold">Attempts:</div>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {status.attempts.map((a, i) => (
                      <li key={i}>
                        <span className="font-mono">{a.path}</span> — {a.error}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                    onClick={() => { clearCache(); location.reload(); }}
                  >
                    Reset Path Cache
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}