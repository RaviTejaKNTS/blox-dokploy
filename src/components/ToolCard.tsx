import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FiArrowUpRight, FiClock } from "react-icons/fi";
import type { ToolListEntry } from "@/lib/tools";

type ToolCardProps = {
  tool: ToolListEntry;
};

export function ToolCard({ tool }: ToolCardProps) {
  const updatedLabel = tool.updated_at ? formatDistanceToNow(new Date(tool.updated_at), { addSuffix: true }) : null;
  const description =
    tool.meta_description?.trim() ||
    tool.intro_md?.replace(/\s+/g, " ").trim().slice(0, 160) ||
    "Open this Roblox helper to plan purchases and conversions faster.";
  const thumb = tool.thumb_url || "/og-image.png";

  return (
    <Link href={`/tools/${tool.code}`} className="group block h-full">
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 opacity-80 transition duration-700 group-hover:opacity-100"
          aria-hidden
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(76,106,255,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.1),transparent_35%)]" />
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-accent/5" />
        </div>

        <div className="relative flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 text-[10px] font-semibold text-foreground/80 shadow-sm ring-1 ring-border/60">
              Roblox Tool
            </span>
            {updatedLabel ? (
              <span className="inline-flex items-center gap-1 font-semibold text-muted">
                <FiClock className="h-3 w-3" aria-hidden />
                <span>Updated {updatedLabel}</span>
              </span>
            ) : null}
          </div>

          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-inner">
              <Image
                src={thumb.startsWith("http") ? thumb : thumb.startsWith("/") ? thumb : `/${thumb}`}
                alt={tool.title}
                fill
                sizes="64px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold leading-snug text-foreground transition group-hover:text-accent">
                {tool.title}
              </h3>
              <p className="line-clamp-2 text-sm text-muted">{description}</p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between pt-2 text-sm font-semibold text-accent">
            <span className="inline-flex items-center gap-2">
              Launch tool
              <FiArrowUpRight aria-hidden className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
            <span className="rounded-full bg-border/60 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/80">
              {tool.code.replace(/-/g, " ")}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
