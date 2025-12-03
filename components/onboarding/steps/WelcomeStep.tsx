'use client'

import { useState, useEffect } from 'react'

interface WelcomeStepProps {
  onContinue: () => void
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  const [showContent, setShowContent] = useState(false)
  const [showButton, setShowButton] = useState(false)

  useEffect(() => {
    // Staggered animation
    setTimeout(() => setShowContent(true), 300)
    setTimeout(() => setShowButton(true), 1000)
  }, [])

  return (
    <div className="text-center space-y-8 py-12">
      {/* Animated Logo */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
            <span className="text-4xl font-bold text-white">W</span>
          </div>
          {/* Glow effect */}
          <div className="absolute inset-0 w-24 h-24 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
        </div>
      </div>

      {/* Welcome Text */}
      <div className={`space-y-4 transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
          <span className="text-amber-500 text-sm font-medium">AI That Actually Does Things</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white">
          Hi. I'm Wells.
        </h1>

        <p className="text-xl text-gray-400 max-w-lg mx-auto">
          I help people get things done. Tell me what you need, and I'll make it happen.
        </p>
      </div>

      {/* Features Preview */}
      <div className={`grid md:grid-cols-3 gap-4 max-w-2xl mx-auto transition-all duration-700 delay-300 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="font-semibold text-white">AI-to-AI Negotiation</h3>
          <p className="text-sm text-gray-400">Your AI negotiates with their AI</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="text-2xl mb-2">✅</div>
          <h3 className="font-semibold text-white">Human Approval</h3>
          <p className="text-sm text-gray-400">You approve, we execute</p>
        </div>
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
          <div className="text-2xl mb-2">💰</div>
          <h3 className="font-semibold text-white">1% Success Fee</h3>
          <p className="text-sm text-gray-400">Only pay when deals close</p>
        </div>
      </div>

      {/* CTA Button */}
      <div className={`transition-all duration-500 ${showButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={onContinue}
          className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-semibold text-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25"
        >
          <span className="relative z-10">Let's Get Started</span>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

        <p className="text-sm text-gray-500 mt-4">Takes less than 2 minutes</p>
      </div>
    </div>
  )
}
