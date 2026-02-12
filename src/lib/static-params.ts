export function buildPageParams(totalPages: number, startPage = 1, maxPages?: number): Array<{ page: string }> {
  const safeTotal = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
  const safeStart = Number.isFinite(startPage) ? Math.max(1, Math.floor(startPage)) : 1;
  const safeMax = Number.isFinite(maxPages ?? NaN) ? Math.max(1, Math.floor(maxPages as number)) : null;

  if (safeStart > safeTotal) return [];

  const endPage = safeMax ? Math.min(safeTotal, safeStart + safeMax - 1) : safeTotal;
  const pageParams: Array<{ page: string }> = [];
  for (let page = safeStart; page <= endPage; page += 1) {
    pageParams.push({ page: String(page) });
  }

  return pageParams;
}

export function splitPathToSlug(path: string): string[] {
  return path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}
