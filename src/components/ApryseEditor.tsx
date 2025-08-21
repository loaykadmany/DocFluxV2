'use client';
import { useEffect, useRef, useState } from 'react';
import WebViewer from '@pdftron/webviewer';
import { Upload, Download, FileText, Loader2 } from 'lucide-react';

export default function ApryseEditor() {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewerRef.current) return;
    
    // Prevent double initialization
    if (instanceRef.current) return;
    
    let cancelled = false;

    (async () => {
      try {
        const instance = await WebViewer(
          {
            path: '/webviewer',   // must match public/webviewer
            fullAPI: true,        // enables Core.PDFNet when available
            // licenseKey: process.env.NEXT_PUBLIC_APRYSE_KEY ?? undefined,
          },
          viewerRef.current
        );

        if (cancelled) return;

        instanceRef.current = instance;
        const { UI, Core } = instance;
        
        UI.setTheme('dark');
        UI.enableFeatures([UI.Feature.ContentEdit]);
        UI.setToolbarGroup(UI.ToolbarGroup.EDIT_TEXT);

        // Initialize PDFNet once if present, and await it. DO NOT call enableJavaScript.
        if (Core?.PDFNet && typeof Core.PDFNet.initialize === 'function') {
          await Core.PDFNet.initialize();
        }

        if (cancelled) return;
        setIsLoading(false);
        (window as any).apryse = instance; // optional for debugging
      } catch (err) {
        console.error('WebViewer initialization error:', err);
        setIsLoading(false);
      }
    })().catch((err) => {
      console.error('WebViewer initialization error:', err);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.UI.dispose();
        } catch (e) {
          console.warn('Error disposing WebViewer:', e);
        }
        instanceRef.current = null;
      }
    };
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && instanceRef.current) {
      const fileURL = URL.createObjectURL(file);
      instanceRef.current.UI.loadDocument(fileURL, { filename: file.name });
    }
  };

  const handleDownload = () => {
    if (instanceRef.current) {
      const { documentViewer } = instanceRef.current.Core;
      const doc = documentViewer.getDocument();
      
      if (doc) {
        doc.getFileData().then((data: ArrayBuffer) => {
          const blob = new Blob([data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'edited-document.pdf';
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileText className="w-6 h-6" />
            <span>PDF Editor</span>
          </h1>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF</span>
            </button>
            
            <button
              onClick={handleDownload}
              disabled={!instanceRef.current}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                instanceRef.current
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* WebViewer Container */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
              <p className="text-white">Loading PDF Editor...</p>
            </div>
          </div>
        )}
        
        <div 
          ref={viewerRef} 
          className="w-full h-full"
          style={{ minHeight: '600px' }}
        />
      </div>
    </div>
  );
}