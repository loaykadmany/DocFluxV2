import { PDFDocument, degrees } from 'pdf-lib';
import { createWorker } from 'tesseract.js';
import { PageData, ExportOptions } from '../types';
import * as pdfjsLib from 'pdfjs-dist';

export const exportPDF = async (
  pages: PageData[],
  options: ExportOptions
): Promise<void> => {
  const pdfDoc = await PDFDocument.create();
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i++) {
    const pageData = pages[i];
    
    if (pageData.type === 'pdf') {
      await addPDFPage(pdfDoc, pageData, options);
    } else {
      await addImagePage(pdfDoc, pageData, options);
    }

    if (options.onProgress) {
      options.onProgress(((i + 1) / totalPages) * 100);
    }
  }

  const pdfBytes = await pdfDoc.save();
  downloadPDF(pdfBytes, options.filename || 'merged-document.pdf');
};

const addPDFPage = async (
  pdfDoc: PDFDocument,
  pageData: PageData,
  options: ExportOptions
) => {
  const arrayBuffer = await pageData.originalFile.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);
  
  // Handle specific page from split PDF or single page PDF
  const pageIndex = pageData.pageNumber ? pageData.pageNumber - 1 : 0;
  const [sourcePage] = await pdfDoc.copyPages(sourcePdf, [pageIndex]);
  
  if (pageData.rotation !== 0) {
    sourcePage.setRotation(degrees(pageData.rotation));
  }
  
  pdfDoc.addPage(sourcePage);

  if (options.ocrEnabled && pageData.pageNumber) {
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    await addOCRToPage(pdfDoc, pageData, lastPage);
  }
};

const addImagePage = async (
  pdfDoc: PDFDocument,
  pageData: PageData,
  options: ExportOptions
) => {
  let imageBytes = await pageData.originalFile.arrayBuffer();
  
  if (options.compressionEnabled) {
    imageBytes = await compressImage(pageData.originalFile, options.compressionQuality);
  }

  const image = pageData.originalFile.type.includes('png') 
    ? await pdfDoc.embedPng(imageBytes)
    : await pdfDoc.embedJpg(imageBytes);

  const page = pdfDoc.addPage([pageData.width, pageData.height]);
  
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageData.width,
    height: pageData.height,
    rotate: degrees(pageData.rotation),
  });

  if (options.ocrEnabled) {
    await addOCRToImagePage(pdfDoc, pageData, page);
  }
};

const addOCRToPage = async (pdfDoc: PDFDocument, pageData: PageData, page: any) => {
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(pageData.thumbnail);
    await worker.terminate();

    if (text.trim()) {
      // Add invisible text layer for searchability
      const font = await pdfDoc.embedFont('Helvetica');
      const fontSize = 8;
      
      page.drawText(text, {
        x: 0,
        y: page.getHeight() - fontSize,
        size: fontSize,
        font,
        opacity: 0, // Invisible but searchable
      });
    }
  } catch (error) {
    console.error('OCR failed for page:', error);
  }
};

const addOCRToImagePage = async (pdfDoc: PDFDocument, pageData: PageData, page: any) => {
  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(pageData.originalFile);
    await worker.terminate();

    if (text.trim()) {
      const font = await pdfDoc.embedFont('Helvetica');
      const fontSize = 8;
      
      page.drawText(text, {
        x: 0,
        y: page.getHeight() - fontSize,
        size: fontSize,
        font,
        opacity: 0,
      });
    }
  } catch (error) {
    console.error('OCR failed for image:', error);
  }
};

const compressImage = async (file: File, quality: number): Promise<ArrayBuffer> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        blob!.arrayBuffer().then(resolve);
      }, file.type, quality / 100);
    };

    img.src = URL.createObjectURL(file);
  });
};

export const splitPDF = async (
  pages: PageData[],
  selectedPageIds: Set<string>
): Promise<void> => {
  const selectedPages = pages.filter(page => selectedPageIds.has(page.id));
  
  if (selectedPages.length === 0) return;

  const pdfDoc = await PDFDocument.create();
  
  for (const pageData of selectedPages) {
    if (pageData.type === 'pdf') {
      const arrayBuffer = await pageData.originalFile.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const [sourcePage] = await pdfDoc.copyPages(sourcePdf, [pageData.pageNumber! - 1]);
      
      if (pageData.rotation !== 0) {
        sourcePage.setRotation(degrees(pageData.rotation));
      }
      
      pdfDoc.addPage(sourcePage);
    }
  }

  const pdfBytes = await pdfDoc.save();
  downloadPDF(pdfBytes, 'split-document.pdf');
};

const downloadPDF = (pdfBytes: Uint8Array, filename: string) => {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};