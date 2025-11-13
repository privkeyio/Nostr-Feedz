import { createTRPCRouter } from '@/server/api/trpc'
import { feedRouter } from '@/server/api/routers/feed'

export const appRouter = createTRPCRouter({
  feed: feedRouter,
})

export type AppRouter = typeof appRouter