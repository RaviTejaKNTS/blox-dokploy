"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { MDEditorProps } from "@uiw/react-md-editor";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic<MDEditorProps>(() => import("@uiw/react-md-editor"), {
  ssr: false
});

type RichMarkdownEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function RichMarkdownEditor({ label, value, onChange, placeholder }: RichMarkdownEditorProps) {
  const [localValue, setLocalValue] = useState<string>(value ?? "");
  const [mode, setMode] = useState<"edit" | "live">("edit");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const preview = useMemo(() => (mode === "edit" ? "edit" : "live"), [mode]);

  return (
    <div className="space-y-2" data-color-mode={mode === "live" ? "dark" : "dark"}>
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
          onChange={(next) => {
            const normalized = next ?? "";
            setLocalValue(normalized);
            onChange(normalized);
          }}
        />
      </div>
    </div>
  );
}
