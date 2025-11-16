import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import * as jwt from 'jsonwebtoken'

// Flash webhook event types
type FlashEventType = {
  id: string
  name: 'user_signed_up' | 'renewal_successful' | 'renewal_failed' | 'user_paused_subscription' | 'user_cancelled_subscription'
}

type FlashWebhookPayload = {
  eventType: FlashEventType
  data: {
    public_key?: string
    name?: string
    email?: string
    npub?: string
    external_uuid?: string
  }
}

const TRIAL_DAYS = 7

export async function POST(request: NextRequest) {
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.split(' ')[1]

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    // Get subscription key from environment
    const subscriptionKey = process.env.FLASH_SUBSCRIPTION_KEY
    if (!subscriptionKey) {
      console.error('FLASH_SUBSCRIPTION_KEY not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Verify and decode JWT
    let decoded: any
    try {
      decoded = jwt.verify(token, subscriptionKey, { algorithms: ['HS256'] })
    } catch (error) {
      console.error('JWT verification failed:', error)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get payload
    const payload: FlashWebhookPayload = await request.json()

    // Extract user identifier
    const userPubkey = payload.data.npub || payload.data.external_uuid || decoded.user_public_key

    if (!userPubkey) {
      console.error('No user identifier found in webhook')
      return NextResponse.json({ error: 'No user identifier' }, { status: 400 })
    }

    console.log('Flash webhook received:', {
      event: payload.eventType.name,
      userPubkey: userPubkey.substring(0, 10) + '...',
    })

    // Handle different event types
    switch (payload.eventType.name) {
      case 'user_signed_up':
        // Create or update subscription to ACTIVE
        await db.userSubscription.upsert({
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
        console.log('User subscription activated:', userPubkey.substring(0, 10) + '...')
        break

      case 'renewal_successful':
        // Extend subscription by 30 days
        await db.userSubscription.update({
          where: { userPubkey },
          data: {
            status: 'ACTIVE',
            subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        })
        console.log('Subscription renewed:', userPubkey.substring(0, 10) + '...')
        break

      case 'renewal_failed':
        // Mark as PAST_DUE
        await db.userSubscription.update({
          where: { userPubkey },
          data: {
            status: 'PAST_DUE',
          },
        })
        console.log('Renewal failed:', userPubkey.substring(0, 10) + '...')
        break

      case 'user_paused_subscription':
      case 'user_cancelled_subscription':
        // Mark as cancelled but keep until end date
        await db.userSubscription.update({
          where: { userPubkey },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        })
        console.log('Subscription cancelled:', userPubkey.substring(0, 10) + '...')
        break
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Flash webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
