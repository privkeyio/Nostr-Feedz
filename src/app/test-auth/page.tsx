'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useEffect } from 'react'

export default function TestAuthPage() {
  const { user, isConnected, connect, disconnect } = useNostrAuth()

  useEffect(() => {
    console.log('TestAuthPage: Current auth state:', {
      isConnected,
      hasUser: !!user,
      pubkey: user?.pubkey,
      npub: user?.npub,
    })
  }, [isConnected, user])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Authentication Test Page</h1>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="font-semibold mb-2">Current State:</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Connected: {isConnected ? '✅ Yes' : '❌ No'}</li>
              <li>Has User: {user ? '✅ Yes' : '❌ No'}</li>
              {user && (
                <>
                  <li>Pubkey: <code className="text-xs bg-gray-100 px-1">{user.pubkey}</code></li>
                  <li>Npub: <code className="text-xs bg-gray-100 px-1">{user.npub}</code></li>
                </>
              )}
            </ul>
          </div>

          <div className="border-b pb-4">
            <h2 className="font-semibold mb-2">LocalStorage:</h2>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {typeof window !== 'undefined' ? localStorage.getItem('nostr_session') || 'No session found' : 'Loading...'}
            </pre>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">Actions:</h2>
            {!isConnected ? (
              <>
                <button
                  onClick={() => connect('nip07')}
                  className="block w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Connect with Browser Extension (NIP-07)
                </button>
                <button
                  onClick={() => {
                    const npub = prompt('Enter your npub:')
                    const password = prompt('Enter password:')
                    if (npub && password) {
                      connect('npub_password', { npub, password })
                    }
                  }}
                  className="block w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Connect with Npub + Password
                </button>
              </>
            ) : (
              <button
                onClick={disconnect}
                className="block w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Disconnect
              </button>
            )}
          </div>

          <div className="pt-4 border-t">
            <a href="/reader" className="text-blue-600 hover:underline">
              → Go to Feed Reader
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
