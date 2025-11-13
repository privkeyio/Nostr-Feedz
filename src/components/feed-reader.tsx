'use client'

import { useNostrAuth } from '@/contexts/NostrAuthContext'
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
  const [selectedFeed, setSelectedFeed] = useState<string | null>('all')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [showAddFeed, setShowAddFeed] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [feedError, setFeedError] = useState<string>('')

  // Debug: Log session info
  useEffect(() => {
    console.log('FeedReader - User:', user)
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('nostr_session')
      console.log('FeedReader - Session in localStorage:', session)
    }
  }, [user])
  
  // tRPC queries - only run when user is authenticated
  const { data: feeds = [], refetch: refetchFeeds } = api.feed.getFeeds.useQuery(undefined, {
    enabled: !!user && !!user.npub,
  })
  
  const { data: feedItemsData, isLoading: itemsLoading } = api.feed.getFeedItems.useQuery(
    { feedId: selectedFeed === 'all' ? undefined : selectedFeed ?? undefined },
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
  
  const markAsReadMutation = api.feed.markAsRead.useMutation()
  
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
      url: feed.url,
      npub: feed.npub,
    })),
  ]
  
  const feedItems = feedItemsData?.items || []
  const selectedItemData = selectedItem ? feedItems.find(item => item.id === selectedItem) : null
  
  // Handle adding new feed
  const handleAddFeed = async (type: 'RSS' | 'NOSTR', url?: string, npub?: string, title?: string) => {
    try {
      await subscribeFeedMutation.mutateAsync({
        type,
        url,
        npub,
        title,
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Feeds */}
      <div className="w-64 bg-white border-r border-gray-300 flex flex-col max-h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">{/* flex-shrink-0 keeps header fixed */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-800">Nostr Feedz</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="text-gray-600 hover:text-gray-800 text-sm"
                title="Settings"
              >
                ⚙️
              </button>
              <button
                onClick={() => setShowAddFeed(true)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Add Feed
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-600 truncate">
            {user?.npub}
          </div>
        </div>

        {/* Feeds List */}
        <div className="flex-1 overflow-y-auto">{/* Scrollable feed list */}
          {allFeeds.map((feed) => (
            <div
              key={feed.id}
              className={`relative group w-full text-left hover:bg-gray-50 border-b border-gray-100 ${
                selectedFeed === feed.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <button
                onClick={() => setSelectedFeed(feed.id)}
                className="w-full px-4 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">
                      {feed.type === 'RSS' ? '📰' : '⚡'}
                    </span>
                    <span className="text-sm font-medium text-gray-800 truncate">
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
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {new URL(feed.url).hostname}
                  </div>
                )}
                {feed.npub && (
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {feed.npub.slice(0, 16)}...
                  </div>
                )}
              </button>
              
              {/* Action buttons - only show for actual feeds, not "All Items" */}
              {feed.id !== 'all' && (
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {/* Refresh button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefreshFeed(feed.id, feed.type)
                    }}
                    disabled={refreshFeedMutation.isLoading || refreshNostrFeedMutation.isLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    title="Refresh feed"
                  >
                    ↻
                  </button>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveFeed(feed.id, feed.title)
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    title="Unsubscribe"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">{/* flex-shrink-0 keeps footer fixed */}
          <button
            onClick={disconnect}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Center Panel - Article List */}
      <div className="w-96 bg-white border-r border-gray-300 flex flex-col max-h-screen">
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-semibold text-gray-800">
            {selectedFeed === 'all' ? 'All Items' : 
             allFeeds.find(f => f.id === selectedFeed)?.title || 'Select a feed'}
          </h2>
          <div className="text-sm text-gray-600">
            {feedItems.filter(item => !item.isRead).length} unread
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{/* This makes the list scrollable */}
          {itemsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            feedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                  selectedItem === item.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                } ${item.isRead ? 'opacity-60' : ''}`}
              >
                <div className="space-y-2">
                  <h3 className={`text-sm font-medium ${item.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                    {item.title}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {item.author} • {item.publishedAt.toLocaleDateString()}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {item.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.feedTitle}</span>
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
      <div className="flex-1 bg-white flex flex-col max-h-screen">
        {selectedItemData ? (
          <>
            <div className="p-6 border-b border-gray-200 flex-shrink-0">{/* Fixed header */}
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedItemData.title}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
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
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View Original
                    </a>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-3xl mx-auto p-8">
                <FormattedContent 
                  content={selectedItemData.content}
                  className="prose prose-lg max-w-none"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
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
    </div>
  )
}