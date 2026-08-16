"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface SearchBarProps {
  onResults: (results: SearchResult[] | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 350;

export function SearchBar({ onResults, onSearchingChange, placeholder, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const { showToast } = useToast();

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setIsSearching(false);
      onSearchingChange?.(false);
      onResults(null);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setIsSearching(true);
      onSearchingChange?.(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "La recherche a échoué.");
        }
        if (requestId === requestIdRef.current) {
          onResults((data.results ?? []) as SearchResult[]);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          const message = err instanceof Error ? err.message : "La recherche a échoué.";
          showToast(message, "error");
          onResults([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
          onSearchingChange?.(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className={`relative flex h-14 w-full items-center gap-3 rounded-[14px] border border-border bg-surface px-[18px] shadow-[0_1px_2px_rgba(16,24,20,.04),0_8px_24px_-12px_rgba(16,24,20,.12)] focus-within:ring-2 focus-within:ring-accent/35 ${className ?? ""}`}>
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-text-muted">
        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder ?? "Rechercher un document, ex. « facture EDF mars »"}
        className="h-full min-w-0 flex-1 border-none bg-transparent text-base text-text placeholder:text-text-muted focus:outline-none"
      />
      {isSearching && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 flex-none animate-spin rounded-full border-2 border-text-muted border-t-transparent"
        />
      )}
      {!isSearching && query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Effacer la recherche"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-border-subtle text-text-muted transition-colors hover:text-text"
        >
          ×
        </button>
      )}
    </div>
  );
}
