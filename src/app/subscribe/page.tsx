'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { api } from '@/trpc/react'
import Link from 'next/link'

function SubscribeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isConnected, connect } = useNostrAuth()
  
  const npub = searchParams.get('npub')
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const returnUrl = searchParams.get('return')
  
  const [status, setStatus] = useState<'loading' | 'ready' | 'subscribing' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Fetch feed info from guide
  const { data: guideFeed, isLoading: feedLoading } = api.guide.getGuideFeed.useQuery(
    { npub: npub || '' },
    { enabled: !!npub }
  )
  
  const subscribeMutation = api.feed.subscribeFeed.useMutation()
  const incrementSubscriberMutation = api.guide.incrementSubscriberCount.useMutation()
  
  useEffect(() => {
    if (!npub) {
      setStatus('error')
      setErrorMessage('Missing npub parameter')
      return
    }
    
    if (!feedLoading) {
      setStatus('ready')
    }
  }, [npub, feedLoading])
  
  const handleSubscribe = async () => {
    if (!npub) return
    
    // If not connected, prompt to connect via NIP-07
    if (!isConnected) {
      try {
        await connect('nip07')
      } catch (error) {
        setStatus('error')
        setErrorMessage('Please install a Nostr browser extension (like Alby) to subscribe')
        return
      }
    }
    
    setStatus('subscribing')
    
    try {
      await subscribeMutation.mutateAsync({
        type: 'NOSTR',
        npub,
        title: guideFeed?.displayName,
        tags: tags.length > 0 ? tags : (guideFeed?.tags || []),
      })
      
      // Increment subscriber count
      if (guideFeed) {
        await incrementSubscriberMutation.mutateAsync({ npub })
      }
      
      setStatus('success')
      
      // Redirect after success
      setTimeout(() => {
        if (returnUrl) {
          window.location.href = returnUrl
        } else {
          router.push('/reader')
        }
      }, 2000)
      
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message || 'Failed to subscribe')
    }
  }
  
  // Auto-subscribe if user is already connected
  useEffect(() => {
    if (isConnected && status === 'ready' && npub) {
      // Small delay to let UI render
      const timer = setTimeout(() => {
        handleSubscribe()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isConnected, status, npub])
  
  if (!npub) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invalid Link</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This subscription link is missing the npub parameter.
          </p>
          <Link
            href="/guide"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Browse the Guide
          </Link>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📡</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Subscribe to Feed
          </h1>
        </div>
        
        {/* Feed Info */}
        {feedLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : guideFeed ? (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-4">
              {guideFeed.picture ? (
                <img 
                  src={guideFeed.picture} 
                  alt={guideFeed.displayName}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                  {guideFeed.displayName}
                </h2>
                {guideFeed.about && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {guideFeed.about}
                  </p>
                )}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {guideFeed.tags.slice(0, 4).map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>📝 {guideFeed.postCount} posts</span>
              <span>👥 {guideFeed.subscriberCount} subscribers</span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <p className="text-slate-600 dark:text-slate-400 text-center">
              <span className="font-mono text-sm break-all">{npub}</span>
            </p>
          </div>
        )}
        
        {/* Status Messages */}
        {status === 'subscribing' && (
          <div className="flex items-center justify-center gap-3 py-4 text-purple-600 dark:text-purple-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
            <span>Subscribing...</span>
          </div>
        )}
        
        {status === 'success' && (
          <div className="text-center py-4">
            <div className="text-green-500 text-4xl mb-2">✓</div>
            <p className="text-green-600 dark:text-green-400 font-medium">
              Successfully subscribed!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Redirecting to reader...
            </p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-4xl mb-2">⚠️</div>
            <p className="text-red-600 dark:text-red-400 font-medium">
              {errorMessage}
            </p>
          </div>
        )}
        
        {/* Action Buttons */}
        {(status === 'ready' || status === 'loading') && !isConnected && (
          <div className="space-y-3">
            <button
              onClick={handleSubscribe}
              disabled={status === 'loading'}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
            >
              {status === 'loading' ? 'Loading...' : 'Connect & Subscribe'}
            </button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              Requires a Nostr browser extension (Alby, nos2x, etc.)
            </p>
          </div>
        )}
        
        {status === 'ready' && isConnected && (
          <div className="text-center py-2 text-slate-600 dark:text-slate-400">
            <div className="animate-pulse">Subscribing automatically...</div>
          </div>
        )}
        
        {/* Footer Links */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-center gap-4 text-sm">
          <Link
            href="/guide"
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            Browse Guide
          </Link>
          <Link
            href="/reader"
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            Go to Reader
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    }>
      <SubscribeContent />
    </Suspense>
  )
}
