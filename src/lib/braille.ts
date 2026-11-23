/** Unicode braille patterns start at U+2800; bit n of the offset is dot n+1. */
export const BRAILLE_BASE = 0x2800
export const BLANK_CELL = '\u2800'

/** Perkins-style keyboard: F D S are dots 1 2 3, J K L are dots 4 5 6. Keyed by KeyboardEvent.code,
 *  so it follows the physical key position on any keyboard layout. */
export const KEY_DOTS: Readonly<Record<string, number>> = {
  KeyF: 1 << 0,
  KeyD: 1 << 1,
  KeyS: 1 << 2,
  KeyJ: 1 << 3,
  KeyK: 1 << 4,
  KeyL: 1 << 5,
}

export const cellChar = (dots: number): string => String.fromCharCode(BRAILLE_BASE + dots)

/** Dot bits of a braille character, or -1 if it isn't one. */
export function cellDots(ch: string): number {
  const offset = ch.charCodeAt(0) - BRAILLE_BASE
  return offset >= 0 && offset <= 0xff ? offset : -1
}

/** A braille cell with at least one raised dot (U+2800 counts as a blank, like a space). */
export function isCellChar(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code > BRAILLE_BASE && code <= BRAILLE_BASE + 0xff
}

export function isBlankChar(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\r' || ch === BLANK_CELL
}

/** "1-4-5" for ⠙. */
export function dotNumbers(dots: number): string {
  const out: number[] = []
  for (let d = 0; d < 8; d++) if (dots & (1 << d)) out.push(d + 1)
  return out.join('-')
}

/** Human-readable description for tooltips, e.g. "⠙ (dots 1-4-5), space". */
export function describeCells(text: string): string {
  return [...text]
    .map((ch) => (isBlankChar(ch) ? 'space' : `${ch} (dots ${dotNumbers(cellDots(ch))})`))
    .join(', ')
}

/** CSS classes for each 6-dot pattern: DOT_CLASSES[0b10011] === 'd1 d2 d5'. */
export const DOT_CLASSES: readonly string[] = Array.from({ length: 256 }, (_, bits) =>
  [1, 2, 3, 4, 5, 6]
    .filter((d) => bits & (1 << (d - 1)))
    .map((d) => `d${d}`)
    .join(' '),
)

/** North American Braille ASCII, indexed by 6-dot pattern. This is what braille fonts
 *  (SimBraille, Braille29, ...) and .brf files use: the letter "A" displays as ⠁. */
const BRAILLE_ASCII = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)="

/** Converts Unicode braille to Braille ASCII; other characters pass through unchanged. */
export function toBrailleAscii(text: string): string {
  let out = ''
  for (const ch of text) {
    const dots = cellDots(ch)
    out += dots >= 0 ? BRAILLE_ASCII[dots & 0x3f] : ch
  }
  return out
}

const ASCII_DOTS = new Map<string, number>()
for (let dots = 0; dots < 64; dots++) ASCII_DOTS.set(BRAILLE_ASCII[dots], dots)
// Lowercase letters, and the lowercase forms of @ [ \ ] ^ that NABCC files use, are the same cells.
for (let dots = 0; dots < 64; dots++) ASCII_DOTS.set(BRAILLE_ASCII[dots].toLowerCase(), dots)
for (const [lower, upper] of ['`@', '{[', '|\\', '}]', '~^']) ASCII_DOTS.set(lower, ASCII_DOTS.get(upper)!)

/** Dot pattern of a Braille ASCII character (case-insensitive), or undefined if it isn't one. */
export function brailleAsciiDots(ch: string): number | undefined {
  return ASCII_DOTS.get(ch)
}
