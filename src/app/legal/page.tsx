import Link from 'next/link'

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link 
          href="/"
          className="inline-flex items-center text-purple-300 hover:text-purple-200 mb-8 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 md:p-12">
          <h1 className="text-4xl font-bold mb-8 text-slate-900 dark:text-white">
            ⚖️ Legal Battle Orders
          </h1>
          
          <p className="text-slate-600 dark:text-slate-400 mb-12 italic">
            Or: "How I Learned to Stop Worrying and Love the Disclaimer"
          </p>

          {/* What Nostr Feedz Actually Is */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🤖 What Nostr Feedz Actually Is
            </h2>
            <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
              <p>
                Nostr Feedz is a free, open-source project built by one caffeinated developer who got tired 
                of managing RSS feeds and Nostr content separately. It's not a company, corporation, or startup 
                looking to IPO and buy a yacht.
              </p>
              <p className="font-semibold">
                Translation: This is a tactical hobby project made with love, not lawyers. 💙
              </p>
            </div>
          </section>

          {/* Use At Your Own Risk */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🎲 Use At Your Own Risk (Seriously)
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>Things might break. Sometimes spectacularly. 💥</li>
                <li>Your feeds might fail to load. Check your sources to be sure.</li>
                <li>Data might get lost. Back up anything important.</li>
                <li>Features might disappear. Or get completely rewritten overnight.</li>
                <li>The server might go down. Because sometimes infrastructure needs maintenance.</li>
                <li>APIs might change. RSS and Nostr protocols are evolving.</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4">
                If any of this makes you uncomfortable, maybe stick to reading feeds manually. 🤷‍♂️
              </p>
            </div>
          </section>

          {/* Zero Guarantees */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🚫 Zero Guarantees, Maximum Honesty
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 mb-3">
                I make absolutely ZERO guarantees about:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>Uptime (the server runs on hopes and dreams)</li>
                <li>Data persistence (databases are surprisingly fragile)</li>
                <li>Feature stability (I refactor when I'm bored)</li>
                <li>Response time to issues (I have a day job)</li>
                <li>Compatibility with your workflow (every setup is unique)</li>
                <li>Protection from platform rate limits (you're on your own there)</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4 font-semibold">
                But hey, it's free, so you're getting exactly what you paid for! 🎯
              </p>
            </div>
          </section>

          {/* Development Reality Check */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              ⏰ Development Reality Check
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 mb-3">
                About feature requests and bug fixes:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>New features: Added when I feel like it, need it myself, or receive community contributions ☕</li>
                <li>Bug fixes: Prioritized by how much they annoy me personally 🐛</li>
                <li>Timeline: Could be tomorrow, could be next year, could be never 📅</li>
                <li>Feature parity: Different platforms work differently, deal with it 🤷</li>
                <li>Breaking changes: Will happen without warning when necessary 💔</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4 font-semibold">
                Open source means you can always fork it and fix it yourself! 🍴
              </p>
            </div>
          </section>

          {/* Data & Privacy */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🔐 Data & Privacy (The Good News)
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>Your Nostr keys are managed by your browser extension</li>
                <li>No tracking, analytics, or ads - I literally don't want your data</li>
                <li>No third-party services except the relays and feeds you subscribe to</li>
                <li>Open source - you can audit the code yourself</li>
                <li>Self-hostable - run it on your own server if you want</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4 font-semibold">
                Your biggest privacy risk is probably the platforms themselves, not this tool. 🎭
              </p>
            </div>
          </section>

          {/* Free & Open Source */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🆓 Free & Open Source
            </h2>
            <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
              <p className="mb-3">Nostr Feedz is permanently free:</p>
              <ul className="space-y-2">
                <li>No subscription fees</li>
                <li>No premium tiers</li>
                <li>No hidden costs</li>
                <li>Open source and transparent</li>
              </ul>
              <p className="mt-4">
                This service is provided free of charge by{' '}
                <a 
                  href="https://pleb.one" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  pleb.one
                </a>
                . If you want to contribute, check out our open source code or help improve the platform! 🚀
              </p>
              <p className="font-semibold mt-4">
                Free and open source forever. 💡⚡
              </p>
            </div>
          </section>

          {/* Support Expectations */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🎧 Support Expectations
            </h2>
            <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
              <p className="font-semibold mb-2">What you can expect:</p>
              <ul className="space-y-2 mb-4">
                <li>Best effort support when I have time</li>
                <li>Honest answers about what's broken and why</li>
                <li>Documentation that's usually up to date</li>
                <li>A functioning tool most of the time</li>
              </ul>
              
              <p className="font-semibold mb-2">What you can't expect:</p>
              <ul className="space-y-2">
                <li>24/7 support (I sleep sometimes)</li>
                <li>Enterprise SLAs (this isn't enterprise software)</li>
                <li>Custom development (unless you contribute to the open source project)</li>
                <li>Liability for anything that goes wrong</li>
              </ul>
              
              <p className="mt-4 font-semibold">
                Be patient, be kind, and remember this is a free community service. 🙏
              </p>
            </div>
          </section>

          {/* Platform Changes */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🔄 Platform Changes & API Chaos
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-slate-700 dark:text-slate-300 mb-3">
                RSS feeds and Nostr relays change their behavior more often than I change my socks. When they do:
              </p>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>Things will break until I can fix them</li>
                <li>Some features might disappear forever if the platform removes them</li>
                <li>New restrictions might appear</li>
                <li>Rate limits might change without warning</li>
                <li>Authentication might stop working until updated</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4 font-semibold">
                I fix these as fast as I can, but I can't control what platforms do. 🤖
              </p>
            </div>
          </section>

          {/* The Bottom Line */}
          <section className="mb-10">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
              🎯 The Bottom Line
            </h2>
            <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
              <p className="mb-4">
                Nostr Feedz is a free tool that might save you time.
              </p>
              <p className="mb-6">
                Use it, don't use it, fork it, improve it, break it, fix it - I don't care. Just don't blame 
                me when your favorite feed doesn't update because the server was having a bad day.
              </p>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-4 rounded">
                <p className="font-semibold mb-2">💡 Built with ❤️, ☕, and zero legal budget by pleb.one</p>
                <p className="text-sm">
                  P.S. If you're a lawyer and this disclaimer gave you an aneurysm, please consider that 
                  maybe the problem isn't the disclaimer. 😜
                </p>
              </div>
              
              <p className="mt-6 text-xl font-semibold text-center">
                Now go forth and read feeds responsibly! 🚀
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              © {new Date().getFullYear()}{' '}
              <a 
                href="https://pleb.one" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
              >
                pleb.one
              </a>
              {' '}- Built for the community, by the community
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 italic">
              "Freedom of information, one feed at a time" 🏴
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
