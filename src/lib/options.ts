export type Option<T> = { value: T; label: string }

/** Turns a label map like { 1: 'Lounge' } into chip options. */
export function optionsFrom<K extends string | number>(labels: Record<K, string>, numeric = false): Option<K>[] {
  return Object.entries(labels).map(([k, label]) => ({ value: (numeric ? Number(k) : k) as K, label: label as string }))
}
