export type ContentDateSource = {
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  content_updated_at?: string | null;
};

export function resolvePublishedAt(source: ContentDateSource): string | null {
  return source.published_at ?? source.created_at ?? null;
}

export function resolveModifiedAt(source: ContentDateSource): string | null {
  return source.content_updated_at ?? source.updated_at ?? source.published_at ?? source.created_at ?? null;
}
