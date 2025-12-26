'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'newspaper' | 'parchment'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  cycleTheme: () => void
}

const themeOrder: Theme[] = ['light', 'dark', 'newspaper', 'parchment']

export const themeConfig: Record<Theme, { name: string; icon: string; description: string }> = {
  light: {
    name: 'Light',
    icon: '☀️',
    description: 'Clean and bright',
  },
  dark: {
    name: 'Dark',
    icon: '🌙',
    description: 'Easy on the eyes',
  },
  newspaper: {
    name: 'Newspaper',
    icon: '📰',
    description: 'Classic print style',
  },
  parchment: {
    name: 'Parchment',
    icon: '📜',
    description: 'Warm and vintage',
  },
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme && themeOrder.includes(savedTheme)) {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      // Check system preference for dark mode
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setThemeState(systemTheme)
      applyTheme(systemTheme)
    }
  }, [])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    // Remove all theme classes
    themeOrder.forEach(t => root.classList.remove(`theme-${t}`))
    // Add new theme class
    root.classList.add(`theme-${newTheme}`)
    // Handle dark mode class for Tailwind
    root.classList.toggle('dark', newTheme === 'dark')
  }

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }, [])

  const cycleTheme = useCallback(() => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }, [theme, setTheme])

  // Prevent flash of unstyled content
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
