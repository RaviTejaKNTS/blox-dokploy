import Link from "next/link";

type SequenceItem = number | "ellipsis";

function buildPagination(totalPages: number, currentPage: number): SequenceItem[] {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const filtered = Array.from(pages).filter((p) => p >= 1 && p <= totalPages);
  const sorted = filtered.sort((a, b) => a - b);

  const result: SequenceItem[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const value = sorted[i];
    const prev = sorted[i - 1];
    if (prev !== undefined && value - prev > 1) {
      result.push("ellipsis");
    }
    result.push(value);
  }
  return result;
}

export function PagePagination({
  basePath,
  currentPage,
  totalPages,
  className,
  query
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  className?: string;
  query?: string;
}) {
  if (totalPages <= 1) return null;
  const sequence = buildPagination(totalPages, currentPage);
  const suffix = query ? (query.startsWith("?") ? query : `?${query}`) : "";
  const pageHref = (page: number) => (page === 1 ? `${basePath}${suffix}` : `${basePath}/page/${page}${suffix}`);

  return (
    <nav className={className ? className : "flex flex-wrap items-center gap-2"} aria-label="Pagination">
      <Link
        href={pageHref(Math.max(1, currentPage - 1))}
        rel="prev"
        className="rounded-lg border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        aria-disabled={currentPage === 1}
      >
        Prev
      </Link>
      {sequence.map((item, idx) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={pageHref(item)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              item === currentPage
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border/60 text-foreground hover:border-accent hover:text-accent"
            }`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </Link>
        )
      )}
      <Link
        href={pageHref(Math.min(totalPages, currentPage + 1))}
        rel="next"
        className="rounded-lg border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        aria-disabled={currentPage === totalPages}
      >
        Next
      </Link>
    </nav>
  );
}
