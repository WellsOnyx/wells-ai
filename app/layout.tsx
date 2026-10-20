import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/ThemeProvider'
import { grainVaultClerkAppearance } from '@/lib/clerk-theme'
import { isWellsOnyxHost } from '@/lib/hosts'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Grain & Vault | Protected Treasury. Zero Friction Payments.',
  description: 'Deposit your predictable spend. 100% protected. 0% interest credit line. 1% success fee. Powered by WellsAI.',
  openGraph: {
    title: 'Grain & Vault | Protected Treasury. Zero Friction Payments.',
    description: 'Deposit your predictable spend. 100% protected. 0% interest credit line. 1% success fee. Powered by WellsAI.',
    url: 'https://grainandvault.com',
    siteName: 'Grain & Vault',
    type: 'website',
    images: [
      {
        url: '/grain-vault-og.png',
        width: 1200,
        height: 630,
        alt: 'Grain & Vault - Protected Treasury Infrastructure',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grain & Vault | Protected Treasury. Zero Friction Payments.',
    description: 'Deposit your predictable spend. 100% protected. 0% interest credit line. Powered by WellsAI.',
    images: ['/grain-vault-og.png'],
  },
  icons: {
    icon: '/favicon.ico',
  },
}

// Check if Clerk is configured
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Domain configuration
const GRAIN_VAULT_DOMAINS = ['grainandvault.com', 'www.grainandvault.com']

function headDescription(host: string, path: string): string | null {
  if (isWellsOnyxHost(host)) {
    if (path === '/') {
      return 'Deposit your predictable spend. 100% protected. 0% interest credit line. 1% success fee. Powered by WellsAI.'
    }
    return null
  }
  if (path === '/agent') {
    return 'Wells finds, negotiates, and settles a sample flour deal. You approve before anything moves. Simulated. No real money.'
  }
  if (path === '/') {
    return 'Wells is an AI agent that finds and negotiates business deals. Grain is a dollar-backed stablecoin with zero fees. Vault keeps an audited record of every deal.'
  }
  return null
}

function RootLayoutContent({ children, description }: { children: React.ReactNode; description: string | null }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {description ? <meta name="description" content={description} /> : null}
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('wells-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get the current host for domain-specific configuration
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isGrainVault = GRAIN_VAULT_DOMAINS.some(d => host.includes(d))
  const description = headDescription(host, headersList.get('x-gv-path') || '')

  // If Clerk is not configured, render without it
  if (!clerkPublishableKey) {
    return <RootLayoutContent description={description}>{children}</RootLayoutContent>
  }

  // Configure ClerkProvider with unified auth flow
  // Both domains use same auth pages, journey parameter differentiates
  // Clerk Pro: Full white-label branding, optimized for thousands of concurrent users
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl={isGrainVault ? '/join?journey=treasury' : '/join'}
      afterSignInUrl={isGrainVault ? '/dashboard?journey=treasury' : '/dashboard'}
      afterSignUpUrl={isGrainVault ? '/dashboard?journey=treasury' : '/dashboard'}
      appearance={grainVaultClerkAppearance}
    >
      <RootLayoutContent description={description}>{children}</RootLayoutContent>
    </ClerkProvider>
  )
}
