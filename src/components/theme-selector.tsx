'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme, themeConfig, type Theme } from '@/contexts/ThemeContext'

interface ThemeSelectorProps {
  variant?: 'dropdown' | 'inline'
  showLabels?: boolean
}

export function ThemeSelector({ variant = 'dropdown', showLabels = true }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const themes = Object.entries(themeConfig) as [Theme, typeof themeConfig[Theme]][]

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap gap-2">
        {themes.map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all duration-200
              ${theme === key
                ? 'border-theme-accent bg-theme-accent-light shadow-theme-sm'
                : 'border-theme-primary bg-theme-surface hover:border-theme-accent/50 hover:bg-theme-hover'
              }
            `}
          >
            <span className="text-lg">{config.icon}</span>
            {showLabels && (
              <div className="text-left">
                <div className="text-sm font-medium text-theme-primary">{config.name}</div>
                <div className="text-xs text-theme-tertiary">{config.description}</div>
              </div>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-theme-surface border border-theme-primary
          hover:bg-theme-hover hover:border-theme-accent/50
          transition-all duration-200 shadow-theme-sm
        "
        title={`Theme: ${themeConfig[theme].name}`}
      >
        <span className="text-lg">{themeConfig[theme].icon}</span>
        {showLabels && (
          <span className="text-sm font-medium text-theme-primary hidden sm:inline">
            {themeConfig[theme].name}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-theme-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="
          absolute right-0 mt-2 w-56 z-50
          bg-theme-surface-overlay border border-theme-primary rounded-xl
          shadow-theme-lg overflow-hidden
          animate-slide-in
        ">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-theme-tertiary uppercase tracking-wider">
              Choose Theme
            </div>
            {themes.map(([key, config]) => (
              <button
                key={key}
                onClick={() => {
                  setTheme(key)
                  setIsOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-150
                  ${theme === key
                    ? 'bg-theme-accent-light text-theme-accent'
                    : 'hover:bg-theme-hover text-theme-primary'
                  }
                `}
              >
                <span className="text-xl">{config.icon}</span>
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">{config.name}</div>
                  <div className={`text-xs ${theme === key ? 'text-theme-accent/70' : 'text-theme-tertiary'}`}>
                    {config.description}
                  </div>
                </div>
                {theme === key && (
                  <svg className="w-5 h-5 text-theme-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          
          {/* Theme Preview Swatches */}
          <div className="border-t border-theme-primary px-4 py-3">
            <div className="text-xs text-theme-tertiary mb-2">Preview</div>
            <div className="flex gap-1">
              {themes.map(([key]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTheme(key)
                    setIsOpen(false)
                  }}
                  className={`
                    w-8 h-8 rounded-full border-2 transition-all duration-200
                    ${theme === key ? 'border-theme-accent scale-110' : 'border-transparent hover:scale-105'}
                  `}
                  style={{
                    background: key === 'light' ? 'linear-gradient(135deg, #fff 50%, #f1f5f9 50%)'
                      : key === 'dark' ? 'linear-gradient(135deg, #1e293b 50%, #0f172a 50%)'
                      : key === 'newspaper' ? 'linear-gradient(135deg, #fcfbf8 50%, #f5f3ee 50%)'
                      : 'linear-gradient(135deg, #fdf8ed 50%, #f9f1e0 50%)'
                  }}
                  title={themeConfig[key].name}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple theme toggle button for mobile/compact views
export function ThemeToggleButton() {
  const { theme, cycleTheme } = useTheme()
  
  return (
    <button
      onClick={cycleTheme}
      className="
        p-2 rounded-lg
        bg-theme-surface border border-theme-primary
        hover:bg-theme-hover hover:border-theme-accent/50
        transition-all duration-200
      "
      title={`Theme: ${themeConfig[theme].name} (click to cycle)`}
    >
      <span className="text-lg">{themeConfig[theme].icon}</span>
    </button>
  )
}
