'use client'

import { api } from '@/trpc/react'
import { useRouter } from 'next/navigation'

interface SubscriptionGateProps {
  children: React.ReactNode
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const router = useRouter()
  const { data: subscription, isLoading } = api.subscription.getStatus.useQuery()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Checking subscription...</p>
        </div>
      </div>
    )
  }

  if (!subscription?.hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {subscription?.status === 'EXPIRED' ? 'Trial Expired' : 'Subscription Required'}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {subscription?.status === 'EXPIRED' 
                ? 'Your free trial has ended. Subscribe to continue using Nostr Feedz Reader.'
                : 'Subscribe to access the Nostr Feedz Reader'}
            </p>
          </div>

          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-6 mb-6 border border-purple-300 dark:border-purple-700">
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                $1.50<span className="text-2xl text-slate-600 dark:text-slate-400">/month</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">Unlimited RSS and Nostr feeds</p>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-1 font-medium">
                Pay with Bitcoin ₿ or fiat 💳
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-center text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Unlimited feed subscriptions
              </li>
              <li className="flex items-center text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                RSS and Nostr (NIP-23) support
              </li>
              <li className="flex items-center text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Tag organization
              </li>
              <li className="flex items-center text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Read/unread tracking
              </li>
              <li className="flex items-center text-slate-700 dark:text-slate-300">
                <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Cancel anytime
              </li>
            </ul>

            <button
              onClick={() => window.location.href = process.env.NEXT_PUBLIC_SQUARE_PAYMENT_LINK || '#'}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors shadow-lg"
            >
              Subscribe Now
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              The Guide and RSS feed generation are always free!
            </p>
            <button
              onClick={() => router.push('/')}
              className="text-purple-600 dark:text-purple-400 hover:underline"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show trial/subscription info banner if in trial or near expiry
  const showBanner = subscription.status === 'TRIAL' || 
                     (subscription.status === 'ACTIVE' && subscription.daysRemaining < 7)

  return (
    <>
      {showBanner && (
        <div className="bg-purple-600 text-white px-4 py-2 text-center text-sm">
          {subscription.status === 'TRIAL' ? (
            <>
              Trial: {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? 's' : ''} remaining. 
              <button
                onClick={() => window.location.href = process.env.NEXT_PUBLIC_SQUARE_PAYMENT_LINK || '#'}
                className="ml-2 underline font-semibold hover:text-purple-200"
              >
                Subscribe for $1.50/month (Bitcoin ₿ or fiat 💳)
              </button>
            </>
          ) : (
            <>
              Subscription ends in {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? 's' : ''}.
            </>
          )}
        </div>
      )}
      {children}
    </>
  )
}
