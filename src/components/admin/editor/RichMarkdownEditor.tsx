"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ICommand, MDEditorProps } from "@uiw/react-md-editor";
import { commands as mdCommands } from "@uiw/react-md-editor";
import remarkGfm from "remark-gfm";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic<MDEditorProps>(() => import("@uiw/react-md-editor"), {
  ssr: false
});

const PLACEHOLDER_PATTERN = /\[\[([a-z0-9_]+)\|([^\]]+)\]\]/gi;

type PlaceholderDefinition = {
  key: string;
  shortLabel: string;
  defaultLabel: string;
  title: string;
};

const PLACEHOLDER_DEFINITIONS: PlaceholderDefinition[] = [
  {
    key: "roblox_link",
    shortLabel: "RB",
    defaultLabel: "Roblox link",
    title: "Insert Roblox placeholder link"
  },
  {
    key: "community_link",
    shortLabel: "CM",
    defaultLabel: "Community link",
    title: "Insert Community placeholder link"
  },
  {
    key: "discord_link",
    shortLabel: "DC",
    defaultLabel: "Discord server",
    title: "Insert Discord placeholder link"
  },
  {
    key: "twitter_link",
    shortLabel: "TW",
    defaultLabel: "Twitter profile",
    title: "Insert Twitter placeholder link"
  },
  {
    key: "youtube_link",
    shortLabel: "YT",
    defaultLabel: "YouTube channel",
    title: "Insert YouTube placeholder link"
  }
];

