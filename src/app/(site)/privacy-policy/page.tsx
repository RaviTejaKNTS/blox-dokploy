import type { Metadata } from "next";
import "@/styles/article-content.css";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const title = "Privacy Policy";
const description =
  "Privacy policy for Bloxodes: no accounts, how we use AdSense and analytics, cookies/local storage, and your rights.";
const canonical = `${SITE_URL.replace(/\/$/, "")}/privacy-policy`;
const ogImage = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: {
    type: "website",
    url: canonical,
    title,
    description,
    siteName: SITE_NAME,
    images: [ogImage]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage]
  }
};

export default function PrivacyPolicyPage() {
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "PrivacyPolicy",
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
      <article className="prose dark:prose-invert max-w-none game-copy space-y-10">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{title}</h1>
          <p className="text-base text-muted sm:text-lg">
            Privacy policy for Bloxodes: no accounts, how we use AdSense and analytics, cookies/local storage, and your rights.
          </p>
        </header>

        <section className="space-y-4">
          <p>
            <strong>Effective Date:</strong> October 3, 2025
            <br />
            <strong>Last Updated:</strong> December 9, 2025
          </p>
          <p>
            Bloxodes.com ("Bloxodes," "we," "our," or "us") publishes Roblox guides, checklists, and tools. We designed this site to
            maximize privacy: we do not have user accounts, comments, or newsletters. We do not ask you to register, and we do not collect
            your name, email, address, or password.
          </p>
          <p>
            This Privacy Policy explains the technical data we collect, how we use it, and your rights. We wrote this to align with global
            standards, including EU/UK GDPR, ePrivacy, California CCPA/CPRA, and other U.S. state privacy laws.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">1. What We Collect (and What We Don&apos;t)</h2>
          <div className="space-y-3">
            <div>
              <p className="font-medium">We do not collect:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Names, physical addresses, phone numbers, or passwords.</li>
                <li>Registration data (we have no signup forms).</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">We may collect automatically (technical data):</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Device and network data: IP address, browser type, OS, referral URL, timestamps, pages visited.</li>
                <li>Usage data: page engagement (via Google Analytics and Vercel).</li>
                <li>Advertising identifiers: cookie IDs used by ad partners for frequency and fraud protection.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Direct interactions:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Email: If you email us, we receive your address and message to reply. We do not add you to marketing lists.</li>
                <li>
                  Checklists and tools: Your progress is stored in your browser&apos;s local storage and stays on your device. We do not
                  transmit it to our servers.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">2. Advertising (AdSense) and Google Policies</h2>
          <p>We use Google AdSense to display ads so we can offer our content for free.</p>
          <p>
            Third-party vendors, including Google, use cookies to serve ads based on your visits to this and other sites. Google and partners
            may use advertising cookies to show ads based on your interests and to prevent fraud.
          </p>
          <p>
            Learn how Google uses data:{" "}
            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
              https://policies.google.com/technologies/partner-sites
            </a>
          </p>
          <p>
            Manage your ad preferences or opt out of personalized ads:
            <br />
            <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">
              Google Ad Settings / My Ad Center
            </a>
            <br />
            <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer">
              https://www.aboutads.info/choices
            </a>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">3. Analytics</h2>
          <p>
            <strong>Google Analytics 4 (GA4):</strong> used to understand aggregate usage (popular pages, approximate regions). GA4 uses
            cookies to generate anonymous usage stats. We enable IP anonymization where possible and do not link this data to identities.
          </p>
          <p>
            <strong>Vercel Analytics and Speed Insights:</strong> used for performance and error monitoring. Data is aggregated and
            anonymized to help us keep the site fast.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">4. Cookies and Local Storage</h2>
          <div className="space-y-2">
            <p className="font-medium">Essential / functional (local storage):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Theme preference.</li>
              <li>Checklist progress for guides and tools.</li>
              <li>Consent state so we do not ask on every page.</li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Analytics and advertising cookies:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Set by Google Analytics and Google AdSense to measure views, clicks, and prevent fraud.</li>
            </ul>
          </div>
          <p>
            Manage your preferences on our{" "}
            <a href="/cookie-settings" className="text-primary underline-offset-4 hover:underline">
              cookie settings
            </a>{" "}
            page, or block/delete cookies in your browser. Clearing cookies will reset checklist progress and theme preferences.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">5. Data Sharing</h2>
          <p>We do not sell personal data. We share technical data only with providers that help run the site:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Google (AdSense/Analytics) as an independent controller for ads and measurement.</li>
            <li>Vercel for secure hosting, edge delivery, and performance monitoring.</li>
          </ul>
          <p>We may disclose information if required by law or to protect our rights and users.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">6. International Data Transfers</h2>
          <p>
            Our providers process data globally, including in the United States. When data moves from the EU/UK to the US, providers rely on
            mechanisms like the Data Privacy Framework or Standard Contractual Clauses to protect it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">7. Your Rights</h2>
          <div className="space-y-3">
            <p className="font-medium">EU/UK/Switzerland (GDPR):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Non-essential analytics and ads are off by default until you accept.</li>
              <li>Withdraw consent anytime at the cookie settings page.</li>
              <li>Access/delete: we do not keep accounts; clearing cookies removes local identifiers.</li>
            </ul>

            <p className="font-medium">United States (California, Virginia, Colorado, etc.):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Opt out of targeted ads and analytics via the cookie settings page.</li>
              <li>We do not share personal info for third-party direct marketing.</li>
            </ul>

            <p className="font-medium">India (DPDP Act 2023):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have grievance redressal rights. Contact us at the email below.</li>
            </ul>
          </div>
          <p>
            Manage or change your choices anytime on our{" "}
            <a href="/cookie-settings" className="text-primary underline-offset-4 hover:underline">
              cookie settings
            </a>{" "}
            page.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">8. Children&apos;s Privacy (COPPA)</h2>
          <p>
            Bloxodes is for a general audience aged 13 and older. We do not knowingly collect personal information from children under 13. If
            you believe a child provided data to us, email us and we will delete it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">9. Bloxodes Chrome Extension</h2>
          <p>
            The Bloxodes Chrome Extension does not collect, store, transmit, or share personal data. It only retrieves publicly available
            Roblox game data (codes) and displays them. It contains no analytics or tracking code.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">10. Contact Us</h2>
          <p>
            <strong>Email:</strong> <a href="mailto:getbloxodes@gmail.com">getbloxodes@gmail.com</a>
            <br />
            <strong>Website:</strong>{" "}
            <a href="https://bloxodes.com" target="_blank" rel="noopener noreferrer">
              https://bloxodes.com
            </a>
          </p>
          <p>We may update this policy as our services or laws change. Check the Last Updated date above for the latest version.</p>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      </article>

      <aside aria-hidden className="hidden lg:block" />
    </div>
  );
}
