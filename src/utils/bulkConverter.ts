import { PDFDocument, rgb } from 'pdf-lib';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { createWorker } from 'tesseract.js';
import { pdfjs } from '../lib/pdfjs';

// File type detection and validation
export interface FileTypeInfo {
  category: 'document' | 'image' | 'spreadsheet' | 'presentation' | 'text' | 'pdf' | 'unknown';
  extension: string;
  mimeType: string;
}

export const getFileTypeInfo = (file: File): FileTypeInfo => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type;

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { category: 'pdf', extension, mimeType };
  }
  
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(extension)) {
    return { category: 'image', extension, mimeType };
  }
  
  if (['docx', 'doc', 'rtf', 'odt'].includes(extension)) {
    return { category: 'document', extension, mimeType };
  }
  
  if (['xlsx', 'xls', 'csv', 'ods'].includes(extension)) {
    return { category: 'spreadsheet', extension, mimeType };
  }
  
  if (['pptx', 'ppt', 'odp'].includes(extension)) {
    return { category: 'presentation', extension, mimeType };
  }
  
  if (['txt', 'md', 'json'].includes(extension) || mimeType.startsWith('text/')) {
    return { category: 'text', extension, mimeType };
  }
  
  return { category: 'unknown', extension, mimeType };
};

// Conversion compatibility matrix
export const getValidTargetFormats = (fileTypes: FileTypeInfo[]): Array<{
  format: 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx';
  label: string;
  description: string;
  willZip: boolean;
  warning?: string;
}> => {
  if (fileTypes.length === 0) return [];
  
  const categories = [...new Set(fileTypes.map(f => f.category))];
  const validFormats: Array<{
    format: 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx';
    label: string;
    description: string;
    willZip: boolean;
    warning?: string;
  }> = [];
  
  // PDF is almost always valid (except for some edge cases)
  if (!categories.includes('unknown')) {
    validFormats.push({
      format: 'pdf',
      label: 'PDF',
      description: 'Universal document format',
      willZip: false
    });
  }
  
  // Images can convert to other image formats
  if (categories.every(cat => ['image', 'pdf'].includes(cat))) {
    validFormats.push({
      format: 'png',
      label: 'PNG',
      description: 'High-quality images',
      willZip: fileTypes.some(f => f.category === 'pdf'),
      warning: fileTypes.some(f => f.category === 'pdf') ? 'PDFs will create one image per page' : undefined
    });
    
    validFormats.push({
      format: 'jpg',
      label: 'JPG',
      description: 'Compressed images',
      willZip: fileTypes.some(f => f.category === 'pdf'),
      warning: fileTypes.some(f => f.category === 'pdf') ? 'PDFs will create one image per page' : undefined
    });
  }
  
  // Text extraction is possible from most document types
  if (categories.every(cat => ['document', 'pdf', 'text', 'spreadsheet'].includes(cat))) {
    validFormats.push({
      format: 'txt',
      label: 'TXT',
      description: 'Plain text extraction',
      willZip: false
    });
  }
  
  // CSV for spreadsheets and some text formats
  if (categories.every(cat => ['spreadsheet', 'text'].includes(cat))) {
    validFormats.push({
      format: 'csv',
      label: 'CSV',
      description: 'Comma-separated values',
      willZip: fileTypes.some(f => f.extension === 'xlsx' || f.extension === 'xls')
    });
  }
  
  // DOCX conversion (limited support)
  if (categories.every(cat => ['text', 'pdf'].includes(cat))) {
    validFormats.push({
      format: 'docx',
      label: 'DOCX',
      description: 'Word document',
      willZip: false,
      warning: fileTypes.some(f => f.category === 'pdf') ? 'PDF to DOCX may alter layout (beta feature)' : undefined
    });
  }
  
  return validFormats;
};

// Group files by their compatibility patterns
export interface CompatibilityGroup {
  id: string;
  name: string;
  description: string;
  fileIds: string[];
  validFormats: Array<{
    format: 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx';
    label: string;
    description: string;
    willZip: boolean;
    warning?: string;
  }>;
  suggestedFormat: 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx';
}

