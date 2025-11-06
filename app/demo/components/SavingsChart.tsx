'use client'

import { motion } from 'framer-motion'

interface SavingsChartProps {
  timeSaved: string
  costSaved: string
  efficiencyGain: string
}

export default function SavingsChart({ timeSaved, costSaved, efficiencyGain }: SavingsChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-[#daa520]/30 p-6 my-4"
    >
      <h4 className="text-[#daa520] font-semibold mb-6 text-center">Impact Summary</h4>

      <div className="grid grid-cols-3 gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#daa520]/10 border-2 border-[#daa520]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#daa520] mb-1">{timeSaved}</div>
          <div className="text-xs text-[#f5f5f0]/50">Time Saved</div>
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#daa520]/10 border-2 border-[#daa520]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#daa520] mb-1">{costSaved}</div>
          <div className="text-xs text-[#f5f5f0]/50">Cost Saved</div>
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: 'spring' }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#daa520]/10 border-2 border-[#daa520]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#daa520]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-[#daa520] mb-1">{efficiencyGain}</div>
          <div className="text-xs text-[#f5f5f0]/50">Efficiency</div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6 pt-4 border-t border-[#daa520]/10 text-center"
      >
        <p className="text-sm text-[#f5f5f0]/70 leading-relaxed">
          Traditional procurement takes weeks. Wells does it in seconds.
        </p>
      </motion.div>
    </motion.div>
  )
}
