'use client'

import Link from "next/link";
import { useState } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useNostrAuth } from "@/contexts/NostrAuthContext";

export default function SubmitToGuidePage() {
  const { isConnected } = useNostrAuth();
  const [npub, setNpub] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const router = useRouter();
  const submitMutation = api.guide.submitFeed.useMutation();

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag) && tags.length < 10) {
      setTags([...tags, newTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!npub.trim() || !npub.startsWith('npub1')) {
      setError('Please enter a valid Nostr npub.');
      return;
    }

    if (tags.length === 0) {
      setError('Please add at least one tag to categorize this feed.');
      return;
    }

    try {
      await submitMutation.mutateAsync({ npub, tags });
      setSuccess(true);
      setNpub('');
      setTags([]);
      
      // Redirect to guide after 2 seconds
      setTimeout(() => {
        router.push('/guide');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feed to the guide.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white p-4 md:p-8">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-sm rounded-lg shadow-lg p-6 md:p-8 border border-purple-400/30">
        <h1 className="text-3xl font-bold mb-4 text-center">Submit Feed to Guide</h1>
        <p className="text-center text-purple-200 mb-8">
          Add a Nostr user with long-form content to the public guide directory
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="npub" className="block text-sm font-medium text-white mb-1">
              Nostr Public Key (npub) <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              id="npub"
              name="npub"
              value={npub}
              onChange={(e) => setNpub(e.target.value)}
              placeholder="npub1..."
              className="w-full px-4 py-2 bg-white/20 border border-purple-400/50 text-white placeholder-purple-200/50 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-sm"
              disabled={submitMutation.isPending}
            />
            <p className="text-sm text-purple-200 mt-1">
              This user must have published long-form content (NIP-23).
            </p>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-white mb-1">
              Tags <span className="text-pink-400">*</span> (1-10 tags)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="tags"
                name="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g., bitcoin, philosophy, technology"
                className="flex-1 px-4 py-2 bg-white/20 border border-purple-400/50 text-white placeholder-purple-200/50 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 backdrop-blur-sm"
                disabled={submitMutation.isPending || tags.length >= 10}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-white/20 text-white font-semibold rounded-md hover:bg-white/30 disabled:opacity-50 border border-purple-400/50"
                disabled={submitMutation.isPending || tags.length >= 10 || !tagInput.trim()}
              >
                Add
              </button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/30 text-purple-100 rounded-full text-sm border border-purple-400/50"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-purple-200 hover:text-white"
                      disabled={submitMutation.isPending}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-purple-200 mt-1">
              Add relevant topic tags to help people discover this feed.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-md text-red-200">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-500/20 border border-green-400/50 rounded-md text-green-200">
              <p>Feed successfully submitted to the guide! Redirecting...</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitMutation.isPending || tags.length === 0}
            className="w-full bg-purple-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400 disabled:opacity-50 shadow-lg"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit to Guide'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/guide" className="text-purple-300 hover:text-purple-200 hover:underline">
            &larr; Back to Guide
          </Link>
        </div>
      </div>
    </main>
  );
}
