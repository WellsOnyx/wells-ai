// @ts-nocheck
'use client'

/**
 * Unified Chat Component
 * Shared chat interface that works on both Wells AI and Grain & Vault
 * Now with file attachment support
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, CheckCircle, AlertCircle, Paperclip, X, FileText, Image as ImageIcon, Eye } from 'lucide-react'
import { ProductType } from '@/lib/chat/personas'

// ============================================================================
// TYPES
// ============================================================================

interface AttachedFile {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  extractedText?: string
  hasExtractedText?: boolean
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  files?: AttachedFile[]
}

interface UnifiedChatProps {
  product: ProductType
  journey?: string
  conversationId?: string
  onConversationCreated?: (conversationId: string) => void
  treasuryContext?: {
    accountId?: string
    companyName?: string
    grainBalance?: number
    creditLine?: number
  }
  className?: string
  placeholder?: string
  welcomeMessage?: string
  enableFileAttachments?: boolean
  maxFiles?: number
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return ImageIcon
  return FileText
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
].join(',')

// ============================================================================
// COMPONENT
// ============================================================================

export default function UnifiedChat({
  product,
  journey,
  conversationId: initialConversationId,
  onConversationCreated,
  treasuryContext,
  className = '',
  placeholder,
  welcomeMessage,
  enableFileAttachments = true,
  maxFiles = 5,
}: UnifiedChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId)
  const [error, setError] = useState<string | null>(null)

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [previewFile, setPreviewFile] = useState<AttachedFile | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversation history if conversationId provided
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId)
    }
  }, [initialConversationId])

  // Add welcome message if provided and no messages
  useEffect(() => {
    if (welcomeMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: welcomeMessage }])
    }
  }, [welcomeMessage])

  const loadConversation = async (convId: string) => {
    try {
      const response = await fetch(`/api/chat/unified?conversationId=${convId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(
          data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            files: m.files,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading conversation:', error)
    }
  }

  // Handle file selection
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (attachedFiles.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    setIsUploading(true)
    setError(null)

    const uploadedFiles: AttachedFile[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', 'chat')
      if (conversationId) {
        formData.append('conversationId', conversationId)
      }

      try {
        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()
        uploadedFiles.push(data.file)
      } catch (error) {
        console.error('Upload error:', error)
        setError(error instanceof Error ? error.message : 'Upload failed')
      }
    }

    setIsUploading(false)
    setAttachedFiles(prev => [...prev, ...uploadedFiles])

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [attachedFiles.length, maxFiles, conversationId])

  // Remove attached file
  const removeFile = useCallback((fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    // Build message content including file context
    let fullContent = userMessage
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => {
        let context = `[Attached file: ${f.filename}]`
        if (f.extractedText) {
          // Include extracted text for AI context (truncated if too long)
          const truncatedText = f.extractedText.length > 2000
            ? f.extractedText.substring(0, 2000) + '...'
            : f.extractedText
          context += `\n\nFile content:\n${truncatedText}`
        }
        return context
      }).join('\n\n')

      fullContent = userMessage
        ? `${userMessage}\n\n${fileContext}`
        : fileContext
    }

    // Add user message to UI
    const userMsg: Message = {
      role: 'user',
      content: userMessage || 'Sent files',
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    // Clear attached files after sending
    setAttachedFiles([])

    setIsLoading(true)

    try {
      // Use orchestrated mode for better intent routing (v2.0)
      const response = await fetch('/api/chat/unified?orchestrated=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullContent,
          sessionId: conversationId,
          journey,
          previousMessages: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
          // Pass attached files with their extracted text for CSV processing
          attachedFiles: userMsg.files?.map(f => ({
            id: f.id,
            filename: f.filename,
            contentType: f.contentType,
            extractedText: f.extractedText,
          })),
          options: {
            enableAutonomousActions: false,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()

      // Update conversation ID if this is a new conversation
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId)
        onConversationCreated?.(data.conversationId)
      }

      // Add assistant response
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
    } catch (error) {
      console.error('Error sending message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
      // Remove the optimistically added user message on error
      setMessages(messages)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* File attachments in message */}
              {message.files && message.files.length > 0 && (
                <div className="mb-2 space-y-1">
                  {message.files.map(file => {
                    const Icon = getFileIcon(file.contentType)
                    const isImage = file.contentType.startsWith('image/')

                    return (
                      <div
                        key={file.id}
                        className={`flex items-center gap-2 p-2 rounded ${
                          message.role === 'user' ? 'bg-blue-500' : 'bg-white border border-gray-200'
                        }`}
                      >
                        {isImage ? (
                          <img
                            src={file.url}
                            alt={file.filename}
                            className="h-10 w-10 rounded object-cover cursor-pointer"
                            onClick={() => setPreviewFile(file)}
                          />
                        ) : (
                          <div
                            className={`h-10 w-10 rounded flex items-center justify-center ${
                              message.role === 'user' ? 'bg-blue-400' : 'bg-gray-100'
                            }`}
                          >
                            <Icon className={`h-5 w-5 ${
                              message.role === 'user' ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            message.role === 'user' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {file.filename}
                          </p>
                          <p className={`text-xs ${
                            message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => setPreviewFile(file)}
                          className={`p-1 rounded ${
                            message.role === 'user' ? 'hover:bg-blue-400' : 'hover:bg-gray-100'
                          }`}
                        >
                          <Eye className={`h-4 w-4 ${
                            message.role === 'user' ? 'text-white' : 'text-gray-500'
                          }`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm px-4">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="border-t bg-gray-50 px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map(file => {
              const Icon = getFileIcon(file.contentType)
              const isImage = file.contentType.startsWith('image/')

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border border-gray-200"
                >
                  {isImage ? (
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="h-6 w-6 rounded object-cover"
                    />
                  ) : (
                    <Icon className="h-4 w-4 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-700 max-w-[100px] truncate">
                    {file.filename}
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-0.5 hover:bg-gray-100 rounded"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2">
          {/* File attachment button */}
          {enableFileAttachments && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading || isUploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading || attachedFiles.length >= maxFiles}
                className={`p-2 rounded-lg transition-colors ${
                  attachedFiles.length > 0
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${(isLoading || isUploading || attachedFiles.length >= maxFiles) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Attach file"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </button>
            </>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              placeholder ||
              (product === 'grainvault'
                ? 'Ask about your balance, send a payment, or view transactions...'
                : 'What can I help you with today?')
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              (!input.trim() && attachedFiles.length === 0) || isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Product indicator */}
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <div
            className={`w-2 h-2 rounded-full ${
              product === 'grainvault' ? 'bg-green-500' : 'bg-blue-500'
            }`}
          />
          <span>
            {product === 'grainvault' ? 'Grain & Vault' : 'Wells AI'}
            {journey && ` - ${journey}`}
          </span>
          {conversationId && (
            <>
              <span>-</span>
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>Conversation saved</span>
            </>
          )}
          {enableFileAttachments && (
            <>
              <span>-</span>
              <Paperclip className="w-3 h-3" />
              <span>Files supported</span>
            </>
          )}
        </div>
      </div>

      {/* File preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium text-gray-900">{previewFile.filename}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[80vh]">
              {previewFile.contentType.startsWith('image/') ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.filename}
                  className="max-w-full max-h-full object-contain mx-auto"
                />
              ) : previewFile.contentType === 'application/pdf' ? (
                <iframe
                  src={previewFile.url}
                  className="w-full h-[70vh]"
                  title={previewFile.filename}
                />
              ) : previewFile.extractedText ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {previewFile.extractedText}
                </pre>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">Preview not available</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
