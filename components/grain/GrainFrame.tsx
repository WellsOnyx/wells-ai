'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import '@/app/grain-calm.css'

export type GrainLink = { href: string; label: string }

export const GRAIN_MENU: GrainLink[] = [
  { href: '/agent', label: 'Your agent' },
  { href: '/grain/how-it-works', label: 'How It Works' },
  { href: '/grain/products', label: 'Products' },
  { href: '/grain-vault/treasury', label: 'Treasury' },
  { href: '/grain/sdk', label: 'Treasury SDK' },
  { href: '/grain/wells', label: 'WellsAI' },
  { href: '/grain-vault/blog', label: 'Blog' },
  { href: '/sign-in', label: 'Sign in' },
  { href: '/join?journey=treasury', label: 'Open Your Vault' },
]

export function greetingWord(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}

export function GrainMark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="gc-brand">
      <b>Grain & Vault</b>
    </Link>
  )
}

export function GrainMenu({ links = GRAIN_MENU }: { links?: GrainLink[] }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const close = () => setOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="gc-right" onClick={(event) => event.stopPropagation()}>
      <button
        className="gc-menu-btn"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
      </button>
      <nav className={`gc-pop${open ? ' gc-open' : ''}`} aria-label="Elsewhere">
        {links.map((link) => (
          <Link key={link.href + link.label} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function Orb({
  state = '',
  label,
  onClick,
}: {
  state?: '' | 'gc-think' | 'gc-done' | 'gc-blue'
  label?: string
  onClick?: () => void
}) {
  const className = `gc-orb-wrap${state ? ` ${state}` : ''}`
  return (
    <div className={className}>
      {onClick ? (
        <button className="gc-orb gc-orb-btn" aria-label={label} onClick={onClick} />
      ) : (
        <div className="gc-orb" aria-hidden="true" />
      )}
      <div className="gc-check" aria-hidden="true">
        <svg viewBox="0 0 54 54">
          <path d="M15 28l8 8 16-18" />
        </svg>
      </div>
    </div>
  )
}

export function GrainFrame({
  eyebrow,
  title,
  sub,
  chip,
  orb = '',
  corner,
  menu = true,
  wide,
  children,
}: {
  eyebrow?: string
  title: string
  sub?: string
  chip?: { href: string; label: string }
  orb?: '' | 'gc-think' | 'gc-done' | 'gc-blue'
  corner?: string
  menu?: boolean
  wide?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="gc">
      <header className="gc-top">
        <GrainMark />
        {menu ? <GrainMenu /> : <span />}
      </header>
      <main className="gc-main">
        <Orb state={orb} />
        {eyebrow ? <div className="gc-name">{eyebrow}</div> : null}
        <h1 className="gc-title">
          <span className="gc-fx">{title}</span>
        </h1>
        {sub ? <p className="gc-sub">{sub}</p> : null}
        <div className={`gc-stage${wide ? ' gc-wide' : ''}`}>
          {chip ? (
            <Link className="gc-chip" href={chip.href}>
              <i>✦</i> {chip.label}
            </Link>
          ) : null}
          {children}
        </div>
      </main>
      {corner ? <div className="gc-corner">{corner}</div> : null}
    </div>
  )
}
