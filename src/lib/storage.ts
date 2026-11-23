// Saves work in this browser only. Storage can be unavailable (private windows, blocked site
// data), so every access is guarded and the app works without it.
const PREFIX = 'better-braille:'

export function load(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Not saved; nothing else to do.
  }
}
