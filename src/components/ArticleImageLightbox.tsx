"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type LightboxImage = {
  src: string;
  alt: string;
};

type ArticleImageLightboxProps = {
  containerId?: string;
};

export function ArticleImageLightbox({ containerId = "article-body" }: ArticleImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<LightboxImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const canNavigate = images.length > 1;
  const hasPrev = canNavigate && activeIndex > 0;
  const hasNext = canNavigate && activeIndex < images.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const img = target.closest("img");
      if (!img || !(img instanceof HTMLImageElement)) return;
      if (!container.contains(img)) return;

      const link = img.closest("a");
      if (link) {
        event.preventDefault();
      }

      const gallery = img.closest(".article-gallery");
      const galleryImages = gallery ? Array.from(gallery.querySelectorAll("img")) : [img];
      const items = galleryImages.map((item) => ({
        src: item.currentSrc || item.src,
        alt: item.alt || "Article image"
      }));
      const index = Math.max(0, galleryImages.indexOf(img));

      setImages(items);
      setActiveIndex(index);
      setIsOpen(true);
    };

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerId]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (!canNavigate) return;
      if (event.key === "ArrowRight") {
        setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : prev));
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [canNavigate, images.length, isOpen]);

  const activeImage = useMemo(() => images[activeIndex], [images, activeIndex]);

  if (!mounted || !isOpen || !activeImage) return null;

  return createPortal(
    <div
      className="article-lightbox"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setIsOpen(false);
        }
      }}
    >
      <div className="article-lightbox__toolbar">
        <button
          type="button"
          className="article-lightbox__button"
          onClick={() => setIsOpen(false)}
          aria-label="Close image viewer"
        >
          Close
        </button>
      </div>

      <div className="article-lightbox__content">
        {canNavigate ? (
          <button
            type="button"
            className="article-lightbox__nav article-lightbox__nav--prev"
            onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))}
            aria-label="Previous image"
            disabled={!hasPrev}
          >
            Prev
          </button>
        ) : null}

        <img className="article-lightbox__image" src={activeImage.src} alt={activeImage.alt} />

        {canNavigate ? (
          <button
            type="button"
            className="article-lightbox__nav article-lightbox__nav--next"
            onClick={() => setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : prev))}
            aria-label="Next image"
            disabled={!hasNext}
          >
            Next
          </button>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
