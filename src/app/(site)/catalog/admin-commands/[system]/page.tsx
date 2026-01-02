import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { ADMIN_COMMANDS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getAdminCommandSystems, loadAdminCommandDataset } from "@/lib/admin-commands";

export const revalidate = 86400;

const CANONICAL_BASE = `${SITE_URL.replace(/\/$/, "")}/catalog/admin-commands`;

const HEADER_MAP: Record<string, string> = {
  Command: "command",
  Commands: "commandList",
  Aliases: "aliases",
  "Undo Aliases": "undoAliases",
  Args: "args",
  Usage: "usage",
  Prefix: "prefix",
  "Admin Level": "adminLevel",
  Description: "description"
};

type NormalizedRow = {
  command?: string;
  commandList?: string;
  aliases?: string;
  undoAliases?: string;
  args?: string;
  usage?: string;
  prefix?: string;
  adminLevel?: string;
  description?: string;
};

type NormalizedSection = {
  id: string;
  title: string;
  commandCount: number;
  tableHtml: string;
};

export function generateStaticParams() {
  return getAdminCommandSystems().map((system) => ({ system: system.slug }));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function normalizeCellValue(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/\\n/g, "<br />")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function mapRow(headers: string[], row: string[]): NormalizedRow {
  const mapped: NormalizedRow = {};
  headers.forEach((header, index) => {
    const key = HEADER_MAP[header];
    if (!key) return;
    mapped[key as keyof NormalizedRow] = row[index] ?? "";
  });
  return mapped;
}

function splitCommandList(value: string): { primary: string; aliases: string[] } {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    primary: parts[0] ?? "",
    aliases: parts.slice(1)
  };
}

function resolvePrefix(command: string, prefixOverride?: string, defaultPrefix?: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  if (/^[;:!\/]/.test(trimmed)) {
    return "";
  }
  if (prefixOverride) return prefixOverride.trim();
  return defaultPrefix?.trim() ?? "";
}

function normalizeArgsText(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\\n/g, " ").replace(/\s+/g, " ").replace(/,\s*/g, " ").trim();
}

