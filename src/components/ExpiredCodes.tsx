export function ExpiredCodes({ codes }: { codes: string[] }) {
  const listId = "expired-codes-list";

  const sorted = [...codes];

  return (
    <div className="space-y-3">
      <ul
        id={listId}
        className="mt-3 flex flex-wrap items-center gap-2 text-sm text-foreground"
      >
        {sorted.map((code, index) => (
          <li key={code} className="flex items-center text-foreground">
            <code className="font-medium">{code}</code>
            {index < sorted.length - 1 ? <span className="mx-2 text-border/80">|</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
