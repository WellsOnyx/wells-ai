'use client'

/**
 * CSVUploader - Drag and drop CSV file upload component
 *
 * Features:
 * - Drag and drop support
 * - File type validation
 * - Preview of file info
 * - Reset capability
 */

import { useRef, useState, useCallback } from 'react'
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface CSVUploaderProps {
  onFileSelect: (file: File) => void
  onError?: (error: string) => void
  selectedFile?: File | null
  onClear?: () => void
  maxSize?: number // in MB
  className?: string
}

export default function CSVUploader({
  onFileSelect,
  onError,
  selectedFile,
  onClear,
  maxSize = 10,
  className = '',
}: CSVUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): boolean => {
    // Check file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel']
    const isValidType = validTypes.includes(file.type) || file.name.endsWith('.csv')

    if (!isValidType) {
      const errorMsg = 'Please upload a CSV file'
      setError(errorMsg)
      onError?.(errorMsg)
      return false
    }

    // Check file size
    const maxBytes = maxSize * 1024 * 1024
    if (file.size > maxBytes) {
      const errorMsg = `File size must be less than ${maxSize}MB`
      setError(errorMsg)
      onError?.(errorMsg)
      return false
    }

    setError(null)
    return true
  }

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect, onError])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0])
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Show selected file
  if (selectedFile) {
    return (
      <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <div className="font-medium">{selectedFile.name}</div>
              <div className="text-sm text-[var(--text-secondary)]">
                {formatFileSize(selectedFile.size)}
              </div>
            </div>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? 'border-amber-500 bg-amber-500/10'
            : error
            ? 'border-red-500/50 bg-red-500/5'
            : 'border-[var(--border)] hover:border-[var(--border-hover)]'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleInputChange}
        />

        <FileSpreadsheet className={`w-12 h-12 mx-auto mb-4 ${
          error ? 'text-red-400' : 'text-amber-400'
        }`} />

        <h3 className="text-lg font-semibold mb-2">
          {dragActive ? 'Drop your CSV file here' : 'Drag and drop your CSV file'}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mb-4">
          or click to browse your files
        </p>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
        >
          <Upload className="w-5 h-5" />
          Choose File
        </button>

        <p className="text-xs text-[var(--text-tertiary)] mt-4">
          Maximum file size: {maxSize}MB
        </p>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