function tokenToPlaceholder(token: string): string | null {
  let cleaned = token.replace(/\(s\)/gi, "s");
  const optional = /optional/i.test(cleaned) || cleaned.trim().endsWith("?");
  cleaned = cleaned
    .replace(/\(.*?\)/g, "")
    .replace(/default:.*/i, "")
    .replace(/optional/gi, "")
    .replace(/\?$/, "")
    .trim();
  if (!cleaned) return null;

  const options = cleaned
    .split(/\/|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const placeholderBase = options.join("|");
  const normalized = placeholderBase
    .replace(/[^a-zA-Z0-9|]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  if (!normalized) return null;
  return `<${normalized}${optional ? "?" : ""}>`;
}

function buildExampleArgs(rawArgs: string): string | null {
  const cleaned = normalizeCellValue(rawArgs);
  if (!cleaned) return null;
  const placeholderProbe = cleaned.replace(/<br\s*\/?>/gi, "");
  if (placeholderProbe.includes("<") || placeholderProbe.includes("[")) {
    return cleaned;
  }
  const tokens = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const placeholders = tokens.map(tokenToPlaceholder).filter(Boolean);
  if (!placeholders.length) return null;
  return placeholders.join(" ");
}

function buildSyntax(prefix: string, command: string, argsText: string): string {
  const args = normalizeArgsText(argsText);
  const base = `${prefix}${command}`.trim();
  if (!args) return base;
  return `${base} ${args}`.trim();
}

function extractPermissionLabel(sectionTitle: string): string | null {
  const match = sectionTitle.match(/Permission Level\s*(\d+)\s*\(([^)]+)\)/i);
  if (!match) return null;
  return `Level ${match[1]} (${match[2]})`;
}

function buildSectionTableMarkdown(options: {
  headers: string[];
  rows: string[][];
  defaultPrefix: string;
  permissionLabel?: string | null;
}): string {
  const tableHeaders = ["Command", "Syntax / Example", "Permission", "Description"];
  const divider = tableHeaders.map(() => "---").join(" | ");
  const lines = [`| ${tableHeaders.join(" | ")} |`, `| ${divider} |`];

  options.rows.forEach((row) => {
    const mapped = mapRow(options.headers, row);
    const commandSource = normalizeCellValue(mapped.command || mapped.commandList);
    if (!commandSource) return;

    const { primary, aliases } = splitCommandList(commandSource);
    const commandLabel = primary || commandSource;
    const combinedAliases = [normalizeCellValue(mapped.aliases), ...aliases]
      .filter(Boolean)
      .join(", ");
    const undoAliases = normalizeCellValue(mapped.undoAliases);

    const commandLines = [`**${commandLabel}**`];
    if (combinedAliases) {
      commandLines.push(`Aliases: \`${combinedAliases}\``);
    }
    if (undoAliases) {
      commandLines.push(`Undo: \`${undoAliases}\``);
    }

    const prefix = resolvePrefix(commandLabel, mapped.prefix, options.defaultPrefix);
    const argsText = normalizeCellValue(mapped.usage || mapped.args);
    const syntax = buildSyntax(prefix, commandLabel, argsText);
    const exampleArgs = buildExampleArgs(argsText) ?? normalizeArgsText(argsText);
    const example = exampleArgs ? `${prefix}${commandLabel} ${exampleArgs}`.trim() : `${prefix}${commandLabel}`.trim();

    const syntaxLines = [`Syntax: \`${syntax}\``, `Example: \`${example}\``];
    const permission = normalizeCellValue(mapped.adminLevel) || options.permissionLabel || "Configurable";
    const description = normalizeCellValue(mapped.description) || "Not listed in the source command list.";

    const cells = [
      commandLines.join("<br />"),
      syntaxLines.join("<br />"),
      permission,
      description
    ].map(escapeTableCell);

    lines.push(`| ${cells.join(" | ")} |`);
  });

  return lines.join("\n");
}

async function buildSectionsHtml(dataset: Awaited<ReturnType<typeof loadAdminCommandDataset>>): Promise<NormalizedSection[]> {
  if (!dataset) return [];
  const usedIds = new Set<string>();
  const sections: NormalizedSection[] = [];

  for (let index = 0; index < dataset.sections.length; index += 1) {
    const section = dataset.sections[index];
    const baseId = slugify(section.title || `section-${index + 1}`);
    let sectionId = baseId || `section-${index + 1}`;
    if (usedIds.has(sectionId)) {
      sectionId = `${sectionId}-${index + 1}`;
    }
    usedIds.add(sectionId);

    const permissionLabel =
      dataset.system.slug === "basic-admin" ? extractPermissionLabel(section.title) : null;
    const tableMarkdown = buildSectionTableMarkdown({
      headers: section.headers,
      rows: section.rows,
      defaultPrefix: dataset.defaultPrefixes[0] ?? "",
      permissionLabel
    });
    const tableHtml = await renderMarkdown(tableMarkdown);
    sections.push({
      id: sectionId,
      title: section.title,
      commandCount: section.rows.length,
      tableHtml
    });
  }

  return sections;
}

export async function generateMetadata({ params }: { params: { system: string } }): Promise<Metadata> {
  const dataset = await loadAdminCommandDataset(params.system);
  if (!dataset) {
    return {
      title: `Roblox Admin Commands | ${SITE_NAME}`,
      description: ADMIN_COMMANDS_DESCRIPTION,
      alternates: {
        canonical: CANONICAL_BASE
      }
    };
  }

  const title = `${dataset.system.name} Commands | ${SITE_NAME}`;
  const description = `${dataset.system.cardDescription} Browse command categories, syntax, and permission details.`;
  const canonical = `${CANONICAL_BASE}/${dataset.system.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical
    },
    openGraph: {
      type: "article",
      url: canonical,
      title,
      description,
      siteName: SITE_NAME
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function AdminCommandSystemPage({ params }: { params: { system: string } }) {
  const dataset = await loadAdminCommandDataset(params.system);
  if (!dataset) {
    notFound();
  }

  const sections = await buildSectionsHtml(dataset);
  const updatedLabel = dataset.generatedOn ? formatDistanceToNow(new Date(dataset.generatedOn), { addSuffix: true }) : null;
  const prefixList = dataset.defaultPrefixes.length ? dataset.defaultPrefixes : ["(none listed)"];
  const helperExamplePrefix = dataset.defaultPrefixes[0] ?? "";
  const exampleCommand = helperExamplePrefix ? `${helperExamplePrefix}kick <player> <reason>` : "kick <player> <reason>";

  const metadataItems = [
    {
      label: "Default prefixes",
      value: prefixList.join(" ")
    },
    dataset.generatedOn
      ? {
          label: "Generated on",
          value: dataset.generatedOn
        }
      : null,
    dataset.actionPrefix
      ? {
          label: "Action prefix",
          value: dataset.actionPrefix
        }
      : null,
    dataset.playerPrefix
      ? {
          label: "Player prefix",
          value: dataset.playerPrefix
        }
      : null,
    {
      label: "Command entries",
      value: dataset.commandCount.toLocaleString("en-US")
    },
    {
      label: "Categories",
      value: dataset.categoryCount.toLocaleString("en-US")
    }
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-[0.25em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="flex items-center gap-2">
            <Link href="/" className="font-semibold text-muted transition hover:text-accent">
              Home
            </Link>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <Link href="/catalog" className="font-semibold text-muted transition hover:text-accent">
              Catalog
            </Link>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <Link href="/catalog/admin-commands" className="font-semibold text-muted transition hover:text-accent">
              Admin Commands
            </Link>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-foreground/80">{dataset.system.name}</span>
          </li>
        </ol>
      </nav>

      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">
          {dataset.system.typeLabel}
        </p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          {dataset.system.name} commands
        </h1>
        <div className="max-w-3xl space-y-3 text-base text-muted md:text-lg">
          {dataset.system.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          {updatedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Updated {updatedLabel}
            </span>
          ) : null}
          {dataset.sourceUrl ? (
            <a
              href={dataset.sourceUrl}
              className="rounded-full border border-border/60 bg-background/70 px-4 py-1 font-semibold text-muted transition hover:text-foreground"
              rel="noreferrer"
            >
              Source list
            </a>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metadataItems.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border/60 bg-surface/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Command format</h2>
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>
            Most commands follow the pattern: <span className="font-semibold text-foreground">prefix + command + args</span>.
            Use the prefixes listed above unless a command already includes one.
          </p>
          <p className="font-mono text-sm text-foreground">{exampleCommand}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Command categories</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {dataset.categoryCount} categories
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted transition hover:border-accent/60 hover:text-foreground"
            >
              {section.title}
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="space-y-4 scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-foreground md:text-2xl">{section.title}</h3>
              <span className="rounded-full bg-surface-muted px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {section.commandCount.toLocaleString("en-US")} commands
              </span>
            </div>
            <div
              className="prose dark:prose-invert game-copy max-w-none"
              dangerouslySetInnerHTML={{ __html: section.tableHtml }}
            />
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Rank system overview</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {dataset.system.rankOverview.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface/60 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Tips and common issues</h2>
          <div className="mt-3 space-y-3 text-sm text-muted">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Tips</p>
              <ul className="mt-2 space-y-2">
                {dataset.system.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Common issues</p>
              <ul className="mt-2 space-y-2">
                {dataset.system.issues.map((issue) => (
                  <li key={issue} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${dataset.system.name} Commands`,
            description: dataset.system.cardDescription,
            url: `${CANONICAL_BASE}/${dataset.system.slug}`
          })
        }}
      />
    </div>
  );
}
