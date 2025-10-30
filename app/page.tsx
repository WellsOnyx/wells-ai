import WellsAIContent from './components/WellsAIContent'

// Force dynamic rendering to fix useSearchParams issue
export const dynamic = 'force-dynamic'

export default function Home() {
  return <WellsAIContent />
}
