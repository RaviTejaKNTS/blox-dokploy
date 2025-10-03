import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const title = "About Bloxodes.com";
const description = "Learn how Bloxodes.com helps Roblox players find reliable, up-to-date codes.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/about`;
const ogImage = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: `${title} | ${SITE_NAME}`,
  description,
  alternates: { canonical },
  openGraph: {
    type: "website",
    url: canonical,
    title: `${title} | ${SITE_NAME}`,
    description,
    siteName: SITE_NAME,
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | ${SITE_NAME}`,
    description,
    images: [ogImage]
  }
};

export default function AboutPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: title,
    description,
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL
    }
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.25fr)]">
      <article className="prose dark:prose-invert max-w-none game-copy">
        <header className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">About Bloxodes.com</h1>
          <p className="text-base text-muted sm:text-lg">
            Bloxodes.com was created with a simple purpose: to help Roblox players find the latest working codes for their favorite games
            quickly, safely, and without confusion. We know how frustrating it can be to waste time on expired or misleading codes, so our
            site is built to provide accurate, clear, and up-to-date information in one trusted place.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Who We Are</h2>
          <p>
            We are an independent project run by a small team of editors and developers who love Roblox and gaming communities. Our focus is
            entirely on delivering value to players through reliable guides and regularly updated code lists. We are not affiliated with
            Roblox Corporation or any specific game developer. Instead, we operate independently to give players a trustworthy alternative
            to cluttered or misleading code websites.
          </p>
          <p>
            You can also get to know the people behind Bloxodes on our{' '}
            <a href="https://bloxodes.com/authors" target="_blank" rel="noopener noreferrer">
              Authors Page
            </a>
            . There, you’ll find our editors and contributors, each specializing in different Roblox genres, from simulators and RPGs to
            competitive experiences. Every author maintains a personal portfolio so you can explore their latest work.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">What We Do</h2>
          <p>At Bloxodes.com, we:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Track Roblox games with active code systems.</li>
            <li>Verify and update codes using official developer sources like Twitter/X, Discord, and in-game announcements.</li>
            <li>Separate codes into <strong>Active</strong>, <strong>Expired</strong>, and <strong>Check/Uncertain</strong> so players always know the status of each code.</li>
            <li>Provide <strong>How to Redeem</strong> guides and troubleshooting tips for each game so new players can follow along easily.</li>
            <li>Update pages frequently so you never miss out on the latest rewards.</li>
          </ul>
          <p>Our content is written in plain, easy-to-understand language so players of all ages can benefit from it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">How We Work</h2>
          <p>
            Our site uses a combination of automation and editorial review. Automated tools help us detect when new codes are released, while
            editors verify information before it goes live. We make sure each article includes a <strong>last updated</strong> date so you know
            how fresh the information is.
          </p>
          <p>
            We also rely on reader feedback. If you notice an expired or incorrect code, you can reach out directly via our{' '}
            <a href="https://bloxodes.com/contact" target="_blank" rel="noopener noreferrer">
              Contact Page
            </a>{' '}
            or by emailing us at <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>. Every report is reviewed, and valid
            corrections are applied as quickly as possible.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Independence and Trust</h2>
          <p>
            Bloxodes.com is a <strong>fan-made project</strong>. We do not sell codes, ask for your Roblox login, or promise rewards beyond
            what developers officially release. Our independence means our priority is always to the players. We are committed to honesty,
            accuracy, and transparency in everything we publish.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Our Commitment</h2>
          <p>We aim to be more than just another codes site. Our goal is to build a platform that:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Keeps Roblox players informed with the latest codes.</li>
            <li>Offers clear instructions to redeem rewards without confusion.</li>
            <li>Operates with full respect for user privacy and safety.</li>
            <li>Stays independent, transparent, and reliable.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Final Word</h2>
          <p>
            Bloxodes.com is here to make your Roblox experience more rewarding and less frustrating. By providing verified codes,
            easy-to-follow guides, and consistent updates, we hope to be your go-to resource whenever you’re looking for Roblox game
            rewards. Thank you for trusting us—we’re here to help you get the most out of your playtime.
          </p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}

