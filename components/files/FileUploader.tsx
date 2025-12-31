// @ts-nocheck
'use client';

/**
 * FileUploader Component
 * Drag & drop file uploader with progress tracking and preview
 */

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  X,
  File,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Music,
  Video,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface UploadedFile {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  hasExtractedText?: boolean;
}

interface FileUploadState {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  result?: UploadedFile;
}

interface FileUploaderProps {
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  purpose?: 'chat' | 'document' | 'analysis' | 'attachment';
  conversationId?: string;
  maxFiles?: number;
  acceptedTypes?: string[];
  showPreview?: boolean;
  className?: string;
}

// Supported file types
const DEFAULT_ACCEPTED_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  // Text
  'text/plain',
  'text/markdown',
  'application/json',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.startsWith('video/')) return Video;
  if (contentType === 'application/pdf') return FileText;
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType === 'text/csv') {
    return FileSpreadsheet;
  }
  if (contentType.includes('word') || contentType.includes('document')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FileUploader({
  onUploadComplete,
  onUploadError,
  purpose = 'attachment',
  conversationId,
  maxFiles = 10,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  showPreview = true,
  className = '',
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFiles = useCallback(
    async (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);

      // Check max files
      if (files.length + fileArray.length > maxFiles) {
        onUploadError?.(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Filter valid files
      const validFiles = fileArray.filter(file => {
        if (!acceptedTypes.includes(file.type)) {
          onUploadError?.(`File type ${file.type} not supported`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      // Add files to state
      const newFileStates: FileUploadState[] = validFiles.map(file => ({
        file,
        progress: 0,
        status: 'pending',
      }));

      setFiles(prev => [...prev, ...newFileStates]);

      // Upload each file
      const uploadPromises = newFileStates.map(async (fileState, index) => {
        const formData = new FormData();
        formData.append('file', fileState.file);
        formData.append('purpose', purpose);
        if (conversationId) {
          formData.append('conversationId', conversationId);
        }

        try {
          // Update status to uploading
          setFiles(prev =>
            prev.map((f, i) =>
              i === files.length + index ? { ...f, status: 'uploading' } : f
            )
          );

          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
          }

          const data = await response.json();

          // Update status to completed
          setFiles(prev =>
            prev.map((f, i) =>
              i === files.length + index
                ? { ...f, status: 'completed', progress: 100, result: data.file }
                : f
            )
          );

          return data.file;
        } catch (error) {
          // Update status to error
          setFiles(prev =>
            prev.map((f, i) =>
              i === files.length + index
                ? {
                    ...f,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Upload failed',
                  }
                : f
            )
          );
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(Boolean) as UploadedFile[];

      if (successfulUploads.length > 0) {
        onUploadComplete?.(successfulUploads);
      }
    },
    [files.length, maxFiles, acceptedTypes, purpose, conversationId, onUploadComplete, onUploadError]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  // File input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  // Remove file from list
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  return (
    <div className={`w-full ${className}`}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        <Upload
          className={`mx-auto h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`}
        />

        <p className="mt-4 text-sm text-gray-600">
          <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Images, PDFs, Documents, Spreadsheets, Audio, Video
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Max {maxFiles} files
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={clearFiles}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>

          {files.map((fileState, index) => {
            const FileIcon = getFileIcon(fileState.file.type);

            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
              >
                {/* Preview or Icon */}
                {showPreview && fileState.file.type.startsWith('image/') && fileState.status === 'completed' && fileState.result ? (
                  <img
                    src={fileState.result.url}
                    alt={fileState.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                    <FileIcon className="h-5 w-5 text-gray-500" />
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileState.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileState.file.size)}
                    {fileState.result?.hasExtractedText && (
                      <span className="ml-2 text-green-600">Text extracted</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {fileState.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  {fileState.status === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {fileState.status === 'error' && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-xs text-red-500">{fileState.error}</span>
                    </div>
                  )}

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { FileUploader };
export type { UploadedFile, FileUploadState, FileUploaderProps };
