'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  Key,
  Webhook,
  User,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import { usePartner, usePartnerSettings } from '@/lib/partners/hooks';
import { getStoredApiKey, storeApiKey, clearApiKey } from '@/lib/partners/auth';

export default function PartnerSettingsPage() {
  const router = useRouter();
  const { partner, loading: partnerLoading, refetch } = usePartner();
  const { updateSettings, regenerateApiKey, updating } = usePartnerSettings();

  const [contactInfo, setContactInfo] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  });

  const [webhookUrl, setWebhookUrl] = useState('');
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      router.push('/partners');
    }
  }, [router]);

  useEffect(() => {
    if (partner) {
      setContactInfo({
        contact_name: partner.contact_name || '',
        contact_email: partner.contact_email || '',
        contact_phone: partner.contact_phone || '',
      });
      setWebhookUrl(partner.webhook_url || '');
    }
  }, [partner]);

  const handleSaveContact = async () => {
    try {
      await updateSettings(contactInfo);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      refetch();
    } catch (error) {
      console.error('Failed to update contact info:', error);
    }
  };

  const handleSaveWebhook = async () => {
    try {
      await updateSettings({ webhook_url: webhookUrl });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      refetch();
    } catch (error) {
      console.error('Failed to update webhook URL:', error);
    }
  };

  const handleRegenerateKey = async () => {
    try {
      const result = await regenerateApiKey();
      setNewApiKey(result.api_key);
      setShowRegenerateModal(false);
      // Don't automatically store - let user copy first
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseNewKey = () => {
    storeApiKey(newApiKey);
    setNewApiKey('');
    refetch();
  };

  const handleLogout = () => {
    clearApiKey();
    router.push('/partners');
  };

  if (partnerLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!partner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/partners/dashboard"
              className="text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
              <p className="text-sm text-slate-600">{partner.platform_name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Success Message */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">Settings saved successfully</p>
          </div>
        )}

        {/* New API Key Display */}
        {newApiKey && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <Key className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">New API Key Generated</h3>
                <p className="text-sm text-blue-800">
                  Copy this key now - it won't be shown again. Update your integration to use the new key.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newApiKey}
                readOnly
                className="flex-1 px-4 py-3 bg-white border border-blue-300 rounded-lg font-mono text-sm"
              />
              <button
                onClick={copyApiKey}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={handleUseNewKey}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              I've Copied It - Use This Key
            </button>
          </div>
        )}

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Contact Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                value={contactInfo.contact_name}
                onChange={(e) => setContactInfo({ ...contactInfo, contact_name: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={contactInfo.contact_email}
                onChange={(e) => setContactInfo({ ...contactInfo, contact_email: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
              <input
                type="tel"
                value={contactInfo.contact_phone}
                onChange={(e) => setContactInfo({ ...contactInfo, contact_phone: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveContact}
              disabled={updating}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {updating ? 'Saving...' : 'Save Contact Info'}
            </button>
          </div>
        </div>

        {/* Webhook Configuration */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Webhook className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Webhook Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhooks/wells"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-slate-500">
                Wells will send POST requests to this URL when events occur
              </p>
            </div>

            <button
              onClick={handleSaveWebhook}
              disabled={updating}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {updating ? 'Saving...' : 'Save Webhook URL'}
            </button>
          </div>
        </div>

        {/* API Key Management */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">API Key Management</h2>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600 mb-2">Current API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded font-mono text-sm">
                  {getStoredApiKey()?.slice(0, 20)}...
                </code>
                <span className="text-green-600 text-sm font-medium">Active</span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900 mb-1">Regenerate API Key</p>
                  <p className="text-sm text-yellow-800 mb-3">
                    This will immediately invalidate your current API key. All existing integrations will
                    stop working until updated with the new key.
                  </p>
                  <button
                    onClick={() => setShowRegenerateModal(true)}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm font-medium"
                  >
                    Regenerate API Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info (Read-only) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Account Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600 mb-1">Company Name</p>
              <p className="font-medium text-slate-900">{partner.company_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Platform Name</p>
              <p className="font-medium text-slate-900">{partner.platform_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Domain</p>
              <p className="font-medium text-slate-900">{partner.domain}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Revenue Share</p>
              <p className="font-medium text-blue-600">{partner.revenue_share_percent}%</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {partner.status}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Member Since</p>
              <p className="font-medium text-slate-900">
                {new Date(partner.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="flex justify-end">
          <button
            onClick={handleLogout}
            className="px-6 py-2 text-red-600 hover:text-red-700 font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Regenerate Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirm Regeneration</h3>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to regenerate your API key? This action cannot be undone. Your current
              API key will stop working immediately.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="flex-1 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:border-slate-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateKey}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {updating ? 'Regenerating...' : 'Yes, Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
