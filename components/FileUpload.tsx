import React, { useCallback, useState } from 'react';
import { Upload, FileArchive } from 'lucide-react';
import { Button } from './Button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-950">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Novamanga
        </h1>
        <p className="text-gray-400">Smart Local Manga Reader with Gemini AI</p>
      </div>

      <div 
        className={`
          relative w-full max-w-xl p-12 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center gap-6 text-center
          ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="p-4 bg-gray-800 rounded-full">
            <FileArchive className="w-12 h-12 text-indigo-400" />
        </div>
        
        <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">Upload Manga File</h3>
            <p className="text-sm text-gray-400">Drag and drop your .cbz or .zip file here</p>
        </div>

        <div className="relative">
            <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".cbz,.zip"
                onChange={handleChange}
                disabled={isLoading}
            />
            <Button disabled={isLoading}>
                {isLoading ? "Processing..." : "Select File"}
            </Button>
        </div>
      </div>
    </div>
  );
};
