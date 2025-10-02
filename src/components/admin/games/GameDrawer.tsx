"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  FormEvent,
  type ChangeEvent,
  type DragEvent
} from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RichMarkdownEditor } from "@/components/admin/editor/RichMarkdownEditor";
import type { AdminAuthorOption, AdminGameSummary } from "@/lib/admin/games";
import { saveGame, upsertGameCode, updateCodeStatus, deleteCode, refreshGameCodes } from "@/app/admin/(dashboard)/games/actions";
import { normalizeGameSlug, slugFromUrl, titleizeGameSlug } from "@/lib/slug";

function parseMarkdownSections(markdown: string) {
  const result = {
    intro: "",
    redeem: "",
    description: ""
  };

  if (!markdown.trim()) return result;

  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const isHeading = (line: string) => /^#{1,6}\s/.test(line.trim());

  let index = 0;

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  while (index < lines.length && isHeading(lines[index])) {
    index += 1;
    while (index < lines.length && !lines[index].trim()) {
      index += 1;
    }
  }

  const introLines: string[] = [];
  while (index < lines.length && !isHeading(lines[index])) {
    introLines.push(lines[index]);
    index += 1;
  }
  while (introLines.length && !introLines[introLines.length - 1].trim()) {
    introLines.pop();
  }
  if (introLines.length) {
    result.intro = introLines.join("\n").trim();
  }

  if (index >= lines.length) {
    return result;
  }

  const redeemStart = index;
  let redeemEnd = lines.length;
  for (let i = redeemStart + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i])) {
      redeemEnd = i;
      break;
    }
  }

  const redeemLines = lines.slice(redeemStart, redeemEnd);
  while (redeemLines.length && !redeemLines[redeemLines.length - 1].trim()) {
    redeemLines.pop();
  }
  if (redeemLines.length) {
    result.redeem = redeemLines.join("\n").trim();
  }

  const descriptionLines = lines.slice(redeemEnd).join("\n").trim();
  if (descriptionLines) {
    result.description = descriptionLines;
  }

  return result;
}

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").or(z.literal("")),
  slug: z.string().min(1, "Slug is required").or(z.literal("")),
  author_id: z.string().optional(),
  is_published: z.boolean().optional(),
  source_url: z.string().url().optional().or(z.literal("")),
  source_url_2: z.string().url().optional().or(z.literal("")),
  source_url_3: z.string().url().optional().or(z.literal("")),
  intro_md: z.string().optional(),
  redeem_md: z.string().optional(),
  description_md: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  cover_image: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

type TabKey = "content" | "meta" | "codes";

