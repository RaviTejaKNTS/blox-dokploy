"use client";

import { useEffect } from "react";

function enhanceCodeBlocks() {
  const blocks = document.querySelectorAll<HTMLPreElement>(".game-copy pre, .prose pre");

  blocks.forEach((pre) => {
    if (pre.dataset.enhanced === "true") return;
    const code = pre.querySelector("code");
    if (!code) return;

    pre.dataset.enhanced = "true";
    pre.style.position = pre.style.position || "relative";

    const langMatch = Array.from(code.classList).find((cls) => cls.startsWith("language-"));
    const language = langMatch ? langMatch.replace("language-", "").replace(/-/g, " ") : "code";
    const label = document.createElement("span");
    label.className = "code-block-label";
    label.textContent = language.toUpperCase();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block-copy";
    button.textContent = "Copy";

    button.addEventListener("click", async () => {
      const text = code.textContent || "";
      try {
        await navigator.clipboard.writeText(text.trim());
        button.textContent = "Copied!";
        button.classList.add("copied");
        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("copied");
        }, 1500);
      } catch {
        button.textContent = "Failed";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 1500);
      }
    });

    pre.appendChild(label);
    pre.appendChild(button);
  });
}

export function CodeBlockEnhancer() {
  useEffect(() => {
    enhanceCodeBlocks();
    const observer = new MutationObserver(() => {
      enhanceCodeBlocks();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
