'use client'

import { useEffect, useState } from 'react'
import { GrainFrame, greetingWord } from './GrainFrame'

export default function GrainHome() {
  const [hello, setHello] = useState('Hello')

  useEffect(() => {
    setHello(greetingWord())
  }, [])

  return (
    <GrainFrame
      eyebrow="Grain & Vault"
      title={`${hello}.`}
      sub="Protected treasury. Your agent introduces people. You decide what happens next."
      chip={{ href: '/join?journey=treasury', label: 'Open Your Vault' }}
    />
  )
}
