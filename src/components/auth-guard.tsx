'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useEffect } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isConnected, connect } = useNostrAuth()

  useEffect(() => {
    console.log('AuthGuard: Auth state =', { isConnected, hasUser: !!user, pubkey: user?.pubkey?.slice(0, 8) })
  }, [isConnected, user])

  if (!isConnected || !user) {
    console.log('AuthGuard: Showing login screen')
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Nostr Feedz</h2>
            <p className="mt-2 text-gray-600">
              Connect with Nostr to access your feeds
            </p>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => connect('nip07')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              Connect with Browser Extension
            </button>
            
            <button
              onClick={() => connect('npub_password')}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>🔑</span>
              Connect with Npub + Password
            </button>
            
            <button
              onClick={() => connect('bunker')}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <span>🔗</span>
              Connect with Nostr Connect (Bunker)
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Your keys are stored locally and never sent to our servers
          </p>
        </div>
      </div>
    )
  }

  console.log('AuthGuard: User authenticated, showing protected content')
  return <>{children}</>
}