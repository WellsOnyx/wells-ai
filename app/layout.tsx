import './globals.css'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/app/components/SessionProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Grain & Vault | B2B Commerce Platform',
  description: 'Buy or sell anything anywhere in the world. Never speak to a human. Treasury + Grain Vault. 33bps, 0 friction.',
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
