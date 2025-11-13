import './globals.css'
import { Inter } from 'next/font/google'
import { TRPCReactProvider } from '@/trpc/react'
import { NostrAuthProvider } from '@/contexts/NostrAuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Nostr Feedz',
  description: 'A decentralized social feed powered by Nostr',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
  themeColor: '#3B82F6',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nostr Feedz',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#3B82F6" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <NostrAuthProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </NostrAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}