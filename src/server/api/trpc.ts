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

/**
 * Global middleware to sanitize inputs and prevent deserialization quirks
 * Removes 'undefined' strings, null values, and empty strings from arrays
 */
const inputSanitizer = t.middleware(({ next, rawInput }) => {
  const sanitizeValue = (value: any): any => {
    // Handle arrays - filter out invalid values
    if (Array.isArray(value)) {
      return value
        .filter(item => item !== null && item !== undefined && item !== '' && item !== 'undefined')
        .map(sanitizeValue)
    }
    
    // Handle objects - recursively sanitize
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sanitized: any = {}
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val)
      }
      return sanitized
    }
    
    // Return primitive values as-is
    return value
  }

  const sanitizedInput = sanitizeValue(rawInput)
  
  // Log if sanitization changed anything (for debugging)
  if (JSON.stringify(rawInput) !== JSON.stringify(sanitizedInput)) {
    console.log('🧹 Input sanitized:', {
      before: JSON.stringify(rawInput),
      after: JSON.stringify(sanitizedInput),
    })
  }
  
  return next({
    rawInput: sanitizedInput,
  })
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure.use(inputSanitizer)

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

export const protectedProcedure = t.procedure.use(inputSanitizer).use(enforceNostrAuth)