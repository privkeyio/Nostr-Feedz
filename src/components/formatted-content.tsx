'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'

interface FormattedContentProps {
  content: string
  className?: string
}

/**
 * Detects content type and formats it appropriately
 * Supports: Markdown, HTML, and plain text
 */
export function FormattedContent({ content, className = '' }: FormattedContentProps) {
  // Detect if content is likely HTML
  const isHtml = /<[^>]+>/.test(content)
  
  // Detect if content is likely Markdown
  const hasMarkdownSyntax = /[#*_`[\]]/g.test(content)
  
  if (isHtml || hasMarkdownSyntax) {
    // Use react-markdown which handles both Markdown and HTML
    return (
      <div className={`formatted-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // GitHub Flavored Markdown (tables, strikethrough, etc.)
          rehypePlugins={[rehypeRaw, rehypeSanitize]} // Allow HTML but sanitize it
          components={{
            // Custom component overrides for better styling
            h1: ({ node, ...props }) => (
              <h1 className="text-3xl font-bold mt-8 mb-4 text-gray-900" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-2xl font-bold mt-6 mb-3 text-gray-900" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-xl font-bold mt-4 mb-2 text-gray-900" {...props} />
            ),
            h4: ({ node, ...props }) => (
              <h4 className="text-lg font-semibold mt-3 mb-2 text-gray-800" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="mb-4 leading-relaxed text-gray-700" {...props} />
            ),
            a: ({ node, ...props }) => (
              <a
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="ml-4" {...props} />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote
                className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-600 bg-gray-50"
                {...props}
              />
            ),
            code: ({ node, inline, className, children, ...props }: any) =>
              inline ? (
                <code
                  className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              ) : (
                <code
                  className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              ),
            pre: ({ node, ...props }) => (
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4" {...props} />
            ),
            img: ({ node, ...props }) => (
              <img
                className="max-w-full h-auto rounded-lg shadow-md my-4"
                loading="lazy"
                {...props}
              />
            ),
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-gray-200 border" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-gray-50" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 border" {...props} />
            ),
            hr: ({ node, ...props }) => (
              <hr className="my-8 border-gray-300" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    )
  }
  
  // Plain text - split into paragraphs
  return (
    <div className={`formatted-content ${className}`}>
      {content.split('\n\n').map((paragraph, index) => {
        if (paragraph.trim()) {
          return (
            <p key={index} className="mb-4 leading-relaxed text-gray-700 whitespace-pre-wrap">
              {paragraph}
            </p>
          )
        }
        return null
      })}
    </div>
  )
}
