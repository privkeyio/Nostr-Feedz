'use client'

import { AuthShowcase } from '@/components/auth-showcase'
import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

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
      </div>
    </main>
  )
}