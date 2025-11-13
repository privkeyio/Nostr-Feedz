import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc'
import { fetchAndParseFeed } from '@/lib/rss-parser'
import { getNostrFetcher, NostrFeedFetcher } from '@/lib/nostr-fetcher'
import { discoverFeed } from '@/lib/feed-discovery'

export const feedRouter = createTRPCRouter({
    // Get all user feeds with unread counts
  getFeeds: protectedProcedure
    .input(z.object({
      tags: z.array(z.string()).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const whereClause: any = {
        userPubkey: ctx.nostrPubkey,
      }

      // Filter by tags if provided
      if (input?.tags && input.tags.length > 0) {
        whereClause.tags = {
          hasEvery: input.tags,
        }
      }

      const subscriptions = await ctx.db.subscription.findMany({
        where: whereClause,
        include: {
          feed: {
            include: {
              _count: {
                select: {
                  items: {
                    where: {
                      readItems: {
                        none: {
                          userPubkey: ctx.nostrPubkey,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      return subscriptions.map(sub => ({
        id: sub.feed.id,
        title: sub.feed.title,
        type: sub.feed.type,
        url: sub.feed.url,
        npub: sub.feed.npub,
        unreadCount: sub.feed._count.items,
        subscribedAt: sub.createdAt,
        tags: sub.tags,
      }))
    }),

  // Get feed items for a specific feed or all feeds
  getFeedItems: protectedProcedure
    .input(z.object({
      feedId: z.string().optional(),
      feedIds: z.array(z.string()).optional(), // Array of feed IDs for tag filtering
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const whereClause: any = {}
      
      if (input.feedId) {
        whereClause.feedId = input.feedId
      } else if (input.feedIds && input.feedIds.length > 0) {
        // When tags are selected, show items from specific feeds
        whereClause.feedId = {
          in: input.feedIds,
        }
      } else {
        // Only show items from feeds the user is subscribed to
        const subscriptions = await ctx.db.subscription.findMany({
          where: { userPubkey: ctx.nostrPubkey },
          select: { feedId: true },
        })
        whereClause.feedId = {
          in: subscriptions.map(s => s.feedId),
        }
      }

      const items = await ctx.db.feedItem.findMany({
        where: whereClause,
        include: {
          feed: true,
          readItems: {
            where: {
              userPubkey: ctx.nostrPubkey,
            },
          },
        },
        orderBy: {
          publishedAt: 'desc',
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      })

      let nextCursor: string | undefined = undefined
      if (items.length > input.limit) {
        const nextItem = items.pop()
        nextCursor = nextItem!.id
      }

      return {
        items: items.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          author: item.author,
          publishedAt: item.publishedAt,
          url: item.url,
          isRead: item.readItems.length > 0,
          feedTitle: item.feed.title,
          feedType: item.feed.type,
        })),
        nextCursor,
      }
    }),

  // Subscribe to a new feed
  subscribeFeed: protectedProcedure
    .input(z.object({
      type: z.enum(['RSS', 'NOSTR']),
      url: z.string().optional(),
      npub: z.string().optional(),
      title: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate input based on type
      if (input.type === 'RSS' && !input.url) {
        throw new Error('RSS feeds require a URL')
      }
      if (input.type === 'NOSTR' && !input.npub) {
        throw new Error('Nostr feeds require an npub')
      }

      let feedUrl = input.url
      let feedTitle = input.title

      // For RSS feeds, try to discover the actual feed URL
      if (input.type === 'RSS' && input.url) {
        console.log('Discovering feed at:', input.url)
        const discovery = await discoverFeed(input.url)
        
        if (!discovery.found) {
          throw new Error(discovery.error || 'Could not find a valid RSS or Atom feed at this URL. Please check the URL and try again.')
        }
        
        feedUrl = discovery.feedUrl
        feedTitle = discovery.title || input.title || new URL(discovery.feedUrl!).hostname
        console.log('Feed discovered:', { feedUrl, feedTitle, type: discovery.type })
      }

      // Check if feed already exists
      let existingFeed
      if (input.type === 'RSS') {
        existingFeed = await ctx.db.feed.findFirst({
          where: {
            type: 'RSS',
            url: feedUrl,
          },
        })
      } else {
        existingFeed = await ctx.db.feed.findFirst({
          where: {
            type: 'NOSTR', 
            npub: input.npub,
          },
        })
      }

      let feed
      if (existingFeed) {
        feed = existingFeed
        
        // If it's a Nostr feed and doesn't have a proper title (still shows npub), update it
        if (feed.type === 'NOSTR' && feed.npub && feed.title.includes('npub1')) {
          const nostrFetcher = getNostrFetcher()
          const profile = await nostrFetcher.getProfile(feed.npub)
          if (profile?.name) {
            feed = await ctx.db.feed.update({
              where: { id: feed.id },
              data: { title: profile.name },
            })
          }
        }
        
        // Check if feed has any items - if not, fetch them
        const itemCount = await ctx.db.feedItem.count({
          where: { feedId: feed.id },
        })
        
        if (itemCount === 0) {
          // Feed exists but has no items - fetch them now
          if (feed.type === 'RSS' && feed.url) {
            try {
              const parsedFeed = await fetchAndParseFeed(feed.url)
              
              for (const item of parsedFeed.items) {
                try {
                  await ctx.db.feedItem.create({
                    data: {
                      feedId: feed.id,
                      title: item.title,
                      content: item.content,
                      author: item.author,
                      publishedAt: item.publishedAt,
                      url: item.url,
                      guid: item.guid,
                    },
                  })
                } catch (error) {
                  console.error('Error adding RSS item:', error)
                }
              }
            } catch (error) {
              console.error('Error fetching RSS feed:', error)
            }
          }
          
          // For Nostr feeds with no items
          if (feed.type === 'NOSTR' && feed.npub) {
            const nostrFetcher = getNostrFetcher()
            const posts = await nostrFetcher.fetchLongFormPosts(feed.npub, 50)
            
            for (const post of posts) {
              try {
                await ctx.db.feedItem.create({
                  data: {
                    feedId: feed.id,
                    title: post.title,
                    content: post.content,
                    author: post.author,
                    publishedAt: post.publishedAt,
                    url: post.url,
                    guid: post.id,
                  },
                })
              } catch (error) {
                console.error('Error adding Nostr post:', error)
              }
            }
          }
        }
      } else {
        // For Nostr feeds, fetch profile info to get the display name
        let finalTitle = feedTitle
        if (input.type === 'NOSTR' && input.npub) {
          const nostrFetcher = getNostrFetcher()
          const profile = await nostrFetcher.getProfile(input.npub)
          finalTitle = profile?.name || `${input.npub.slice(0, 16)}...`
        } else if (input.type === 'RSS') {
          finalTitle = feedTitle || new URL(feedUrl!).hostname
        }

        feed = await ctx.db.feed.create({
          data: {
            type: input.type,
            title: finalTitle || 'Untitled Feed',
            url: feedUrl,
            npub: input.npub,
          },
        })
        
        // For RSS feeds, immediately fetch initial items
        if (input.type === 'RSS' && feedUrl) {
          try {
            const parsedFeed = await fetchAndParseFeed(feedUrl)
            
            // Add items to database
            for (const item of parsedFeed.items) {
              try {
                await ctx.db.feedItem.create({
                  data: {
                    feedId: feed.id,
                    title: item.title,
                    content: item.content,
                    author: item.author,
                    publishedAt: item.publishedAt,
                    url: item.url,
                    guid: item.guid,
                  },
                })
              } catch (error) {
                console.error('Error adding RSS item:', error)
                // Continue with other items
              }
            }
          } catch (error) {
            console.error('Error fetching RSS feed:', error)
            // Feed is created but empty - user can refresh later
          }
        }
        
        // For Nostr feeds, immediately fetch initial posts
        if (input.type === 'NOSTR' && input.npub) {
          const nostrFetcher = getNostrFetcher()
          const posts = await nostrFetcher.fetchLongFormPosts(input.npub, 50)
          
          // Add posts to database
          for (const post of posts) {
            try {
              await ctx.db.feedItem.create({
                data: {
                  feedId: feed.id,
                  title: post.title,
                  content: post.content,
                  author: post.author,
                  publishedAt: post.publishedAt,
                  url: post.url,
                  guid: post.id,
                },
              })
            } catch (error) {
              console.error('Error adding Nostr post:', error)
              // Continue with other posts
            }
          }
        }
      }

      // Check if user is already subscribed
      const existingSubscription = await ctx.db.subscription.findUnique({
        where: {
          userPubkey_feedId: {
            userPubkey: ctx.nostrPubkey,
            feedId: feed.id,
          },
        },
      })

      if (existingSubscription) {
        throw new Error('Already subscribed to this feed')
      }

      // Create subscription
      await ctx.db.subscription.create({
        data: {
          userPubkey: ctx.nostrPubkey,
          feedId: feed.id,
          tags: input.tags || [],
        },
      })

      return {
        id: feed.id,
        title: feed.title,
        type: feed.type,
        url: feed.url,
        npub: feed.npub,
        tags: input.tags || [],
      }
    }),

  // Unsubscribe from a feed
  unsubscribeFeed: protectedProcedure
    .input(z.object({
      feedId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.subscription.delete({
        where: {
          userPubkey_feedId: {
            userPubkey: ctx.nostrPubkey,
            feedId: input.feedId,
          },
        },
      })

      return { success: true }
    }),

  // Update subscription tags
  updateSubscriptionTags: protectedProcedure
    .input(z.object({
      feedId: z.string(),
      tags: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.subscription.update({
        where: {
          userPubkey_feedId: {
            userPubkey: ctx.nostrPubkey,
            feedId: input.feedId,
          },
        },
        data: {
          tags: input.tags,
        },
      })

      return { success: true }
    }),

  // Get all user tags with unread counts
  getUserTags: protectedProcedure
    .query(async ({ ctx }) => {
      const subscriptions = await ctx.db.subscription.findMany({
        where: {
          userPubkey: ctx.nostrPubkey,
        },
        include: {
          feed: {
            include: {
              items: {
                where: {
                  readItems: {
                    none: {
                      userPubkey: ctx.nostrPubkey,
                    },
                  },
                },
              },
            },
          },
        },
      })

      // Aggregate tags with unread counts
      const tagMap = new Map<string, { tag: string; unreadCount: number; feedCount: number }>()
      
      for (const sub of subscriptions) {
        const unreadCount = sub.feed.items.length
        
        for (const tag of sub.tags) {
          const existing = tagMap.get(tag)
          if (existing) {
            existing.unreadCount += unreadCount
            existing.feedCount += 1
          } else {
            tagMap.set(tag, {
              tag,
              unreadCount,
              feedCount: 1,
            })
          }
        }
      }

      return Array.from(tagMap.values()).sort((a, b) => a.tag.localeCompare(b.tag))
    }),

  // Mark an item as read
  markAsRead: protectedProcedure
    .input(z.object({
      itemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.readItem.upsert({
        where: {
          userPubkey_itemId: {
            userPubkey: ctx.nostrPubkey,
            itemId: input.itemId,
          },
        },
        create: {
          userPubkey: ctx.nostrPubkey,
          itemId: input.itemId,
        },
        update: {},
      })

      return { success: true }
    }),

  // Mark an item as unread
  markAsUnread: protectedProcedure
    .input(z.object({
      itemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.readItem.delete({
        where: {
          userPubkey_itemId: {
            userPubkey: ctx.nostrPubkey,
            itemId: input.itemId,
          },
        },
      })

      return { success: true }
    }),

  // Mark all items in a feed as read
  markFeedAsRead: protectedProcedure
    .input(z.object({
      feedId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all items in the feed
      const feedItems = await ctx.db.feedItem.findMany({
        where: { feedId: input.feedId },
        select: { id: true },
      })

      // Create read items for all unread items
      const readItemsData = feedItems.map(item => ({
        userPubkey: ctx.nostrPubkey,
        itemId: item.id,
      }))

      await ctx.db.readItem.createMany({
        data: readItemsData,
        skipDuplicates: true,
      })

      return { success: true }
    }),

  // Discover feed URLs from a website
  discoverFeeds: protectedProcedure
    .input(z.object({
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const feedUrls = await discoverFeed(input.url)
      return { feedUrls }
    }),

  // Preview a feed before subscribing
  previewFeed: protectedProcedure
    .input(z.object({
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const parsedFeed = await fetchAndParseFeed(input.url)
      return {
        title: parsedFeed.title,
        description: parsedFeed.description,
        url: parsedFeed.url,
        itemCount: parsedFeed.items.length,
        latestItems: parsedFeed.items.slice(0, 3).map(item => ({
          title: item.title,
          publishedAt: item.publishedAt,
        })),
      }
    }),

  // Refresh a feed (fetch new items)
  refreshFeed: protectedProcedure
    .input(z.object({
      feedId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const feed = await ctx.db.feed.findUnique({
        where: { id: input.feedId },
      })

      if (!feed) {
        throw new Error('Feed not found')
      }

      if (feed.type !== 'RSS' || !feed.url) {
        throw new Error('Only RSS feeds can be refreshed')
      }

      const parsedFeed = await fetchAndParseFeed(feed.url)
      
      // Update feed title if it has changed
      await ctx.db.feed.update({
        where: { id: feed.id },
        data: {
          title: parsedFeed.title,
          lastFetchedAt: new Date(),
        },
      })

      // Add new items to database
      let newItemsCount = 0
      for (const item of parsedFeed.items) {
        try {
          // Check if item already exists (by URL or GUID)
          const existingItem = await ctx.db.feedItem.findFirst({
            where: {
              feedId: feed.id,
              OR: [
                { url: item.url },
                { guid: item.guid },
              ].filter(condition => 
                (condition.url && condition.url !== null) || 
                (condition.guid && condition.guid !== null)
              ),
            },
          })

          if (!existingItem) {
            await ctx.db.feedItem.create({
              data: {
                feedId: feed.id,
                title: item.title,
                content: item.content,
                author: item.author,
                publishedAt: item.publishedAt,
                url: item.url,
                guid: item.guid,
              },
            })
            newItemsCount++
          }
        } catch (error) {
          console.error('Error adding feed item:', error)
          // Continue processing other items
        }
      }

      return {
        success: true,
        newItemsCount,
        totalItems: parsedFeed.items.length,
      }
    }),

  // Validate a Nostr npub for feed subscription
  validateNostrFeed: protectedProcedure
    .input(z.object({
      npub: z.string().startsWith('npub1'),
    }))
    .mutation(async ({ input }) => {
      const nostrFetcher = getNostrFetcher()
      const result = await nostrFetcher.validateNostrFeed(input.npub)
      return result
    }),

  // Preview Nostr feed content
  previewNostrFeed: protectedProcedure
    .input(z.object({
      npub: z.string().startsWith('npub1'),
    }))
    .mutation(async ({ input }) => {
      const nostrFetcher = getNostrFetcher()
      
      // Get profile info
      const profile = await nostrFetcher.getProfile(input.npub)
      
      // Get recent posts
      const posts = await nostrFetcher.fetchLongFormPosts(input.npub, 5)
      
      return {
        npub: input.npub,
        profile: profile || {},
        postCount: posts.length,
        latestPosts: posts.map(post => ({
          title: post.title,
          publishedAt: post.publishedAt,
          tags: post.tags.slice(0, 3), // Show first 3 tags
        })),
      }
    }),

  // Refresh Nostr feed (fetch new long-form posts)
  refreshNostrFeed: protectedProcedure
    .input(z.object({
      feedId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const feed = await ctx.db.feed.findUnique({
        where: { id: input.feedId },
      })

      if (!feed) {
        throw new Error('Feed not found')
      }

      if (feed.type !== 'NOSTR' || !feed.npub) {
        throw new Error('Only Nostr feeds can be refreshed with this method')
      }

      const nostrFetcher = getNostrFetcher()
      
      // Get the last fetch time to only get new posts
      const lastFetched = feed.lastFetchedAt
      const posts = await nostrFetcher.fetchLongFormPosts(
        feed.npub,
        50,
        lastFetched || undefined
      )

      // Update feed last fetched time
      await ctx.db.feed.update({
        where: { id: feed.id },
        data: {
          lastFetchedAt: new Date(),
        },
      })

      // Add new posts to database
      let newItemsCount = 0
      for (const post of posts) {
        try {
          // Check if post already exists by Nostr event ID
          const existingItem = await ctx.db.feedItem.findFirst({
            where: {
              feedId: feed.id,
              guid: post.id, // Nostr event ID as GUID
            },
          })

          if (!existingItem) {
            await ctx.db.feedItem.create({
              data: {
                feedId: feed.id,
                title: post.title,
                content: post.content,
                author: post.author,
                publishedAt: post.publishedAt,
                url: post.url,
                guid: post.id, // Nostr event ID
              },
            })
            newItemsCount++
          }
        } catch (error) {
          console.error('Error adding Nostr feed item:', error)
          // Continue processing other items
        }
      }

      return {
        success: true,
        newItemsCount,
        totalItems: posts.length,
      }
    }),

  // Search for Nostr profiles
  searchProfiles: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).default(10),
      relays: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const nostrFetcher = input.relays ? new NostrFeedFetcher(input.relays) : getNostrFetcher()
      const profiles = await nostrFetcher.searchProfiles(input.query, input.limit)
      return { profiles }
    }),

  // Get popular Nostr users for discovery
  getPopularUsers: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(20),
      relays: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const nostrFetcher = input.relays ? new NostrFeedFetcher(input.relays) : getNostrFetcher()
      const profiles = await nostrFetcher.getPopularUsers(input.limit)
      return { profiles }
    }),
})