"use client";

import { Fragment, useEffect, useMemo, useState, useTransition, FormEvent } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RichMarkdownEditor } from "@/components/admin/editor/RichMarkdownEditor";
import type { AdminAuthorOption, AdminGameSummary } from "@/lib/admin/games";
import { saveGame, upsertGameCode, updateCodeStatus, deleteCode } from "@/app/admin/(dashboard)/games/actions";

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  useEffect(() => {
    reset(defaultValues);
    setActiveTab("content");
    setStatusMessage(null);
  }, [defaultValues, reset, open]);

  const nameValue = watch("name");
  const slugValue = watch("slug");

  useEffect(() => {
    if (!game && nameValue && !slugValue) {
      setValue("slug", slugify(nameValue));
    }
  }, [game, nameValue, slugValue, setValue]);

  const isPublished = watch("is_published");

  const onSubmit = handleSubmit((values) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, raw]) => {
      if (raw === undefined) return;
      if (raw === null) return;
      formData.append(key, String(raw));
    });
    formData.set("is_published", values.is_published ? "true" : "false");
    startTransition(async () => {
      try {
        await saveGame(formData);
        setStatusMessage("Saved changes");
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
                            {...register("name")}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                          />
                          {errors.name ? <p className="text-xs text-red-400">{errors.name.message}</p> : null}
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-foreground">Slug</label>
                          <input
                            type="text"
                            {...register("slug")}
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
  const [formState, setFormState] = useState({ status: "active" as "active" | "check" | "expired" });

  if (!game) {
    return <p className="text-sm text-muted">Save the game first to manage codes.</p>;
  }

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