export const groupFilesByCompatibility = (files: Array<{ id: string; file: File }>): CompatibilityGroup[] => {
  const groups: CompatibilityGroup[] = [];
  const processedFileIds = new Set<string>();

  // Group by file type categories
  const categoryGroups = new Map<string, Array<{ id: string; file: File; typeInfo: FileTypeInfo }>>();
  
  files.forEach(({ id, file }) => {
    if (processedFileIds.has(id)) return;
    
    const typeInfo = getFileTypeInfo(file);
    const key = typeInfo.category;
    
    if (!categoryGroups.has(key)) {
      categoryGroups.set(key, []);
    }
    categoryGroups.get(key)!.push({ id, file, typeInfo });
  });

  // Create compatibility groups
  categoryGroups.forEach((items, category) => {
    const fileTypes = items.map(item => item.typeInfo);
    const validFormats = getValidTargetFormats(fileTypes);
    
    if (validFormats.length === 0) return;

    let groupName = '';
    let description = '';
    let suggestedFormat: 'pdf' | 'png' | 'jpg' | 'txt' | 'csv' | 'docx' = 'pdf';

    switch (category) {
      case 'document':
        groupName = 'Documents';
        description = `${items.length} document file${items.length > 1 ? 's' : ''} (DOCX, DOC, RTF)`;
        suggestedFormat = 'pdf';
        break;
      case 'image':
        groupName = 'Images';
        description = `${items.length} image file${items.length > 1 ? 's' : ''} (PNG, JPG, etc.)`;
        suggestedFormat = validFormats.some(f => f.format === 'pdf') ? 'pdf' : 'png';
        break;
      case 'spreadsheet':
        groupName = 'Spreadsheets';
        description = `${items.length} spreadsheet file${items.length > 1 ? 's' : ''} (XLSX, XLS, CSV)`;
        suggestedFormat = validFormats.some(f => f.format === 'csv') ? 'csv' : 'pdf';
        break;
      case 'presentation':
        groupName = 'Presentations';
        description = `${items.length} presentation file${items.length > 1 ? 's' : ''} (PPTX, PPT)`;
        suggestedFormat = 'pdf';
        break;
      case 'text':
        groupName = 'Text Files';
        description = `${items.length} text file${items.length > 1 ? 's' : ''} (TXT, MD, JSON)`;
        suggestedFormat = 'pdf';
        break;
      case 'pdf':
        groupName = 'PDFs';
        description = `${items.length} PDF file${items.length > 1 ? 's' : ''}`;
        suggestedFormat = validFormats.some(f => f.format === 'png') ? 'png' : 'txt';
        break;
      default:
        groupName = 'Other Files';
        description = `${items.length} file${items.length > 1 ? 's' : ''}`;
        suggestedFormat = 'pdf';
    }

    groups.push({
      id: `group-${category}-${Date.now()}`,
      name: groupName,
      description,
      fileIds: items.map(item => item.id),
      validFormats,
      suggestedFormat
    });

    items.forEach(item => processedFileIds.add(item.id));
  });

  return groups;
};

export const getConversionError = (fileType: FileTypeInfo, targetFormat: string): string | null => {
  const { category, extension } = fileType;
  
  // Define impossible conversions
  const impossibleConversions: Record<string, string[]> = {
    text: ['png', 'jpg'],
    image: ['docx', 'csv', 'xlsx'],
    unknown: ['pdf', 'png', 'jpg', 'txt', 'csv', 'docx']
  };
  
  if (impossibleConversions[category]?.includes(targetFormat)) {
    switch (`${category}-${targetFormat}`) {
      case 'text-png':
      case 'text-jpg':
        return `${extension.toUpperCase()} → ${targetFormat.toUpperCase()} isn't supported. Choose PDF to wrap text as pages.`;
      case 'image-docx':
        return `${extension.toUpperCase()} → DOCX isn't supported. Try PDF for image documents.`;
      case 'image-csv':
        return `${extension.toUpperCase()} → CSV isn't supported. Images don't contain tabular data.`;
      default:
        return `${extension.toUpperCase()} → ${targetFormat.toUpperCase()} conversion is not supported.`;
    }
  }
  
  return null;
};

