export type TraitType =
  | "weapon"
  | "armor"
  | "both"
  | "armor_aoe"
  | "weapon_aoe"
  | "armor_defense"
  | "movement"
  | null;

export type Ore = {
  id: string;
  name: string;
  imageUrl?: string | null;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythical" | "Divine" | "Relic" | "Exotic";
  areaGroup:
    | "Stonewake"
    | "Stone Wakes Cross"
    | "Forgotten Kingdom"
    | "Goblin Cave"
    | "Enemy Drop"
    | "Frostpire Expanse"
    | "The Peak";
  dropChanceRatio: number; // denominator for 1/x drop
  multiplier: number;
  sellPrice: number | null;
  hasTrait: boolean;
  traitName: string | null;
  traitEffectShort: string | null;
  traitType: TraitType;
};

export type WeaponClass =
  | "Dagger"
  | "Straight Sword"
  | "Gauntlet"
  | "Katana"
  | "Great Sword"
  | "Great Axe"
  | "Colossal Sword";

export type Weapon = {
  id: string;
  name: string;
  class: WeaponClass;
  baseDamage: number;
  baseSpeedSeconds: number;
  baseRange: number;
  sellPrice: number;
  internalWeightRatio: number; // denominator for 1/x chance inside the class
  classMinOre: number;
  classOptimalOre: number;
};

export type ArmorSlot = "Helmet" | "Chestplate" | "Leggings";
export type ArmorWeightClass = "Light" | "Medium" | "Samurai" | "Knight" | "Dark Knight";
export type ArmorWeightGroup = "Light" | "Medium" | "Heavy";

export type ArmorPiece = {
  id: string;
  name: string;
  weightClass: ArmorWeightClass;
  slot: ArmorSlot;
  baseHealthPercent: number;
  chanceRatio: number; // denominator for 1/x chance inside the weight class group
  sellPrice: number;
  baseWeightGroup: ArmorWeightGroup;
};

export const MIN_TOTAL_ORE_COUNT = 3;
export const MAX_TOTAL_ORE_COUNT = 120;
export const MAX_ORE_TYPES = 4;

export type QualityTier = "Broken" | "Worn" | "Standard" | "Fine" | "Masterwork";

export const QUALITY_TIERS: Array<{ tier: QualityTier; multiplier: number }> = [
  { tier: "Broken", multiplier: 0.85 },
  { tier: "Worn", multiplier: 0.95 },
  { tier: "Standard", multiplier: 1 },
  { tier: "Fine", multiplier: 1.1 },
  { tier: "Masterwork", multiplier: 1.2 }
];

export const WEAPON_CLASS_THRESHOLDS: Record<WeaponClass, { minOre: number; optimalOre: number }> = {
  Dagger: { minOre: 3, optimalOre: 3 },
  "Straight Sword": { minOre: 4, optimalOre: 6 },
  Gauntlet: { minOre: 7, optimalOre: 9 },
  Katana: { minOre: 9, optimalOre: 12 },
  "Great Sword": { minOre: 12, optimalOre: 16 },
  "Great Axe": { minOre: 16, optimalOre: 22 },
  "Colossal Sword": { minOre: 21, optimalOre: 50 }
};

export const ARMOR_WEIGHT_THRESHOLDS: Record<ArmorWeightGroup, { minOre: number; optimalOre: number }> = {
  Light: { minOre: 3, optimalOre: 3 },
  Medium: { minOre: 10, optimalOre: 21 },
  Heavy: { minOre: 20, optimalOre: 40 }
};

export type ProbabilityAnchor = {
  minOre: number;
  minChance: number;
  optimalOre: number;
  optimalChance: number;
};

