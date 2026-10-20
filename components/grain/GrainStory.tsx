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
    body: 'No forms. No back and forth. Just what she needs.',
    clip: 'tell',
  },
  {
    n: '03',
    kicker: 'The agents',
    title: 'They negotiate in private.',
    body: "Her agent finds a mill and talks with the mill's agent. Walk-away prices never cross.",
    clip: 'talk',
  },
  {
    n: '04',
    kicker: 'Both people',
    title: 'Nothing settles until both confirm.',
    body: 'Lena taps confirm. Tomas taps confirm. The deal waits for both.',
    clip: 'confirm',
  },
  {
    n: '05',
    kicker: 'GRAIN',
    title: 'Payment settles instantly.',
    body: 'Zero fees to the buyer. Vault writes the deal to a tamper-proof log.',
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
        <p className="gs-lock">Walk-away price stays private</p>
      </div>
      <div className="gs-agreed">$38</div>
      <div className="gs-card gs-mini">
        <div className="gs-orb gs-blue" />
        <b>Juno</b>
        <small>Tomas Mill</small>
        <p className="gs-lock">Walk-away price stays private</p>
      </div>
    </div>
  )
}

function ConfirmClip() {
  return (
    <div className="gs-card">
      <div className="gs-confirm gs-yes-lena">
        <span>Lena</span>
        <b>Confirmed</b>
      </div>
      <div className="gs-confirm gs-yes-tomas">
        <span>Tomas</span>
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
      <p className="gs-what">Settled in GRAIN · buyer fee $0</p>
      <ol className="gs-log">
        <li>Lena's Bakery → Tomas Mill</li>
        <li>200 bags of bread flour</li>
        <li>Vault log sealed</li>
      </ol>
    </div>
  )
}
