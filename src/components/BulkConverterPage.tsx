import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, X, RotateCcw, FileText, Image, File, Zap, AlertCircle, Info, Archive, Settings, Shield, Eye, Layers, MessageSquare, ImageIcon, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { convertFile, createZipDownload, getFileTypeInfo, getValidTargetFormats, getConversionError } from '../utils/bulkConverter';

// Put these above `const BulkConverterPage: React.FC = () => { ... }`
type TargetFormat = 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx';

// Preference order for auto-grouping (tune as you like)
const TARGET_PREFERENCE: TargetFormat[] = ['pdf', 'png', 'jpg', 'csv', 'txt', 'docx'];

// Preservation settings interface
interface PreservationSettings {
  fidelity: 'best' | 'balanced' | 'fast';
  pdfForms: 'keep' | 'flatten';
  docxTrackedChanges: 'accept' | 'reject' | 'keep';
  comments: 'keep' | 'remove';
  imageHandling: 'auto' | 'lossless' | 'lossy';
  imageQuality: number; // 60-95 for lossy
}

// Preflight analysis interface
interface PreflightInfo {
  hasEmbeddedFonts: boolean;
  hasForms: boolean;
  hasTrackedChanges: boolean;
  hasComments: boolean;
  hasOversizedImages: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

/** For a single file, return the formats that make sense for THAT file */
function getAllowedTargetsForFile(file: File): TargetFormat[] {
  const info = getFileTypeInfo(file);
  const formats = getValidTargetFormats([info]); // your util already returns objects with {format,label,...}
  return formats.map((f) => f.format as TargetFormat);
}

/** Choose a "primary" target for a file, following our preference order */
function pickPrimaryTarget(file: File): TargetFormat | null {
  const allowed = getAllowedTargetsForFile(file);
  for (const f of TARGET_PREFERENCE) {
    if (allowed.includes(f)) return f;
  }
  return null; // truly incompatible/unknown
}

interface QueueItem {
  id: string;
  file: File;
  filename: string;
  size: number;
  type: string;
  status: 'queued' | 'converting' | 'completed' | 'failed';
  progress: number;
  error?: string;
  convertedBlob?: Blob;
}

const BulkConverterPage: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx'>('pdf');
  const [isConverting, setIsConverting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'compatible' | 'incompatible'>('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedTypeTargets, setSelectedTypeTargets] = useState<Record<string, TargetFormat>>({});
  const [selectedFileTypes, setSelectedFileTypes] = useState<Set<string>>(new Set());
  const [bulkTargetFormats, setBulkTargetFormats] = useState<Record<string, TargetFormat>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>({
    pdf: true,
    image: true,
    doc: true,
    slide: true,
    sheet: true,
    csv: true,
    text: true,
    other: true,
  });
  const [preservationSettings, setPreservationSettings] = useState<PreservationSettings>({
    fidelity: 'balanced',
    pdfForms: 'keep',
    docxTrackedChanges: 'accept',
    comments: 'keep',
    imageHandling: 'auto',
    imageQuality: 80,
  });
  const [preflightData, setPreflightData] = useState<Map<string, PreflightInfo>>(new Map());
  const [showPreservationPanel, setShowPreservationPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze file for preflight information
  const analyzeFile = useCallback(async (item: QueueItem): Promise<PreflightInfo> => {
    const info = getFileTypeInfo(item.file);
    const analysis: PreflightInfo = {
      hasEmbeddedFonts: false,
      hasForms: false,
      hasTrackedChanges: false,
      hasComments: false,
      hasOversizedImages: false,
      riskLevel: 'low',
      warnings: [],
    };

    // Basic analysis based on file type and size
    if (info.category === 'pdf') {
      analysis.hasEmbeddedFonts = true; // Assume PDFs have embedded fonts
      analysis.hasForms = item.filename.toLowerCase().includes('form');
      if (item.size > 10 * 1024 * 1024) { // > 10MB
        analysis.hasOversizedImages = true;
        analysis.warnings.push('Large file size may indicate high-res images');
      }
    }

    if (info.category === 'document') {
      analysis.hasTrackedChanges = item.filename.toLowerCase().includes('track') || 
                                   item.filename.toLowerCase().includes('review');
      analysis.hasComments = true; // Assume DOCX files may have comments
      if (item.size > 5 * 1024 * 1024) { // > 5MB
        analysis.hasOversizedImages = true;
        analysis.warnings.push('Large document may contain high-res images');
      }
    }

    if (info.category === 'image' && item.size > 2 * 1024 * 1024) { // > 2MB
      analysis.hasOversizedImages = true;
      analysis.warnings.push('High resolution image');
    }

    // Determine risk level
    const conversionError = getConversionError(info, targetFormat);
    if (conversionError) {
      analysis.riskLevel = 'high';
      analysis.warnings.push(conversionError);
    } else if (targetFormat === 'docx' && info.category === 'pdf') {
      analysis.riskLevel = 'high';
      analysis.warnings.push('PDF→DOCX may alter layout (Beta feature)');
    } else if (analysis.hasOversizedImages || analysis.hasForms || analysis.hasTrackedChanges) {
      analysis.riskLevel = 'medium';
    }

    return analysis;
  }, [targetFormat]);

  // Update preflight data when queue or target format changes
  React.useEffect(() => {
    const updatePreflightData = async () => {
      const newPreflightData = new Map<string, PreflightInfo>();
      
      for (const item of queue) {
        const analysis = await analyzeFile(item);
        newPreflightData.set(item.id, analysis);
      }
      
      setPreflightData(newPreflightData);
    };

    if (queue.length > 0) {
      updatePreflightData();
    }
  }, [queue, targetFormat, analyzeFile]);

  // Get relevant preservation settings for selected files
  const getRelevantSettings = useCallback(() => {
    const selectedItems = queue.filter(item => selectedIds.has(item.id));
    const fileTypes = selectedItems.map(item => getFileTypeInfo(item.file));
    
    const relevant = {
      showPdfForms: fileTypes.some(f => f.category === 'pdf'),
      showDocxTrackedChanges: fileTypes.some(f => f.category === 'document'),
      showComments: fileTypes.some(f => ['document', 'pdf'].includes(f.category)),
      showImageHandling: fileTypes.some(f => f.category === 'image') || 
                        selectedItems.some(item => preflightData.get(item.id)?.hasOversizedImages),
    };
    
    return relevant;
  }, [queue, selectedIds, preflightData]);

  // Group files by their *own* best target, plus collect truly incompatible ones
  const groups = React.useMemo(() => {
    const map: Record<TargetFormat, QueueItem[]> = {
      pdf: [], png: [], jpg: [], txt: [], csv: [], docx: []
    };
    const incompatible: QueueItem[] = [];

    for (const item of queue) {
      const primary = pickPrimaryTarget(item.file);
      if (primary) map[primary].push(item);
      else incompatible.push(item);
    }

    return { map, incompatible };
  }, [queue]);

  const MAX_FILES = 100;
  const MAX_FILE_SIZE_MB = 50;

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return FileText;
    if (type.includes('image')) return Image;
    return File;
  };

  const getFileTypeLabel = (filename: string, mimeType: string) => {
    const fileTypeInfo = getFileTypeInfo({ name: filename, type: mimeType } as File);
    return fileTypeInfo.extension.toUpperCase() || 'FILE';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getBucketForFile = (file: File): string => {
    const ext = getFileTypeInfo(file).extension?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['png','jpg','jpeg','webp','tiff','svg'].includes(ext)) return 'image';
    if (['doc','docx','rtf','odt'].includes(ext)) return 'doc';
    if (['ppt','pptx','odp'].includes(ext)) return 'slide';
    if (['xls','xlsx','ods'].includes(ext)) return 'sheet';
    if (ext === 'csv') return 'csv';
    if (['txt','md','json'].includes(ext)) return 'text';
    return 'other';
  };

  const handleFileTypeToggle = (key: string) => {
    setTypeFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Is a queue item compatible with the current target?
  const isItemCompatible = React.useCallback((item: QueueItem) => {
    const info = getFileTypeInfo(item.file);
    return getConversionError(info, targetFormat) === null;
  }, [targetFormat]);

  // Should we show "Select all" for this list of items (e.g., a group)?
  function showSelectAllButton(items: QueueItem[]) {
    return items.some(it => isItemCompatible(it) && !selectedIds.has(it.id));
  }

  // Toggle a single item's selection
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Select all compatible items in a list
  function selectAll(items: QueueItem[]) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const it of items) if (isItemCompatible(it)) next.add(it.id);
      return next;
    });
  }

  // Clear selection for a list
  function clearSelection(items: QueueItem[]) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const it of items) next.delete(it.id);
      return next;
    });
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFilesToQueue(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
    }
  }, []);

  const addFilesToQueue = (files: File[]) => {
    if (queue.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB)`);
        return false;
      }
      return true;
    });

    const newItems: QueueItem[] = validFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      filename: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      status: 'queued',
      progress: 0,
    }));

    setQueue(prev => [...prev, ...newItems]);
    toast.success(`Added ${validFiles.length} file(s) to queue`);

    // Auto-adjust target format based on file types
    const allFiles = [...queue, ...newItems];
    const fileTypes = allFiles.map(item => getFileTypeInfo(item.file));
    const validFormats = getValidTargetFormats(fileTypes);

    if (validFormats.length > 0 && !validFormats.some(f => f.format === targetFormat)) {
      setTargetFormat(validFormats[0].format);
      toast('Target format changed based on selected files');
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const retryItem = async (id: string) => {
    const item = queue.find(q => q.id === id);
    if (!item) return;

    setQueue(prev => prev.map(q =>
      q.id === id
        ? { ...q, status: 'converting', progress: 0, error: undefined }
        : q
    ));

    try {
      const convertedBlob = await convertFile(item.file, targetFormat, (progress) => {
        setQueue(prev => prev.map(q =>
          q.id === id ? { ...q, progress } : q
        ));
      });

      setQueue(prev => prev.map(q =>
        q.id === id
          ? { ...q, status: 'completed', progress: 100, convertedBlob }
          : q
      ));
    } catch (error) {
      setQueue(prev => prev.map(q =>
        q.id === id
          ? { ...q, status: 'failed', error: error instanceof Error ? error.message : 'Conversion failed' }
          : q
      ));
    }
  };

  const convertAll = async () => {
    const queuedItems = queue.filter(item => item.status === 'queued' || item.status === 'failed');
    const invalidItems = queuedItems.filter(item => {
      const fileTypeInfo = getFileTypeInfo(item.file);
      return getConversionError(fileTypeInfo, targetFormat) !== null;
    });

    if (invalidItems.length > 0) {
      const firstError = getConversionError(getFileTypeInfo(invalidItems[0].file), targetFormat);
      toast.error(firstError || 'Some files cannot be converted to the selected format');
      return;
    }

    if (queuedItems.length === 0) {
      toast.error('No files to convert');
      return;
    }

    setIsConverting(true);
    setOverallProgress(0);

    let completed = 0;
    const total = queuedItems.length;

    for (const item of queuedItems) {
      setQueue(prev => prev.map(q =>
        q.id === item.id
          ? { ...q, status: 'converting', progress: 0, error: undefined }
          : q
      ));

      try {
        const convertedBlob = await convertFile(item.file, targetFormat, (progress) => {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, progress } : q
          ));
        },
        preservationSettings
        );

        setQueue(prev => prev.map(q =>
          q.id === item.id
            ? { ...q, status: 'completed', progress: 100, convertedBlob }
            : q
        ));
      } catch (error) {
        setQueue(prev => prev.map(q =>
          q.id === item.id
            ? { ...q, status: 'failed', error: error instanceof Error ? error.message : 'Conversion failed' }
            : q
        ));
      }

      completed++;
      setOverallProgress((completed / total) * 100);
    }

    setIsConverting(false);

    const successCount = queue.filter(q => q.status === 'completed').length;
    const failedCount = queue.filter(q => q.status === 'failed').length;

    if (successCount > 0) {
      toast.success(`Converted ${successCount} file(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
    } else {
      toast.error('All conversions failed');
    }
  };

  async function convertSpecific(items: QueueItem[], target: TargetFormat) {
    // Validate items against target
    const invalid = items.filter((it) => {
      const info = getFileTypeInfo(it.file);
      return getConversionError(info, target) !== null;
    });
    if (invalid.length) {
      const firstErr = getConversionError(getFileTypeInfo(invalid[0].file), target);
      toast.error(firstErr || 'Some files cannot be converted to this format');
      return;
    }

    setIsConverting(true);
    let completed = 0;
    const total = items.length;
    setOverallProgress(0);

    for (const item of items) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id ? { ...q, status: 'converting', progress: 0, error: undefined } : q
        )
      );

      try {
        const convertedBlob = await convertFile(item.file, target, (progress) => {
          setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, progress } : q)));
        });

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'completed', progress: 100, convertedBlob } : q
          )
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Conversion failed',
                }
              : q
          )
        );
      }

      completed++;
      setOverallProgress((completed / total) * 100);
    }

    setIsConverting(false);
    toast.success(`Converted ${completed} file(s) to ${target.toUpperCase()}`);
  }

  const downloadZip = async () => {
    const completedItems = queue.filter(item => item.status === 'completed' && item.convertedBlob);

    if (completedItems.length === 0) {
      toast.error('No converted files to download');
      return;
    }

    try {
      await createZipDownload(completedItems, targetFormat);
      toast.success('ZIP download started');
    } catch {
      toast.error('Failed to create ZIP file');
    }
  };

  const queuedCount = queue.filter(q => q.status === 'queued').length;
  const convertingCount = queue.filter(q => q.status === 'converting').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  const getFilteredQueue = () => {
    let base = queue;
    if (queueFilter !== 'all') {
      base = base.filter(item => {
        const fileTypeInfo = getFileTypeInfo(item.file);
        const conversionError = getConversionError(fileTypeInfo, targetFormat);
        return queueFilter === 'compatible' ? conversionError === null : conversionError !== null;
      });
    }
    // Apply type filters
    return base.filter(item => {
      const bucket = getBucketForFile(item.file);
      return typeFilters[bucket] ?? true; // default true if unknown
    });
  };

  const getUnfilteredCompatibilityData = () => {
    return queue.filter(item => {
      const fileTypeInfo = getFileTypeInfo(item.file);
      const conversionError = getConversionError(fileTypeInfo, targetFormat);
      return conversionError === null;
    });
  };

  const filteredQueue = getFilteredQueue();
  const compatibleItems = getUnfilteredCompatibilityData();
  const compatibleCount = compatibleItems.length;
  const incompatibleCount = queue.length - compatibleCount;

  const fileTypes = queue.map(item => getFileTypeInfo(item.file));
  const validFormats = getValidTargetFormats(fileTypes);
  const currentFormatInfo = validFormats.find(f => f.format === targetFormat);

  // Get file type groups for selection
  const fileTypeGroups = React.useMemo(() => {
    const typeMap = new Map<string, { files: QueueItem[], icon: any, label: string }>();
    
    queue.forEach(item => {
      const info = getFileTypeInfo(item.file);
      const key = info.category;
      
      if (!typeMap.has(key)) {
        let icon = File;
        let label = 'Other Files';
        
        switch (key) {
          case 'document':
            icon = FileText;
            label = 'Documents';
            break;
          case 'image':
            icon = Image;
            label = 'Images';
            break;
          case 'pdf':
            icon = FileText;
            label = 'PDFs';
            break;
          case 'spreadsheet':
            icon = FileText;
            label = 'Spreadsheets';
            break;
          case 'text':
            icon = FileText;
            label = 'Text Files';
            break;
        }
        
        typeMap.set(key, { files: [], icon, label });
      }
      
      typeMap.get(key)!.files.push(item);
    });
    
    return Array.from(typeMap.entries()).map(([key, data]) => ({
      key,
      ...data,
      count: data.files.length
    }));
  }, [queue]);

  // Helper functions for selection
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllOfType = (fileType: string) => {
    const group = fileTypeGroups.find(g => g.key === fileType);
    if (!group) return;
    
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      group.files.forEach(file => newSet.add(file.id));
      return newSet;
    });
  };

  const getSelectedFilesByType = () => {
    const typeMap = new Map<string, QueueItem[]>();
    
    selectedFiles.forEach(fileId => {
      const file = queue.find(q => q.id === fileId);
      if (file) {
        const info = getFileTypeInfo(file.file);
        const key = info.category;
        
        if (!typeMap.has(key)) {
          typeMap.set(key, []);
        }
        typeMap.get(key)!.push(file);
      }
    });
    
    return typeMap;
  };

  const convertSelectedFiles = async () => {
    const selectedFilesByType = getSelectedFilesByType();
    setIsConverting(true);
    let totalCompleted = 0;
    const totalFiles = selectedFiles.size;
    setOverallProgress(0);

    for (const [fileType, files] of selectedFilesByType) {
      const targetFormat = selectedTypeTargets[fileType] || pickPrimaryTarget(files[0].file) || 'pdf';
      
      for (const item of files) {
        setQueue(prev => prev.map(q =>
          q.id === item.id
            ? { ...q, status: 'converting', progress: 0, error: undefined }
            : q
        ));

        try {
          const convertedBlob = await convertFile(item.file, targetFormat, (progress) => {
            setQueue(prev => prev.map(q =>
              q.id === item.id ? { ...q, progress } : q
            ));
          });

          setQueue(prev => prev.map(q =>
            q.id === item.id
              ? { ...q, status: 'completed', progress: 100, convertedBlob }
              : q
          ));
        } catch (error) {
          setQueue(prev => prev.map(q =>
            q.id === item.id
              ? { ...q, status: 'failed', error: error instanceof Error ? error.message : 'Conversion failed' }
              : q
          ));
        }

        totalCompleted++;
        setOverallProgress((totalCompleted / totalFiles) * 100);
      }
    }

    setIsConverting(false);
    setSelectedFiles(new Set());
    toast.success(`Converted ${totalCompleted} selected file(s)`);
  };

  const handleBulkTargetChange = (fileType: string, target: TargetFormat) => {
    setBulkTargetFormats(prev => ({
      ...prev,
      [fileType]: target
    }));
  };

  const setTargetForSelectedType = (fileType: string, target: TargetFormat) => {
    setSelectedTypeTargets(prev => ({
      ...prev,
      [fileType]: target
    }));
  };

  return (
    <div>
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-white">Bulk Converter</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-400 text-sm">
              {queue.length} file{queue.length !== 1 ? 's' : ''} queued
            </span>
            {queue.length > 0 && (
              <button
                onClick={() => setShowPreservationPanel(!showPreservationPanel)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  showPreservationPanel 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Preservation</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Target Format:</label>
            <select
              value={targetFormat}
              disabled={compatibleCount === 0 || isConverting}
              onChange={(e) => setTargetFormat(e.target.value as typeof targetFormat)}
              className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {validFormats.length === 0 ? (
                <option value="pdf">PDF (add files to see options)</option>
              ) : (
                validFormats.map(format => (
                  <option key={format.format} value={format.format}>
                    {format.label} - {format.description}{format.willZip ? ' (ZIP)' : ''}
                  </option>
                ))
              )}
            </select>
            {currentFormatInfo?.willZip && (
              <div className="flex items-center space-x-1 text-xs text-blue-400">
                <Archive className="w-3 h-3" />
                <span>Will create ZIP</span>
              </div>
            )}
          </div>

          {currentFormatInfo?.warning && (
            <div className="flex items-center space-x-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
              <Info className="w-3 h-3" />
              <span>{currentFormatInfo.warning}</span>
            </div>
          )}

          <button
            onClick={convertAll}
            disabled={queuedCount === 0 || isConverting || compatibleCount === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              queuedCount > 0 && !isConverting && compatibleCount > 0
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>{isConverting ? 'Converting...' : 'Convert All'}</span>
          </button>

          {selectedFiles.size > 0 && (
            <button
              onClick={convertSelectedFiles}
              disabled={isConverting}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-medium text-sm"
            >
              <Zap className="w-4 h-4" />
              <span>Convert Selected ({selectedFiles.size})</span>
            </button>
          )}

          {selectedIds.size > 0 && (
            <button
              onClick={() => {
                const selectedItems = queue.filter(item => selectedIds.has(item.id));
                convertSpecific(selectedItems.filter(item => item.status !== 'completed'), pickPrimaryTarget(selectedItems[0].file) || 'pdf');
              }}
              disabled={isConverting}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors font-medium text-sm"
            >
              <Zap className="w-4 h-4" />
              <span>Convert Selected ({selectedIds.size})</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              onClick={downloadZip}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP ({completedCount})</span>
            </button>
          )}
        </div>

        {/* Overall Progress */}
        {isConverting && (
          <div className="mt-4">
            <div className="bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Overall Progress: {Math.round(overallProgress)}%
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className={`grid gap-6 h-full ${showPreservationPanel ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {/* Drop Zone */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Upload Files</h2>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                compatibleCount > 0 && !isConverting
                  ? 'border-purple-500 bg-purple-500/10 scale-105'
                  : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'
              }`}
            >
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <span>{isConverting ? 'Converting...' : `Convert Compatible (${compatibleCount})`}</span>
                  <Upload className="w-8 h-8 text-white" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    {isDragging ? 'Drop your files here' : 'Upload documents'}
                  </h3>
                  <p className="text-gray-400">Drag and drop files or click to browse</p>
                </div>

                <div className="flex justify-center space-x-4 text-sm text-gray-500">
                  <span>Documents, Spreadsheets, Presentations, Images, Text</span>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.png,.jpg,.jpeg,.csv,.json,.rtf,.odt,.ods,.odp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 transform hover:scale-105"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Files</span>
                  </button>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <p>Maximum {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB per file</p>
                  <p>Files are processed locally and never leave your device</p>
                </div>
              </div>
            </div>
          </div>

          {/* Queue */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Conversion Queue</h2>
              {queue.length > 0 && (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setQueue([])}
                    className="text-red-400 hover:text-red-300 text-sm"
                    disabled={isConverting}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-8 text-center">
                <File className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No files in queue</p>
                <p className="text-sm text-gray-500 mt-2">Upload files to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  {filteredQueue.map((item) => {
                    const Icon = getFileIcon(item.type);
                    const typeLabel = getFileTypeLabel(item.filename, item.type);
                    const fileTypeInfo = getFileTypeInfo(item.file);
                    const conversionError = getConversionError(fileTypeInfo, targetFormat);
                    const isCompatible = conversionError === null;
                    const preflight = preflightData.get(item.id);

                    return (
                      <div key={item.id} className={`border-b border-gray-700 last:border-b-0 p-4 ${!isCompatible ? 'bg-orange-500/5' : ''}`}>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelect(item.id)}
                              className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                            />
                          </div>

                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              item.status === 'completed' ? 'bg-green-500' :
                              item.status === 'failed' ? 'bg-red-500' :
                              item.status === 'converting' ? 'bg-blue-500' :
                              !isCompatible ? 'bg-orange-500' :
                              'bg-gray-600'
                            }`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-white truncate">
                                {item.filename}
                              </p>
                              <div className="flex items-center space-x-2">
                                {/* Preflight badges */}
                                {preflight && (
                                  <div className="flex items-center space-x-1">
                                    {preflight.hasEmbeddedFonts && (
                                      <div className="w-4 h-4 bg-blue-500/20 rounded flex items-center justify-center" title="Embedded fonts">
                                        <FileText className="w-2.5 h-2.5 text-blue-400" />
                                      </div>
                                    )}
                                    {preflight.hasForms && (
                                      <div className="w-4 h-4 bg-green-500/20 rounded flex items-center justify-center" title="PDF forms">
                                        <Layers className="w-2.5 h-2.5 text-green-400" />
                                      </div>
                                    )}
                                    {preflight.hasTrackedChanges && (
                                      <div className="w-4 h-4 bg-yellow-500/20 rounded flex items-center justify-center" title="Tracked changes">
                                        <Eye className="w-2.5 h-2.5 text-yellow-400" />
                                      </div>
                                    )}
                                    {preflight.hasComments && (
                                      <div className="w-4 h-4 bg-purple-500/20 rounded flex items-center justify-center" title="Comments">
                                        <MessageSquare className="w-2.5 h-2.5 text-purple-400" />
                                      </div>
                                    )}
                                    {preflight.hasOversizedImages && (
                                      <div className="w-4 h-4 bg-orange-500/20 rounded flex items-center justify-center" title="Large images">
                                        <ImageIcon className="w-2.5 h-2.5 text-orange-400" />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Risk level indicator */}
                                {preflight && (
                                  <div className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded ${
                                    preflight.riskLevel === 'low' ? 'bg-green-500/20 text-green-400' :
                                    preflight.riskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-red-500/20 text-red-400'
                                  }`}>
                                    {preflight.riskLevel === 'low' ? (
                                      <CheckCircle className="w-3 h-3" />
                                    ) : (
                                      <AlertTriangle className="w-3 h-3" />
                                    )}
                                    <span>
                                      {preflight.riskLevel === 'low' ? 'High Fidelity' : 
                                       preflight.riskLevel === 'medium' ? 'May change layout' : 
                                       'High risk'}
                                    </span>
                                  </div>
                                )}

                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                  item.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                  item.status === 'converting' ? 'bg-blue-500/20 text-blue-400' :
                                  !isCompatible ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {!isCompatible ? 'incompatible' : item.status}
                                </span>
                                <button
                                  onClick={() => removeFromQueue(item.id)}
                                  className="text-gray-400 hover:text-red-400 transition-colors"
                                  disabled={item.status === 'converting'}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center space-x-2 text-xs text-gray-400">
                                <span className="bg-gray-700 px-2 py-0.5 rounded">{typeLabel}</span>
                                <span>{formatFileSize(item.size)}</span>
                              </div>

                              {item.status === 'failed' && (
                                <button
                                  onClick={() => retryItem(item.id)}
                                  className="flex items-center space-x-1 text-xs text-orange-400 hover:text-orange-300"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                              )}
                            </div>

                            {/* Preflight warnings */}
                            {preflight && preflight.warnings.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {preflight.warnings.map((warning, idx) => (
                                  <div key={idx} className="flex items-center space-x-1 text-xs text-orange-400">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>{warning}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.status === 'converting' && (
                              <div className="mt-2">
                                <div className="bg-gray-700 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {item.error && (
                              <div className="mt-2 flex items-center space-x-1 text-xs text-red-400">
                                <AlertCircle className="w-3 h-3" />
                                <span>{item.error}</span>
                              </div>
                            )}

                            {conversionError && (
                              <div className="mt-2 flex items-center space-x-1 text-xs text-orange-400">
                                <AlertCircle className="w-3 h-3" />
                                <span>{conversionError}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Incompatible bucket with guidance */}
                {groups.incompatible.length > 0 && (
                  <div className="mt-2 text-xs text-orange-400 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    <span>
                      {groups.incompatible.length} file{groups.incompatible.length !== 1 ? 's' : ''} have no obvious target. 
                      Try selecting them individually and picking a different format.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Overall Summary */}
            {queue.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Overall Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-400">{queuedCount}</div>
                    <div className="text-xs text-gray-500">Queued</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-blue-400">{convertingCount}</div>
                    <div className="text-xs text-gray-500">Converting</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-400">{completedCount}</div>
                    <div className="text-xs text-gray-500">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-red-400">{failedCount}</div>
                    <div className="text-xs text-gray-500">Failed</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preservation Panel */}
          {showPreservationPanel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Smart Formatting Preservation</span>
                </h2>
                <button
                  onClick={() => setShowPreservationPanel(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 space-y-6">
                {/* Fidelity Setting */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-300">Conversion Fidelity</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['fast', 'balanced', 'best'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setPreservationSettings(prev => ({ ...prev, fidelity: level }))}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          preservationSettings.fidelity === level
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {level === 'fast' ? 'Fast' : level === 'balanced' ? 'Balanced' : 'Best (slower)'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    {preservationSettings.fidelity === 'fast' ? 'Quick conversion, may lose some formatting' :
                     preservationSettings.fidelity === 'balanced' ? 'Good balance of speed and quality' :
                     'Maximum quality preservation, slower processing'}
                  </p>
                </div>

                {/* Contextual Settings */}
                {(() => {
                  const relevant = getRelevantSettings();
                  return (
                    <>
                      {/* PDF Forms/Annotations */}
                      {relevant.showPdfForms && (
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                            <Layers className="w-4 h-4" />
                            <span>PDF Forms/Annotations</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['keep', 'flatten'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setPreservationSettings(prev => ({ ...prev, pdfForms: option }))}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                                  preservationSettings.pdfForms === option
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {option === 'keep' ? 'Keep Interactive' : 'Flatten to Text'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* DOCX Tracked Changes */}
                      {relevant.showDocxTrackedChanges && (
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                            <Eye className="w-4 h-4" />
                            <span>DOCX Tracked Changes</span>
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['accept', 'reject', 'keep'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setPreservationSettings(prev => ({ ...prev, docxTrackedChanges: option }))}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                                  preservationSettings.docxTrackedChanges === option
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {option === 'accept' ? 'Accept All' : 
                                 option === 'reject' ? 'Reject All' : 'Keep as Markup'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comments */}
                      {relevant.showComments && (
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>Comments</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['keep', 'remove'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setPreservationSettings(prev => ({ ...prev, comments: option }))}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                                  preservationSettings.comments === option
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {option === 'keep' ? 'Keep Comments' : 'Remove Comments'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Image Handling */}
                      {relevant.showImageHandling && (
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-gray-300 flex items-center space-x-2">
                            <ImageIcon className="w-4 h-4" />
                            <span>Image Handling</span>
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['auto', 'lossless', 'lossy'] as const).map((option) => (
                              <button
                                key={option}
                                onClick={() => setPreservationSettings(prev => ({ ...prev, imageHandling: option }))}
                                className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                                  preservationSettings.imageHandling === option
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                              >
                                {option === 'auto' ? 'Auto' : 
                                 option === 'lossless' ? 'Lossless' : 'Lossy'}
                              </button>
                            ))}
                          </div>

                          {/* Quality Slider for Lossy */}
                          {preservationSettings.imageHandling === 'lossy' && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Quality</span>
                                <span className="text-xs text-gray-300">{preservationSettings.imageQuality}%</span>
                              </div>
                              <input
                                type="range"
                                min="60"
                                max="95"
                                step="5"
                                value={preservationSettings.imageQuality}
                                onChange={(e) => setPreservationSettings(prev => ({ 
                                  ...prev, 
                                  imageQuality: parseInt(e.target.value) 
                                }))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Beta Warning for Risky Conversions */}
                {queue.some(item => selectedIds.has(item.id) && 
                  preflightData.get(item.id)?.riskLevel === 'high') && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-orange-400 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">Beta Feature Warning</span>
                    </div>
                    <p className="text-xs text-orange-300">
                      Some selected conversions may significantly alter document layout or lose formatting. 
                      Review the output carefully and consider using alternative formats if layout preservation is critical.
                    </p>
                  </div>
                )}

                {/* Settings Summary */}
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Current Settings</h4>
                  <div className="space-y-1 text-xs text-gray-400">
                    <div>Fidelity: <span className="text-gray-300">{preservationSettings.fidelity}</span></div>
                    {getRelevantSettings().showPdfForms && (
                      <div>PDF Forms: <span className="text-gray-300">{preservationSettings.pdfForms}</span></div>
                    )}
                    {getRelevantSettings().showDocxTrackedChanges && (
                      <div>Tracked Changes: <span className="text-gray-300">{preservationSettings.docxTrackedChanges}</span></div>
                    )}
                    {getRelevantSettings().showComments && (
                      <div>Comments: <span className="text-gray-300">{preservationSettings.comments}</span></div>
                    )}
                    {getRelevantSettings().showImageHandling && (
                      <div>Images: <span className="text-gray-300">
                        {preservationSettings.imageHandling}
                        {preservationSettings.imageHandling === 'lossy' && ` (${preservationSettings.imageQuality}%)`}
                      </span></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkConverterPage;