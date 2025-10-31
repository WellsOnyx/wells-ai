import WellsAIContent from '../components/WellsAIContent'

// Force dynamic rendering to fix useSearchParams issue
export const dynamic = 'force-dynamic'

// Authenticated application interface
export default function App() {
  return <WellsAIContent />
}
