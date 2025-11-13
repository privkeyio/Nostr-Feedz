import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/api/trpc'

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text} from Nostr!`,
      }
    }),

  create: protectedProcedure
    .input(z.object({ content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Create a post with Nostr pubkey as author
      return ctx.db.post.create({
        data: {
          content: input.content,
          authorId: ctx.nostrPubkey,
        },
      })
    }),

  getByAuthor: publicProcedure
    .input(z.object({ pubkey: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.post.findMany({
        where: {
          authorId: input.pubkey,
        },
        orderBy: { createdAt: 'desc' },
      })
    }),

  getLatest: publicProcedure.query(({ ctx }) => {
    return ctx.db.post.findFirst({
      orderBy: { createdAt: 'desc' },
    })
  }),

  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 most recent posts
    })
  }),

  getUserPosts: protectedProcedure.query(({ ctx }) => {
    return ctx.db.post.findMany({
      where: {
        authorId: ctx.nostrPubkey,
      },
      orderBy: { createdAt: 'desc' },
    })
  }),
})