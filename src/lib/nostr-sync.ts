import { SimplePool, Event, nip19 } from 'nostr-tools'
import type { UnsignedEvent } from 'nostr-tools'

// Kind 30404 for subscription list sync
const SUBSCRIPTION_LIST_KIND = 30404

// Subscription list event structure
export interface SubscriptionList {
  rss: string[] // RSS feed URLs
  nostr: string[] // Nostr npubs for long-form content
  tags?: Record<string, string[]> // Optional: tags per feed (feedUrl -> tags)
  lastUpdated?: number // Unix timestamp
}

// Default relays for sync operations
const DEFAULT_SYNC_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
]

// Helper to get relays from localStorage or use defaults
export function getSyncRelays(): string[] {
  if (typeof window === 'undefined') return DEFAULT_SYNC_RELAYS

  const savedRelays = localStorage.getItem('nostr_relays')
  if (savedRelays) {
    try {
      const relays = JSON.parse(savedRelays)
      if (Array.isArray(relays) && relays.length > 0) {
        return relays
      }
    } catch (e) {
      console.error('Failed to parse saved relays:', e)
    }
  }
  return DEFAULT_SYNC_RELAYS
}

/**
 * Get relays for server-side sync from provided list or defaults
 */
export function getSyncRelaysFromServer(providedRelays?: string[]): string[] {
  if (providedRelays && providedRelays.length > 0) {
    return providedRelays
  }
  return DEFAULT_SYNC_RELAYS
}

// Get the user's pubkey in hex format
function getPubkeyHex(npubOrHex: string): string {
  if (npubOrHex.startsWith('npub')) {
    const decoded = nip19.decode(npubOrHex)
    if (decoded.type === 'npub') {
      return decoded.data
    }
    throw new Error('Invalid npub')
  }
  return npubOrHex
}

/**
 * Publish a subscription list to Nostr relays using kind 30404
 * This is a replaceable event (kind 30000-39999), so newer versions replace older ones
 */
export async function publishSubscriptionList(
  subscriptionList: SubscriptionList,
  signEvent: (event: UnsignedEvent) => Promise<Event>
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const pool = new SimplePool()
  const relays = getSyncRelays()

  try {
    // Create the unsigned event
    const unsignedEvent: UnsignedEvent = {
      kind: SUBSCRIPTION_LIST_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', 'nostr-feedz-subscriptions'], // d-tag for replaceable event identification
        ['client', 'nostr-feedz'],
      ],
      content: JSON.stringify({
        ...subscriptionList,
        lastUpdated: Math.floor(Date.now() / 1000),
      }),
      pubkey: '', // Will be filled by the signing process
    }

    // Sign the event using NIP-07 or provided signer
    const signedEvent = await signEvent(unsignedEvent)

    // Publish to all relays
    const publishPromises = pool.publish(relays, signedEvent)

    // Wait for at least one relay to accept (use Promise.race as fallback)
    await Promise.race(publishPromises)

    return { success: true, eventId: signedEvent.id }
  } catch (error) {
    console.error('Failed to publish subscription list:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    pool.close(relays)
  }
}

/**
 * Fetch the user's subscription list from Nostr relays
 */
