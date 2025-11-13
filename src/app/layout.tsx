import './globals.css'
import { Inter } from 'next/font/google'
import { TRPCReactProvider } from '@/trpc/react'
import { NostrAuthProvider } from '@/contexts/NostrAuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Nostr Feedz',
  description: 'A decentralized social feed powered by Nostr',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NostrAuthProvider>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </NostrAuthProvider>
      </body>
    </html>
  )
}