export function GameDrawer({
  open,
  onClose,
  onRefresh,
  game,
  authors
}: {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  game: AdminGameSummary | null;
  authors: AdminAuthorOption[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("content");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastAutoSlugRef = useRef<string>("");
  const slugManuallyEditedRef = useRef(false);
  const nameManuallyEditedRef = useRef(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const defaultValues = useMemo<FormValues>(() => ({
    id: game?.id,
    name: game?.name ?? "",
    slug: game?.slug ?? "",
    author_id: game?.author.id ?? undefined,
    is_published: game?.is_published ?? false,
    source_url: game?.source_url ?? "",
    source_url_2: game?.source_url_2 ?? "",
    source_url_3: game?.source_url_3 ?? "",
    intro_md: game?.intro_md ?? "",
    redeem_md: game?.redeem_md ?? "",
    description_md: game?.description_md ?? "",
    seo_title: game?.seo_title ?? "",
    seo_description: game?.seo_description ?? "",
    cover_image: game?.cover_image ?? ""
  }), [game]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });
  const nameRegister = register("name");
  const slugRegister = register("slug");

  useEffect(() => {
    reset(defaultValues);
    setActiveTab("content");
    setStatusMessage(null);
    setMarkdownError(null);
    setIsDragging(false);
    const initialSlug = normalizeGameSlug(defaultValues.slug || defaultValues.name || "");
    lastAutoSlugRef.current = initialSlug;
    slugManuallyEditedRef.current = false;
    nameManuallyEditedRef.current = false;
  }, [defaultValues, reset, open]);

  const nameValue = watch("name");
  const slugValue = watch("slug");
  const sourceUrlValue = watch("source_url");
  const introValue = watch("intro_md");
  const redeemValue = watch("redeem_md");
  const descriptionValue = watch("description_md");

  useEffect(() => {
    if (game) return;
    if (!nameValue) return;

    if (!slugValue) {
      slugManuallyEditedRef.current = false;
    }

    if (slugManuallyEditedRef.current && slugValue) return;

    const autoSlug = normalizeGameSlug(nameValue);
    if (!autoSlug) return;

    if (slugValue !== autoSlug) {
      slugManuallyEditedRef.current = false;
      setValue("slug", autoSlug, { shouldDirty: false });
    }
    lastAutoSlugRef.current = autoSlug;
  }, [game, nameValue, slugValue, setValue]);

  useEffect(() => {
    if (game) return;
    const trimmedSource = sourceUrlValue?.trim();
    if (!trimmedSource) return;

    if (!nameValue) {
      nameManuallyEditedRef.current = false;
    }

    if (!slugValue) {
      slugManuallyEditedRef.current = false;
    }

    const sourceSlug = slugFromUrl(trimmedSource);
    if (!sourceSlug) return;

    const normalizedSlug = normalizeGameSlug(sourceSlug);
    const derivedName = titleizeGameSlug(normalizedSlug);

    if (!nameManuallyEditedRef.current && derivedName) {
      if (nameValue !== derivedName) {
        setValue("name", derivedName, { shouldDirty: false });
      }
      nameManuallyEditedRef.current = false;
    }

    if (!slugManuallyEditedRef.current && normalizedSlug) {
      if (slugValue !== normalizedSlug) {
        setValue("slug", normalizedSlug, { shouldDirty: false });
      }
      lastAutoSlugRef.current = normalizedSlug;
      slugManuallyEditedRef.current = false;
    }
  }, [game, sourceUrlValue, nameValue, slugValue, setValue]);

  const isPublished = watch("is_published");

  const applyMarkdownContent = useCallback(
    (markdown: string) => {
      const sections = parseMarkdownSections(markdown);
      if (!introValue && sections.intro) {
        setValue("intro_md", sections.intro, { shouldDirty: true });
      }
      if (!redeemValue && sections.redeem) {
        setValue("redeem_md", sections.redeem, { shouldDirty: true });
      }
      if (!descriptionValue && sections.description) {
        setValue("description_md", sections.description, { shouldDirty: true });
      }
    },
    [descriptionValue, introValue, redeemValue, setValue]
  );

  const handleMarkdownFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const text = await file.text();
        applyMarkdownContent(text);
        setMarkdownError(null);
      } catch (error) {
        console.error("Failed to read markdown", error);
        setMarkdownError("Could not read the markdown file. Please try again.");
      }
    },
    [applyMarkdownContent]
  );

  const onFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void handleMarkdownFile(file);
      event.target.value = "";
    },
    [handleMarkdownFile]
  );

  const onDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      void handleMarkdownFile(file);
    },
    [handleMarkdownFile]
  );

  const onSubmit = handleSubmit((values) => {
    const primarySource = values.source_url?.trim() || undefined;
    const fallbackSlugSource = values.name || slugFromUrl(primarySource ?? "") || "";
    const normalizedSlug = normalizeGameSlug(values.slug, fallbackSlugSource);

    if (!normalizedSlug) {
      setStatusMessage("Unable to derive slug. Please provide a slug or valid source URL.");
      return;
    }

    const derivedName = values.name?.trim() || titleizeGameSlug(normalizedSlug);

    const finalValues = {
      ...values,
      name: derivedName,
      slug: normalizedSlug
    };

    const formData = new FormData();
    Object.entries(finalValues).forEach(([key, raw]) => {
      if (raw === undefined) return;
      if (raw === null) return;
      formData.append(key, String(raw));
    });
    formData.set("is_published", finalValues.is_published ? "true" : "false");
    startTransition(async () => {
      try {
        const result = await saveGame(formData);
        if (!result?.success) {
          setStatusMessage(result?.error ?? "Failed to save. Please check your inputs.");
          return;
        }

        if (result.syncErrors?.length) {
          setStatusMessage(`Saved but failed to fetch codes: ${result.syncErrors.join(", ")}`);
        } else {
          setStatusMessage("Saved changes");
        }
        onRefresh();
        onClose();
      } catch (error) {
        console.error(error);
        setStatusMessage("Failed to save. Check console for details.");
      }
    });
  });

  const activeCodes = game?.codes.active ?? [];
  const checkCodes = game?.codes.check ?? [];
  const expiredCodes = game?.codes.expired ?? [];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full justify-end">
            <Transition.Child
              as={Fragment}
              enter="transform transition ease-out duration-200"
              enterFrom="translate-x-full"
              enterTo="translate-x-0"
              leave="transform transition ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="translate-x-full"
            >
              <Dialog.Panel className="h-full w-full max-w-3xl space-y-6 overflow-y-auto border-l border-border/60 bg-background p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-foreground">
                      {game ? `Edit ${game.name}` : "Create game"}
                    </Dialog.Title>
                    {statusMessage ? <p className="text-sm text-muted">{statusMessage}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-border/60 px-3 py-1 text-sm text-muted hover:text-foreground"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-muted">
                    {game ? `Last updated ${new Date(game.updated_at).toLocaleString()}` : "New game"}
                  </span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={defaultValues.is_published}
                      {...register("is_published", { setValueAs: (value) => Boolean(value) })}
                    />
                    <span>Published</span>
                  </label>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
                    {isPublished ? "Published" : "Draft"}
                  </span>
                </div>

                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setActiveTab("content")}
                    className={`rounded-lg px-3 py-2 font-semibold ${activeTab === "content" ? "bg-accent text-white" : "bg-surface text-muted"}`}
                  >
                    Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("meta")}
                    className={`rounded-lg px-3 py-2 font-semibold ${activeTab === "meta" ? "bg-accent text-white" : "bg-surface text-muted"}`}
                  >
                    Meta
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("codes")}
                    className={`rounded-lg px-3 py-2 font-semibold ${activeTab === "codes" ? "bg-accent text-white" : "bg-surface text-muted"}`}
                  >
                    Codes
                  </button>
                </div>

                <form className="space-y-6" onSubmit={onSubmit}>
                  {activeTab === "content" ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Name</label>
                          <input
                            type="text"
                            {...nameRegister}
                            onChange={(event) => {
                              nameManuallyEditedRef.current = true;
                              nameRegister.onChange(event);
                            }}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          {errors.name ? <p className="text-xs text-red-400">{errors.name.message}</p> : null}
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Slug</label>
                          <input
                            type="text"
                            {...slugRegister}
                            onChange={(event) => {
                              const value = event.target.value;
                              slugManuallyEditedRef.current = value.length > 0;
                              slugRegister.onChange(event);
                            }}
                            onBlur={(event) => {
                              slugRegister.onBlur(event);
                              const normalized = normalizeGameSlug(event.target.value || nameValue || "");
                              lastAutoSlugRef.current = normalized;
                              if (normalized !== event.target.value) {
                                setValue("slug", normalized, { shouldDirty: true });
                              }
                            }}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          {errors.slug ? <p className="text-xs text-red-400">{errors.slug.message}</p> : null}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground">Author</label>
                        <select
                          {...register("author_id")}
                          className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                        >
                          <option value="">Unassigned</option>
                          {authors.map((author) => (
                            <option key={author.id} value={author.id}>
                              {author.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="text-sm font-semibold text-foreground">Primary source URL</label>
                          <input
                            type="url"
                            {...register("source_url")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="https://"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Secondary source URL</label>
                          <input
                            type="url"
                            {...register("source_url_2")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="https://"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Tertiary source URL</label>
                          <input
                            type="url"
                            {...register("source_url_3")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="https://"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Import Markdown</label>
                        <label
                          onDragOver={onDragOver}
                          onDragLeave={onDragLeave}
                          onDrop={onDrop}
                          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-surface px-4 py-6 text-center text-sm transition hover:border-accent hover:text-accent ${isDragging ? "border-accent bg-accent/5" : ""}`}
                        >
                          <input type="file" accept="text/markdown,.md" className="hidden" onChange={onFileInputChange} />
                          <span className="font-semibold">Drag & Drop markdown</span>
                          <span className="text-xs text-muted">or click to upload a .md file</span>
                        </label>
                        {markdownError ? <p className="text-xs text-red-400">{markdownError}</p> : null}
                      </div>
                      <RichMarkdownEditor
                        label="Intro"
                        value={watch("intro_md") ?? ""}
                        onChange={(value) => setValue("intro_md", value, { shouldDirty: true })}
                      />
                      <RichMarkdownEditor
                        label="How to redeem"
                        value={watch("redeem_md") ?? ""}
                        onChange={(value) => setValue("redeem_md", value, { shouldDirty: true })}
                      />
                      <RichMarkdownEditor
                        label="Description"
                        value={watch("description_md") ?? ""}
                        onChange={(value) => setValue("description_md", value, { shouldDirty: true })}
                      />
                    </div>
                  ) : null}

                  {activeTab === "meta" ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-foreground">SEO title</label>
                          <input
                            type="text"
                            {...register("seo_title")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Cover image URL</label>
                          <input
                            type="url"
                            {...register("cover_image")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                            placeholder="https://"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground">SEO description</label>
                        <textarea
                          rows={4}
                          {...register("seo_description")}
                          className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                      </div>
                      {watch("cover_image") ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted">Preview</p>
                          <img
                            src={watch("cover_image") ?? ""}
                            alt="Cover preview"
                            className="max-h-48 w-full rounded-lg border border-border/60 object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {activeTab === "codes" ? (
                    <div className="space-y-6">
                      <CodesTab game={game} onRefresh={onRefresh} />
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function CodesTab({ game, onRefresh }: { game: AdminGameSummary | null; onRefresh: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [formState, setFormState] = useState({ status: "active" as "active" | "check" | "expired" });

  if (!game) {
    return <p className="text-sm text-muted">Save the game first to manage codes.</p>;
  }

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  const handleStatusChange = (id: string, status: "active" | "check" | "expired") => {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("status", status);
    formData.append("game_id", game.id);
    startTransition(async () => {
      await updateCodeStatus(formData);
      onRefresh();
    });
  };

  const handleDelete = (id: string) => {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("game_id", game.id);
    startTransition(async () => {
      await deleteCode(formData);
      onRefresh();
    });
  };

  const triggerRefresh = () => {
    if (!game) return;
    setFlash(null);
    setRefreshing(true);
    startTransition(async () => {
      try {
        const result = await refreshGameCodes(game.slug);
        if (!result?.success) {
          setFlash({ tone: "error", message: result?.error ?? "Failed to refresh codes." });
        } else {
          const parts = [];
          if (typeof result.upserted === "number") parts.push(`${result.upserted} updated`);
          if (typeof result.removed === "number" && result.removed > 0) parts.push(`${result.removed} removed`);
          const message = parts.length ? `Codes refreshed (${parts.join(", ")}).` : "Codes refreshed.";
          setFlash({ tone: "success", message });
          onRefresh();
        }
      } catch (error) {
        setFlash({ tone: "error", message: error instanceof Error ? error.message : "Failed to refresh codes." });
      } finally {
        setRefreshing(false);
      }
    });
  };

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.append("game_id", game.id);
    startTransition(async () => {
      await upsertGameCode(formData);
      form.reset();
      setFormState({ status: "active" });
      onRefresh();
    });
  };

  return (
    <div className="space-y-6">
      {flash ? (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            flash.tone === "success"
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
              : "border-red-400/60 bg-red-500/10 text-red-100"
          }`}
        >
          {flash.message}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Manage codes</h3>
        <button
          type="button"
          onClick={triggerRefresh}
          disabled={refreshing || isPending}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/30 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={refreshing ? "animate-spin" : ""}>↻</span>
          <span>{refreshing ? "Refreshing…" : "Refresh codes"}</span>
        </button>
      </div>

      <form className="rounded-lg border border-border/60 bg-surface px-4 py-4 text-sm" onSubmit={handleAdd}>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Add manual code</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            name="code"
            placeholder="CODE123"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
            required
          />
          <input
            name="rewards_text"
            placeholder="Reward"
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          />
          <select
            name="status"
            value={formState.status}
            onChange={(event) => setFormState({ status: event.target.value as typeof formState.status })}
            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="check">Needs check</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add code"}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <CodeList
          title="Active codes"
          codes={game.codes.active}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
        <CodeList
          title="Codes to double-check"
          codes={game.codes.check}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Expired codes ({game.codes.expired.length})</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {game.codes.expired.length ? game.codes.expired.map((code) => (
              <span key={code} className="rounded-full border border-border/40 bg-surface-muted px-3 py-1">
                {code}
              </span>
            )) : <span>No expired codes tracked.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

type CodeListProps = {
  title: string;
  codes: AdminGameSummary["codes"]["active"];
  onStatusChange: (id: string, status: "active" | "check" | "expired") => void;
  onDelete: (id: string) => void;
};

function CodeList({ title, codes, onStatusChange, onDelete }: CodeListProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title} ({codes.length})</h3>
      <div className="mt-2 space-y-2">
        {codes.map((code) => (
          <div key={code.id} className="grid gap-2 rounded-lg border border-border/60 bg-surface px-3 py-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="font-semibold text-foreground">{code.code}</p>
              <p className="text-xs text-muted">{code.rewards_text ?? "No reward"}</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <select
                defaultValue={code.status}
                onChange={(event) => onStatusChange(code.id, event.target.value as "active" | "check" | "expired")}
                className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs"
              >
                <option value="active">Active</option>
                <option value="check">Needs check</option>
                <option value="expired">Expired</option>
              </select>
              <button
                type="button"
                onClick={() => onDelete(code.id)}
                className="rounded-lg border border-border/60 px-2 py-1 text-xs text-muted hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {codes.length === 0 ? <p className="text-xs text-muted">Nothing here yet.</p> : null}
      </div>
    </div>
  );
}
