'use client'

import { useState, useEffect } from 'react'

interface Relay {
  url: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
]

const POPULAR_RELAYS = [
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://nos.lol', name: 'nos.lol' },
  { url: 'wss://relay.snort.social', name: 'Snort' },
  { url: 'wss://relay.nostr.band', name: 'Nostr Band' },
  { url: 'wss://nostr-pub.wellorder.net', name: 'Wellorder' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.nostr.bg', name: 'Nostr BG' },
  { url: 'wss://nostr.wine', name: 'Nostr Wine' },
  { url: 'wss://purplepag.es', name: 'Purple Pages' },
]

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [relays, setRelays] = useState<Relay[]>([])
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [error, setError] = useState('')

  // Load relays from localStorage on mount
  useEffect(() => {
    const savedRelays = localStorage.getItem('nostr_relays')
    if (savedRelays) {
      try {
        const urls = JSON.parse(savedRelays)
        setRelays(urls.map((url: string) => ({ url, status: 'disconnected' as const })))
      } catch (e) {
        // Use defaults if parsing fails
        setRelays(DEFAULT_RELAYS.map(url => ({ url, status: 'disconnected' as const })))
      }
    } else {
      setRelays(DEFAULT_RELAYS.map(url => ({ url, status: 'disconnected' as const })))
    }
  }, [])

  // Save relays to localStorage whenever they change
  useEffect(() => {
    if (relays.length > 0) {
      localStorage.setItem('nostr_relays', JSON.stringify(relays.map(r => r.url)))
    }
  }, [relays])

  const validateRelayUrl = (url: string): boolean => {
    if (!url.trim()) {
      setError('Relay URL cannot be empty')
      return false
    }
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      setError('Relay URL must start with wss:// or ws://')
      return false
    }
    if (relays.some(r => r.url === url)) {
      setError('This relay is already added')
      return false
    }
    setError('')
    return true
  }

  const addRelay = () => {
    if (!validateRelayUrl(newRelayUrl)) return

    setRelays([...relays, { url: newRelayUrl, status: 'disconnected' }])
    setNewRelayUrl('')
  }

  const addPopularRelay = (url: string) => {
    if (relays.some(r => r.url === url)) {
      setError('This relay is already added')
      return
    }
    setRelays([...relays, { url, status: 'disconnected' }])
  }

  const removeRelay = (url: string) => {
    setRelays(relays.filter(r => r.url !== url))
  }

  const resetToDefaults = () => {
    if (confirm('Reset to default relays? This will remove all custom relays.')) {
      setRelays(DEFAULT_RELAYS.map(url => ({ url, status: 'disconnected' })))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Relays Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Nostr Relays</h3>
                <button
                  onClick={resetToDefaults}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Reset to Defaults
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Manage which Nostr relays to use for fetching content. More relays = better content discovery but slower performance.
              </p>

              {/* Add New Relay */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Custom Relay
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRelayUrl}
                    onChange={(e) => setNewRelayUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRelay()}
                    placeholder="wss://relay.example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addRelay}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <span>+</span>
                    Add
                  </button>
                </div>
                {error && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                    <span>⚠</span>
                    {error}
                  </div>
                )}
              </div>

              {/* Popular Relays */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Popular Relays
                </label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_RELAYS.map((relay) => {
                    const isAdded = relays.some(r => r.url === relay.url)
                    return (
                      <button
                        key={relay.url}
                        onClick={() => !isAdded && addPopularRelay(relay.url)}
                        disabled={isAdded}
                        className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                          isAdded
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {isAdded && <span>✓</span>}
                        {relay.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Current Relays List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Active Relays ({relays.length})
                </label>
                <div className="space-y-2">
                  {relays.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No relays configured</p>
                      <p className="text-sm">Add at least one relay to fetch content</p>
                    </div>
                  ) : (
                    relays.map((relay) => (
                      <div
                        key={relay.url}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-mono text-sm">{relay.url}</div>
                        </div>
                        <button
                          onClick={() => removeRelay(relay.url)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove relay"
                        >
                          <span>🗑️</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Other Settings Can Go Here */}
            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-2">About</h3>
              <p className="text-sm text-gray-600">
                Nostr Feedz - A feed reader for RSS and Nostr long-form content (NIP-23)
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Changes to relays will be applied on next feed refresh
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
