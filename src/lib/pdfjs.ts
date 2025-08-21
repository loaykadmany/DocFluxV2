import * as pdfjsLib from 'pdfjs-dist';

// Set worker source to use the copied worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export const pdfjs = pdfjsLib;