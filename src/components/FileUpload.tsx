import React, { useCallback, useState } from 'react';
import { Upload, FileText, Image, Eye } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (files: FileList | File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

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
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/jpeg') || 
      file.type.startsWith('image/png')
    );
    
    if (files.length > 0) {
      onFileUpload(files);
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
    }
  }, [onFileUpload]);

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center transition-all duration-300 ${
          isDragging
            ? 'border-purple-500 bg-purple-500/10 scale-105'
            : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800/70'
        }`}
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="flex justify-center space-x-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
              <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold text-white">
              {isDragging ? 'Drop your files here' : 'Upload your documents'}
            </h3>
            <p className="text-sm sm:text-base text-gray-400">
              Drag and drop PDFs or images, or click to browse
            </p>
          </div>

          <div className="flex justify-center space-x-4 sm:space-x-6 text-xs sm:text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </div>
            <div className="flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>JPG, PNG</span>
            </div>
          </div>

          <div>
            <input
              type="file"
              id="file-upload"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="inline-flex items-center space-x-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 cursor-pointer transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Files</span>
            </label>
          </div>

          <p className="text-xs sm:text-xs text-gray-600">
            Your files are processed locally and never leave your device
          </p>

          <div className="flex items-center justify-center space-x-2 mt-4 pt-4 border-t border-gray-700">
            <Eye className="w-4 h-4 text-blue-400" />
            <p className="text-sm text-gray-300">
              Scanned PDFs will be auto-processed for searchable text
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;