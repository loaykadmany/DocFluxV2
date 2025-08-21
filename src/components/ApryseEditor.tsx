import React, { useRef, useEffect, useState } from 'react';
import { Upload, Download, FileText, Loader2 } from 'lucide-react';
import WebViewer from '@pdftron/webviewer';

const ApryseEditor: React.FC = () => {
  const viewer = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webViewerInstance, setWebViewerInstance] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (viewer.current) {
      WebViewer({
        licenseKey: 'demo:1755695988890:606a98c9030000000063a735a5785fba86cd7b75421c115737d7a48291',
        path: '/webviewer/lib',
        initialDoc: '',
        fullAPI: true,
        disableWebsockets: true,
        enableOfficeEditing: true,
        css: `
          .HeaderItems .Button[data-element="downloadButton"] { display: none !important; }
          .HeaderItems .Button[data-element="saveAsButton"] { display: none !important; }
        `
      }, viewer.current)
        .then((instance) => {
          setWebViewerInstance(instance);
          setIsLoading(false);

          const { documentViewer, annotationManager } = instance.Core;

          // Configure the viewer
          instance.UI.setTheme('dark');
          
          // Enable all editing features
          instance.UI.enableFeatures([
            instance.UI.Feature.TextSelection,
            instance.UI.Feature.Annotations,
            instance.UI.Feature.Forms,
            instance.UI.Feature.Redaction,
            instance.UI.Feature.ContentEdit,
            instance.UI.Feature.Download,
            instance.UI.Feature.Print,
            instance.UI.Feature.Copy,
            instance.UI.Feature.Measurement,
            instance.UI.Feature.NotesPanel,
            instance.UI.Feature.Search,
            instance.UI.Feature.PageNavigation,
            instance.UI.Feature.Ribbons,
            instance.UI.Feature.ThumbnailPanel,
            instance.UI.Feature.OutlinePanel,
            instance.UI.Feature.BookmarkPanel,
            instance.UI.Feature.LayersPanel,
            instance.UI.Feature.SignaturePanel,
            instance.UI.Feature.RubberStampPanel,
            instance.UI.Feature.RedactionPanel,
            instance.UI.Feature.TextEditingPanel,
            instance.UI.Feature.WatermarkPanel,
            instance.UI.Feature.PageManipulationOverlay,
            instance.UI.Feature.MouseWheelZoom,
            instance.UI.Feature.TouchScrollLock
          ]);

          // Disable service worker for development
          // Service worker is disabled via disableWebsockets: true

          // Document loaded event
          documentViewer.addEventListener('documentLoaded', () => {
            console.log('Document loaded successfully');
            
            // Enable content editing mode by default
            instance.UI.setToolMode(instance.Core.Tools.ToolNames.CONTENT_EDIT);
          });

          // Error handling
          documentViewer.addEventListener('documentLoadError', (error: any) => {
            console.error('Document load error:', error);
          });

          // Disable service worker warnings
          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(let registration of registrations) {
                registration.unregister();
              }
            });
          }
        })
        .catch((error) => {
          console.error('WebViewer initialization error:', error);
          setIsLoading(false);
        });
    }
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && webViewerInstance) {
      const fileURL = URL.createObjectURL(file);
      webViewerInstance.UI.loadDocument(fileURL, { filename: file.name });
    }
  };

  const handleDownload = () => {
    if (webViewerInstance) {
      const { documentViewer } = webViewerInstance.Core;
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
              disabled={!webViewerInstance}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                webViewerInstance
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
          ref={viewer} 
          className="w-full h-full"
          style={{ minHeight: '600px' }}
        />
      </div>

      {/* Instructions */}
      {!isLoading && !webViewerInstance && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
          <div className="text-center max-w-md">
            <FileText className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Professional PDF Editor</h2>
            <p className="text-gray-400 mb-6">
              Upload a PDF to start editing with advanced tools including text editing, 
              annotations, forms, and more.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
            >
              Upload Your First PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApryseEditor;