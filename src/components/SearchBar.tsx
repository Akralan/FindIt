"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export interface SearchBarProps {
  onResults: (results: SearchResult[] | null) => void;
  onSearchingChange?: (isSearching: boolean) => void;
}

const DEBOUNCE_MS = 350;

export function SearchBar({ onResults, onSearchingChange }: SearchBarProps) {
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
    <div className="relative w-full">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
      >
        <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un document, ex. « facture EDF mars »"
        className="h-11 w-full rounded-card border border-border bg-surface pl-10 pr-10 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg"
      />
      {isSearching && (
        <span
          aria-hidden
          className="absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
        />
      )}
      {!isSearching && query.length > 0 && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Effacer la recherche"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
        >
          ×
        </button>
      )}
    </div>
  );
}
