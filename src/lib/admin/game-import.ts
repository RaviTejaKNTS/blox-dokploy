import type { SupabaseClient } from "@supabase/supabase-js";
import { scrapeSources } from "@/lib/scraper";
import { deriveGameName, normalizeGameSlug, slugFromUrl } from "@/lib/slug";

export function computeGameDetails(params: {
  name?: string | null;
  slug?: string | null;
  sourceUrl?: string | null;
}) {
  const fallback = params.name ?? slugFromUrl(params.sourceUrl ?? "") ?? "";
  const slug = normalizeGameSlug(params.slug, fallback);
  if (!slug) {
    throw new Error("Slug could not be generated. Provide a name or valid source URL.");
  }

  const name = deriveGameName({ name: params.name, slug, sourceUrl: params.sourceUrl ?? null });
  if (!name) {
    throw new Error("Name could not be derived. Provide a game name or valid source URL.");
  }

  return { slug, name };
}

export type SyncResult = {
  codesFound: number;
  codesUpserted: number;
  expiredCodes: string[];
  errors: string[];
};

export async function syncGameCodesFromSources(
  supabase: SupabaseClient,
  gameId: string,
  sources: Array<string | null | undefined>
): Promise<SyncResult> {
  const sourceList = sources
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value, index, self) => value.length > 0 && self.indexOf(value) === index);

  if (sourceList.length === 0) {
    return { codesFound: 0, codesUpserted: 0, expiredCodes: [], errors: [] };
  }

  let codes;
  let expiredCodes;
  try {
    ({ codes, expiredCodes } = await scrapeSources(sourceList));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { codesFound: 0, codesUpserted: 0, expiredCodes: [], errors: [message] };
  }

  let upserted = 0;

  for (const entry of codes) {
    const { error } = await supabase.rpc("upsert_code", {
      p_game_id: gameId,
      p_code: entry.code,
      p_status: entry.status,
      p_rewards_text: entry.rewardsText ?? null,
      p_level_requirement: entry.levelRequirement ?? null,
      p_is_new: entry.isNew ?? false
    });

    if (error) {
      throw new Error(`Upsert failed for ${entry.code}: ${error.message}`);
    }

    upserted += 1;
  }

  await supabase
    .from("games")
    .update({ expired_codes: expiredCodes })
    .eq("id", gameId);

  if (expiredCodes.length > 0) {
    await supabase
      .from("codes")
      .delete()
      .eq("game_id", gameId)
      .eq("status", "expired");
  }

  return { codesFound: codes.length, codesUpserted: upserted, expiredCodes, errors: [] };
}
