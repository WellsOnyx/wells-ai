import { motion } from 'framer-motion'

interface RFQDetailsProps {
  item: string
  quantity: number
  industry: string
  budget: string
  timeline: string
  requirements: string[]
  buyerCompany: string
  buyerType: string
}

export default function RFQDetails({
  item,
  quantity,
  industry,
  budget,
  timeline,
  requirements,
  buyerCompany,
  buyerType
}: RFQDetailsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520]/30 rounded-lg p-6 max-w-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-[#f5f5f0] font-semibold">New RFQ</h3>
            <p className="text-[#daa520] text-sm">{buyerCompany}</p>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#daa520]/20 border border-[#daa520]/40">
          <span className="text-[#daa520] text-xs font-medium">High Match</span>
        </div>
      </div>

      {/* Main Details */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center py-2 border-b border-[#f5f5f0]/10">
          <span className="text-[#f5f5f0]/60 text-sm">Item</span>
          <span className="text-[#f5f5f0] font-medium">{item}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[#f5f5f0]/10">
          <span className="text-[#f5f5f0]/60 text-sm">Quantity</span>
          <span className="text-[#f5f5f0] font-medium">{quantity.toLocaleString()} units</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[#f5f5f0]/10">
          <span className="text-[#f5f5f0]/60 text-sm">Industry</span>
          <span className="text-[#f5f5f0] font-medium">{industry}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[#f5f5f0]/10">
          <span className="text-[#f5f5f0]/60 text-sm">Budget</span>
          <span className="text-[#daa520] font-semibold">{budget}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-[#f5f5f0]/10">
          <span className="text-[#f5f5f0]/60 text-sm">Timeline</span>
          <span className="text-[#f5f5f0] font-medium">{timeline}</span>
        </div>
      </div>

      {/* Requirements */}
      <div className="mb-4">
        <h4 className="text-[#f5f5f0]/60 text-sm mb-2">Requirements</h4>
        <div className="flex flex-wrap gap-2">
          {requirements.map((req, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-full bg-[#f5f5f0]/5 border border-[#f5f5f0]/20 text-[#f5f5f0] text-xs"
            >
              {req}
            </span>
          ))}
        </div>
      </div>

      {/* Buyer Info */}
      <div className="pt-4 border-t border-[#f5f5f0]/10">
        <p className="text-[#f5f5f0]/60 text-xs">
          Buyer: <span className="text-[#f5f5f0]">{buyerCompany}</span> • {buyerType}
        </p>
      </div>
    </motion.div>
  )
}
