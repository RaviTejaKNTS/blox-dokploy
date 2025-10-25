import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/db";
import { FiClock } from "react-icons/fi";

const BASE_CLASS =
  "group overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-surface transition-colors flex flex-col";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTIwMCcgaGVpZ2h0PSc2NzUnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzEyMDAnIGhlaWdodD0nNjc1JyBmaWxsPSdyZ2JhKDQ4LDUwLDU4LDAuMyknIC8+PC9zdmc+";

type ArticleCardProps = {
  article: Article & { slug: string };
};

export function ArticleCard({ article }: ArticleCardProps) {
  const coverImage = article.cover_image || "/og-image.png";
  const readingMinutes = Math.max(1, Math.ceil(((article.word_count ?? 0) || 0) / 200));
  const updatedLabel = new Date(article.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <Link
      href={`/${article.slug}`}
      prefetch={false}
      className={`${BASE_CLASS} hover:border-accent hover:shadow-[0_24px_45px_-35px_rgba(59,70,128,0.65)]`}
    >
      <div className="relative aspect-[16/9] bg-surface-muted">
        <Image
          src={coverImage.startsWith("http") ? coverImage : coverImage.startsWith("/") ? coverImage : `/${coverImage}`}
          alt={article.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Article</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground group-hover:text-accent">{article.title}</h3>
        </div>
        {article.meta_description ? (
          <p className="line-clamp-2 text-sm text-muted">{article.meta_description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <FiClock aria-hidden className="h-3 w-3" />
            <span>{readingMinutes} min read</span>
          </span>
          <span>{updatedLabel}</span>
        </div>
      </div>
    </Link>
  );
}
