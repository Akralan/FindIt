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
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-8 w-20 animate-pulse rounded-full bg-surface-hover" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <nav aria-label="Filtrer par catégorie" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[5px] text-[13px] leading-5 transition-colors",
          selected === null
            ? "border-text bg-text font-medium text-bg"
            : "border-border bg-surface text-text-muted hover:bg-surface-hover"
        )}
      >
        Tout
        <span className={selected === null ? "opacity-60" : "text-text-faint"}>{total}</span>
      </button>

      {categories.map((item) => (
        <button
          key={item.category}
          type="button"
          onClick={() => onSelect(item.category)}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[5px] text-[13px] leading-5 transition-colors",
            selected === item.category
              ? "border-text bg-text font-medium text-bg"
              : "border-border bg-surface text-text-muted hover:bg-surface-hover"
          )}
        >
          <span className="truncate">{item.category}</span>
          <span className={selected === item.category ? "opacity-60" : "text-text-faint"}>{item.count}</span>
        </button>
      ))}
    </nav>
  );
}
