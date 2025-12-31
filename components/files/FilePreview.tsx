// @ts-nocheck
'use client';

/**
 * FilePreview Component
 * Preview files based on their type (images, PDFs, documents, audio, video)
 */

import { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  File,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface FilePreviewProps {
  url: string;
  filename: string;
  contentType: string;
  extractedText?: string;
  onClose?: () => void;
  showControls?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FilePreview({
  url,
  filename,
  contentType,
  extractedText,
  onClose,
  showControls = true,
  className = '',
}: FilePreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showText, setShowText] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Determine file category
  const isImage = contentType.startsWith('image/');
  const isPDF = contentType === 'application/pdf';
  const isAudio = contentType.startsWith('audio/');
  const isVideo = contentType.startsWith('video/');
  const isDocument =
    contentType.includes('word') ||
    contentType.includes('document') ||
    contentType.includes('spreadsheet') ||
    contentType.includes('excel') ||
    contentType === 'text/csv' ||
    contentType === 'text/plain' ||
    contentType === 'text/markdown' ||
    contentType === 'application/json';

  // Handle image load/error
  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load file');
  };

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoom(1);

  // Rotation control
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  // Toggle fullscreen
  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  // Download file
  const downloadFile = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open in new tab
  const openInNewTab = () => {
    window.open(url, '_blank');
  };

  return (
    <div
      className={`
        relative bg-gray-900 rounded-lg overflow-hidden
        ${isFullscreen ? 'fixed inset-0 z-50' : ''}
        ${className}
      `}
    >
      {/* Header Controls */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <span className="text-sm font-medium truncate max-w-[200px]">
              {filename}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls for images */}
            {isImage && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-xs text-white/80 min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={rotate}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                  title="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              title="Toggle fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            {/* Download */}
            <button
              onClick={downloadFile}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>

            {/* Open in new tab */}
            <button
              onClick={openInNewTab}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </button>

            {/* Close button */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <File className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">{error}</p>
            <button
              onClick={openInNewTab}
              className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              Open in new tab
            </button>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {isImage && (
        <div className="flex items-center justify-center min-h-[300px] overflow-auto p-4">
          <img
            src={url}
            alt={filename}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>
      )}

      {/* PDF Preview */}
      {isPDF && (
        <div className="w-full h-[600px]">
          <iframe
            src={`${url}#toolbar=0`}
            className="w-full h-full"
            onLoad={handleLoad}
            onError={handleError}
            title={filename}
          />
        </div>
      )}

      {/* Audio Preview */}
      {isAudio && (
        <div className="flex items-center justify-center p-8 min-h-[200px]">
          <audio
            src={url}
            controls
            className="w-full max-w-md"
            onLoadedData={handleLoad}
            onError={handleError}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Video Preview */}
      {isVideo && (
        <div className="flex items-center justify-center p-4">
          <video
            src={url}
            controls
            className="max-w-full max-h-[80vh]"
            onLoadedData={handleLoad}
            onError={handleError}
          >
            Your browser does not support the video element.
          </video>
        </div>
      )}

      {/* Document Preview (Text-based) */}
      {isDocument && (
        <div className="p-4 min-h-[300px]">
          {extractedText ? (
            <div className="bg-white rounded-lg p-4 max-h-[80vh] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                {extractedText}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <FileText className="h-16 w-16 mb-4 text-gray-400" />
              <p className="text-lg font-medium">{filename}</p>
              <p className="text-sm text-gray-400 mt-1">
                {contentType}
              </p>
              <button
                onClick={openInNewTab}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                Download to view
              </button>
            </div>
          )}
        </div>
      )}

      {/* Extracted Text Toggle (for images/PDFs with OCR) */}
      {(isImage || isPDF) && extractedText && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <button
            onClick={() => setShowText(!showText)}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm"
          >
            {showText ? 'Hide' : 'Show'} Extracted Text
          </button>

          {showText && (
            <div className="mt-3 p-3 bg-white rounded-lg max-h-[200px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                {extractedText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Fallback for unsupported types */}
      {!isImage && !isPDF && !isAudio && !isVideo && !isDocument && (
        <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-white">
          <File className="h-16 w-16 mb-4 text-gray-400" />
          <p className="text-lg font-medium">{filename}</p>
          <p className="text-sm text-gray-400 mt-1">{contentType}</p>
          <button
            onClick={downloadFile}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Download File
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE PREVIEW (smaller version for chat/lists)
// ============================================================================

interface InlineFilePreviewProps {
  url: string;
  filename: string;
  contentType: string;
  size?: number;
  onClick?: () => void;
  className?: string;
}

export function InlineFilePreview({
  url,
  filename,
  contentType,
  size,
  onClick,
  className = '',
}: InlineFilePreviewProps) {
  const isImage = contentType.startsWith('image/');

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-2 rounded-lg border border-gray-200 bg-gray-50
        hover:bg-gray-100 cursor-pointer transition-colors
        ${className}
      `}
    >
      {isImage ? (
        <img
          src={url}
          alt={filename}
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
          <FileText className="h-6 w-6 text-gray-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{filename}</p>
        <p className="text-xs text-gray-500">
          {contentType.split('/')[1]?.toUpperCase() || 'FILE'}
          {size && ` - ${formatSize(size)}`}
        </p>
      </div>

      <ExternalLink className="h-4 w-4 text-gray-400" />
    </div>
  );
}

export { FilePreview };
export type { FilePreviewProps, InlineFilePreviewProps };
