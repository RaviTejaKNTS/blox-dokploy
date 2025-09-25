import { fetchAdminAuthors, fetchAdminGames } from "@/lib/admin/games";
import { supabaseAdmin } from "@/lib/supabase";
import { GamesClient } from "@/components/admin/games/GamesClient";

export const metadata = {
  title: "Games"
};

export default async function AdminGamesPage() {
  const supabase = supabaseAdmin();
  const [games, authors] = await Promise.all([
    fetchAdminGames(supabase),
    fetchAdminAuthors(supabase)
  ]);

  return <GamesClient initialGames={games} authors={authors} />;
}
