/**
 * Supplier Match Card - Show matched suppliers inline
 */

'use client'

export default function SupplierMatchCard({ data }: any) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-3">🎯 Supplier Matches</h3>
      <div className="space-y-2">
        {data.matches?.map((match: any) => (
          <div key={match.id} className="p-3 border rounded">
            <div className="font-medium">{match.name}</div>
            <div className="text-sm text-gray-500">Match score: {match.score}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
