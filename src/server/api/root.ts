import { createTRPCRouter } from '@/server/api/trpc'
import { postRouter } from '@/server/api/routers/post'
import { feedRouter } from '@/server/api/routers/feed'

export const appRouter = createTRPCRouter({
  post: postRouter,
  feed: feedRouter,
})

export type AppRouter = typeof appRouter