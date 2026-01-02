import fs from "node:fs/promises";
import path from "node:path";

export type AdminCommandSystemConfig = {
  slug: string;
  name: string;
  shortName: string;
  typeLabel: string;
  popularity: number;
  cardDescription: string;
  intro: string[];
  rankOverview: string[];
  tips: string[];
  issues: string[];
  dataFile: string;
};

export type AdminCommandSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

export type AdminCommandDataset = {
  system: AdminCommandSystemConfig;
  documentTitle: string | null;
  sourceLine: string | null;
  sourceUrl: string | null;
  generatedOn: string | null;
  defaultPrefixes: string[];
  actionPrefix: string | null;
  playerPrefix: string | null;
  sections: AdminCommandSection[];
  commandCount: number;
  categoryCount: number;
};

export type AdminCommandSummary = {
  systemCount: number;
  totalCommands: number;
  latestUpdatedOn: string | null;
};

const ADMIN_COMMAND_SYSTEMS: AdminCommandSystemConfig[] = [
  {
    slug: "hd-admin",
    name: "HD Admin",
    shortName: "HD",
    typeLabel: "Modern, GUI-based",
    popularity: 5,
    cardDescription: "Popular GUI admin system with a deep command list and easy rank setup.",
    intro: [
      "HD Admin is a modern admin system built around a clean GUI and a command bar. It is popular in public experiences because moderators can discover commands without memorizing long lists.",
      "This page groups the official HD Admin command list into categories so you can browse faster. Use the default prefix unless a command already includes its own prefix."
    ],
    rankOverview: [
      "Owner: full access to every command and rank setting.",
      "Admin: broad moderation and server management commands.",
      "Moderator: player management, warnings, and basic control commands.",
      "VIP: limited fun or utility commands, depending on game setup."
    ],
    tips: [
      "Use the command bar or chat with the default prefix for most commands.",
      "Some commands include undo aliases; use them to revert effects quickly.",
      "Numeric arguments are usually plain numbers without units.",
      "If a command fails, check your rank and the target player selector."
    ],
    issues: [
      "Commands that target players only work in the same server.",
      "Some commands are disabled by the game owner or rank config.",
      "Prefix mismatches are the most common reason commands do not run."
    ],
    dataFile: "hd-admin.md"
  },
  {
    slug: "kohls-admin",
    name: "Kohl's Admin",
    shortName: "KA",
    typeLabel: "Classic",
    popularity: 4,
    cardDescription: "Classic chat-based admin commands with solid coverage for legacy games.",
    intro: [
      "Kohl's Admin (Infinite) is a classic, chat-driven admin system used by many legacy Roblox games. It is lightweight, fast to install, and centered on text commands.",
      "Commands are grouped by category with aliases and arguments. Use the default prefixes unless a command already includes its own prefix."
    ],
    rankOverview: [
      "Owner or Creator: full access, including scripts and role management.",
      "Admin: server management, teleport, gear, and moderation commands.",
      "Moderator: player control and standard moderation actions.",
      "Member or Player: no admin access unless permissions are granted."
    ],
    tips: [
      "Use chat commands with the default prefix for most actions.",
      "Aliases often cover short versions of common commands.",
      "Target players carefully when using multi-player arguments."
    ],
    issues: [
      "Role permissions depend on the server configuration.",
      "Some commands require asset IDs that the game owner owns.",
      "Server lock commands affect who can join the server."
    ],
    dataFile: "kohls-admin-infinite.md"
  },
  {
    slug: "basic-admin",
    name: "Basic Admin Essentials",
    shortName: "BAE",
    typeLabel: "Lightweight",
    popularity: 3,
    cardDescription: "Lightweight admin pack with clear permission levels and a small command set.",
    intro: [
      "Basic Admin Essentials (BAE) is a lightweight admin package with clear permission levels and a compact command list. It is common in testing, prototypes, and private servers.",
      "Commands are organized by permission level, which maps directly to your admin ranks. The prefix column shows whether a command uses the standard or action prefix."
    ],
    rankOverview: [
      "Level 0 (Public): basic public commands like changelog or rejoin.",
      "Level 1 (Moderator): moderation tools such as kick, logs, and hints.",
      "Level 2 (Admin): bans, server controls, and admin-level utilities.",
      "Level 3 (Super Admin): powerful actions like crash and script insert.",
      "Level 4 (Game Owner): debug tools and owner-only utilities."
    ],
    tips: [
      "Check the prefix column before typing a command.",
      "The usage column shows required arguments and optional inputs.",
      "Use partial names for players if the game supports it."
    ],
    issues: [
      "Permissions are strict; commands fail if your level is too low.",
      "Some debug commands are disabled in production games.",
      "Usage placeholders must be replaced with real values."
    ],
    dataFile: "basic-admin-essentials.md"
  },
  {
    slug: "adonis-admin",
    name: "Adonis Admin",
    shortName: "AD",
    typeLabel: "Advanced",
    popularity: 5,
    cardDescription: "Advanced admin suite with deep moderation, automation, and developer tools.",
    intro: [
      "Adonis Admin is an advanced, modular admin system with extensive moderation tools and customization. It is popular in larger games thanks to detailed admin levels and logging.",
      "Commands are grouped by admin level and purpose. Use the default prefixes unless a command already includes one."
    ],
    rankOverview: [
      "Creators: top-level access to settings, scripts, and global tools.",
      "Admins: server management, bans, and moderation utilities.",
      "Moderators: player actions and basic server controls.",
      "Donors or Players: limited cosmetic or fun commands when enabled."
    ],
    tips: [
      "Use the admin level column to confirm permission requirements.",
      "Many commands accept multiple targets in one line.",
      "Some commands expose optional arguments that change behavior."
    ],
    issues: [
      "Settings can disable commands or entire categories.",
      "Commands with multiple aliases may be listed under one entry.",
      "Prefix mismatches are common when multiple prefixes are enabled."
    ],
    dataFile: "adonis-admin.md"
  }
];

