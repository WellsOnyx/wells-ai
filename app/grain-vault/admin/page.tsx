'use client'

import { useUser } from '@clerk/nextjs'
import { useState } from 'react'

export default function AdminPage() {
  const { user, isLoaded } = useUser()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const runAction = async (action: string, data: any = {}) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/fix-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data })
      })
      const json = await res.json()
      setResult(json)
    } catch (e: any) {
      setResult({ error: e.message })
    }
    setLoading(false)
  }

  if (!isLoaded) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Please sign in</div>
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Admin - Balance Fix</h1>
      <p className="text-gray-400 mb-6">User: {user.id}</p>

      <div className="space-y-4 max-w-md">
        <button
          onClick={() => runAction('get_info')}
          disabled={loading}
          className="w-full p-4 bg-blue-600 rounded-lg font-medium disabled:opacity-50"
        >
          View Current Balance & Transactions
        </button>

        <button
          onClick={() => runAction('set_balance', { newBalance: 0 })}
          disabled={loading}
          className="w-full p-4 bg-red-600 rounded-lg font-medium disabled:opacity-50"
        >
          Reset Balance to $0
        </button>

        <button
          onClick={() => runAction('reset_to_production')}
          disabled={loading}
          className="w-full p-4 bg-yellow-600 rounded-lg font-medium disabled:opacity-50"
        >
          Remove Demo Deposits (Keep Real Only)
        </button>
      </div>

      {loading && <p className="mt-6 text-gray-400">Loading...</p>}

      {result && (
        <pre className="mt-6 p-4 bg-gray-900 rounded-lg overflow-auto text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
