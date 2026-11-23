import codes from './braille-codes.json'

export interface BrailleCode {
  id: string
  label: string
  /** liblouis table file. To add a code, add it to braille-codes.json; the build copies the table. */
  table: string
}

export const BRAILLE_CODES: readonly BrailleCode[] = codes
