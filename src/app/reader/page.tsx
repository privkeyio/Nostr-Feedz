'use client'

import { AuthGuard } from '@/components/auth-guard'
import { FeedReader } from '@/components/feed-reader'

export default function ReaderPage() {
  return (
    <AuthGuard>
      <FeedReader />
    </AuthGuard>
  )
}