import { renderEventsPage } from "./events-page";

// Must be a literal for Next segment config extraction.
export const revalidate = 3600;

export { generateMetadata } from "./events-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventsPage({ params }: PageProps) {
  const { slug } = await params;
  return renderEventsPage({ slug });
}
