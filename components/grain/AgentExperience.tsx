'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import '@/app/grain-calm.css'
import { greetingWord } from '@/components/grain/GrainFrame'
import {
  MemoryItem,
  Session,
  World,
  confirmSession,
  findFlour,
  publicDeal,
  remember,
  removeMemory,
  replyTo,
  seedWorld,
  updateMemory,
  visibleMemory,
} from '@/lib/grain-agent/engine'

const PEOPLE = {
  lena: { first: 'Lena', other: 'tomas' as const },
  tomas: { first: 'Tomas', other: 'lena' as const },
}

type ViewId = keyof typeof PEOPLE

function money(cents: number): string {
  const digits = cents % 100 ? 2 : 0
  return (
    '$' +
    (cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    })
  )
}

function day(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function wait(ms: number): Promise<void> {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return new Promise((resolve) => setTimeout(resolve, reduced ? Math.min(ms, 120) : ms))
}

function agentTitle(id: ViewId): string {
  return id === 'lena' ? "Lena's agent" : "The mill's agent"
}

function agentPhrase(id: ViewId): string {
  return id === 'lena' ? "Lena's agent" : "the mill's agent"
}

export default function AgentExperience() {
  const [world, setWorld] = useState<World>(() => seedWorld())
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<ViewId>('lena')
  const [phase, setPhase] = useState<'idle' | 'working' | 'deal'>('idle')
  const [workingLine, setWorkingLine] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sheet, setSheet] = useState<'chat' | 'memory' | null>(null)
  const [toast, setToast] = useState('')
  const [chat, setChat] = useState<{ from: 'me' | 'them'; text: string }[]>([])
  const [draft, setDraft] = useState('')
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [hello, setHello] = useState('Hello')

  useEffect(() => {
    setHello(greetingWord())
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSheet(null)
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const name = agentTitle(view)
  const phrase = agentPhrase(view)
  const other = PEOPLE[view].other
  const mine = session?.confirms[view]
  const theirs = session?.confirms[other]
  const needs = (id: ViewId) => session?.status === 'AWAITING_USER_CONFIRM' && !session.confirms[id]

  const scene = useMemo(() => {
    if (phase === 'working') {
      return {
        orb: 'gc-think',
        line: workingLine || 'Looking…',
        sub: '',
        mode: 'working' as const,
      }
    }
    if (!session || phase === 'idle') {
      if (view === 'lena') {
        return {
          orb: '',
          line: `${hello}, Lena.`,
          sub: 'Want me to find your flour?',
          mode: 'ask' as const,
        }
      }
      return {
        orb: 'gc-blue',
        line: `${hello}, Tomas.`,
        sub: 'All quiet. I’ll let you know when a good buyer turns up.',
        mode: 'quiet' as const,
      }
    }
    if (session.status === 'SETTLED') {
      return {
        orb: 'gc-done',
        line: view === 'lena' ? 'Done. Flour’s on its way.' : 'Done. Payment’s on its way.',
        sub: `${session.summary.qty} bags · ${money(session.summary.totalCents)} · arriving ${day(session.summary.windowFrom)}`,
        mode: 'settled' as const,
      }
    }
    if (session.status === 'DECLINED') {
      return {
        orb: view === 'tomas' ? 'gc-blue' : '',
        line: 'No problem.',
        sub: 'Nothing was signed or charged.',
        mode: 'declined' as const,
      }
    }
    if (mine === 'approve' && !theirs) {
      return {
        orb: 'gc-think',
        line: `Waiting on ${PEOPLE[other].first}…`,
        sub: 'You’re all set. I’ll finish the moment they say yes.',
        mode: 'waiting' as const,
      }
    }
    if (view === 'lena') {
      return {
        orb: '',
        line: 'I found you a good one.',
        sub: `Tomas Reed at Tomas Mill. I got him to ${money(session.summary.unitPriceCents)}.`,
        mode: 'deal' as const,
      }
    }
    return {
      orb: 'gc-blue',
      line: 'Lena wants your flour.',
      sub: 'A bakery nearby, 200 bags, a fair price. Your agents already sorted the details.',
      mode: 'deal' as const,
    }
  }, [phase, workingLine, session, view, hello, mine, theirs, other])

  async function find() {
    if (busy) return
    setBusy(true)
    setPhase('working')
    setWorkingLine('Looking…')
    try {
      await wait(900)
      const base = seedWorld()
      for (const person of base.users) {
        const prior = world.users.find((user) => user.userId === person.userId)
        if (prior) person.memory = structuredClone(prior.memory)
      }
      const result = findFlour(base)
      setWorkingLine('Found a miller you’ll like.')
      await wait(1300)
      setWorkingLine('Talking him down…')
      await wait(1200)
      setWorkingLine(`Got him to ${money(result.session.summary.unitPriceCents)}.`)
      await wait(1100)
      setWorld(result.world)
      setSession(result.session)
      setPhase('deal')
    } catch (error) {
      setPhase('idle')
      setSession(null)
      setToast(error instanceof Error ? error.message : 'Something didn’t go through.')
    }
    setWorkingLine(null)
    setBusy(false)
  }

  function decide(decision: 'approve' | 'decline') {
    if (busy || !session) return
    try {
      const result = confirmSession(world, session.sessionId, view, decision)
      setWorld(result.world)
      setSession(result.session)
      setPhase('deal')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Something didn’t go through.')
    }
  }

  function reset() {
    setWorld(seedWorld())
    setSession(null)
    setPhase('idle')
    setView('lena')
    setSheet(null)
    setChat([])
  }

  function openChat() {
    setMenuOpen(false)
    setChat([{ from: 'them', text: `Hi ${PEOPLE[view].first}. What’s on your mind?` }])
    setSheet('chat')
  }

  function onChat(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    const answer = replyTo(world, view, text)
    setWorld(answer.world)
    setChat((items) => [...items, { from: 'me', text }, { from: 'them', text: answer.reply }])
  }

  function onRemember(event: FormEvent) {
    event.preventDefault()
    const text = memoryDraft.trim()
    if (!text) return
    setWorld(remember(world, view, text))
    setMemoryDraft('')
    setToast('I’ll keep that to myself.')
  }

  const deal = session && scene.mode === 'deal' ? publicDeal(session, view) : null
  const memories = visibleMemory(world, view)
  const orbClass = [
    'gc-orb-wrap',
    view === 'tomas' && scene.orb !== 'gc-done' ? 'gc-blue' : '',
    scene.orb === 'gc-blue' ? '' : scene.orb,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="gc">
      <header className="gc-top">
        <Link href="/" className="gc-brand">
          <b>Grain & Vault</b>
        </Link>
        <div className="gc-right">
          <div className="gc-who" role="group" aria-label="Whose view">
            <button
              aria-pressed={view === 'lena'}
              aria-label="Lena's view"
              className={view !== 'lena' && needs('lena') ? 'gc-ping' : ''}
              onClick={() => setView('lena')}
            >
              L<span className="gc-dot" />
            </button>
            <button
              aria-pressed={view === 'tomas'}
              aria-label="Tomas's view"
              className={view !== 'tomas' && needs('tomas') ? 'gc-ping' : ''}
              onClick={() => setView('tomas')}
            >
              T<span className="gc-dot" />
            </button>
          </div>
          <button
            className="gc-menu-btn"
            aria-label="Menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
          </button>
          <nav className={`gc-pop${menuOpen ? ' gc-open' : ''}`} aria-label="Menu">
            <button onClick={openChat}>Talk to {phrase}</button>
            <button
              onClick={() => {
                setMenuOpen(false)
                setSheet('memory')
              }}
            >
              What {phrase} remembers
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                reset()
              }}
            >
              Start over
            </button>
            <Link href="/" onClick={() => setMenuOpen(false)}>
              Grain & Vault home
            </Link>
          </nav>
        </div>
      </header>

      <main className="gc-main" aria-live="polite">
        <div className={orbClass}>
          <button className="gc-orb gc-orb-btn" aria-label={`Talk to ${phrase}`} onClick={openChat} />
          <div className="gc-check" aria-hidden="true">
            <svg viewBox="0 0 54 54">
              <path d="M15 28l8 8 16-18" />
            </svg>
          </div>
        </div>
        <div className="gc-name">{name}</div>
        <h1 className="gc-title">
          <span className="gc-fx" key={scene.line}>
            {scene.line}
          </span>
        </h1>
        <p className="gc-sub">{scene.sub}</p>
        <div className="gc-stage">
          {scene.mode === 'ask' ? (
            <button className="gc-chip" onClick={find} disabled={busy} aria-label="Find 200 bags of bread flour">
              <i>✦</i> Find 200 bags of bread flour
            </button>
          ) : null}

          {scene.mode === 'waiting' ? (
            <button className="gc-link" onClick={() => setView(other)}>
              Switch to {PEOPLE[other].first}’s view →
            </button>
          ) : null}

          {deal ? (
            <DealCard deal={deal} busy={busy} onApprove={() => decide('approve')} onDecline={() => decide('decline')} />
          ) : null}

          {scene.mode === 'settled' ? (
            <>
              <span className="gc-tag">Mock payment · no real money</span>
              <button className="gc-link" onClick={reset}>
                Run it again
              </button>
            </>
          ) : null}

          {scene.mode === 'declined' ? (
            <button className="gc-link" onClick={reset}>
              Start fresh
            </button>
          ) : null}
        </div>
      </main>

      <div className="gc-corner">Simulated · no real money</div>

      <div className={`gc-shade${sheet ? ' gc-open' : ''}`} onClick={() => setSheet(null)} />

      <section
        className={`gc-sheet${sheet === 'chat' ? ' gc-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${phrase}`}
      >
        <div className="gc-grab" />
        <div className="gc-sh">
          <h2>{name}</h2>
          <button className="gc-x" aria-label="Close" onClick={() => setSheet(null)}>
            ✕
          </button>
        </div>
        <div className="gc-msgs">
          {chat.map((item, index) => (
            <div key={`${item.from}-${index}`} className={`gc-b ${item.from === 'me' ? 'gc-me' : 'gc-them'}`}>
              {item.text}
            </div>
          ))}
        </div>
        <form className="gc-ask" onSubmit={onChat}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Say anything…"
            aria-label="Message"
            autoComplete="off"
          />
          <button className="gc-send" aria-label="Send" type="submit">
            ↑
          </button>
        </form>
      </section>

      <section
        className={`gc-sheet${sheet === 'memory' ? ' gc-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`What ${phrase} remembers`}
      >
        <div className="gc-grab" />
        <div className="gc-sh">
          <h2>What {phrase} remembers</h2>
          <button className="gc-x" aria-label="Close" onClick={() => setSheet(null)}>
            ✕
          </button>
        </div>
        <p className="gc-hint">Items with a lock never leave your agent. Tap to edit, or remove anything.</p>
        <div className="gc-mem">
          {sheet === 'memory' && memories.length === 0 ? <p className="gc-hint">Nothing yet.</p> : null}
          {sheet === 'memory'
            ? memories.map((item) => (
            <MemoryRow
              key={item.id}
              item={item}
              editing={editing === item.id}
              onEdit={() => {
                if (editing === item.id) {
                  const node = document.getElementById(`mem-${item.id}`)
                  const text = node?.textContent?.trim() || item.text
                  setWorld(updateMemory(world, view, item.id, text))
                  setEditing(null)
                  setToast('Updated.')
                } else {
                  setEditing(item.id)
                }
              }}
              onRemove={() => {
                setWorld(removeMemory(world, view, item.id))
                setToast('Forgotten.')
              }}
            />
            ))
            : null}
        </div>
        <form className="gc-ask" onSubmit={onRemember}>
          <input
            value={memoryDraft}
            onChange={(event) => setMemoryDraft(event.target.value)}
            placeholder="Teach me something private…"
            aria-label="New memory"
            autoComplete="off"
          />
          <button className="gc-send" aria-label="Add" type="submit">
            +
          </button>
        </form>
      </section>

      <div className={`gc-toast${toast ? ' gc-on' : ''}`} role="status">
        {toast}
      </div>
    </div>
  )
}

function DealCard({
  deal,
  busy,
  onApprove,
  onDecline,
}: {
  deal: ReturnType<typeof publicDeal>
  busy: boolean
  onApprove: () => void
  onDecline: () => void
}) {
  return (
    <>
      <article className="gc-card" aria-label="Proposed deal">
        <div className="gc-party">
          <div className="gc-av" aria-hidden="true">
            {deal.counterpartyInitial}
          </div>
          <div>
            <b>{deal.counterpartyName}</b>
            <small>{deal.counterpartyBusiness}</small>
          </div>
        </div>
        <div className="gc-big">{money(deal.totalCents)}</div>
        <div className="gc-what">
          {deal.qty} bags of {deal.category} · {money(deal.unitPriceCents)}/bag
        </div>
        <div className="gc-rows">
          <div>
            <span>Delivery</span>
            <b>
              {day(deal.windowFrom)} – {day(deal.windowTo)}
            </b>
          </div>
          <div>
            <span>{deal.youPayOrReceive === 'pay' ? 'You pay' : 'You receive'}</span>
            <b>{money(deal.amountCents)}</b>
          </div>
        </div>
        <div className="gc-fee">
          Fee {money(deal.feeCents)}, {deal.feePaidByYou ? 'paid by you' : 'paid by the seller'}. 33 bps.
        </div>
        <div className="gc-actions">
          <button className="gc-primary" onClick={onApprove} disabled={busy} aria-label="Approve this deal">
            Approve
          </button>
          <button className="gc-quiet" onClick={onDecline} disabled={busy} aria-label="Decline this deal">
            Not now
          </button>
        </div>
      </article>
      <details className="gc-how">
        <summary>See how</summary>
        <ul>
          <li>Only matched on what you approved.</li>
          <li>Your private notes stayed private.</li>
          <li>Walk-away prices never cross.</li>
          <li>Nothing happens until you both say yes.</li>
        </ul>
      </details>
    </>
  )
}

function MemoryRow({
  item,
  editing,
  onEdit,
  onRemove,
}: {
  item: MemoryItem
  editing: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div className="gc-mi">
      {item.visibility === 'never-shared' ? (
        <svg className="gc-lock" viewBox="0 0 16 16" aria-label="Never shared" role="img">
          <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
          <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      ) : (
        <span className="gc-lock" />
      )}
      <p id={`mem-${item.id}`} contentEditable={editing} suppressContentEditableWarning>
        {item.text}
      </p>
      <button onClick={onEdit} aria-label={editing ? 'Save' : 'Edit'}>
        {editing ? 'Save' : 'Edit'}
      </button>
      <button onClick={onRemove} aria-label="Remove">
        Remove
      </button>
    </div>
  )
}
