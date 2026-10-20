'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

const SCENES = [
  {
    n: '01',
    kicker: "Lena's Bakery",
    title: 'She needs flour.',
    body: 'Lena runs a bakery. She needs 200 bags of bread flour.',
    clip: 'need',
  },
  {
    n: '02',
    kicker: 'One sentence',
    title: 'She tells her agent.',
    body: 'Her agent is Pip, and Pip works for her. She tells Pip what she needs in one sentence.',
    clip: 'tell',
  },
  {
    n: '03',
    kicker: 'Two agents',
    title: 'Pip finds a mill.',
    body: 'The mill is run by Tomas. His agent is Juno. Pip and Juno agree a price. The most Lena will pay, and the least Tomas will accept, stay private.',
    clip: 'talk',
  },
  {
    n: '04',
    kicker: 'Both people',
    title: 'Both of them have to say yes.',
    body: 'Lena taps confirm. Tomas, who runs the mill, taps confirm. Nothing is signed, and no money moves, until both do.',
    clip: 'confirm',
  },
  {
    n: '05',
    kicker: 'The payment',
    title: 'Lena pays at once.',
    body: 'She pays in GRAIN. GRAIN is money that moves instantly, and Lena pays no fee. Vault keeps a record of the deal that no one can change.',
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
          <p className="gs-handoff">Here&apos;s how it works. Meet Lena.</p>
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
        <b>Lena Ortiz</b>
        <small>Lena's Bakery</small>
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
      <p className="gs-who">Lena, to Pip</p>
      <p className="gs-bubble">Find 200 bags of bread flour.</p>
    </div>
  )
}

function TalkClip() {
  return (
    <div className="gs-pair">
      <div className="gs-card gs-mini">
        <div className="gs-orb" />
        <b>Pip</b>
        <small>Lena's agent</small>
        <p className="gs-lock">Lena's limit stays private</p>
      </div>
      <div className="gs-agreed">$38</div>
      <div className="gs-card gs-mini">
        <div className="gs-orb gs-blue" />
        <b>Juno</b>
        <small>The mill's agent</small>
        <p className="gs-lock">Tomas's limit stays private</p>
      </div>
    </div>
  )
}

function ConfirmClip() {
  return (
    <div className="gs-card">
      <div className="gs-confirm gs-yes-lena">
        <span>Lena · the bakery</span>
        <b>Confirmed</b>
      </div>
      <div className="gs-confirm gs-yes-tomas">
        <span>Tomas · the mill</span>
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
      <p className="gs-what">Paid in GRAIN · Lena's fee $0</p>
      <ol className="gs-log">
        <li>Lena's bakery → Tomas's mill</li>
        <li>200 bags of bread flour</li>
        <li>Saved in the Vault</li>
      </ol>
    </div>
  )
}
