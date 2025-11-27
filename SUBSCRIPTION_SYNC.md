# Nostr Feedz Subscription Sync

## Overview

Nostr Feedz uses **Nostr events** to sync RSS and Nostr long-form content subscriptions across devices. This enables users to maintain a single subscription list that works on mobile, desktop, and web - all tied to their Nostr identity.

## How It Works

### Event Type: Kind 30404

Subscription lists are stored as **replaceable events** using kind `30404`. This is in the 30000-39999 range, which means:

- Events are replaceable (newer versions overwrite older ones)
- The `d` tag identifies the specific list
- Only the most recent event per `pubkey` + `d` tag combination is kept

### Event Structure

```json
{
  "kind": 30404,
  "pubkey": "<user's hex pubkey>",
  "created_at": 1732645747,
  "tags": [
    ["d", "nostr-feedz-subscriptions"],
    ["client", "nostr-feedz"]
  ],
  "content": "{\"rss\":[...],\"nostr\":[...],\"tags\":{...},\"lastUpdated\":1732645747}",
  "id": "<event id>",
  "sig": "<signature>"
}
```

### Content Schema

The `content` field contains a JSON object:

```typescript
interface SubscriptionList {
  // RSS feed URLs
  rss: string[]
  
  // Nostr npubs for long-form content authors
  nostr: string[]
  
  // Optional: tags/categories per feed
  // Key is the feed URL or npub
  tags?: Record<string, string[]>
  
  // Unix timestamp of last update
  lastUpdated?: number
}
```

### Example Content

```json
{
  "rss": [
    "https://example.com/feed.xml",
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCxyz..."
  ],
  "nostr": [
    "npub1cj8znuztfqkvq89pl8hceph0svvvqk0qay6nydgk9uyq7fhpfsgsqwrz4u",
    "npub1v5ufyh4lkeslgxxcclg8f0hzazhaw7rsrhvfquxzm2fk64c72hps45n0v5"
  ],
  "tags": {
    "https://example.com/feed.xml": ["tech", "news"],
    "npub1cj8znuztfqkvq89pl8hceph0svvvqk0qay6nydgk9uyq7fhpfsgsqwrz4u": ["bitcoin", "nostr"]
  },
  "lastUpdated": 1732645747
}
```

## Implementation Guide

### Prerequisites

