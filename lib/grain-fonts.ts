import { Fraunces, Outfit } from 'next/font/google'

export const grainDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--gv-serif',
  display: 'swap',
})

export const grainSans = Outfit({
  subsets: ['latin'],
  variable: '--gv-sans',
  display: 'swap',
})

export const grainFontClass = `${grainDisplay.variable} ${grainSans.variable}`
