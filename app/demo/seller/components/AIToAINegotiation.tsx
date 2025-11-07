import { motion } from 'framer-motion'

interface Message {
  from: 'seller_wells' | 'buyer_wells'
  to: 'seller_wells' | 'buyer_wells'
  message: string
}

interface AIToAINegotiationProps {
  status: string
  messages: Message[]
}

export default function AIToAINegotiation({ status, messages }: AIToAINegotiationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520]/30 rounded-lg p-5 max-w-lg"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#f5f5f0] font-semibold text-sm">AI-to-AI Negotiation</h4>
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-[#daa520]"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
          <span className="text-[#daa520] text-xs capitalize">{status}</span>
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: msg.from === 'seller_wells' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.2 }}
            className={`flex items-start gap-2 ${msg.from === 'buyer_wells' ? 'flex-row-reverse' : ''}`}
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex-shrink-0 flex items-center justify-center">
              <span className="text-[#0a0a0a] text-[10px] font-bold">W</span>
            </div>
            <div className={`flex-1 ${msg.from === 'buyer_wells' ? 'text-right' : ''}`}>
              <p className="text-[#f5f5f0]/60 text-[10px] mb-1">
                {msg.from === 'seller_wells' ? 'Your Wells' : "Buyer's Wells"}
              </p>
              <div className={`inline-block px-3 py-2 rounded-lg ${
                msg.from === 'seller_wells'
                  ? 'bg-[#daa520]/10 border border-[#daa520]/30'
                  : 'bg-[#f5f5f0]/5 border border-[#f5f5f0]/20'
              }`}>
                <p className="text-[#f5f5f0] text-xs leading-relaxed">{msg.message}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-[#f5f5f0]/10">
        <p className="text-[#f5f5f0]/40 text-[10px] text-center">
          Wells AIs coordinating directly - you never talk to the buyer
        </p>
      </div>
    </motion.div>
  )
}
