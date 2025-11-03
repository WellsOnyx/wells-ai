/**
 * Chat Message Renderer - Renders any message type inline
 * The magic that makes everything work from chat
 */

'use client'

import { ChatMessage } from '@/types/chat'
import EmailComposerCard from './cards/EmailComposerCard'
import ConsentApprovalCard from './cards/ConsentApprovalCard'
import PartnerDashboardCard from './cards/PartnerDashboardCard'
import RFQFormCard from './cards/RFQFormCard'
import SupplierMatchCard from './cards/SupplierMatchCard'
import OnePagerGeneratorCard from './cards/OnePagerGeneratorCard'

interface ChatMessageRendererProps {
  message: ChatMessage
}

export default function ChatMessageRenderer({ message }: ChatMessageRendererProps) {
  // Text message
  if (message.type === 'text') {
    // Parse URLs and make them clickable (mobile-friendly)
    const renderContentWithLinks = (text: string) => {
      // Match URLs (wellsai.vercel.app, https://, http://, etc.)
      const urlRegex = /(https?:\/\/[^\s]+|wellsai\.vercel\.app[^\s]*|[a-zA-Z0-9-]+\.vercel\.app[^\s]*)/g
      const parts = text.split(urlRegex)
      const matches = text.match(urlRegex)

      return parts.map((part, i) => {
        if (matches && matches.includes(part)) {
          // This is a URL - make it a big tappable link
          const fullUrl = part.startsWith('http') ? part : `https://${part}`
          return (
            <a
              key={i}
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block my-2 px-4 py-3 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
              style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {part}
            </a>
          )
        }
        // Regular text with preserved whitespace
        return <span key={i} className="whitespace-pre-wrap">{part}</span>
      })
    }

    return (
      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 ${
            message.role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-900 border border-gray-200'
          }`}
        >
          <div>{renderContentWithLinks(message.content)}</div>
          <p className="text-xs opacity-60 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
    )
  }

  // Component messages - always from assistant
  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-full w-full">
        {/* Assistant label */}
        <div className="text-sm text-gray-500 mb-2">Wells AI</div>

        {/* Render the appropriate component card */}
        {message.type === 'email_composer' && (
          <EmailComposerCard data={message.data} />
        )}

        {message.type === 'consent_approval' && (
          <ConsentApprovalCard data={message.data} />
        )}

        {message.type === 'partner_dashboard' && (
          <PartnerDashboardCard data={message.data} />
        )}

        {message.type === 'rfq_form' && (
          <RFQFormCard data={message.data} />
        )}

        {message.type === 'supplier_match' && (
          <SupplierMatchCard data={message.data} />
        )}

        {message.type === 'onepager_generator' && (
          <OnePagerGeneratorCard data={message.data} />
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-400 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
