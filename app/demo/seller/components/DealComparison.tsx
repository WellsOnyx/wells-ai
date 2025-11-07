import { motion } from 'framer-motion'

interface DealComparisonProps {
  original: {
    price: number
    timeline: string
    margin: string
  }
  proposed: {
    price: number
    timeline: string
    margin: string
    extras: string[]
  }
}

export default function DealComparison({ original, proposed }: DealComparisonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520]/30 rounded-lg p-5 max-w-lg"
    >
      <h4 className="text-[#f5f5f0] font-semibold mb-4">Proposed Compromise</h4>

      <div className="grid grid-cols-2 gap-4">
        {/* Original Offer */}
        <div className="bg-[#f5f5f0]/5 border border-[#f5f5f0]/10 rounded-lg p-4">
          <p className="text-[#f5f5f0]/60 text-xs mb-3">Your Original Offer</p>
          <div className="space-y-2">
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Price</p>
              <p className="text-[#f5f5f0] font-semibold">${(original.price / 1000).toFixed(0)}K</p>
            </div>
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Timeline</p>
              <p className="text-[#f5f5f0] text-sm">{original.timeline}</p>
            </div>
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Margin</p>
              <p className="text-[#f5f5f0] text-sm">{original.margin}</p>
            </div>
          </div>
        </div>

        {/* Proposed Deal */}
        <div className="bg-[#daa520]/10 border border-[#daa520]/30 rounded-lg p-4">
          <p className="text-[#daa520] text-xs mb-3">Proposed Deal</p>
          <div className="space-y-2">
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Price</p>
              <p className="text-[#daa520] font-bold">${(proposed.price / 1000).toFixed(0)}K</p>
            </div>
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Timeline</p>
              <p className="text-[#daa520] text-sm font-semibold">{proposed.timeline}</p>
            </div>
            <div>
              <p className="text-[#f5f5f0]/40 text-[10px]">Margin</p>
              <p className="text-[#f5f5f0] text-sm">{proposed.margin}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Added Value */}
      <div className="mt-4 pt-4 border-t border-[#f5f5f0]/10">
        <p className="text-[#f5f5f0]/60 text-xs mb-2">Added Value:</p>
        <div className="flex flex-wrap gap-2">
          {proposed.extras.map((extra, idx) => (
            <span
              key={idx}
              className="px-2 py-1 rounded-full bg-[#daa520]/20 border border-[#daa520]/40 text-[#daa520] text-[10px]"
            >
              + {extra}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
