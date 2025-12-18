'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ERPConnectContent() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const companyId = 'demo-company'; // TODO: Get from auth context

  useEffect(() => {
    // Show success/error messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      alert(`Successfully connected to ${success}!`);
    }
    if (error) {
      alert(`Failed to connect to ${error}`);
    }
  }, [searchParams]);

  const connectQuickBooks = () => {
    setLoading(true);
    const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');
    window.location.href = `/api/erp/quickbooks/connect?state=${state}`;
  };

  const connectXero = () => {
    setLoading(true);
    const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');
    window.location.href = `/api/erp/xero/connect?state=${state}`;
  };

  const connectCodat = () => {
    setLoading(true);
    // TODO: Implement Codat connection
    alert('Codat connection coming soon!');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Connect Your Accounting System
          </h1>
          <p className="text-xl text-purple-200">
            Automatically intercept payables and capture supplier networks
          </p>
          <p className="text-sm text-purple-300 mt-2">
            "The Silent Invasion" - We'll handle your payments and enroll every vendor
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* QuickBooks */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                QB
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-white">QuickBooks</h3>
                <p className="text-purple-300 text-sm">Online & Desktop</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-purple-200 text-sm">
              <li>✓ Auto-sync invoices</li>
              <li>✓ Real-time webhooks</li>
              <li>✓ Vendor enrollment</li>
              <li>✓ Payment recording</li>
            </ul>

            <button
              onClick={connectQuickBooks}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect QuickBooks'}
            </button>
          </div>

          {/* Xero */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                X
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-white">Xero</h3>
                <p className="text-purple-300 text-sm">Cloud Accounting</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-purple-200 text-sm">
              <li>✓ Auto-sync bills</li>
              <li>✓ Real-time webhooks</li>
              <li>✓ Supplier enrollment</li>
              <li>✓ Payment recording</li>
            </ul>

            <button
              onClick={connectXero}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect Xero'}
            </button>
          </div>

          {/* Codat (Universal) */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 bg-purple-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                ∞
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-white">Universal</h3>
                <p className="text-purple-300 text-sm">30+ Platforms</p>
              </div>
            </div>

            <ul className="space-y-2 mb-6 text-purple-200 text-sm">
              <li>✓ NetSuite, Sage, etc.</li>
              <li>✓ One integration</li>
              <li>✓ All features</li>
              <li>✓ Auto-detect</li>
            </ul>

            <button
              onClick={connectCodat}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect Any Platform'}
            </button>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20">
          <h2 className="text-2xl font-bold text-white mb-6">How "The Silent Invasion" Works</h2>

          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                1
              </div>
              <h3 className="font-bold text-white mb-2">Connect ERP</h3>
              <p className="text-purple-300 text-sm">
                Securely connect your accounting system via OAuth
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                2
              </div>
              <h3 className="font-bold text-white mb-2">Auto-Scan</h3>
              <p className="text-purple-300 text-sm">
                We automatically detect all unpaid invoices and vendors
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                3
              </div>
              <h3 className="font-bold text-white mb-2">Intercept Payables</h3>
              <p className="text-purple-300 text-sm">
                Pay through Wells for 1% - save on wire fees and processing
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                4
              </div>
              <h3 className="font-bold text-white mb-2">Silent Enrollment</h3>
              <p className="text-purple-300 text-sm">
                Every vendor you pay gets enrolled automatically
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <div className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/20">
            <div className="text-3xl font-bold text-green-400 mb-2">1%</div>
            <div className="text-white font-semibold">Our Fee</div>
            <div className="text-green-300 text-sm">vs 2-3% wire fees</div>
          </div>

          <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-blue-500/20">
            <div className="text-3xl font-bold text-blue-400 mb-2">100%</div>
            <div className="text-white font-semibold">Vendor Capture</div>
            <div className="text-blue-300 text-sm">Every payment = enrollment</div>
          </div>

          <div className="bg-purple-500/10 backdrop-blur-lg rounded-xl p-6 border border-purple-500/20">
            <div className="text-3xl font-bold text-purple-400 mb-2">24/7</div>
            <div className="text-white font-semibold">Auto-Sync</div>
            <div className="text-purple-300 text-sm">Real-time webhooks</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ERPConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>}>
      <ERPConnectContent />
    </Suspense>
  );
}
