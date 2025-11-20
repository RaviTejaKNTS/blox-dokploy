import { collectAuthorSocials } from "./author-socials";

const DEFAULT_SITE_URL = "https://bloxodes.com";

export const SITE_URL = DEFAULT_SITE_URL;

export const SITE_NAME = "Bloxodes";
export const SITE_DESCRIPTION = "Find active and expired Roblox game codes with rewards, updated daily.";

export function siteJsonLd({siteUrl}:{siteUrl:string}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "url": siteUrl,
    "name": SITE_NAME,
    "inLanguage": "en-US",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}/search?q={query}`,
      "query-input": "required name=query"
    }
  };
}

export function organizationJsonLd({ siteUrl }: { siteUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": siteUrl,
    "logo": `${siteUrl}/Bloxodes-dark.png`,
    "sameAs": [
      siteUrl.replace(/\/$/, ""),
      "https://x.com/bloxodes"
    ]
  };
}

export function breadcrumbJsonLd(items: {name:string, url:string}[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": it.name,
      "item": it.url
    }))
  };
}

export function gameJsonLd({siteUrl, game}:{siteUrl:string, game:{name:string, slug:string, image?:string}}) {
  const image = game.image
    ? (game.image.startsWith("http") ? game.image : `${siteUrl.replace(/\/$/, "")}/${game.image.replace(/^\//, "")}`)
    : `${siteUrl}/og-image.png`;
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": game.name,
    "url": `${siteUrl}/codes/${game.slug}`,
    "image": image,
    "applicationCategory": "Game",
    "operatingSystem": "Roblox",
    "publisher": {
      "@type": "Organization",
      "name": "Roblox"
    }
  };
}

export function codesItemListJsonLd({
  siteUrl,
  game,
  codes
}: {
  siteUrl: string;
  game: { name: string; slug: string };
  codes: { code: string; status: string; reward?: string | null }[];
}) {
  // Filter out expired codes (case-insensitive check)
  const activeCodes = codes.filter(code => {
    const isActive = code.status?.toLowerCase() !== 'expired';
    return isActive;
  });
  
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${game.name} Codes`,
    "itemListElement": activeCodes.map((c, idx) => ({
      "@type": "ListItem",
      "position": idx + 1,
      "name": c.code,
      "description": c.reward || undefined,
      "url": `${siteUrl}/codes/${game.slug}#${encodeURIComponent(c.code)}`
    }))
  };
}

type ArticleAuthor = {
  name: string;
  url?: string | null;
  description?: string | null;
  sameAs?: string[] | null;
} | null | undefined;

export function gameArticleJsonLd({
  siteUrl,
  game,
  author,
  description,
  coverImage,
  publishedAt,
  updatedAt,
}: {
  siteUrl: string;
  game: { name: string; slug: string };
  author: ArticleAuthor;
  description: string;
  coverImage: string;
  publishedAt: string;
  updatedAt: string;
}) {
  const authorData = author?.name
    ? {
        "@type": "Person",
        "name": author.name,
        ...(author.url ? { url: author.url } : {}),
        ...(author.description ? { description: author.description } : {}),
        ...(author.sameAs && author.sameAs.length ? { sameAs: author.sameAs } : {})
      }
    : {
        "@type": "Organization",
        "name": SITE_NAME,
        "url": siteUrl
      };

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${siteUrl}/codes/${game.slug}`
    },
    "headline": `${game.name} Codes — How to Redeem`,
    "description": description,
    "image": [coverImage],
    "inLanguage": "en-US",
    "isAccessibleForFree": true,
    "keywords": [
      "Roblox",
      "Roblox codes",
      `${game.name} codes`,
      "gaming rewards"
    ],
    "articleSection": "Roblox Codes",
    "datePublished": publishedAt,
    "dateModified": updatedAt,
    "author": authorData,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/Bloxodes-dark.png`
      }
    }
  };
}

