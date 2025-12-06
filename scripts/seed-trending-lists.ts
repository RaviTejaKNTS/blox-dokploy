// scripts/seed-trending-lists.ts
import "dotenv/config";
import { supabaseAdmin } from "@/lib/supabase";

type ListConfig = {
  slug: string;
  title: string;
  displayName?: string | null;
  genre?: string | null;      // top-level genre -> maps to genre_l1
  subgenre?: string | null;   // sub-genre -> maps to genre_l2
};

const BASE_METRIC_KEY = "playing";
const BASE_METRIC_LABEL = "Playing now";

const trendingLists: ListConfig[] = [
  // Action
  { slug: "top-trending-roblox-action-games", title: "Top Trending Roblox Action Games", genre: "Action" },
  { slug: "top-trending-roblox-battlegrounds-fighting-games", title: "Top Trending Roblox Battlegrounds & Fighting Games", genre: "Action", subgenre: "Battlegrounds & Fighting" },
  { slug: "top-trending-roblox-music-rhythm-games", title: "Top Trending Roblox Music & Rhythm Games", genre: "Action", subgenre: "Music & Rhythm" },
  { slug: "top-trending-roblox-open-world-action-games", title: "Top Trending Roblox Open World Action Games", genre: "Action", subgenre: "Open World Action" },

  // Adventure
  { slug: "top-trending-roblox-adventure-games", title: "Top Trending Roblox Adventure Games", genre: "Adventure" },
  { slug: "top-trending-roblox-exploration-games", title: "Top Trending Roblox Exploration Games", genre: "Adventure", subgenre: "Exploration" },
  { slug: "top-trending-roblox-scavenger-hunt-games", title: "Top Trending Roblox Scavenger Hunt Games", genre: "Adventure", subgenre: "Scavenger Hunt" },
  { slug: "top-trending-roblox-story-games", title: "Top Trending Roblox Story Games", genre: "Adventure", subgenre: "Story" },

  // Education
  { slug: "top-trending-roblox-education-games", title: "Top Trending Roblox Education Games", genre: "Education" },

  // Entertainment
  { slug: "top-trending-roblox-entertainment-games", title: "Top Trending Roblox Entertainment Games", genre: "Entertainment" },
  { slug: "top-trending-roblox-music-audio-games", title: "Top Trending Roblox Music & Audio Games", genre: "Entertainment", subgenre: "Music & Audio" },
  { slug: "top-trending-roblox-showcase-hub-games", title: "Top Trending Roblox Showcase & Hub Games", genre: "Entertainment", subgenre: "Showcase & Hub" },
  { slug: "top-trending-roblox-video-games", title: "Top Trending Roblox Video Games", genre: "Entertainment", subgenre: "Video" },

  // Obby & Platformer
  { slug: "top-trending-roblox-obby-platformer-games", title: "Top Trending Roblox Obby & Platformer Games", genre: "Obby & Platformer" },
  { slug: "top-trending-roblox-classic-obby-games", title: "Top Trending Roblox Classic Obby Games", genre: "Obby & Platformer", subgenre: "Classic Obby" },
  { slug: "top-trending-roblox-runner-games", title: "Top Trending Roblox Runner Games", genre: "Obby & Platformer", subgenre: "Runner" },
  { slug: "top-trending-roblox-tower-obby-games", title: "Top Trending Roblox Tower Obby Games", genre: "Obby & Platformer", subgenre: "Tower Obby" },

  // Party & Casual
  { slug: "top-trending-roblox-party-casual-games", title: "Top Trending Roblox Party & Casual Games", genre: "Party & Casual" },
  { slug: "top-trending-roblox-childhood-game-games", title: "Top Trending Roblox Childhood Game Games", genre: "Party & Casual", subgenre: "Childhood Game" },
  { slug: "top-trending-roblox-coloring-drawing-games", title: "Top Trending Roblox Coloring & Drawing Games", genre: "Party & Casual", subgenre: "Coloring & Drawing" },
  { slug: "top-trending-roblox-minigame-games", title: "Top Trending Roblox Minigame Games", genre: "Party & Casual", subgenre: "Minigame" },
  { slug: "top-trending-roblox-quiz-games", title: "Top Trending Roblox Quiz Games", genre: "Party & Casual", subgenre: "Quiz" },

  // Puzzle
  { slug: "top-trending-roblox-puzzle-games", title: "Top Trending Roblox Puzzle Games", genre: "Puzzle" },
  { slug: "top-trending-roblox-escape-room-games", title: "Top Trending Roblox Escape Room Games", genre: "Puzzle", subgenre: "Escape Room" },
  { slug: "top-trending-roblox-match-merge-games", title: "Top Trending Roblox Match & Merge Games", genre: "Puzzle", subgenre: "Match & Merge" },
  { slug: "top-trending-roblox-word-games", title: "Top Trending Roblox Word Games", genre: "Puzzle", subgenre: "Word" },

  // RPG
  { slug: "top-trending-roblox-rpg-games", title: "Top Trending Roblox RPG Games", genre: "RPG" },
  { slug: "top-trending-roblox-action-rpg-games", title: "Top Trending Roblox Action RPG Games", genre: "RPG", subgenre: "Action RPG" },
  { slug: "top-trending-roblox-open-world-survival-rpg-games", title: "Top Trending Roblox Open World & Survival RPG Games", genre: "RPG", subgenre: "Open World & Survival RPG" },
  { slug: "top-trending-roblox-turn-based-rpg-games", title: "Top Trending Roblox Turn-based RPG Games", genre: "RPG", subgenre: "Turn-based RPG" },

  // Roleplay & Avatar Sim
  { slug: "top-trending-roblox-roleplay-avatar-sim-games", title: "Top Trending Roblox Roleplay & Avatar Sim Games", genre: "Roleplay & Avatar Sim" },
  { slug: "top-trending-roblox-animal-sim-games", title: "Top Trending Roblox Animal Sim Games", genre: "Roleplay & Avatar Sim", subgenre: "Animal Sim" },
  { slug: "top-trending-roblox-dress-up-games", title: "Top Trending Roblox Dress Up Games", genre: "Roleplay & Avatar Sim", subgenre: "Dress Up" },
  { slug: "top-trending-roblox-life-games", title: "Top Trending Roblox Life Games", genre: "Roleplay & Avatar Sim", subgenre: "Life" },
  { slug: "top-trending-roblox-morph-roleplay-games", title: "Top Trending Roblox Morph Roleplay Games", genre: "Roleplay & Avatar Sim", subgenre: "Morph Roleplay" },
  { slug: "top-trending-roblox-pet-care-games", title: "Top Trending Roblox Pet Care Games", genre: "Roleplay & Avatar Sim", subgenre: "Pet Care" },

  // Shooter
  { slug: "top-trending-roblox-shooter-games", title: "Top Trending Roblox Shooter Games", genre: "Shooter" },
  { slug: "top-trending-roblox-battle-royale-games", title: "Top Trending Roblox Battle Royale Games", genre: "Shooter", subgenre: "Battle Royale" },
  { slug: "top-trending-roblox-deathmatch-shooter-games", title: "Top Trending Roblox Deathmatch Shooter Games", genre: "Shooter", subgenre: "Deathmatch Shooter" },
  { slug: "top-trending-roblox-pve-shooter-games", title: "Top Trending Roblox PvE Shooter Games", genre: "Shooter", subgenre: "PvE Shooter" },

  // Shopping
  { slug: "top-trending-roblox-shopping-games", title: "Top Trending Roblox Shopping Games", genre: "Shopping" },
  { slug: "top-trending-roblox-avatar-shopping-games", title: "Top Trending Roblox Avatar Shopping Games", genre: "Shopping", subgenre: "Avatar Shopping" },

  // Simulation
  { slug: "top-trending-roblox-simulation-games", title: "Top Trending Roblox Simulation Games", genre: "Simulation" },
  { slug: "top-trending-roblox-idle-games", title: "Top Trending Roblox Idle Games", genre: "Simulation", subgenre: "Idle" },
  { slug: "top-trending-roblox-incremental-simulator-games", title: "Top Trending Roblox Incremental Simulator Games", genre: "Simulation", subgenre: "Incremental Simulator" },
  { slug: "top-trending-roblox-physics-sim-games", title: "Top Trending Roblox Physics Sim Games", genre: "Simulation", subgenre: "Physics Sim" },
  { slug: "top-trending-roblox-sandbox-games", title: "Top Trending Roblox Sandbox Games", genre: "Simulation", subgenre: "Sandbox" },
  { slug: "top-trending-roblox-tycoon-games", title: "Top Trending Roblox Tycoon Games", genre: "Simulation", subgenre: "Tycoon" },
  { slug: "top-trending-roblox-vehicle-sim-games", title: "Top Trending Roblox Vehicle Sim Games", genre: "Simulation", subgenre: "Vehicle Sim" },

  // Social
  { slug: "top-trending-roblox-social-games", title: "Top Trending Roblox Social Games", genre: "Social" },

  // Sports & Racing
  { slug: "top-trending-roblox-sports-racing-games", title: "Top Trending Roblox Sports & Racing Games", genre: "Sports & Racing" },
  { slug: "top-trending-roblox-racing-games", title: "Top Trending Roblox Racing Games", genre: "Sports & Racing", subgenre: "Racing" },
  { slug: "top-trending-roblox-sports-games", title: "Top Trending Roblox Sports Games", genre: "Sports & Racing", subgenre: "Sports" },

  // Strategy
  { slug: "top-trending-roblox-strategy-games", title: "Top Trending Roblox Strategy Games", genre: "Strategy" },
  { slug: "top-trending-roblox-board-card-games", title: "Top Trending Roblox Board & Card Games", genre: "Strategy", subgenre: "Board & Card Games" },
  { slug: "top-trending-roblox-tower-defense-games", title: "Top Trending Roblox Tower Defense Games", genre: "Strategy", subgenre: "Tower Defense" },

  // Survival
  { slug: "top-trending-roblox-survival-games", title: "Top Trending Roblox Survival Games", genre: "Survival" },
  { slug: "top-trending-roblox-1-vs-all-games", title: "Top Trending Roblox 1 vs All Games", genre: "Survival", subgenre: "1 vs All" },
  { slug: "top-trending-roblox-escape-games", title: "Top Trending Roblox Escape Games", genre: "Survival", subgenre: "Escape" },

  // Utility & Other
  { slug: "top-trending-roblox-utility-other-games", title: "Top Trending Roblox Utility & Other Games", genre: "Utility & Other" }
];

async function main() {
  const supabase = supabaseAdmin();

  const payload = trendingLists.map((item) => ({
    slug: item.slug,
    title: item.title,
    display_name: item.displayName ?? item.title,
    list_type: "sql",
    filter_config: {
      mode: "filter",
      metric: BASE_METRIC_KEY,
      direction: "desc",
      ...(item.genre ? { genre_l1: item.genre } : {}),
      ...(item.subgenre ? { genre_l2: item.subgenre } : {})
    },
    limit_count: 50,
    is_published: true,
    primary_metric_key: BASE_METRIC_KEY,
    primary_metric_label: BASE_METRIC_LABEL
  }));

  const { error } = await supabase
    .from("game_lists")
    .upsert(payload, { onConflict: "slug" });

  if (error) {
    console.error("Failed to upsert lists", error);
    process.exit(1);
  }

  console.log(`Upserted ${payload.length} trending lists.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
