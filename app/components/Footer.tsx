import Link from 'next/link';

interface FooterProps {
  variant?: 'luxury' | 'standard';
}

export default function Footer({ variant = 'standard' }: FooterProps) {
  if (variant === 'luxury') {
    return (
      <footer className="relative border-t border-[#daa520]/10 py-12 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="text-2xl font-serif tracking-wider text-[#daa520] mb-4">
                Grain & Vault
              </div>
              <p className="text-sm text-[#f5f5f0]/40 leading-relaxed">
                B2B Commerce Platform with Treasury + Grain Vault. Zero friction commerce.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-sm tracking-[0.2em] text-[#daa520] uppercase mb-4">
                Platform
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/app"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/roi"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    ROI Calculator
                  </Link>
                </li>
                <li>
                  <Link
                    href="/calculator"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Pricing Calculator
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm tracking-[0.2em] text-[#daa520] uppercase mb-4">
                Company
              </h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://wellsonyx.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Wells Onyx
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@wellsonyx.com"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm tracking-[0.2em] text-[#daa520] uppercase mb-4">
                Legal
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-sm text-[#f5f5f0]/50 hover:text-[#daa520] transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-[#daa520]/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-[#f5f5f0]/30">
              © {new Date().getFullYear()} Wells Onyx, LLC. All rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#daa520]/30"></div>
              <span className="text-xs tracking-[0.25em] text-[#daa520]/50 uppercase">
                Invitation Only
              </span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#daa520]/30"></div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  // Standard variant for internal pages
  return (
    <footer className="border-t border-slate-200 bg-white py-12 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-3">
              Grain & Vault
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              B2B Commerce Platform with Treasury + Grain Vault. Zero friction commerce.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/app"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/roi"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  ROI Calculator
                </Link>
              </li>
              <li>
                <Link
                  href="/calculator"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Pricing Calculator
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://wellsonyx.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Wells Onyx
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@wellsonyx.com"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">
            © {new Date().getFullYear()} Wells Onyx, LLC. All rights reserved.
          </div>
          <div className="text-xs text-slate-400">
            Built with precision and care
          </div>
        </div>
      </div>
    </footer>
  );
}
