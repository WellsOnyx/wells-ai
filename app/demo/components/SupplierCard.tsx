'use client'

import { motion } from 'framer-motion'

interface Supplier {
  name: string
  location: string
  price: string
  moq: string
  leadTime: string
  rating: number
  verified: boolean
  totalCost: string
}

interface SupplierCardProps {
  suppliers: Supplier[]
}

export default function SupplierCard({ suppliers }: SupplierCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 gap-3 my-4"
    >
      {suppliers.map((supplier, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.15, duration: 0.4 }}
          className="bg-[#1a1a1a] border border-[#daa520]/20 p-4 hover:border-[#daa520]/40 transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-[#f5f5f0] font-medium">{supplier.name}</h4>
                {supplier.verified && (
                  <svg className="w-4 h-4 text-[#daa520]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-[#f5f5f0]/50">{supplier.location}</p>
            </div>
            <div className="text-right">
              <div className="text-[#daa520] font-semibold text-lg">{supplier.price}</div>
              <div className="text-xs text-[#f5f5f0]/50">per unit</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-[#daa520]/10">
            <div>
              <div className="text-xs text-[#f5f5f0]/40 mb-0.5">MOQ</div>
              <div className="text-sm text-[#f5f5f0]">{supplier.moq}</div>
            </div>
            <div>
              <div className="text-xs text-[#f5f5f0]/40 mb-0.5">Lead Time</div>
              <div className="text-sm text-[#f5f5f0]">{supplier.leadTime}</div>
            </div>
            <div>
              <div className="text-xs text-[#f5f5f0]/40 mb-0.5">Rating</div>
              <div className="text-sm text-[#daa520] flex items-center gap-1">
                ★ {supplier.rating}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#daa520]/10">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#f5f5f0]/50">Total Cost (10K units)</span>
              <span className="text-[#f5f5f0] font-semibold">{supplier.totalCost}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
