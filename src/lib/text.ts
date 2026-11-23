/**
 * Cleans up pasted print text (e.g. from OCR) into paragraphs for translation: blank lines
 * separate paragraphs, other line breaks become spaces, and words hyphenated across a line
 * break can be joined back together ("exam-\nple" → "example").
 */
export function toParagraphs(text: string, rejoinHyphens: boolean): string[] {
  let t = text.replace(/\r\n?/g, '\n')
  if (rejoinHyphens) t = t.replace(/(\p{L})-[ \t]*\n[ \t]*(\p{L})/gu, '$1$2')
  return t
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
}

/** How a braille code's liblouis table wants single quotes written to translate them correctly. */
export type QuoteStyle = 'curly' | 'straight'

/** Words written with a leading apostrophe, so it isn't an opening quote ('tis, rock 'n' roll). */
const ELISIONS = new Set(['tis', 'twas', 'twere', 'twill', 'em', 'n', 'cause', 'cos', 'til', 'bout', 'cept', 'nuff', 'neath'])
const QUOTES = new Set(["'", '‘', '’', '`', '´'])
const isWordChar = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch)
const isLetter = (ch: string | undefined) => ch !== undefined && /\p{L}/u.test(ch)
const isCloser = (before: string | undefined, after: string | undefined) =>
  (isWordChar(before) || (before !== undefined && /[.,!?;:)\]…"”]/.test(before))) && !isWordChar(after)

/**
 * Fixes dashes and single quotes that OCR gets wrong, by guessing from context:
 * "--" and a spaced " - " are dashes, an en dash between lowercase letters is a hyphen, and a
 * straight ' is an apostrophe inside or after a word but a quote around a quoted phrase.
 * `quotes` says which form the braille table translates correctly: 'curly' (‘quote’, for
 * UEB) or 'straight' ('quote', for EBAE, where liblouis does its own guessing).
 */
export function guessPunctuation(paragraph: string, quotes: QuoteStyle): string {
  const t = paragraph
    .replace(/-{2,}/g, '—')
    .replace(/(\S) - (?=\S)/g, '$1 – ')
    .replace(/(\p{Ll})–(?=\p{Ll})/gu, '$1-')
  const chars = [...t]
  if (quotes === 'straight') return chars.map((ch) => (QUOTES.has(ch) ? "'" : ch)).join('')

  let lastCloser = -1
  chars.forEach((ch, i) => {
    if (QUOTES.has(ch) && isCloser(chars[i - 1], chars[i + 1])) lastCloser = i
  })

  let open = 0
  return chars
    .map((ch, i) => {
      if (!QUOTES.has(ch)) return ch
      const before = chars[i - 1]
      const after = chars[i + 1]
      if (isWordChar(before) && isWordChar(after)) return "'" // it's, don't
      if (!isWordChar(before) && isWordChar(after)) {
        let word = ''
        for (let k = i + 1; isLetter(chars[k]); k++) word += chars[k]
        const apostrophe = !isLetter(after) || ELISIONS.has(word.toLowerCase()) || lastCloser < i
        if (apostrophe) return "'" // '90s, 'tis, or nothing closes it
        open++
        return '‘'
      }
      if (isCloser(before, after)) {
        if (open === 0) return "'" // dogs' (plural possessive)
        open--
        return '’'
      }
      return ch === '`' || ch === '´' ? "'" : ch
    })
    .join('')
}
