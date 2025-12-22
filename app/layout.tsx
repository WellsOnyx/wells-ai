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

// Domain configuration
const GRAIN_VAULT_DOMAINS = ['grainandvault.com', 'www.grainandvault.com']

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
  // Get the current host for domain-specific configuration
  const headersList = await headers()
  const host = headersList.get('host') || ''
  const isGrainVault = GRAIN_VAULT_DOMAINS.some(d => host.includes(d))

  // If Clerk is not configured, render without it
  if (!clerkPublishableKey) {
    return <RootLayoutContent>{children}</RootLayoutContent>
  }

  // Configure ClerkProvider with domain-specific paths
  // Clerk is configured to work directly on both domains
  return (
    <ClerkProvider
      signInUrl={isGrainVault ? '/grain-vault/signin' : '/sign-in'}
      signUpUrl={isGrainVault ? '/grain-vault/signup' : '/sign-up'}
      afterSignInUrl={isGrainVault ? '/grain-vault/dashboard' : '/dashboard'}
      afterSignUpUrl={isGrainVault ? '/grain-vault/onboard' : '/onboarding'}
    >
      <RootLayoutContent>{children}</RootLayoutContent>
    </ClerkProvider>
  )
}
