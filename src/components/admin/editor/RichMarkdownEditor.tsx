"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { MDEditorProps } from "@uiw/react-md-editor";
import remarkGfm from "remark-gfm";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic<MDEditorProps>(() => import("@uiw/react-md-editor"), {
  ssr: false
});

const PLACEHOLDER_PATTERN = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;

function remarkPlaceholderLinks() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node || !Array.isArray(node.children)) return;
      const nextChildren: any[] = [];
      node.children.forEach((child: any) => {
        if (child?.type === "text" && typeof child.value === "string" && child.value.includes("[[")) {
          const text = child.value;
          const segments: any[] = [];
          const pattern = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;
          let lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(text)) !== null) {
            const [raw, key, rawLabel] = match;
            const label = (rawLabel ?? "").trim() || key;
            const start = match.index;
            if (start > lastIndex) {
              segments.push({ type: "text", value: text.slice(lastIndex, start) });
            }
            segments.push({
              type: "link",
              url: `#placeholder-${key}`,
              data: { hProperties: { className: "md-placeholder-chip", "data-placeholder-key": key } },
              children: [{ type: "text", value: label }]
            });
            lastIndex = start + raw.length;
          }
          if (segments.length) {
            if (lastIndex < text.length) {
              segments.push({ type: "text", value: text.slice(lastIndex) });
            }
            nextChildren.push(...segments);
            return;
          }
        }
        if (child && Array.isArray(child.children)) {
          visit(child);
        }
        nextChildren.push(child);
      });
      node.children = nextChildren;
    };
    visit(tree);
  };
}

function decoratePlaceholderChips(root: HTMLElement | null) {
  if (!root) return;
  const queue: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(".wmde-markdown-color, .markdown-body").forEach((el) => queue.push(el));
  if (queue.length === 0) {
    if (root.classList.contains("wmde-markdown-color") || root.classList.contains("markdown-body")) {
      queue.push(root);
    }
  }

  for (const container of queue) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.nodeValue && node.nodeValue.includes("[[") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const textNodes: Text[] = [];
    let current = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        textNodes.push(current as Text);
      }
      current = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const text = textNode.nodeValue ?? "";
      const pattern = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;
      let lastIndex = 0;
      const fragments: (Text | HTMLElement)[] = [];
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const [raw, key, rawLabel] = match;
        const label = (rawLabel ?? "").trim() || key;
        const start = match.index;
        if (start > lastIndex) {
          fragments.push(document.createTextNode(text.slice(lastIndex, start)));
        }

        const span = document.createElement("span");
        span.className = "md-placeholder-chip";
        span.dataset.placeholderKey = key;
        span.textContent = label;
        fragments.push(span);
        lastIndex = start + raw.length;
      }

      if (fragments.length === 0) continue;
      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.slice(lastIndex)));
      }

      const parent = textNode.parentNode;
      if (!parent) continue;
      fragments.forEach((fragment) => {
        parent.insertBefore(fragment, textNode);
      });
      parent.removeChild(textNode);
    }
  }
}

type RichMarkdownEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function RichMarkdownEditor({ label, value, onChange, placeholder }: RichMarkdownEditorProps) {
  const [localValue, setLocalValue] = useState<string>(value ?? "");
  const [mode, setMode] = useState<"edit" | "live">("edit");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const preview = useMemo(() => (mode === "edit" ? "edit" : "live"), [mode]);
  const previewOptions = useMemo<MDEditorProps["previewOptions"]>(() => {
    return {
      remarkPlugins: [
        remarkGfm,
        () => (tree: any) => {
          const maybeWrap = (label: string, key: string) => {
            return {
              type: "mdxJsxFlowElement",
              name: "span",
              attributes: [
                { type: "mdxJsxAttribute", name: "className", value: "md-placeholder-chip" },
                { type: "mdxJsxAttribute", name: "data-placeholder-key", value: key }
              ],
              children: [{ type: "text", value: label }]
            };
          };

          const visit = (node: any) => {
            if (!node || !Array.isArray(node.children)) return;
            const nextChildren: any[] = [];
            node.children.forEach((child: any) => {
              if (child?.type === "text" && typeof child.value === "string" && child.value.includes("[[")) {
                const text = child.value;
                const segments: any[] = [];
                const pattern = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;
                let lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = pattern.exec(text)) !== null) {
                  const [raw, key, rawLabel] = match;
                  const label = (rawLabel ?? "").trim() || key;
                  const start = match.index;
                  if (start > lastIndex) {
                    segments.push({ type: "text", value: text.slice(lastIndex, start) });
                  }
                  segments.push(maybeWrap(label, key));
                  lastIndex = start + raw.length;
                }
                if (segments.length) {
                  if (lastIndex < text.length) {
                    segments.push({ type: "text", value: text.slice(lastIndex) });
                  }
                  nextChildren.push(...segments);
                  return;
                }
              }
              if (child && Array.isArray(child.children)) {
                visit(child);
              }
              nextChildren.push(child);
            });
            node.children = nextChildren;
          };
          visit(tree);
        }
      ],
      rehypeRewrite: (node: any) => {
        if (node?.properties?.href && typeof node.properties.href === "string" && node.properties.href.startsWith("#placeholder-")) {
          node.properties["data-placeholder"] = node.properties.href.replace("#placeholder-", "");
          node.properties.href = undefined;
        }
      }
    };
  }, []);

  useEffect(() => {
    decoratePlaceholderChips(containerRef.current);
    const raf = requestAnimationFrame(() => decoratePlaceholderChips(containerRef.current));
    return () => cancelAnimationFrame(raf);
  }, [localValue, mode]);

  return (
    <div
      ref={containerRef}
      className="space-y-2"
      data-color-mode={mode === "live" ? "dark" : "dark"}
      data-md-editor-mode={mode}
      data-placeholder-enhanced="true"
    >
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        <button
          type="button"
          onClick={() => setMode((prev) => (prev === "edit" ? "live" : "edit"))}
          className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
        >
          {mode === "edit" ? "Show preview" : "Hide preview"}
        </button>
      </div>
      <div className="rounded-lg border border-border/60 bg-surface p-2">
        <MDEditor
          value={localValue}
          preview={preview}
          height={360}
          textareaProps={{ placeholder: placeholder ?? "Write your content…" }}
          previewOptions={previewOptions}
          onChange={(next) => {
            const normalized = next ?? "";
            setLocalValue(normalized);
            onChange(normalized);
          }}
        />
      </div>
      <style jsx global>{`
        [data-color-mode="dark"] .markdown-body a.md-placeholder-chip,
        [data-color-mode="dark"] .markdown-body span.md-placeholder-chip,
        .markdown-body a.md-placeholder-chip,
        .markdown-body span.md-placeholder-chip,
        [data-md-editor-mode="edit"] .wmde-markdown-color .md-placeholder-chip,
        .wmde-markdown-color .md-placeholder-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.15rem 0.55rem;
          border-radius: 999px;
          font-weight: 600;
          background: rgba(59, 130, 246, 0.18);
          color: #bfdbfe;
          border: 1px solid rgba(59, 130, 246, 0.35);
          text-decoration: none;
          pointer-events: none;
        }
        .markdown-body a.md-placeholder-chip::before,
        .markdown-body span.md-placeholder-chip::before {
          content: attr(data-placeholder-key);
          text-transform: uppercase;
          font-size: 0.65em;
          letter-spacing: 0.08em;
          background: rgba(59, 130, 246, 0.35);
          color: #1f2937;
          padding: 0.05rem 0.4rem;
          border-radius: 0.5rem;
        }
      `}</style>
    </div>
  );
}
