import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Built with ❤️ by</span>
            <a 
              href="https://pleb.one" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
            >
              pleb.one
            </a>
          </div>
          
          <div className="flex items-center gap-4">
            <Link 
              href="/legal" 
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>© {new Date().getFullYear()} Nostr Feedz</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
