export type MusicSortKey =
  | "recommended"
  | "popular"
  | "newest"
  | "duration_desc"
  | "duration_asc"
  | "title_asc"
  | "artist_asc";

export type MusicSortOption = {
  value: MusicSortKey;
  label: string;
};

export type MusicSearchState = {
  query: string;
  sort: MusicSortKey;
};

export const DEFAULT_SORT: MusicSortKey = "recommended";

export const SORT_OPTIONS: MusicSortOption[] = [
  { value: "recommended", label: "Recommended" },
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "duration_desc", label: "Longest" },
  { value: "duration_asc", label: "Shortest" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "artist_asc", label: "Artist A-Z" }
];

export function normalizeSearchQuery(value?: string | null): string {
  if (!value) return "";
  return value.trim().slice(0, 80);
}

export function normalizeSortKey(value?: string | null): MusicSortKey {
  if (!value) return DEFAULT_SORT;
  const match = SORT_OPTIONS.find((option) => option.value === value);
  return match ? match.value : DEFAULT_SORT;
}

export function buildSearchQueryString(state: MusicSearchState): string {
  const params = new URLSearchParams();
  if (state.query) {
    params.set("q", state.query);
  }
  if (state.sort !== DEFAULT_SORT) {
    params.set("sort", state.sort);
  }
  return params.toString();
}
