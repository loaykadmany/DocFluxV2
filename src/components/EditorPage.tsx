import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, Split, Eye, Zap, Sliders, RotateCw, Trash2, Move, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import FileUpload from './FileUpload';
import PageThumbnail from './PageThumbnail';
import { PageData } from '../types';
import { processFiles } from '../utils/fileProcessor';
import { exportPDF, splitPDF } from '../utils/pdfExporter';
import { pdfjs } from '../lib/pdfjs';

const EditorPage: React.FC = () => {
  const [pages, setPages] = useState<PageData[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [compressionEnabled, setCompressionEnabled] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(80);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const fileArray = Array.from(files);
      const newPages = await processFiles(fileArray, (progress) => {
        setProcessingProgress(progress);
      });
      
      setPages(prevPages => [...prevPages, ...newPages]);
      toast.success(`Successfully processed ${fileArray.length} file(s)`);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process files. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, []);

  const handlePageReorder = useCallback((dragIndex: number, hoverIndex: number) => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      const draggedPage = newPages[dragIndex];
      newPages.splice(dragIndex, 1);
      newPages.splice(hoverIndex, 0, draggedPage);
      return newPages;
    });
  }, []);

  const handlePageRotate = useCallback((pageId: string) => {
    setPages(prevPages => 
      prevPages.map(page => 
        page.id === pageId 
          ? { ...page, rotation: (page.rotation + 90) % 360 }
          : page
      )
    );
  }, []);

  const handlePageDelete = useCallback((pageId: string) => {
    setPages(prevPages => prevPages.filter(page => page.id !== pageId));
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      newSet.delete(pageId);
      return newSet;
    });
  }, []);

  const handlePageSelect = useCallback((pageId: string, isSelected: boolean) => {
    setSelectedPages(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(pageId);
      } else {
        newSet.delete(pageId);
      }
      return newSet;
    });
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (pages.length === 0) {
      toast.error('No pages to export');
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      await exportPDF(pages, {
        ocrEnabled: true,
        compressionEnabled,
        compressionQuality,
        onProgress: setProcessingProgress
      });
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [pages, compressionEnabled, compressionQuality]);

  const handleSplitPDF = useCallback(async () => {
    if (selectedPages.size !== 1) {
      toast.error('Please select exactly one multi-page PDF to split');
      return;
    }

    const selectedPage = pages.find(page => selectedPages.has(page.id));
    if (!selectedPage || selectedPage.type !== 'pdf' || !selectedPage.totalPages || selectedPage.totalPages <= 1) {
      toast.error('Please select a multi-page PDF to split');
      return;
    }

    setIsProcessing(true);
    try {
      // Split the PDF into individual pages
      const newPages = await processPDF(selectedPage.originalFile);
      
      // Replace the original multi-page PDF with individual pages
      setPages(prevPages => {
        const otherPages = prevPages.filter(page => page.id !== selectedPage.id);
        return [...otherPages, ...newPages];
      });
      
      // Clear selection
      setSelectedPages(new Set());
      
      toast.success(`PDF split into ${newPages.length} individual pages!`);
    } catch (error) {
      console.error('Split error:', error);
      toast.error('Failed to split PDF');
    } finally {
      setIsProcessing(false);
    }
  }, [pages, selectedPages, setPages, setSelectedPages]);

  // Import the processPDF function for splitting
  const processPDF = async (file: File): Promise<PageData[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    const newPages: PageData[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.5 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      
      newPages.push({
        id: `${file.name}-${pageNum}-${Date.now()}`,
        thumbnail,
        filename: `${file.name} - Page ${pageNum}`,
        type: 'pdf',
        originalFile: file,
        pageNumber: pageNum,
        rotation: 0,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return newPages;
  };
  const handleMergePDF = useCallback(async () => {
    const pagesToMerge = selectedPages.size > 0 
      ? pages.filter(page => selectedPages.has(page.id))
      : pages;

    if (pagesToMerge.length === 0) {
      toast.error('No pages to merge');
      return;
    }

    // Check if we have multi-page PDFs that need to be split for merging
    const hasMultiPagePDF = pagesToMerge.some(page => 
      page.type === 'pdf' && page.totalPages && page.totalPages > 1
    );
    
    let finalPagesToMerge = pagesToMerge;
    
    if (hasMultiPagePDF && pagesToMerge.length > 1) {
      // Auto-split multi-page PDFs when merging with other files
      finalPagesToMerge = [];
      
      for (const page of pagesToMerge) {
        if (page.type === 'pdf' && page.totalPages && page.totalPages > 1) {
          // Split this multi-page PDF
          const splitPages = await processPDF(page.originalFile);
          finalPagesToMerge.push(...splitPages);
        } else {
          finalPagesToMerge.push(page);
        }
      }
      
      toast('Multi-page PDFs automatically split for merging');
    }
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      await exportPDF(finalPagesToMerge, {
        ocrEnabled: true,
        compressionEnabled,
        compressionQuality,
        onProgress: setProcessingProgress,
        filename: selectedPages.size > 0 ? 'selected-merged.pdf' : 'merged-document.pdf'
      });
      toast.success(`${selectedPages.size > 0 ? 'Selected files' : 'All files'} merged successfully!`);
    } catch (error) {
      console.error('Merge error:', error);
      toast.error('Failed to merge PDF');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [pages, selectedPages, compressionEnabled, compressionQuality]);

  // Check if we should show split or merge button
  const shouldShowSplit = () => {
    if (selectedPages.size !== 1) return false;
    const selectedPage = pages.find(page => selectedPages.has(page.id));
    return selectedPage?.type === 'pdf' && selectedPage.totalPages && selectedPage.totalPages > 1;
  };

  const shouldShowMerge = () => {
    const uniqueFiles = new Set(pages.map(page => page.originalFile.name));
    return uniqueFiles.size > 1;
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-white">PDF Editor</h1>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <span className="text-gray-400 text-sm sm:text-base">
              {pages.length} page{pages.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="mt-4">
            <div className="bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Processing... {Math.round(processingProgress)}%
            </p>
          </div>
        )}
      </header>

      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* File Operations */}
          <div className="flex items-center space-x-2 border-r border-gray-600 pr-3 sm:pr-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs sm:text-sm"
            >
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Upload Files</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Processing Options */}
          <div className="flex items-center space-x-2 sm:space-x-3 border-r border-gray-600 pr-3 sm:pr-4">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
              <span className="text-xs sm:text-sm text-gray-300">Image Compression</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={compressionEnabled}
                  onChange={(e) => setCompressionEnabled(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-8 h-4 sm:w-10 sm:h-5 rounded-full transition-colors ${compressionEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                  <div className={`w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full transition-transform transform ${compressionEnabled ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                </div>
              </label>
            </div>

            {compressionEnabled && (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Sliders className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                <span className="text-xs text-gray-300">Quality:</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={compressionQuality}
                  onChange={(e) => setCompressionQuality(parseInt(e.target.value))}
                  className="w-16 sm:w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-xs text-gray-400 w-8">{compressionQuality}%</span>
              </div>
            )}
          </div>

          {/* Selection Info */}
          {selectedPages.size > 0 && (
            <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-400">
              <span>{selectedPages.size} pages selected</span>
            </div>
          )}

          {/* Export Actions */}
          <div className="flex items-center space-x-2 ml-auto">
            <button
              onClick={handleSplitPDF}
              disabled={isProcessing || !shouldShowSplit()}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                shouldShowSplit() && !isProcessing
                  ? 'bg-orange-600 text-white hover:bg-orange-700 cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <Split className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Split Selected</span>
            </button>
            
            <button
              onClick={handleMergePDF}
              disabled={isProcessing || !shouldShowMerge()}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                shouldShowMerge() && !isProcessing
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{selectedPages.size > 0 ? 'Merge Selected Files' : 'Merge All'}</span>
            </button>
            
            <button
              onClick={handleExportPDF}
              disabled={pages.length === 0 || isProcessing}
              className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm ${
                pages.length > 0 && !isProcessing
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 cursor-pointer'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Export as PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Editor Area */}
        <div className="p-3 sm:p-6">
          {pages.length === 0 ? (
            <FileUpload onFileUpload={handleFileUpload} />
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Page Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {pages.map((page, index) => (
                  <PageThumbnail
                    key={page.id}
                    page={page}
                    index={index}
                    isSelected={selectedPages.has(page.id)}
                    onReorder={handlePageReorder}
                    onRotate={handlePageRotate}
                    onDelete={handlePageDelete}
                    onSelect={handlePageSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;