// @ts-nocheck
'use client';

/**
 * FileAnalysis Component
 * Display AI analysis results for files
 */

import { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Sparkles,
  ListTree,
  FileSearch,
  Scale,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisResultProps {
  type: 'analyze' | 'summarize' | 'extract' | 'compare' | 'contract' | 'financial' | 'resume' | 'invoice';
  success: boolean;
  analysis?: string;
  summary?: string;
  keyPoints?: string[];
  data?: Record<string, any>;
  confidence?: number;
  comparison?: string;
  similarities?: string[];
  differences?: string[];
  error?: string;
  isLoading?: boolean;
  filename?: string;
  onRetry?: () => void;
  className?: string;
}

interface FileAnalysisProps {
  fileId?: string;
  fileUrl?: string;
  filename: string;
  contentType: string;
  onAnalysisComplete?: (result: any) => void;
  className?: string;
}

// ============================================================================
// ANALYSIS RESULT DISPLAY
// ============================================================================

export function AnalysisResult({
  type,
  success,
  analysis,
  summary,
  keyPoints,
  data,
  confidence,
  comparison,
  similarities,
  differences,
  error,
  isLoading,
  filename,
  onRetry,
  className = '',
}: AnalysisResultProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const getTitle = () => {
    switch (type) {
      case 'summarize':
        return 'Document Summary';
      case 'extract':
        return 'Extracted Data';
      case 'compare':
        return 'Document Comparison';
      case 'contract':
        return 'Contract Analysis';
      case 'financial':
        return 'Financial Analysis';
      case 'resume':
        return 'Resume Analysis';
      case 'invoice':
        return 'Invoice Data';
      default:
        return 'Analysis Results';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'summarize':
        return FileText;
      case 'extract':
        return ListTree;
      case 'compare':
        return Scale;
      default:
        return FileSearch;
    }
  };

  const Icon = getIcon();

  const copyToClipboard = () => {
    let textToCopy = '';
    if (analysis) textToCopy = analysis;
    else if (summary) textToCopy = summary;
    else if (comparison) textToCopy = comparison;
    else if (data) textToCopy = JSON.stringify(data, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsFile = () => {
    let content = '';
    let fileExtension = 'txt';

    if (data) {
      content = JSON.stringify(data, null, 2);
      fileExtension = 'json';
    } else if (analysis) {
      content = analysis;
    } else if (summary) {
      content = summary + (keyPoints ? '\n\nKey Points:\n' + keyPoints.map(p => `- ${p}`).join('\n') : '');
    } else if (comparison) {
      content = comparison;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${filename || 'result'}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          <span className="text-gray-600">Analyzing file...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (!success || error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-6 ${className}`}>
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Analysis Failed</span>
        </div>
        <p className="mt-2 text-sm text-gray-600">{error || 'An unknown error occurred'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
          >
            Retry Analysis
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{getTitle()}</h3>
            {filename && (
              <p className="text-sm text-gray-500">{filename}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Confidence indicator */}
          {confidence !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-xs">
              <span className="text-green-700">{Math.round(confidence * 100)}% confident</span>
            </div>
          )}

          {/* Action buttons */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard();
            }}
            className="p-2 hover:bg-gray-200 rounded-lg"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadAsFile();
            }}
            className="p-2 hover:bg-gray-200 rounded-lg"
            title="Download"
          >
            <Download className="h-4 w-4 text-gray-500" />
          </button>

          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Summary with key points */}
          {summary && (
            <div>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{summary}</div>
              </div>

              {keyPoints && keyPoints.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Key Points</h4>
                  <ul className="space-y-1">
                    {keyPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-blue-500 mt-1">-</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* General analysis */}
          {analysis && !summary && (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700">{analysis}</div>
            </div>
          )}

          {/* Extracted data */}
          {data && (
            <div>
              <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[400px]">
                <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Comparison results */}
          {comparison && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{comparison}</div>
              </div>

              {similarities && similarities.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2">Similarities</h4>
                  <ul className="space-y-1">
                    {similarities.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 mt-1">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {differences && differences.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">Differences</h4>
                  <ul className="space-y-1">
                    {differences.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-red-500 mt-1">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FILE ANALYSIS COMPONENT (with analysis selection)
// ============================================================================

export default function FileAnalysis({
  fileId,
  fileUrl,
  filename,
  contentType,
  onAnalysisComplete,
  className = '',
}: FileAnalysisProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const analysisOptions = [
    {
      id: 'summarize',
      label: 'Summarize',
      description: 'Get a summary of the document',
      icon: FileText,
    },
    {
      id: 'analyze',
      label: 'Custom Analysis',
      description: 'Ask a specific question about the file',
      icon: Sparkles,
      requiresPrompt: true,
    },
    {
      id: 'extract',
      label: 'Extract Data',
      description: 'Extract structured data from the document',
      icon: ListTree,
    },
  ];

  // Add specialized analysis based on content type
  if (contentType === 'application/pdf' || contentType.includes('word')) {
    analysisOptions.push(
      { id: 'contract', label: 'Contract Analysis', description: 'Analyze as a legal contract', icon: FileSearch },
      { id: 'financial', label: 'Financial Analysis', description: 'Analyze financial data', icon: FileSearch },
      { id: 'resume', label: 'Resume Analysis', description: 'Analyze as a resume/CV', icon: FileSearch }
    );
  }

  if (contentType.includes('excel') || contentType.includes('spreadsheet') || contentType === 'text/csv') {
    analysisOptions.push(
      { id: 'invoice', label: 'Invoice Extraction', description: 'Extract invoice data', icon: ListTree }
    );
  }

  const runAnalysis = async (type: string) => {
    setIsLoading(true);
    setSelectedAnalysis(type);
    setResult(null);

    try {
      const body: any = {
        type,
      };

      if (fileId) body.fileId = fileId;
      if (fileUrl) body.fileUrl = fileUrl;
      if (type === 'analyze' && customPrompt) body.prompt = customPrompt;
      if (type === 'extract') {
        // Default schema for common document types
        body.schema = {
          fields: [
            { name: 'title', type: 'string', description: 'Document title' },
            { name: 'date', type: 'date', description: 'Document date' },
            { name: 'parties', type: 'array', description: 'Parties involved' },
            { name: 'keyTerms', type: 'array', description: 'Key terms or items' },
            { name: 'amounts', type: 'array', description: 'Monetary amounts' },
          ],
        };
      }

      const response = await fetch('/api/files/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setResult(data);
      onAnalysisComplete?.(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Analysis Options */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {analysisOptions.map(option => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => {
                if (option.requiresPrompt) {
                  setSelectedAnalysis(option.id);
                } else {
                  runAnalysis(option.id);
                }
              }}
              disabled={isLoading}
              className={`
                p-3 rounded-lg border text-left transition-colors
                ${selectedAnalysis === option.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm text-gray-900">{option.label}</span>
              </div>
              <p className="text-xs text-gray-500">{option.description}</p>
            </button>
          );
        })}
      </div>

      {/* Custom Prompt Input */}
      {selectedAnalysis === 'analyze' && (
        <div className="space-y-2">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your question or analysis prompt..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <button
            onClick={() => runAnalysis('analyze')}
            disabled={!customPrompt.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      )}

      {/* Results */}
      {(result || isLoading) && (
        <AnalysisResult
          type={selectedAnalysis as any}
          success={result?.success ?? true}
          analysis={result?.analysis}
          summary={result?.summary}
          keyPoints={result?.keyPoints}
          data={result?.data}
          confidence={result?.confidence}
          comparison={result?.comparison}
          similarities={result?.similarities}
          differences={result?.differences}
          error={result?.error}
          isLoading={isLoading}
          filename={filename}
          onRetry={() => runAnalysis(selectedAnalysis!)}
        />
      )}
    </div>
  );
}

export { FileAnalysis, AnalysisResult };
export type { FileAnalysisProps, AnalysisResultProps };
