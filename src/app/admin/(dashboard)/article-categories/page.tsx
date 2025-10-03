import { supabaseAdmin } from "@/lib/supabase";
import { fetchAdminCategories } from "@/lib/admin/categories";
import { CategoriesClient } from "@/components/admin/categories/CategoriesClient";

export const metadata = {
  title: "Manage Article Categories"
};

export default async function AdminArticleCategoriesPage() {
  const supabase = supabaseAdmin();
  const categories = await fetchAdminCategories(supabase);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Article Categories</h1>
        <p className="text-sm text-muted">
          Keep categories organised, rename them, and manage descriptions. New games auto-create a matching category.
        </p>
      </header>

      <CategoriesClient initialCategories={categories} />
    </div>
  );
}
