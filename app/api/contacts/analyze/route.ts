// app/api/contacts/analyze/route.ts
// API endpoint for analyzing CSV format and suggesting column mappings

import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { analyzeCSV, CSVAnalysisResult } from '@/lib/csv-analyzer'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    // Get file from form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      )
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()

    // Parse CSV
    const parseResult = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: resolve,
        error: reject
      })
    })

    if (parseResult.errors.length > 0) {
      console.error('CSV parse errors:', parseResult.errors)
      return NextResponse.json(
        { error: 'Failed to parse CSV file', details: parseResult.errors },
        { status: 400 }
      )
    }

    const rows = parseResult.data
    const headers = parseResult.meta.fields || []

    if (headers.length === 0) {
      return NextResponse.json(
        { error: 'No columns detected in CSV' },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // Analyze CSV using our smart analyzer
    const analysis: CSVAnalysisResult = analyzeCSV(headers, rows)

    // Return analysis result
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      detectedFormat: analysis.detectedFormat,
      columns: analysis.columns,
      rowCount: analysis.rowCount,
      sampleRows: analysis.sampleRows,
      warnings: analysis.warnings,
      stats: {
        totalColumns: headers.length,
        mappedColumns: analysis.columns.filter(c => c.targetField !== null).length,
        highConfidence: analysis.columns.filter(c => c.confidence === 'high').length,
        mediumConfidence: analysis.columns.filter(c => c.confidence === 'medium').length,
        lowConfidence: analysis.columns.filter(c => c.confidence === 'low').length,
        unmappedColumns: analysis.columns.filter(c => c.targetField === null).length
      }
    })

  } catch (error: any) {
    console.error('CSV analysis error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze CSV file',
        details: error.message
      },
      { status: 500 }
    )
  }
}