export const WEAPON_CLASS_ANCHORS: Record<WeaponClass, ProbabilityAnchor> = {
  Dagger: { minOre: 3, minChance: 1, optimalOre: 3, optimalChance: 1 },
  "Straight Sword": { minOre: 4, minChance: 0.14, optimalOre: 6, optimalChance: 0.86 },
  Gauntlet: { minOre: 7, minChance: 0.2, optimalOre: 9, optimalChance: 0.65 },
  Katana: { minOre: 9, minChance: 0.1, optimalOre: 12, optimalChance: 0.72 },
  "Great Sword": { minOre: 12, minChance: 0.03, optimalOre: 16, optimalChance: 0.69 },
  "Great Axe": { minOre: 16, minChance: 0.01, optimalOre: 22, optimalChance: 0.67 },
  "Colossal Sword": { minOre: 21, minChance: 0.02, optimalOre: 50, optimalChance: 0.7 }
};

export type ArmorPieceAnchorKey = `${ArmorWeightGroup}-${ArmorSlot}`;

export const ARMOR_PIECE_ANCHORS: Record<ArmorPieceAnchorKey, ProbabilityAnchor> = {
  "Light-Helmet": { minOre: 3, minChance: 1, optimalOre: 3, optimalChance: 1 },
  "Light-Leggings": { minOre: 5, minChance: 0.11, optimalOre: 7, optimalChance: 0.67 },
  "Light-Chestplate": { minOre: 7, minChance: 0.01, optimalOre: 10, optimalChance: 0.53 },
  "Medium-Helmet": { minOre: 10, minChance: 0.12, optimalOre: 13, optimalChance: 0.6 },
  "Medium-Leggings": { minOre: 13, minChance: 0.01, optimalOre: 17, optimalChance: 0.57 },
  "Medium-Chestplate": { minOre: 17, minChance: 0.01, optimalOre: 21, optimalChance: 0.63 },
  "Heavy-Helmet": { minOre: 20, minChance: 0.05, optimalOre: 25, optimalChance: 0.51 },
  "Heavy-Leggings": { minOre: 25, minChance: 0.01, optimalOre: 30, optimalChance: 0.46 },
  "Heavy-Chestplate": { minOre: 30, minChance: 0.01, optimalOre: 40, optimalChance: 0.84 }
};

