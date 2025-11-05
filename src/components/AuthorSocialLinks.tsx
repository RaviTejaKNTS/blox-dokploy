import type { ReactNode } from "react";
import { FaDiscord, FaFacebookF, FaGlobe, FaInstagram, FaLinkedinIn, FaTwitter, FaYoutube } from "react-icons/fa";
import { SiRoblox } from "react-icons/si";
import type { Author } from "@/lib/db";
import { collectAuthorSocials, type AuthorSocialType } from "@/lib/author-socials";
import { cn } from "@/lib/utils";

const SOCIAL_ICONS: Record<AuthorSocialType, ReactNode> = {
  website: <FaGlobe aria-hidden="true" />,
  twitter: <FaTwitter aria-hidden="true" />,
  youtube: <FaYoutube aria-hidden="true" />,
  facebook: <FaFacebookF aria-hidden="true" />,
  linkedin: <FaLinkedinIn aria-hidden="true" />,
  instagram: <FaInstagram aria-hidden="true" />,
  roblox: <SiRoblox aria-hidden="true" />,
  discord: <FaDiscord aria-hidden="true" />
};

const SOCIAL_LABELS: Record<AuthorSocialType, string> = {
  website: "Website",
  twitter: "Twitter",
  youtube: "YouTube",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  roblox: "Roblox",
  discord: "Discord"
};

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "h-8 w-8 text-[0.9rem]",
  md: "h-9 w-9 text-base"
};

interface AuthorSocialLinksProps {
  author: Author | null | undefined;
  size?: "sm" | "md";
  className?: string;
}

export function AuthorSocialLinks({ author, size = "md", className }: AuthorSocialLinksProps) {
  const socials = collectAuthorSocials(author ?? null);
  if (!socials.length) return null;

  const buttonClasses = cn(
    "inline-flex items-center justify-center rounded-full border border-border/50 bg-surface text-foreground transition hover:border-accent/60 hover:text-accent",
    SIZE_CLASSES[size]
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {socials.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className={buttonClasses}
          aria-label={SOCIAL_LABELS[link.type]}
        >
          {SOCIAL_ICONS[link.type]}
          <span className="sr-only">{SOCIAL_LABELS[link.type]}</span>
        </a>
      ))}
    </div>
  );
}

export { SOCIAL_LABELS as AUTHOR_SOCIAL_LABELS, SOCIAL_ICONS as AUTHOR_SOCIAL_ICONS };
