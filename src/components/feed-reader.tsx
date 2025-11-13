'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useState, useEffect } from 'react'
import { api } from '@/trpc/react'
import { AddFeedModal } from './add-feed-modal'
import { SettingsDialog } from './settings-dialog'
import { FormattedContent } from './formatted-content'

interface Feed {
  id: string
  title: string
  type: 'RSS' | 'NOSTR'
  unreadCount: number
  url?: string
  npub?: string
  tags?: string[]
}

interface FeedItem {
  id: string
  title: string
  content: string
  author?: string
  publishedAt: Date
  url?: string
  isRead: boolean
  feedTitle: string
}

export function FeedReader() {
  const { user, disconnect } = useNostrAuth()
  const { theme, toggleTheme } = useTheme()
  const [selectedFeed, setSelectedFeed] = useState<string | null>('all')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [feedError, setFeedError] = useState<string>('')
  const [sidebarView, setSidebarView] = useState<'feeds' | 'tags'>('feeds')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [openMenuFeedId, setOpenMenuFeedId] = useState<string | null>(null)
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState('')
  const [showViewOptions, setShowViewOptions] = useState(false)
  const [viewFilter, setViewFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  
  // Mobile responsive state
  const [showSidebar, setShowSidebar] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'content'>('list')

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
  const { data: feeds = [], refetch: refetchFeeds } = api.feed.getFeeds.useQuery(
    selectedTags.length > 0 ? { tags: selectedTags } : undefined,
    {
      enabled: !!user && !!user.npub,
    }
  )
  
  const { data: userTags = [] } = api.feed.getUserTags.useQuery(undefined, {
    enabled: !!user && !!user.npub,
  })
  
  // When tags are selected and viewing "All Items", we need to filter items 
  // to only show items from feeds that match the selected tags
  const filteredFeedIds = selectedTags.length > 0 && selectedFeed === 'all'
    ? feeds.map((f: any) => f.id)
    : undefined
  
  const { data: feedItemsData, isLoading: itemsLoading } = api.feed.getFeedItems.useQuery(
    { 
      feedId: selectedFeed === 'all' ? undefined : selectedFeed ?? undefined,
      feedIds: filteredFeedIds, // Pass filtered feed IDs when tags are selected
    },
    { enabled: !!user && !!user.npub }
  )
  
  // Mutations
  const subscribeFeedMutation = api.feed.subscribeFeed.useMutation({
    onSuccess: () => {
      refetchFeeds()
      setShowAddFeed(false)
      setFeedError('')
    },
    onError: (error) => {
      setFeedError(error.message)
    },
  })
  
  const unsubscribeFeedMutation = api.feed.unsubscribeFeed.useMutation({
    onSuccess: () => {
      refetchFeeds()
      // If the deleted feed was selected, switch to "All Items"
      setSelectedFeed('all')
    },
  })
  
  const refreshFeedMutation = api.feed.refreshFeed.useMutation({
    onSuccess: () => {
      refetchFeeds()
    },
  })
  
  const refreshNostrFeedMutation = api.feed.refreshNostrFeed.useMutation({
    onSuccess: () => {
      refetchFeeds()
    },
  })
  
  const updateTagsMutation = api.feed.updateSubscriptionTags.useMutation({
    onSuccess: () => {
      refetchFeeds()
      setEditingFeedId(null)
      setEditTags([])
      setEditTagInput('')
    },
  })
  
  const markAsReadMutation = api.feed.markAsRead.useMutation()
  
  const markAllAsReadMutation = api.feed.markFeedAsRead.useMutation({
    onSuccess: () => {
      refetchFeeds()
    },
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
      type: feed.type as 'RSS' | 'NOSTR',
      unreadCount: feed.unreadCount,
      url: feed.url || undefined,
      npub: feed.npub || undefined,
      tags: feed.tags,
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
        
        return Array.from(tagMap.values()).sort((a, b) => a.tag.localeCompare(b.tag))
      })()
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
  
  const selectedItemData = selectedItem ? feedItems.find(item => item.id === selectedItem) : null
  
  // Handle adding new feed
  const handleAddFeed = async (type: 'RSS' | 'NOSTR', url?: string, npub?: string, title?: string, tags?: string[]) => {
    try {
      await subscribeFeedMutation.mutateAsync({
        type,
        url,
        npub,
        title,
        tags,
      })
    } catch (error) {
      // Error is handled by onError callback
    }
  }
  
  // Handle marking item as read when clicked
  const handleItemClick = (itemId: string) => {
    setSelectedItem(itemId)
    const item = feedItems.find(i => i.id === itemId)
    if (item && !item.isRead) {
      markAsReadMutation.mutate({ itemId })
    }
  }
  
  // Handle removing a feed
  const handleRemoveFeed = (feedId: string, feedTitle: string) => {
    if (confirm(`Are you sure you want to unsubscribe from "${feedTitle}"?`)) {
      unsubscribeFeedMutation.mutate({ feedId })
    }
  }
  
  // Handle refreshing a feed
  const handleRefreshFeed = (feedId: string, feedType: 'RSS' | 'NOSTR') => {
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
              className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
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
              className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'tags'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Tags
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
          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {user?.npub}
          </div>
        </div>

        {/* View Toggle */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => {
                setSidebarView('feeds')
                setSelectedTags([])
              }}
              className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'feeds'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Feeds
            </button>
            <button
              onClick={() => setSidebarView('tags')}
              className={`flex-1 px-3 py-1 text-sm rounded-md transition-colors ${
                sidebarView === 'tags'
                  ? 'bg-white dark:bg-slate-600 shadow-sm font-medium text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Tags
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
                      {feed.type === 'RSS' ? '📰' : '⚡'}
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
                  {openMenuFeedId === feed.id && (
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
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        {/* Tags List */}
        {sidebarView === 'tags' && (
          <div className="flex-1 overflow-y-auto">
            {filteredTags.length === 0 ? (
              <div className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm">
                {selectedTags.length > 0 
                  ? 'No additional tags found in filtered feeds'
                  : 'No tags yet. Add tags when subscribing to feeds!'}
              </div>
            ) : (
              filteredTags.map(({ tag, unreadCount, feedCount }) => (
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
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">{/* flex-shrink-0 keeps footer fixed */}
          <button
            onClick={disconnect}
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
              <button
                key={item.id}
                onClick={() => {
                  handleItemClick(item.id)
                  setMobileView('content')
                }}
                className={`w-full text-left p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                  selectedItem === item.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-l-blue-500' : ''
                } ${item.isRead ? 'opacity-70' : ''}`}
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
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {selectedItemData.title}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                <span>{selectedItemData.author}</span>
                <span>•</span>
                <span>{selectedItemData.publishedAt.toLocaleDateString()}</span>
                <span>•</span>
                <span>{selectedItemData.feedTitle}</span>
                {selectedItemData.url && (
                  <>
                    <span>•</span>
                    <a
                      href={selectedItemData.url}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View Original
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-800/50">
              <div className="max-w-3xl mx-auto p-8">
                <FormattedContent 
                  content={selectedItemData.content}
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
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

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