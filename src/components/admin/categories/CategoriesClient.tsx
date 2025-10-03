"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { AdminCategorySummary } from "@/lib/admin/categories";
import { CategoryDrawer } from "./CategoryDrawer";

const columns = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug" },
  { key: "articles", label: "Articles" },
  { key: "game", label: "Linked Game" },
  { key: "updated", label: "Updated" }
] as const;

type ColumnKey = (typeof columns)[number]["key"];

type ColumnVisibility = Record<ColumnKey, boolean>;

const defaultVisibility: ColumnVisibility = {
  name: true,
  slug: true,
  articles: true,
  game: true,
  updated: true
};

interface CategoriesClientProps {
  initialCategories: AdminCategorySummary[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<ColumnVisibility>(defaultVisibility);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AdminCategorySummary | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return initialCategories;
    const query = search.toLowerCase();
    return initialCategories.filter((category) => {
      return (
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query) ||
        (category.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [initialCategories, search]);

  function handleNewCategory() {
    setSelectedCategory(null);
    setDrawerOpen(true);
  }

  function handleEditCategory(category: AdminCategorySummary) {
    setSelectedCategory(category);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search categories…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="button"
          onClick={handleNewCategory}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
        >
          New Category
        </button>
      </div>

      <details className="rounded-lg border border-border/60 bg-surface px-4 py-3 text-sm text-muted">
        <summary className="cursor-pointer list-none font-semibold text-foreground">Toggle columns</summary>
        <div className="mt-3 flex flex-wrap gap-4">
          {columns.map((column) => (
            <label key={column.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={visibility[column.key]}
                onChange={(event) =>
                  setVisibility((prev) => ({
                    ...prev,
                    [column.key]: event.target.checked
                  }))
                }
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              {visibility.name ? <th className="px-4 py-3 text-left">Name</th> : null}
              {visibility.slug ? <th className="px-4 py-3 text-left">Slug</th> : null}
              {visibility.articles ? <th className="px-4 py-3 text-right">Articles</th> : null}
              {visibility.game ? <th className="px-4 py-3 text-left">Linked game</th> : null}
              {visibility.updated ? <th className="px-4 py-3 text-left">Last update</th> : null}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((category) => (
              <tr key={category.id} className="hover:bg-surface-muted/40">
                {visibility.name ? (
                  <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                ) : null}
                {visibility.slug ? <td className="px-4 py-3 text-muted">{category.slug}</td> : null}
                {visibility.articles ? (
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{category.article_count}</td>
                ) : null}
                {visibility.game ? (
                  <td className="px-4 py-3 text-muted">
                    {category.game.name ? (
                      <span>{category.game.name}</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                ) : null}
                {visibility.updated ? (
                  <td className="px-4 py-3 text-muted">
                    {format(new Date(category.updated_at), "LLL d, yyyy HH:mm")}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleEditCategory(category)}
                    className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/40 hover:bg-surface-muted"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No categories match your search yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <CategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={() => router.refresh()}
        category={selectedCategory}
      />
    </div>
  );
}
