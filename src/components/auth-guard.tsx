'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useEffect, useState } from 'react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isConnected, connect } = useNostrAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPWA, setIsPWA] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    // Detect if running as PWA
    const isPWAMode = window.matchMedia('(display-mode: standalone)').matches ||
                      (window.navigator as any).standalone === true ||
                      document.referrer.includes('android-app://')
    setIsPWA(isPWAMode)

    // Detect Android
    setIsAndroid(/Android/i.test(navigator.userAgent))

    console.log('AuthGuard: Auth state =', { isConnected, hasUser: !!user, pubkey: user?.pubkey?.slice(0, 8), isPWA: isPWAMode })
  }, [isConnected, user])

  const handleConnect = async (method: 'nip07' | 'npub_password') => {
    setError(null)
    setIsLoading(true)
    try {
      await connect(method)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected || !user) {
    console.log('AuthGuard: Showing login screen')
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="max-w-md w-full space-y-6 p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Nostr Feedz</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Connect with Nostr to access your feeds
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          
          <div className="space-y-3">
            {/* Primary button for PWA on Android - Amber with NIP-07 */}
            {isPWA && isAndroid && (
              <button
                onClick={() => handleConnect('nip07')}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg font-semibold"
              >
                {isLoading ? (
                  <span className="animate-pulse">Connecting...</span>
                ) : (
                  <>
                    <span>🔐</span>
                    <span>Connect with Amber</span>
                  </>
                )}
              </button>
            )}

            {/* Standard NIP-07 for browser extensions */}
            {(!isPWA || !isAndroid) && (
              <button
                onClick={() => handleConnect('nip07')}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-md"
              >
                {isLoading ? (
                  <span className="animate-pulse">Connecting...</span>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Connect with Browser Extension</span>
                  </>
                )}
              </button>
            )}
            
            {/* Alternative methods */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-center py-2">
                Other sign-in options
              </summary>
              <div className="mt-3 space-y-3">
                <button
                  onClick={() => handleConnect('npub_password')}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>🔑</span>
                  <span className="text-sm">Connect with Npub (Read-only)</span>
                </button>
              </div>
            </details>
          </div>

          {isPWA && isAndroid && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                <strong>Don't have Amber?</strong><br />
                Download it from{' '}
                <a 
                  href="https://github.com/greenart7c3/Amber/releases" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-600"
                >
                  GitHub
                </a>
                {' '}or{' '}
                <a 
                  href="https://play.google.com/store/apps/details?id=com.greenart7c3.amber" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-600"
                >
                  Google Play
                </a>
              </p>
            </div>
          )}
          
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-4">
            🔒 Your keys are stored locally and never sent to our servers
          </p>
        </div>
      </div>
    )
  }

  console.log('AuthGuard: User authenticated, showing protected content')
  return <>{children}</>
}