export function ExpiredCodes({ codes }: { codes: string[] }) {
  const listId = "expired-codes-list";

  const sorted = [...codes];

  return (
    <div className="space-y-3">
      <ul
        id={listId}
        className="mt-3 grid grid-cols-2 gap-2 text-xs text-foreground sm:grid-cols-3 md:grid-cols-4"
      >
        {sorted.map((code) => (
          <li key={code} className="rounded-full border border-border/40 bg-surface-muted/70 px-3 py-1 text-center font-medium text-foreground">
            <code>{code}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
