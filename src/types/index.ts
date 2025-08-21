export interface PageData {
  id: string;
  thumbnail: string;
  filename: string;
  type: 'pdf' | 'image';
  originalFile: File;
  pageNumber?: number;
  totalPages?: number;
  rotation: number;
  width: number;
  height: number;
}

export interface ProcessingOptions {
  ocrEnabled: boolean;
  compressionEnabled: boolean;
  compressionQuality: number;
  onProgress?: (progress: number) => void;
}

export interface ExportOptions extends ProcessingOptions {
  filename?: string;
}