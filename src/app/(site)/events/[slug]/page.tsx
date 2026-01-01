import { EVENTS_REVALIDATE_SECONDS, renderEventsPage } from "./events-page";

export const revalidate = EVENTS_REVALIDATE_SECONDS;

export { generateMetadata } from "./events-page";

type PageProps = {
  params: { slug: string };
};

export default async function EventsPage({ params }: PageProps) {
  return renderEventsPage({ slug: params.slug });
}
