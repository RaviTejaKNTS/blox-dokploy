export type RobuxBundle = {
  id: string;
  label: string;
  priceUsd: number;
  baseMobile: number | null;
  basePcWeb: number | null;
  bonusMobile: number | null;
  bonusPcWeb: number | null;
  platforms: string[];
  active: boolean;
  sortOrder: number;
  notes?: string | null;
};

export const ROBUX_BUNDLES: RobuxBundle[] = [
  {
    id: "40",
    label: "40 Robux",
    priceUsd: 0.49,
    baseMobile: 40,
    basePcWeb: null,
    bonusMobile: 0,
    bonusPcWeb: null,
    platforms: ["Roblox Mobile App"],
    active: true,
    sortOrder: 1
  },
  {
    id: "80",
    label: "80 Robux",
    priceUsd: 0.99,
    baseMobile: 80,
    basePcWeb: null,
    bonusMobile: 8,
    bonusPcWeb: null,
    platforms: ["Roblox Mobile App", "Roblox Microsoft Store App"],
    active: true,
    sortOrder: 2
  },
  {
    id: "160",
    label: "160 Robux",
    priceUsd: 1.99,
    baseMobile: 160,
    basePcWeb: null,
    bonusMobile: 20,
    bonusPcWeb: null,
    platforms: ["Roblox Mobile App*"],
    active: true,
    sortOrder: 3,
    notes: "Marked with * in Roblox store."
  },
  {
    id: "240",
    label: "240 Robux",
    priceUsd: 2.99,
    baseMobile: 240,
    basePcWeb: null,
    bonusMobile: 30,
    bonusPcWeb: null,
    platforms: ["Roblox Mobile App"],
    active: true,
    sortOrder: 4
  },
  {
    id: "320",
    label: "320 Robux",
    priceUsd: 3.99,
    baseMobile: 320,
    basePcWeb: null,
    bonusMobile: 40,
    bonusPcWeb: null,
    platforms: ["Roblox Mobile App"],
    active: true,
    sortOrder: 5
  },
  {
    id: "400",
    label: "400 Robux (500 Robux on PC, Web or Giftcards)",
    priceUsd: 4.99,
    baseMobile: 400,
    basePcWeb: 500,
    bonusMobile: 40,
    bonusPcWeb: 50,
    platforms: ["Roblox Website", "Roblox Mobile App"],
    active: true,
    sortOrder: 6
  },
  {
    id: "800",
    label: "800 Robux (1,000 Robux on PC, Web or Giftcards)",
    priceUsd: 9.99,
    baseMobile: 800,
    basePcWeb: 1000,
    bonusMobile: 80,
    bonusPcWeb: 100,
    platforms: ["Roblox Website", "Roblox Mobile App", "Roblox Microsoft Store App"],
    active: true,
    sortOrder: 7
  },
  {
    id: "1700",
    label: "1,700 Robux (2,000 Robux on PC, Web or Giftcards)",
    priceUsd: 19.99,
    baseMobile: 1700,
    basePcWeb: 2000,
    bonusMobile: 170,
    bonusPcWeb: 200,
    platforms: ["Roblox Website", "Roblox Mobile App"],
    active: true,
    sortOrder: 8
  },
  {
    id: "2000",
    label: "2,000 Robux",
    priceUsd: 24.99,
    baseMobile: null,
    basePcWeb: 2000,
    bonusMobile: null,
    bonusPcWeb: 750,
    platforms: ["Previously on Roblox Website"],
    active: false,
    sortOrder: 9,
    notes: "Previously available on Roblox Website"
  },
  {
    id: "4500",
    label: "4,500 Robux (5,250 Robux on PC, Web or Giftcards)",
    priceUsd: 49.99,
    baseMobile: 4500,
    basePcWeb: 5250,
    bonusMobile: 450,
    bonusPcWeb: 525,
    platforms: ["Roblox Website", "Roblox Mobile App"],
    active: true,
    sortOrder: 10
  },
  {
    id: "10000",
    label: "10,000 Robux (11,000 Robux on PC, Web or Giftcards)",
    priceUsd: 99.99,
    baseMobile: 10000,
    basePcWeb: 11000,
    bonusMobile: 1000,
    bonusPcWeb: 1100,
    platforms: ["Roblox Website", "Roblox Mobile App"],
    active: true,
    sortOrder: 11
  },
  {
    id: "22500",
    label: "22,500 Robux (24,000 Robux on PC, Web or Giftcards)",
    priceUsd: 199.99,
    baseMobile: 22500,
    basePcWeb: 24000,
    bonusMobile: 2250,
    bonusPcWeb: 2400,
    platforms: ["Roblox Website", "Roblox Mobile App"],
    active: true,
    sortOrder: 12
  },
  {
    id: "75000",
    label: "75,000 Robux",
    priceUsd: 399.95,
    baseMobile: null,
    basePcWeb: 75000,
    bonusMobile: null,
    bonusPcWeb: 25000,
    platforms: ["Previously on Roblox Website"],
    active: false,
    sortOrder: 13,
    notes: "Previously available on Roblox Website"
  }
];

export async function fetchRobuxBundles(): Promise<RobuxBundle[]> {
  return ROBUX_BUNDLES.map((bundle) => ({ ...bundle }));
}

export const ROBUX_BUNDLES_TABLE_SQL = `
create table if not exists robux_bundles (
  id text primary key,
  label text not null,
  price_usd numeric(10,2) not null,
  base_mobile integer,
  base_pc_web integer,
  bonus_mobile integer,
  bonus_pc_web integer,
  platforms text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null,
  notes text
);
`;