export interface QueueItem {
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

export const convertFile = async (
  file: File,
  targetFormat: 'pdf' | 'png' | 'jpg' | 'txt',
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  console.log('Starting conversion:', file.name, 'to', targetFormat);
  console.log('Preservation settings:', preservationSettings);
  
  onProgress(10);
  
  const fileTypeInfo = getFileTypeInfo(file);
  const { category, extension } = fileTypeInfo;
  console.log('File type info:', fileTypeInfo);
  
  // Check for impossible conversions
  const conversionError = getConversionError(fileTypeInfo, targetFormat);
  if (conversionError) {
    console.error('Conversion error:', conversionError);
    throw new Error(conversionError);
  }

  // If already in target format, return as-is (or lightly optimize)
  if (targetFormat === 'pdf' && category === 'pdf') {
    console.log('File already in target format (PDF)');
    onProgress(100);
    return file;
  }
  
  if ((targetFormat === 'png' || targetFormat === 'jpg') && category === 'image' && extension === targetFormat) {
    console.log('File already in target format (Image)');
    onProgress(100);
    return file;
  }
  
  if (targetFormat === 'txt' && category === 'text' && extension === 'txt') {
    console.log('File already in target format (Text)');
    onProgress(100);
    return file;
  }

  onProgress(25);

  try {
    console.log('Starting conversion process for:', targetFormat);
    switch (targetFormat) {
      case 'pdf':
        console.log('Converting to PDF');
        return await convertToPDF(file, onProgress, preservationSettings);
      case 'png':
      case 'jpg':
        console.log('Converting to image');
        return await convertToImage(file, targetFormat, onProgress, preservationSettings);
      case 'txt':
        console.log('Converting to text');
        return await convertToText(file, onProgress, preservationSettings);
      case 'csv':
        console.log('Converting to CSV');
        return await convertToCSV(file, onProgress, preservationSettings);
      case 'docx':
        console.log('Converting to DOCX');
        return await convertToDocx(file, onProgress, preservationSettings);
      default:
        throw new Error(`Unsupported target format: ${targetFormat}`);
    }
  } catch (error) {
    console.error('Conversion failed:', error);
    console.error('Error details:', error.message, error.stack);
    throw new Error(`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const convertToPDF = async (
  file: File, 
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const fileTypeInfo = getFileTypeInfo(file);
  const { category, extension } = fileTypeInfo;

  onProgress(30);

  if (category === 'pdf') {
    onProgress(100);
    return file;
  }

  const pdfDoc = await PDFDocument.create();
  onProgress(40);

  if (category === 'image') {
    return await convertImageToPDF(file, pdfDoc, onProgress, preservationSettings);
  }

  if (category === 'document') {
    return await convertDocxToPDF(file, pdfDoc, onProgress, preservationSettings);
  }

  if (category === 'spreadsheet') {
    return await convertExcelToPDF(file, pdfDoc, onProgress, preservationSettings);
  }

  if (category === 'text') {
    return await convertTextToPDF(file, pdfDoc, onProgress, preservationSettings);
  }
  
  if (category === 'presentation') {
    return await convertPresentationToPDF(file, pdfDoc, onProgress, preservationSettings);
  }

  throw new Error(`Unsupported file type for PDF conversion: ${extension}`);
};

const convertImageToPDF = async (
  file: File,
  pdfDoc: PDFDocument,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  onProgress(60);

  let image;
  if (file.type === 'image/png') {
    image = await pdfDoc.embedPng(arrayBuffer);
  } else {
    image = await pdfDoc.embedJpg(arrayBuffer);
  }

  onProgress(80);

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  onProgress(90);
  const pdfBytes = await pdfDoc.save();
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const convertDocxToPDF = async (
  file: File,
  pdfDoc: PDFDocument,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  onProgress(50);

  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  onProgress(70);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const margin = 50;

  // Simple text wrapping
  const lines = wrapText(text, width - 2 * margin, fontSize);
  
  let yPosition = height - margin;
  const lineHeight = fontSize * 1.2;

  for (const line of lines) {
    if (yPosition < margin) {
      // Add new page if needed
      const newPage = pdfDoc.addPage();
      yPosition = newPage.getSize().height - margin;
    }

    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
  }

  onProgress(90);
  const pdfBytes = await pdfDoc.save();
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const convertExcelToPDF = async (
  file: File,
  pdfDoc: PDFDocument,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  onProgress(50);

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const csvData = XLSX.utils.sheet_to_csv(worksheet);
  onProgress(70);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 10;
  const margin = 50;

  const lines = csvData.split('\n').slice(0, 50); // Limit to first 50 rows
  let yPosition = height - margin;
  const lineHeight = fontSize * 1.2;

  for (const line of lines) {
    if (yPosition < margin) break; // Stop if we run out of space

    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
  }

  onProgress(90);
  const pdfBytes = await pdfDoc.save();
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const convertTextToPDF = async (
  file: File,
  pdfDoc: PDFDocument,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const text = await file.text();
  onProgress(60);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const margin = 50;

  const lines = wrapText(text, width - 2 * margin, fontSize);
  let yPosition = height - margin;
  const lineHeight = fontSize * 1.2;

  for (const line of lines) {
    if (yPosition < margin) {
      // Add new page if needed
      const newPage = pdfDoc.addPage();
      yPosition = newPage.getSize().height - margin;
    }

    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
  }

  onProgress(90);
  const pdfBytes = await pdfDoc.save();
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const convertPresentationToPDF = async (
  file: File,
  pdfDoc: PDFDocument,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  // For now, treat presentations as text extraction
  // In a real implementation, you'd use a library like node-pptx or similar
  const text = `Presentation: ${file.name}\n\nThis is a placeholder conversion.\nFull presentation conversion requires additional libraries.`;
  
  onProgress(60);
  
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const margin = 50;

  const lines = wrapText(text, width - 2 * margin, fontSize);
  let yPosition = height - margin;
  const lineHeight = fontSize * 1.2;

  for (const line of lines) {
    if (yPosition < margin) {
      const newPage = pdfDoc.addPage();
      yPosition = newPage.getSize().height - margin;
    }

    page.drawText(line, {
      x: margin,
      y: yPosition,
      size: fontSize,
      color: rgb(0, 0, 0),
    });

    yPosition -= lineHeight;
  }

  onProgress(90);
  const pdfBytes = await pdfDoc.save();
  onProgress(100);

  return new Blob([pdfBytes], { type: 'application/pdf' });
};

const convertToImage = async (
  file: File,
  targetFormat: 'png' | 'jpg',
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      onProgress(60);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // For JPG, fill with white background to avoid transparency issues
      if (targetFormat === 'jpg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(img, 0, 0);
      onProgress(80);
      
      // Determine quality based on preservation settings
      let quality = 0.9;
      if (preservationSettings?.imageHandling === 'lossless') {
        quality = 1.0;
      } else if (preservationSettings?.imageHandling === 'lossy') {
        quality = (preservationSettings.imageQuality || 80) / 100;
      } else {
        // Auto mode - balance quality and size
        quality = targetFormat === 'jpg' ? 0.85 : 1.0;
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          onProgress(100);
          resolve(blob);
        } else {
          reject(new Error('Failed to convert image'));
        }
      }, targetFormat === 'jpg' ? 'image/jpeg' : 'image/png', targetFormat === 'jpg' ? quality : undefined);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.crossOrigin = 'anonymous'; // Handle CORS issues
    img.src = URL.createObjectURL(file);
    onProgress(40);
  });
};

const convertToText = async (
  file: File,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  console.log('Converting to text:', file.name, 'extension:', fileExtension);
  
  onProgress(10);
  
  if (fileExtension === 'txt' || file.type === 'text/plain') {
    console.log('File is already text, returning as-is');
    onProgress(100);
    return file;
  }
  
  if (fileExtension === 'pdf') {
    console.log('Converting PDF to text');
    const extractedText = await extractTextFromPDF(file, onProgress, preservationSettings);
    console.log('PDF text extracted, creating blob');
    const blob = new Blob([extractedText], { type: 'text/plain' });
    onProgress(100);
    return blob;
  }
  
  if (['docx', 'doc'].includes(fileExtension || '')) {
    console.log('Converting DOCX to text');
    const arrayBuffer = await file.arrayBuffer();
    onProgress(50);
    
    let result;
    if (preservationSettings?.comments === 'remove') {
      result = await mammoth.extractRawText({ 
        arrayBuffer,
        options: {
          includeDefaultStyleMap: true,
          includeEmbeddedStyleMap: true
        }
      });
    } else {
      result = await mammoth.extractRawText({ arrayBuffer });
    }
    onProgress(95);
    
    const blob = new Blob([result.value], { type: 'text/plain' });
    onProgress(100);
    return blob;
  }
  
  if (['xlsx', 'xls'].includes(fileExtension || '')) {
    console.log('Converting Excel to text');
    const arrayBuffer = await file.arrayBuffer();
    onProgress(50);
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    onProgress(95);
    
    const blob = new Blob([csvData], { type: 'text/plain' });
    onProgress(100);
    return blob;
  }
  
  throw new Error(`Unsupported file type for text conversion: ${fileExtension}`);
};

const convertToCSV = async (
  file: File,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const fileTypeInfo = getFileTypeInfo(file);
  const { category, extension } = fileTypeInfo;
  
  onProgress(30);
  
  if (extension === 'csv') {
    onProgress(100);
    return file;
  }
  
  if (category === 'spreadsheet') {
    const arrayBuffer = await file.arrayBuffer();
    onProgress(60);
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    onProgress(90);
    
    const blob = new Blob([csvData], { type: 'text/csv' });
    onProgress(100);
    return blob;
  }
  
  if (extension === 'json') {
    const text = await file.text();
    onProgress(60);
    
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        // Convert array of objects to CSV
        const headers = Object.keys(data[0]);
        const csvRows = [
          headers.join(','),
          ...data.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(','))
        ];
        const csvData = csvRows.join('\n');
        onProgress(90);
        
        const blob = new Blob([csvData], { type: 'text/csv' });
        onProgress(100);
        return blob;
      } else {
        throw new Error('JSON must be an array of objects for CSV conversion');
      }
    } catch (error) {
      throw new Error('Invalid JSON format for CSV conversion');
    }
  }
  
  throw new Error(`Unsupported file type for CSV conversion: ${extension}`);
};

const convertToDocx = async (
  file: File,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<Blob> => {
  const fileTypeInfo = getFileTypeInfo(file);
  const { category, extension } = fileTypeInfo;
  
  onProgress(30);
  
  if (extension === 'pdf') {
    const extractedText = await extractTextFromPDF(file, onProgress, preservationSettings);
    onProgress(70);
    
    // Create a simple DOCX structure with proper formatting
    const docxContent = createSimpleDocx(extractedText, preservationSettings);
    onProgress(90);
    
    // Create proper DOCX file structure
    const zip = new JSZip();
    
    // Add the main document
    zip.file('word/document.xml', docxContent);
    
    // Add required DOCX structure files
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    onProgress(100);
    return zipBlob;
  }
  
  if (category === 'text') {
    const text = await file.text();
    onProgress(60);
    
    const docxContent = createSimpleDocx(text, preservationSettings);
    
    // Create proper DOCX file structure
    const zip = new JSZip();
    zip.file('word/document.xml', docxContent);
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);
    
    onProgress(90);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    onProgress(100);
    return zipBlob;
  }
  
  throw new Error(`DOCX conversion not supported for ${extension} files`);
};

const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  // Approximate character width (this is a rough estimate)
  const charWidth = fontSize * 0.6;
  const maxCharsPerLine = Math.floor(maxWidth / charWidth);
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
};

export const createZipDownload = async (
  items: QueueItem[],
  targetFormat: string
): Promise<void> => {
  const zip = new JSZip();
  
  for (const item of items) {
    if (item.convertedBlob) {
      const extension = getFileExtension(targetFormat);
      const filename = `${item.filename.split('.')[0]}.${extension}`;
      zip.file(filename, item.convertedBlob);
    }
  }
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `converted-files-${Date.now()}.zip`;
  a.click();
  
  URL.revokeObjectURL(url);
};

// Extract text from PDF using both native text extraction and OCR fallback
const extractTextFromPDF = async (
  file: File, 
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<string> => {
  console.log('Starting PDF text extraction for:', file.name);
  onProgress(10);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('PDF arrayBuffer loaded, size:', arrayBuffer.byteLength);
    onProgress(20);
    
    // Simple PDF.js configuration
    const loadingTask = pdfjs.getDocument(arrayBuffer);
    console.log('PDF loading task created');
    
    const pdf = await loadingTask.promise;
    console.log('PDF loaded successfully, pages:', pdf.numPages);
  
    onProgress(30);
  
    let extractedText = '';
    const totalPages = pdf.numPages;
    const fidelity = preservationSettings?.fidelity || 'balanced';
    console.log('Processing', totalPages, 'pages with fidelity:', fidelity);
  
    // First, try native text extraction
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log('Processing page', pageNum);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      console.log('Text content items for page', pageNum, ':', textContent.items.length);
    
      let pageText = '';
    
      if (fidelity === 'best') {
        // Preserve positioning and formatting
        const sortedItems = textContent.items.sort((a: any, b: any) => {
          if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
            return b.transform[5] - a.transform[5]; // Sort by Y position (top to bottom)
          }
          return a.transform[4] - b.transform[4]; // Sort by X position (left to right)
        });
      
        let currentY = null;
        for (const item of sortedItems) {
          const y = Math.round(item.transform[5]);
          if (currentY !== null && Math.abs(currentY - y) > 5) {
            pageText += '\n';
          }
          pageText += item.str + ' ';
          currentY = y;
        }
      } else {
        // Simple extraction
        pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
      }
    
      pageText = pageText.trim();
    
      if (pageText) {
        if (totalPages > 1) {
          extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
        } else {
          extractedText += pageText;
        }
      }
    
      onProgress(30 + (pageNum / totalPages) * 40);
    }
    
    console.log('Native text extraction completed, length:', extractedText.length);
    
    // If no text was extracted (scanned PDF), use OCR
    if (extractedText.trim().length < 50 && fidelity !== 'fast') {
      console.log('Text too short, trying OCR fallback');
      onProgress(75);
      extractedText = await extractTextWithOCR(file, onProgress, preservationSettings);
    }
    
    console.log('Final extracted text length:', extractedText.length);
    return extractedText.trim() || 'No readable text found in this PDF.';
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    console.error('Error details:', error.message, error.stack);
    
    // Fallback to OCR if PDF.js fails
    if (preservationSettings?.fidelity !== 'fast') {
      try {
        console.log('PDF.js failed, trying OCR fallback');
        onProgress(40);
        return await extractTextWithOCR(file, onProgress, preservationSettings);
      } catch (ocrError) {
        console.error('OCR fallback failed:', ocrError);
        throw new Error('Failed to extract text from PDF. The file may be corrupted or password-protected.');
      }
    } else {
      throw new Error('Failed to extract text from PDF. Try using "Balanced" or "Best" fidelity for OCR fallback.');
    }
  }
};

// OCR fallback for scanned PDFs
const extractTextWithOCR = async (
  file: File,
  onProgress: (progress: number) => void,
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): Promise<string> => {
  console.log('Starting OCR for:', file.name);
  try {
    const worker = await createWorker('eng', 1, {
      logger: m => {
        console.log('OCR progress:', m);
        if (m.status === 'recognizing text') {
          onProgress(80 + (m.progress * 15));
        }
      }
    });
    console.log('OCR worker created');
    onProgress(85);
    
    const { data: { text } } = await worker.recognize(file);
    console.log('OCR completed, text length:', text.length);
    await worker.terminate();
    
    onProgress(98);
    
    // Clean up OCR text based on fidelity setting
    let cleanedText = text.trim();
    if (preservationSettings?.fidelity === 'best') {
      // Preserve line breaks and formatting
      cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n'); // Normalize paragraph breaks
    } else {
      // Basic cleanup
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    }
    
    console.log('OCR text cleaned, final length:', cleanedText.length);
    return cleanedText;
  } catch (error) {
    console.error('OCR failed:', error);
    console.error('OCR error details:', error.message);
    return 'OCR text extraction failed. This may be a scanned document that requires manual processing.';
  }
};

// Create a simple but properly formatted DOCX structure
const createSimpleDocx = (
  text: string, 
  preservationSettings?: {
    fidelity: 'fast' | 'balanced' | 'best';
    pdfForms: 'keep' | 'flatten';
    docxChanges: 'accept' | 'reject' | 'keep';
    comments: 'keep' | 'remove';
    imageHandling: 'auto' | 'lossless' | 'lossy';
    imageQuality: number;
  }
): string => {
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  // Split text into paragraphs
  let paragraphs;
  
  if (preservationSettings?.fidelity === 'best') {
    // Preserve original formatting
    paragraphs = escapedText
      .split(/\n/)
      .filter(p => p.trim())
      .map(line => line.trim());
  } else {
    // Standard paragraph processing
    paragraphs = escapedText
      .split(/\n\s*\n/)
      .filter(p => p.trim())
      .map(paragraph => {
        const lines = paragraph.split('\n').map(line => line.trim()).filter(line => line);
        return lines.join(' ');
      });
  }
  
  const paragraphXml = paragraphs
    .map(paragraph => `
    <w:p>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t xml:space="preserve">${paragraph}</w:t>
      </w:r>
    </w:p>`)
    .join('');
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" 
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
};

const getFileExtension = (format: string): string => {
  switch (format) {
    case 'pdf': return 'pdf';
    case 'png': return 'png';
    case 'jpg': return 'jpeg';
    case 'txt': return 'txt';
    default: return format;
  }
};