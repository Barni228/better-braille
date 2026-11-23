import { BRAILLE_CODES } from './codes'
import type { ExportFormat } from './export'

export interface Settings {
  cellsPerLine: number
  linesPerPage: number
  pageBreaks: boolean
  tabWidth: number
  cellSize: number
  showEmptyDots: boolean
  showMarks: boolean
  code: string
  rejoinHyphens: boolean
  showMistakes: boolean
  exportFormat: ExportFormat
  exportLayout: boolean
}

export const LIMITS = {
  cellsPerLine: [10, 100],
  linesPerPage: [5, 100],
  tabWidth: [1, 20],
  cellSize: [14, 36],
} as const

export const DEFAULT_SETTINGS: Settings = {
  cellsPerLine: 40,
  linesPerPage: 25,
  pageBreaks: true,
  tabWidth: 2,
  cellSize: 20,
  showEmptyDots: true,
  showMarks: true,
  code: 'en-ueb-g2',
  rejoinHyphens: true,
  showMistakes: true,
  exportFormat: 'unicode',
  exportLayout: true,
}

/** Settings from storage, with anything missing or out of range replaced by defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) }
  for (const [key, [min, max]] of Object.entries(LIMITS) as [keyof typeof LIMITS, readonly [number, number]][]) {
    const v = Number(s[key])
    s[key] = Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : DEFAULT_SETTINGS[key]
  }
  for (const key of ['pageBreaks', 'showEmptyDots', 'showMarks', 'rejoinHyphens', 'showMistakes', 'exportLayout'] as const) {
    s[key] = typeof s[key] === 'boolean' ? s[key] : DEFAULT_SETTINGS[key]
  }
  if (!BRAILLE_CODES.some((c) => c.id === s.code)) s.code = DEFAULT_SETTINGS.code
  if (s.exportFormat !== 'unicode' && s.exportFormat !== 'ascii') s.exportFormat = DEFAULT_SETTINGS.exportFormat
  return s
}
