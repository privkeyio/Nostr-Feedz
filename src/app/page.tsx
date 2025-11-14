'use client'

import { AuthShowcase } from '@/components/auth-showcase'
import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

export default function HomePage() {
  const { isConnected } = useNostrAuth()
  const router = useRouter()

  useEffect(() => {
    if (isConnected) {
      router.push('/reader')
    }
  }, [isConnected, router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Nostr <span className="text-[hsl(280,100%,70%)]">Feedz</span>
        </h1>
        <p className="text-2xl text-white">
          Your RSS + Nostr Feed Reader
        </p>
        <div className="bg-purple-600/20 border border-purple-400/50 rounded-lg px-6 py-3 backdrop-blur-sm">
          <p className="text-white text-lg">
            <span className="font-bold">7-day free trial</span> · Then $1.50/month
          </p>
          <p className="text-sm text-purple-200 mt-1">
            Pay with Bitcoin or fiat
          </p>
        </div>
        <div className="max-w-2xl text-center">
          <p className="text-lg text-gray-300 mb-8">
            Subscribe to RSS feeds and Nostr long-form content (NIP-23) in one unified reader. 
            Experience the best of traditional blogging and decentralized publishing.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">📰 RSS Feeds</h3>
              <p className="text-sm text-gray-300">
                Subscribe to your favorite blogs, news sites, and traditional RSS feeds
              </p>
            </div>
            <div className="bg-white/10 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">⚡ Nostr Content</h3>
              <p className="text-sm text-gray-300">
                Follow Nostr npubs for their long-form articles and blog posts (NIP-23)
              </p>
            </div>
          </div>
        </div>
        <AuthShowcase />
        
        {/* Guide Section - More Prominent */}
        <div className="mt-8 max-w-3xl w-full">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-8 border-2 border-purple-400/50 backdrop-blur-sm">
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold text-white mb-3">
                🌟 Discover the Nostr Feedz Guide
              </h2>
              <p className="text-lg text-gray-200 mb-6">
                Explore a curated directory of long-form content creators on Nostr. Find writers, bloggers, and thinkers publishing decentralized content.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">🔍</div>
                <p className="text-gray-300">Browse by topic tags</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📖</div>
                <p className="text-gray-300">Get RSS feeds for any creator</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <p className="text-gray-300">Subscribe instantly in-app</p>
              </div>
            </div>
            
            <div className="text-center">
              <Link 
                href="/guide" 
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Explore the Guide
              </Link>
              <p className="text-sm text-gray-300 mt-3">
                Submit your own feed and help grow the Nostr ecosystem
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}