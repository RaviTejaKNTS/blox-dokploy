import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { fetchRobuxBundles } from "./robux-bundles";
import { RobuxPurchaseClient } from "./RobuxPurchaseClient";
import {
  DEFAULT_HAS_PREMIUM,
  DEFAULT_TARGET_ROBUX,
  DEFAULT_TARGET_USD,
  buildBudgetPlan,
  buildRobuxPlan,
  buildValueBundlePlan,
  selectBestRobuxPlan
} from "./robux-plans";

const PAGE_TITLE = "Robux to USD Calculator — Roblox Purchase Planner";
const PAGE_DESCRIPTION =
  "Estimate how many Robux you can buy on PC/Web or Mobile/Microsoft Store, with or without Roblox Premium. See the bundles, prices, and effective cost before tax.";
const CANONICAL = `${SITE_URL.replace(/\/$/, "")}/calculators/robux-to-usd`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: CANONICAL
  },
  openGraph: {
    type: "website",
    url: CANONICAL,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: SITE_NAME,
    images: [`${SITE_URL}/og-image.png`]
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`]
  }
};

export default async function RobloxPurchasePage() {
  const bundles = await fetchRobuxBundles();
  const initialRobuxPlanPc = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "pc_web", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlanMobile = buildRobuxPlan(DEFAULT_TARGET_ROBUX, "mobile", DEFAULT_HAS_PREMIUM, bundles);
  const initialRobuxPlan = selectBestRobuxPlan(initialRobuxPlanPc, initialRobuxPlanMobile);
  const initialValuePlan = buildValueBundlePlan(DEFAULT_TARGET_ROBUX, DEFAULT_HAS_PREMIUM, bundles);
  const initialBudgetPlan = buildBudgetPlan(DEFAULT_TARGET_USD, DEFAULT_HAS_PREMIUM, bundles);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "Robux to USD Calculator",
        description:
          "Robux to USD and USD to Robux calculator that uses real Roblox bundles and suggests the best value options.",
        url: CANONICAL,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Calculators", item: `${SITE_URL.replace(/\/$/, "")}/calculators` },
            { "@type": "ListItem", position: 3, name: "Robux to USD" }
          ]
        },
        mainEntity: {
          "@type": "WebApplication",
          name: "Robux to USD Calculator",
          description: "Convert Robux and USD using current Roblox bundle values to find the best deal.",
          applicationCategory: "Calculator",
          operatingSystem: "Web",
          url: CANONICAL
        }
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Robux calculator AUD or Robux calculator pounds?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "This calculator uses USD. If you pay in AUD, GBP, or another currency, your bank or card provider converts from USD automatically."
            }
          },
          {
            "@type": "Question",
            name: "Is buying Robux on mobile worse than PC or web?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Often yes. Mobile usually gives fewer Robux for the same price compared to PC or web."
            }
          },
          {
            "@type": "Question",
            name: "Why are my prices slightly different from this calculator?",
            acceptedAnswer: {
              "@type": "Answer",
              text:
                "Roblox uses regional pricing and may adjust bundle values. This tool follows the main USD bundles as a base."
            }
          },
          {
            "@type": "Question",
            name: "Can I get a refund for Robux purchases?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Most Robux purchases are final. Roblox may rarely refund if a paid item you own is removed or moderated."
            }
          },
          {
            "@type": "Question",
            name: "Are Robux generators or free Robux sites real?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. They are almost always scams that try to steal your account or monetize surveys."
            }
          },
          {
            "@type": "Question",
            name: "How much is 350 Robux in USD?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "About $3 to $4 on PC/Web since it sits between the $2.99 and $4.99 bundles."
            }
          },
          {
            "@type": "Question",
            name: "How much is 499 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Roughly $4.99 on PC/Web (one 500 Robux bundle)." }
          },
          {
            "@type": "Question",
            name: "How much is 2400 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Around $24 to $25 on PC/Web using a 2000 + 500 style mix." }
          },
          {
            "@type": "Question",
            name: "How much is 7000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "In the $70 range on PC/Web depending on bundle mix." }
          },
          {
            "@type": "Question",
            name: "How much is 9999 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "About $100 on PC/Web (equivalent to the 10,000 Robux pack)." }
          },
          {
            "@type": "Question",
            name: "How much is 40000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Typically in the high $300s, around $360 to $400 on PC/Web." }
          },
          {
            "@type": "Question",
            name: "How much is 48000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Close to $400 on PC/Web using two large packs." }
          },
          {
            "@type": "Question",
            name: "How much is 50000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Usually in the low $400s, roughly $410 to $450 on PC/Web." }
          },
          {
            "@type": "Question",
            name: "How much is 70000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Typically in the $600 to $650 range on PC/Web." }
          },
          {
            "@type": "Question",
            name: "How much is 85000 Robux in USD?",
            acceptedAnswer: { "@type": "Answer", text: "Often between $750 and $850 on PC/Web." }
          },
          {
            "@type": "Question",
            name: "How much is 999999999 Robux in USD?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "It would cost millions of dollars if it were possible to buy directly; it's a meme-level amount."
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs uppercase tracking-[0.25em] text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="flex items-center gap-2">
            <a href="/" className="font-semibold text-muted transition hover:text-accent">
              Home
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <a href="/calculators" className="font-semibold text-muted transition hover:text-accent">
              Calculators
            </a>
            <span className="text-muted/60">&gt;</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="font-semibold text-foreground/80">Robux to USD</span>
          </li>
        </ol>
      </nav>
      <RobuxPurchaseClient
        bundles={bundles}
        initialRobuxTarget={DEFAULT_TARGET_ROBUX}
        initialUsdTarget={DEFAULT_TARGET_USD}
        initialHasPremium={DEFAULT_HAS_PREMIUM}
        initialRobuxPlan={initialRobuxPlan}
        initialValuePlan={initialValuePlan}
        initialBudgetPlan={initialBudgetPlan}
      />
    </>
  );
}
