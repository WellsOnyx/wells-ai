// @ts-nocheck
/**
 * AI File Analysis
 * Provides intelligent analysis of uploaded files using AI
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getFileById, getFileByUrl, updateFileMetadata } from './storage';
import { extractText, analyzeImage } from './processors';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SummaryResult {
  success: boolean;
  summary?: string;
  keyPoints?: string[];
  wordCount?: number;
  error?: string;
}

export interface ExtractedData {
  success: boolean;
  data?: Record<string, any>;
  confidence?: number;
  error?: string;
}

export interface ComparisonResult {
  success: boolean;
  comparison?: string;
  similarities?: string[];
  differences?: string[];
  error?: string;
}

export interface DataExtractionSchema {
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    description?: string;
    required?: boolean;
  }>;
  instructions?: string;
}

// ============================================================================
// AI CLIENTS
// ============================================================================

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// ============================================================================
// FILE CONTENT RETRIEVAL
// ============================================================================

/**
 * Fetch file content from URL and extract text
 */
async function fetchFileContent(fileUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  extractedText: string | null;
}> {
  // Fetch the file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Try to extract text
  const extraction = await extractText(buffer, contentType);
  const extractedText = extraction.success ? extraction.text || null : null;

  return { buffer, contentType, extractedText };
}

// ============================================================================
// GENERAL FILE ANALYSIS
// ============================================================================

/**
 * Analyze a file with AI using a custom prompt
 */
export async function analyzeFile(
  fileUrl: string,
  prompt: string,
  options?: {
    model?: 'openai' | 'anthropic';
    maxTokens?: number;
    temperature?: number;
  }
): Promise<AnalysisResult> {
  try {
    const { buffer, contentType, extractedText } = await fetchFileContent(fileUrl);

    // For images, use vision capabilities
    if (contentType.startsWith('image/')) {
      const result = await analyzeImage(buffer, contentType, prompt);
      return {
        success: result.success,
        analysis: result.analysis,
        error: result.error,
      };
    }

    // For other files, use extracted text
    if (!extractedText) {
      return {
        success: false,
        error: 'Could not extract text from file for analysis',
      };
    }

    const modelProvider = options?.model || 'openai';

    if (modelProvider === 'anthropic') {
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: options?.maxTokens || 4096,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n---\n\nFile Content:\n${extractedText}`,
          },
        ],
      });

      const analysis = response.content[0].type === 'text' ? response.content[0].text : '';
      return {
        success: true,
        analysis,
        metadata: {
          model: 'claude-sonnet-4-5-20250514',
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } else {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n---\n\nFile Content:\n${extractedText}`,
          },
        ],
      });

      const analysis = response.choices[0]?.message?.content || '';
      return {
        success: true,
        analysis,
        metadata: {
          model: 'gpt-4o',
          tokensUsed: response.usage?.total_tokens,
        },
      };
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze file',
    };
  }
}

// ============================================================================
// DOCUMENT SUMMARIZATION
// ============================================================================

/**
 * Summarize a document
 */
export async function summarizeDocument(
  fileUrl: string,
  options?: {
    length?: 'brief' | 'standard' | 'detailed';
    format?: 'paragraph' | 'bullets' | 'structured';
    focus?: string;
  }
): Promise<SummaryResult> {
  try {
    const { extractedText, contentType, buffer } = await fetchFileContent(fileUrl);

    // For images, use vision to describe
    if (contentType.startsWith('image/')) {
      const result = await analyzeImage(
        buffer,
        contentType,
        'Provide a comprehensive summary of what this image shows. Include all relevant details, text visible in the image, and any important information.'
      );

      return {
        success: result.success,
        summary: result.analysis,
        error: result.error,
      };
    }

    if (!extractedText) {
      return {
        success: false,
        error: 'Could not extract text from file for summarization',
      };
    }

    const lengthInstructions = {
      brief: 'Provide a very concise summary in 2-3 sentences.',
      standard: 'Provide a comprehensive summary in 1-2 paragraphs.',
      detailed: 'Provide a detailed summary covering all major points, themes, and important details.',
    };

    const formatInstructions = {
      paragraph: 'Write the summary as flowing paragraphs.',
      bullets: 'Present the summary as bullet points.',
      structured: 'Structure the summary with clear sections and headings.',
    };

    const prompt = `Summarize the following document.

${lengthInstructions[options?.length || 'standard']}
${formatInstructions[options?.format || 'paragraph']}
${options?.focus ? `Focus particularly on: ${options.focus}` : ''}

After the summary, list 3-5 key points from the document.

Document:
${extractedText}`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '';

    // Try to extract key points
    const keyPointsMatch = content.match(/key points?:?\s*\n([\s\S]*?)$/i);
    let keyPoints: string[] = [];
    let summary = content;

    if (keyPointsMatch) {
      summary = content.substring(0, keyPointsMatch.index).trim();
      const pointsText = keyPointsMatch[1];
      keyPoints = pointsText
        .split('\n')
        .map(line => line.replace(/^[-•*\d.)\]]+\s*/, '').trim())
        .filter(line => line.length > 0);
    }

    return {
      success: true,
      summary,
      keyPoints,
      wordCount: extractedText.split(/\s+/).length,
    };
  } catch (error) {
    console.error('Error summarizing document:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize document',
    };
  }
}

