'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/trpc/react'
import { AddFeedModal } from './add-feed-modal'
import { SettingsDialog, MarkReadBehavior, OrganizationMode } from './settings-dialog'
import { FormattedContent } from './formatted-content'
import { SimplePool } from 'nostr-tools'
import { 
  fetchSubscriptionList, 
  mergeSubscriptionLists,
  getLastSyncTime,
} from '@/lib/nostr-sync'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/server/api/root'

interface Category {
  id: string
  name: string
  color: string | null
  icon: string | null
}

interface Feed {
  id: string
  title: string
  type: 'RSS' | 'NOSTR' | 'NOSTR_VIDEO'
  unreadCount: number
  url?: string
  npub?: string
  tags?: string[]
  categoryId?: string | null
  category?: Category | null
}

type RouterOutputs = inferRouterOutputs<AppRouter>
type FeedItemsResponse = RouterOutputs['feed']['getFeedItems']
type FeedItem = FeedItemsResponse['items'][number]
type FavoritesResponse = RouterOutputs['feed']['getFavorites']
type FavoriteItem = FavoritesResponse['items'][number]

const FAVORITES_QUERY_INPUT = { limit: 50 } as const
const QUICK_MARK_READ_OPTIONS: { value: MarkReadBehavior; label: string; helper: string }[] = [
  { value: 'on-open', label: 'On open', helper: 'Mark as soon as I open the story' },
  { value: 'after-10s', label: 'After 10 seconds', helper: 'Give me a short buffer before marking read' },
  { value: 'never', label: 'Never automatically', helper: 'Only change when I click Mark as Read' },
]

