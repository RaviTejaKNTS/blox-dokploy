"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { AdminArticleSummary, AdminArticleCategoryOption } from "@/lib/admin/articles";
import type { AdminAuthorOption } from "@/lib/admin/games";
import { ArticleDrawer } from "./ArticleDrawer";

const columns = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "author", label: "Author" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Last Update" },
  { key: "published", label: "Published" }
] as const;

type ColumnKey = (typeof columns)[number]["key"];

type ColumnVisibility = Record<ColumnKey, boolean>;

const defaultVisibility: ColumnVisibility = {
  title: true,
  slug: true,
  author: true,
  category: true,
  status: true,
  updated: true,
  published: true
};

interface ArticlesClientProps {
  initialArticles: AdminArticleSummary[];
  authors: AdminAuthorOption[];
  categories: AdminArticleCategoryOption[];
}

export function ArticlesClient({ initialArticles, authors, categories }: ArticlesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("published");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visibility, setVisibility] = useState<ColumnVisibility>(defaultVisibility);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<AdminArticleSummary | null>(null);

  const filtered = useMemo(() => {
    return initialArticles.filter((article) => {
      const matchesSearch = search
        ? article.title.toLowerCase().includes(search.toLowerCase()) ||
          article.slug.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "published" ? article.is_published : !article.is_published;
      const matchesAuthor = authorFilter === "all" ? true : article.author.id === authorFilter;
      const matchesCategory = categoryFilter === "all" ? true : article.category.id === categoryFilter;
      return matchesSearch && matchesStatus && matchesAuthor && matchesCategory;
    });
  }, [initialArticles, search, statusFilter, authorFilter, categoryFilter]);

  const totalCount = initialArticles.length;
  const filteredCount = filtered.length;

  function openNewArticle() {
    setSelectedArticle(null);
    setDrawerOpen(true);
  }

  function openExistingArticle(article: AdminArticleSummary) {
    setSelectedArticle(article);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-2 text-xs font-semibold text-muted">
          Showing {filteredCount} of {totalCount} articles
        </span>
        <input
          type="search"
          placeholder="Search articles…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={authorFilter}
          onChange={(event) => setAuthorFilter(event.target.value)}
          className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All authors</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>
              {author.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openNewArticle}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
        >
          New Article
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
              {visibility.title ? <th className="px-4 py-3 text-left">Title</th> : null}
              {visibility.slug ? <th className="px-4 py-3 text-left">Slug</th> : null}
              {visibility.author ? <th className="px-4 py-3 text-left">Author</th> : null}
              {visibility.category ? <th className="px-4 py-3 text-left">Category</th> : null}
              {visibility.status ? <th className="px-4 py-3 text-left">Status</th> : null}
              {visibility.updated ? <th className="px-4 py-3 text-left">Last update</th> : null}
              {visibility.published ? <th className="px-4 py-3 text-left">Published</th> : null}
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((article) => (
              <tr key={article.id} className="hover:bg-surface-muted/40">
                {visibility.title ? (
                  <td className="px-4 py-3 font-medium text-foreground">{article.title}</td>
                ) : null}
                {visibility.slug ? <td className="px-4 py-3 text-muted">{article.slug}</td> : null}
                {visibility.author ? <td className="px-4 py-3">{article.author.name ?? "—"}</td> : null}
                {visibility.category ? <td className="px-4 py-3">{article.category.name ?? "—"}</td> : null}
                {visibility.status ? (
                  <td className="px-4 py-3">
                    <span
                      className={
                        article.is_published
                          ? "rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200"
                          : "rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200"
                      }
                    >
                      {article.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                ) : null}
                {visibility.updated ? (
                  <td className="px-4 py-3 text-muted">
                    {format(new Date(article.updated_at), "LLL d, yyyy HH:mm")}
                  </td>
                ) : null}
                {visibility.published ? (
                  <td className="px-4 py-3 text-muted">
                    {article.published_at ? format(new Date(article.published_at), "LLL d, yyyy HH:mm") : "—"}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openExistingArticle(article)}
                    className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/40 hover:bg-surface-muted"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No articles match your filters yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ArticleDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={() => router.refresh()}
        article={selectedArticle}
        authors={authors}
        categories={categories}
      />
    </div>
  );
}
