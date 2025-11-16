import './globals.css'
import { Inter } from 'next/font/google'
import { TRPCReactProvider } from '@/trpc/react'
import { NostrAuthProvider } from '@/contexts/NostrAuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Footer } from '@/components/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Nostr Feedz',
  description: 'A decentralized social feed powered by Nostr',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Nostr Feedz',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3B82F6',
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
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <ThemeProvider>
          <NostrAuthProvider>
            <TRPCReactProvider>
              <div className="flex-1">
                {children}
              </div>
              <Footer />
            </TRPCReactProvider>
          </NostrAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}