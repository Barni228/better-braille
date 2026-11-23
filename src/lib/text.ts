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
