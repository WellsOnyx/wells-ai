'use client'

import { motion } from 'framer-motion'

interface PaymentFlowProps {
  amount: string
  fee: string
  netAmount: string
  settlement: string
  treasuryYield: string
}

export default function PaymentFlow({ amount, fee, netAmount, settlement, treasuryYield }: PaymentFlowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520]/30 p-5 my-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h4 className="text-[#f5f5f0] font-medium">Payment Flow</h4>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <span className="text-[#f5f5f0]/60">Transaction Amount</span>
          <span className="text-[#f5f5f0] font-semibold text-lg">{amount}</span>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[#daa520]/10">
          <span className="text-[#f5f5f0]/60">Platform Fee</span>
          <span className="text-[#daa520] text-sm">{fee}</span>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-[#daa520]/20 bg-[#daa520]/5">
          <span className="text-[#f5f5f0] font-medium">Net to Supplier</span>
          <span className="text-[#daa520] font-bold text-xl">{netAmount}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#daa520]/10 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#f5f5f0]/50">Settlement</span>
          <span className="text-[#daa520]">{settlement}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#f5f5f0]/50">Treasury Yield</span>
          <span className="text-[#daa520]">{treasuryYield}</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 p-3 bg-[#daa520]/10 border border-[#daa520]/20"
      >
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-[#daa520] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-[#f5f5f0]/70 leading-relaxed">
            Funds settle instantly via Grain Vault treasury. Your working capital earns yield while in transit.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
