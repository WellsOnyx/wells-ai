import './globals.css'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Wells AI | Conversational Commerce',
  description: 'Intelligent procurement matching for enterprise buyers and suppliers',
  verification: {
    other: {
      'impact-site-verification': '923256ae-9a83-4361-8115-b4934d461ef6',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