export async function fetchSubscriptionList(
  userPubkey: string
): Promise<{ success: boolean; data?: SubscriptionList; eventId?: string; createdAt?: number; error?: string }> {
  const pool = new SimplePool()
  const relays = getSyncRelays()

  try {
    const pubkeyHex = getPubkeyHex(userPubkey)

    // Fetch the subscription list event
    const event = await pool.get(relays, {
      kinds: [SUBSCRIPTION_LIST_KIND],
      authors: [pubkeyHex],
      '#d': ['nostr-feedz-subscriptions'],
    })

    if (!event) {
      return {
        success: true,
        data: { rss: [], nostr: [] }, // Return empty list if none found
      }
    }

    // Parse the content
    const content = JSON.parse(event.content) as SubscriptionList

    return {
      success: true,
      data: content,
      eventId: event.id,
      createdAt: event.created_at,
    }
  } catch (error) {
    console.error('Failed to fetch subscription list:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    pool.close(relays)
  }
}

/**
 * Server-side version of fetchSubscriptionList that takes relays as an argument
 */
export async function fetchSubscriptionListFromServer(
  userPubkey: string,
  relays: string[]
): Promise<{ success: boolean; data?: SubscriptionList; eventId?: string; createdAt?: number; error?: string }> {
  const pool = new SimplePool()

  try {
    const pubkeyHex = getPubkeyHex(userPubkey)

    // Fetch the subscription list event
    const event = await pool.get(relays, {
      kinds: [SUBSCRIPTION_LIST_KIND],
      authors: [pubkeyHex],
      '#d': ['nostr-feedz-subscriptions'],
    })

    if (!event) {
      return {
        success: true,
        data: { rss: [], nostr: [] },
      }
    }

    const content = JSON.parse(event.content) as SubscriptionList

    return {
      success: true,
      data: content,
      eventId: event.id,
      createdAt: event.created_at,
    }
  } catch (error) {
    console.error('Failed to fetch subscription list from server:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  } finally {
    pool.close(relays)
  }
}

/**
 * Build a subscription list from current feeds
 */
export function buildSubscriptionListFromFeeds(
  feeds: Array<{
    type: 'RSS' | 'NOSTR' | 'NOSTR_VIDEO'
    url: string
    tags?: string[]
  }>
): SubscriptionList {
  const rss: string[] = []
  const nostr: string[] = []
  const tags: Record<string, string[]> = {}

  for (const feed of feeds) {
    if (feed.type === 'RSS') {
      rss.push(feed.url)
      if (feed.tags && feed.tags.length > 0) {
        tags[feed.url] = feed.tags
      }
    } else if (feed.type === 'NOSTR' || feed.type === 'NOSTR_VIDEO') {
      // Extract npub from URL if it's a profile URL
      const npubMatch = feed.url.match(/npub\w+/)
      if (npubMatch) {
        nostr.push(npubMatch[0])
        if (feed.tags && feed.tags.length > 0) {
          tags[npubMatch[0]] = feed.tags
        }
      } else {
        // Store the URL as-is if it's not an npub-based URL
        nostr.push(feed.url)
        if (feed.tags && feed.tags.length > 0) {
          tags[feed.url] = feed.tags
        }
      }
    }
  }

  return { rss, nostr, tags }
}

/**
 * Normalize a URL for comparison purposes
 * Handles trailing slashes, protocol, and common variations
 */
export function normalizeUrlForComparison(url: string): string {
  try {
    const urlObj = new URL(url.trim())
    // Remove trailing slash from pathname
    let pathname = urlObj.pathname.replace(/\/+$/, '')
    // Lowercase the hostname
    const hostname = urlObj.hostname.toLowerCase()
    // Sort and normalize search params
    urlObj.searchParams.sort()
    const search = urlObj.searchParams.toString()
    // Construct normalized URL without protocol
    return `${hostname}${pathname}${search ? '?' + search : ''}`
  } catch {
    // If URL parsing fails, just lowercase and trim
    return url.toLowerCase().trim().replace(/\/+$/, '')
  }
}

/**
 * Normalize an npub for comparison
 */
export function normalizeNpub(value: string): string {
  // Try to extract npub from the value (might be a URL or just npub)
  const match = value.match(/npub1[a-zA-Z0-9]+/)
  if (match) {
    return match[0].toLowerCase()
  }
  return value.toLowerCase().trim()
}

/**
 * Merge remote subscription list with local feeds
 * Returns lists of feeds to add and remove
 */
export function mergeSubscriptionLists(
  localFeeds: Array<{ type: 'RSS' | 'NOSTR' | 'NOSTR_VIDEO'; url: string; tags?: string[] }>,
  remoteList: SubscriptionList
): {
  toAdd: Array<{ type: 'RSS' | 'NOSTR'; url: string; tags?: string[] }>
  localOnly: Array<{ type: 'RSS' | 'NOSTR' | 'NOSTR_VIDEO'; url: string }>
} {
  // Normalize RSS URLs for comparison
  const localRssUrls = new Set(
    localFeeds
      .filter(f => f.type === 'RSS' && f.url)
      .map(f => normalizeUrlForComparison(f.url))
  )

  // For Nostr feeds, extract and normalize npubs
  const localNpubs = new Set(
    localFeeds
      .filter(f => f.type === 'NOSTR' || f.type === 'NOSTR_VIDEO')
      .filter(f => f.url) // Filter out empty URLs
      .map(f => normalizeNpub(f.url))
  )

  const toAdd: Array<{ type: 'RSS' | 'NOSTR'; url: string; tags?: string[] }> = []

  // Check RSS feeds
  for (const rssUrl of remoteList.rss) {
    const normalizedRemoteUrl = normalizeUrlForComparison(rssUrl)
    const exists = localRssUrls.has(normalizedRemoteUrl)

    if (!exists) {
      toAdd.push({
        type: 'RSS',
        url: rssUrl,
        tags: remoteList.tags?.[rssUrl],
      })
    }
  }

  // Check Nostr feeds
  for (const npub of remoteList.nostr) {
    const normalizedRemoteNpub = normalizeNpub(npub)
    const exists = localNpubs.has(normalizedRemoteNpub)

    if (!exists) {
      toAdd.push({
        type: 'NOSTR',
        url: npub,
        tags: remoteList.tags?.[npub],
      })
    }
  }

  // Find local-only feeds (not in remote)
  const remoteRssNormalized = new Set(remoteList.rss.map(u => normalizeUrlForComparison(u)))
  const remoteNpubsNormalized = new Set(remoteList.nostr.map(n => normalizeNpub(n)))

  const localOnly = localFeeds.filter(f => {
    if (!f.url) return true // Keep local feeds with no URL

    if (f.type === 'RSS') {
      return !remoteRssNormalized.has(normalizeUrlForComparison(f.url))
    } else {
      return !remoteNpubsNormalized.has(normalizeNpub(f.url))
    }
  })

  return { toAdd, localOnly }
}

/**
 * Get the last sync timestamp from localStorage
 */
export function getLastSyncTime(): number | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('nostr_feedz_last_sync')
  return stored ? parseInt(stored, 10) : null
}

/**
 * Save the last sync timestamp to localStorage
 */
export function setLastSyncTime(timestamp: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nostr_feedz_last_sync', timestamp.toString())
  }
}