function createPlaceholderCommand(definition: PlaceholderDefinition): ICommand {
  const { key, shortLabel, defaultLabel, title } = definition;
  return {
    name: `placeholder-${key}`,
    keyCommand: `placeholder-${key}`,
    buttonProps: {
      "aria-label": title,
      title
    },
    icon: (
      <span className="md-placeholder-command-icon" aria-hidden="true">
        {shortLabel}
      </span>
    ),
    execute: (state, api) => {
      const selectionStart = state.selection.start ?? 0;
      const selectedText = state.selectedText ?? "";
      const trimmedSelection = selectedText.trim();
      const labelText = trimmedSelection.length > 0 ? trimmedSelection : defaultLabel;
      const placeholder = `[[${key}|${labelText}]]`;
      api.replaceSelection(placeholder);
      const labelStart = selectionStart + 2 + key.length + 1;
      const labelEnd = labelStart + labelText.length;
      api.setSelectionRange({ start: labelStart, end: labelEnd });
    }
  };
}

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
            const [raw, key] = match;
            const start = match.index;
            if (start > lastIndex) {
              segments.push({ type: "text", value: text.slice(lastIndex, start) });
            }
            segments.push({
              type: "link",
              url: "#",
              data: {
                hProperties: {
                  className: "md-placeholder-link",
                  "data-placeholder-key": key,
                  "data-placeholder-raw": raw
                }
              },
              children: [{ type: "text", value: raw }]
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

function decoratePlaceholderChips(root: HTMLElement | null): () => void {
  if (!root) return () => {};

  let isDecorating = false;
  let frame: number | null = null;

  const apply = () => {
    if (!root || isDecorating) return;
    isDecorating = true;
    try {
      const containers: HTMLElement[] = [];
      root.querySelectorAll<HTMLElement>(".wmde-markdown-color, .markdown-body").forEach((el) => containers.push(el));
      if (
        root instanceof HTMLElement &&
        (root.classList.contains("wmde-markdown-color") || root.classList.contains("markdown-body"))
      ) {
        containers.push(root);
      }

      for (const container of containers) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.includes("[[")) return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.closest(".md-placeholder-link")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
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
            const [raw, key] = match;
            const start = match.index;
            if (start > lastIndex) {
              fragments.push(document.createTextNode(text.slice(lastIndex, start)));
            }

            const span = document.createElement("span");
            span.className = "md-placeholder-link";
            span.dataset.placeholderKey = key;
            span.dataset.placeholderRaw = raw;
            span.textContent = raw;
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
    } finally {
      isDecorating = false;
    }
  };

  apply();

  const observer = new MutationObserver((mutations) => {
    if (isDecorating) return;
    for (const mutation of mutations) {
      if (mutation.type === "childList" || mutation.type === "characterData") {
        if (frame != null) {
          cancelAnimationFrame(frame);
          frame = null;
        }
        frame = requestAnimationFrame(() => {
          frame = null;
          apply();
        });
        break;
      }
    }
  });

  observer.observe(root, { subtree: true, childList: true, characterData: true });

  return () => {
    observer.disconnect();
    if (frame != null) {
      cancelAnimationFrame(frame);
    }
  };
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
      remarkPlugins: [remarkGfm, remarkPlaceholderLinks]
    };
  }, []);

  const placeholderCommands = useMemo<ICommand[]>(() => {
    return PLACEHOLDER_DEFINITIONS.map((definition) => createPlaceholderCommand(definition));
  }, []);

  const editorCommands = useMemo<ICommand[]>(() => {
    const base = mdCommands.getCommands();
    if (placeholderCommands.length === 0) {
      return [...base];
    }
    const commands = [...base];
    const linkIndex = commands.findIndex((command) => command.name === "link");
    if (linkIndex === -1) {
      return [...commands, ...placeholderCommands];
    }
    commands.splice(linkIndex + 1, 0, ...placeholderCommands);
    return commands;
  }, [placeholderCommands]);

  const editorExtraCommands = useMemo<ICommand[]>(() => mdCommands.getExtraCommands(), []);

  useEffect(() => {
    return decoratePlaceholderChips(containerRef.current);
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
          commands={editorCommands}
          extraCommands={editorExtraCommands}
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
        [data-md-editor-mode] .wmde-markdown,
        [data-md-editor-mode] .markdown-body,
        [data-md-editor-mode] .wmde-markdown-color {
          --md-link-color: var(--color-accent-fg, #58a6ff);
        }
        [data-md-editor-mode] .wmde-markdown a,
        [data-md-editor-mode] .wmde-markdown a:visited,
        [data-md-editor-mode] .markdown-body a,
        [data-md-editor-mode] .markdown-body a:visited,
        [data-md-editor-mode] .wmde-markdown-color a,
        [data-md-editor-mode] .wmde-markdown-color a:visited {
          color: var(--md-link-color, #58a6ff) !important;
          text-decoration: none;
        }
        [data-md-editor-mode] .wmde-markdown a:hover,
        [data-md-editor-mode] .wmde-markdown a:focus-visible,
        [data-md-editor-mode] .markdown-body a:hover,
        [data-md-editor-mode] .markdown-body a:focus-visible,
        [data-md-editor-mode] .wmde-markdown-color a:hover,
        [data-md-editor-mode] .wmde-markdown-color a:focus-visible {
          text-decoration: underline;
        }
        [data-placeholder-enhanced="true"] .w-md-editor-toolbar .md-placeholder-command-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 1.25rem;
          height: 1.25rem;
          padding: 0 0.2rem;
          border-radius: 0.35rem;
          font-size: 0.62rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          pointer-events: none;
        }
        [data-md-editor-mode] .wmde-markdown .md-placeholder-link,
        [data-md-editor-mode] .markdown-body .md-placeholder-link,
        [data-md-editor-mode] .wmde-markdown-color .md-placeholder-link {
          display: inline;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--md-link-color, #58a6ff) !important;
          font-weight: inherit;
          text-decoration: none;
          cursor: default;
          pointer-events: none;
        }
        [data-md-editor-mode] .wmde-markdown .md-placeholder-link:hover,
        [data-md-editor-mode] .wmde-markdown .md-placeholder-link:focus-visible,
        [data-md-editor-mode] .markdown-body .md-placeholder-link:hover,
        [data-md-editor-mode] .markdown-body .md-placeholder-link:focus-visible,
        [data-md-editor-mode] .wmde-markdown-color .md-placeholder-link:hover,
        [data-md-editor-mode] .wmde-markdown-color .md-placeholder-link:focus-visible {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
