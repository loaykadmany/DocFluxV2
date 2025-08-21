import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
(pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
if (typeof window !== 'undefined') {
  // @ts-ignore
  console.info('pdfjs API version:', (pdfjs as any).version);
  // @ts-ignore
  console.info('pdfjs worker src:', (pdfjs as any).GlobalWorkerOptions?.workerSrc);
}
export { pdfjs };