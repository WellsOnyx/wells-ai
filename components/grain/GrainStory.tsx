'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

const SCENES = [
  {
    n: '01',
    kicker: 'Your bakery',
    title: 'You need flour.',
    body: 'You run a bakery. You need 200 bags of bread flour.',
    clip: 'need',
  },
  {
    n: '02',
    kicker: 'One sentence',
    title: 'You tell Wells.',
    body: 'Wells is your agent. You say what you need in one sentence.',
    clip: 'tell',
  },
  {
    n: '03',
    kicker: 'Two agents',
    title: 'Wells finds a mill.',
    body: "Wells finds a grain mill and talks with the mill's Wells. The most you will pay, and the least the mill will accept, stay private.",
    clip: 'talk',
  },
  {
    n: '04',
    kicker: 'Both sides',
    title: 'Both of you have to say yes.',
    body: 'You tap confirm. The mill taps confirm. Nothing is signed, and no money moves, until both do.',
    clip: 'confirm',
  },
  {
    n: '05',
    kicker: 'The payment',
    title: 'You pay at once.',
    body: 'You pay in GRAIN. GRAIN is money that moves instantly, and you pay no fee. Vault keeps a record of the deal that no one can change.',
    clip: 'settle',
  },
] as const

export function GrainStory() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rootEl = root.current
    if (!rootEl) return
    const scenes = [...rootEl.querySelectorAll<HTMLElement>('.gs-scene')]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.setAttribute('data-play', 'true')
        }
      },
      { threshold: 0.55 },
    )
    scenes.forEach((scene) => observer.observe(scene))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="gs" ref={root}>
      <section className="gs-scene gs-open" aria-labelledby="gs-open-title">
        <div className="gs-pin">
          <p className="gs-kicker">
            <span>Start</span>
            The problem
          </p>
          <h2 id="gs-open-title">Buying takes too long.</h2>
          <p className="gs-body">
            Buying anything for a business means hours of back-and-forth. Moving the money costs fees and takes days.
          </p>
          <div className="gs-clip" aria-hidden="true">
            <OldWayClip />
          </div>
          <p className="gs-thesis">
            Grain & Vault is a personal agent that finds and negotiates deals for you, plus money (GRAIN) that settles instantly with zero fees, with Vault keeping every record honest.
          </p>
          <p className="gs-handoff">Here&apos;s how it works. Meet Wells.</p>
        </div>
      </section>

      {SCENES.map((scene) => (
        <article key={scene.n} className="gs-scene" aria-labelledby={`gs-${scene.n}`}>
          <div className="gs-pin">
            <p className="gs-kicker">
              <span>{scene.n}</span>
              {scene.kicker}
            </p>
            <h2 id={`gs-${scene.n}`}>{scene.title}</h2>
            <p className="gs-body">{scene.body}</p>
            <div className="gs-clip" aria-hidden="true">
              {scene.clip === 'need' ? <NeedClip /> : null}
              {scene.clip === 'tell' ? <TellClip /> : null}
              {scene.clip === 'talk' ? <TalkClip /> : null}
              {scene.clip === 'confirm' ? <ConfirmClip /> : null}
              {scene.clip === 'settle' ? <SettleClip /> : null}
            </div>
          </div>
        </article>
      ))}

      <section className="gs-close" aria-labelledby="gs-close-title">
        <p className="gs-kicker">Grain & Vault</p>
        <h2 id="gs-close-title">Money that works for you.</h2>
        <div className="gs-ctas">
          <Link className="gc-chip" href="/join?journey=treasury">
            <i>✦</i> Open Your Vault
          </Link>
          <Link className="gc-chip gs-alt" href="/agent">
            Try your agent
          </Link>
        </div>
        <p className="gs-note">A simulated story. No real money.</p>
      </section>
    </div>
  )
}

function OldWayClip() {
  return (
    <div className="gs-card gs-old">
      <p className="gs-msg">Any word on the flour?</p>
      <p className="gs-msg">Still waiting on a price.</p>
      <p className="gs-msg gs-msg-wait">Payment · a few days · fees</p>
    </div>
  )
}

function NeedClip() {
  return (
    <div className="gs-card">
      <div className="gs-rowtop">
        <b>You</b>
        <small>A bakery</small>
      </div>
      <p className="gs-figure">200</p>
      <p className="gs-what">bags of bread flour</p>
      <div className="gs-meter" />
    </div>
  )
}

function TellClip() {
  return (
    <div className="gs-chat">
      <div className="gs-orb gs-orb-sm" />
      <p className="gs-who">You, to Wells</p>
      <p className="gs-bubble">Find 200 bags of bread flour.</p>
    </div>
  )
}

function TalkClip() {
  return (
    <div className="gs-pair">
      <div className="gs-card gs-mini">
        <div className="gs-orb" />
        <b>Wells</b>
        <small>Your agent</small>
        <p className="gs-lock">Your limit stays private</p>
      </div>
      <div className="gs-agreed">$38</div>
      <div className="gs-card gs-mini">
        <div className="gs-orb gs-blue" />
        <b>The mill's Wells</b>
        <small>For the mill</small>
        <p className="gs-lock">The mill's limit stays private</p>
      </div>
    </div>
  )
}

function ConfirmClip() {
  return (
    <div className="gs-card">
      <div className="gs-confirm gs-yes-you">
        <span>You · the bakery</span>
        <b>Confirmed</b>
      </div>
      <div className="gs-confirm gs-yes-mill">
        <span>The mill</span>
        <b>Confirmed</b>
      </div>
      <p className="gs-both">Both confirmed</p>
    </div>
  )
}

function SettleClip() {
  return (
    <div className="gs-card">
      <p className="gs-figure">$7,600</p>
      <p className="gs-what">Paid in GRAIN · your fee $0</p>
      <ol className="gs-log">
        <li>Your bakery → a grain mill</li>
        <li>200 bags of bread flour</li>
        <li>Saved in the Vault</li>
      </ol>
    </div>
  )
}
