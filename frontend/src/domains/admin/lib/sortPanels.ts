/** Existing panels A–Я; rows created during this page session stay above them. */
export function sortPanels<T>(
 items: readonly T[],
 name: (item: T) => string,
 createdAt: (item: T) => string,
 sessionStartedAt: number,
): T[] {
 return [...items].sort((a, b) => {
  const aTime = Date.parse(createdAt(a)) || 0;
  const bTime = Date.parse(createdAt(b)) || 0;
  const aNew = aTime >= sessionStartedAt;
  const bNew = bTime >= sessionStartedAt;
  if (aNew !== bNew) return aNew ? -1 : 1;
  if (aNew) return bTime - aTime;
  return name(a).trim().localeCompare(name(b).trim(), 'ru', { sensitivity: 'base', numeric: true });
 });
}
