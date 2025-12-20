import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WellsAI | AI That Actually Does Things',
  description: 'Tell Wells what you need. Get it done. AI-to-AI negotiation with human approval. 1% success fee.',
  openGraph: {
    title: 'WellsAI | AI That Actually Does Things',
    description: 'Tell Wells what you need. Get it done. AI-to-AI negotiation with human approval. 1% success fee.',
    url: 'https://wellsonyx.io',
    siteName: 'WellsAI',
    type: 'website',
    images: [
      {
        url: '/wells-onyx-og.png',
        width: 1200,
        height: 630,
        alt: 'WellsAI - AI Commerce Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WellsAI | AI That Actually Does Things',
    description: 'Tell Wells what you need. Get it done. AI-to-AI negotiation with human approval.',
    images: ['/wells-onyx-og.png'],
  },
  icons: {
    icon: '/favicon.ico',
  },
}

// Check if Clerk is configured
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

// Satellite domain configuration
const GRAIN_VAULT_DOMAINS = ['grainandvault.com', 'www.grainandvault.com']
const PRIMARY_DOMAIN = 'wellsonyx.io'

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // If Clerk is not configured, render without it
  if (!clerkPublishableKey) {
    return <RootLayoutContent>{children}</RootLayoutContent>
  }

  // Get the current host to determine if this is a satellite domain
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isSatelliteDomain = GRAIN_VAULT_DOMAINS.some(d => host.includes(d))

  // Configure ClerkProvider for satellite domains
  // See: https://clerk.com/docs/advanced-usage/satellite-domains
  if (isSatelliteDomain) {
    return (
      <ClerkProvider
        isSatellite
        domain={host}
        signInUrl={`https://${PRIMARY_DOMAIN}/sign-in`}
        signUpUrl={`https://${PRIMARY_DOMAIN}/sign-up`}
        afterSignInUrl="/grain-vault/dashboard"
        afterSignUpUrl="/grain-vault/onboard"
      >
        <RootLayoutContent>{children}</RootLayoutContent>
      </ClerkProvider>
    )
  }

  // Standard ClerkProvider for primary domain
  return (
    <ClerkProvider
      allowedRedirectOrigins={['https://grainandvault.com', 'https://www.grainandvault.com']}
    >
      <RootLayoutContent>{children}</RootLayoutContent>
    </ClerkProvider>
  )
}
