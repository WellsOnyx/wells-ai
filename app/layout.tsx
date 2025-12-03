import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Wells Onyx | AI That Actually Does Things',
  description: 'Tell Wells what you need. Get it done. AI-to-AI negotiation with human approval.',
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
