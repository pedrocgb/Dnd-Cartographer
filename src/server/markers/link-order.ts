/** Ordering rules for a marker's article links, kept free of the DB so they can be unit-tested. */
type Orderable = { isPrimary: boolean; createdAt: Date; id: string };

/** Primary first, then oldest first — the order every marker article list shows. */
export function orderLinks<T extends Orderable>(links: T[]): T[] {
  return [...links].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
}

/** The link that becomes primary once the primary one is removed: the oldest one left, or none. */
export function promotedAfterRemoval<T extends Orderable>(remaining: T[]): T | null {
  if (remaining.some((l) => l.isPrimary)) return null;
  return orderLinks(remaining)[0] ?? null;
}
