import { Metadata } from 'next'
import GrainVaultClient from './GrainVaultClient'

export const metadata: Metadata = {
  title: 'Grain & Vault | Treasury Infrastructure for Modern Finance',
  description: 'Zero friction payments. 1:1 credit lines. Native ERP integration. The Treasury SDK that eliminates payment failures.',
  other: {
    'base:app_id': '694972c8d77c069a945be5d0',
  },
  openGraph: {
    title: 'Grain & Vault | Treasury Infrastructure for Modern Finance',
    description: 'Zero friction payments. 1:1 credit lines. Native ERP integration. The Treasury SDK that eliminates payment failures.',
    url: 'https://grainandvault.com',
    siteName: 'Grain & Vault',
    type: 'website',
    images: [
      {
        url: '/grain-vault-og.png',
        width: 1200,
        height: 630,
        alt: 'Grain & Vault - Treasury Infrastructure',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grain & Vault | Treasury Infrastructure for Modern Finance',
    description: 'Zero friction payments. 1:1 credit lines. Native ERP integration.',
    images: ['/grain-vault-og.png'],
  },
  icons: {
    icon: '/grain-vault-favicon.ico',
  },
}

export default function GrainVaultPage() {
  return <GrainVaultClient />
}
