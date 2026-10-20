import Link from 'next/link'

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#products', label: 'Products' },
  { href: '/#trust', label: 'Trust' },
]

export function SiteHeader({ current }: { current?: 'home' | 'agent' }) {
  return (
    <header className="gv-bar">
      <div className="gv-bar-inner">
        <Link href="/" className="gv-logo">
          <span className="gv-mark" aria-hidden="true" />
          Grain & Vault
        </Link>
        <nav className="gv-nav" aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link href="/sign-in">Sign in</Link>
          <Link href="/agent" className="gv-btn gv-btn-sm" aria-current={current === 'agent' ? 'page' : undefined}>
            Meet Wells
          </Link>
        </nav>
        <details className="gv-menu">
          <summary>Menu</summary>
          <div className="gv-menu-panel">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <Link href="/sign-in">Sign in</Link>
            <Link href="/agent">Meet Wells</Link>
          </div>
        </details>
      </div>
    </header>
  )
}
