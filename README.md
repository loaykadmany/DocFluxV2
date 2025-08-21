# DocFlux - Modern PDF Toolbox

A powerful, privacy-first PDF processing application with advanced editing and bulk conversion capabilities.

## Features

### PDF Editor (`/editor`)
- **Smart PDF Processing**: Upload, merge, split, and manipulate PDFs with advanced tools
- **Drag & Drop Interface**: Visual page reordering with smooth animations
- **OCR Integration**: Make scanned PDFs searchable with automatic text recognition
- **Image Compression**: Reduce file sizes while maintaining quality
- **Privacy First**: All processing happens locally in your browser

### Bulk Converter (`/convert`)
- **Multi-Format Support**: Convert DOCX, PPTX, XLSX, TXT, and images to PDF
- **Batch Processing**: Handle up to 100 files simultaneously
- **Progress Tracking**: Real-time conversion progress for each file
- **Error Handling**: Clear error messages with one-click retry functionality
- **ZIP Downloads**: Get all converted files in a single ZIP archive

## Usage

### PDF Editor
1. Navigate to `/editor` or click "Open Editor" from the homepage
2. Upload PDF files and images using drag-and-drop or file picker
3. Reorder pages by dragging thumbnails
4. Use toolbar options to rotate, delete, or select pages
5. Merge multiple files or split multi-page PDFs
6. Export your final document with OCR and compression options

### Bulk Converter
1. Navigate to `/convert` or click "Bulk Convert" from the homepage
2. Drag and drop multiple files or folders into the upload area
3. Select your target format (PDF, PNG, JPG, or TXT)
4. Click "Convert All" to start batch processing
5. Monitor progress for each file in the queue
6. Download all converted files as a ZIP archive

## Configuration

### Environment Variables
- `MAX_BULK_SIZE_MB`: Maximum total size for bulk conversion jobs (default: 500MB)
- `MAX_FILE_SIZE_MB`: Maximum size per individual file (default: 50MB)

### File Limits
- Maximum 100 files per bulk conversion job
- Individual file size limit: 50MB
- Supported formats: PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, JPEG

## Technical Details

### Local Processing
- All file processing happens in your browser using WebAssembly and JavaScript libraries
- No files are uploaded to external servers
- Temporary storage is automatically cleaned after processing

### Libraries Used
- **PDF Processing**: pdf-lib, pdfjs-dist
- **OCR**: tesseract.js
- **Document Conversion**: mammoth (DOCX), xlsx (Excel)
- **UI**: React, Tailwind CSS, React DnD
- **File Handling**: JSZip for archive creation

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Browser Compatibility

- Modern browsers with WebAssembly support
- Chrome 57+, Firefox 52+, Safari 11+, Edge 16+
- File System Access API support recommended for folder uploads