// ============================================================================
// STRUCTURED DATA EXTRACTION
// ============================================================================

/**
 * Extract structured data from a file based on a schema
 */
export async function extractData(
  fileUrl: string,
  schema: DataExtractionSchema
): Promise<ExtractedData> {
  try {
    const { extractedText, contentType, buffer } = await fetchFileContent(fileUrl);

    // For images, include vision analysis
    let content = extractedText || '';
    if (contentType.startsWith('image/')) {
      const imageResult = await analyzeImage(
        buffer,
        contentType,
        'Describe all text, data, numbers, and structured information visible in this image. Be as detailed as possible.'
      );
      if (imageResult.success && imageResult.analysis) {
        content = imageResult.analysis;
      }
    }

    if (!content) {
      return {
        success: false,
        error: 'Could not extract content from file',
      };
    }

    // Build schema description
    const schemaDescription = schema.fields
      .map(field => {
        let desc = `- ${field.name} (${field.type})`;
        if (field.description) desc += `: ${field.description}`;
        if (field.required) desc += ' [REQUIRED]';
        return desc;
      })
      .join('\n');

    const prompt = `Extract the following data fields from the document content. Return the data as a valid JSON object.

Fields to extract:
${schemaDescription}

${schema.instructions ? `Additional instructions: ${schema.instructions}` : ''}

If a field cannot be found, use null for optional fields or indicate "NOT_FOUND" for required fields.

Document content:
${content}

Respond with ONLY the JSON object, no additional text.`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const jsonContent = response.choices[0]?.message?.content || '{}';
    const data = JSON.parse(jsonContent);

    // Calculate confidence based on how many required fields were found
    const requiredFields = schema.fields.filter(f => f.required);
    const foundRequiredFields = requiredFields.filter(f => {
      const value = data[f.name];
      return value !== null && value !== undefined && value !== 'NOT_FOUND';
    });
    const confidence = requiredFields.length > 0
      ? foundRequiredFields.length / requiredFields.length
      : 1;

    return {
      success: true,
      data,
      confidence,
    };
  } catch (error) {
    console.error('Error extracting data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract data',
    };
  }
}

// ============================================================================
// DOCUMENT COMPARISON
// ============================================================================

/**
 * Compare multiple documents
 */