export function authorJsonLd({
  siteUrl,
  author,
  avatar,
  description
}: {
  siteUrl: string;
  author: {
    name: string;
    slug: string;
    twitter?: string | null;
    youtube?: string | null;
    website?: string | null;
    facebook?: string | null;
    linkedin?: string | null;
    instagram?: string | null;
    roblox?: string | null;
    discord?: string | null;
  };
  avatar?: string | null;
  description: string;
}) {
  const socialSource = {
    website: author.website ?? null,
    twitter: author.twitter ?? null,
    youtube: author.youtube ?? null,
    facebook: author.facebook ?? null,
    linkedin: author.linkedin ?? null,
    instagram: author.instagram ?? null,
    roblox: author.roblox ?? null,
    discord: author.discord ?? null
  };

  const sameAs = Array.from(new Set(collectAuthorSocials(socialSource).map((link) => link.url)));

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": author.name,
    "url": `${siteUrl}/authors/${author.slug}`,
    ...(avatar ? { image: avatar } : {}),
    "description": description,
    ...(sameAs.length ? { sameAs } : {})
  };
}

export function webPageJsonLd({
  siteUrl,
  slug,
  title,
  description,
  image,
  author,
  publishedAt,
  updatedAt
}: {
  siteUrl: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  author: { name: string; url?: string | null; description?: string | null; sameAs?: string[] | null } | null;
  publishedAt: string;
  updatedAt: string;
}) {
  const canonical = `${siteUrl.replace(/\/$/, "")}/${slug.replace(/^\//, "")}`;
  const imageUrl = image.startsWith("http") ? image : `${siteUrl.replace(/\/$/, "")}/${image.replace(/^\//, "")}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "url": canonical,
    "name": title,
    "headline": title,
    "description": description,
    "image": imageUrl,
    "datePublished": publishedAt,
    "dateModified": updatedAt,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/Bloxodes-dark.png`
      }
    },
    ...(author?.name
      ? {
          author: {
            "@type": "Person",
            "name": author.name,
            ...(author.url ? { url: author.url } : {}),
            ...(author.description ? { description: author.description } : {}),
            ...(author.sameAs && author.sameAs.length ? { sameAs: author.sameAs } : {})
          }
        }
      : {
          author: {
            "@type": "Organization",
            "name": SITE_NAME,
            "url": siteUrl
          }
        })
  };
}

export function howToJsonLd({
  siteUrl,
  subject,
  steps,
  images = [],
  title,
  description
}: {
  siteUrl: string;
  subject: { name: string; slug: string };
  steps: string[];
  images?: string[];
  title?: string;
  description?: string;
}) {
  if (!steps.length) return null;
  
  const canonical = `${siteUrl.replace(/\/$/, '')}/${subject.slug.replace(/^\//, '')}`;
  const normalizedImages = images
    .map((src) =>
      src.startsWith('http') ? src : `${siteUrl.replace(/\/$/, '')}/${src.replace(/^\//, '')}`
    )
    .slice(0, 3);
  const resolvedTitle = title ?? `How to redeem ${subject.name} codes`;
  const resolvedDescription = description ?? `Step-by-step guide to redeem codes in ${subject.name}.`;

  // Process steps to extract images and clean up text
  const processedSteps = steps.map(step => {
    // Check if the step contains an image reference
    const imageMatch = step.match(/\[Image: ([^\]]+)\]/);
    const stepText = step.replace(/\s*\[Image: [^\]]+\]\s*/, '').trim();
    
    return {
      text: stepText,
      // If we found an image reference, use it; otherwise, use the first available image
      image: imageMatch ? imageMatch[1] : undefined
    };
  });

  // If we have images but no steps with images, distribute them
  if (normalizedImages.length > 0) {
    const stepsWithImages = processedSteps.filter(step => step.image);
    if (stepsWithImages.length === 0) {
      // No steps have images, distribute available images
      processedSteps.forEach((step, index) => {
        if (index < normalizedImages.length) {
          step.image = normalizedImages[index];
        }
      });
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": resolvedTitle,
    "description": resolvedDescription,
    "url": canonical,
    ...(normalizedImages.length ? { image: normalizedImages } : {}),
    "step": processedSteps.map((step, index) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "name": step.text.length > 60 ? `${step.text.slice(0, 57)}...` : step.text,
      "text": step.text,
      ...(step.image ? {
        "image": step.image.startsWith('http') ? step.image : `${siteUrl.replace(/\/$/, '')}/${step.image.replace(/^\//, '')}`
      } : {})
    }))
  };
}
