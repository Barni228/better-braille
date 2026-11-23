// Main-thread client for the liblouis worker. liblouis is loaded on first use.

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

let worker: Worker | undefined
let ready: Promise<string> | undefined
let nextId = 1
const pending = new Map<number, Pending>()

function call<T>(message: object, transfer: Transferable[] = []): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject })
    worker!.postMessage({ id, ...message }, transfer)
  })
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`)
  return res
}

/** Loads liblouis (once) and resolves with its version. */
function start(): Promise<string> {
  ready ??= (async () => {
    const base = `${import.meta.env.BASE_URL}liblouis/`
    const manifest = (await (await fetchOk(`${base}manifest.json`)).json()) as { tables: string[] }
    const [build, ...tables] = await Promise.all([
      fetchOk(`${base}liblouis.js`).then((r) => r.text()),
      ...manifest.tables.map((name) => fetchOk(`${base}tables/${name}`).then((r) => r.arrayBuffer())),
    ])

    worker = new Worker(new URL('./louis.worker.ts', import.meta.url))
    worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data
      const request = pending.get(id)
      if (!request) return
      pending.delete(id)
      if (ok) request.resolve(result)
      else request.reject(new Error(error))
    }
    worker.onerror = (event) => {
      for (const request of pending.values()) request.reject(new Error(event.message || 'liblouis worker crashed'))
      pending.clear()
    }

    const files = manifest.tables.map((name, i) => ({ name, data: tables[i] as ArrayBuffer }))
    return call<string>({ type: 'init', build, tables: files }, files.map((f) => f.data))
  })()
  ready.catch(() => {
    // Let the next call try again (e.g. after coming back online).
    worker?.terminate()
    worker = undefined
    ready = undefined
  })
  return ready
}

/** Translates print paragraphs to Unicode braille with a liblouis table (e.g. "en-ueb-g2.ctb"). */
export async function translate(table: string, paragraphs: string[]): Promise<{ braille: string[]; version: string }> {
  const version = await start()
  return { braille: await call<string[]>({ type: 'translate', table, paragraphs }), version }
}
