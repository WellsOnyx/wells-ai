import type { Metadata } from 'next'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-black text-white antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
