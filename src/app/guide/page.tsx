'use client'

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useNostrAuth } from "@/contexts/NostrAuthContext";
import { nip19 } from "nostr-tools";

export default function GuidePage() {
  const { isConnected, getPublicKey } = useNostrAuth();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [orderBy, setOrderBy] = useState<'newest' | 'popular' | 'recent_posts'>('popular');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [editingNpub, setEditingNpub] = useState<string | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');

  const router = useRouter();

  // Fetch guide feeds with filters
  const { data: guideFeeds, isLoading: feedsLoading } = api.guide.getGuideFeeds.useQuery({
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    orderBy,
    limit: 50,
  });

  // Fetch all available tags
  const { data: availableTags } = api.guide.getGuideTags.useQuery();

  const subscribeMutation = api.feed.subscribeFeed.useMutation();
  const incrementSubscriberMutation = api.guide.incrementSubscriberCount.useMutation();
  const updateTagsMutation = api.guide.updateOwnTags.useMutation();
  const deleteEntryMutation = api.guide.deleteOwnEntry.useMutation();

  const utils = api.useUtils();

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCopyRssUrl = (npub: string, tags: string[]) => {
    const tagsParam = tags.length > 0 ? `&tags=${encodeURIComponent(tags.join(','))}` : '';
    const url = `${window.location.origin}/api/nostr-rss?npub=${encodeURIComponent(npub)}${tagsParam}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(npub);
      setTimeout(() => setCopySuccess(null), 2000);
    });
  };

  const handleSubscribe = async (npub: string, displayName: string, tags: string[]) => {
    if (!isConnected) {
      router.push('/reader');
      return;
    }

    try {
      await subscribeMutation.mutateAsync({ 
        type: 'NOSTR', 
        npub,
        title: displayName,
        tags: tags, // Pass the tags from the guide feed
      });
      
      // Increment subscriber count in guide
      await incrementSubscriberMutation.mutateAsync({ npub });
      
      router.push('/reader');
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
    }
  };

  const handleStartEdit = (npub: string, currentTags: string[]) => {
    setEditingNpub(npub);
    setEditTags([...currentTags]);
    setEditTagInput('');
  };

  const handleCancelEdit = () => {
    setEditingNpub(null);
    setEditTags([]);
    setEditTagInput('');
  };

  const handleAddEditTag = () => {
    const trimmed = editTagInput.trim();
    if (trimmed && !editTags.includes(trimmed) && editTags.length < 10) {
      setEditTags([...editTags, trimmed]);
      setEditTagInput('');
    }
  };

  const handleRemoveEditTag = (tag: string) => {
    setEditTags(editTags.filter(t => t !== tag));
  };

  const handleSaveTags = async () => {
    if (editTags.length === 0) {
      alert('Please add at least one tag');
      return;
    }

    try {
      await updateTagsMutation.mutateAsync({ tags: editTags });
      await utils.guide.getGuideFeeds.invalidate();
      setEditingNpub(null);
      setEditTags([]);
    } catch (error: any) {
      alert(error.message || 'Failed to update tags');
    }
  };

  const handleDeleteEntry = async (npub: string, displayName: string) => {
    if (!confirm(`Are you sure you want to remove "${displayName}" from the guide? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteEntryMutation.mutateAsync();
      await utils.guide.getGuideFeeds.invalidate();
    } catch (error: any) {
      alert(error.message || 'Failed to delete entry');
    }
  };

  // Helper to check if current user owns this feed entry
  const isOwnEntry = (npub: string) => {
    const currentPubkey = getPublicKey();
    if (!isConnected || !currentPubkey) return false;
    try {
      const { type, data } = nip19.decode(npub);
      return type === 'npub' && data === currentPubkey;
    } catch {
      return false;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 md:p-8 mb-6 border border-purple-400/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Nostr Feedz <span className="text-[hsl(280,100%,70%)]">Guide</span>
              </h1>
              <p className="text-purple-200">
                Discover long-form content creators on Nostr
              </p>
            </div>
            <Link 
              href="/guide/submit"
              className="bg-purple-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-purple-700 text-center shadow-lg"
            >
              Submit a Feed
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6 border border-purple-400/30">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-3">Filter by Tags</h2>
            {availableTags && availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30 border border-purple-300/50'
                    }`}
                  >
                    {tag} ({count})
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-purple-200">No tags available yet</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="orderBy" className="text-sm font-medium">
              Sort by:
            </label>
            <select
              id="orderBy"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as any)}
              className="px-4 py-2 bg-white/20 border border-purple-400/50 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-sm"
            >
              <option value="popular" className="bg-slate-800">Most Popular</option>
              <option value="recent_posts" className="bg-slate-800">Recently Posted</option>
              <option value="newest" className="bg-slate-800">Newest Feeds</option>
            </select>
          </div>
        </div>

        {/* Feeds List */}
        <div className="space-y-4">
          {feedsLoading ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow p-8 text-center border border-purple-400/30">
              <p className="text-purple-200">Loading feeds...</p>
            </div>
          ) : guideFeeds && guideFeeds.length > 0 ? (
            guideFeeds.map((feed: any) => (
              <div
                key={feed.id}
                className="bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 hover:shadow-xl transition-all border border-purple-400/30 hover:border-purple-400/60"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Profile Picture */}
                  {feed.picture && (
                    <div className="flex-shrink-0">
                      <img
                        src={feed.picture}
                        alt={feed.displayName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-purple-400/50"
                        onError={(e) => {
                          // Hide image if it fails to load (e.g., Twitter hotlinking blocked)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Feed Info */}
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold mb-1 text-white">{feed.displayName}</h3>
                    {feed.about && (
                      <p className="text-purple-200 mb-3 line-clamp-2">
                        {feed.about}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-purple-200 mb-3">
                      <span>{feed.postCount} posts</span>
                      <span>{feed.subscriberCount} subscribers</span>
                      {feed.lastPublishedAt && (
                        <span>
                          Last post: {new Date(feed.lastPublishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {editingNpub === feed.npub ? (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-purple-200 mb-2">
                          Edit Tags
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddEditTag();
                              }
                            }}
                            placeholder="Add a tag..."
                            className="flex-1 px-3 py-2 bg-white/20 border border-purple-400/50 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <button
                            onClick={handleAddEditTag}
                            disabled={editTags.length >= 10}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                        {editTags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {editTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-3 py-1 bg-purple-500/40 text-purple-100 rounded-full text-sm border border-purple-400/50"
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveEditTag(tag)}
                                  className="ml-2 hover:text-white"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      feed.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {feed.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-purple-500/30 text-purple-100 rounded text-xs border border-purple-400/50"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {editingNpub === feed.npub ? (
                        <>
                          <button
                            onClick={handleSaveTags}
                            disabled={updateTagsMutation.isPending || editTags.length === 0}
                            className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {updateTagsMutation.isPending ? 'Saving...' : 'Save Tags'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-white/20 text-white font-semibold rounded-md hover:bg-white/30 text-sm border border-purple-400/50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCopyRssUrl(feed.npub, feed.tags)}
                            className="px-4 py-2 bg-white/20 text-white font-semibold rounded-md hover:bg-white/30 text-sm border border-purple-400/50"
                          >
                            {copySuccess === feed.npub ? 'Copied!' : 'Copy RSS URL'}
                          </button>
                          <button
                            onClick={() => handleSubscribe(feed.npub, feed.displayName, feed.tags)}
                            disabled={subscribeMutation.isPending}
                            className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm shadow-lg"
                          >
                            {subscribeMutation.isPending ? 'Subscribing...' : 'Subscribe in App'}
                          </button>
                          {isOwnEntry(feed.npub) && (
                            <>
                              <button
                                onClick={() => handleStartEdit(feed.npub, feed.tags)}
                                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 text-sm"
                              >
                                Edit Tags
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(feed.npub, feed.displayName)}
                                disabled={deleteEntryMutation.isPending}
                                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                              >
                                {deleteEntryMutation.isPending ? 'Deleting...' : 'Delete Entry'}
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow p-8 text-center border border-purple-400/30">
              <p className="text-purple-200 mb-4">
                {selectedTags.length > 0
                  ? 'No feeds found with the selected tags.'
                  : 'No feeds in the guide yet. Be the first to submit one!'}
              </p>
              <Link
                href="/guide/submit"
                className="inline-block bg-purple-600 text-white font-semibold py-2 px-6 rounded-md hover:bg-purple-700 shadow-lg"
              >
                Submit a Feed
              </Link>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-purple-300 hover:text-purple-200 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
