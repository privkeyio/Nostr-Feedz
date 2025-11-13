'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface FormattedContentProps {
  content: string;
  className?: string;
}

/**
 * Detects content type and formats it appropriately
 * Supports: Markdown, HTML, and plain text
 */
export function FormattedContent({
  content,
  className = '',
}: FormattedContentProps) {
  // Detect if content is likely HTML
  const isHtml = /<[^>]+>/.test(content);

  // Detect if content is likely Markdown
  const hasMarkdownSyntax = /[#*_`[\]]/g.test(content);

  if (isHtml || hasMarkdownSyntax) {
    // Use react-markdown which handles both Markdown and HTML
    return (
      <div className={`formatted-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // GitHub Flavored Markdown (tables, strikethrough, etc.)
          rehypePlugins={[rehypeRaw, rehypeSanitize]} // Allow HTML but sanitize it
          components={{
            // Custom component overrides for better styling
            a: ({ node, ...props }) => (
              <a
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
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
                <table
                  className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700"
                  {...props}
                />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead
                className="bg-slate-50 dark:bg-slate-800"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Plain text - split into paragraphs
  return (
    <div className={`formatted-content ${className}`}>
      {content.split('\n\n').map((paragraph, index) => {
        if (paragraph.trim()) {
          return (
            <p
              key={index}
              className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap"
            >
              {paragraph}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
