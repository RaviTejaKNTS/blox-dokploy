"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { listMediaEntries, uploadMedia, deleteMediaObject } from "@/app/admin/(dashboard)/media/actions";
import type { MediaListing } from "@/app/admin/(dashboard)/media/page";

type MediaClientProps = {
  bucket: string;
  publicBaseUrl: string;
  initialListing: MediaListing;
};

type UploadState = "idle" | "uploading";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function breadcrumbSegments(path: string) {
  if (!path) return [];
  const segments = path.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: segment,
    path: segments.slice(0, index + 1).join("/")
  }));
}

export function MediaClient({ initialListing }: MediaClientProps) {
  const [listing, setListing] = useState<MediaListing>(initialListing);
  const [currentPath, setCurrentPath] = useState(initialListing.path);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [isNavigating, startNavigation] = useTransition();

  const breadcrumbs = useMemo(() => breadcrumbSegments(currentPath), [currentPath]);

  const totalFiles = listing.files.length;
  const totalFolders = listing.folders.length;

  const refreshPath = (path: string) => {
    startNavigation(async () => {
      try {
        setError(null);
        const data = await listMediaEntries(path);
        setListing(data);
        setCurrentPath(data.path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load media.");
      }
    });
  };

  const navigateToFolder = (path: string) => {
    refreshPath(path);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    refreshPath(segments.join("/"));
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadState("uploading");
    setStatusMessage(null);
    setError(null);
    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", currentPath);
        const result = await uploadMedia(formData);
        if (!result.success) {
          setError(result.error ?? "Upload failed.");
          break;
        }
      }
      refreshPath(currentPath);
      setStatusMessage("Upload complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadState("idle");
    }
  };

  const handleDelete = async (path: string) => {
    const confirmDelete = window.confirm("Delete this file? This action cannot be undone.");
    if (!confirmDelete) return;
    setError(null);
    setStatusMessage(null);
    startNavigation(async () => {
      const result = await deleteMediaObject(path);
      if (!result.success) {
        setError(result.error ?? "Failed to delete file.");
      } else {
        setStatusMessage("File deleted.");
        const data = await listMediaEntries(currentPath);
        setListing(data);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <button
            type="button"
            onClick={() => refreshPath("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${currentPath ? "bg-surface border border-border/60 text-foreground" : "bg-foreground text-background"}`}
          >
            Root
          </button>
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.path}
              type="button"
              onClick={() => navigateToFolder(crumb.path)}
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold text-foreground hover:border-accent hover:text-accent"
            >
              {crumb.label}
            </button>
          ))}
          <span className="text-xs text-muted">
            {isNavigating ? "Loading…" : `Folders ${totalFolders} · Files ${totalFiles}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={navigateUp}
            disabled={!currentPath || isNavigating}
            className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/30 hover:bg-surface disabled:opacity-60"
          >
            Up one level
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-xs font-semibold text-foreground">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                void handleUpload(files);
                event.target.value = "";
              }}
            />
            {uploadState === "uploading" ? "Uploading…" : "Upload images"}
          </label>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-lg border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          {statusMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/60">
        <table className="min-w-full divide-y divide-border/60 text-sm">
          <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Preview</th>
              <th className="px-4 py-3 text-right">Size</th>
              <th className="px-4 py-3 text-left">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {listing.folders.map((folder) => (
              <tr key={`folder-${folder.path}`} className="hover:bg-surface-muted/40">
                <td className="px-4 py-3 font-semibold text-foreground">
                  <button
                    type="button"
                    onClick={() => navigateToFolder(folder.path)}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {folder.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-muted">Folder</td>
                <td className="px-4 py-3 text-right text-muted">—</td>
                <td className="px-4 py-3 text-muted">—</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => navigateToFolder(folder.path)}
                    className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold text-foreground transition hover:border-border/40 hover:bg-surface-muted"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {listing.files.map((file) => {
              const publicUrl = file.public_url;
              const updatedLabel = file.updated_at
                ? `${format(new Date(file.updated_at), "LLL d, yyyy HH:mm")} (${formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })})`
                : "—";
              return (
                <tr key={`file-${file.path}`} className="hover:bg-surface-muted/40">
                  <td className="px-4 py-3 text-foreground">{file.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-4">
                      <div className="relative h-32 w-48 overflow-hidden rounded-lg border border-border/60 bg-surface-muted">
                        <img
                          src={publicUrl}
                          alt={file.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <Link
                        href={publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        View original
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">{formatBytes(file.size)}</td>
                  <td className="px-4 py-3 text-muted">{updatedLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(file.path)}
                      className="rounded-lg border border-destructive/60 px-3 py-1 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {listing.folders.length === 0 && listing.files.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  This folder is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
