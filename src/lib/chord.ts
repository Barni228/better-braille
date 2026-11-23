import { KEY_DOTS } from './braille'

/**
 * Collects dot keys pressed together into one braille cell. Dots are added while keys go
 * down; the cell is finished when the last key comes back up, so the keys don't have to be
 * pressed or released at exactly the same moment.
 */
export class ChordTracker {
  private held = new Set<string>()
  private dots = 0

  /** Dots collected so far in the chord being typed. */
  get pending(): number {
    return this.dots
  }

  static isDotKey(code: string): boolean {
    return code in KEY_DOTS
  }

  press(code: string): void {
    const bit = KEY_DOTS[code]
    if (!bit) return
    this.held.add(code)
    this.dots |= bit
  }

  /** Returns the finished cell's dots once every dot key is released, otherwise 0. */
  release(code: string): number {
    if (!this.held.delete(code) || this.held.size > 0) return 0
    const dots = this.dots
    this.dots = 0
    return dots
  }

  /** Drops a half-typed chord, e.g. when the window loses focus and key-ups go missing. */
  reset(): void {
    this.held.clear()
    this.dots = 0
  }
}