- [nostr-tools](https://github.com/nbd-wtf/nostr-tools) library
- NIP-07 browser extension support (Alby, nos2x, etc.) or custom signing

### 1. Publishing Subscriptions

```typescript
import { SimplePool, nip19 } from 'nostr-tools'
import type { UnsignedEvent, Event } from 'nostr-tools'

const SUBSCRIPTION_LIST_KIND = 30404

interface SubscriptionList {
  rss: string[]
  nostr: string[]
  tags?: Record<string, string[]>
  lastUpdated?: number
}

async function publishSubscriptionList(
  subscriptionList: SubscriptionList,
  relays: string[]
): Promise<string> {
  const pool = new SimplePool()
  
  // Get pubkey from NIP-07 extension
  const pubkey = await window.nostr.getPublicKey()
  
  // Create unsigned event
  const unsignedEvent: UnsignedEvent = {
    kind: SUBSCRIPTION_LIST_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'nostr-feedz-subscriptions'],
      ['client', 'your-app-name'],  // Identify your app
    ],
    content: JSON.stringify({
      ...subscriptionList,
      lastUpdated: Math.floor(Date.now() / 1000),
    }),
  }
  
  // Sign with NIP-07 extension
  const signedEvent = await window.nostr.signEvent(unsignedEvent)
  
  // Publish to relays
  const publishPromises = pool.publish(relays, signedEvent)
  await Promise.race(publishPromises)
  
  pool.close(relays)
  
  return signedEvent.id
}
```

### 2. Fetching Subscriptions

```typescript
async function fetchSubscriptionList(
  userPubkey: string,
  relays: string[]
): Promise<SubscriptionList | null> {
  const pool = new SimplePool()
  
  // Convert npub to hex if needed
  let pubkeyHex = userPubkey
  if (userPubkey.startsWith('npub')) {
    const decoded = nip19.decode(userPubkey)
    if (decoded.type === 'npub') {
      pubkeyHex = decoded.data
    }
  }
  
  // Query for the subscription list
  const event = await pool.get(relays, {
    kinds: [SUBSCRIPTION_LIST_KIND],
    authors: [pubkeyHex],
    '#d': ['nostr-feedz-subscriptions'],
  })
  
  pool.close(relays)
  
  if (!event) {
    return null
  }
  
  return JSON.parse(event.content) as SubscriptionList
}
```

### 3. Merging Local and Remote

When syncing, you'll want to merge local subscriptions with remote ones:

```typescript
interface Feed {
  type: 'RSS' | 'NOSTR'
  url: string
  tags?: string[]
}

function mergeSubscriptions(
  localFeeds: Feed[],
  remoteList: SubscriptionList
): {
  toAdd: Feed[]      // Remote feeds not in local
  localOnly: Feed[]  // Local feeds not in remote
} {
  const localRssUrls = new Set(
    localFeeds
      .filter(f => f.type === 'RSS')
      .map(f => f.url.toLowerCase())
  )
  
  const localNpubs = new Set(
    localFeeds
      .filter(f => f.type === 'NOSTR')
      .map(f => {
        const match = f.url.match(/npub\w+/)
        return match ? match[0].toLowerCase() : f.url.toLowerCase()
      })
  )
  
  const toAdd: Feed[] = []
  
  // Find remote RSS feeds not in local
  for (const rssUrl of remoteList.rss) {
    if (!localRssUrls.has(rssUrl.toLowerCase())) {
      toAdd.push({
        type: 'RSS',
        url: rssUrl,
        tags: remoteList.tags?.[rssUrl],
      })
    }
  }
  
  // Find remote Nostr feeds not in local
  for (const npub of remoteList.nostr) {
    if (!localNpubs.has(npub.toLowerCase())) {
      toAdd.push({
        type: 'NOSTR',
        url: npub,
        tags: remoteList.tags?.[npub],
      })
    }
  }
  
  // Find local-only feeds
  const remoteRssLower = new Set(remoteList.rss.map(u => u.toLowerCase()))
  const remoteNostrLower = new Set(remoteList.nostr.map(n => n.toLowerCase()))
  
  const localOnly = localFeeds.filter(f => {
    if (f.type === 'RSS') {
      return !remoteRssLower.has(f.url.toLowerCase())
    } else {
      const match = f.url.match(/npub\w+/)
      const npub = match ? match[0].toLowerCase() : f.url.toLowerCase()
      return !remoteNostrLower.has(npub)
    }
  })
  
  return { toAdd, localOnly }
}
```

### 4. Complete Sync Flow

```typescript
async function syncSubscriptions(
  localFeeds: Feed[],
  relays: string[]
): Promise<void> {
  // 1. Get user's pubkey
  const pubkey = await window.nostr.getPublicKey()
  const npub = nip19.npubEncode(pubkey)
  
  // 2. Fetch remote subscriptions
  const remoteList = await fetchSubscriptionList(npub, relays)
  
  if (!remoteList) {
    // No remote list exists, publish local
    await publishSubscriptionList(
      buildSubscriptionList(localFeeds),
      relays
    )
    return
  }
  
  // 3. Merge
  const { toAdd, localOnly } = mergeSubscriptions(localFeeds, remoteList)
  
  // 4. Prompt user
  if (toAdd.length > 0) {
    const shouldImport = confirm(
      `Found ${toAdd.length} subscriptions on Nostr. Import them?`
    )
    if (shouldImport) {
      // Add remote feeds to local
      for (const feed of toAdd) {
        await addFeedLocally(feed)
      }
    }
  }
  
  // 5. Upload merged list
  const allFeeds = [...localFeeds, ...toAdd]
  await publishSubscriptionList(
    buildSubscriptionList(allFeeds),
    relays
  )
}

function buildSubscriptionList(feeds: Feed[]): SubscriptionList {
  const rss: string[] = []
  const nostr: string[] = []
  const tags: Record<string, string[]> = {}
  
  for (const feed of feeds) {
    if (feed.type === 'RSS') {
      rss.push(feed.url)
      if (feed.tags?.length) {
        tags[feed.url] = feed.tags
      }
    } else {
      const npubMatch = feed.url.match(/npub\w+/)
      const npub = npubMatch ? npubMatch[0] : feed.url
      nostr.push(npub)
      if (feed.tags?.length) {
        tags[npub] = feed.tags
      }
    }
  }
  
  return { rss, nostr, tags }
}
```

## Recommended Relays

Use multiple relays for redundancy:

```typescript
const SYNC_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net',
]
```

## Platform-Specific Notes

### Web (Browser)

Use NIP-07 browser extensions for signing:

```typescript
if (window.nostr) {
  const pubkey = await window.nostr.getPublicKey()
  const signedEvent = await window.nostr.signEvent(unsignedEvent)
}
```

### React Native / Mobile

Use a Nostr signing library or implement NIP-46 (Nostr Connect) for remote signing:

```typescript
// Using @nostr-dev-kit/ndk
import NDK from '@nostr-dev-kit/ndk'

const ndk = new NDK({ explicitRelayUrls: SYNC_RELAYS })
await ndk.connect()

// With a signer
const signer = new NDKPrivateKeySigner(privateKey)
ndk.signer = signer

const event = new NDKEvent(ndk)
event.kind = 30404
event.tags = [['d', 'nostr-feedz-subscriptions']]
event.content = JSON.stringify(subscriptionList)
await event.publish()
```

### iOS Swift

Use [NostrSDK](https://github.com/nicklockwood/nostr-sdk-swift) or similar:

```swift
import NostrSDK

func publishSubscriptions(_ list: SubscriptionList) async throws {
    let content = try JSONEncoder().encode(list)
    
    let event = Event(
        kind: 30404,
        tags: [
            ["d", "nostr-feedz-subscriptions"],
            ["client", "my-ios-app"]
        ],
        content: String(data: content, encoding: .utf8)!
    )
    
    let signedEvent = try event.sign(with: privateKey)
    
    for relay in relays {
        try await relay.publish(signedEvent)
    }
}
```

### Android Kotlin

Use [nostr-java](https://github.com/tcheeric/nostr-java) or similar:

```kotlin
import nostr.event.Event
import nostr.event.Kind

fun publishSubscriptions(list: SubscriptionList) {
    val content = gson.toJson(list)
    
    val event = Event.Builder()
        .kind(30404)
        .tags(listOf(
            listOf("d", "nostr-feedz-subscriptions"),
            listOf("client", "my-android-app")
        ))
        .content(content)
        .build()
    
    val signedEvent = event.sign(privateKey)
    
    relays.forEach { relay ->
        relay.send(signedEvent)
    }
}
```

## Interoperability

Any app that follows this specification can read and write subscription lists. The key identifiers are:

| Field | Value | Purpose |
|-------|-------|---------|
| `kind` | `30404` | Event type for subscription lists |
| `d` tag | `nostr-feedz-subscriptions` | Identifies this specific list type |
| `client` tag | Your app name | Optional, for analytics/debugging |

### Reading Lists from Other Apps

When fetching, check for any `30404` events with the `d` tag:

```typescript
const events = await pool.querySync(relays, {
  kinds: [30404],
  authors: [pubkeyHex],
  '#d': ['nostr-feedz-subscriptions'],
})

// Get the most recent one
const latest = events.sort((a, b) => b.created_at - a.created_at)[0]
```

### Extending the Schema

If you need additional fields, add them to the content JSON. Existing fields should be preserved:

```json
{
  "rss": [...],
  "nostr": [...],
  "tags": {...},
  "lastUpdated": 1732645747,
  "yourAppField": "custom data"
}
```

## Testing

### Verify Events on Relays

```bash
# Check for subscription sync events
node -e "
const { SimplePool, nip19 } = require('nostr-tools');

const pool = new SimplePool();
const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

async function check() {
  const events = await pool.querySync(relays, {
    kinds: [30404],
    '#d': ['nostr-feedz-subscriptions'],
    limit: 10,
  });
  
  console.log('Found', events.length, 'subscription sync events');
  
  for (const event of events) {
    const npub = nip19.npubEncode(event.pubkey);
    console.log('User:', npub);
    console.log('Content:', JSON.parse(event.content));
  }
  
  pool.close(relays);
}

check();
"
```

### Manual Event Inspection

Use [nostr.band](https://nostr.band) or [njump.me](https://njump.me) to search for kind 30404 events.

## Security Considerations

1. **Private Data**: Subscription lists are public on relays. Don't include sensitive information.

2. **Event Verification**: Always verify event signatures before trusting content.

3. **Content Validation**: Parse and validate JSON content before using.

4. **Rate Limiting**: Don't publish too frequently. Once per subscription change is enough.

## Summary

Nostr Feedz subscription sync enables cross-device, cross-app subscription management using standard Nostr events. By following this specification, your app can:

- **Export** user subscriptions to Nostr relays
- **Import** subscriptions from other devices/apps
- **Merge** local and remote subscription lists
- **Interoperate** with Nostr Feedz and other compatible apps

The user's Nostr identity becomes their universal subscription identity.
