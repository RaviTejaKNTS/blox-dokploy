import { Skeleton } from '@/components/ui/skeleton';

const CODE_PLACEHOLDERS = Array.from({ length: 3 });
const BODY_PLACEHOLDERS = Array.from({ length: 6 });

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
        <article className="space-y-10">
          <header className="space-y-5">
            <div className="space-y-3">
              <Skeleton className="h-11 w-full sm:w-3/4" />
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </header>

          <section className="space-y-6">
            <Skeleton className="h-8 w-48" />
            {CODE_PLACEHOLDERS.map((_, index) => (
              <div
                key={`active-code-${index}`}
                className="rounded-[var(--radius-sm)] border border-accent/25 bg-surface px-6 py-5 shadow-soft"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <Skeleton className="mt-4 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>
            ))}
          </section>

          <section className="space-y-6">
            <Skeleton className="h-8 w-56" />
            {CODE_PLACEHOLDERS.map((_, index) => (
              <div
                key={`needs-check-${index}`}
                className="rounded-[var(--radius-sm)] border border-amber-200/70 bg-surface px-6 py-5 shadow-soft"
              >
                <Skeleton className="h-6 w-28" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
              </div>
            ))}
          </section>

          <section className="space-y-5">
            <Skeleton className="h-8 w-64" />
            {BODY_PLACEHOLDERS.map((_, index) => (
              <Skeleton key={`body-${index}`} className="h-4 w-full" />
            ))}
            <Skeleton className="h-4 w-2/3" />
          </section>

          <section className="space-y-4">
            <Skeleton className="h-8 w-52" />
            {CODE_PLACEHOLDERS.map((_, index) => (
              <div key={`how-to-${index}`} className="flex gap-4">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border/60 bg-surface px-5 py-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </section>
        </article>

        <aside className="space-y-8">
          <section className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={`share-${index}`} className="h-9 w-9 rounded-full" />
              ))}
            </div>
          </section>

          <section className="panel space-y-4 px-5 py-6">
            <Skeleton className="h-5 w-56" />
            {CODE_PLACEHOLDERS.map((_, index) => (
              <div key={`related-${index}`} className="space-y-2 rounded-[var(--radius-sm)] border border-border/60 bg-surface px-4 py-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