export const ORES: Ore[] = [
  // Stonewake’s Cross ores
  {
    id: "stone",
    name: "Stone",
    rarity: "Common",
    areaGroup: "Stonewake",
    dropChanceRatio: 1,
    multiplier: 0.2,
    sellPrice: 3,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "sand-stone",
    name: "Sand Stone",
    rarity: "Common",
    areaGroup: "Stonewake",
    dropChanceRatio: 2,
    multiplier: 0.25,
    sellPrice: 3.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "copper",
    name: "Copper",
    rarity: "Common",
    areaGroup: "Stonewake",
    dropChanceRatio: 3,
    multiplier: 0.3,
    sellPrice: 4.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "iron",
    name: "Iron",
    rarity: "Common",
    areaGroup: "Stonewake",
    dropChanceRatio: 5,
    multiplier: 0.35,
    sellPrice: 5.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "cardboardite",
    name: "Cardboardite",
    rarity: "Common",
    areaGroup: "Stonewake",
    dropChanceRatio: 31,
    multiplier: 0.7,
    sellPrice: 10.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "tin",
    name: "Tin",
    rarity: "Uncommon",
    areaGroup: "Stonewake",
    dropChanceRatio: 7,
    multiplier: 0.425,
    sellPrice: 6.38,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "silver",
    name: "Silver",
    rarity: "Uncommon",
    areaGroup: "Stonewake",
    dropChanceRatio: 12,
    multiplier: 0.5,
    sellPrice: 7.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "gold",
    name: "Gold",
    rarity: "Uncommon",
    areaGroup: "Stonewake",
    dropChanceRatio: 16,
    multiplier: 0.65,
    sellPrice: 19.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "bananite",
    name: "Bananite",
    rarity: "Uncommon",
    areaGroup: "Stonewake",
    dropChanceRatio: 30,
    multiplier: 0.85,
    sellPrice: 12.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "mushroomite",
    name: "Mushroomite",
    rarity: "Rare",
    areaGroup: "Stonewake",
    dropChanceRatio: 22,
    multiplier: 0.8,
    sellPrice: 12,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "platinum",
    name: "Platinum",
    rarity: "Rare",
    areaGroup: "Stonewake",
    dropChanceRatio: 28,
    multiplier: 0.8,
    sellPrice: 12,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "aite",
    name: "Aite",
    rarity: "Epic",
    areaGroup: "Stonewake",
    dropChanceRatio: 44,
    multiplier: 1.1,
    sellPrice: 16.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "poopite",
    name: "Poopite",
    rarity: "Epic",
    areaGroup: "Stonewake",
    dropChanceRatio: 131,
    multiplier: 1.2,
    sellPrice: 18,
    hasTrait: true,
    traitName: "Poison Panic",
    traitEffectShort: "When HP drops below 35%, releases poison dealing 15% damage over 5 seconds (cooldown applies)",
    traitType: "armor_aoe"
  },

  // Forgotten Kingdom ores
  {
    id: "cobalt",
    name: "Cobalt",
    rarity: "Uncommon",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 37,
    multiplier: 1,
    sellPrice: 15,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "titanium",
    name: "Titanium",
    rarity: "Uncommon",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 50,
    multiplier: 1.15,
    sellPrice: 17.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "lapis-lazuli",
    name: "Lapis Lazuli",
    rarity: "Uncommon",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 73,
    multiplier: 1.3,
    sellPrice: 22.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "volcanic-rock",
    name: "Volcanic Rock",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 55,
    multiplier: 1.55,
    sellPrice: 23.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "quartz",
    name: "Quartz",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 90,
    multiplier: 1.5,
    sellPrice: 22.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "amethyst",
    name: "Amethyst",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 115,
    multiplier: 1.65,
    sellPrice: 24.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "topaz",
    name: "Topaz",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 143,
    multiplier: 1.75,
    sellPrice: 26.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "diamond",
    name: "Diamond",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 192,
    multiplier: 2,
    sellPrice: 30,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "sapphire",
    name: "Sapphire",
    rarity: "Rare",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 247,
    multiplier: 2.25,
    sellPrice: 33.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "cuprite",
    name: "Cuprite",
    rarity: "Epic",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 303,
    multiplier: 2.43,
    sellPrice: 36.45,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "obsidian",
    name: "Obsidian",
    rarity: "Epic",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 333,
    multiplier: 2.35,
    sellPrice: 35.25,
    hasTrait: true,
    traitName: "Obsidian Guard",
    traitEffectShort: "Armor gains +30% defense",
    traitType: "armor"
  },
  {
    id: "emerald",
    name: "Emerald",
    rarity: "Epic",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 363,
    multiplier: 2.55,
    sellPrice: 38.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "ruby",
    name: "Ruby",
    rarity: "Epic",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 487,
    multiplier: 2.95,
    sellPrice: 44.25,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "rivalite",
    name: "Rivalite",
    rarity: "Epic",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 569,
    multiplier: 3.33,
    sellPrice: 49.95,
    hasTrait: true,
    traitName: "Critical Edge",
    traitEffectShort: "Weapons gain +20% critical hit chance",
    traitType: "weapon"
  },
  {
    id: "uranium",
    name: "Uranium",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 777,
    multiplier: 3,
    sellPrice: 66,
    hasTrait: true,
    traitName: "Radioactive Pulse",
    traitEffectShort: "Armor deals periodic area damage equal to 5% of max HP",
    traitType: "armor_aoe"
  },
  {
    id: "mythril",
    name: "Mythril",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 813,
    multiplier: 3.5,
    sellPrice: 52.5,
    hasTrait: true,
    traitName: "Mythril Guard",
    traitEffectShort: "Armor gains +15% additional defense",
    traitType: "armor"
  },
  {
    id: "eye-ore",
    name: "Eye Ore",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 1333,
    multiplier: 4,
    sellPrice: 37.5,
    hasTrait: true,
    traitName: "Blood Price",
    traitEffectShort: "You get +15% damage, −10% maximum health",
    traitType: "both"
  },
  {
    id: "fireite",
    name: "Fireite",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 2187,
    multiplier: 4.5,
    sellPrice: 67.5,
    hasTrait: true,
    traitName: "Flame Brand",
    traitEffectShort: "Weapons have a 20% chance to apply burn dealing 20% damage over time",
    traitType: "weapon"
  },
  {
    id: "magmaite",
    name: "Magmaite",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 3003,
    multiplier: 5,
    sellPrice: 75,
    hasTrait: true,
    traitName: "Volcanic Burst",
    traitEffectShort: "Weapons have a 35% chance to trigger an explosion dealing 50% weapon damage",
    traitType: "weapon_aoe"
  },
  {
    id: "lightite",
    name: "Lightite",
    rarity: "Legendary",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 3333,
    multiplier: 4.6,
    sellPrice: 69,
    hasTrait: true,
    traitName: "Lightfoot",
    traitEffectShort: "Armor grants +15% movement speed",
    traitType: "movement"
  },
  {
    id: "demonite",
    name: "Demonite",
    rarity: "Mythical",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 3666,
    multiplier: 5.5,
    sellPrice: 82.5,
    hasTrait: true,
    traitName: "Hellfire",
    traitEffectShort: "Weapons apply burn dealing 20% damage; armor burns nearby enemies",
    traitType: "both"
  },
  {
    id: "darkryte",
    name: "Darkryte",
    rarity: "Mythical",
    areaGroup: "Forgotten Kingdom",
    dropChanceRatio: 5555,
    multiplier: 6.3,
    sellPrice: 94.5,
    hasTrait: true,
    traitName: "Shadowstep",
    traitEffectShort: "Armor has a 15% chance to completely dodge incoming damage",
    traitType: "armor_defense"
  },

  // Goblin Cave ores
  {
    id: "magenta-crystal",
    name: "Magenta Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 3.1,
    sellPrice: 46.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "crimson-crystal",
    name: "Crimson Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 3.3,
    sellPrice: 49.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "green-crystal",
    name: "Green Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 3.2,
    sellPrice: 48,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "orange-crystal",
    name: "Orange Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 3,
    sellPrice: 45,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "blue-crystal",
    name: "Blue Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 3.4,
    sellPrice: 51,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "arcane-crystal",
    name: "Arcane Crystal",
    rarity: "Epic",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 255,
    multiplier: 7.5,
    sellPrice: 112.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "rainbow-crystal",
    name: "Rainbow Crystal",
    rarity: "Legendary",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 5000,
    multiplier: 5.25,
    sellPrice: 78.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "galaxite",
    name: "Galaxite",
    rarity: "Divine",
    areaGroup: "Goblin Cave",
    dropChanceRatio: 1_000_000,
    multiplier: 11.5,
    sellPrice: null,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },

  // Enemy drop ores
  {
    id: "slimite",
    name: "Slimite",
    rarity: "Epic",
    areaGroup: "Enemy Drop",
    dropChanceRatio: 247,
    multiplier: 2.25,
    sellPrice: 37.5,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "dark-boneite",
    name: "Dark Boneite",
    rarity: "Rare",
    areaGroup: "Enemy Drop",
    dropChanceRatio: 555,
    multiplier: 2.25,
    sellPrice: 33.75,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  },
  {
    id: "boneite",
    name: "Boneite",
    rarity: "Rare",
    areaGroup: "Enemy Drop",
    dropChanceRatio: 222,
    multiplier: 1.2,
    sellPrice: 18,
    hasTrait: false,
    traitName: null,
    traitEffectShort: null,
    traitType: null
  }
];

