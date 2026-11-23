import { diffArrays } from 'diff'
import { isBlankChar } from './braille'

export interface Mistakes {
  /** Typed character index → the cells that belong there instead ('' = shouldn't be there). */
  wrong: Map<number, string>
  /** Typed character index → cells missing just before it (index === doc length: at the end). */
  missing: Map<number, string>
  /** Each separate mistake as document positions [start, end), in document order. */
  runs: MistakeRun[]
  /** Cells of the print text that come after what has been typed so far. */
  remaining: number
}

export interface MistakeRun {
  start: number
  end: number
}

interface Word {
  text: string
  /** Document index of each cell of the word. */
  at: number[]
  /** Document index of the whitespace right after the word, or -1. */
  gap: number
}

interface Unit {
  ch: string
  at: number
}

/** Above this size a mismatched stretch is marked as a whole instead of cell by cell. */
const MAX_CELL_DIFF = 4000

function splitWords(text: string): Word[] {
  const words: Word[] = []
  let word: Word | null = null
  for (let i = 0; i < text.length; i++) {
    if (isBlankChar(text[i])) {
      if (word) {
        word.gap = i
        words.push(word)
        word = null
      }
    } else {
      word ??= { text: '', at: [], gap: -1 }
      word.text += text[i]
      word.at.push(i)
    }
  }
  if (word) words.push(word)
  return words
}

const cellCount = (words: string[]) => words.reduce((n, w) => n + w.length, 0)

/** Splits a diff into the stretches between matches: `[removed, added]` per stretch. */
function* changedRuns<T>(changes: { value: T[]; added: boolean; removed: boolean; count: number }[]) {
  let oldIndex = 0
  for (let c = 0; c < changes.length; ) {
    if (!changes[c].added && !changes[c].removed) {
      oldIndex += changes[c].count
      c++
      continue
    }
    const start = oldIndex
    const added: T[] = []
    while (c < changes.length && (changes[c].added || changes[c].removed)) {
      if (changes[c].removed) oldIndex += changes[c].count
      else added.push(...changes[c].value)
      c++
    }
    yield { start, end: oldIndex, added, last: c >= changes.length }
  }
}

/**
 * Compares typed braille with the correct braille. Whitespace only separates words (line
 * breaks, tabs and page breaks are layout, not mistakes), and anything after the end of the
 * typed text counts as "remaining" rather than missing.
 */
export function findMistakes(typed: string, expected: string): Mistakes {
  const result: Mistakes = { wrong: new Map(), missing: new Map(), runs: [], remaining: 0 }
  const typedWords = splitWords(typed)
  const allExpected = splitWords(expected).map((w) => w.text)
  // Only diff against the part of the print text the typist can have reached; it keeps the
  // diff fast on long texts. The rest is just "remaining".
  const reach = Math.ceil(typedWords.length * 1.25) + 50
  const expectedWords = allExpected.slice(0, reach)
  result.remaining = cellCount(allExpected.slice(reach))

  const changes = diffArrays(
    typedWords.map((w) => w.text),
    expectedWords,
  )
  for (const run of changedRuns(changes)) {
    const removed = typedWords.slice(run.start, run.end)
    const next = typedWords[run.end]
    compareRun(result, removed, run.added, next ? next.at[0] : typed.length, run.last)
  }

  const all = [...new Set([...result.wrong.keys(), ...result.missing.keys()])].sort((a, b) => a - b)
  for (const pos of all) {
    const last = result.runs[result.runs.length - 1]
    if (last && pos === last.end) last.end++
    else result.runs.push({ start: pos, end: pos + 1 })
  }
  return result
}

/** The mistake at caret position `pos`, or right before it. */
export function mistakeNear(m: Mistakes, pos: number): MistakeRun | undefined {
  const contains = (p: number) => m.runs.find((r) => r.start <= p && p < r.end)
  return contains(pos) ?? contains(pos - 1)
}

/** What was typed in a mistake, and what the print text has there instead. */
export function describeMistake(m: Mistakes, doc: string, run: MistakeRun): { typed: string; expected: string } {
  let typed = ''
  let expected = ''
  for (let i = run.start; i < run.end; i++) {
    expected += m.missing.get(i) ?? ''
    const should = m.wrong.get(i)
    if (should !== undefined) {
      typed += doc[i]
      expected += should
    }
  }
  return { typed, expected }
}

/** Marks one mismatched stretch: typed words `removed` where the print text has `added`. */
function compareRun(result: Mistakes, removed: Word[], added: string[], anchor: number, atEnd: boolean) {
  if (removed.length === 0) {
    if (atEnd) result.remaining += cellCount(added)
    else result.missing.set(anchor, added.join(' '))
    return
  }
  if (atEnd) {
    // Typing stopped inside this stretch: compare only as many words as were typed.
    result.remaining += cellCount(added.slice(removed.length))
    added = added.slice(0, removed.length)
  }

  const typed: Unit[] = []
  removed.forEach((word, k) => {
    if (k > 0) typed.push({ ch: ' ', at: removed[k - 1].gap })
    for (let j = 0; j < word.text.length; j++) typed.push({ ch: word.text[j], at: word.at[j] })
  })
  const want = added.join(' ').split('')

  if (want.length === 0 || typed.length + want.length > MAX_CELL_DIFF) {
    for (const unit of typed) result.wrong.set(unit.at, '')
    if (want.length > 0) result.missing.set(typed[0].at, want.join(''))
    return
  }

  const cellChanges = diffArrays(
    typed.map((u) => u.ch),
    want,
  )
  for (const run of changedRuns(cellChanges)) {
    const gone = typed.slice(run.start, run.end)
    gone.forEach((unit, k) => result.wrong.set(unit.at, run.added[k] ?? ''))
    const extra = run.added.slice(gone.length)
    if (extra.length === 0) continue
    if (atEnd && run.end >= typed.length) {
      result.remaining += extra.filter((ch) => ch !== ' ').length
      continue
    }
    const before = typed[run.end - 1]
    const at = before ? before.at + 1 : (typed[run.end]?.at ?? anchor)
    result.missing.set(at, (result.missing.get(at) ?? '') + extra.join(''))
  }
}
