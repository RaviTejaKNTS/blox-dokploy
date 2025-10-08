"use client";

import {
  FaDiscord,
  FaFacebook,
  FaTelegram,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";

type SocialShareProps = {
  url: string;
  title: string;
  heading?: string;
};

export function SocialShare({ url, title, heading = "Share these codes with your friends" }: SocialShareProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const socialLinks = [
    {
      name: "Discord",
      icon: <FaDiscord />,
      // Discord doesn't have a direct share link, this is a placeholder.
      // A real implementation might involve a server-side bot or a simple copy-to-clipboard.
      url: `https://discord.com/app`, 
      color: "bg-[#5865F2] text-white",
    },
    {
      name: "Twitter",
      icon: <FaXTwitter />,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: "bg-[#000000] text-white",
    },
    {
      name: "Facebook",
      icon: <FaFacebook />,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "bg-[#1877F2] text-white",
    },
    {
      name: "WhatsApp",
      icon: <FaWhatsapp />,
      url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      color: "bg-[#25D366] text-white",
    },
    {
      name: "Telegram",
      icon: <FaTelegram />,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      color: "bg-[#24A1DE] text-white",
    },
  ];

  return (
    <div className="mb-4 p-2">
      <h3 className="text-lg font-semibold text-foreground mb-3">{heading}</h3>
      <div className="flex items-center gap-2">
        {socialLinks.map((social) => (
          <a
            key={social.name}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${social.name}`}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 ${social.color}`}
          >
            <span className="text-lg">{social.icon}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
