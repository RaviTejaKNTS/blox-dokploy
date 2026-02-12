import { renderEventsPage } from "./events-page";
import { listPublishedEventsPageSlugs } from "@/lib/db";

// Must be a literal for Next segment config extraction.
export const revalidate = 3600;

export { generateMetadata } from "./events-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await listPublishedEventsPageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function EventsPage({ params }: PageProps) {
  const { slug } = await params;
  return renderEventsPage({ slug });
}
