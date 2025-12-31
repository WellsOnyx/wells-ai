'use client'

/**
 * ColumnMapper - Map CSV columns to CRM fields
 *
 * Features:
 * - Auto-detect column mappings
 * - Manual override
 * - Sample data preview
 * - Required field validation
 */

import { useState, useEffect } from 'react'
import {
  Check,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'

// Available CRM fields
const FIELD_OPTIONS = [
  { value: '', label: 'Skip this column', required: false },
  { value: 'email', label: 'Email', required: true },
  { value: 'first_name', label: 'First Name', required: false },
  { value: 'last_name', label: 'Last Name', required: false },
  { value: 'full_name', label: 'Full Name', required: false },
  { value: 'phone', label: 'Phone', required: false },
  { value: 'company', label: 'Company', required: false },
  { value: 'title', label: 'Job Title', required: false },
  { value: 'industry', label: 'Industry', required: false },
  { value: 'company_size', label: 'Company Size', required: false },
  { value: 'city', label: 'City', required: false },
  { value: 'state', label: 'State', required: false },
  { value: 'country', label: 'Country', required: false },
  { value: 'linkedin_url', label: 'LinkedIn URL', required: false },
  { value: 'twitter_handle', label: 'Twitter Handle', required: false },
  { value: 'website', label: 'Website', required: false },
]

// Auto-mapping aliases
const FIELD_ALIASES: Record<string, string[]> = {
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

interface ColumnMapperProps {
  headers: string[]
  sampleData: string[][]
  mapping: Record<string, string>
  onMappingChange: (mapping: Record<string, string>) => void
  className?: string
}

export default function ColumnMapper({
  headers,
  sampleData,
  mapping,
  onMappingChange,
  className = '',
}: ColumnMapperProps) {
  // Check if required fields are mapped
  const isEmailMapped = Object.values(mapping).includes('email')

  // Get sample values for a column
  const getSampleValues = (columnIndex: number): string[] => {
    return sampleData.slice(0, 3).map(row => row[columnIndex] || '').filter(Boolean)
  }

  // Update a single column mapping
  const updateMapping = (columnIndex: number, fieldName: string) => {
    const newMapping = { ...mapping }

    // Remove existing mapping for this field (prevent duplicates)
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === fieldName && key !== columnIndex.toString()) {
        delete newMapping[key]
      }
    })

    // Set new mapping
    if (fieldName) {
      newMapping[columnIndex.toString()] = fieldName
    } else {
      delete newMapping[columnIndex.toString()]
    }

    onMappingChange(newMapping)
  }

  // Check if a field is already mapped to another column
  const isFieldMapped = (fieldName: string, currentIndex: number): boolean => {
    return Object.entries(mapping).some(
      ([key, value]) => value === fieldName && key !== currentIndex.toString()
    )
  }

  // Get mapped field label
  const getMappedFieldLabel = (columnIndex: number): string | null => {
    const mappedField = mapping[columnIndex.toString()]
    if (!mappedField) return null
    const field = FIELD_OPTIONS.find(f => f.value === mappedField)
    return field?.label || null
  }

  return (
    <div className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Map Columns to Fields</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Match your CSV columns to CRM fields
          </p>
        </div>
        {!isEmailMapped && (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            Email column required
          </div>
        )}
      </div>

      {/* Mapping Table */}
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
              <th className="w-12 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {headers.map((header, index) => {
              const samples = getSampleValues(index)
              const mappedField = mapping[index.toString()]
              const isMapped = !!mappedField

              return (
                <tr key={index} className="hover:bg-[var(--surface-hover)]">
                  <td className="px-4 py-3">
                    <span className="font-medium">{header}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <select
                        value={mappedField || ''}
                        onChange={(e) => updateMapping(index, e.target.value)}
                        className={`w-full px-3 py-2 bg-[var(--surface)] border rounded-lg text-sm appearance-none cursor-pointer focus:outline-none ${
                          isMapped
                            ? 'border-green-500/30 text-green-400'
                            : 'border-[var(--border)]'
                        } focus:border-amber-500/50`}
                      >
                        {FIELD_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={option.value !== '' && isFieldMapped(option.value, index)}
                          >
                            {option.label}{option.required ? ' *' : ''}
                            {option.value !== '' && isFieldMapped(option.value, index) ? ' (already mapped)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {samples.length > 0 ? (
                        samples.map((sample, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[var(--surface)] rounded text-xs text-[var(--text-secondary)] truncate max-w-[120px]"
                            title={sample}
                          >
                            {sample}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">No data</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isMapped && (
                      <Check className="w-5 h-5 text-green-400" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">
            {Object.keys(mapping).length} of {headers.length} columns mapped
          </span>
          {isEmailMapped ? (
            <span className="flex items-center gap-1 text-green-400">
              <Check className="w-4 h-4" />
              Ready to import
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              Map email column to continue
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
