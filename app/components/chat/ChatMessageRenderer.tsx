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
import EmailAuthCard from './cards/EmailAuthCard'

interface ChatMessageRendererProps {
  message: ChatMessage
}

export default function ChatMessageRenderer({ message }: ChatMessageRendererProps) {
  // Text message - pure conversation, no links/buttons/forms
  if (message.type === 'text') {
    return (
      <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
        <div
          className={`max-w-[80%] rounded-lg px-4 py-2 ${
            message.role === 'user'
              ? 'bg-wells-blue text-white'
              : 'bg-wells-neutral-100 text-wells-neutral-900 border border-wells-neutral-200'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
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

        {message.type === 'email_auth' && (
          <EmailAuthCard data={message.data} />
        )}

        {/* Timestamp */}
        <div className="text-xs text-gray-400 mt-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
