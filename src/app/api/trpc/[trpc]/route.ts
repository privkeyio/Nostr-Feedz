import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { type NextRequest } from 'next/server'
import { appRouter } from '@/server/api/root'
import { db } from '@/server/db'

const handler = (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => {
      const nostrPubkey = req.headers.get('x-nostr-pubkey') || undefined
      return {
        db,
        nostrPubkey,
      }
    },
  })
}

export { handler as GET, handler as POST }