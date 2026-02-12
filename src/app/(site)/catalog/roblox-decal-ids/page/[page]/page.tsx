import type { Metadata } from "next";
import "@/styles/article-content.css";
import { renderMarkdown } from "@/lib/markdown";
import { CATALOG_DESCRIPTION, SITE_NAME, SITE_URL, resolveSeoTitle, buildAlternates } from "@/lib/seo";
import { getCatalogPageContentByCodes } from "@/lib/catalog";
import { buildPageParams } from "@/lib/static-params";
import {
    BASE_PATH,
    loadRobloxDecalIdsPageData,
    renderRobloxDecalIdsPage,
    type CatalogContentHtml
} from "../../page-data";

export const revalidate = 2592000; // 30 days

const CATALOG_CODE_CANDIDATES = ["roblox-decal-ids"];
const FALLBACK_IMAGE = `${SITE_URL}/og-image.png`;
const MAX_STATIC_PAGES = 50;

function sortDescriptionEntries(description: Record<string, string> | null | undefined) {
    return Object.entries(description ?? {}).sort((a, b) => {
        const left = Number.parseInt(a[0], 10);
        const right = Number.parseInt(b[0], 10);
        if (Number.isNaN(left) && Number.isNaN(right)) return a[0].localeCompare(b[0]);
        if (Number.isNaN(left)) return 1;
        if (Number.isNaN(right)) return -1;
        return left - right;
    });
}

async function buildCatalogContent(): Promise<{ contentHtml: CatalogContentHtml | null }> {
    const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
    if (!catalog) {
        return { contentHtml: null };
    }

    const introHtml = catalog.intro_md ? await renderMarkdown(catalog.intro_md, { paragraphizeLineBreaks: true }) : "";
    const howHtml = catalog.how_it_works_md ? await renderMarkdown(catalog.how_it_works_md, { paragraphizeLineBreaks: true }) : "";

    const descriptionEntries = sortDescriptionEntries(catalog.description_json ?? {});
    const descriptionHtml = await Promise.all(
        descriptionEntries.map(async ([key, value]) => ({
            key,
            html: await renderMarkdown(value ?? "", { paragraphizeLineBreaks: true })
        }))
    );

    const faqEntries = Array.isArray(catalog.faq_json) ? catalog.faq_json : [];
    const faqHtml = await Promise.all(
        faqEntries.map(async (entry) => ({
            q: entry.q,
            a: await renderMarkdown(entry.a ?? "", { paragraphizeLineBreaks: true })
        }))
    );

    return {
        contentHtml: {
            id: catalog.id ?? null,
            title: catalog.title ?? null,
            introHtml,
            howHtml,
            descriptionHtml,
            faqHtml,
            updatedAt: catalog.content_updated_at ?? catalog.updated_at ?? catalog.published_at ?? catalog.created_at ?? null,
            ctaLabel: catalog.cta_label ?? null,
            ctaUrl: catalog.cta_url ?? null
        }
    };
}

type PageProps = {
    params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
    const { totalPages } = await loadRobloxDecalIdsPageData(1);
    return buildPageParams(totalPages, 1, MAX_STATIC_PAGES);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { page } = await params;
    const pageNumber = Number.parseInt(page, 10);
    const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

    const catalog = await getCatalogPageContentByCodes(CATALOG_CODE_CANDIDATES);
    const baseTitle = catalog?.title ?? "Roblox Decal IDs";
    const title = `${resolveSeoTitle(catalog?.seo_title) ?? baseTitle} - Page ${safePageNumber}`;
    const description = catalog?.meta_description ?? CATALOG_DESCRIPTION;
    const image = catalog?.thumb_url || FALLBACK_IMAGE;
    const canonicalUrl = `${SITE_URL.replace(/\/$/, "")}${BASE_PATH}/page/${safePageNumber}`;

    return {
        title: `${title} | ${SITE_NAME}`,
        description,
        // Paginated pages: noindex, follow
        robots: {
            index: false,
            follow: true,
            nocache: false,
            googleBot: {
                index: false,
                follow: true
            }
        },
        alternates: buildAlternates(canonicalUrl),
        openGraph: {
            type: "website",
            url: canonicalUrl,
            title,
            description,
            siteName: SITE_NAME,
            images: [image]
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image]
        }
    };
}

export default async function RobloxDecalIdsPaginatedPage({ params }: PageProps) {
    const { page } = await params;
    const pageNumber = Number.parseInt(page, 10);
    const safePageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

    const [{ decals, total, totalPages }, { contentHtml }] = await Promise.all([
        loadRobloxDecalIdsPageData(safePageNumber),
        buildCatalogContent()
    ]);

    return renderRobloxDecalIdsPage({
        decals,
        total,
        totalPages,
        currentPage: safePageNumber,
        showHero: false,
        contentHtml
    });
}
