import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, onClear, placeholder = 'Search...' }: Props) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<number>();

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      onClear();
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = window.setTimeout(() => {
      onSearch(value);
      setIsSearching(false);
    }, 300);
  }, [onSearch, onClear]);

  const handleClear = useCallback(() => {
    setQuery('');
    onClear();
    setIsSearching(false);
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="search-input"
        aria-label="Search feed items"
      />
      {isSearching && <span className="search-spinner">↻</span>}
      {query && !isSearching && (
        <button className="search-clear" onClick={handleClear} aria-label="Clear search">
          ×
        </button>
      )}
    </div>
  );
}
