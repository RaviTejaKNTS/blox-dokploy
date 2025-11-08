import Link from "next/link";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase-config";
import { supabaseAdmin } from "@/lib/supabase";

export const metadata = {
  title: "Admin Overview"
};

export default async function AdminHomePage() {
  const { supabaseUrl, supabaseKey, cookieOptions } = getSupabaseConfig();

  const cookieStore = cookies();
  const sessionClient = createServerComponentClient({
    cookies: () => cookieStore
  }, {
    supabaseUrl,
    supabaseKey,
    cookieOptions
  });

  const {
    data: { session }
  } = await sessionClient.auth.getSession();

  const supabase = supabaseAdmin();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayIso = startOfDay.toISOString();

  const [
    totalArticles,
    publishedArticles,
    categoriesCount,
    gamesCount,
    latestArticlesResult,
    gamesPublishedCount,
    gamesUpdatedTodayCount,
    latestGamesResult
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("article_categories").select("id", { count: "exact", head: true }),
    supabase.from("games").select("id", { count: "exact", head: true }),
    supabase
      .from("articles")
      .select("id, title, slug, updated_at, is_published")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase.from("games").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("games").select("id", { count: "exact", head: true }).gte("updated_at", startOfDayIso),
    supabase
      .from("games")
      .select("id, name, slug, updated_at, is_published")
      .order("updated_at", { ascending: false })
      .limit(6)
  ]);

  if (totalArticles.error) throw totalArticles.error;
  if (publishedArticles.error) throw publishedArticles.error;
  if (categoriesCount.error) throw categoriesCount.error;
  if (gamesCount.error) throw gamesCount.error;
  if (latestArticlesResult.error) throw latestArticlesResult.error;
  if (gamesPublishedCount.error) throw gamesPublishedCount.error;
  if (gamesUpdatedTodayCount.error) throw gamesUpdatedTodayCount.error;
  if (latestGamesResult.error) throw latestGamesResult.error;

  const articlesTotal = totalArticles.count ?? 0;
  const publishedTotal = publishedArticles.count ?? 0;
  const draftTotal = Math.max(articlesTotal - publishedTotal, 0);
  const categoriesTotal = categoriesCount.count ?? 0;
  const gamesTotal = gamesCount.count ?? 0;
  const latestArticles = latestArticlesResult.data ?? [];
  const gamesPublishedTotal = gamesPublishedCount.count ?? 0;
  const gamesDraftTotal = Math.max(gamesTotal - gamesPublishedTotal, 0);
  const gamesUpdatedTodayTotal = gamesUpdatedTodayCount.count ?? 0;
  const latestGames = latestGamesResult.data ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/60 bg-surface/90 p-8 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Admin overview</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted">
              {session?.user.email ? `Signed in as ${session.user.email}` : "Signed in"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/articles/write/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark"
            >
              New article
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-border/30 hover:bg-surface"
            >
              View site ↗
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Articles</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{articlesTotal}</p>
          <p className="mt-1 text-xs text-muted">Total entries</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Published articles</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{publishedTotal}</p>
          <p className="mt-1 text-xs text-muted">Live on site</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Draft articles</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{draftTotal}</p>
          <p className="mt-1 text-xs text-muted">Awaiting publication</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Published games</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{gamesPublishedTotal}</p>
          <p className="mt-1 text-xs text-muted">Out of {gamesTotal} tracked</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Game drafts</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{gamesDraftTotal}</p>
          <p className="mt-1 text-xs text-muted">Needs a final review</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted">Updated today</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{gamesUpdatedTodayTotal}</p>
          <p className="mt-1 text-xs text-muted">Fresh game page edits</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/60 bg-surface/80 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Latest article edits</h2>
              <Link href="/admin/articles" className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border/40 text-sm">
                <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Updated</th>
                    <th className="px-4 py-2 text-right">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {latestArticles.map((article) => (
                    <tr key={article.id} className="hover:bg-surface-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{article.title}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            article.is_published
                              ? "bg-emerald-500/10 text-emerald-200"
                              : "bg-yellow-500/10 text-yellow-200"
                          }`}
                        >
                          {article.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{new Date(article.updated_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/articles/write/${article.id}`}
                          className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {latestArticles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted">
                        No articles yet. Create your first entry to populate the dashboard.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-surface/80 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Latest game updates</h2>
              <Link href="/admin/games" className="text-xs font-semibold text-accent underline-offset-2 hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border/40 text-sm">
                <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Game</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Updated</th>
                    <th className="px-4 py-2 text-right">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {latestGames.map((game) => (
                    <tr key={game.id} className="hover:bg-surface-muted/40">
                      <td className="px-4 py-3 font-medium text-foreground">{game.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            game.is_published
                              ? "bg-emerald-500/10 text-emerald-200"
                              : "bg-yellow-500/10 text-yellow-200"
                          }`}
                        >
                          {game.is_published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{new Date(game.updated_at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {game.slug ? (
                            <Link
                              href={`/${game.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
                            >
                              Live
                            </Link>
                          ) : null}
                          <Link
                            href="/admin/games"
                            className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
                          >
                            Manage
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {latestGames.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-muted">
                        No game pages yet. Sync your first game to see it here.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="space-y-4 rounded-2xl border border-border/60 bg-surface/80 p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Quick links</h2>
            <span className="text-xs uppercase tracking-wide text-muted">Tools</span>
          </div>
          <div className="grid gap-3 text-sm">
            <Link
              href="/admin/media"
              className="rounded-lg border border-border/60 bg-background px-4 py-3 font-semibold text-foreground transition hover:border-border/30 hover:bg-surface"
            >
              Manage media library
            </Link>
            <Link
              href="/admin/article-categories"
              className="rounded-lg border border-border/60 bg-background px-4 py-3 font-semibold text-foreground transition hover:border-border/30 hover:bg-surface"
            >
              Organize article categories
            </Link>
            <Link
              href="/admin/games"
              className="rounded-lg border border-border/60 bg-background px-4 py-3 font-semibold text-foreground transition hover:border-border/30 hover:bg-surface"
            >
              Sync game codes
            </Link>
            <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-xs text-muted">
              <p className="font-semibold text-foreground">Categories tracked</p>
              <p className="text-sm">{categoriesTotal}</p>
              <p className="mt-2">Keep topics tidy to power the on-site navigation and SEO hubs.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3 text-xs text-muted">
              <p className="font-semibold text-foreground">Game insights</p>
              <ul className="mt-2 space-y-1">
                <li>
                  <span className="font-semibold text-foreground">{gamesTotal}</span> total games tracked.
                </li>
                <li>
                  <span className="font-semibold text-foreground">{gamesPublishedTotal}</span> published pages live.
                </li>
                <li>
                  <span className="font-semibold text-foreground">{gamesUpdatedTodayTotal}</span> touched today.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
