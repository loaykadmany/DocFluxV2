'use client';
import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import { Upload } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !instanceRef.current) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setIsLoading(true);
    try {
      const { documentViewer } = instanceRef.current.Core;
      await documentViewer.loadDocument(file);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('Failed to load PDF file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="apryse-shell" className="fixed inset-0 w-full h-full">
      {/* Upload Button */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={handleUploadClick}
          disabled={isLoading || !instanceRef.current}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          <Upload className="w-4 h-4" />
          <span>{isLoading ? 'Loading...' : 'Upload PDF'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
      
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}