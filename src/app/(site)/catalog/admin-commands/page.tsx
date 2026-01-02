import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import "@/styles/article-content.css";
import { ADMIN_COMMANDS_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import { loadAdminCommandDatasets } from "@/lib/admin-commands";

export const revalidate = 86400;

const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/catalog/admin-commands`;

export const metadata: Metadata = {
  title: `Roblox Admin Commands | ${SITE_NAME}`,
  description: ADMIN_COMMANDS_DESCRIPTION,
  alternates: {
    canonical: CANONICAL
  },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: `Roblox Admin Commands | ${SITE_NAME}`,
    description: ADMIN_COMMANDS_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: `Roblox Admin Commands | ${SITE_NAME}`,
    description: ADMIN_COMMANDS_DESCRIPTION
  }
};

const FAQS = [
  {
    question: "What are admin commands in Roblox?",
    answer:
      "Admin commands let game owners and moderators manage players, control the server, and toggle special abilities. They are typically issued through chat or a command bar."
  },
  {
    question: "Which admin system is best?",
    answer:
      "It depends on your game. HD Admin is popular for GUI workflows, Kohl's Admin fits classic games, Basic Admin Essentials works well for testing, and Adonis is favored for advanced moderation."
  },
  {
    question: "Can players use admin commands?",
    answer:
      "Only players with a granted rank or permission can run admin commands. Regular players cannot access these commands unless the owner enables them."
  },
  {
    question: "How do I know which admin a game uses?",
    answer:
      "Look for an in-game admin panel, command bar, or ask the game owner. Some systems also show their name in chat when commands run."
  }
];

const INTERNAL_LINKS = [
  { label: "Roblox moderation guides", href: "/articles" },
  { label: "Game setup guides", href: "/articles" },
  { label: "How to add admin commands to your Roblox game", href: "/articles" }
];

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function computeLatestUpdatedOn(values: Array<string | null | undefined>) {
  let latest: number | null = null;
  let latestValue: string | null = null;
  values.forEach((value) => {
    if (!value) return;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return;
    if (latest === null || timestamp > latest) {
      latest = timestamp;
      latestValue = value;
    }
  });
  return latestValue;
}

export default async function AdminCommandsHubPage() {
  const datasets = await loadAdminCommandDatasets();
  const totalCommands = datasets.reduce((total, dataset) => total + dataset.commandCount, 0);
  const latestUpdatedOn = computeLatestUpdatedOn(datasets.map((dataset) => dataset.generatedOn));
  const updatedLabel = latestUpdatedOn ? formatDistanceToNow(new Date(latestUpdatedOn), { addSuffix: true }) : null;
  const datasetMap = new Map(datasets.map((dataset) => [dataset.system.slug, dataset]));

  const hdDataset = datasetMap.get("hd-admin");
  const kohlsDataset = datasetMap.get("kohls-admin");
  const basicDataset = datasetMap.get("basic-admin");

  const comparisonRows = [
    {
      feature: "Total commands",
      hd: hdDataset ? formatCount(hdDataset.commandCount) : "--",
      kohls: kohlsDataset ? formatCount(kohlsDataset.commandCount) : "--",
      basic: basicDataset ? formatCount(basicDataset.commandCount) : "--"
    },
    {
      feature: "GUI support",
      hd: "Yes",
      kohls: "No",
      basic: "No"
    },
    {
      feature: "Permission ranks",
      hd: "Yes",
      kohls: "Limited",
      basic: "Yes"
    },
    {
      feature: "Best for",
      hd: "Public games",
      kohls: "Classic games",
      basic: "Testing"
    }
  ];

  const faqSchema = FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer
    }
  }));

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent/80">Catalog</p>
        <h1 className="text-4xl font-semibold leading-tight text-foreground md:text-5xl">
          Roblox admin commands by system
        </h1>
        <div className="max-w-3xl space-y-3 text-base text-muted md:text-lg">
          <p>
            Roblox admin commands let game owners and moderators control players, manage servers, and enable special
            abilities. They are essential tools for running public games, private servers, and testing sessions.
          </p>
          <p>
            Commands differ by admin system. Use the guide below to compare the most popular systems and jump into the
            full command lists for each one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted md:text-sm">
          <span className="rounded-full bg-accent/10 px-4 py-1 font-semibold uppercase tracking-wide text-accent">
            {datasets.length} systems
          </span>
          <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
            {formatCount(totalCommands)} command entries
          </span>
          {updatedLabel ? (
            <span className="rounded-full bg-surface-muted px-4 py-1 font-semibold text-muted">
              Updated {updatedLabel}
            </span>
          ) : null}
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Admin systems catalog</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Choose a system</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {datasets.map((dataset) => (
            <article
              key={dataset.system.slug}
              className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-surface/70 p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-lg"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-80 transition duration-700"
                aria-hidden
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(76,106,255,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.1),transparent_35%)]" />
                <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-accent/5" />
              </div>

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-sm font-semibold uppercase tracking-[0.2em] text-accent">
                    {dataset.system.shortName}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">{dataset.system.name}</h3>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">{dataset.system.typeLabel}</p>
                  </div>
                </div>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  {dataset.system.popularity}/5
                </span>
              </div>

              <p className="relative text-sm text-muted">{dataset.system.cardDescription}</p>

              <div className="relative flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                  {formatCount(dataset.commandCount)} commands
                </span>
                <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1">
                  {formatCount(dataset.categoryCount)} categories
                </span>
              </div>

              <div className="relative mt-auto">
                <Link
                  href={`/catalog/admin-commands/${dataset.system.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-background transition hover:opacity-90"
                >
                  View commands
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Admin system comparison</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Quick snapshot</span>
        </div>
        <div className="prose dark:prose-invert game-copy max-w-none">
          <div className="table-scroll-wrapper">
            <div className="table-scroll-inner">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>HD Admin</th>
                    <th>Kohl&apos;s Admin</th>
                    <th>Basic Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{row.hd}</td>
                      <td>{row.kohls}</td>
                      <td>{row.basic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted">
          Counts are based on the official command lists and may vary by game configuration.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">FAQ</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FAQS.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-border/60 bg-surface/60 p-5 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Q.</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{faq.question}</p>
              <p className="mt-2 text-sm text-muted">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Related guides</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {INTERNAL_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-2xl border border-border/60 bg-background/60 px-4 py-4 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-md"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                name: "Roblox Admin Commands",
                description: ADMIN_COMMANDS_DESCRIPTION,
                url: CANONICAL
              },
              {
                "@type": "FAQPage",
                mainEntity: faqSchema
              }
            ]
          })
        }}
      />
    </div>
  );
}
