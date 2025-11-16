import { z } from 'zod'
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc'
import jwt from 'jsonwebtoken'
import { nip19 } from 'nostr-tools'

const TRIAL_DAYS = 7
const MONTHLY_PRICE_SATS = 1750

// Flash webhook event types
const FlashEventType = z.object({
  id: z.string(),
  name: z.enum([
    'user_signed_up',
    'renewal_successful', 
    'renewal_failed',
    'user_paused_subscription',
    'user_cancelled_subscription'
  ])
})

const FlashWebhookPayload = z.object({
  eventType: FlashEventType,
  data: z.object({
    public_key: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    npub: z.string().optional(),
    external_uuid: z.string().optional(),
  })
})

export const subscriptionRouter = createTRPCRouter({
  // Get current user's subscription status
  // Make this public so anonymous visitors don't get blocked by auth errors
  getStatus: publicProcedure
    .query(async ({ ctx }) => {
      // Check if user has a paid subscription
      if (ctx.nostrPubkey) {
        const subscription = await ctx.db.userSubscription.findUnique({
          where: { userPubkey: ctx.nostrPubkey },
        })

        if (subscription) {
          const now = new Date()
          const endsAt = subscription.subscriptionEndsAt ?? subscription.trialEndsAt
          const daysRemaining = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

          return {
            userPubkey: ctx.nostrPubkey,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            subscriptionEndsAt: subscription.subscriptionEndsAt,
            daysRemaining,
            hasAccess: ['TRIAL', 'ACTIVE'].includes(subscription.status) && endsAt > now,
            price: MONTHLY_PRICE_SATS,
          }
        }
      }

      // No paid subscription - give 7 day trial
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      return {
        userPubkey: ctx.nostrPubkey ?? null,
        status: 'TRIAL' as const,
        trialEndsAt,
        daysRemaining: 7,
        hasAccess: true,
        price: MONTHLY_PRICE_SATS,
      }
    }),

  // Create Flash checkout session
  createCheckoutSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Return the Flash checkout URL from environment variable
      const flashCheckoutUrl = process.env.NEXT_PUBLIC_FLASH_CHECKOUT_URL || '#'
      
      // Pre-fill user data using Base64-encoded JSON params
      const npub = ctx.nostrPubkey
      if (npub) {
        // Convert npub to hex format (Flash expects hex, not npub)
        const decoded = nip19.decode(npub)
        const hexPubkey = decoded.type === 'npub' ? decoded.data : npub
        
        const params = {
          npub: hexPubkey, // Use hex format instead of npub
          external_uuid: npub, // Keep npub for our mapping
          is_verified: true, // Skip verification since they're already logged in with Nostr
        }
        const base64Params = Buffer.from(JSON.stringify(params)).toString('base64')
        // URL encode the base64 string to handle special characters
        const encodedParams = encodeURIComponent(base64Params)
        return {
          checkoutUrl: `${flashCheckoutUrl}&params=${encodedParams}`,
        }
      }
      
      return {
        checkoutUrl: flashCheckoutUrl,
      }
    }),

  // Webhook to handle Flash payment events
  // This should be called by Flash webhooks
  handleFlashWebhook: publicProcedure
    .input(z.object({
      token: z.string(), // JWT token from Authorization header
      payload: FlashWebhookPayload,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify JWT token
      const subscriptionKey = process.env.FLASH_SUBSCRIPTION_KEY
      if (!subscriptionKey) {
        throw new Error('FLASH_SUBSCRIPTION_KEY not configured')
      }

      try {
        // Verify and decode the JWT token
        const decoded = jwt.verify(input.token, subscriptionKey, { algorithms: ['HS256'] })
        
        if (typeof decoded === 'string') {
          throw new Error('Invalid token format')
        }

        const tokenData = decoded as unknown as {
          version: string
          eventType: { id: string; name: string }
          user_public_key: string
          exp: string
        }

        // Extract user public key (this is the Nostr pubkey or external_uuid)
        const userPubkey = input.payload.data.npub || input.payload.data.external_uuid || tokenData.user_public_key

        if (!userPubkey) {
          throw new Error('No user identifier found in webhook')
        }

        // Handle different event types
        const eventName = input.payload.eventType.name

        switch (eventName) {
          case 'user_signed_up':
            // Create or update subscription to ACTIVE
            await ctx.db.userSubscription.upsert({
              where: { userPubkey },
              create: {
                userPubkey,
                status: 'ACTIVE',
                trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
                subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              },
              update: {
                status: 'ACTIVE',
                subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                cancelledAt: null,
              },
            })
            break

          case 'renewal_successful':
            // Extend subscription by 30 days
            await ctx.db.userSubscription.update({
              where: { userPubkey },
              data: {
                status: 'ACTIVE',
                subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
            break

          case 'renewal_failed':
            // Mark as PAST_DUE
            await ctx.db.userSubscription.update({
              where: { userPubkey },
              data: {
                status: 'PAST_DUE',
              },
            })
            break

          case 'user_paused_subscription':
          case 'user_cancelled_subscription':
            // Mark as cancelled but keep until end date
            await ctx.db.userSubscription.update({
              where: { userPubkey },
              data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
              },
            })
            break
        }

        return { success: true }
      } catch (error) {
        console.error('Flash webhook verification failed:', error)
        throw new Error('Invalid webhook signature')
      }
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      const subscription = await ctx.db.userSubscription.findUnique({
        where: { userPubkey: ctx.nostrPubkey },
      })

      if (!subscription || subscription.status !== 'ACTIVE') {
        throw new Error('No active subscription to cancel')
      }

      // TODO: Cancel in Square
      
      await ctx.db.userSubscription.update({
        where: { userPubkey: ctx.nostrPubkey },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })

      return { success: true }
    }),
})
