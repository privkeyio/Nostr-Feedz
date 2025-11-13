'use client'

import { useState, useEffect } from 'react'
import { api } from '@/trpc/react'

interface NostrProfile {
  npub: string
  name?: string
  displayName?: string
  about?: string
  picture?: string
  nip05?: string
  verified?: boolean
}

interface AddFeedModalProps {
  isOpen: boolean
  onClose: () => void
  onAddFeed: (type: 'RSS' | 'NOSTR', url?: string, npub?: string, title?: string, tags?: string[]) => void
  isLoading?: boolean
  error?: string
}

export function AddFeedModal({ isOpen, onClose, onAddFeed, isLoading = false, error: externalError }: AddFeedModalProps) {
  const [feedType, setFeedType] = useState<'RSS' | 'NOSTR'>('RSS')
  const [rssUrl, setRssUrl] = useState('')
  const [nostrSearch, setNostrSearch] = useState('')
  const [manualNpub, setManualNpub] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [searchResults, setSearchResults] = useState<NostrProfile[]>([])
  const [popularUsers, setPopularUsers] = useState<NostrProfile[]>([])
  const [internalError, setInternalError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  
  const error = externalError || internalError
  
  // Helper to get relays from localStorage
  const getRelays = (): string[] | undefined => {
    if (typeof window === 'undefined') return undefined
    const saved = localStorage.getItem('nostr_relays')
    if (saved) {
      try {
        const relays = JSON.parse(saved)
        return Array.isArray(relays) && relays.length > 0 ? relays : undefined
      } catch {
        return undefined
      }
    }
    return undefined
  }

  // tRPC mutations
  const searchProfilesMutation = api.feed.searchProfiles.useMutation({
    onSuccess: (data) => {
      // Deduplicate by npub
      const uniqueProfiles = data.profiles.reduce((acc, profile) => {
        if (!acc.find(p => p.npub === profile.npub)) {
          acc.push(profile)
        }
        return acc
      }, [] as NostrProfile[])
      setSearchResults(uniqueProfiles)
    },
    onError: (error) => {
      console.error('Profile search failed:', error)
      setSearchResults([])
    },
  })

  const getPopularUsersMutation = api.feed.getPopularUsers.useMutation({
    onSuccess: (data) => {
      // Deduplicate by npub
      const uniqueProfiles = data.profiles.reduce((acc, profile) => {
        if (!acc.find(p => p.npub === profile.npub)) {
          acc.push(profile)
        }
        return acc
      }, [] as NostrProfile[])
      setPopularUsers(uniqueProfiles)
    },
  })

  // Load popular users when modal opens and Nostr is selected
  useEffect(() => {
    if (isOpen && feedType === 'NOSTR' && popularUsers.length === 0) {
      getPopularUsersMutation.mutate({ 
        limit: 15,
        relays: getRelays()
      })
    }
  }, [isOpen, feedType])

  // Debounced search
  useEffect(() => {
    if (!nostrSearch.trim() || nostrSearch.length < 2) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      searchProfilesMutation.mutate({ 
        query: nostrSearch,
        limit: 10,
        relays: getRelays()
      })
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [nostrSearch])

  const handleAddFeed = () => {
    setInternalError('')
    if (feedType === 'RSS') {
      if (!rssUrl.trim()) return
      
      // Clear any previous errors and let tRPC mutation handle validation
      onAddFeed('RSS', rssUrl, undefined, undefined, tags)
    } else {
      const npub = manualNpub.trim()
      if (!npub) return
      if (!npub.startsWith('npub1')) {
        alert('Invalid npub format. Must start with npub1')
        return
      }
      onAddFeed('NOSTR', undefined, npub, undefined, tags)
    }
    handleClose()
  }

  const handleSelectProfile = (profile: NostrProfile) => {
    setManualNpub(profile.npub)
    setShowManualInput(true)
    setNostrSearch('')
    setSearchResults([])
  }

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleClose = () => {
    onClose()
    setRssUrl('')
    setNostrSearch('')
    setManualNpub('')
    setShowManualInput(false)
    setSearchResults([])
    setTagInput('')
    setTags([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add New Feed</h3>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Feed Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Feed Type
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => setFeedType('RSS')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  feedType === 'RSS'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700'
                    : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}
              >
                📰 RSS Feed
              </button>
              <button
                onClick={() => setFeedType('NOSTR')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  feedType === 'NOSTR'
                    ? 'bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700'
                    : 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}
              >
                ⚡ Nostr User
              </button>
            </div>
          </div>

          {/* RSS Input */}
          {feedType === 'RSS' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                RSS Feed URL
              </label>
              {error && (
                <div className="mb-3 rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}
              <input
                type="url"
                value={rssUrl}
                onChange={(e) => {
                  setRssUrl(e.target.value)
                  setInternalError('')
                }}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Enter a feed URL or website homepage - we'll find the feed for you
              </p>
            </div>
          )}

          {/* Nostr Profile Search */}
          {feedType === 'NOSTR' && (
            <div className="space-y-4">
              {!showManualInput ? (
                <>
                  {/* Search Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Search for User
                    </label>
                    <input
                      type="text"
                      value={nostrSearch}
                      onChange={(e) => setNostrSearch(e.target.value)}
                      placeholder="Search by name, NIP-05, or npub..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search Results</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.map((profile, index) => (
                          <button
                            key={`search-${profile.npub}-${index}`}
                            onClick={() => handleSelectProfile(profile)}
                            className="w-full p-3 text-left border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              {profile.picture && (
                                <img
                                  src={profile.picture}
                                  alt={profile.name || 'User'}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {profile.displayName || profile.name || 'Unknown'}
                                  </p>
                                  {profile.nip05 && (
                                    <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                                      {profile.nip05}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                  {profile.about || profile.npub.slice(0, 20) + '...'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Users */}
                  {nostrSearch.length === 0 && popularUsers.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Discover Users</h4>
                      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                        {popularUsers.map((profile, index) => (
                          <button
                            key={`popular-${profile.npub}-${index}`}
                            onClick={() => handleSelectProfile(profile)}
                            className="p-3 text-left border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              {profile.picture && (
                                <img
                                  src={profile.picture}
                                  alt={profile.name || 'User'}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">
                                    {profile.displayName || profile.name || 'Unknown'}
                                  </p>
                                  {profile.nip05 && (
                                    <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-1 py-0.5 rounded">
                                      ✓
                                    </span>
                                  )}
                                </div>
                                {profile.about && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {profile.about.slice(0, 60)}...
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Entry Option */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowManualInput(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Or enter npub manually
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Manual NPub Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nostr npub
                    </label>
                    <input
                      type="text"
                      value={manualNpub}
                      onChange={(e) => setManualNpub(e.target.value)}
                      placeholder="npub1..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setShowManualInput(false)
                      setManualNpub('')
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    ← Back to search
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tags Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tags (optional)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add a tag..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-500/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-blue-900 dark:hover:text-blue-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleAddFeed}
            disabled={
              isLoading || 
              (feedType === 'RSS' && !rssUrl.trim()) ||
              (feedType === 'NOSTR' && !manualNpub.trim())
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
          >
            {isLoading ? 'Adding...' : 'Add Feed'}
          </button>
        </div>
      </div>
    </div>
  )
}