// A tiny signal: "something the person owns changed on this phone".
// The sync service listens and uploads soon after; stores just call markChanged().

const listeners = new Set<() => void>()

export function markChanged() {
  for (const l of listeners) l()
}

export function onChange(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
