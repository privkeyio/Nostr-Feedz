'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, loggerLink } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { useState, useEffect, useRef } from 'react'
import superjson from 'superjson'
import { type AppRouter } from '@/server/api/root'
import { useNostrAuth } from '@/contexts/NostrAuthContext'

export const api = createTRPCReact<AppRouter>()

// Store pubkey in a ref that can be accessed by headers function
let currentPubkey: string | null = null

export function TRPCReactProvider(props: {
  children: React.ReactNode
  cookies?: string
}) {
  const { user } = useNostrAuth()
  
  console.log('🔵 TRPCReactProvider render, user:', user ? `${user.pubkey?.slice(0, 8)}...` : 'null')
  
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }))

  // Update the current pubkey ref whenever user changes
  useEffect(() => {
    console.log('🔄 tRPC: User changed, new pubkey:', user?.pubkey ? user.pubkey.slice(0, 8) + '...' : 'none')
    currentPubkey = user?.pubkey || null
  }, [user])

  // Create tRPC client once with a headers function that reads from currentPubkey
  const [trpcClient] = useState(() => {
    console.log('🚀 tRPC: Creating client')
    return api.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: () => true,
        }),
        httpBatchLink({
          url: '/api/trpc',
          async headers() {
            const headers: Record<string, string> = {}
            
            console.log('📤 tRPC: Generating headers, currentPubkey:', currentPubkey ? currentPubkey.slice(0, 8) + '...' : 'none')
            
            if (currentPubkey) {
              headers['x-nostr-pubkey'] = currentPubkey
              console.log('✅ tRPC: Added x-nostr-pubkey header')
            } else {
              console.log('⚠️ tRPC: No pubkey available for headers')
            }
            
            if (props.cookies) {
              headers.cookie = props.cookies
            }
            
            console.log('📋 tRPC: Final headers:', Object.keys(headers))
            console.log('📋 tRPC: Full headers object:', headers)
            return headers
          },
        }),
      ],
    })
  })

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  )
}