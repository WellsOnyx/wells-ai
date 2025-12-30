// CSV Import API - Bulk import contacts from CSV files
import { NextRequest, NextResponse } from 'next/server';
import { contactsDb } from '@/lib/crm/contacts-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for large imports

// Parse CSV string to array of objects
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return rows;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// POST - Import CSV file
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let csvText: string;
    let listName: string = 'imported';
    let sourceFile: string = 'api_upload';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      listName = (formData.get('listName') as string) || 'imported';

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      sourceFile = file.name;
      csvText = await file.text();
    } else if (contentType.includes('application/json')) {
      // Handle JSON with CSV data
      const body = await request.json();
      csvText = body.csv || body.data;
      listName = body.listName || 'imported';
      sourceFile = body.sourceFile || 'api_json';

      if (!csvText) {
        return NextResponse.json(
          { error: 'No CSV data provided' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      // Handle raw CSV text
      csvText = await request.text();
      const { searchParams } = new URL(request.url);
      listName = searchParams.get('list') || 'imported';
      sourceFile = searchParams.get('source') || 'api_raw';
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use multipart/form-data, application/json, or text/csv' },
        { status: 400 }
      );
    }

    // Parse CSV
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 }
      );
    }

    // Import contacts
    const result = await contactsDb.importCsv(rows, listName, sourceFile);

    return NextResponse.json({
      success: true,
      listName,
      sourceFile,
      totalRows: rows.length,
      imported: result.imported,
      duplicates: result.duplicates,
      errors: result.errors,
      // Include first few contacts as sample
      sample: result.contacts.slice(0, 5).map(c => ({
        email: c.email,
        fullName: c.fullName,
        company: c.company,
        title: c.title,
      })),
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    return NextResponse.json(
      { error: 'Failed to import contacts', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Get import status and available lists
export async function GET() {
  try {
    const lists = await contactsDb.getLists();

    return NextResponse.json({
      lists,
      supportedFormats: ['CSV'],
      requiredFields: ['email'],
      optionalFields: [
        'first_name', 'last_name', 'full_name', 'phone',
        'company', 'title', 'industry', 'company_size',
        'city', 'state', 'country',
        'linkedin_url', 'twitter_handle', 'website'
      ],
      maxRowsPerImport: 10000,
    });
  } catch (error) {
    console.error('Error fetching import info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import info' },
      { status: 500 }
    );
  }
}