export function FeedReader() {
  const { user, disconnect } = useNostrAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const utils = api.useUtils()
  
  // Add logging to track user state
  useEffect(() => {
    console.log('🔍 FeedReader: User state changed:', {
      hasUser: !!user,
      pubkey: user?.pubkey?.slice(0, 8),
      npub: user?.npub?.slice(0, 12)
    })
  }, [user])
  const [selectedFeed, setSelectedFeed] = useState<string | null>('all')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [feedError, setFeedError] = useState<string>('')
  const [sidebarView, setSidebarView] = useState<'feeds' | 'tags' | 'favorites'>('feeds')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [openMenuFeedId, setOpenMenuFeedId] = useState<string | null>(null)
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState('')
  const [showCategoryPicker, setShowCategoryPicker] = useState<string | null>(null) // feedId when showing category picker
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [viewFilter, setViewFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [tagSortOrder, setTagSortOrder] = useState<'alphabetical' | 'unread'>('alphabetical')
  const [markReadBehavior, setMarkReadBehavior] = useState<MarkReadBehavior>('on-open')
  const [isSharing, setIsSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [showSyncPrompt, setShowSyncPrompt] = useState(false)
  const [pendingSyncImport, setPendingSyncImport] = useState<Array<{ type: 'RSS' | 'NOSTR'; url: string; tags?: string[] }> | null>(null)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCheckedSyncRef = useRef(false)
  const hasRefreshedOnLoginRef = useRef(false)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Mobile responsive state
  const [showSidebar, setShowSidebar] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'content'>('list')
  
  // Organization mode (tags vs categories) - fetched from server
  const { data: userPreference } = api.feed.getUserPreference.useQuery(undefined, {
    enabled: !!user?.npub,
  })
  const organizationMode: OrganizationMode = userPreference?.organizationMode ?? 'tags'
  
  const updatePreferenceMutation = api.feed.updateUserPreference.useMutation({
    onSuccess: () => {
      void utils.feed.getUserPreference.invalidate()
    },
  })
  
  const handleOrganizationModeChange = (mode: OrganizationMode) => {
    updatePreferenceMutation.mutate({ organizationMode: mode })
  }
  
  // Categories query
  const { data: categories = [] } = api.feed.getCategories.useQuery(undefined, {
    enabled: !!user?.npub,
  })
  
  const { data: categoriesWithUnread = [] } = api.feed.getCategoriesWithUnread.useQuery(undefined, {
    enabled: !!user?.npub && organizationMode === 'categories',
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('mark_read_behavior') as MarkReadBehavior | 'manual' | null
    if (stored === 'manual') {
      setMarkReadBehavior('never')
      localStorage.setItem('mark_read_behavior', 'never')
      return
    }
    if (stored === 'on-open' || stored === 'after-10s' || stored === 'never') {
      setMarkReadBehavior(stored)
    }
    // Load last refresh time from localStorage
    const storedRefreshTime = localStorage.getItem('last_feed_refresh')
    if (storedRefreshTime) {
      setLastRefreshTime(parseInt(storedRefreshTime, 10))
    }
  }, [])

  const handleMarkReadBehaviorChange = (behavior: MarkReadBehavior) => {
    setMarkReadBehavior(behavior)
    if (typeof window !== 'undefined') {
      localStorage.setItem('mark_read_behavior', behavior)
    }
  }

  // Sign out handler
  const handleSignOut = () => {
    disconnect()
    router.push('/')
  }

  // Debug: Log session info
  useEffect(() => {
    console.log('FeedReader - User:', user)
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('nostr_session')
      console.log('FeedReader - Session in localStorage:', session)
    }
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuFeedId) {
        setOpenMenuFeedId(null)
      }
      if (showViewOptions) {
        setShowViewOptions(false)
      }
    }
    
    if (openMenuFeedId || showViewOptions) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuFeedId, showViewOptions])
  
  // tRPC queries - only run when user is authenticated
  const getFeedsInput = useMemo(() => {
    if (organizationMode === 'categories' && selectedCategoryId) {
      return { categoryId: selectedCategoryId }
    }
    if (organizationMode === 'tags' && selectedTags.length > 0) {
      return { tags: selectedTags }
    }
    return undefined
  }, [organizationMode, selectedCategoryId, selectedTags])
  
  const { data: feedsData = [], refetch: refetchFeeds, isLoading: isFeedsLoading, isFetched: isFeedsFetched } = api.feed.getFeeds.useQuery(
    getFeedsInput,
    {
      enabled: !!user && !!user.npub,
    }
  )
  
  // Filter out any feeds with invalid IDs
  const feeds = feedsData.filter((f: any) => f && f.id && typeof f.id === 'string' && f.id !== 'undefined')

  // Auto-fetch sync on login - check if user has remote subscriptions to import
  useEffect(() => {
    const checkRemoteSync = async () => {
      // Only check once per session and AFTER feeds query has completed (not just started)
      if (hasCheckedSyncRef.current || !user?.npub || !isFeedsFetched || isFeedsLoading) return
      hasCheckedSyncRef.current = true

      // Skip if synced recently (within last hour)
      const lastSync = getLastSyncTime()
      if (lastSync && Date.now() / 1000 - lastSync < 3600) return

      try {
        const result = await fetchSubscriptionList(user.npub)
        if (!result.success || !result.data) return
        
        // Check if there are new subscriptions to import
        if (result.data.rss.length === 0 && result.data.nostr.length === 0) return
        
        const currentFeeds = feeds.map((f) => ({
          type: f.type,
          url: f.url || f.npub || '',
          tags: f.tags,
        }))
        
        // Debug: Log exactly what we're comparing
        console.log('🔍 AUTO-SYNC DEBUG - feeds from DB:', feeds.map(f => ({ type: f.type, url: f.url, npub: f.npub, title: f.title })))
        console.log('🔍 AUTO-SYNC DEBUG - currentFeeds mapped:', currentFeeds)
        console.log('🔍 AUTO-SYNC DEBUG - remote data:', result.data)
        
        const mergeResult = mergeSubscriptionLists(currentFeeds, result.data)
        
        if (mergeResult.toAdd.length > 0) {
          setPendingSyncImport(mergeResult.toAdd)
          setShowSyncPrompt(true)
        }
      } catch (error) {
        console.error('Auto-sync check failed:', error)
      }
    }
    
    checkRemoteSync()
  }, [user?.npub, feedsData, isFeedsFetched, isFeedsLoading])
  
  const { data: userTags = [] } = api.feed.getUserTags.useQuery(undefined, {
    enabled: !!user && !!user.npub,
  })
  
  // Favorites query
  const { data: favoritesData, isLoading: favoritesLoading } = api.feed.getFavorites.useQuery(
    FAVORITES_QUERY_INPUT,
    { enabled: !!user && !!user.npub && sidebarView === 'favorites' }
  )
  
  // When tags are selected OR a category is selected, and viewing "All Items", 
  // we need to filter items to only show items from feeds that match the selected tags/category
  const filteredFeedIds = useMemo(() => {
    // Only filter when viewing "All Items" and feeds are loaded
    if (selectedFeed !== 'all' || feeds.length === 0) return undefined
    
    // Filter by tags (tags mode) or by category (when a category is selected)
    const shouldFilter = (organizationMode === 'tags' && selectedTags.length > 0) || 
                         (organizationMode === 'categories' && selectedCategoryId)
    
    if (!shouldFilter) return undefined
    
    // Return all feed IDs from the filtered feeds array (already filtered by getFeeds query)
    return feeds.map((f: any) => f.id).filter((id: any) => id && typeof id === 'string' && id !== 'undefined')
  }, [selectedFeed, feeds, organizationMode, selectedTags, selectedCategoryId])
  
  // Ensure we don't pass invalid feedId values
  const safeFeedId = selectedFeed === 'all' ? undefined : (selectedFeed && typeof selectedFeed === 'string' && selectedFeed !== 'undefined' ? selectedFeed : undefined)
  
  // Build query input conditionally to avoid serialization issues with undefined
  const feedQueryInput = useMemo(() => {
    const input: { feedId?: string; feedIds?: string[] } = {}
    if (safeFeedId) input.feedId = safeFeedId
    if (filteredFeedIds && filteredFeedIds.length > 0) input.feedIds = filteredFeedIds
    return input
  }, [safeFeedId, filteredFeedIds])

  const updateFeedItemCache = (itemId: string, updater: (item: FeedItem) => Partial<FeedItem>) => {
    utils.feed.getFeedItems.setData(feedQueryInput, (data) => {
      if (!data) return data
      return {
        ...data,
        items: data.items.map((item) =>
          item.id === itemId ? { ...item, ...updater(item) } : item
        ),
      }
    })
  }

  const removeFavoriteFromCache = (itemId: string) => {
    utils.feed.getFavorites.setData(FAVORITES_QUERY_INPUT, (data) => {
      if (!data) return data
      return {
        ...data,
        items: data.items.filter((favorite) => favorite.id !== itemId),
      }
    })
  }

  const addFavoriteToCache = (item: FeedItem) => {
    utils.feed.getFavorites.setData(FAVORITES_QUERY_INPUT, (data) => {
      if (!data) return data
      const alreadyExists = data.items.some(fav => fav.id === item.id)
      if (alreadyExists) return data

      const newFavorite: FavoriteItem = {
        ...item,
        favoritedAt: new Date(),
        isFavorited: true,
      }

      return {
        ...data,
        items: [newFavorite, ...data.items].slice(0, FAVORITES_QUERY_INPUT.limit),
      }
    })
  }
  
  console.log('🔍 Feed query params:', {
    selectedFeed,
    safeFeedId,
    selectedTags,
    filteredFeedIds,
    feedsCount: feeds.length,
    queryInput: feedQueryInput,
  })

  const { data: feedItemsData, isLoading: itemsLoading } = api.feed.getFeedItems.useQuery(
    feedQueryInput,
    { 
      enabled: !!user && !!user.npub,
      // Don't retry on 500 errors to avoid spamming the server
      retry: false,
    }
  )
  
  // Mutations
  const subscribeFeedMutation = api.feed.subscribeFeed.useMutation({
    onSuccess: () => {
      invalidateFeedData()
      setShowAddFeed(false)
      setFeedError('')
    },
    onError: (error) => {
      setFeedError(error.message)
    },
  })
  
  const unsubscribeFeedMutation = api.feed.unsubscribeFeed.useMutation({
    onSuccess: () => {
      invalidateFeedData()
      // If the deleted feed was selected, switch to "All Items"
      setSelectedFeed('all')
    },
  })
  
  const refreshFeedMutation = api.feed.refreshFeed.useMutation({
    onSuccess: () => {
      invalidateFeedData()
    },
  })
  
  const refreshNostrFeedMutation = api.feed.refreshNostrFeed.useMutation({
    onSuccess: () => {
      invalidateFeedData()
    },
  })

  const refreshAllFeedsMutation = api.feed.refreshAllFeeds.useMutation({
    onSuccess: (result) => {
      invalidateFeedData()
      const now = Date.now()
      setLastRefreshTime(now)
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_feed_refresh', now.toString())
      }
      console.log(`✅ Refreshed ${result.refreshed}/${result.total} feeds, ${result.newItems} new items`)
      setIsRefreshingAll(false)
    },
    onError: (error) => {
      console.error('Failed to refresh feeds:', error)
      setIsRefreshingAll(false)
    },
  })
  
  const updateTagsMutation = api.feed.updateSubscriptionTags.useMutation({
    onSuccess: () => {
      invalidateFeedData()
      setEditingFeedId(null)
      setEditTags([])
      setEditTagInput('')
    },
  })
  
  const updateCategoryMutation = api.feed.updateSubscriptionCategory.useMutation({
    onSuccess: () => {
      invalidateFeedData()
      void utils.feed.getCategoriesWithUnread.invalidate()
      setShowCategoryPicker(null)
    },
  })
  
  const invalidateFeedData = () => {
    void utils.feed.getFeedItems.invalidate()
    void utils.feed.getFeeds.invalidate()
    void utils.feed.getFavorites.invalidate()
    void utils.feed.getUserTags.invalidate()
  }

  // Auto-refresh all feeds function
  const handleRefreshAllFeeds = useCallback(() => {
    if (isRefreshingAll || !user?.npub) return
    setIsRefreshingAll(true)
    refreshAllFeedsMutation.mutate()
  }, [isRefreshingAll, user?.npub, refreshAllFeedsMutation])

  // Auto-refresh on login (once per session)
  // Separate effect to detect when feeds are first loaded
  const [feedsLoaded, setFeedsLoaded] = useState(false)
  
  useEffect(() => {
    if (feeds.length > 0 && !feedsLoaded) {
      setFeedsLoaded(true)
    }
  }, [feeds.length, feedsLoaded])
  
  useEffect(() => {
    if (!user?.npub || hasRefreshedOnLoginRef.current || !feedsLoaded) return
    
    // Check if we've refreshed recently (within 5 minutes)
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    if (lastRefreshTime && now - lastRefreshTime < fiveMinutes) {
      hasRefreshedOnLoginRef.current = true
      return
    }

    hasRefreshedOnLoginRef.current = true
    console.log('🔄 Auto-refreshing feeds on login...')
    handleRefreshAllFeeds()
  }, [user?.npub, feedsLoaded, lastRefreshTime, handleRefreshAllFeeds])

  // Set up 30-minute refresh interval
  useEffect(() => {
    if (!user?.npub) return

    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Set up new interval (30 minutes = 1800000ms)
    const thirtyMinutes = 30 * 60 * 1000
    refreshIntervalRef.current = setInterval(() => {
      console.log('🔄 Auto-refreshing feeds (30-minute interval)...')
      handleRefreshAllFeeds()
    }, thirtyMinutes)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [user?.npub, handleRefreshAllFeeds])

  const markAsReadMutation = api.feed.markAsRead.useMutation({
    onSuccess: (_data, { itemId }) => {
      updateFeedItemCache(itemId, () => ({ isRead: true }))
      invalidateFeedData()
    },
  })
  const markAsUnreadMutation = api.feed.markAsUnread.useMutation({
    onSuccess: (_data, { itemId }) => {
      updateFeedItemCache(itemId, () => ({ isRead: false }))
      invalidateFeedData()
    },
  })
  
  const markAllAsReadMutation = api.feed.markFeedAsRead.useMutation({
    onSuccess: () => {
      invalidateFeedData()
    },
  })
  
  const addFavoriteMutation = api.feed.addFavorite.useMutation({
    onSuccess: invalidateFeedData,
  })
  
  const removeFavoriteMutation = api.feed.removeFavorite.useMutation({
    onSuccess: invalidateFeedData,
  })
  
  // Prepare feeds list with "All Items" option
  const allFeeds: Feed[] = [
    {
      id: 'all',
      title: 'All Items',
      type: 'RSS' as const,
      unreadCount: feedItemsData?.items.filter(item => !item.isRead).length || 0,
    },
    ...feeds.map(feed => ({
      id: feed.id,
      title: feed.title,
      type: feed.type as 'RSS' | 'NOSTR' | 'NOSTR_VIDEO',
      unreadCount: feed.unreadCount,
      url: feed.url || undefined,
      npub: feed.npub || undefined,
      tags: feed.tags,
      categoryId: feed.categoryId || undefined,
    })),
  ]
  
  // Calculate filtered tags based on currently visible feeds
  // When tags are selected, only show tags that appear on the filtered feeds
  const filteredTags = selectedTags.length > 0 
    ? (() => {
        const tagMap = new Map<string, { tag: string; unreadCount: number; feedCount: number }>()
        
        // Only count tags from feeds that match the current filter
        for (const feed of feeds) {
          const feedUnreadCount = feed.unreadCount || 0
          
          for (const tag of (feed.tags || [])) {
            const existing = tagMap.get(tag)
            if (existing) {
              existing.unreadCount += feedUnreadCount
              existing.feedCount += 1
            } else {
              tagMap.set(tag, {
                tag,
                unreadCount: feedUnreadCount,
                feedCount: 1,
              })
            }
          }
        }
        
        const tags = Array.from(tagMap.values())
        return tagSortOrder === 'unread'
          ? tags.sort((a, b) => b.unreadCount - a.unreadCount || a.tag.localeCompare(b.tag))
          : tags.sort((a, b) => a.tag.localeCompare(b.tag))
      })()
    : tagSortOrder === 'unread'
      ? [...userTags].sort((a, b) => b.unreadCount - a.unreadCount || a.tag.localeCompare(b.tag))
      : userTags
  
  // Filter and sort feed items based on view options
  const allFeedItems = feedItemsData?.items || []
  let feedItems = allFeedItems
  
  // Apply read/unread filter
  if (viewFilter === 'unread') {
    feedItems = feedItems.filter((item: any) => !item.isRead)
  } else if (viewFilter === 'read') {
    feedItems = feedItems.filter((item: any) => item.isRead)
  }
  
  // Apply sort order
  if (sortOrder === 'oldest') {
    feedItems = [...feedItems].reverse()
  }
  
  const selectedItemData = selectedItem
    ? (feedItems.find(item => item.id === selectedItem) || allFeedItems.find(item => item.id === selectedItem) || null)
    : null
  const selectedItemOriginalUrl = selectedItemData?.originalUrl ?? selectedItemData?.url
  const selectedItemIsRead = selectedItemData?.isRead ?? false

  useEffect(() => {
    if (markReadTimeoutRef.current) {
      clearTimeout(markReadTimeoutRef.current)
      markReadTimeoutRef.current = null
    }

    if (markReadBehavior !== 'after-10s' || !selectedItem || selectedItemIsRead) {
      return
    }

    const timeoutId = setTimeout(() => {
      markAsReadMutation.mutate({ itemId: selectedItem })
    }, 10000)

    markReadTimeoutRef.current = timeoutId

    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current)
        markReadTimeoutRef.current = null
      }
    }
  }, [selectedItem, markReadBehavior, selectedItemIsRead, markAsReadMutation])
  
  // Handle adding new feed
  const handleAddFeed = async (type: 'RSS' | 'NOSTR', url?: string, npub?: string, title?: string, tags?: string[], categoryId?: string) => {
    try {
      await subscribeFeedMutation.mutateAsync({
        type,
        url,
        npub,
        title,
        tags,
        categoryId,
      })
    } catch (error) {
      // Error is handled by onError callback
    }
  }
  
  // Handle marking item as read when clicked
  const handleItemClick = (itemId: string) => {
    setSelectedItem(itemId)
    const item = allFeedItems.find(i => i.id === itemId)
    if (markReadBehavior === 'on-open' && item && !item.isRead) {
      updateFeedItemCache(itemId, () => ({ isRead: true }))
      markAsReadMutation.mutate({ itemId })
    }
  }

  const handleToggleReadStatus = (item: FeedItem | null) => {
    if (!item) return
    if (item.isRead) {
      markAsUnreadMutation.mutate({ itemId: item.id })
    } else {
      markAsReadMutation.mutate({ itemId: item.id })
    }
  }
  
  // Handle toggling favorite status
  const handleToggleFavorite = (itemId: string, isFavorited: boolean) => {
    updateFeedItemCache(itemId, () => ({ isFavorited: !isFavorited }))
    if (isFavorited) {
      removeFavoriteFromCache(itemId)
      removeFavoriteMutation.mutate({ itemId })
    } else {
      const sourceItem = allFeedItems.find(item => item.id === itemId)
      if (sourceItem) {
        addFavoriteToCache({ ...sourceItem, isFavorited: true })
      }
      addFavoriteMutation.mutate({ itemId })
    }
  }

  // Handle sharing to Nostr
  const handleShareToNostr = async (item: FeedItem, originalUrl: string | null | undefined) => {
    if (!window.nostr) {
      alert('Please install a Nostr browser extension (like Alby or nos2x) to share posts.')
      return
    }

    setIsSharing(true)
    setShareSuccess(false)

    try {
      // Get the user's public key
      const pubkey = await window.nostr.getPublicKey()
      
      // Build the share URL - for Nostr posts use habla.news, otherwise use original URL
      const shareUrl = originalUrl || item.url || ''
      
      // Create the note content with attribution
      const noteContent = `📖 ${item.title}\n\n${shareUrl}\n\n— shared from nostrfeedz.com`

      // Create unsigned event (kind 1 = short text note)
      const unsignedEvent = {
        kind: 1,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [] as string[][],
        content: noteContent,
      }

      // Sign the event using NIP-07
      const signedEvent = await window.nostr.signEvent(unsignedEvent)

      if (!signedEvent) {
        throw new Error('Failed to sign event')
      }

      // Publish to relays
      const pool = new SimplePool()
      const relays = [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.nostr.band',
        'wss://relay.snort.social',
      ]

      // Publish and wait for at least one relay to confirm
      const publishPromises = pool.publish(relays, signedEvent)
      await Promise.race(publishPromises)
      pool.close(relays)

      setShareSuccess(true)
      setTimeout(() => setShareSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to share to Nostr:', error)
      alert('Failed to share to Nostr. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  // Handle importing feeds from Nostr sync
  const handleImportFeeds = async (feedsToImport: Array<{ type: 'RSS' | 'NOSTR'; url: string; tags?: string[] }>) => {
    for (const feed of feedsToImport) {
      try {
        if (feed.type === 'RSS') {
          await subscribeFeedMutation.mutateAsync({
            type: 'RSS',
            url: feed.url,
            tags: feed.tags,
          })
        } else {
          // For Nostr feeds, the url field contains the npub
          await subscribeFeedMutation.mutateAsync({
            type: 'NOSTR',
            npub: feed.url,
            tags: feed.tags,
          })
        }
      } catch (error) {
        console.error(`Failed to import feed: ${feed.url}`, error)
      }
    }
  }
  
  // Handle removing a feed
  const handleRemoveFeed = (feedId: string, feedTitle: string) => {
    if (confirm(`Are you sure you want to unsubscribe from "${feedTitle}"?`)) {
      unsubscribeFeedMutation.mutate({ feedId })
    }
  }
  
  // Handle refreshing a feed
  const handleRefreshFeed = (feedId: string, feedType: 'RSS' | 'NOSTR' | 'NOSTR_VIDEO') => {
    if (feedType === 'RSS') {
      refreshFeedMutation.mutate({ feedId })
    } else {
      refreshNostrFeedMutation.mutate({ feedId })
    }
  }

  // Handle marking all items in a feed as read
  const handleMarkAllAsRead = (feedId: string) => {
    markAllAsReadMutation.mutate({ feedId })
    setOpenMenuFeedId(null)
  }

  // Handle tag selection
  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
    // Reset to "All Items" when filtering by tags
    setSelectedFeed('all')
    // Close sidebar on mobile when tag is selected
    setShowSidebar(false)
  }

  const handleClearTags = () => {
    setSelectedTags([])
  }

  // Handle opening edit menu
  const handleOpenEditMenu = (feedId: string, currentTags: string[]) => {
    setEditingFeedId(feedId)
    setEditTags([...currentTags])
    setEditTagInput('')
    setOpenMenuFeedId(null)
  }

  // Handle adding tag in edit mode
  const handleAddEditTag = () => {
    const trimmed = editTagInput.trim()
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed])
      setEditTagInput('')
    }
  }

  // Handle removing tag in edit mode
  const handleRemoveEditTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag))
  }

  // Handle saving edited tags
  const handleSaveEditedTags = (feedId: string) => {
    updateTagsMutation.mutate({ feedId, tags: editTags })
  }

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingFeedId(null)
    setEditTags([])
    setEditTagInput('')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nostr Feedz</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-sm"
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-sm"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              onClick={() => setShowAddFeed(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Mobile Feeds/Tags Toggle */}
        <div className="px-4 pb-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => {
                setSidebarView('feeds')
                setSelectedTags([])
                setShowSidebar(true)
              }}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'feeds'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Feeds
            </button>
            <button
              onClick={() => {
                setSidebarView('tags')
                setShowSidebar(true)
              }}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'tags'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Tags
            </button>
            <button
              onClick={() => {
                setSidebarView('favorites')
                setSelectedTags([])
                setShowSidebar(true)
              }}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'favorites'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              ⭐
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop for mobile sidebar */}
      {showSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-[45]"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar - Feeds/Tags */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:relative
        fixed inset-y-0 left-0 z-50
        w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col max-h-screen
        transition-transform duration-300 ease-in-out
        pt-32 md:pt-0
      `}>
        {/* Header - Hidden on mobile (shown in top bar instead) */}
        <div className="hidden md:block p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">{/* flex-shrink-0 keeps header fixed */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nostr Feedz</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshAllFeeds}
                disabled={isRefreshingAll}
                className={`text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-sm ${isRefreshingAll ? 'animate-spin' : ''}`}
                title={isRefreshingAll ? 'Refreshing...' : `Refresh all feeds${lastRefreshTime ? ` (last: ${new Date(lastRefreshTime).toLocaleTimeString()})` : ''}`}
              >
                🔄
              </button>
              <button
                onClick={toggleTheme}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-sm"
                title="Toggle theme"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 text-sm"
                title="Settings"
              >
                ⚙️
              </button>
              <button
                onClick={() => setShowAddFeed(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
              >
                Add Feed
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 truncate flex items-center gap-2">
            <span>{user?.npub}</span>
            {isRefreshingAll && <span className="text-blue-500">Refreshing feeds...</span>}
          </div>
        </div>

        {/* View Toggle */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => {
                setSidebarView('feeds')
                setSelectedTags([])
                setSelectedCategoryId(null)
              }}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'feeds'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Feeds
            </button>
            <button
              onClick={() => setSidebarView('tags')}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'tags'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {organizationMode === 'categories' ? 'Categories' : 'Tags'}
            </button>
            <button
              onClick={() => {
                setSidebarView('favorites')
                setSelectedTags([])
                setSelectedCategoryId(null)
              }}
              className={`flex-1 px-2 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'favorites'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              ⭐
            </button>
          </div>
        </div>

        {/* Active Tag Filters */}
        {selectedTags.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-900 dark:text-blue-300">Filtered by:</span>
              <button
                onClick={handleClearTags}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-500/30 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  {tag}
                  <button
                    onClick={() => handleToggleTag(tag)}
                    className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Feeds List */}
        {sidebarView === 'feeds' && (
          <div className="flex-1 overflow-y-auto">{/* Scrollable feed list */}
          {allFeeds.map((feed) => (
            <div
              key={feed.id}
              className={`relative group w-full text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${
                selectedFeed === feed.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <button
                onClick={() => {
                  setSelectedFeed(feed.id)
                  setShowSidebar(false)
                }}
                className="w-full px-4 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">
                      {feed.type === 'RSS' ? '📰' : feed.type === 'NOSTR_VIDEO' ? '🎬' : '⚡'}
                    </span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {feed.title}
                    </span>
                  </div>
                  {feed.unreadCount > 0 && (
                    <span className="text-xs bg-blue-500 text-white rounded-full px-2 py-1 min-w-[20px] text-center">
                      {feed.unreadCount}
                    </span>
                  )}
                </div>
                {feed.url && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                    {new URL(feed.url).hostname}
                  </div>
                )}
                {feed.npub && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                    {feed.npub.slice(0, 16)}...
                  </div>
                )}
                {/* Show tags if any */}
                {feed.tags && feed.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {feed.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
              
              {/* Menu button - only show for actual feeds, not "All Items" */}
              {feed.id !== 'all' && (
                <div className="absolute right-2 top-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuFeedId(openMenuFeedId === feed.id ? null : feed.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-full w-6 h-6 flex items-center justify-center text-sm"
                    title="Menu"
                  >
                    ⋮
                  </button>
                  
                  {/* Dropdown menu */}
                  {openMenuFeedId === feed.id && !showCategoryPicker && (
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRefreshFeed(feed.id, feed.type)
                          setOpenMenuFeedId(null)
                        }}
                        disabled={refreshFeedMutation.isLoading || refreshNostrFeedMutation.isLoading}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 rounded-t-lg"
                      >
                        🔄 Refresh
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAllAsRead(feed.id)
                        }}
                        disabled={markAllAsReadMutation.isLoading || feed.unreadCount === 0}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 border-t border-slate-100 dark:border-slate-600"
                      >
                        ✓ Mark All as Read
                      </button>
                      {organizationMode === 'categories' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowCategoryPicker(feed.id)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 border-t border-slate-100 dark:border-slate-600"
                        >
                          {(() => {
                            const cat = categories?.find((c: any) => c.id === feed.categoryId)
                            return cat 
                              ? <span>📁 <span className="text-slate-500 dark:text-slate-400">{cat.icon || '📁'} {cat.name}</span></span>
                              : '📁 Set Category'
                          })()}
                        </button>
                      )}
                      {organizationMode === 'tags' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const currentFeed = feeds.find((f: any) => f.id === feed.id)
                            handleOpenEditMenu(feed.id, currentFeed?.tags || [])
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 border-t border-slate-100 dark:border-slate-600"
                        >
                          🏷️ Edit Tags
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFeed(feed.id, feed.title)
                          setOpenMenuFeedId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-600 border-t border-slate-100 dark:border-slate-600 rounded-b-lg"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                  
                  {/* Category Picker Dropdown */}
                  {showCategoryPicker === feed.id && (
                    <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 z-10">
                      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-600 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Set Category</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowCategoryPicker(null)
                            setOpenMenuFeedId(null)
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateCategoryMutation.mutate({ feedId: feed.id, categoryId: null })
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 ${
                            !feed.categoryId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                          }`}
                        >
                          <span className="text-base">📋</span>
                          <span className="text-slate-700 dark:text-slate-200">No Category</span>
                        </button>
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              updateCategoryMutation.mutate({ feedId: feed.id, categoryId: cat.id })
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-2 ${
                              feed.categoryId === cat.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                          >
                            <span 
                              className="w-5 h-5 rounded flex items-center justify-center text-xs"
                              style={{ backgroundColor: cat.color ?? '#94a3b8' }}
                            >
                              {cat.icon || '📁'}
                            </span>
                            <span className="text-slate-700 dark:text-slate-200">{cat.name}</span>
                          </button>
                        ))}
                      </div>
                      {categories.length === 0 && (
                        <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                          No categories yet. Create them in Settings.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        {/* Tags/Categories List */}
        {sidebarView === 'tags' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Sort Options - only for tags mode */}
            {organizationMode === 'tags' && (
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sort by:</span>
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-md p-0.5">
                  <button
                    onClick={() => setTagSortOrder('alphabetical')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      tagSortOrder === 'alphabetical'
                        ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    A-Z
                  </button>
                  <button
                    onClick={() => setTagSortOrder('unread')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      tagSortOrder === 'unread'
                        ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Unread
                  </button>
                </div>
              </div>
            )}
            
            {/* Categories Mode */}
            {organizationMode === 'categories' && (
              <>
                {categoriesWithUnread.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                    No categories yet. Create them in Settings!
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {/* All Items option */}
                    <button
                      onClick={() => setSelectedCategoryId(null)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${
                        !selectedCategoryId ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">📋</span>
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            All Categories
                          </span>
                        </div>
                      </div>
                    </button>
                    {categoriesWithUnread.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${
                          selectedCategoryId === cat.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span 
                              className="w-6 h-6 rounded flex items-center justify-center text-sm"
                              style={{ backgroundColor: cat.color ?? '#94a3b8' }}
                            >
                              {cat.icon || '📁'}
                            </span>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {cat.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{cat.feedCount} feeds</span>
                            {cat.unreadCount > 0 && (
                              <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                {cat.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            
            {/* Tags Mode */}
            {organizationMode === 'tags' && (
              <>
                {filteredTags.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                    {selectedTags.length > 0 
                      ? 'No additional tags found in filtered feeds'
                      : 'No tags yet. Add tags when subscribing to feeds!'}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {filteredTags.map(({ tag, unreadCount, feedCount }) => (
                      <button
                        key={tag}
                        onClick={() => handleToggleTag(tag)}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${
                          selectedTags.includes(tag) ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs">🏷️</span>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {tag}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{feedCount} feeds</span>
                            {unreadCount > 0 && (
                              <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Favorites List */}
        {sidebarView === 'favorites' && (
          <div className="flex-1 overflow-y-auto">
            {favoritesLoading ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                Loading favorites...
              </div>
            ) : !favoritesData?.items || favoritesData.items.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                No favorites yet. Star items to save them here!
              </div>
            ) : (
              favoritesData.items.map((item: any) => (
                <div
                  key={item.id}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 ${
                    selectedItem === item.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => {
                        setSelectedItem(item.id)
                        setMobileView('content')
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs">⭐</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.feedTitle || 'Unknown Feed'}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1 line-clamp-2">
                        {item.title}
                      </h3>
                      {item.snippet && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {item.snippet}
                        </p>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleFavorite(item.id, true)
                      }}
                      className="p-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-md"
                      title="Remove from favorites"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">{/* flex-shrink-0 keeps footer fixed */}
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Center Panel - Article List */}
      <div className={`
        ${mobileView === 'content' && selectedItem ? 'hidden md:flex' : 'flex'}
        w-full md:w-96 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col max-h-screen
        pt-32 md:pt-0
      `}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">
              {selectedFeed === 'all' ? 'All Items' : 
               allFeeds.find(f => f.id === selectedFeed)?.title || 'Select a feed'}
            </h2>
            
            {/* View Options Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowViewOptions(!showViewOptions)
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
                title="View options"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {/* Dropdown menu */}
              {showViewOptions && (
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 z-10">
                  <div className="py-1">
                    <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Show</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewFilter('all')
                        setShowViewOptions(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                        viewFilter === 'all' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {viewFilter === 'all' && '✓ '}All Items
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewFilter('unread')
                        setShowViewOptions(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                        viewFilter === 'unread' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {viewFilter === 'unread' && '✓ '}Unread Only
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewFilter('read')
                        setShowViewOptions(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                        viewFilter === 'read' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {viewFilter === 'read' && '✓ '}Read Only
                    </button>
                    
                    <div className="border-t border-slate-100 dark:border-slate-600 mt-1 pt-1">
                      <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Sort</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSortOrder('newest')
                          setShowViewOptions(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                          sortOrder === 'newest' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {sortOrder === 'newest' && '✓ '}Newest First
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSortOrder('oldest')
                          setShowViewOptions(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                          sortOrder === 'oldest' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {sortOrder === 'oldest' && '✓ '}Oldest First
                      </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-600 mt-1 pt-1">
                      <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Mark as read</div>
                      {QUICK_MARK_READ_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkReadBehaviorChange(option.value)
                            setShowViewOptions(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-600 ${
                            markReadBehavior === option.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex flex-col text-left">
                            <span>{markReadBehavior === option.value ? '✓ ' : ''}{option.label}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{option.helper}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {allFeedItems.filter(item => !item.isRead).length} unread
            {viewFilter !== 'all' && (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                • Showing {viewFilter === 'unread' ? 'unread' : 'read'} only
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{/* This makes the list scrollable */}
          {itemsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center text-slate-500 dark:text-slate-400">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-sm">
                  {viewFilter === 'unread' && 'No unread items'}
                  {viewFilter === 'read' && 'No read items'}
                  {viewFilter === 'all' && 'No items to display'}
                </p>
              </div>
            </div>
          ) : (
            feedItems.map((item) => (
              <div
                key={item.id}
                className={`relative w-full text-left border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                  selectedItem === item.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                } ${item.isRead ? 'opacity-70' : ''}`}
              >
                <button
                  onClick={() => {
                    handleItemClick(item.id)
                    setMobileView('content')
                  }}
                  className="w-full p-4 pr-12"
                >
                  <div className="space-y-2">
                    <h3 className={`text-sm font-medium ${item.isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {item.title}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.author} • {item.publishedAt.toLocaleDateString()}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {item.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{item.feedTitle}</span>
                      {!item.isRead && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleFavorite(item.id, item.isFavorited || false)
                  }}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                  title={item.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className="text-base">
                    {item.isFavorited ? '⭐' : '☆'}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Article Content */}
      <div className={`
        ${mobileView === 'list' && selectedItem ? 'hidden md:flex' : 'flex'}
        flex-1 bg-white dark:bg-slate-800 flex-col max-h-screen
        pt-32 md:pt-0
      `}>
        {/* Mobile Back Button */}
        {selectedItem && (
          <button
            onClick={() => setMobileView('list')}
            className="md:hidden fixed top-20 left-4 z-50 p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg"
          >
            <svg className="w-6 h-6 text-slate-800 dark:text-slate-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        
        {selectedItemData ? (
          <>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">{/* Fixed header */}
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex-1 pr-4">
                  {selectedItemData.title}
                </h1>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleReadStatus(selectedItemData)}
                    className="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {selectedItemData.isRead ? 'Mark as Unread' : 'Mark as Read'}
                  </button>
                  <button
                    onClick={() => handleShareToNostr(selectedItemData, selectedItemOriginalUrl)}
                    disabled={isSharing}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex-shrink-0 relative"
                    title="Share to Nostr"
                  >
                    {isSharing ? (
                      <span className="text-lg animate-spin">⏳</span>
                    ) : shareSuccess ? (
                      <span className="text-lg text-green-500">✓</span>
                    ) : (
                      <span className="text-lg">📤</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleFavorite(selectedItemData.id, selectedItemData.isFavorited || false)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex-shrink-0"
                    title={selectedItemData.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <span className="text-2xl">
                      {selectedItemData.isFavorited ? '⭐' : '☆'}
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                <span>{selectedItemData.author}</span>
                <span>•</span>
                <span>{selectedItemData.publishedAt.toLocaleDateString()}</span>
                <span>•</span>
                <span>{selectedItemData.feedTitle}</span>
                {selectedItemOriginalUrl && (
                  <>
                    <span>•</span>
                    <a
                      href={selectedItemOriginalUrl}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {selectedItemData.feedType === 'NOSTR' || selectedItemData.feedType === 'NOSTR_VIDEO' ? 'View on Nostr' : 'View Original'}
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800/50">
              <div className="max-w-3xl mx-auto p-8">
                <FormattedContent 
                  content={selectedItemData.content}
                  embedUrl={selectedItemData.embedUrl ?? undefined}
                  thumbnail={selectedItemData.thumbnail ?? undefined}
                  title={selectedItemData.title}
                  className="prose prose-lg dark:prose-invert max-w-none"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-500 dark:text-slate-400">
              <div className="text-4xl mb-4">📖</div>
              <p className="text-lg">Select an article to read</p>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Add Feed Modal */}
      <AddFeedModal
        isOpen={showAddFeed}
        onClose={() => {
          setShowAddFeed(false)
          setFeedError('')
        }}
        onAddFeed={handleAddFeed}
        isLoading={subscribeFeedMutation.isLoading}
        error={feedError}
        organizationMode={organizationMode}
        categories={categories}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        markReadBehavior={markReadBehavior}
        onChangeMarkReadBehavior={handleMarkReadBehaviorChange}
        organizationMode={organizationMode}
        onChangeOrganizationMode={handleOrganizationModeChange}
        feeds={feeds.map((f) => ({ 
          type: f.type, 
          url: f.url || f.npub || '', 
          tags: f.tags 
        }))}
        userPubkey={user?.npub || user?.pubkey}
        onImportFeeds={handleImportFeeds}
      />

      {/* Sync Prompt Dialog */}
      {showSyncPrompt && pendingSyncImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-96 max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">📡 Sync Available</h2>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Found {pendingSyncImport.length} subscription(s) from another device. Would you like to import them?
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-h-32 overflow-y-auto space-y-1">
                {pendingSyncImport.map((feed, i) => (
                  <li key={i} className="truncate">
                    • [{feed.type}] {feed.url}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSyncPrompt(false)
                  setPendingSyncImport(null)
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              >
                Not Now
              </button>
              <button
                onClick={async () => {
                  await handleImportFeeds(pendingSyncImport)
                  setShowSyncPrompt(false)
                  setPendingSyncImport(null)
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Import All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tags Dialog */}
      {editingFeedId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Tags</h2>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tags
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEditTag()
                      }
                    }}
                    placeholder="Add a tag..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditTag}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-500/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveEditTag(tag)}
                        className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEditedTags(editingFeedId)}
                disabled={updateTagsMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
              >
                {updateTagsMutation.isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}