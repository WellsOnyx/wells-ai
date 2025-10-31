/**
 * Partner Dashboard Card - Show partner status inline
 */

'use client'

export default function PartnerDashboardCard({ data }: any) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-lg mb-3">🤝 Partner Status</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.partners?.map((partner: any) => (
          <div key={partner.id} className="border border-gray-200 rounded p-3 hover:border-blue-400 transition">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-medium">{partner.name}</h4>
              <span className={`text-xs px-2 py-1 rounded ${
                partner.status === 'ready' ? 'bg-green-100 text-green-800' :
                partner.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {partner.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              {partner.capabilities?.map((cap: string) => (
                <div key={cap}>✓ {cap}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
