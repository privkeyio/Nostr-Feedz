# Nostr-Feedz

A modern, Google Reader-style feed aggregator that combines traditional RSS feeds with Nostr's decentralized long-form content (NIP-23).

## Overview

Nostr-Feedz is a full-stack web application built with Next.js that provides a unified reading experience for both RSS feeds and Nostr long-form content. It features a clean, three-panel interface reminiscent of Google Reader, allowing users to subscribe to their favorite blogs and Nostr authors in one place.

## Features

### Feed Management
- Subscribe to RSS/Atom feeds with automatic feed discovery
- Subscribe to Nostr users for their long-form content (NIP-23)
- Manual refresh or automatic feed updates
- Remove feeds with one click
- Unread count tracking per feed

### Content Reading
- Three-panel Google Reader-style interface
- Clean, readable content formatting for Markdown, HTML, and plain text
- Mark articles as read/unread
- Full-screen article view with proper typography
- Independent scrolling for feed list, article list, and content pane

### Nostr Integration
- Profile search across configured relays
- Popular user discovery
- Customizable relay configuration
- NIP-23 long-form content support
- Display user names and profile information

### RSS Features
- Intelligent feed discovery (supports homepage URLs)
- Checks common feed locations (/feed, /rss, /atom.xml, etc.)
- Parses HTML for feed links
- Supports RSS, Atom, and JSON Feed formats

### Authentication
- Nostr-based authentication using browser extensions (nos2x, Alby, etc.)
- No centralized account system
- Your npub is your identity

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety throughout
- **Tailwind CSS** - Utility-first styling
- **tRPC** - End-to-end type-safe APIs
- **TanStack Query** - Data fetching and caching

### Backend
- **Next.js API Routes** - Serverless functions
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Primary database
- **tRPC** - Type-safe API layer

### Nostr
- **nostr-tools** - Nostr protocol implementation
- **SimplePool** - Relay connection pooling
- Configurable relay support

### Content Processing
- **xml2js** - RSS/Atom feed parsing
- **cheerio** - HTML parsing for feed discovery
- **react-markdown** - Markdown rendering
- **rehype-sanitize** - HTML sanitization
- **remark-gfm** - GitHub Flavored Markdown support

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Nostr browser extension (nos2x, Alby, etc.)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/plebone/Nostr-Feedz.git
cd Nostr-Feedz
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/nostr_feedz"
```

4. Initialize the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### First Time Setup
1. Click "Connect with Nostr" on the homepage
2. Authorize the connection using your Nostr browser extension
3. You'll be redirected to the feed reader

### Adding Feeds

**RSS Feeds:**
1. Click "Add Feed" in the sidebar
2. Select "RSS Feed" tab
3. Enter the feed URL (or website homepage)
4. The app will automatically discover and subscribe to the feed

**Nostr Feeds:**
1. Click "Add Feed" in the sidebar
2. Select "Nostr User" tab
3. Search for users by name or NIP-05 address
4. Or manually enter an npub
5. Click on a profile to subscribe

### Managing Feeds
- Hover over a feed to see refresh and delete buttons
- Click the refresh icon to fetch new content
- Click the X icon to unsubscribe

### Configuring Relays
1. Click the gear icon in the sidebar
2. Add or remove Nostr relays
3. Use quick-add buttons for popular relays
4. Click "Reset to Defaults" to restore default relays

### Reading Content
- Click a feed to see its articles
- Click an article to read the full content
- Articles are automatically marked as read when clicked
- All content (Markdown, HTML, plain text) is properly formatted

## Database Schema

The application uses four main models:

- **Feed** - Stores RSS and Nostr feed information
- **FeedItem** - Individual articles/posts
- **Subscription** - User subscriptions to feeds
- **ReadItem** - Tracks which items users have read

## Architecture

### Authentication Flow
1. User clicks "Connect with Nostr"
2. Browser extension provides public key
3. Session stored in localStorage
4. tRPC context validates authentication on each request

### Feed Discovery Flow (RSS)
1. Check if URL is a direct feed
2. Parse HTML for feed links
3. Try common feed locations (/feed, /rss, etc.)
4. Return first valid feed found

### Content Fetching Flow
- **RSS**: Fetches on subscription and manual refresh
- **Nostr**: Queries relays for kind 30023 events
- Both: Stores items in database to avoid duplicates

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/             # React components
│   ├── feed-reader.tsx    # Main reader interface
│   ├── add-feed-modal.tsx # Feed subscription UI
│   ├── settings-dialog.tsx# Relay configuration
│   └── formatted-content.tsx # Content renderer
├── contexts/              # React contexts
│   └── NostrAuthContext.tsx
├── lib/                   # Utilities
│   ├── nostr-fetcher.ts  # Nostr protocol interactions
│   ├── rss-parser.ts     # RSS feed parsing
│   └── feed-discovery.ts # RSS feed discovery
├── server/               # Backend code
│   └── api/
│       └── routers/
│           └── feed.ts   # Main tRPC router
└── prisma/
    └── schema.prisma     # Database schema
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Inspired by Google Reader's clean interface
- Built on the Nostr protocol for decentralized identity
- Thanks to the T3 Stack for the excellent Next.js template