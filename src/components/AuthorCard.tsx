import Link from "next/link";
import type { Author } from "@/lib/db";
import { authorAvatarUrl } from "@/lib/avatar";
import { AuthorSocialLinks } from "@/components/AuthorSocialLinks";

type ProcessedHtml = {
  __html: string;
};

interface AuthorCardProps {
  author: Author;
  bioHtml: string | ProcessedHtml;
}

export function AuthorCard({ author, bioHtml }: AuthorCardProps) {
  const avatar = authorAvatarUrl(author);

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
        <AuthorSocialLinks author={author} />
      </div>
    </section>
  );
}