const ADMIN_COMMANDS_DIR = path.join(process.cwd(), "data", "Admin commands");

function parseTableLine(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function parseSectionTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const tableStart = lines.findIndex((line) => line.trim().startsWith("|"));
  if (tableStart === -1) {
    return { headers: [], rows: [] };
  }

  const headerLine = lines[tableStart];
  const dividerLine = lines[tableStart + 1];
  if (!headerLine || !dividerLine || !dividerLine.trim().startsWith("|")) {
    return { headers: [], rows: [] };
  }

  const headers = parseTableLine(headerLine);
  const rows: string[][] = [];

  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;
    const cells = parseTableLine(line);
    if (cells.some((cell) => cell.length > 0)) {
      rows.push(cells);
    }
  }

  return { headers, rows };
}

function parsePrefixList(raw: string | null): string[] {
  if (!raw) return [];
  const main = raw.split("(")[0]?.trim() ?? "";
  if (!main) return [];
  const parts = main
    .split(",")
    .flatMap((part) => part.split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function extractLineValue(markdown: string, label: string): string | null {
  const match = markdown.match(new RegExp(`^${label}:\\s*([^\\n]+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function extractInlineValue(markdown: string, label: string): string | null {
  const match = markdown.match(new RegExp(`${label}:\\s*([^\\)\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

function extractDocumentTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function extractSourceUrl(sourceLine: string | null): string | null {
  if (!sourceLine) return null;
  const match = sourceLine.match(/https?:\/\/\S+/i);
  return match?.[0] ?? null;
}

async function readAdminCommandsFile(fileName: string): Promise<string> {
  const filePath = path.join(ADMIN_COMMANDS_DIR, fileName);
  return fs.readFile(filePath, "utf8");
}

function parseAdminCommandsMarkdown(markdown: string): Omit<AdminCommandDataset, "system"> {
  const documentTitle = extractDocumentTitle(markdown);
  const sourceLine = extractLineValue(markdown, "Source");
  const generatedOn = extractLineValue(markdown, "Generated");
  const defaultPrefixLine = extractLineValue(markdown, "Default Prefixes") ?? extractLineValue(markdown, "Default Prefix");
  const actionPrefix = extractInlineValue(markdown, "Action Prefix");
  const playerPrefix = extractInlineValue(markdown, "Player Prefix");
  const defaultPrefixes = parsePrefixList(defaultPrefixLine);
  const sourceUrl = extractSourceUrl(sourceLine);

  const sectionsRaw = markdown.split(/^##\s+/gm).filter((section) => section.trim().length > 0);
  const sections: AdminCommandSection[] = [];

  sectionsRaw.forEach((section) => {
    const lines = section.split("\n");
    const title = lines[0]?.trim() ?? "";
    if (!title) return;
    const { headers, rows } = parseSectionTable(lines.slice(1));
    if (!headers.length || !rows.length) return;
    sections.push({ title, headers, rows });
  });

  const commandCount = sections.reduce((total, section) => total + section.rows.length, 0);

  return {
    documentTitle,
    sourceLine,
    sourceUrl,
    generatedOn,
    defaultPrefixes,
    actionPrefix,
    playerPrefix,
    sections,
    commandCount,
    categoryCount: sections.length
  };
}

export function getAdminCommandSystems(): AdminCommandSystemConfig[] {
  return ADMIN_COMMAND_SYSTEMS;
}

export async function loadAdminCommandDataset(slug: string): Promise<AdminCommandDataset | null> {
  const system = ADMIN_COMMAND_SYSTEMS.find((entry) => entry.slug === slug);
  if (!system) return null;
  const markdown = await readAdminCommandsFile(system.dataFile);
  const parsed = parseAdminCommandsMarkdown(markdown);
  return {
    system,
    ...parsed
  };
}

export async function loadAdminCommandDatasets(): Promise<AdminCommandDataset[]> {
  const results = await Promise.all(ADMIN_COMMAND_SYSTEMS.map((system) => loadAdminCommandDataset(system.slug)));
  return results.filter(Boolean) as AdminCommandDataset[];
}

export async function loadAdminCommandSummary(): Promise<AdminCommandSummary> {
  const datasets = await loadAdminCommandDatasets();
  let latestTimestamp: number | null = null;
  let latestUpdatedOn: string | null = null;

  datasets.forEach((dataset) => {
    if (!dataset.generatedOn) return;
    const timestamp = Date.parse(dataset.generatedOn);
    if (Number.isNaN(timestamp)) return;
    if (latestTimestamp === null || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestUpdatedOn = dataset.generatedOn;
    }
  });

  const totalCommands = datasets.reduce((total, dataset) => total + dataset.commandCount, 0);

  return {
    systemCount: datasets.length,
    totalCommands,
    latestUpdatedOn
  };
}
