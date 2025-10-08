"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { AdminCategorySummary } from "@/lib/admin/categories";
import { saveArticleCategory, deleteArticleCategory } from "@/app/admin/(dashboard)/article-categories/actions";
import Link from "next/link";
import { slugify } from "@/lib/slug";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  description: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  category: AdminCategorySummary | null;
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

export function CategoryDrawer({ open, onClose, onRefresh, category }: CategoryDrawerProps) {
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo<FormValues>(() => ({
    id: category?.id,
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    description: category?.description ?? ""
  }), [category]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

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
    setStatusMessage(null);
  }, [defaultValues, reset, open]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, rawValue]) => {
      if (rawValue === undefined) return;
      formData.append(key, String(rawValue));
    });
    startTransition(async () => {
      try {
        const result = await saveArticleCategory(formData);
        if (!result || result.success !== true) {
          const message = extractError(result);
          setStatusMessage({ tone: "error", text: message ?? "Failed to save category." });
          return;
        }
        setStatusMessage({ tone: "success", text: "Category saved." });
        onRefresh();
        closeAfterSave(values);
      } catch (error) {
        setStatusMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to save category."
        });
      }
    });
  });

  function handleDelete() {
    if (!category?.id) return;
    const confirmed = window.confirm(`Delete category "${category.name}"?`);
    if (!confirmed) return;
    const formData = new FormData();
    formData.set("id", category.id);
    startTransition(async () => {
      try {
        const result = await deleteArticleCategory(formData);
        if (!result || result.success !== true) {
          const message = extractError(result);
          setStatusMessage({ tone: "error", text: message ?? "Failed to delete category." });
          return;
        }
        setStatusMessage({ tone: "success", text: "Category deleted." });
        onRefresh();
        closeAfterSave();
      } catch (error) {
        setStatusMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Failed to delete category."
        });
      }
    });
  }

  const viewUrl = category ? `/articles/category/${category.slug}` : null;
  const lastUpdatedLabel = category ? `Last updated ${new Date(category.updated_at).toLocaleString()}` : "New category";

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
              <Dialog.Panel className="h-full w-full max-w-2xl space-y-6 overflow-y-auto border-l border-border/60 bg-background p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-foreground">
                      {category ? `Edit ${category.name}` : "Create category"}
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
                  {category?.article_count ? (
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase text-accent">
                      {category.article_count} articles
                    </span>
                  ) : null}
                </div>

                {statusMessage && statusMessage.tone === "error" ? (
                  <div className="rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                    {statusMessage.text}
                  </div>
                ) : null}

                <form onSubmit={onSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground" htmlFor="category-name">
                      Name
                    </label>
                    <input
                      id="category-name"
                      type="text"
                      {...register("name")}
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground" htmlFor="category-slug">
                      Slug
                    </label>
                    <input
                      id="category-slug"
                      type="text"
                      placeholder={defaultValues.name ? slugify(defaultValues.name) : ""}
                      {...register("slug")}
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    {errors.slug ? <p className="text-xs text-destructive">{errors.slug.message}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground" htmlFor="category-description">
                      Description
                    </label>
                    <textarea
                      id="category-description"
                      rows={4}
                      {...register("description")}
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {category ? (
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isPending}
                          className="rounded-lg border border-destructive/60 px-3 py-1 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10 disabled:opacity-60"
                        >
                          Delete category
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
                        {isPending ? "Saving..." : category ? "Save changes" : "Create category"}
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
