import './globals.css'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/app/components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Wells AI | Conversational Commerce Platform',
  description: 'Buy or sell anything anywhere in the world. Never speak to a human. AI-powered commerce, instant connections, zero friction.',
  other: {
    'impact-site-verification': '923256ae-9a83-4361-8115-b4934d461ef6',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
