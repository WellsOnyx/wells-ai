'use client'

/**
 * Enhanced Jobs Chat Page
 *
 * Pure conversational interface with job seeker enhancements:
 * - Resume upload and parsing
 * - Quick career actions
 * - Skills highlighting
 * - Faith-based encouragement
 *
 * "I have fought the good fight, I have finished the race,
 *  I have kept the faith." - 2 Timothy 4:7
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Mic, MicOff, Sparkles, Upload, FileText, Briefcase, TrendingUp, Target, Heart, BookOpen, X, CheckCircle } from 'lucide-react'
import Link from 'next/link'

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    intent?: string
    extractedData?: Record<string, unknown>
    suggestedActions?: string[]
    skills?: string[]
    faithEncouragement?: string
  }
}

interface UploadedResume {
  name: string
  parsedAt: Date
  skills: string[]
  experience: string[]
  summary: string
}

// Faith-based affirmations for job seekers
const FAITH_AFFIRMATIONS = [
  { text: "Your skills are gifts. Let's help the right employer see them.", verse: "1 Peter 4:10" },
  { text: "Every interview is an opportunity to share your story.", verse: "Proverbs 16:3" },
  { text: "Trust the journey. The right role is waiting for you.", verse: "Jeremiah 29:11" },
  { text: "Your experience matters. Your next chapter is being written.", verse: "Isaiah 43:19" },
  { text: "Preparation + faith = breakthrough.", verse: "Proverbs 21:31" },
  { text: "Run your race with perseverance.", verse: "Hebrews 12:1" },
  { text: "Your integrity will guide you.", verse: "Proverbs 11:3" },
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function JobsChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "I'm Wells. I don't do job boards - I get you direct intros to hiring managers. Tell me about yourself and what you're looking for. You can also upload your resume if you'd like me to understand your full background.\n\nWhat kind of role would be perfect for you?",
      timestamp: new Date(),
      metadata: {
        faithEncouragement: "Your skills are gifts. Let's help the right employer see them."
      }
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [uploadedResume, setUploadedResume] = useState<UploadedResume | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showResumePanel, setShowResumePanel] = useState(false)
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>({})
  const [currentAffirmation, setCurrentAffirmation] = useState(FAITH_AFFIRMATIONS[0])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rotate affirmations
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAffirmation(FAITH_AFFIRMATIONS[Math.floor(Math.random() * FAITH_AFFIRMATIONS.length)])
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }, [])

  // Handle resume upload
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'resume')

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()

      setUploadedResume({
        name: file.name,
        parsedAt: new Date(),
        skills: data.skills || [],
        experience: data.experience || [],
        summary: data.summary || ''
      })

      // Add a message about the resume
      const resumeMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `I've reviewed your resume. Here's what stands out:\n\n**Key Skills:** ${(data.skills || []).slice(0, 5).join(', ')}\n\n**Experience Highlights:** ${data.summary || 'Great background!'}\n\nNow tell me - what's the dream role? What would make you excited to go to work every day?`,
        timestamp: new Date(),
        metadata: {
          skills: data.skills,
          faithEncouragement: "Your experience is a gift. Let's put it to work."
        }
      }

      setMessages(prev => [...prev, resumeMessage])
      setShowResumePanel(true)
    } catch (error) {
      console.error('Resume upload error:', error)
      // Still acknowledge the attempt
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I had trouble processing that file, but no worries - just tell me about your background and I'll work with that. What's your professional story?",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const response = await fetch('/api/wells-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          journey: 'jobs',
          extractedData: {
            ...extractedData,
            uploadedResume: uploadedResume
          }
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      // Handle extracted data from AI
      if (data.extractedData) {
        const newData = { ...extractedData, ...data.extractedData }
        setExtractedData(newData)
      }

      // Pick a random faith encouragement
      const encouragement = FAITH_AFFIRMATIONS[Math.floor(Math.random() * FAITH_AFFIRMATIONS.length)]

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message || "I'm here to help. Tell me more about what you're looking for.",
        timestamp: new Date(),
        metadata: {
          intent: data.intent,
          extractedData: data.extractedData,
          suggestedActions: data.suggestedActions,
          faithEncouragement: data.showEncouragement ? encouragement.text : undefined
        }
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: "I'd love to help with that. Could you tell me a bit more about your background and what you're looking for?",
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleQuickAction = (action: string) => {
    setInput(action)
    inputRef.current?.focus()
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* Ambient background gradient - purple/pink for jobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),transparent)] pointer-events-none" />

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-xl bg-black/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Wells AI</h1>
                <p className="text-xs text-white/40">Your Career Companion</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {/* Resume upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{uploadedResume ? 'Update Resume' : 'Upload Resume'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleResumeUpload}
                className="hidden"
              />

              {/* Status indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-white/60">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Resume Panel (collapsible) */}
      {uploadedResume && showResumePanel && (
        <div className="relative z-10 border-b border-white/5 bg-purple-500/5 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{uploadedResume.name}</p>
                  <p className="text-xs text-white/40">{uploadedResume.skills.length} skills identified</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 overflow-hidden max-w-[300px]">
                  {uploadedResume.skills.slice(0, 3).map((skill, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 whitespace-nowrap">
                      {skill}
                    </span>
                  ))}
                  {uploadedResume.skills.length > 3 && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/50">
                      +{uploadedResume.skills.length - 3}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowResumePanel(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`mb-6 flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                message.role === 'assistant'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg'
                  : 'bg-white/10 border border-white/10'
              }`}>
                {message.role === 'assistant' ? (
                  <span className="text-white font-bold">W</span>
                ) : (
                  <span className="text-white/70 text-sm font-medium">You</span>
                )}
              </div>

              {/* Message Content */}
              <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-white/10 text-white border border-white/10 rounded-br-md backdrop-blur-sm'
                      : 'bg-white/[0.03] text-white/90 border border-white/[0.06] rounded-bl-md backdrop-blur-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Skills badges if present */}
                  {message.metadata?.skills && message.metadata.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/10">
                      {message.metadata.skills.slice(0, 5).map((skill, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Faith encouragement */}
                  {message.metadata?.faithEncouragement && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-start gap-2">
                      <Heart className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/50 italic">{message.metadata.faithEncouragement}</p>
                    </div>
                  )}
                </div>
                <p className={`text-[11px] text-white/30 mt-2 ${message.role === 'user' ? 'text-right' : ''}`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="mb-6 flex gap-4 animate-in fade-in duration-200">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold">W</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md backdrop-blur-sm">
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested prompts and Quick Actions */}
      {messages.length <= 2 && (
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-4">
          {/* Career-focused suggestions */}
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/40">Try saying...</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              "I'm a senior product manager looking for my next challenge",
              "I want to transition into tech from finance",
              "Looking for remote engineering roles at startups",
              "Help me prepare for an interview at Google"
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleQuickAction(prompt)}
                className="px-4 py-2 text-sm text-white/70 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-white/20 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/40">Quick actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleQuickAction("Analyze my skills and tell me what roles I'd be great for")}
              className="flex items-center gap-2 px-4 py-2 text-sm text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full hover:bg-purple-500/20 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              Skill Analysis
            </button>
            <button
              onClick={() => handleQuickAction("Help me negotiate my salary for my next offer")}
              className="flex items-center gap-2 px-4 py-2 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full hover:bg-emerald-500/20 transition-all"
            >
              <Briefcase className="w-4 h-4" />
              Salary Negotiation
            </button>
            <button
              onClick={() => handleQuickAction("What's my career path look like over the next 5 years?")}
              className="flex items-center gap-2 px-4 py-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full hover:bg-amber-500/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Career Planning
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative border-t border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-3 items-end">
            {/* Voice input button */}
            <button
              onClick={() => setIsListening(!isListening)}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Tell me about your ideal role..."
                disabled={isLoading}
                rows={1}
                className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.07] transition-all resize-none disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                input.trim() && !isLoading
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:opacity-90 active:scale-95'
                  : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Faith-based footer */}
          <div className="text-center mt-3">
            <p className="text-xs text-white/30 flex items-center justify-center gap-1.5">
              <Heart className="w-3 h-3 text-pink-400/50" />
              <span className="italic">{currentAffirmation.text}</span>
              <span className="text-white/20">- {currentAffirmation.verse}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-in-from-bottom-2 {
          from { transform: translateY(8px); }
          to { transform: translateY(0); }
        }
        .animate-in {
          animation: fade-in 0.3s ease-out, slide-in-from-bottom-2 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
