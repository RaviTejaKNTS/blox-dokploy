import { supabaseAdmin } from "@/lib/supabase";
import { fetchAdminArticles, fetchAdminArticleCategories } from "@/lib/admin/articles";
import { fetchAdminAuthors } from "@/lib/admin/games";
import { ArticlesClient } from "@/components/admin/articles/ArticlesClient";

export const metadata = {
  title: "Manage Articles"
};

export default async function AdminArticlesPage() {
  const supabase = supabaseAdmin();
  const [articles, authors, categories] = await Promise.all([
    fetchAdminArticles(supabase),
    fetchAdminAuthors(supabase),
    fetchAdminArticleCategories(supabase)
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Articles</h1>
        <p className="text-sm text-muted">
          Publish long-form guides, assign authors, and keep track of draft versus published content in one place.
        </p>
      </header>

      <ArticlesClient initialArticles={articles} authors={authors} categories={categories} />
    </div>
  );
}
