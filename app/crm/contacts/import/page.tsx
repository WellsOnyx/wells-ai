'use client'

/**
 * CSV Import Wizard
 *
 * Multi-step wizard for importing contacts from CSV files:
 * 1. Upload CSV file (drag & drop)
 * 2. Preview data and map columns to fields
 * 3. Configure tags, list assignment
 * 4. Import progress and results
 */

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ChevronDown,
  Tag,
  ListPlus,
  Users,
  FileText,
  Settings2,
} from 'lucide-react'

// Field mapping options
const FIELD_OPTIONS = [
  { value: '', label: 'Skip this column' },
  { value: 'email', label: 'Email *', required: true },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job Title' },
  { value: 'industry', label: 'Industry' },
  { value: 'company_size', label: 'Company Size' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'twitter_handle', label: 'Twitter Handle' },
  { value: 'website', label: 'Website' },
]

interface ParsedCSV {
  headers: string[]
  rows: string[][]
  mapping: Record<string, string>
}

interface ImportResult {
  success: boolean
  totalRows: number
  imported: number
  duplicates: number
  errors: number
  sample: Array<{
    email: string
    fullName: string
    company?: string
    title?: string
  }>
}

export default function CSVImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Steps: 1=Upload, 2=Map, 3=Configure, 4=Import
  const [step, setStep] = useState(1)

  // File state
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Parsed CSV
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null)

  // Configuration
  const [listName, setListName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')

  // Import state
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Parse CSV file
  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row')
    }

    const parseRow = (line: string): string[] => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())
      return values
    }

    const headers = parseRow(lines[0])
    const rows = lines.slice(1).map(parseRow).filter(row => row.some(cell => cell))

    // Auto-detect column mapping
    const mapping: Record<string, string> = {}
    const fieldAliases: Record<string, string[]> = {
      email: ['email', 'email_address', 'e-mail', 'work_email', 'business_email'],
      first_name: ['first_name', 'firstname', 'first', 'given_name', 'fname'],
      last_name: ['last_name', 'lastname', 'last', 'family_name', 'surname', 'lname'],
      full_name: ['full_name', 'fullname', 'name', 'contact_name', 'person_name'],
      phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'work_phone'],
      company: ['company', 'company_name', 'organization', 'org', 'employer', 'account_name'],
      title: ['title', 'job_title', 'position', 'role', 'designation'],
      industry: ['industry', 'sector', 'vertical'],
      city: ['city', 'town', 'locality'],
      state: ['state', 'province', 'region'],
      country: ['country', 'nation', 'country_name'],
      linkedin_url: ['linkedin', 'linkedin_url', 'linkedin_profile'],
    }

    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim().replace(/[\s-]+/g, '_')
      for (const [field, aliases] of Object.entries(fieldAliases)) {
        if (aliases.includes(normalizedHeader)) {
          mapping[index.toString()] = field
          break
        }
      }
    })

    return { headers, rows, mapping }
  }

  // Handle file selection
  const handleFile = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setParseError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        setParsedCSV(parsed)

        // Auto-generate list name from file
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '')
        setListName(fileName)

        setStep(2)
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse CSV')
      }
    }
    reader.readAsText(selectedFile)
  }, [])

  // Drag and drop handlers
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
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        handleFile(droppedFile)
      } else {
        setParseError('Please upload a CSV file')
      }
    }
  }

  // Update column mapping
  const updateMapping = (columnIndex: string, fieldName: string) => {
    if (!parsedCSV) return

    const newMapping = { ...parsedCSV.mapping }
    // Remove existing mapping for this field
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === fieldName) {
        delete newMapping[key]
      }
    })
    // Set new mapping
    if (fieldName) {
      newMapping[columnIndex] = fieldName
    } else {
      delete newMapping[columnIndex]
    }

    setParsedCSV({ ...parsedCSV, mapping: newMapping })
  }

  // Check if email is mapped
  const isEmailMapped = parsedCSV ? Object.values(parsedCSV.mapping).includes('email') : false

  // Add tag
  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  // Remove tag
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  // Handle import
  const handleImport = async () => {
    if (!parsedCSV || !file || !listName) return

    setImporting(true)
    setImportError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('listName', listName)
      formData.append('mapping', JSON.stringify(parsedCSV.mapping))
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags))
      }

      const res = await fetch('/api/crm/contacts/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setImportResult({
        success: true,
        totalRows: data.totalRows,
        imported: data.imported,
        duplicates: data.duplicates,
        errors: data.errors,
        sample: data.sample,
      })
      setStep(4)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-8">
      {[
        { num: 1, label: 'Upload' },
        { num: 2, label: 'Map Columns' },
        { num: 3, label: 'Configure' },
        { num: 4, label: 'Complete' },
      ].map((s, i) => (
        <div key={s.num} className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step > s.num
                  ? 'bg-green-500 text-black'
                  : step === s.num
                  ? 'bg-amber-500 text-black'
                  : 'bg-[var(--surface)] text-[var(--text-tertiary)]'
              }`}
            >
              {step > s.num ? <Check className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-xs mt-1 ${
              step >= s.num ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
            }`}>
              {s.label}
            </span>
          </div>
          {i < 3 && (
            <div className={`w-16 h-0.5 ${
              step > s.num ? 'bg-green-500' : 'bg-[var(--border)]'
            }`} />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/crm/contacts" className="p-2 hover:bg-[var(--surface-hover)] rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Import Contacts</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  Upload a CSV file to add contacts
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {renderStepIndicator()}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive
                  ? 'border-amber-500 bg-amber-500/10'
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
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFile(e.target.files[0])
                  }
                }}
              />

              <FileSpreadsheet className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {dragActive ? 'Drop your CSV file here' : 'Drag and drop your CSV file'}
              </h3>
              <p className="text-[var(--text-secondary)] mb-6">
                or click to browse your files
              </p>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 transition-all"
              >
                <Upload className="w-5 h-5" />
                Choose File
              </button>

              {parseError && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 text-sm text-[var(--text-secondary)]">
              <h4 className="font-medium mb-2">Supported format:</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>CSV files with header row</li>
                <li>Email column is required</li>
                <li>Optional: name, phone, company, title, etc.</li>
                <li>Maximum 10,000 rows per import</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && parsedCSV && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Map Columns</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {parsedCSV.rows.length} rows found in {file?.name}
                  </p>
                </div>
                {!isEmailMapped && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Email column must be mapped
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">
                      CSV Column
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">
                      Map To
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-secondary)]">
                      Sample Data
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {parsedCSV.headers.map((header, index) => (
                    <tr key={index} className="hover:bg-[var(--surface-hover)]">
                      <td className="px-4 py-3">
                        <span className="font-medium">{header}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={parsedCSV.mapping[index.toString()] || ''}
                          onChange={(e) => updateMapping(index.toString(), e.target.value)}
                          className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-amber-500/50"
                        >
                          {FIELD_OPTIONS.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              disabled={
                                option.value !== '' &&
                                Object.values(parsedCSV.mapping).includes(option.value) &&
                                parsedCSV.mapping[index.toString()] !== option.value
                              }
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {parsedCSV.rows.slice(0, 3).map((row, rowIndex) => (
                            <span
                              key={rowIndex}
                              className="px-2 py-0.5 bg-[var(--surface)] rounded text-xs text-[var(--text-secondary)] truncate max-w-[150px]"
                            >
                              {row[index] || '-'}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-[var(--border)] flex justify-between">
              <button
                onClick={() => {
                  setStep(1)
                  setParsedCSV(null)
                  setFile(null)
                }}
                className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!isEmailMapped}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 3 && parsedCSV && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-amber-400" />
              Configure Import
            </h3>

            <div className="space-y-6">
              {/* List Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <ListPlus className="w-4 h-4 inline mr-2" />
                  List Name *
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g., Q1 Leads, Conference Attendees"
                  className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Contacts will be grouped under this list
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Tag className="w-4 h-4 inline mr-2" />
                  Tags (optional)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-amber-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add a tag..."
                    className="flex-1 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    onClick={addTag}
                    disabled={!newTag}
                    className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-[var(--surface)] rounded-lg p-4">
                <h4 className="font-medium mb-3">Import Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">File:</span>
                    <span className="ml-2 font-medium">{file?.name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Rows:</span>
                    <span className="ml-2 font-medium">{parsedCSV.rows.length}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">List:</span>
                    <span className="ml-2 font-medium">{listName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Mapped fields:</span>
                    <span className="ml-2 font-medium">
                      {Object.keys(parsedCSV.mapping).length}
                    </span>
                  </div>
                </div>
              </div>

              {importError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!listName || importing}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Import {parsedCSV.rows.length} Contacts
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && importResult && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>

            <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
            <p className="text-[var(--text-secondary)] mb-8">
              Successfully imported contacts to "{listName}"
            </p>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-[var(--surface)] rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">
                  {importResult.totalRows}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">Total Rows</div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">
                  {importResult.imported}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">Imported</div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-4">
                <div className="text-3xl font-bold text-amber-400">
                  {importResult.duplicates}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">Duplicates</div>
              </div>
              <div className="bg-[var(--surface)] rounded-lg p-4">
                <div className="text-3xl font-bold text-red-400">
                  {importResult.errors}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">Errors</div>
              </div>
            </div>

            {importResult.sample.length > 0 && (
              <div className="bg-[var(--surface)] rounded-lg p-4 mb-8 text-left">
                <h4 className="font-medium mb-3">Sample Imported Contacts</h4>
                <div className="space-y-2">
                  {importResult.sample.map((contact, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold text-xs">
                        {(contact.fullName || contact.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium">{contact.fullName || contact.email}</span>
                        {contact.company && (
                          <span className="text-[var(--text-secondary)]"> at {contact.company}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setStep(1)
                  setFile(null)
                  setParsedCSV(null)
                  setListName('')
                  setTags([])
                  setImportResult(null)
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                <Upload className="w-5 h-5" />
                Import Another
              </button>
              <Link
                href="/crm/contacts"
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-black rounded-lg font-semibold hover:bg-amber-400"
              >
                <Users className="w-5 h-5" />
                View Contacts
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
