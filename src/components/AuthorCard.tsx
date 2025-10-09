import Link from "next/link";
import type { Author } from "@/lib/db";
import { authorAvatarUrl } from "@/lib/avatar";

type ProcessedHtml = {
  __html: string;
};

function normalizeTwitter(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  return `https://twitter.com/${handle}`;
}

const linkClass = "inline-flex items-center gap-2 rounded-full border border-border/50 bg-surface px-3 py-1 text-xs font-semibold text-foreground transition hover:border-accent/60 hover:text-accent";

interface AuthorCardProps {
  author: Author;
  bioHtml: string | ProcessedHtml;
}

export function AuthorCard({ author, bioHtml }: AuthorCardProps) {
  const avatar = authorAvatarUrl(author);
  const twitter = normalizeTwitter(author.twitter);
  const socials = [
    twitter ? { label: "Twitter", href: twitter } : null,
    author.youtube ? { label: "YouTube", href: author.youtube } : null,
    author.website ? { label: "Website", href: author.website } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <section className="panel mt-8 flex flex-col gap-5 p-5 md:flex-row md:items-start">
      <div className="flex-shrink-0">
        <img
          src={avatar}
          alt={author.name}
          className="h-24 w-24 rounded-full border border-border/50 object-cover shadow-soft"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex-1 space-y-3">
        <div className="prose prose-headings:mt-0 prose-p:mt-2 dark:prose-invert max-w-none">
          <h3>
            {author.slug ? (
              <Link href={`/authors/${author.slug}`} className="transition hover:text-accent">
                About {author.name}
              </Link>
            ) : (
              <>About {author.name}</>
            )}
          </h3>
          {bioHtml ? (
            <div dangerouslySetInnerHTML={typeof bioHtml === 'string' ? { __html: bioHtml } : bioHtml} />
          ) : (
            <p className="text-muted">{author.name} curates the latest Roblox codes and keeps this guide up to date.</p>
          )}
        </div>
        {socials.length ? (
          <div className="flex flex-wrap gap-2">
            {socials.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
