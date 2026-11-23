import codes from './braille-codes.json'
import type { QuoteStyle } from './text'

export interface BrailleCode {
  id: string
  label: string
  /** liblouis table file. To add a code, add it to braille-codes.json; the build copies the table. */
  table: string
  /** How the table wants single quotes written; see guessPunctuation(). */
  quotes: QuoteStyle
}

export const BRAILLE_CODES = codes as readonly BrailleCode[]
