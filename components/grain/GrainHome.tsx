'use client'

import { useEffect, useState } from 'react'
import { GrainFrame, greetingWord } from './GrainFrame'
import { GrainStory } from './GrainStory'

export default function GrainHome() {
  const [hello, setHello] = useState('Hello')

  useEffect(() => {
    setHello(greetingWord())
  }, [])

  return (
    <GrainFrame
      lead={<GrainStory />}
      skipTo="#welcome"
      eyebrow="Grain & Vault"
      title={`${hello}.`}
      sub="Protected treasury. Your agent introduces people. You decide what happens next."
      chip={{ href: '/join?journey=treasury', label: 'Open Your Vault' }}
    />
  )
}