export const ORES_BY_ID: Record<string, Ore> = ORES.reduce(
  (acc, ore) => {
    acc[ore.id] = ore;
    return acc;
  },
  {} as Record<string, Ore>
);

// Map ore ids to image paths in public/force-crafting-tool
export const ORE_IMAGE_MAP: Record<string, string> = {
  "stone": "/force-crafting-tool/Stone.webp",
  "sand-stone": "/force-crafting-tool/Sandstone.webp",
  "copper": "/force-crafting-tool/Copper.webp",
  "iron": "/force-crafting-tool/Iron.webp",
  "cardboardite": "/force-crafting-tool/Cardboardite.webp",
  "tin": "/force-crafting-tool/Tin.webp",
  "silver": "/force-crafting-tool/Silver.webp",
  "gold": "/force-crafting-tool/Gold.webp",
  "bananite": "/force-crafting-tool/Bananite.webp",
  "mushroomite": "/force-crafting-tool/Mushroomite.webp",
  "platinum": "/force-crafting-tool/Platinum.webp",
  "aite": "/force-crafting-tool/Aite.webp",
  "poopite": "/force-crafting-tool/Poopite.webp",
  "cobalt": "/force-crafting-tool/Cobalt.webp",
  "titanium": "/force-crafting-tool/Titanium.webp",
  "lapis-lazuli": "/force-crafting-tool/Lapis_Lazuli.webp",
  "volcanic-rock": "/force-crafting-tool/Volcanic_Rock.webp",
  "quartz": "/force-crafting-tool/Quartz.webp",
  "amethyst": "/force-crafting-tool/Amethyst.webp",
  "topaz": "/force-crafting-tool/Topaz.webp",
  "diamond": "/force-crafting-tool/Diamond.webp",
  "sapphire": "/force-crafting-tool/Sapphire.webp",
  "cuprite": "/force-crafting-tool/Cuprite.webp",
  "obsidian": "/force-crafting-tool/Obsidian.webp",
  "emerald": "/force-crafting-tool/Emerald.webp",
  "ruby": "/force-crafting-tool/Ruby.webp",
  "rivalite": "/force-crafting-tool/Rivalite.webp",
  "uranium": "/force-crafting-tool/Uranium.webp",
  "mythril": "/force-crafting-tool/Mythril.webp",
  "eye-ore": "/force-crafting-tool/Eye_Ore.webp",
  "fireite": "/force-crafting-tool/Fireite.webp",
  "magmaite": "/force-crafting-tool/Magmaite.webp",
  "lightite": "/force-crafting-tool/Lightite.webp",
  "demonite": "/force-crafting-tool/Demonite.webp",
  "darkryte": "/force-crafting-tool/Darkryte.webp",
  "magenta-crystal": "/force-crafting-tool/Magenta_Crystal_Ore.webp",
  "crimson-crystal": "/force-crafting-tool/Crimson_Crystal_Ore.webp",
  "green-crystal": "/force-crafting-tool/Green_Crystal_Ore.webp",
  "orange-crystal": "/force-crafting-tool/Orange_Crystal_Ore.webp",
  "blue-crystal": "/force-crafting-tool/Blue_Crystal_Ore.webp",
  "arcane-crystal": "/force-crafting-tool/Arcane_Crystal_Ore.webp",
  "rainbow-crystal": "/force-crafting-tool/Rainbow_Crystal_Ore.webp",
  "galaxite": "/force-crafting-tool/Galaxite.webp",
  "slimite": "/force-crafting-tool/Slimite.webp",
  "dark-boneite": "/force-crafting-tool/Dark_Boneite.webp",
  "boneite": "/force-crafting-tool/Boneite.webp"
};

