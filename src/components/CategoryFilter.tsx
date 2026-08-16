"use client";

import clsx from "clsx";

export interface CategoryFilterItem {
  category: string;
  count: number;
}

export interface CategoryFilterProps {
  categories: CategoryFilterItem[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  loading?: boolean;
}

export function CategoryFilter({ categories, selected, onSelect, loading = false }: CategoryFilterProps) {
  const total = categories.reduce((sum, item) => sum + item.count, 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 animate-pulse rounded-card bg-surface-hover" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Filtrer par catégorie" className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={clsx(
          "flex items-center justify-between rounded-card px-3 py-2 text-left text-sm transition-colors",
          selected === null ? "bg-accent/10 text-accent font-medium" : "text-text hover:bg-surface-hover"
        )}
      >
        <span>Toutes les catégories</span>
        <span className="text-xs text-text-muted">{total}</span>
      </button>

      {categories.length === 0 && (
        <p className="px-3 py-2 text-xs text-text-muted">Aucune catégorie pour l&apos;instant.</p>
      )}

      {categories.map((item) => (
        <button
          key={item.category}
          type="button"
          onClick={() => onSelect(item.category)}
          className={clsx(
            "flex items-center justify-between rounded-card px-3 py-2 text-left text-sm transition-colors",
            selected === item.category
              ? "bg-accent/10 text-accent font-medium"
              : "text-text hover:bg-surface-hover"
          )}
        >
          <span className="truncate">{item.category}</span>
          <span className="text-xs text-text-muted">{item.count}</span>
        </button>
      ))}
    </nav>
  );
}
