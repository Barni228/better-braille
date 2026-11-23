// Copies the liblouis build from vendor/liblouis/ plus the braille tables listed in
// src/lib/braille-codes.json (and every table they include) into public/liblouis/, so the
// app only ships the tables it uses. Runs automatically before `npm run dev` and `npm run build`.
// vendor/liblouis/ itself comes from scripts/build-liblouis.sh.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendorDir = join(root, 'vendor/liblouis')
const tablesDir = join(vendorDir, 'tables')

if (!existsSync(join(vendorDir, 'liblouis.js'))) {
  console.error('vendor/liblouis/ is missing. Build it with scripts/build-liblouis.sh')
  process.exit(1)
}
const version = readFileSync(join(vendorDir, 'VERSION'), 'utf8').trim()

const codes = JSON.parse(readFileSync(join(root, 'src/lib/braille-codes.json'), 'utf8'))
const queue = ['unicode.dis', ...codes.map((c) => c.table)]
const needed = new Set()

while (queue.length > 0) {
  const name = queue.pop()
  if (needed.has(name)) continue
  const file = join(tablesDir, name)
  if (!existsSync(file)) throw new Error(`liblouis table not found: ${name}`)
  needed.add(name)
  for (const line of readFileSync(file, 'latin1').split(/\r?\n/)) {
    const match = /^\s*include\s+(\S+)/.exec(line)
    if (match) queue.push(match[1])
  }
}

const out = join(root, 'public/liblouis')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'tables'), { recursive: true })

copyFileSync(join(vendorDir, 'liblouis.js'), join(out, 'liblouis.js'))
let bytes = statSync(join(out, 'liblouis.js')).size
const tables = [...needed].sort()
for (const name of tables) {
  copyFileSync(join(tablesDir, name), join(out, 'tables', name))
  bytes += statSync(join(out, 'tables', name)).size
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ version, tables }, null, 2) + '\n')

console.log(`liblouis ${version}: copied ${tables.length} tables (${(bytes / 1024 / 1024).toFixed(1)} MB total)`)