export const WEAPONS: Weapon[] = [
  // Daggers
  {
    id: "dagger",
    name: "Dagger",
    class: "Dagger",
    baseDamage: 4.3,
    baseSpeedSeconds: 0.35,
    baseRange: 6,
    sellPrice: 68,
    internalWeightRatio: 1,
    classMinOre: 3,
    classOptimalOre: 3
  },
  {
    id: "falchion-knife",
    name: "Falchion Knife",
    class: "Dagger",
    baseDamage: 4.3,
    baseSpeedSeconds: 0.35,
    baseRange: 6,
    sellPrice: 68,
    internalWeightRatio: 2,
    classMinOre: 3,
    classOptimalOre: 3
  },
  {
    id: "gladius-dagger",
    name: "Gladius Dagger",
    class: "Dagger",
    baseDamage: 4.3,
    baseSpeedSeconds: 0.32,
    baseRange: 6,
    sellPrice: 68,
    internalWeightRatio: 4,
    classMinOre: 3,
    classOptimalOre: 3
  },
  {
    id: "hook",
    name: "Hook",
    class: "Dagger",
    baseDamage: 4.3,
    baseSpeedSeconds: 0.35,
    baseRange: 6,
    sellPrice: 68,
    internalWeightRatio: 16,
    classMinOre: 3,
    classOptimalOre: 3
  },

  // Straight Swords
  {
    id: "chaos",
    name: "Chaos",
    class: "Straight Sword",
    baseDamage: 9.375,
    baseSpeedSeconds: 0.59,
    baseRange: 8,
    sellPrice: 120,
    internalWeightRatio: 16,
    classMinOre: 4,
    classOptimalOre: 6
  },
  {
    id: "cutlass",
    name: "Cutlass",
    class: "Straight Sword",
    baseDamage: 9.375,
    baseSpeedSeconds: 0.66,
    baseRange: 8,
    sellPrice: 120,
    internalWeightRatio: 4,
    classMinOre: 4,
    classOptimalOre: 6
  },
  {
    id: "falchion-sword",
    name: "Falchion Sword",
    class: "Straight Sword",
    baseDamage: 7.5,
    baseSpeedSeconds: 0.59,
    baseRange: 8,
    sellPrice: 120,
    internalWeightRatio: 1,
    classMinOre: 4,
    classOptimalOre: 6
  },
  {
    id: "gladius-sword",
    name: "Gladius Sword",
    class: "Straight Sword",
    baseDamage: 7.875,
    baseSpeedSeconds: 0.62,
    baseRange: 8,
    sellPrice: 120,
    internalWeightRatio: 2,
    classMinOre: 4,
    classOptimalOre: 6
  },
  {
    id: "rapier",
    name: "Rapier",
    class: "Straight Sword",
    baseDamage: 7.5,
    baseSpeedSeconds: 0.49,
    baseRange: 8,
    sellPrice: 120,
    internalWeightRatio: 8,
    classMinOre: 4,
    classOptimalOre: 6
  },

  // Gauntlets
  {
    id: "boxing-gloves",
    name: "Boxing Gloves",
    class: "Gauntlet",
    baseDamage: 8,
    baseSpeedSeconds: 0.59,
    baseRange: 6,
    sellPrice: 205,
    internalWeightRatio: 4,
    classMinOre: 7,
    classOptimalOre: 9
  },
  {
    id: "ironhand",
    name: "Ironhand",
    class: "Gauntlet",
    baseDamage: 7.6,
    baseSpeedSeconds: 0.51,
    baseRange: 6,
    sellPrice: 205,
    internalWeightRatio: 1,
    classMinOre: 7,
    classOptimalOre: 9
  },
  {
    id: "relevator",
    name: "Relevator",
    class: "Gauntlet",
    baseDamage: 9.6,
    baseSpeedSeconds: 0.69,
    baseRange: 6,
    sellPrice: 205,
    internalWeightRatio: 16,
    classMinOre: 7,
    classOptimalOre: 9
  },

  // Katanas
  {
    id: "tachi",
    name: "Tachi",
    class: "Katana",
    baseDamage: 8.925,
    baseSpeedSeconds: 0.63,
    baseRange: 9,
    sellPrice: 324,
    internalWeightRatio: 2,
    classMinOre: 9,
    classOptimalOre: 12
  },
  {
    id: "uchigatana",
    name: "Uchigatana",
    class: "Katana",
    baseDamage: 8.5,
    baseSpeedSeconds: 0.6,
    baseRange: 9,
    sellPrice: 324,
    internalWeightRatio: 1,
    classMinOre: 9,
    classOptimalOre: 12
  },

  // Great Swords
  {
    id: "crusaders-sword",
    name: "Crusaders Sword",
    class: "Great Sword",
    baseDamage: 12,
    baseSpeedSeconds: 1,
    baseRange: 9,
    sellPrice: 485,
    internalWeightRatio: 1,
    classMinOre: 12,
    classOptimalOre: 16
  },
  {
    id: "long-sword",
    name: "Long Sword",
    class: "Great Sword",
    baseDamage: 12,
    baseSpeedSeconds: 1.1,
    baseRange: 9,
    sellPrice: 485,
    internalWeightRatio: 2,
    classMinOre: 12,
    classOptimalOre: 16
  },

  // Great Axes
  {
    id: "double-battle-axe",
    name: "Double Battle Axe",
    class: "Great Axe",
    baseDamage: 15.75,
    baseSpeedSeconds: 1.05,
    baseRange: 9,
    sellPrice: 850,
    internalWeightRatio: 1,
    classMinOre: 16,
    classOptimalOre: 22
  },
  {
    id: "scythe",
    name: "Scythe",
    class: "Great Axe",
    baseDamage: 14.25,
    baseSpeedSeconds: 0.95,
    baseRange: 9,
    sellPrice: 850,
    internalWeightRatio: 2,
    classMinOre: 16,
    classOptimalOre: 22
  },

  // Colossal Swords
  {
    id: "comically-large-spoon",
    name: "Comically Large Spoon",
    class: "Colossal Sword",
    baseDamage: 18,
    baseSpeedSeconds: 1.2,
    baseRange: 10,
    sellPrice: 1355,
    internalWeightRatio: 16,
    classMinOre: 21,
    classOptimalOre: 50
  },
  {
    id: "dragon-slayer",
    name: "Dragon Slayer",
    class: "Colossal Sword",
    baseDamage: 22,
    baseSpeedSeconds: 1.12,
    baseRange: 10,
    sellPrice: 1355,
    internalWeightRatio: 3,
    classMinOre: 21,
    classOptimalOre: 50
  },
  {
    id: "great-sword",
    name: "Great Sword",
    class: "Colossal Sword",
    baseDamage: 20,
    baseSpeedSeconds: 1.12,
    baseRange: 10,
    sellPrice: 1355,
    internalWeightRatio: 1,
    classMinOre: 21,
    classOptimalOre: 50
  },
  {
    id: "hammer",
    name: "Hammer",
    class: "Colossal Sword",
    baseDamage: 22,
    baseSpeedSeconds: 1.24,
    baseRange: 10,
    sellPrice: 1355,
    internalWeightRatio: 2,
    classMinOre: 21,
    classOptimalOre: 50
  },
  {
    id: "skull-crusher",
    name: "Skull Crusher",
    class: "Colossal Sword",
    baseDamage: 24,
    baseSpeedSeconds: 1.4,
    baseRange: 10,
    sellPrice: 1355,
    internalWeightRatio: 2,
    classMinOre: 21,
    classOptimalOre: 50
  }
];

