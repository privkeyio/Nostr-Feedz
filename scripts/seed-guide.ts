import { PrismaClient } from '@prisma/client'
import { SimplePool, nip19 } from 'nostr-tools'

const db = new PrismaClient()

interface SeedFeed {
  npub: string
  tags: string[]
}

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.band',
  'wss://nostr-pub.wellorder.net'
]

// Popular Nostr long-form content creators with relevant tags
const seedFeeds: SeedFeed[] = [
  {
    npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m', // Derek Ross
    tags: ['nostr', 'bitcoin', 'technology', 'tutorials'],
  },
  {
    npub: 'npub1az9xj85cmxv8e9j9y80lvqp97crsqdu2fpu3srwthd99qfu9qsgstam8y8', // Max DeMarco
    tags: ['bitcoin', 'economics', 'freedom', 'nostr'],
  },
  {
    npub: 'npub1g53mukxnjkcmr94fhryzkqutdz2ukq4ks0gvy5af25rgmwsl4ngq43drvk', // Gigi
    tags: ['bitcoin', 'philosophy', 'freedom', 'technology'],
  },
  {
    npub: 'npub1qny3tkh0acurzla8x3zy4nhrjz5zd8l9sy9jys09umwng00manysew95gx', // Jeff Booth
    tags: ['bitcoin', 'economics', 'technology', 'deflation'],
  },
  {
    npub: 'npub1rtlqca8r6auyaw5n5h3l5422dm4sry5dzfee4696fqe8s6qgudks7djtfs', // ODELL
    tags: ['bitcoin', 'privacy', 'freedom', 'nostr'],
  },
  {
    npub: 'npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z', // Mike Dilger (Gossip dev)
    tags: ['nostr', 'development', 'technology', 'privacy'],
  },
  {
    npub: 'npub1acg6thl5psv62405rljzkj8spesceyfz2c32udakc2ak0dmvfeyse9p35c', // Lyn Alden
    tags: ['bitcoin', 'economics', 'finance', 'macro'],
  },
  {
    npub: 'npub1hu3hdctm5nkzd8gslnyedfr5ddz3z547jqcl5j88g4fame2jd08qep6kvr', // Preston Pysh
    tags: ['bitcoin', 'investing', 'economics', 'finance'],
  },
  {
    npub: 'npub1cn4t4cd78nm900qc2hhqte5aa8c9njm6qkfzw95tszufwcwtcnsq7g3vle', // ZEUS
    tags: ['bitcoin', 'lightning', 'technology', 'wallets'],
  },
  {
    npub: 'npub1xnf02f60r9v0e5kty33a404dm79zr7z2eepyrk5gsq3m7pwvsz2sazlpr5', // Marty Bent
    tags: ['bitcoin', 'freedom', 'energy', 'finance'],
  },
  {
    npub: 'npub1s33sw4x3dh776lqcjdq0xdggh0wnv9v6s3nfhf9xha4wdh7kntkqv8j9h4', // Pablo
    tags: ['nostr', 'development', 'protocol', 'technology'],
  },
  {
    npub: 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6', // fiatjaf
    tags: ['nostr', 'development', 'protocol', 'bitcoin'],
  },
  {
    npub: 'npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s', // Ava
    tags: ['bitcoin', 'nostr', 'art', 'culture'],
  },
  {
    npub: 'npub1key55ax33gkl50uqemvl4khrtqrhzm7wzpc7fj2n4eckqms6gxqswmztzk', // Key
    tags: ['nostr', 'design', 'ui/ux', 'product'],
  },
  {
    npub: 'npub1h8nk2346qezka5cpm8jjh3yl5j88pf4ly2ptu7s6uu55wcfqy0wq36rpev', // kukks
    tags: ['bitcoin', 'btcpayserver', 'development', 'technology'],
  },
]

async function seedGuide() {
  console.log('🌱 Starting guide seed process...\n')
  
  const pool = new SimplePool()
  let successCount = 0
  let failCount = 0

  for (const seedFeed of seedFeeds) {
    try {
      console.log(`📡 Fetching profile for ${seedFeed.npub.slice(0, 20)}...`)
      
      // Check if already exists
      const existing = await db.guideFeed.findUnique({
        where: { npub: seedFeed.npub },
      })

      if (existing) {
        console.log(`   ⏭️  Already exists: ${existing.displayName}`)
        continue
      }

      // Decode npub to hex
      const { type, data } = nip19.decode(seedFeed.npub)
      if (type !== 'npub') {
        console.log(`   ❌ Invalid npub format`)
        failCount++
        continue
      }
      const pubkey = data as string

      // Fetch profile (kind 0)
      const profileEvents = await pool.querySync(DEFAULT_RELAYS, {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      })

      if (profileEvents.length === 0) {
        console.log(`   ❌ Could not fetch profile`)
        failCount++
        continue
      }

      const profile = JSON.parse(profileEvents[0].content)
      console.log(`   👤 Found: ${profile.name || 'Unknown'}`)

      // Fetch long-form posts (kind 30023)
      console.log(`   📝 Fetching posts...`)
      const posts = await pool.querySync(DEFAULT_RELAYS, {
        kinds: [30023],
        authors: [pubkey],
        limit: 20,
      })
      
      if (posts.length === 0) {
        console.log(`   ⚠️  No long-form posts found, skipping`)
        failCount++
        continue
      }

      console.log(`   📚 Found ${posts.length} posts`)

      // Find most recent post
      const lastPublishedAt = new Date(Math.max(...posts.map(p => p.created_at * 1000)))

      // Create guide entry
      await db.guideFeed.create({
        data: {
          npub: seedFeed.npub,
          displayName: profile.name || seedFeed.npub.slice(0, 16) + '...',
          about: profile.about || null,
          picture: profile.picture || null,
          tags: seedFeed.tags,
          submittedBy: null, // System seed
          lastPublishedAt,
          postCount: posts.length,
          subscriberCount: 0,
        },
      })

      console.log(`   ✅ Added: ${profile.name} [${seedFeed.tags.join(', ')}]\n`)
      successCount++

      // Small delay to not overwhelm relays
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
      failCount++
    }
  }

  pool.close(DEFAULT_RELAYS)

  console.log('━'.repeat(50))
  console.log(`✨ Seed complete!`)
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`   📊 Total: ${seedFeeds.length}`)
  console.log('━'.repeat(50))
}

// Run the seed
seedGuide()
  .then(() => {
    console.log('\n🎉 Guide seeding finished!')
    db.$disconnect()
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Seed failed:', error)
    db.$disconnect()
    process.exit(1)
  })