export async function compareDocuments(
  fileUrls: string[],
  options?: {
    focus?: string;
    detailed?: boolean;
  }
): Promise<ComparisonResult> {
  try {
    if (fileUrls.length < 2) {
      return {
        success: false,
        error: 'At least 2 files are required for comparison',
      };
    }

    if (fileUrls.length > 5) {
      return {
        success: false,
        error: 'Maximum 5 files can be compared at once',
      };
    }

    // Fetch and extract text from all files
    const fileContents = await Promise.all(
      fileUrls.map(async (url, index) => {
        const { extractedText, contentType, buffer } = await fetchFileContent(url);

        if (contentType.startsWith('image/')) {
          const imageResult = await analyzeImage(
            buffer,
            contentType,
            'Describe all content in this image in detail for comparison purposes.'
          );
          return {
            index: index + 1,
            content: imageResult.success ? imageResult.analysis : null,
            error: imageResult.error,
          };
        }

        return {
          index: index + 1,
          content: extractedText,
        };
      })
    );

    // Check if all files have content
    const failedFiles = fileContents.filter(f => !f.content);
    if (failedFiles.length > 0) {
      return {
        success: false,
        error: `Could not extract content from files: ${failedFiles.map(f => f.index).join(', ')}`,
      };
    }

    // Build comparison prompt
    const documentsText = fileContents
      .map(f => `=== Document ${f.index} ===\n${f.content}`)
      .join('\n\n');

    const prompt = `Compare the following ${fileUrls.length} documents and provide a comprehensive analysis.

${options?.focus ? `Focus particularly on: ${options.focus}` : ''}

Provide:
1. An overall comparison summary
2. Key similarities between the documents
3. Key differences between the documents
${options?.detailed ? '4. A detailed point-by-point comparison' : ''}

${documentsText}

Format your response with clear sections for:
- COMPARISON SUMMARY
- SIMILARITIES
- DIFFERENCES`;

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: options?.detailed ? 4096 : 2048,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse similarities and differences
    const similarities: string[] = [];
    const differences: string[] = [];

    const simMatch = content.match(/similarities:?\s*\n([\s\S]*?)(?=differences|$)/i);
    const diffMatch = content.match(/differences:?\s*\n([\s\S]*?)(?=$)/i);

    if (simMatch) {
      similarities.push(
        ...simMatch[1]
          .split('\n')
          .map(line => line.replace(/^[-•*\d.)\]]+\s*/, '').trim())
          .filter(line => line.length > 0)
      );
    }

    if (diffMatch) {
      differences.push(
        ...diffMatch[1]
          .split('\n')
          .map(line => line.replace(/^[-•*\d.)\]]+\s*/, '').trim())
          .filter(line => line.length > 0)
      );
    }

    return {
      success: true,
      comparison: content,
      similarities,
      differences,
    };
  } catch (error) {
    console.error('Error comparing documents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare documents',
    };
  }
}

// ============================================================================
// SPECIALIZED ANALYSIS
// ============================================================================

/**
 * Analyze a contract or legal document
 */
export async function analyzeContract(fileUrl: string): Promise<AnalysisResult> {
  return analyzeFile(fileUrl, `Analyze this contract/legal document and provide:
1. Summary of the agreement
2. Key parties involved
3. Important dates and deadlines
4. Key obligations for each party
5. Notable clauses or terms
6. Potential risks or concerns
7. Missing elements or recommendations`);
}

/**
 * Analyze a financial document
 */
export async function analyzeFinancialDocument(fileUrl: string): Promise<AnalysisResult> {
  return analyzeFile(fileUrl, `Analyze this financial document and provide:
1. Overview of the financial data
2. Key figures and metrics
3. Trends or patterns observed
4. Notable items or anomalies
5. Comparison to benchmarks (if applicable)
6. Key insights and recommendations`);
}

/**
 * Analyze a resume/CV
 */
export async function analyzeResume(fileUrl: string): Promise<AnalysisResult> {
  return analyzeFile(fileUrl, `Analyze this resume/CV and extract:
1. Contact information
2. Professional summary
3. Work experience (company, role, duration, key achievements)
4. Education
5. Skills and certifications
6. Notable accomplishments
7. Overall assessment and suitability for various roles`);
}

/**
 * Analyze an invoice
 */
export async function analyzeInvoice(fileUrl: string): Promise<ExtractedData> {
  return extractData(fileUrl, {
    fields: [
      { name: 'invoiceNumber', type: 'string', description: 'Invoice number', required: true },
      { name: 'invoiceDate', type: 'date', description: 'Date of invoice', required: true },
      { name: 'dueDate', type: 'date', description: 'Payment due date' },
      { name: 'vendor', type: 'object', description: 'Vendor name and address', required: true },
      { name: 'customer', type: 'object', description: 'Customer/Bill-to information' },
      { name: 'lineItems', type: 'array', description: 'List of items with description, quantity, unit price, amount' },
      { name: 'subtotal', type: 'number', description: 'Subtotal before tax' },
      { name: 'tax', type: 'number', description: 'Tax amount' },
      { name: 'total', type: 'number', description: 'Total amount due', required: true },
      { name: 'currency', type: 'string', description: 'Currency code' },
      { name: 'paymentTerms', type: 'string', description: 'Payment terms' },
    ],
    instructions: 'Extract all invoice details. For line items, include item description, quantity, unit price, and line total.',
  });
}

export default {
  analyzeFile,
  summarizeDocument,
  extractData,
  compareDocuments,
  analyzeContract,
  analyzeFinancialDocument,
  analyzeResume,
  analyzeInvoice,
};
