'use client'

import { useState, useEffect } from 'react'

export type MarkReadBehavior = 'on-open' | 'after-10s' | 'never'

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

const MARK_READ_OPTIONS: { value: MarkReadBehavior; title: string; description: string }[] = [
  {
    value: 'on-open',
    title: 'When I open an article',
    description: 'Articles are marked as read immediately when you open them.',
  },
  {
    value: 'after-10s',
    title: 'After 10 seconds of reading',
    description: 'Gives you a short grace period before marking items as read.',
  },
  {
    value: 'never',
    title: 'Never automatically',
    description: 'Articles stay unread until you manually mark them as read.',
  },
]

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  markReadBehavior: MarkReadBehavior
  onChangeMarkReadBehavior: (behavior: MarkReadBehavior) => void
}

export function SettingsDialog({ isOpen, onClose, markReadBehavior, onChangeMarkReadBehavior }: SettingsDialogProps) {
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nostr Relays</h3>
                <button
                  onClick={resetToDefaults}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Reset to Defaults
                </button>
              </div>
              
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Manage which Nostr relays to use for fetching content. More relays = better content discovery but slower performance.
              </p>

              {/* Add New Relay */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Add Custom Relay
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRelayUrl}
                    onChange={(e) => setNewRelayUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addRelay()}
                    placeholder="wss://relay.example.com"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <span>⚠</span>
                    {error}
                  </div>
                )}
              </div>

              {/* Popular Relays */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                        className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 transition-colors ${
                          isAdded
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900'
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Active Relays ({relays.length})
                </label>
                <div className="space-y-2">
                  {relays.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <p>No relays configured</p>
                      <p className="text-sm">Add at least one relay to fetch content</p>
                    </div>
                  ) : (
                    relays.map((relay) => (
                      <div
                        key={relay.url}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-mono text-sm text-slate-800 dark:text-slate-200">{relay.url}</div>
                        </div>
                        <button
                          onClick={() => removeRelay(relay.url)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
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

            {/* Reading Preferences */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Reading Preferences</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Choose when articles should be marked as read.
              </p>
              <div className="space-y-3">
                {MARK_READ_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      markReadBehavior === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mark-read-behavior"
                      value={option.value}
                      checked={markReadBehavior === option.value}
                      onChange={() => onChangeMarkReadBehavior(option.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{option.title}</div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Other Settings Can Go Here */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">About</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nostr Feedz - A feed reader for RSS and Nostr long-form content (NIP-23)
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                Changes to relays will be applied on next feed refresh
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-800/50">
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
