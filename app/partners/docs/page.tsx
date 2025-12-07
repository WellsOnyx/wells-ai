'use client';

import { useState } from 'react';
import { Copy, Check, Code2, Lock, Webhook, AlertCircle } from 'lucide-react';

export default function PartnerDocsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const curlExample = `curl -X POST https://api.wellsonyx.io/v1/partners/transact \\
  -H "X-API-Key: wl_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_id": "tx_123456",
    "sender_id": "user_1",
    "sender_email": "sender@example.com",
    "recipient_id": "user_2",
    "recipient_email": "recipient@example.com",
    "amount": 1000,
    "currency": "USDC",
    "metadata": {
      "order_id": "order_789"
    }
  }'`;

  const jsExample = `const response = await fetch('https://api.wellsonyx.io/v1/partners/transact', {
  method: 'POST',
  headers: {
    'X-API-Key': 'wl_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_id: 'tx_123456',
    sender_id: 'user_1',
    sender_email: 'sender@example.com',
    recipient_id: 'user_2',
    recipient_email: 'recipient@example.com',
    amount: 1000,
    currency: 'USDC',
    metadata: {
      order_id: 'order_789'
    }
  })
});

const data = await response.json();
console.log(data);`;

  const pythonExample = `import requests

response = requests.post(
    'https://api.wellsonyx.io/v1/partners/transact',
    headers={
        'X-API-Key': 'wl_your_api_key_here',
        'Content-Type': 'application/json'
    },
    json={
        'external_id': 'tx_123456',
        'sender_id': 'user_1',
        'sender_email': 'sender@example.com',
        'recipient_id': 'user_2',
        'recipient_email': 'recipient@example.com',
        'amount': 1000,
        'currency': 'USDC',
        'metadata': {
            'order_id': 'order_789'
        }
    }
)

data = response.json()
print(data)`;

  const webhookExample = `{
  "event": "transaction.completed",
  "timestamp": "2025-12-07T10:30:00Z",
  "data": {
    "id": "wl_tx_abc123",
    "external_id": "tx_123456",
    "amount": 1000,
    "currency": "USDC",
    "status": "completed",
    "fees": {
      "total": 10.00,
      "partner_share": 2.00
    },
    "created_at": "2025-12-07T10:30:00Z"
  }
}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">Partner API Documentation</h1>
          <p className="text-slate-600 mt-2">
            Complete reference for integrating Wells treasury infrastructure
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-8">
              <nav className="space-y-1">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'authentication', label: 'Authentication' },
                  { id: 'endpoints', label: 'API Endpoints' },
                  { id: 'webhooks', label: 'Webhooks' },
                  { id: 'errors', label: 'Error Handling' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">Overview</h2>
                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-600 mb-4">
                      The Wells Partner API allows you to embed treasury infrastructure directly into your
                      platform. Process transactions, create wallets, and manage balances - all under your
                      brand.
                    </p>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Base URL</h3>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm">
                      https://api.wellsonyx.io/v1
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Key Features</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>• RESTful API with JSON request/response format</li>
                      <li>• API key authentication</li>
                      <li>• Webhook notifications for real-time updates</li>
                      <li>• Automatic silent enrollment for users</li>
                      <li>• Revenue share tracked per transaction</li>
                      <li>• Test mode and live mode environments</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Rate Limits</h3>
                    <ul className="space-y-2 text-slate-600">
                      <li>• Standard: 1,000 requests per minute</li>
                      <li>• Daily: 100,000 requests per day</li>
                      <li>• Higher limits available for enterprise partners</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Authentication */}
            {activeTab === 'authentication' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-900">Authentication</h2>
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-600 mb-4">
                      All API requests must be authenticated using your API key. Include it in the request
                      header:
                    </p>

                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm mb-6">
                      X-API-Key: wl_your_api_key_here
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-900 mb-1">Security Best Practices</p>
                          <ul className="text-sm text-yellow-800 space-y-1">
                            <li>• Never expose your API key in client-side code</li>
                            <li>• Store API keys securely using environment variables</li>
                            <li>• Rotate keys regularly</li>
                            <li>• Use different keys for test and production</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Test Mode</h3>
                    <p className="text-slate-600 mb-4">
                      Test mode API keys (starting with <code className="bg-slate-100 px-2 py-1 rounded">wl_test_</code>)
                      let you integrate without processing real transactions. All test transactions are
                      automatically marked and not counted toward revenue.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* API Endpoints */}
            {activeTab === 'endpoints' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Code2 className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-900">API Endpoints</h2>
                  </div>

                  {/* Create Transaction */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-3 py-1 bg-green-100 text-green-700 font-mono text-sm rounded">
                        POST
                      </span>
                      <code className="text-lg font-mono text-slate-900">/partners/transact</code>
                    </div>
                    <p className="text-slate-600 mb-4">
                      Process a transaction between two users. Creates silent accounts automatically if they
                      don't exist.
                    </p>

                    <h4 className="font-semibold text-slate-900 mb-2">Parameters</h4>
                    <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                      <div>
                        <code className="text-blue-600">external_id</code>
                        <span className="text-slate-500 ml-2">string (optional)</span>
                        <p className="text-slate-600 mt-1">Your internal transaction ID</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">sender_id</code>
                        <span className="text-slate-500 ml-2">string (required)</span>
                        <p className="text-slate-600 mt-1">Your internal sender user ID</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">sender_email</code>
                        <span className="text-slate-500 ml-2">string (optional)</span>
                        <p className="text-slate-600 mt-1">Sender email address</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">recipient_id</code>
                        <span className="text-slate-500 ml-2">string (required)</span>
                        <p className="text-slate-600 mt-1">Your internal recipient user ID</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">recipient_email</code>
                        <span className="text-slate-500 ml-2">string (optional)</span>
                        <p className="text-slate-600 mt-1">Recipient email address</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">amount</code>
                        <span className="text-slate-500 ml-2">number (required)</span>
                        <p className="text-slate-600 mt-1">Transaction amount (e.g., 1000 = $1,000)</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">currency</code>
                        <span className="text-slate-500 ml-2">string (optional)</span>
                        <p className="text-slate-600 mt-1">Currency code (default: USDC)</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <code className="text-blue-600">metadata</code>
                        <span className="text-slate-500 ml-2">object (optional)</span>
                        <p className="text-slate-600 mt-1">Custom key-value pairs</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">cURL</h4>
                          <button
                            onClick={() => copyCode(curlExample, 'curl')}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {copiedCode === 'curl' ? (
                              <>
                                <Check className="w-4 h-4" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                          <code>{curlExample}</code>
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">JavaScript</h4>
                          <button
                            onClick={() => copyCode(jsExample, 'js')}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {copiedCode === 'js' ? (
                              <>
                                <Check className="w-4 h-4" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                          <code>{jsExample}</code>
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">Python</h4>
                          <button
                            onClick={() => copyCode(pythonExample, 'python')}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            {copiedCode === 'python' ? (
                              <>
                                <Check className="w-4 h-4" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" /> Copy
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                          <code>{pythonExample}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Webhooks */}
            {activeTab === 'webhooks' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <Webhook className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-900">Webhooks</h2>
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-600 mb-4">
                      Webhooks notify your application when events happen in real-time. Configure your
                      webhook URL in the partner settings.
                    </p>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Events</h3>
                    <ul className="space-y-2 text-slate-600 mb-6">
                      <li>
                        <code className="bg-slate-100 px-2 py-1 rounded">transaction.completed</code> -
                        Transaction successfully processed
                      </li>
                      <li>
                        <code className="bg-slate-100 px-2 py-1 rounded">transaction.failed</code> -
                        Transaction failed
                      </li>
                      <li>
                        <code className="bg-slate-100 px-2 py-1 rounded">account.created</code> - New
                        silent account created
                      </li>
                    </ul>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Payload Example</h3>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs mb-6">
                      <code>{webhookExample}</code>
                    </pre>

                    <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Security</h3>
                    <p className="text-slate-600 mb-4">
                      Webhooks are signed with your webhook secret. Verify the signature before processing:
                    </p>

                    <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                      <code>{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return digest === signature;
}`}</code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Handling */}
            {activeTab === 'errors' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">Error Handling</h2>

                  <div className="prose prose-slate max-w-none">
                    <p className="text-slate-600 mb-6">
                      The API uses standard HTTP response codes and returns JSON error objects.
                    </p>

                    <h3 className="text-lg font-semibold text-slate-900 mb-3">HTTP Status Codes</h3>
                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <code className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">200</code>
                        <div>
                          <p className="font-medium text-slate-900">Success</p>
                          <p className="text-sm text-slate-600">Request completed successfully</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <code className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-sm">
                          400
                        </code>
                        <div>
                          <p className="font-medium text-slate-900">Bad Request</p>
                          <p className="text-sm text-slate-600">Invalid parameters or request format</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <code className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">401</code>
                        <div>
                          <p className="font-medium text-slate-900">Unauthorized</p>
                          <p className="text-sm text-slate-600">Invalid or missing API key</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <code className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">429</code>
                        <div>
                          <p className="font-medium text-slate-900">Rate Limited</p>
                          <p className="text-sm text-slate-600">Too many requests</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <code className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm">500</code>
                        <div>
                          <p className="font-medium text-slate-900">Server Error</p>
                          <p className="text-sm text-slate-600">Internal server error</p>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Error Response Format</h3>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
                      <code>{`{
  "error": "Invalid API key",
  "code": "invalid_api_key",
  "timestamp": "2025-12-07T10:30:00Z"
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
