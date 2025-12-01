'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

interface UploadStats {
  totalRows: number
  imported: number
  skipped: number
  skippedDetails?: Array<{ row: number; reason: string; data: any }>
}

export default function ContactsUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  const [stats, setStats] = useState<UploadStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile)
        parsePreview(droppedFile)
        setError(null)
      } else {
        setError('Please upload a CSV file')
      }
    }
  }, [])

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile)
        parsePreview(selectedFile)
        setError(null)
      } else {
        setError('Please upload a CSV file')
      }
    }
  }

  // Parse CSV for preview
  const parsePreview = async (csvFile: File) => {
    const text = await csvFile.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      setError('CSV file appears to be empty')
      return
    }

    // Parse first 6 rows (header + 5 data rows)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: any = {}
      headers.forEach((header, i) => {
        row[header] = values[i] || ''
      })
      return row
    })

    setPreview(rows)
  }

  // Upload file
  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/contacts/upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStats({
          totalRows: data.totalRows,
          imported: data.imported,
          skipped: data.skipped,
          skippedDetails: data.skippedDetails
        })
        setUploadComplete(true)
      } else {
        setError(data.error || 'Upload failed')
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Reset for new upload
  const handleReset = () => {
    setFile(null)
    setPreview(null)
    setStats(null)
    setUploadComplete(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#9ea1a7]/20 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Link href="/admin" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
              ← Admin
            </Link>
            <Link href="/contacts" className="text-[#9ea1a7] hover:text-[#183b6d] text-sm">
              View Contacts
            </Link>
          </div>
          <h1 className="text-2xl font-serif text-[#183b6d]">Import Contacts from Clay</h1>
          <p className="text-sm text-[#575757] mt-1">
            Upload CSV files exported from Clay to import contacts
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {!uploadComplete ? (
          <>
            {/* Upload Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                dragActive
                  ? 'border-[#183b6d] bg-[#183b6d]/5'
                  : 'border-[#9ea1a7]/30 hover:border-[#183b6d]/50'
              }`}
            >
              <div className="max-w-md mx-auto">
                <svg
                  className="mx-auto h-12 w-12 text-[#9ea1a7] mb-4"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {file ? (
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-md">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-green-800 font-medium">{file.name}</span>
                      <button
                        onClick={handleReset}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-lg text-[#183b6d] font-medium mb-2">
                      Drop your CSV file here
                    </p>
                    <p className="text-sm text-[#9ea1a7] mb-4">
                      or click to browse
                    </p>
                  </>
                )}

                <input
                  type="file"
                  id="file-upload"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-2 bg-[#183b6d] text-white rounded-md hover:bg-[#0d2545] cursor-pointer transition-all"
                >
                  Choose File
                </label>

                <p className="text-xs text-[#9ea1a7] mt-4">
                  Accepts CSV files up to 50MB
                </p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Preview */}
            {preview && preview.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-[#183b6d] mb-4">
                  Preview (First {preview.length} rows)
                </h3>
                <div className="border border-[#9ea1a7]/20 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#183b6d]/5">
                        <tr>
                          {Object.keys(preview[0]).slice(0, 6).map((header, i) => (
                            <th key={i} className="px-4 py-3 text-left text-xs font-medium text-[#183b6d] uppercase tracking-wider">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-[#9ea1a7]/10">
                        {preview.map((row, i) => (
                          <tr key={i} className="hover:bg-[#183b6d]/5">
                            {Object.values(row).slice(0, 6).map((value: any, j) => (
                              <td key={j} className="px-4 py-3 text-[#575757] whitespace-nowrap">
                                {String(value).substring(0, 30)}
                                {String(value).length > 30 ? '...' : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column Mapping Info */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-900 font-medium mb-2">Auto-Mapping Enabled</p>
                  <p className="text-xs text-blue-800">
                    The system will automatically map common column names (Company Name, Email, LinkedIn, etc.) to the correct database fields.
                  </p>
                </div>
              </div>
            )}

            {/* Import Button */}
            {file && !uploading && (
              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-8 py-3 bg-[#dba63f] text-white font-medium rounded-md hover:bg-[#c49435] transition-all disabled:opacity-50"
                >
                  Import Contacts →
                </button>
              </div>
            )}

            {/* Uploading State */}
            {uploading && (
              <div className="mt-8">
                <div className="bg-white border border-[#9ea1a7]/20 rounded-lg p-8">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#9ea1a7]/20 border-t-[#183b6d] mb-4"></div>
                    <p className="text-lg text-[#183b6d] font-medium">Importing contacts...</p>
                    <p className="text-sm text-[#575757] mt-2">
                      This may take a few moments for large files
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Success Screen */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white border border-green-200 rounded-lg p-8">
              {/* Success Icon */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-serif text-[#183b6d] mb-2">
                  Import Complete!
                </h2>
                <p className="text-[#575757]">
                  Your contacts have been successfully imported
                </p>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center p-4 bg-[#183b6d]/5 rounded-lg">
                    <div className="text-3xl font-bold text-[#183b6d] mb-1">
                      {stats.totalRows.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#575757]">Total Rows</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {stats.imported.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#575757]">Imported</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {stats.skipped.toLocaleString()}
                    </div>
                    <div className="text-xs text-[#575757]">Skipped</div>
                  </div>
                </div>
              )}

              {/* Skipped Details */}
              {stats && stats.skipped > 0 && stats.skippedDetails && stats.skippedDetails.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-[#183b6d] mb-3">
                    Skipped Rows (First {stats.skippedDetails.length})
                  </h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 max-h-48 overflow-y-auto">
                    {stats.skippedDetails.map((skip, i) => (
                      <div key={i} className="text-xs text-yellow-800 mb-2">
                        <strong>Row {skip.row}:</strong> {skip.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Link
                  href="/contacts"
                  className="flex-1 px-6 py-3 text-center bg-[#183b6d] text-white rounded-md hover:bg-[#0d2545] transition-all"
                >
                  View All Contacts →
                </Link>
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-3 text-center border border-[#9ea1a7]/30 text-[#575757] rounded-md hover:border-[#183b6d] hover:text-[#183b6d] transition-all"
                >
                  Import Another File
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
