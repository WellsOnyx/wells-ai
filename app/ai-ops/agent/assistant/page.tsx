'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Copy,
  Trash2,
  Save,
  Mail,
  FileText,
  Search,
  CheckSquare,
  RefreshCw,
  Languages,
  ChevronDown,
  Zap,
  Clock,
  User
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  taskContext?: string
}

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  prompt: string
  category: 'draft' | 'research' | 'review' | 'format'
  description: string
}

interface TaskContext {
  taskId: string
  taskTitle: string
  clientName: string
  sopType: string
  relevantDocs?: string[]
}

export default function AIAssistantPage() {
  const { user, isLoaded } = useUser()
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_HISTORY)
  const [inputValue, setInputValue] = useState('')
  const [currentTask, setCurrentTask] = useState<TaskContext>(MOCK_TASK_CONTEXT)
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Check authentication
  if (isLoaded && (!user || !user.primaryEmailAddress?.emailAddress.endsWith('@wellsonyx.com'))) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-white/20">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-300">
              This AI Assistant is only available to Wells Onyx team members (@wellsonyx.com).
            </p>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
      taskContext: currentTask.taskId
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(inputValue),
        timestamp: new Date().toISOString(),
        taskContext: currentTask.taskId
      }
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.prompt)
    inputRef.current?.focus()
  }

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(messageId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleClearChat = () => {
    if (confirm('Clear all messages? This cannot be undone.')) {
      setMessages([])
    }
  }

  const handleSaveConversation = () => {
    const conversationText = messages
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n\n')

    const blob = new Blob([conversationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation-${currentTask.taskTitle}-${new Date().toISOString()}.txt`
    a.click()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Context Bar */}
      <div className="bg-black/40 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" />
                <h1 className="text-xl font-bold text-white">AI Assistant</h1>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                  <span className="text-sm text-purple-300">{currentTask.sopType}</span>
                </div>
                <div className="text-sm text-gray-300">
                  <span className="text-gray-500">Client:</span> {currentTask.clientName}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span>~2.5k tokens used</span>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all text-white text-sm">
                <span>{currentTask.taskTitle}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Chat Interface - Left 60% */}
          <div className="col-span-2 bg-black/40 backdrop-blur-lg rounded-2xl border border-white/10 flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                    {/* Message Header */}
                    <div className={`flex items-center gap-2 mb-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {message.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-xs text-gray-400">
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {message.role === 'user' && (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <User className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={`p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white'
                          : 'bg-white/5 text-gray-100 border border-white/10'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    </div>

                    {/* Copy Button (Assistant messages only) */}
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleCopyMessage(message.id, message.content)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-purple-400 transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedId === message.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[80%]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs text-gray-400">AI Assistant</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything... (Shift+Enter for new line)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all text-sm"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
                <button
                  onClick={handleSaveConversation}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all text-sm"
                >
                  <Save className="w-3 h-3" />
                  Save
                </button>
                <div className="flex-1" />
                <span className="text-xs text-gray-500">
                  Powered by Claude AI
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Panel - Right 40% */}
          <div className="bg-black/40 backdrop-blur-lg rounded-2xl border border-white/10 p-6 overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Quick Actions
            </h2>

            <div className="space-y-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action)}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-purple-500/50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                      {action.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-1">{action.label}</h3>
                      <p className="text-xs text-gray-400">{action.description}</p>
                      <div className="mt-2">
                        <span className="inline-block px-2 py-0.5 bg-purple-500/20 rounded text-xs text-purple-300">
                          {action.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Context Info */}
            <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Current Context</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Task:</span>
                  <span className="text-white ml-2">{currentTask.taskTitle}</span>
                </div>
                <div>
                  <span className="text-gray-400">Client:</span>
                  <span className="text-white ml-2">{currentTask.clientName}</span>
                </div>
                <div>
                  <span className="text-gray-400">SOP:</span>
                  <span className="text-white ml-2">{currentTask.sopType}</span>
                </div>
                {currentTask.relevantDocs && currentTask.relevantDocs.length > 0 && (
                  <div>
                    <span className="text-gray-400">Docs:</span>
                    <div className="mt-1 space-y-1">
                      {currentTask.relevantDocs.map((doc, idx) => (
                        <div key={idx} className="text-xs text-purple-300 ml-2">• {doc}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
              <h3 className="text-sm font-medium text-purple-300 mb-2">💡 Pro Tips</h3>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>• Be specific about what you need</li>
                <li>• Reference task context for better results</li>
                <li>• Use quick actions for common tasks</li>
                <li>• Save important conversations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mock Data
const MOCK_TASK_CONTEXT: TaskContext = {
  taskId: 'TASK-001',
  taskTitle: 'CEO Daily Brief - Q4 Planning',
  clientName: 'TechCorp Inc.',
  sopType: 'Chief of Staff',
  relevantDocs: ['Q3_Performance.pdf', 'Board_Meeting_Notes.docx', 'Strategic_Plan_2024.pdf']
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'draft-email',
    label: 'Draft Email',
    icon: <Mail className="w-4 h-4 text-purple-400" />,
    prompt: 'Compose a professional email about [topic] for [recipient]. Include [key points].',
    category: 'draft',
    description: 'Generate professional emails with proper formatting and tone'
  },
  {
    id: 'summarize',
    label: 'Summarize Document',
    icon: <FileText className="w-4 h-4 text-purple-400" />,
    prompt: 'Summarize the following document in 3-5 key bullet points, focusing on actionable insights:\n\n[paste document]',
    category: 'review',
    description: 'Extract key points and actionable insights from documents'
  },
  {
    id: 'research',
    label: 'Research Topic',
    icon: <Search className="w-4 h-4 text-purple-400" />,
    prompt: 'Research [topic] and provide a comprehensive overview including current trends, key players, and strategic implications.',
    category: 'research',
    description: 'Get detailed research on topics with reliable sources'
  },
  {
    id: 'checklist',
    label: 'Create Checklist',
    icon: <CheckSquare className="w-4 h-4 text-purple-400" />,
    prompt: 'Create a detailed step-by-step checklist for [task/process], including timelines and dependencies.',
    category: 'format',
    description: 'Generate organized checklists for complex tasks'
  },
  {
    id: 'review',
    label: 'Review & Improve',
    icon: <RefreshCw className="w-4 h-4 text-purple-400" />,
    prompt: 'Review the following draft and suggest improvements for clarity, tone, and impact:\n\n[paste draft]',
    category: 'review',
    description: 'Get feedback and suggestions to improve your content'
  },
  {
    id: 'translate',
    label: 'Professional Tone',
    icon: <Languages className="w-4 h-4 text-purple-400" />,
    prompt: 'Rewrite the following in a professional business tone suitable for executive communication:\n\n[paste text]',
    category: 'format',
    description: 'Convert casual text to professional business language'
  }
]

const MOCK_CHAT_HISTORY: ChatMessage[] = [
  {
    id: '1',
    role: 'system',
    content: 'Welcome! I\'m your AI assistant for Wells Onyx operations. I have context about your current task and can help with drafting, research, analysis, and more. How can I help you today?',
    timestamp: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '2',
    role: 'user',
    content: 'Help me draft a daily brief for the CEO covering Q4 planning priorities',
    timestamp: new Date(Date.now() - 3550000).toISOString(),
    taskContext: 'TASK-001'
  },
  {
    id: '3',
    role: 'assistant',
    content: `I'll help you create a structured CEO daily brief for Q4 planning. Here's a draft:

**DAILY BRIEF - CEO**
Date: ${new Date().toLocaleDateString()}
Re: Q4 Planning Priorities

**PRIORITY ITEMS:**

1. **Strategic Initiatives Review**
   - Q3 performance exceeded targets by 12%
   - Board meeting scheduled for next week - need final slides
   - Strategic plan 2024 requires sign-off on budget allocation

2. **KEY DECISIONS NEEDED:**
   - Approve $2.5M investment in new product line
   - Review organizational restructure proposal from HR
   - Sign off on Q4 marketing campaign budget

3. **UPDATES & ALERTS:**
   - TechCorp partnership negotiation in final stages
   - Competitor launched similar product - need response strategy
   - Two senior positions still open - talent pipeline review needed

4. **UPCOMING COMMITMENTS:**
   - Board meeting (Thursday 2pm)
   - All-hands Q4 kickoff (Friday 10am)
   - Investor call (Monday next week)

**RECOMMENDED ACTIONS:**
- Block 2 hours tomorrow for strategic plan review
- Schedule 30-min sync with CFO on budget
- Review and approve hiring recommendations by EOD

Would you like me to adjust the tone, add more detail to any section, or focus on specific priorities?`,
    timestamp: new Date(Date.now() - 3540000).toISOString(),
    taskContext: 'TASK-001'
  },
  {
    id: '4',
    role: 'user',
    content: 'That\'s great! Can you make it more concise? CEO prefers bullets over paragraphs.',
    timestamp: new Date(Date.now() - 3520000).toISOString(),
    taskContext: 'TASK-001'
  },
  {
    id: '5',
    role: 'assistant',
    content: `**CEO DAILY BRIEF** | ${new Date().toLocaleDateString()}

**🎯 TOP PRIORITIES**
• Q3 exceeded targets by 12% - momentum strong
• Board deck due Monday - final slides needed
• $2.5M product investment awaiting approval

**⚡ DECISIONS NEEDED TODAY**
• Product line investment approval
• Org restructure proposal (HR)
• Q4 marketing budget sign-off

**📊 KEY UPDATES**
• TechCorp deal - final negotiations
• Competitor product launch - response needed
• 2 senior roles open - pipeline review overdue

**📅 THIS WEEK**
• Thu 2pm - Board meeting
• Fri 10am - Q4 All-hands
• Mon (next week) - Investor call

**✅ ACTION ITEMS**
• 2hr block for strategic plan review
• 30min CFO sync on budget
• Approve hiring recs by EOD

Much more scannable for busy executives!`,
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    taskContext: 'TASK-001'
  },
  {
    id: '6',
    role: 'user',
    content: 'Perfect! Now I need help with a different task. Can you review this contract excerpt for potential red flags?\n\n"Party A agrees to indemnify Party B for all claims, including those arising from Party B\'s negligence. The term shall auto-renew annually unless terminated with 180 days notice. All disputes shall be resolved through binding arbitration in Party B\'s jurisdiction."',
    timestamp: new Date(Date.now() - 3400000).toISOString()
  },
  {
    id: '7',
    role: 'assistant',
    content: `🚩 **CONTRACT ANALYSIS - RED FLAGS IDENTIFIED**

**CRITICAL ISSUES:**

1. **One-Sided Indemnification (HIGH RISK)**
   - You indemnify them even for THEIR negligence
   - This is extremely unfavorable and unusual
   - **Recommendation:** Mutual indemnification or limit to your own negligence only

2. **Auto-Renewal Terms (MEDIUM RISK)**
   - 180 days (6 months) notice is unusually long
   - Easy to miss deadline and get locked in another year
   - **Recommendation:** Reduce to 60-90 days or remove auto-renewal

3. **Jurisdiction Clause (MEDIUM RISK)**
   - Arbitration in their jurisdiction gives them home advantage
   - May be costly/inconvenient for you
   - **Recommendation:** Neutral jurisdiction or mutual agreement

**SUGGESTED LANGUAGE CHANGES:**

*Indemnification:*
"Each party agrees to indemnify the other for claims arising from their own negligence or willful misconduct."

*Term:*
"Either party may terminate with 60 days written notice."

*Disputes:*
"Disputes shall be resolved through arbitration in a mutually agreed jurisdiction."

**NEXT STEPS:**
- Flag these with legal counsel
- Propose specific redlines
- Consider if these terms are dealbreakers

Would you like me to draft the redline language or review any other sections?`,
    timestamp: new Date(Date.now() - 3380000).toISOString()
  },
  {
    id: '8',
    role: 'user',
    content: 'Excellent analysis! One more thing - I\'m reviewing server logs and seeing intermittent 502 errors. What should I check first?',
    timestamp: new Date(Date.now() - 3200000).toISOString()
  },
  {
    id: '9',
    role: 'assistant',
    content: `**502 BAD GATEWAY - TROUBLESHOOTING CHECKLIST**

**IMMEDIATE CHECKS (Do these first):**

✅ **1. Upstream Server Status**
\`\`\`bash
# Check if backend servers are responding
curl -I https://your-backend-server/health
systemctl status your-service-name
\`\`\`

✅ **2. Load Balancer Health**
- Check connection pool settings
- Verify timeout configurations
- Look for connection refused errors

✅ **3. Resource Exhaustion**
\`\`\`bash
# Check server resources
top -n 1
df -h  # Disk space
netstat -an | grep ESTABLISHED | wc -l  # Connection count
\`\`\`

**COMMON CAUSES (Intermittent 502s):**

🔍 **Memory Issues**
- Backend running out of memory
- Check for memory leaks in application

🔍 **Timeout Mismatches**
- Backend takes longer than gateway timeout
- Review: gateway_timeout < upstream_timeout

🔍 **Connection Pool Exhaustion**
- Too many concurrent requests
- Database connection pool maxed out

**LOG ANALYSIS:**
\`\`\`bash
# Check for patterns
grep "502" /var/log/nginx/error.log | tail -50
journalctl -u your-service --since "1 hour ago" | grep -i error
\`\`\`

**QUICK FIXES TO TEST:**
1. Restart backend service (if low traffic window)
2. Increase timeout values temporarily
3. Scale up backend instances

**MONITORING SETUP:**
- Set up alerts on 502 rate > 5%
- Monitor backend response times
- Track connection pool usage

What does your error log show? I can help analyze specific error messages.`,
    timestamp: new Date(Date.now() - 3180000).toISOString()
  },
  {
    id: '10',
    role: 'user',
    content: 'The logs show "upstream timed out (110: Connection timed out)". It happens every few hours.',
    timestamp: new Date(Date.now() - 3100000).toISOString()
  },
  {
    id: '11',
    role: 'assistant',
    content: `**DIAGNOSIS: Upstream Timeout Issue**

This is a classic backend performance problem. The gateway is timing out waiting for your backend server.

**ROOT CAUSE (Most Likely):**
Your backend is occasionally taking too long to respond, possibly due to:
- Slow database queries
- Resource spikes during certain operations
- Background jobs blocking request handling

**IMMEDIATE FIX:**

1. **Increase Nginx Timeout (Temporary)**
\`\`\`nginx
# In your nginx.conf
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
\`\`\`

2. **Enable Backend Logging**
\`\`\`javascript
// Log slow requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) {
      console.warn(\`SLOW REQUEST: \${req.path} took \${duration}ms\`);
    }
  });
  next();
});
\`\`\`

**LONG-TERM SOLUTIONS:**

📊 **Identify Slow Operations**
- Add APM monitoring (New Relic, DataDog)
- Profile slow database queries
- Check for N+1 query problems

⚡ **Optimize Performance**
- Add database indexes
- Implement caching (Redis)
- Move heavy operations to background jobs

🔄 **Architecture Improvements**
- Add request queuing
- Implement circuit breakers
- Scale backend horizontally

**MONITORING QUERY:**
\`\`\`sql
-- Find slow queries (if PostgreSQL)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
\`\`\`

**Action Plan:**
1. Bump timeouts now (5 min)
2. Add slow request logging (10 min)
3. Review logs over 24hrs to find pattern
4. Optimize identified bottlenecks

Want me to help set up APM monitoring or review your database queries?`,
    timestamp: new Date(Date.now() - 3080000).toISOString()
  },
  {
    id: '12',
    role: 'user',
    content: 'This is super helpful! Can you create a checklist for deploying the timeout fix to production?',
    timestamp: new Date(Date.now() - 2900000).toISOString()
  },
  {
    id: '13',
    role: 'assistant',
    content: `**PRODUCTION DEPLOYMENT CHECKLIST**
*Nginx Timeout Configuration Update*

**PRE-DEPLOYMENT** ⏰ Est. 15 min

□ **Code Review**
  □ Configuration changes peer-reviewed
  □ Timeout values validated (not too high/low)
  □ Syntax checked locally: \`nginx -t\`

□ **Backup Current Config**
  \`\`\`bash
  sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup-$(date +%Y%m%d-%H%M%S)
  \`\`\`

□ **Communication**
  □ Notify team in #engineering Slack
  □ Create incident ticket for tracking
  □ Set status page to "maintenance" (if needed)

**DEPLOYMENT** ⏰ Est. 10 min

□ **Staging Environment**
  □ Deploy to staging first
  □ Test with slow endpoint (\`sleep 30\`)
  □ Verify no 502 errors
  □ Check nginx error logs

□ **Production Deployment**
  □ SSH to production server(s)
  □ Apply configuration changes
  □ Validate syntax: \`sudo nginx -t\`
  □ Reload (NOT restart): \`sudo nginx -s reload\`
  □ Monitor for errors: \`tail -f /var/log/nginx/error.log\`

**POST-DEPLOYMENT** ⏰ Est. 20 min

□ **Immediate Verification** (First 5 min)
  □ Check service status: \`systemctl status nginx\`
  □ Test health endpoint
  □ Monitor error rates in dashboard
  □ Verify no spike in 502s

□ **Extended Monitoring** (Next 2 hours)
  □ Watch error logs for anomalies
  □ Monitor response time metrics
  □ Track 502 error rate (should drop)
  □ Set up alert if 502 rate > threshold

□ **Documentation**
  □ Update incident ticket with results
  □ Document change in runbook
  □ Update team in Slack
  □ Schedule follow-up to review slow requests

**ROLLBACK PLAN** (If issues occur)
\`\`\`bash
# Restore backup config
sudo cp /etc/nginx/nginx.conf.backup-TIMESTAMP /etc/nginx/nginx.conf
sudo nginx -t
sudo nginx -s reload
\`\`\`

**SUCCESS CRITERIA:**
✓ No increase in error rates
✓ 502 errors reduced significantly
✓ Average response time stable
✓ No customer complaints

**NOTES:**
- Deploy during low-traffic window if possible
- Keep terminal session open for quick rollback
- Have backup contact available

Ready to deploy? Let me know if you need help with any step!`,
    timestamp: new Date(Date.now() - 2880000).toISOString()
  },
  {
    id: '14',
    role: 'user',
    content: 'Amazing! One last request - can you help me write a client update email about a project delay?',
    timestamp: new Date(Date.now() - 2700000).toISOString()
  },
  {
    id: '15',
    role: 'assistant',
    content: `I'd be happy to help draft that client update. To make it most effective, I need a few details:

1. **What's the project?** (e.g., website redesign, integration, feature development)
2. **Original deadline vs new deadline?** (e.g., was March 15, now March 29)
3. **Reason for delay?** (Be honest but professional - technical complexity, scope change, dependency, etc.)
4. **What have you done to mitigate?** (Added resources, adjusted timeline, etc.)
5. **Client relationship?** (New client vs long-term partner - affects tone)

**General Template (customize with your details):**

---

**Subject:** [Project Name] Timeline Update

Hi [Client Name],

I wanted to reach out with an important update on [project name].

**Current Status:**
We've made significant progress on [specific achievements], and the team has been working diligently to deliver quality results. However, [brief, honest reason for delay - e.g., "we encountered unexpected technical complexity in the integration layer" or "the expanded scope we agreed to last week requires additional development time"].

**Revised Timeline:**
- Original target: [date]
- Updated target: [date]
- This gives us [X days/weeks] to ensure we deliver to our quality standards

**What We're Doing:**
- [Specific mitigation step 1]
- [Specific mitigation step 2]
- [Regular status updates - frequency]

**Next Steps:**
I'll keep you updated with [frequency] progress reports. Our next milestone is [specific deliverable] by [date].

I appreciate your understanding and partnership. Please let me know if you have any questions or concerns.

Best regards,
[Your name]

---

Give me those 5 details and I'll customize this for your specific situation!`,
    timestamp: new Date(Date.now() - 2680000).toISOString()
  }
]

function generateMockResponse(userInput: string): string {
  const responses = [
    "I'd be happy to help with that. Let me provide a detailed response based on the task context and best practices...",
    "Great question! Here's what I recommend based on industry standards and Wells Onyx SOPs...",
    "I can definitely assist with that. Let me break this down into actionable steps...",
    "Based on the current task context and similar situations, here's my analysis..."
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}
