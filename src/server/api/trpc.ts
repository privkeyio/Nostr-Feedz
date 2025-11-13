import { initTRPC } from '@trpc/server'
import { type CreateNextContextOptions } from '@trpc/server/adapters/next'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { db } from '@/server/db'

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req } = opts
  
  // Extract Nostr pubkey from headers (set by client)
  const nostrPubkey = req.headers['x-nostr-pubkey'] as string | undefined
  
  console.log('tRPC Server Context:', {
    hasNostrPubkey: !!nostrPubkey,
    pubkeyPreview: nostrPubkey ? nostrPubkey.slice(0, 8) + '...' : 'none',
    headers: Object.keys(req.headers),
  })
  
  return {
    db,
    nostrPubkey, // Nostr public key for authenticated requests
  }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

const enforceNostrAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.nostrPubkey) {
    throw new Error('UNAUTHORIZED - Nostr authentication required')
  }
  return next({
    ctx: {
      nostrPubkey: ctx.nostrPubkey,
      db: ctx.db,
    },
  })
})

export const protectedProcedure = t.procedure.use(enforceNostrAuth)