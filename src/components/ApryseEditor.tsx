'use client';
import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';

const APRYSE_VER = '11.6.1'; // must match package.json
const CACHE_KEY = 'apryse_viewer_path_v1';
const INIT_TIMEOUT_MS = 8000; // if viewer doesn't resolve in 8s, try next path

type Status =
  | { phase: 'initializing'; note?: string }
  | { phase: 'ready'; path: string }
  | { phase: 'error'; message: string; attempts: Array<{ path: string; error: string }> };

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

function normalize(p: string) {
  return p.replace(/\/+$/, '');
}

function candidatePaths(): string[] {
  const href = window.location.href;
  const cached = (() => { try { return sessionStorage.getItem(CACHE_KEY) || undefined; } catch { return undefined; } })();

  return [
    ...(cached ? [cached] : []),
    new URL('./webviewer/', href).pathname, // prefix-aware (e.g., /5173/.../webviewer/)
    './webviewer',                          // relative
    '/webviewer',                           // root
    ...(import.meta.env.DEV ? [
      `https://cdn.jsdelivr.net/npm/@pdftron/webviewer@${APRYSE_VER}/public`
    ] : [])
  ].map(normalize);
}

async function headOkNonHtml(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    return r.ok && !ct.includes('text/html');
  } catch {
    return false;
  }
}

async function viable(path: string) {
  // Quick viability check to avoid hanging on obviously wrong paths
  const topOk =
    await headOkNonHtml(`${path}/webviewer.min.js`) &&
    await headOkNonHtml(`${path}/core/webviewer-core.min.js`);

  if (!topOk) return false;

  // One deep core file must be non-HTML (varies by build)
  const deepCandidates = [
    'core/pdf/PDFNet.js.mem',
    'core/pdf/PDFNet.res',
    'core/pdf/lean/PDFNetCWasm.br.js.mem',
    'core/pdf/lean/PDFNet.res'
  ];
  for (const d of deepCandidates) {
    if (await headOkNonHtml(`${path}/${d}`)) return true;
  }
  return false;
}

function raceInitWithTimeout(path: string, el: HTMLElement) {
  // If WebViewer never resolves (bad path), bail out after INIT_TIMEOUT_MS
  const initP = WebViewer({ path, fullAPI: true }, el);
  const toP = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error('init timeout')), INIT_TIMEOUT_MS)
  );
  return Promise.race([initP, toP]) as Promise<any>;
}

export default function ApryseEditor() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const [status, setStatus] = useState<Status>({ phase: 'initializing', note: 'Booting editor…' });

  useEffect(() => {
    if (!hostRef.current) return;
    if (initializingRef.current || instanceRef.current) return;
    initializingRef.current = true;

    hostRef.current.innerHTML = '';
    let cancelled = false;

    (async () => {
      const attempts: Array<{ path: string; error: string }> = [];
      let chosen: string | null = null;
      let instance: any = null;

      for (const raw of candidatePaths()) {
        const path = normalize(raw);
        try {
          setStatus({ phase: 'initializing', note: `Starting viewer at: ${path}` });

          // Skip obviously bad paths fast
          const ok = await viable(path);
          if (!ok) throw new Error('viability check failed');

          // Clear any stale DOM then try with timeout
          hostRef.current!.innerHTML = '';
          instance = await raceInitWithTimeout(path, hostRef.current!);
          chosen = path;
          break;
        } catch (e: any) {
          const msg = e?.message || String(e);
          attempts.push({ path, error: msg });
          // If cached path failed, drop it
          if (path === sessionStorage.getItem(CACHE_KEY)) clearCache();
        }
      }

      if (!instance || !chosen) {
        setStatus({
          phase: 'error',
          message: 'Could not initialize the PDF editor.',
          attempts
        });
        throw new Error('No viable WebViewer path candidates succeeded.');
      }
      if (cancelled) return;

      instanceRef.current = instance;
      try { sessionStorage.setItem(CACHE_KEY, chosen); } catch {}

      const { UI, Core } = instance;
      UI.setTheme('dark');
      UI.enableFeatures([UI.Feature.ContentEdit]);
      UI.setToolbarGroup(UI.ToolbarGroup.EDIT_TEXT);

      if (Core?.PDFNet?.initialize) {
        await Core.PDFNet.initialize();
      }

      setStatus({ phase: 'ready', path: chosen });
    })()
      .catch((err) => console.error('WebViewer initialization error:', err))
      .finally(() => { initializingRef.current = false; });

    return () => {
      cancelled = true;
      try { instanceRef.current?.UI?.dispose?.(); } catch {}
      instanceRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div className="apryse-fullscreen">
      <div ref={hostRef} className="w-full h-full min-h-[100vh] bg-neutral-900" />
      {status.phase !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto max-w-lg w-[90%] rounded-xl bg-black/80 text-white p-4 shadow-xl border border-white/10">
            {status.phase === 'initializing' && (
              <>
                <div className="text-lg font-semibold">Starting PDF Editor…</div>
                <div className="mt-2 text-sm opacity-80">{status.note ?? 'Loading…'}</div>
                <div className="mt-3 text-xs opacity-60">If this hangs, click "Reset Path Cache".</div>
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
                      <li key={i}><span className="font-mono">{a.path}</span> — {a.error}</li>
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