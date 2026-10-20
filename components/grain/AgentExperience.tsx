'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { SiteHeader } from '@/components/grain/SiteHeader'
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
  you: { mark: 'Y', label: 'You', other: 'mill' as const },
  mill: { mark: 'M', label: 'The mill', other: 'you' as const },
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
  return id === 'you' ? 'Wells' : "The mill's Wells"
}

function agentPhrase(id: ViewId): string {
  return id === 'you' ? 'Wells' : "the mill's Wells"
}

export default function AgentExperience() {
  const [world, setWorld] = useState<World>(() => seedWorld())
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<ViewId>('you')
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
      if (view === 'you') {
        return {
          orb: '',
          line: 'Meet Wells.',
          sub: 'Want me to find your flour?',
          mode: 'ask' as const,
        }
      }
      return {
        orb: '',
        line: 'All quiet.',
        sub: 'I will let you know when a good buyer turns up.',
        mode: 'quiet' as const,
      }
    }
    if (session.status === 'SETTLED') {
      return {
        orb: 'gc-done',
        line: view === 'you' ? 'Done. Flour’s on its way.' : 'Done. Payment’s on its way.',
        sub: `${session.summary.qty} bags · ${money(session.summary.totalCents)} · arriving ${day(session.summary.windowFrom)}`,
        mode: 'settled' as const,
      }
    }
    if (session.status === 'DECLINED') {
      return {
        orb: view === 'mill' ? 'gc-blue' : '',
        line: 'No problem.',
        sub: 'Nothing was signed or charged.',
        mode: 'declined' as const,
      }
    }
    if (mine === 'approve' && !theirs) {
      return {
        orb: 'gc-think',
        line: `Waiting on ${PEOPLE[other].label.toLowerCase()}…`,
        sub: 'You’re all set. I’ll finish the moment they say yes.',
        mode: 'waiting' as const,
      }
    }
    if (view === 'you') {
      return {
        orb: '',
        line: 'I found a grain mill.',
        sub: `The price is ${money(session.summary.unitPriceCents)} a bag.`,
        mode: 'deal' as const,
      }
    }
    return {
      orb: 'gc-blue',
      line: 'A bakery wants flour.',
      sub: '200 bags, a fair price. Wells already agreed the details.',
      mode: 'deal' as const,
    }
  }, [phase, workingLine, session, view, mine, theirs, other])

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
      setWorkingLine('Found a grain mill.')
      await wait(1300)
      setWorkingLine('Talking the price down…')
      await wait(1200)
      setWorkingLine(`The price is ${money(result.session.summary.unitPriceCents)} a bag.`)
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
    setView('you')
    setSheet(null)
    setChat([])
  }

  function openChat() {
    setMenuOpen(false)
    setChat([{ from: 'them', text: 'Hi. What’s on your mind?' }])
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

  return (
    <div className="gv-shell">
      <a className="gv-skip" href="#wells">
        Skip to Wells
      </a>
      <SiteHeader current="agent" />
      <main id="wells" className="gv-stage" aria-live="polite">
        <p className="gv-agent-name">{name}</p>
        <h1>{scene.line}</h1>
        {scene.sub ? <p className="gv-sub">{scene.sub}</p> : null}
        <div className="gv-toolbar">
          <div className="gv-switch" role="group" aria-label="Whose view">
            <button aria-pressed={view === 'you'} onClick={() => setView('you')}>
              Your view
              {view !== 'you' && needs('you') ? <span className="gv-dot" /> : null}
            </button>
            <button aria-pressed={view === 'mill'} onClick={() => setView('mill')}>
              The mill&apos;s view
              {view !== 'mill' && needs('mill') ? <span className="gv-dot" /> : null}
            </button>
          </div>
          <details className="gv-more" open={menuOpen} onToggle={(event) => setMenuOpen((event.target as HTMLDetailsElement).open)}>
            <summary>More</summary>
            <div className="gv-more-panel">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  openChat()
                }}
              >
                Talk to {phrase}
              </button>
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
              <Link href="/">Grain & Vault home</Link>
            </div>
          </details>
        </div>
        <div className="gv-actions">
          {scene.mode === 'ask' ? (
            <button className="gv-chip" onClick={find} disabled={busy}>
              Find 200 bags of bread flour
            </button>
          ) : null}
          {scene.mode === 'waiting' ? (
            <button className="gv-linkish" onClick={() => setView(other)}>
              Switch to {view === 'you' ? "the mill's view" : 'your view'}
            </button>
          ) : null}
        </div>
        {deal ? (
          <DealCard deal={deal} busy={busy} onApprove={() => decide('approve')} onDecline={() => decide('decline')} />
        ) : null}
        {scene.mode === 'settled' ? (
          <>
            <span className="gv-tag">Mock payment. No real money.</span>
            <div>
              <button className="gv-linkish" onClick={reset}>
                Run it again
              </button>
            </div>
          </>
        ) : null}
        {scene.mode === 'declined' ? (
          <button className="gv-linkish" onClick={reset}>
            Start fresh
          </button>
        ) : null}
        <p className="gv-mock">Simulated. No real money.</p>
      </main>

      {sheet ? <div className="gv-shade" onClick={() => setSheet(null)} /> : null}

      {sheet === 'chat' ? (
        <section className="gv-sheet" role="dialog" aria-modal="true" aria-label={`Chat with ${phrase}`}>
          <div className="gv-sh">
            <h2>{name}</h2>
            <button className="gv-x" aria-label="Close" onClick={() => setSheet(null)}>
              ×
            </button>
          </div>
          <div className="gv-msgs">
            {chat.map((item, index) => (
              <div key={`${item.from}-${index}`} className={`gv-b ${item.from === 'me' ? 'gv-me' : 'gv-them'}`}>
                {item.text}
              </div>
            ))}
          </div>
          <form className="gv-ask" onSubmit={onChat}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Say anything"
              aria-label="Message"
              autoComplete="off"
            />
            <button className="gv-send" aria-label="Send" type="submit">
              ↑
            </button>
          </form>
        </section>
      ) : null}

      {sheet === 'memory' ? (
        <section className="gv-sheet" role="dialog" aria-modal="true" aria-label={`What ${phrase} remembers`}>
          <div className="gv-sh">
            <h2>What {phrase} remembers</h2>
            <button className="gv-x" aria-label="Close" onClick={() => setSheet(null)}>
              ×
            </button>
          </div>
          <p className="gv-hint">Items with a lock never leave your agent. Edit or remove anything.</p>
          <div className="gv-mem">
            {memories.length === 0 ? <p className="gv-hint">Nothing yet.</p> : null}
            {memories.map((item) => (
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
            ))}
          </div>
          <form className="gv-ask" onSubmit={onRemember}>
            <input
              value={memoryDraft}
              onChange={(event) => setMemoryDraft(event.target.value)}
              placeholder="Teach me something private"
              aria-label="New memory"
              autoComplete="off"
            />
            <button className="gv-send" aria-label="Add" type="submit">
              +
            </button>
          </form>
        </section>
      ) : null}

      {toast ? (
        <div className="gv-toast" role="status">
          {toast}
        </div>
      ) : null}
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
      <article className="gv-deal" aria-label="Proposed deal">
        <div className="gv-party">
          <div className="gv-av" aria-hidden="true">
            {deal.counterpartyInitial}
          </div>
          <div>
            <b>{deal.counterpartyName}</b>
            <small>{deal.counterpartyBusiness}</small>
          </div>
        </div>
        <div className="gv-big">{money(deal.totalCents)}</div>
        <div className="gv-what">
          {deal.qty} bags of {deal.category} · {money(deal.unitPriceCents)} a bag
        </div>
        <div className="gv-rows">
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
        <div className="gv-fee">
          Fee {money(deal.feeCents)}, {deal.feePaidByYou ? 'paid by you' : 'paid by the seller'}. Mock payment.
        </div>
        <div className="gv-deal-actions">
          <button className="gv-btn" onClick={onApprove} disabled={busy}>
            Approve
          </button>
          <button className="gv-quiet" onClick={onDecline} disabled={busy}>
            Not now
          </button>
        </div>
      </article>
      <details className="gv-how">
        <summary>See how</summary>
        <ul>
          <li>Only matched on what you approved.</li>
          <li>Your private limit stays private.</li>
          <li>Nothing happens until you both say yes.</li>
          <li>This deal is a mock. No real money moves.</li>
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
    <div className="gv-mi">
      {item.visibility === 'never-shared' ? (
        <svg className="gv-lock" viewBox="0 0 16 16" aria-label="Never shared" role="img">
          <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
          <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
      ) : (
        <span className="gv-lock" />
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
