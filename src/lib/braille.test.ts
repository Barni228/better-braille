import { describe, expect, it } from 'vitest'
import { cellChar, describeCells, toBrailleAscii } from './braille'
import { ChordTracker } from './chord'

describe('cells', () => {
  it('maps dot bits to Unicode braille', () => {
    expect(cellChar(0b000001)).toBe('⠁')
    expect(cellChar(0b011001)).toBe('⠙') // dots 1-4-5
    expect(cellChar(0b111111)).toBe('⠿')
  })

  it('describes cells for tooltips', () => {
    expect(describeCells('⠙ ')).toBe('⠙ (dots 1-4-5), space')
  })
})

describe('toBrailleAscii', () => {
  it('uses North American Braille ASCII', () => {
    expect(toBrailleAscii('⠓⠑⠇⠇⠕ ⠺⠕⠗⠇⠙')).toBe('HELLO WORLD')
    expect(toBrailleAscii('⠼⠁⠃⠉')).toBe('#ABC')
    expect(toBrailleAscii('⠠⠿⠮⠲')).toBe(',=!4')
  })

  it('keeps line breaks and form feeds', () => {
    expect(toBrailleAscii('⠁\n⠃\f⠉')).toBe('A\nB\fC')
  })
})

describe('ChordTracker', () => {
  it('finishes a cell when the last key is released', () => {
    const chord = new ChordTracker()
    chord.press('KeyF')
    chord.press('KeyJ')
    chord.press('KeyK')
    expect(chord.pending).toBe(0b011001)
    expect(chord.release('KeyJ')).toBe(0)
    expect(chord.release('KeyF')).toBe(0)
    expect(chord.release('KeyK')).toBe(0b011001)
    expect(chord.pending).toBe(0)
  })

  it('ignores other keys and key-ups it never saw', () => {
    const chord = new ChordTracker()
    chord.press('KeyA')
    expect(chord.pending).toBe(0)
    expect(chord.release('KeyF')).toBe(0)
  })
})
