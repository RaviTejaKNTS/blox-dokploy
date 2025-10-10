const PLACEHOLDER_PATTERN = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;

export type LinkPlaceholderMap = Partial<Record<string, string | null | undefined>>;

export function replaceLinkPlaceholders(markdown: string, links: LinkPlaceholderMap): string {
  if (!markdown) return "";

  return markdown.replace(PLACEHOLDER_PATTERN, (_match, rawKey, rawLabel) => {
    const key = String(rawKey ?? "").toLowerCase();
    const label = (rawLabel ?? "").trim();
    if (!label) return "";

    const url = links[key] ?? links[`${key}_link`];
    if (typeof url === "string" && url.trim().length > 0) {
      return `[${label}](${url.trim()})`;
    }

    return label;
  });
}
