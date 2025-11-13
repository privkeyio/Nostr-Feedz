'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useState } from 'react'

export function AuthShowcase() {
  const { isConnected, user, authMethod, connect, disconnect } = useNostrAuth()
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'nip07' | 'npub_password' | 'bunker' | null>(null)
  const [npub, setNpub] = useState('')
  const [password, setPassword] = useState('')
  const [bunkerUrl, setBunkerUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    if (!loginMethod) return
    
    setLoading(true)
    setError('')
    
    try {
      if (loginMethod === 'nip07') {
        await connect('nip07')
      } else if (loginMethod === 'npub_password') {
        await connect('npub_password', { npub, password })
      } else if (loginMethod === 'bunker') {
        await connect('bunker', { bunkerUrl })
      }
      setShowLoginForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  if (isConnected && user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-2xl text-white mb-2">
            ⚡ Connected to Nostr
          </p>
          <p className="text-sm text-gray-300">
            Method: {authMethod === 'nip07' ? 'Browser Extension' : 
                    authMethod === 'npub_password' ? 'npub + Password (Read-only)' : 
                    'Bunker Signer'}
          </p>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Your npub:</p>
            <p className="text-sm text-green-400 font-mono break-all">
              {user.npub}
            </p>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="rounded-full bg-red-600/20 px-6 py-2 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition"
        >
          Disconnect
        </button>
      </div>
    )
  }

  if (!showLoginForm) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <p className="text-center text-2xl text-white">
          🔐 Connect to Nostr
        </p>
        <p className="text-center text-sm text-gray-300 max-w-md">
          Choose your preferred way to connect to the Nostr network
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => {
              setLoginMethod('nip07')
              setShowLoginForm(true)
            }}
            className="rounded-lg bg-purple-600/20 px-6 py-3 font-semibold text-purple-400 hover:bg-purple-600/30 transition"
          >
            🔌 Browser Extension (NIP-07)
          </button>
          
          <button
            onClick={() => {
              setLoginMethod('npub_password')
              setShowLoginForm(true)
            }}
            className="rounded-lg bg-blue-600/20 px-6 py-3 font-semibold text-blue-400 hover:bg-blue-600/30 transition"
          >
            👤 npub + Password
          </button>
          
          <button
            onClick={() => {
              setLoginMethod('bunker')
              setShowLoginForm(true)
            }}
            className="rounded-lg bg-green-600/20 px-6 py-3 font-semibold text-green-400 hover:bg-green-600/30 transition"
          >
            🏛️ Bunker Signer (NIP-46)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-md">
      <p className="text-center text-2xl text-white mb-4">
        {loginMethod === 'nip07' ? '🔌 Browser Extension' :
         loginMethod === 'npub_password' ? '👤 npub + Password' :
         '🏛️ Bunker Signer'}
      </p>

      {error && (
        <div className="w-full p-3 bg-red-600/20 border border-red-600/30 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loginMethod === 'nip07' && (
        <div className="w-full p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-300 text-sm mb-4">
            This will connect using your Nostr browser extension (like Alby, nos2x, or Flamingo).
          </p>
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {loading ? 'Connecting...' : 'Connect Extension'}
          </button>
        </div>
      )}

      {loginMethod === 'npub_password' && (
        <div className="w-full p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-300 text-sm mb-4">
            Enter your npub and a password. This provides read-only access (you can&apos;t post or sign events).
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Your npub
              </label>
              <input
                type="text"
                value={npub}
                onChange={(e) => setNpub(e.target.value)}
                placeholder="npub1..."
                className="w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={loading || !npub || !password}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {loginMethod === 'bunker' && (
        <div className="w-full p-4 bg-gray-800/50 rounded-lg">
          <p className="text-gray-300 text-sm mb-4">
            Connect to a remote bunker signer (NIP-46) for secure key management.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Bunker URL
              </label>
              <input
                type="text"
                value={bunkerUrl}
                onChange={(e) => setBunkerUrl(e.target.value)}
                placeholder="wss://..."
                className="w-full rounded-md bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={loading || !bunkerUrl}
              className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition"
            >
              {loading ? 'Connecting...' : 'Connect Bunker'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          setShowLoginForm(false)
          setError('')
        }}
        className="text-gray-400 hover:text-gray-300 transition"
      >
        ← Back to options
      </button>
    </div>
  )
}