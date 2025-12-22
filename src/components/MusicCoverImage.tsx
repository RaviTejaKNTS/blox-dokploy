"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
};

export function MusicCoverImage({ src, alt, sizes, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted/60" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M9 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
          <path d="M21 6v9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
          <path d="M9 19V7l12-3v11" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
