import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest } from 'next/server'
import { appRouter } from '@/server/api/root'
import { db } from '@/server/db'

const handler = (req: NextRequest) => {
  console.log('🔍 tRPC Route Handler - Request headers:', Object.fromEntries(req.headers.entries()))
  
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => {
      // Extract Nostr pubkey from request headers
      const nostrPubkey = req.headers.get('x-nostr-pubkey')
      
      console.log('🔍 tRPC createContext:', {
        hasNostrPubkey: !!nostrPubkey,
        pubkeyPreview: nostrPubkey ? nostrPubkey.slice(0, 8) + '...' : 'none',
        allHeaders: Array.from(req.headers.keys()),
      })
      
      return {
        db,
        nostrPubkey,
      }
    },
  })
}

export { handler as GET, handler as POST }