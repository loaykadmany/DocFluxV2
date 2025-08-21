import { pdfjs } from '../lib/pdfjs';
import { PageData } from '../types';

export const processFiles = async (
  files: File[],
  onProgress?: (progress: number) => void
): Promise<PageData[]> => {
  const pages: PageData[] = [];
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    
    if (file.type === 'application/pdf') {
      const pdfPage = await processPDFAsSingle(file);
      pages.push(pdfPage);
    } else if (file.type.startsWith('image/')) {
      const imagePage = await processImage(file);
      pages.push(imagePage);
    }

    if (onProgress) {
      onProgress(((i + 1) / totalFiles) * 100);
    }
  }

  return pages;
};

const processPDFAsSingle = async (file: File): Promise<PageData> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  
  // Get first page for thumbnail
  const page = await pdf.getPage(1);
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
  
  return {
    id: `${file.name}-${Date.now()}`,
    thumbnail,
    filename: `${file.name} (${pdf.numPages} pages)`,
    type: 'pdf',
    originalFile: file,
    pageNumber: 1,
    totalPages: pdf.numPages,
    rotation: 0,
    width: viewport.width,
    height: viewport.height,
  };
};

const processPDF = async (file: File): Promise<PageData[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  const pages: PageData[] = [];

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
    
    pages.push({
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

  return pages;
};

const processImage = async (file: File): Promise<PageData> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      // Create thumbnail
      const maxSize = 300;
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      
      resolve({
        id: `${file.name}-${Date.now()}`,
        thumbnail,
        filename: file.name,
        type: 'image',
        originalFile: file,
        rotation: 0,
        width: img.width,
        height: img.height,
      });
    };
    
    img.src = URL.createObjectURL(file);
  });
};