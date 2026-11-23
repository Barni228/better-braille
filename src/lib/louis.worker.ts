// Runs liblouis (the C library compiled to WebAssembly by scripts/build-liblouis.sh) off the
// main thread. The main thread fetches the build and tables, so they go through the service
// worker cache and work offline.

declare function importScripts(...urls: string[]): void

interface LiblouisModule {
  FS: {
    mkdir(path: string): void
    writeFile(path: string, data: Uint8Array, opts: { encoding: 'binary' }): void
  }
  ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): unknown
  _malloc(bytes: number): number
  _free(ptr: number): void
  stringToUTF16(text: string, ptr: number, maxBytes: number): void
  setValue(ptr: number, value: number, type: string): void
  getValue(ptr: number, type: string): number
  HEAPU16: Uint16Array
}

type Request =
  | { id: number; type: 'init'; build: string; tables: { name: string; data: ArrayBuffer }[] }
  | { id: number; type: 'translate'; table: string; paragraphs: string[] }

let lou: LiblouisModule | undefined
const utf16 = new TextDecoder('utf-16le')

async function init(build: string, tables: { name: string; data: ArrayBuffer }[]): Promise<string> {
  const url = URL.createObjectURL(new Blob([build], { type: 'text/javascript' }))
  importScripts(url)
  URL.revokeObjectURL(url)
  const scope = self as unknown as { createLiblouis?: () => Promise<LiblouisModule> }
  if (!scope.createLiblouis) throw new Error('liblouis.js did not load')
  lou = await scope.createLiblouis()
  // Tables are referenced as tables/<name>, relative to the virtual filesystem's root.
  lou.FS.mkdir('/tables')
  for (const t of tables) lou.FS.writeFile(`/tables/${t.name}`, new Uint8Array(t.data), { encoding: 'binary' })
  return String(lou.ccall('lou_version', 'string', [], []))
}

function translateString(m: LiblouisModule, tableList: string, text: string): string {
  if (!text) return ''
  const n = text.length
  // Braille is often longer than print (capital and number signs), so start with room to
  // spare and retry with more if liblouis couldn't fit the whole input.
  for (let capacity = n * 4 + 64; ; capacity *= 2) {
    const inBuf = m._malloc((n + 1) * 2)
    const outBuf = m._malloc(capacity * 2)
    const inLen = m._malloc(4)
    const outLen = m._malloc(4)
    try {
      m.stringToUTF16(text, inBuf, (n + 1) * 2)
      m.setValue(inLen, n, 'i32')
      m.setValue(outLen, capacity, 'i32')
      const ok = m.ccall(
        'lou_translateString',
        'number',
        ['string', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
        [tableList, inBuf, inLen, outBuf, outLen, 0, 0, 0],
      )
      if (!ok) throw new Error(`liblouis could not translate with ${tableList}`)
      if (m.getValue(inLen, 'i32') >= n || capacity > n * 64) {
        const start = outBuf >> 1
        return utf16.decode(m.HEAPU16.slice(start, start + m.getValue(outLen, 'i32')))
      }
    } finally {
      for (const ptr of [inBuf, outBuf, inLen, outLen]) m._free(ptr)
    }
  }
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data
  try {
    let result: unknown
    if (msg.type === 'init') {
      result = await init(msg.build, msg.tables)
    } else {
      if (!lou) throw new Error('liblouis is not loaded')
      const tableList = `tables/unicode.dis,tables/${msg.table}`
      const m = lou
      result = msg.paragraphs.map((p) => translateString(m, tableList, p))
    }
    self.postMessage({ id: msg.id, ok: true, result })
  } catch (err) {
    self.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