export const ARMOR_PIECES: ArmorPiece[] = [
  // Light armor
  {
    id: "light-helmet",
    name: "Light Helmet",
    weightClass: "Light",
    slot: "Helmet",
    baseHealthPercent: 3.75,
    chanceRatio: 1,
    sellPrice: 65,
    baseWeightGroup: "Light"
  },
  {
    id: "light-chestplate",
    name: "Light Chestplate",
    weightClass: "Light",
    slot: "Chestplate",
    baseHealthPercent: 5,
    chanceRatio: 1,
    sellPrice: 225,
    baseWeightGroup: "Light"
  },
  {
    id: "light-leggings",
    name: "Light Leggings",
    weightClass: "Light",
    slot: "Leggings",
    baseHealthPercent: 4.375,
    chanceRatio: 1,
    sellPrice: 112.5,
    baseWeightGroup: "Light"
  },

  // Medium armor
  {
    id: "medium-helmet",
    name: "Medium Helmet",
    weightClass: "Medium",
    slot: "Helmet",
    baseHealthPercent: 6.25,
    chanceRatio: 1,
    sellPrice: 335,
    baseWeightGroup: "Medium"
  },
  {
    id: "medium-chestplate",
    name: "Medium Chestplate",
    weightClass: "Medium",
    slot: "Chestplate",
    baseHealthPercent: 8.75,
    chanceRatio: 1,
    sellPrice: 850,
    baseWeightGroup: "Medium"
  },
  {
    id: "medium-leggings",
    name: "Medium Leggings",
    weightClass: "Medium",
    slot: "Leggings",
    baseHealthPercent: 7.5,
    chanceRatio: 1,
    sellPrice: 485,
    baseWeightGroup: "Medium"
  },

  // Samurai (Medium variant)
  {
    id: "samurai-helmet",
    name: "Samurai Helmet",
    weightClass: "Samurai",
    slot: "Helmet",
    baseHealthPercent: 8,
    chanceRatio: 2,
    sellPrice: 335,
    baseWeightGroup: "Medium"
  },
  {
    id: "samurai-chestplate",
    name: "Samurai Chestplate",
    weightClass: "Samurai",
    slot: "Chestplate",
    baseHealthPercent: 12.75,
    chanceRatio: 2,
    sellPrice: 850,
    baseWeightGroup: "Medium"
  },
  {
    id: "samurai-leggings",
    name: "Samurai Leggings",
    weightClass: "Samurai",
    slot: "Leggings",
    baseHealthPercent: 9,
    chanceRatio: 2,
    sellPrice: 485,
    baseWeightGroup: "Medium"
  },

  // Knight (Heavy variant)
  {
    id: "knight-helmet",
    name: "Knight Helmet",
    weightClass: "Knight",
    slot: "Helmet",
    baseHealthPercent: 12.5,
    chanceRatio: 1,
    sellPrice: 1020,
    baseWeightGroup: "Heavy"
  },
  {
    id: "knight-chestplate",
    name: "Knight Chestplate",
    weightClass: "Knight",
    slot: "Chestplate",
    baseHealthPercent: 16.25,
    chanceRatio: 1,
    sellPrice: 1355,
    baseWeightGroup: "Heavy"
  },
  {
    id: "knight-leggings",
    name: "Knight Leggings",
    weightClass: "Knight",
    slot: "Leggings",
    baseHealthPercent: 13.75,
    chanceRatio: 1,
    sellPrice: 1200,
    baseWeightGroup: "Heavy"
  },

  // Dark Knight (Heavy variant)
  {
    id: "dark-knight-helmet",
    name: "Dark Knight Helmet",
    weightClass: "Dark Knight",
    slot: "Helmet",
    baseHealthPercent: 18.75,
    chanceRatio: 2,
    sellPrice: 1020,
    baseWeightGroup: "Heavy"
  },
  {
    id: "dark-knight-chestplate",
    name: "Dark Knight Chestplate",
    weightClass: "Dark Knight",
    slot: "Chestplate",
    baseHealthPercent: 25,
    chanceRatio: 2,
    sellPrice: 1355,
    baseWeightGroup: "Heavy"
  },
  {
    id: "dark-knight-leggings",
    name: "Dark Knight Leggings",
    weightClass: "Dark Knight",
    slot: "Leggings",
    baseHealthPercent: 21.875,
    chanceRatio: 2,
    sellPrice: 1200,
    baseWeightGroup: "Heavy"
  }
];

export const ARMOR_SLOTS: ArmorSlot[] = ["Helmet", "Chestplate", "Leggings"];

export const ARMOR_BY_ID: Record<string, ArmorPiece> = ARMOR_PIECES.reduce(
  (acc, piece) => {
    acc[piece.id] = piece;
    return acc;
  },
  {} as Record<string, ArmorPiece>
);
