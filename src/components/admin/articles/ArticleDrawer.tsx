"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent
} from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminArticleSummary, AdminArticleCategoryOption } from "@/lib/admin/articles";
import type { AdminAuthorOption } from "@/lib/admin/games";
import { RichMarkdownEditor } from "@/components/admin/editor/RichMarkdownEditor";
import { saveArticle, deleteArticle, uploadArticleAsset } from "@/app/admin/(dashboard)/articles/actions";
import { slugify } from "@/lib/slug";
import Link from "next/link";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  content_md: z.string().min(1, "Content is required"),
  cover_image: z
    .string()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
  author_id: z.string().optional(),
  category_id: z.string().optional(),
  meta_description: z.string().optional(),
  is_published: z.boolean().optional()
});

type FormValues = z.infer<typeof formSchema>;

type TabKey = "content" | "meta";

interface ArticleDrawerProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  article: AdminArticleSummary | null;
  authors: AdminAuthorOption[];
  categories: AdminArticleCategoryOption[];
}

function extractError(value: unknown): string | null {
  if (value && typeof value === "object" && "error" in value) {
    const message = (value as { error?: string | null }).error;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return null;
}

export function ArticleDrawer({ open, onClose, onRefresh, article, authors, categories }: ArticleDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("content");
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [isMarkdownDragging, setIsMarkdownDragging] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [isCoverDragging, setIsCoverDragging] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; title: string }>>([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryCopyMessage, setGalleryCopyMessage] = useState<string | null>(null);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);

  const defaultValues = useMemo<FormValues>(() => ({
    id: article?.id,
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    content_md: article?.content_md ?? "",
    cover_image: article?.cover_image ?? "",
    author_id: article?.author.id ?? "",
    category_id: article?.category.id ?? "",
    meta_description: article?.meta_description ?? "",
    is_published: article?.is_published ?? false
  }), [article]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    control,
    formState: { errors, isDirty }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  const titleValue = watch("title");
  const slugValue = watch("slug");
  const coverValue = watch("cover_image");
  const contentValue = watch("content_md") ?? "";
  const isPublished = watch("is_published");
  const uploadSlug = useMemo(() => slugify(slugValue || titleValue || "article"), [slugValue, titleValue]);

  const confirmClose = useUnsavedChangesWarning(open && isDirty, "You have unsaved changes. Leave without saving?");

  const requestClose = useCallback(() => {
    if (!confirmClose()) return;
    reset(defaultValues, { keepDirty: false, keepDirtyValues: false });
    onClose();
  }, [confirmClose, reset, defaultValues, onClose]);

  const closeAfterSave = useCallback(
    (values?: FormValues) => {
      if (values) {
        reset(values, { keepDirty: false, keepDirtyValues: false });
      } else {
        reset(defaultValues, { keepDirty: false, keepDirtyValues: false });
      }
      onClose();
    },
    [defaultValues, onClose, reset]
  );

  useEffect(() => {
    reset(defaultValues, { keepDirty: false, keepDirtyValues: false });
    setActiveTab("content");
    setStatusMessage(null);
    setMarkdownError(null);
    setIsMarkdownDragging(false);
    setCoverError(null);
    setIsCoverDragging(false);
    setCoverUploading(false);
    setGalleryImages([]);
    setGalleryError(null);
    setGalleryUploading(false);
    setGalleryCopyMessage(null);
    setIsGalleryDragging(false);
  }, [defaultValues, reset, open]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!galleryCopyMessage) return;
    const timer = setTimeout(() => setGalleryCopyMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [galleryCopyMessage]);

  const handleMarkdownFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const text = await file.text();
        const current = getValues("content_md");
        if (current === text) return;
        setValue("content_md", text, { shouldDirty: true });
        setMarkdownError(null);
      } catch (error) {
        setMarkdownError(error instanceof Error ? error.message : "Failed to read markdown file.");
      }
    },
    [getValues, setValue]
  );

  const onMarkdownInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void handleMarkdownFile(file);
      event.target.value = "";
    },
    [handleMarkdownFile]
  );

  const onMarkdownDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsMarkdownDragging(true);
  }, []);

  const onMarkdownDragLeave = useCallback(() => {
    setIsMarkdownDragging(false);
  }, []);

  const onMarkdownDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsMarkdownDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      void handleMarkdownFile(file);
    },
    [handleMarkdownFile]
  );

  const handleCoverFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setCoverError("Please upload an image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setCoverError("Image must be under 10MB.");
        return;
      }
      setCoverUploading(true);
      setCoverError(null);
      try {
        const uploadData = new FormData();
        uploadData.append("file", file);
        uploadData.append("slug", uploadSlug || "article");
        const result = await uploadArticleAsset(uploadData);
        if (!result?.success) {
          const message = extractError(result);
          setCoverError(message ?? "Upload failed. Please try again.");
          return;
        }
        if ("url" in result && result.url) {
          if (getValues("cover_image") !== result.url) {
            setValue("cover_image", result.url, { shouldDirty: true });
          }
        }
      } catch (error) {
        setCoverError(error instanceof Error ? error.message : "Upload failed. Please try again.");
      } finally {
        setCoverUploading(false);
      }
    },
    [getValues, setValue, uploadSlug]
  );

  const onCoverInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void handleCoverFile(file);
      event.target.value = "";
    },
    [handleCoverFile]
  );

  const onCoverDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsCoverDragging(true);
  }, []);

  const onCoverDragLeave = useCallback(() => {
    setIsCoverDragging(false);
  }, []);

  const onCoverDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsCoverDragging(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      void handleCoverFile(file);
    },
    [handleCoverFile]
  );

  const deriveImageTitle = useCallback((fileName: string) => {
    const base = fileName.replace(/\.[^/.]+$/, "");
    const cleaned = base.replace(/[-_]+/g, " ").trim();
    if (!cleaned) return "Article image";
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const handleGalleryFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      setGalleryError(null);
      setGalleryUploading(true);
      const uploaded: Array<{ url: string; title: string }> = [];
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) {
            setGalleryError("Only image files are supported.");
            continue;
          }
          if (file.size > 10 * 1024 * 1024) {
            setGalleryError("Each image must be under 10MB.");
            continue;
          }
          const uploadData = new FormData();
          uploadData.append("file", file);
          uploadData.append("slug", uploadSlug || "article");
          const result = await uploadArticleAsset(uploadData);
          if (!result?.success) {
            const message = extractError(result);
            setGalleryError(message ?? "Failed to upload image.");
            continue;
          }
          if ("url" in result && result.url) {
            uploaded.push({ url: result.url, title: deriveImageTitle(file.name) });
          }
        }
      } catch (error) {
        setGalleryError(error instanceof Error ? error.message : "Failed to upload images.");
      } finally {
        setGalleryUploading(false);
        if (uploaded.length) {
          setGalleryImages((prev) => [...uploaded, ...prev]);
        }
      }
    },
    [deriveImageTitle, uploadSlug]
  );

  const onGalleryInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      void handleGalleryFiles(files);
      event.target.value = "";
    },
    [handleGalleryFiles]
  );

  const onGalleryDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsGalleryDragging(true);
  }, []);

  const onGalleryDragLeave = useCallback(() => {
    setIsGalleryDragging(false);
  }, []);

  const onGalleryDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsGalleryDragging(false);
      const files = event.dataTransfer.files;
      void handleGalleryFiles(files);
    },
    [handleGalleryFiles]
  );

  const copyMarkdown = useCallback(async (markdown: string) => {
    try {
      await navigator.clipboard.writeText(markdown);
      setGalleryCopyMessage("Markdown copied to clipboard");
    } catch (error) {
      setGalleryCopyMessage(error instanceof Error ? error.message : "Failed to copy markdown");
    }
  }, []);

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, rawValue]) => {
      if (rawValue === undefined) return;
      formData.append(key, String(rawValue));
    });
    formData.set("is_published", values.is_published ? "true" : "false");
    startTransition(async () => {
      try {
        const result = await saveArticle(formData);
        if (!result || result.success !== true) {
          const message = extractError(result);
          setStatusMessage({ tone: "error", text: message ?? "Failed to save article." });
          return;
        }
        setStatusMessage({ tone: "success", text: "Article saved." });
        onRefresh();
        closeAfterSave(values);
      } catch (error) {
        setStatusMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to save article."
        });
      }
    });
  });

  function handleDelete() {
    if (!article?.id) return;
    const shouldDelete = window.confirm(`Delete article "${article.title}"?`);
    if (!shouldDelete) return;
    const formData = new FormData();
    formData.set("id", article.id);
    startTransition(async () => {
      try {
        const result = await deleteArticle(formData);
        if (!result || result.success !== true) {
          const message = extractError(result);
          setStatusMessage({ tone: "error", text: message ?? "Failed to delete article." });
          return;
        }
        setStatusMessage({ tone: "success", text: "Article deleted." });
        onRefresh();
        closeAfterSave();
      } catch (error) {
        setStatusMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to delete article."
        });
      }
    });
  }

  const lastUpdatedLabel = article ? `Last updated ${new Date(article.updated_at).toLocaleString()}` : "New article";
  const viewUrl = article ? `/${article.slug}` : null;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={requestClose} className="relative z-50">
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
                      {article ? `Edit ${article.title}` : "Create article"}
                    </Dialog.Title>
                    {statusMessage?.tone === "success" ? (
                      <p className="text-sm text-emerald-400">{statusMessage.text}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="rounded-full border border-border/60 px-3 py-1 text-sm text-muted hover:text-foreground"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-muted">{lastUpdatedLabel}</span>
                  {article?.author.name ? (
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
                      {article.author.name}
                    </span>
                  ) : null}
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
                </div>

                {statusMessage && statusMessage.tone === "error" ? (
                  <div className="rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                    {statusMessage.text}
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="space-y-6">
                  {activeTab === "content" ? (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground" htmlFor="article-title">
                          Title
                        </label>
                        <input
                          id="article-title"
                          type="text"
                          {...register("title")}
                          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                        {errors.title ? <p className="text-xs text-destructive">{errors.title.message}</p> : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground" htmlFor="article-slug">
                          Slug
                        </label>
                        <input
                          id="article-slug"
                          type="text"
                          placeholder={titleValue ? slugify(titleValue) : ""}
                          {...register("slug")}
                          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                        {errors.slug ? <p className="text-xs text-destructive">{errors.slug.message}</p> : null}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground" htmlFor="article-cover">
                          Cover image
                        </label>
                        <input
                          id="article-cover"
                          type="url"
                          {...register("cover_image")}
                          placeholder="Paste a URL or upload below"
                          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                        <label
                          onDragOver={onCoverDragOver}
                          onDragLeave={onCoverDragLeave}
                          onDrop={onCoverDrop}
                          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-xs transition ${
                            isCoverDragging ? "border-accent bg-accent/10 text-accent" : "border-border/60 text-muted"
                          }`}
                        >
                          <input type="file" accept="image/*" onChange={onCoverInputChange} className="hidden" />
                          <span className="font-semibold">Drag & drop cover image</span>
                          <span>or click to upload (max 10MB)</span>
                          {coverUploading ? <span className="text-xs text-muted">Uploading...</span> : null}
                        </label>
                        {coverError ? <p className="text-xs text-destructive">{coverError}</p> : null}
                        {errors.cover_image ? <p className="text-xs text-destructive">{errors.cover_image.message}</p> : null}
                        {coverValue ? (
                          <div className="overflow-hidden rounded-lg border border-border/60">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={coverValue} alt="Cover preview" className="h-32 w-full object-cover" />
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-foreground" htmlFor="article-author">
                            Author
                          </label>
                          <select
                            id="article-author"
                            {...register("author_id")}
                            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                          >
                            <option value="">Unassigned</option>
                            {authors.map((authorOption) => (
                              <option key={authorOption.id} value={authorOption.id}>
                                {authorOption.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-foreground" htmlFor="article-category">
                            Category
                          </label>
                          <select
                            id="article-category"
                            {...register("category_id")}
                            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                          >
                            <option value="">None</option>
                            {categories.map((categoryOption) => (
                              <option key={categoryOption.id} value={categoryOption.id}>
                                {categoryOption.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <RichMarkdownEditor
                          label="Markdown content"
                          value={contentValue}
                          onChange={(value) => {
                            if (getValues("content_md") === value) return;
                            setValue("content_md", value, { shouldDirty: true });
                          }}
                        />
                        <label
                          onDragOver={onMarkdownDragOver}
                          onDragLeave={onMarkdownDragLeave}
                          onDrop={onMarkdownDrop}
                          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-xs transition ${
                            isMarkdownDragging ? "border-accent bg-accent/10 text-accent" : "border-border/60 text-muted"
                          }`}
                        >
                          <input type="file" accept="text/markdown,.md" onChange={onMarkdownInputChange} className="hidden" />
                          <span className="font-semibold">Drag & drop markdown</span>
                          <span>or click to upload a .md file</span>
                        </label>
                        {markdownError ? <p className="text-xs text-destructive">{markdownError}</p> : null}
                        {errors.content_md ? <p className="text-xs text-destructive">{errors.content_md.message}</p> : null}
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-foreground">Article images</label>
                        <label
                          onDragOver={onGalleryDragOver}
                          onDragLeave={onGalleryDragLeave}
                          onDrop={onGalleryDrop}
                          className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-xs transition ${
                            isGalleryDragging ? "border-accent bg-accent/10 text-accent" : "border-border/60 text-muted"
                          }`}
                        >
                          <input type="file" accept="image/*" multiple onChange={onGalleryInputChange} className="hidden" />
                          <span className="font-semibold">Drag & drop images</span>
                          <span>or click to upload (max 10MB each)</span>
                          {galleryUploading ? <span className="text-xs text-muted">Uploading...</span> : null}
                        </label>
                        {galleryError ? <p className="text-xs text-destructive">{galleryError}</p> : null}
                        {galleryCopyMessage ? <p className="text-xs text-accent">{galleryCopyMessage}</p> : null}
                        {galleryImages.length ? (
                          <div className="grid gap-3">
                            {galleryImages.map((image) => {
                              const markdown = `![${image.title || "Article image"}](${image.url})`;
                              return (
                                <div key={image.url} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={image.url} alt={image.title} className="h-16 w-16 rounded object-cover" />
                                  <div className="flex-1 text-xs text-muted">
                                    <p className="font-semibold text-foreground">{image.title}</p>
                                    <p className="truncate">{image.url}</p>
                                    <button
                                      type="button"
                                      onClick={() => copyMarkdown(markdown)}
                                      className="mt-2 inline-flex items-center rounded border border-border/60 px-2 py-1 text-[11px] font-semibold text-foreground transition hover:border-border/40 hover:bg-surface"
                                    >
                                      Copy markdown
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "meta" ? (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground" htmlFor="article-meta-description">
                          Meta description
                        </label>
                        <textarea
                          id="article-meta-description"
                          rows={3}
                          {...register("meta_description")}
                          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Controller
                        name="is_published"
                        control={control}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-foreground">
                            <input
                              type="checkbox"
                              checked={Boolean(field.value)}
                              onChange={(event) => field.onChange(event.target.checked)}
                              className="h-4 w-4 rounded border-border/60 bg-background"
                            />
                            Publish immediately
                          </label>
                        )}
                      />
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
                        {isPublished ? "Published" : "Draft"}
                      </span>
                      {article ? (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isPending}
                          className="rounded-lg border border-destructive/60 px-3 py-1 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10 disabled:opacity-60"
                        >
                          Delete article
                        </button>
                      ) : null}
                      {viewUrl ? (
                        <Link
                          href={viewUrl}
                          className="text-xs text-accent underline-offset-2 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View live page
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={requestClose}
                        className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Saving..." : article ? "Save changes" : "Create article"}
                      </button>
                    </div>
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
