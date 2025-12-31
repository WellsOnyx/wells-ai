// @ts-nocheck
'use client';

/**
 * ChatFileAttachment Component
 * File attachment functionality for chat messages
 */

import { useState, useCallback, useRef } from 'react';
import {
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  File,
  Loader2,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InlineFilePreview } from './FilePreview';

// ============================================================================
// TYPES
// ============================================================================

interface AttachedFile {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  extractedText?: string;
  hasExtractedText?: boolean;
}

interface ChatFileAttachmentProps {
  onFilesAttached: (files: AttachedFile[]) => void;
  onFileRemoved: (fileId: string) => void;
  attachedFiles: AttachedFile[];
  conversationId?: string;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

interface AttachmentButtonProps {
  onClick: () => void;
  disabled?: boolean;
  hasAttachments?: boolean;
  className?: string;
}

interface AttachedFilesListProps {
  files: AttachedFile[];
  onRemove: (fileId: string) => void;
  onPreview?: (file: AttachedFile) => void;
  compact?: boolean;
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon;
  if (contentType.startsWith('audio/')) return Music;
  if (contentType.startsWith('video/')) return Video;
  if (contentType === 'application/pdf') return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Supported file types
const ACCEPTED_TYPES = [
  'image/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'audio/*',
  'video/*',
  'text/plain',
  'text/markdown',
  'application/json',
].join(',');

// ============================================================================
// ATTACHMENT BUTTON
// ============================================================================

export function AttachmentButton({
  onClick,
  disabled,
  hasAttachments,
  className = '',
}: AttachmentButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-2 rounded-lg transition-colors
        ${hasAttachments
          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      title="Attach file"
    >
      <Paperclip className="h-5 w-5" />
    </button>
  );
}

// ============================================================================
// ATTACHED FILES LIST
// ============================================================================

export function AttachedFilesList({
  files,
  onRemove,
  onPreview,
  compact = false,
  className = '',
}: AttachedFilesListProps) {
  if (files.length === 0) return null;

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {files.map(file => {
          const Icon = getFileIcon(file.contentType);
          return (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full text-sm"
            >
              <Icon className="h-3.5 w-3.5 text-gray-500" />
              <span className="max-w-[100px] truncate text-gray-700">{file.filename}</span>
              <button
                onClick={() => onRemove(file.id)}
                className="p-0.5 hover:bg-gray-200 rounded-full"
              >
                <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map(file => {
        const Icon = getFileIcon(file.contentType);
        const isImage = file.contentType.startsWith('image/');

        return (
          <div
            key={file.id}
            className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200"
          >
            {isImage ? (
              <img
                src={file.url}
                alt={file.filename}
                className="h-10 w-10 rounded object-cover cursor-pointer"
                onClick={() => onPreview?.(file)}
              />
            ) : (
              <div
                className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center cursor-pointer"
                onClick={() => onPreview?.(file)}
              >
                <Icon className="h-5 w-5 text-gray-500" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)}
                {file.hasExtractedText && (
                  <span className="ml-2 text-green-600">
                    <Sparkles className="inline h-3 w-3 mr-0.5" />
                    Text extracted
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {onPreview && (
                <button
                  onClick={() => onPreview(file)}
                  className="p-1.5 hover:bg-gray-200 rounded"
                  title="Preview"
                >
                  <Eye className="h-4 w-4 text-gray-400" />
                </button>
              )}
              <button
                onClick={() => onRemove(file.id)}
                className="p-1.5 hover:bg-gray-200 rounded"
                title="Remove"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChatFileAttachment({
  onFilesAttached,
  onFileRemoved,
  attachedFiles,
  conversationId,
  maxFiles = 5,
  disabled = false,
  className = '',
}: ChatFileAttachmentProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      // Check max files
      if (attachedFiles.length + files.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      const uploadedFiles: AttachedFile[] = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'chat');
        if (conversationId) {
          formData.append('conversationId', conversationId);
        }

        try {
          const response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
          }

          const data = await response.json();
          uploadedFiles.push(data.file);
          setUploadProgress(((i + 1) / totalFiles) * 100);
        } catch (error) {
          console.error('Upload error:', error);
          setError(error instanceof Error ? error.message : 'Upload failed');
        }
      }

      setIsUploading(false);
      setUploadProgress(0);

      if (uploadedFiles.length > 0) {
        onFilesAttached(uploadedFiles);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [attachedFiles.length, maxFiles, conversationId, onFilesAttached]
  );

  const handleRemove = useCallback(
    (fileId: string) => {
      onFileRemoved(fileId);
    },
    [onFileRemoved]
  );

  return (
    <div className={className}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Attachment button */}
      <div className="flex items-center gap-2">
        <AttachmentButton
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading || attachedFiles.length >= maxFiles}
          hasAttachments={attachedFiles.length > 0}
        />

        {/* Upload progress */}
        {isUploading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading... {Math.round(uploadProgress)}%</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span>{attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached</span>
            {showFiles ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showFiles && (
            <AttachedFilesList
              files={attachedFiles}
              onRemove={handleRemove}
              className="mt-2"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MESSAGE FILE ATTACHMENT DISPLAY
// ============================================================================

interface MessageFilesProps {
  files: AttachedFile[];
  onPreview?: (file: AttachedFile) => void;
  className?: string;
}

export function MessageFiles({
  files,
  onPreview,
  className = '',
}: MessageFilesProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {files.map(file => (
        <InlineFilePreview
          key={file.id}
          url={file.url}
          filename={file.filename}
          contentType={file.contentType}
          size={file.size}
          onClick={() => onPreview?.(file)}
        />
      ))}
    </div>
  );
}

export { ChatFileAttachment, AttachmentButton, AttachedFilesList, MessageFiles };
export type { AttachedFile, ChatFileAttachmentProps, AttachmentButtonProps, AttachedFilesListProps, MessageFilesProps };
