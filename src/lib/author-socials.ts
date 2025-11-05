import type { Author } from "./db";

export type AuthorSocialType =
  | "website"
  | "twitter"
  | "youtube"
  | "facebook"
  | "linkedin"
  | "instagram"
  | "roblox"
  | "discord";

export type AuthorSocialLink = {
  type: AuthorSocialType;
  url: string;
};

type AuthorSocialSource = Pick<
  Author,
  "website" | "twitter" | "youtube" | "facebook" | "linkedin" | "instagram" | "roblox" | "discord"
>;

function hasProtocol(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function ensureUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const sanitized = trimmed.replace(/^\/*/, "");
  if (!sanitized) return null;
  return `https://${sanitized}`;
}

function normalizeTwitter(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, "").replace(/^\/*/, "");
  if (!handle) return null;
  return `https://twitter.com/${handle}`;
}

function normalizeFacebook(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, "").replace(/^\/*/, "");
  if (!handle) return null;
  return `https://www.facebook.com/${handle}`;
}

function normalizeInstagram(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const handle = trimmed.replace(/^@/, "").replace(/^\/*/, "");
  if (!handle) return null;
  return `https://www.instagram.com/${handle}`;
}

function normalizeLinkedIn(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const withoutPrefix = trimmed.replace(/^@/, "").replace(/^\/*/, "");
  if (!withoutPrefix) return null;
  if (withoutPrefix.startsWith("in/") || withoutPrefix.startsWith("company/") || withoutPrefix.startsWith("school/")) {
    return `https://www.linkedin.com/${withoutPrefix}`;
  }
  return `https://www.linkedin.com/in/${withoutPrefix}`;
}

function normalizeRoblox(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/^@/, "").replace(/^\/*/, "");
  if (!cleaned) return null;
  if (/^\d+$/.test(cleaned)) {
    return `https://www.roblox.com/users/${cleaned}/profile`;
  }
  return `https://www.roblox.com/${cleaned}`;
}

function normalizeDiscord(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasProtocol(trimmed)) {
    return trimmed;
  }
  const cleaned = trimmed.replace(/^\/*/, "");
  if (!cleaned) return null;

  if (cleaned.startsWith("discord.gg/") || cleaned.startsWith("discord.com/")) {
    return `https://${cleaned}`;
  }

  if (cleaned.startsWith("invite/")) {
    return `https://discord.gg/${cleaned.replace(/^invite\//, "")}`;
  }

  // Discord user handles (with #) cannot be converted into a valid public URL
  if (cleaned.includes("#")) {
    return null;
  }

  return `https://${cleaned}`;
}

const NORMALIZERS: Record<AuthorSocialType, (value?: string | null) => string | null> = {
  website: ensureUrl,
  twitter: normalizeTwitter,
  youtube: ensureUrl,
  facebook: normalizeFacebook,
  linkedin: normalizeLinkedIn,
  instagram: normalizeInstagram,
  roblox: normalizeRoblox,
  discord: normalizeDiscord
};

const SOCIAL_ORDER: AuthorSocialType[] = [
  "website",
  "twitter",
  "youtube",
  "facebook",
  "linkedin",
  "instagram",
  "roblox",
  "discord"
];

export function collectAuthorSocials(author: AuthorSocialSource | null | undefined): AuthorSocialLink[] {
  if (!author) return [];

  const result: AuthorSocialLink[] = [];
  for (const type of SOCIAL_ORDER) {
    const rawValue = author[type];
    const normalized = NORMALIZERS[type](rawValue);
    if (normalized) {
      result.push({ type, url: normalized });
    }
  }

  return result;
}
