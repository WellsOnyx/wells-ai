import { motion } from 'framer-motion'

interface DealSummaryProps {
  dealId: string
  price: number
  quantity: number
  timeline: string
  profit: number
  margin: number
  paymentTerms: string
  escrow: string
  nextSteps: string[]
}

export default function DealSummary({
  dealId,
  price,
  quantity,
  timeline,
  profit,
  margin,
  paymentTerms,
  escrow,
  nextSteps
}: DealSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520] rounded-lg p-6 max-w-lg"
    >
      {/* Success Icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
          <svg className="w-6 h-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-[#daa520] font-bold text-lg">Deal Closed!</h3>
          <p className="text-[#f5f5f0]/60 text-xs">{dealId}</p>
        </div>
      </div>

      {/* Deal Highlights */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#f5f5f0]/5 rounded-lg p-3">
          <p className="text-[#f5f5f0]/40 text-[10px]">Total Value</p>
          <p className="text-[#daa520] font-bold text-xl">${(price / 1000).toFixed(0)}K</p>
        </div>
        <div className="bg-[#f5f5f0]/5 rounded-lg p-3">
          <p className="text-[#f5f5f0]/40 text-[10px]">Your Profit</p>
          <p className="text-[#daa520] font-bold text-xl">${(profit / 1000).toFixed(1)}K</p>
        </div>
        <div className="bg-[#f5f5f0]/5 rounded-lg p-3">
          <p className="text-[#f5f5f0]/40 text-[10px]">Timeline</p>
          <p className="text-[#f5f5f0] font-medium">{timeline}</p>
        </div>
        <div className="bg-[#f5f5f0]/5 rounded-lg p-3">
          <p className="text-[#f5f5f0]/40 text-[10px]">Margin</p>
          <p className="text-[#f5f5f0] font-medium">{margin}%</p>
        </div>
      </div>

      {/* Payment & Escrow */}
      <div className="space-y-3 mb-4">
        <div className="bg-[#f5f5f0]/5 rounded-lg p-3">
          <p className="text-[#f5f5f0]/60 text-xs mb-1">Payment Terms</p>
          <p className="text-[#f5f5f0] text-sm">{paymentTerms}</p>
        </div>
        <div className="bg-[#daa520]/10 border border-[#daa520]/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-[#daa520]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <p className="text-[#daa520] text-xs font-semibold">Secured in GRAIN Escrow</p>
          </div>
          <p className="text-[#f5f5f0]/60 text-[10px]">{escrow}</p>
        </div>
      </div>

      {/* Next Steps */}
      <div className="pt-4 border-t border-[#f5f5f0]/10">
        <p className="text-[#f5f5f0]/60 text-xs mb-2">Next Steps:</p>
        <div className="space-y-2">
          {nextSteps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-[#daa520]/20 border border-[#daa520]/40 flex-shrink-0 flex items-center justify-center mt-0.5">
                <span className="text-[#daa520] text-[10px] font-bold">{idx + 1}</span>
              </div>
              <p className="text-[#f5f5f0] text-xs">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
