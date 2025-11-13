import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple middleware that allows all requests for now
// When you configure Clerk, you can uncomment and update the Clerk middleware
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}