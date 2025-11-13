import { z } from 'zod'

const server = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DEFAULT_RELAYS: z.string().optional(),
  NOSTR_BUNKER_URL: z.string().optional(),
})

const client = z.object({
  // No client-side env vars needed for now
})

const processEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  DEFAULT_RELAYS: process.env.DEFAULT_RELAYS,
  NOSTR_BUNKER_URL: process.env.NOSTR_BUNKER_URL,
}

const merged = server.merge(client)

let env = {} as z.infer<typeof merged>

if (!!process.env.SKIP_ENV_VALIDATION === false) {
  const isServer = typeof window === 'undefined'

  const parsed = isServer
    ? merged.safeParse(processEnv)
    : client.safeParse(processEnv)

  if (parsed.success === false) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    )
    throw new Error('Invalid environment variables')
  }

  env = new Proxy(parsed.data, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      if (!isServer && !prop.startsWith('NEXT_PUBLIC_'))
        throw new Error(
          process.env.NODE_ENV === 'production'
            ? '❌ Attempted to access a server-side environment variable on the client'
            : `❌ Attempted to access server-side environment variable '${prop}' on the client`
        )
      return target[prop as keyof typeof target]
    },
  })
}

export { env }