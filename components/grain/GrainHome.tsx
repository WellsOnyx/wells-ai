import Link from 'next/link'
import '@/app/grain-site.css'
import { grainFontClass } from '@/lib/grain-fonts'
import { SiteHeader } from './SiteHeader'

const PAINS = [
  {
    n: '01',
    title: 'Slow',
    body: 'A simple purchase turns into hours of messages before anyone agrees.',
  },
  {
    n: '02',
    title: 'Expensive',
    body: 'Fees pile on, and the money still takes days to show up.',
  },
  {
    n: '03',
    title: 'Opaque',
    body: 'When it is over, you still cannot prove what was agreed.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Wells finds and negotiates',
    body: 'Tell Wells what you need. It finds a fit and talks terms. Your private limit stays on your side.',
  },
  {
    n: '2',
    title: 'You approve',
    body: 'Nothing is signed and no money moves until you and the other side both say yes.',
  },
  {
    n: '3',
    title: 'Grain settles it. Vault records it.',
    body: 'Grain pays at once, with zero fees. Vault writes an audited record of the deal.',
  },
]

const PRODUCTS = [
  {
    name: 'Grain',
    line: 'A 1:1 dollar-backed payment stablecoin with zero fees.',
  },
  {
    name: 'Vault',
    line: 'The trust and compliance layer, with an audited record of every deal.',
  },
  {
    name: 'Wells',
    line: 'Your AI agent. It finds, negotiates, and settles deals, and asks before money moves.',
  },
]

export default function GrainHome() {
  return (
    <div className={`gv ${grainFontClass}`}>
      <a className="gv-skip" href="#promise">
        Skip to content
      </a>
      <SiteHeader current="home" />
      <main>
        <section className="gv-hero" aria-labelledby="promise">
          <div className="gv-wrap">
            <p className="gv-kicker">Grain & Vault</p>
            <h1 id="promise">
              Wells finds the deal.
              <br />
              Grain pays it.
              <br />
              Vault records it.
            </h1>
            <p className="gv-lede">
              An AI agent for business buying, a dollar-backed stablecoin with zero fees, and an audited record of
              every deal.
            </p>
            <div className="gv-actions">
              <Link href="/agent" className="gv-btn">
                Meet Wells
              </Link>
              <a href="#how" className="gv-textlink">
                See how it works
              </a>
            </div>
            <ul className="gv-facts">
              <li>
                <b>Wells</b>
                <span>Finds and negotiates</span>
              </li>
              <li>
                <b>Grain</b>
                <span>Pays with zero fees</span>
              </li>
              <li>
                <b>Vault</b>
                <span>Records every deal</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="gv-section" id="problem" aria-labelledby="problem-title">
          <div className="gv-wrap">
            <p className="gv-kicker">The problem</p>
            <h2 id="problem-title">Buying and paying still takes too long.</h2>
            <ol className="gv-pains">
              {PAINS.map((pain) => (
                <li key={pain.n}>
                  <span>{pain.n}</span>
                  <h3>{pain.title}</h3>
                  <p>{pain.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="gv-section gv-story" id="story" aria-labelledby="story-title">
          <div className="gv-wrap gv-narrow">
            <p className="gv-kicker">Meet Wells · mock</p>
            <h2 id="story-title">You need flour. You tell Wells once.</h2>
            <p>You need 200 bags of bread flour. You say that in one sentence.</p>
            <p>
              Wells finds a grain mill and talks with the mill’s Wells. Your limit stays on your side. Theirs stays on
              theirs.
            </p>
            <p>You both confirm. Grain pays at once, with zero fees to you. Vault writes the record.</p>
            <p className="gv-note">A simulated story. No real money.</p>
          </div>
        </section>

        <section className="gv-section" id="how" aria-labelledby="how-title">
          <div className="gv-wrap">
            <p className="gv-kicker">How it works</p>
            <h2 id="how-title">Three steps. Then it is done.</h2>
            <ol className="gv-steps">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <span>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="gv-section" id="products" aria-labelledby="products-title">
          <div className="gv-wrap">
            <p className="gv-kicker">The products</p>
            <h2 id="products-title">Three pieces. One deal.</h2>
            <ul className="gv-products">
              {PRODUCTS.map((product) => (
                <li key={product.name}>
                  <h3>{product.name}</h3>
                  <p>{product.line}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="gv-section" id="trust" aria-labelledby="trust-title">
          <div className="gv-wrap gv-split">
            <div>
              <p className="gv-kicker">Trust</p>
              <h2 id="trust-title">You stay in charge.</h2>
            </div>
            <ul className="gv-trust">
              <li>
                <h3>You approve every deal</h3>
                <p>Money does not move until you say so.</p>
              </li>
              <li>
                <h3>Your data stays private</h3>
                <p>Limits and notes stay on your side of the deal.</p>
              </li>
              <li>
                <h3>A full audit trail</h3>
                <p>Vault keeps a record of what was agreed and what settled.</p>
              </li>
              <li>
                <h3>The demo is a mock</h3>
                <p>The flour story is simulated. No real money moves.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="gv-close" aria-labelledby="close-title">
          <div className="gv-wrap">
            <h2 id="close-title">Put Wells to work.</h2>
            <p>Tell it what you need. Approve the deal. Grain pays. Vault remembers.</p>
            <div className="gv-actions">
              <Link href="/agent" className="gv-btn gv-btn-light">
                Meet Wells
              </Link>
              <Link href="/join?journey=treasury" className="gv-textlink gv-textlink-light">
                Open Your Vault
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="gv-foot">
        <div className="gv-wrap gv-foot-inner">
          <p>Grain & Vault</p>
          <nav aria-label="Footer">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/grain-vault/treasury">Treasury</Link>
            <Link href="/blog">Blog</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
