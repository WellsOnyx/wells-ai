/**
 * Wells Onyx AI Ops - Integration Management UI
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Integration,
  IntegrationPlatform,
  IntegrationMetadata,
  IntegrationAction,
  AVAILABLE_INTEGRATIONS,
  INTEGRATION_TEMPLATES,
} from '@/lib/integrations';

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'integrations' | 'activity' | 'templates'>('integrations');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [actions, setActions] = useState<IntegrationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<IntegrationPlatform | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<IntegrationPlatform | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadIntegrations();
    loadActions();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations/list');
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActions = async () => {
    try {
      const response = await fetch('/api/integrations/actions');
      const data = await response.json();
      setActions(data.actions || []);
    } catch (error) {
      console.error('Failed to load actions:', error);
    }
  };

  const handleConnect = async (platform: IntegrationPlatform) => {
    setSelectedPlatform(platform);
    setConfigModalOpen(true);
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
      });
      await loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/test`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        alert('Connection test successful!');
      } else {
        alert('Connection test failed: ' + data.error);
      }
    } catch (error) {
      alert('Connection test failed');
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const credentials = {
      apiKey: formData.get('apiKey'),
      accessToken: formData.get('accessToken'),
      email: formData.get('email'),
      domain: formData.get('domain'),
    };

    try {
      const response = await fetch(`/api/integrations/${selectedPlatform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          credentials,
          config: {
            autoSync: formData.get('autoSync') === 'on',
            syncInterval: parseInt(formData.get('syncInterval') as string) || 60,
          },
        }),
      });

      if (response.ok) {
        setConfigModalOpen(false);
        setSelectedPlatform(null);
        await loadIntegrations();
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const getIntegrationMetadata = (platform: IntegrationPlatform): IntegrationMetadata => {
    const metadata = AVAILABLE_INTEGRATIONS.find((i) => i.name.toLowerCase().replace(/\s+/g, '-') === platform);
    return metadata || {
      name: platform,
      description: 'Integration service',
      category: 'communication',
      logoUrl: '/integrations/default.svg',
      color: '#6366f1',
      features: [],
      actionsCount: 0,
      health: 'healthy',
    };
  };

  const isConnected = (platform: IntegrationPlatform): Integration | undefined => {
    return integrations.find((i) => i.platform === platform);
  };

  const filteredIntegrations = AVAILABLE_INTEGRATIONS.filter((meta) => {
    if (filterCategory !== 'all' && meta.category !== filterCategory) return false;
    return true;
  });

  const filteredActions = actions.filter((action) => {
    if (filterPlatform !== 'all' && action.platform !== filterPlatform) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Integration Management</h1>
        <p className="text-gray-400">Connect Wells Onyx AI Ops to your client's tech stack</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-4 px-4 ${
            activeTab === 'integrations'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-4 px-4 ${
            activeTab === 'activity'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Activity Feed
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-4 px-4 ${
            activeTab === 'templates'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Templates
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Connected</div>
          <div className="text-3xl font-bold text-green-500">{integrations.length}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Available</div>
          <div className="text-3xl font-bold text-blue-500">{AVAILABLE_INTEGRATIONS.length}</div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Actions Today</div>
          <div className="text-3xl font-bold text-purple-500">
            {actions.filter((a) => {
              const today = new Date().toDateString();
              return new Date(a.timestamp).toDateString() === today;
            }).length}
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <div className="text-gray-400 text-sm mb-1">Templates</div>
          <div className="text-3xl font-bold text-orange-500">{INTEGRATION_TEMPLATES.length}</div>
        </div>
      </div>

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <>
          {/* Filter */}
          <div className="mb-6 flex gap-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded px-4 py-2 text-white"
            >
              <option value="all">All Categories</option>
              <option value="communication">Communication</option>
              <option value="project-management">Project Management</option>
              <option value="email">Email</option>
              <option value="crm">CRM</option>
              <option value="code">Code</option>
              <option value="docs">Docs</option>
              <option value="calendar">Calendar</option>
              <option value="meetings">Meetings</option>
              <option value="accounting">Accounting</option>
            </select>
          </div>

          {/* Integration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((meta) => {
              const platform = meta.name.toLowerCase().replace(/\s+/g, '-') as IntegrationPlatform;
              const connected = isConnected(platform);

              return (
                <div
                  key={platform}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}
                      >
                        {meta.name[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold">{meta.name}</h3>
                        <div className="text-xs text-gray-400 capitalize">{meta.category.replace('-', ' ')}</div>
                      </div>
                    </div>
                    {connected && (
                      <div className="flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-500">Connected</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-400 mb-4">{meta.description}</p>

                  {/* Features */}
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-2">Features:</div>
                    <div className="flex flex-wrap gap-1">
                      {meta.features.slice(0, 3).map((feature) => (
                        <span key={feature} className="text-xs bg-gray-800 px-2 py-1 rounded">
                          {feature}
                        </span>
                      ))}
                      {meta.features.length > 3 && (
                        <span className="text-xs bg-gray-800 px-2 py-1 rounded">
                          +{meta.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  {connected && (
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <div className="text-gray-500 text-xs">Last Sync</div>
                        <div className="text-white">
                          {new Date(connected.lastSync).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Actions</div>
                        <div className="text-white">
                          {actions.filter((a) => a.platform === platform).length}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {connected ? (
                      <>
                        <button
                          onClick={() => handleTestConnection(connected.id)}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
                        >
                          Test
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIntegration(connected);
                            setConfigModalOpen(true);
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                        >
                          Configure
                        </button>
                        <button
                          onClick={() => handleDisconnect(connected.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(platform)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Activity Feed Tab */}
      {activeTab === 'activity' && (
        <>
          {/* Filter */}
          <div className="mb-6">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value as any)}
              className="bg-gray-900 border border-gray-800 rounded px-4 py-2 text-white"
            >
              <option value="all">All Platforms</option>
              {integrations.map((int) => (
                <option key={int.platform} value={int.platform}>
                  {int.platform}
                </option>
              ))}
            </select>
          </div>

          {/* Activity List */}
          <div className="space-y-3">
            {filteredActions.map((action) => {
              const meta = getIntegrationMetadata(action.platform);

              return (
                <div
                  key={action.id}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-start gap-4"
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: meta.color + '20', color: meta.color }}
                  >
                    {meta.name[0]}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{action.action.replace('-', ' ').toUpperCase()}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {meta.name} • {JSON.stringify(action.data).substring(0, 100)}...
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span
                        className={
                          action.result === 'success' ? 'text-green-500' : 'text-red-500'
                        }
                      >
                        {action.result === 'success' ? '✓ Success' : '✗ Failed'}
                      </span>
                      <span className="text-gray-500">{action.duration}ms</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredActions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No activity yet. Connect an integration to get started.
              </div>
            )}
          </div>
        </>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INTEGRATION_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
            >
              <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{template.description}</p>

              {/* Platforms */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Required Platforms:</div>
                <div className="flex gap-2">
                  {template.platforms.map((platform) => {
                    const meta = getIntegrationMetadata(platform);
                    return (
                      <div
                        key={platform}
                        className="px-3 py-1 rounded text-xs"
                        style={{ backgroundColor: meta.color + '20', color: meta.color }}
                      >
                        {meta.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workflow */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-2">Workflow:</div>
                <div className="text-sm text-gray-300">
                  <div className="mb-1">
                    <span className="text-yellow-500">Trigger:</span> {template.trigger}
                  </div>
                  <div>
                    <span className="text-green-500">Actions:</span>
                    <ul className="ml-4 mt-1">
                      {template.actions.map((action, i) => (
                        <li key={i} className="text-gray-400">
                          • {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Install Button */}
              <button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                onClick={() => alert('Template installation coming soon!')}
              >
                Install Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {selectedIntegration ? 'Configure' : 'Connect'}{' '}
              {selectedPlatform || selectedIntegration?.platform}
            </h2>

            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">API Key</label>
                <input
                  type="text"
                  name="apiKey"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  placeholder="Enter API key"
                  defaultValue={selectedIntegration?.config.apiKey}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Access Token (Optional)</label>
                <input
                  type="text"
                  name="accessToken"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  placeholder="OAuth access token"
                  defaultValue={selectedIntegration?.config.oauthToken}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Sync Interval (minutes)
                </label>
                <input
                  type="number"
                  name="syncInterval"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  placeholder="60"
                  defaultValue={selectedIntegration?.config.syncInterval || 60}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoSync"
                  id="autoSync"
                  className="rounded"
                  defaultChecked={selectedIntegration?.config.autoSync ?? true}
                />
                <label htmlFor="autoSync" className="text-sm text-gray-400">
                  Enable automatic sync
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setConfigModalOpen(false);
                    setSelectedIntegration(null);
                    setSelectedPlatform(null);
                  }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >
                  {selectedIntegration ? 'Update' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
