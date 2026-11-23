<script lang="ts">
  import { DOT_CLASSES, cellDots } from '../lib/braille'
  import type { Page } from '../lib/layout'

  interface Props {
    pages: Page[]
    docLength: number
    cellsPerLine: number
    linesPerPage: number
    paged: boolean
    showMarks: boolean
    /** Caret position, or null for a read-only view. */
    cursor?: number | null
    wrong?: Map<number, string> | null
    missing?: Map<number, string> | null
    /** Caret position that was clicked, and the mistake clicked on (if any). */
    onpick?: (pos: number, mistake: number | null) => void
    /** Called with the document position of the mistake under the mouse, or null. */
    onmistakehover?: (pos: number | null) => void
  }

  let {
    pages,
    docLength,
    cellsPerLine,
    linesPerPage,
    paged,
    showMarks,
    cursor = null,
    wrong = null,
    missing = null,
    onpick,
    onmistakehover,
  }: Props = $props()

  const lastLine = $derived(pages[pages.length - 1].lines.at(-1))

  // Mistakes are explained in a popup (see MistakePopup) rather than a native tooltip, which
  // browsers don't show while the window is in the background.
  function hover(event: PointerEvent) {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-mistake]')
    onmistakehover?.(el ? Number(el.dataset.mistake) : null)
  }

  function pick(event: PointerEvent) {
    if (!onpick || event.button !== 0) return
    const target = event.target as HTMLElement
    const mistakeEl = target.closest<HTMLElement>('[data-mistake]')
    const mistake = mistakeEl ? Number(mistakeEl.dataset.mistake) : null
    const item = target.closest<HTMLElement>('[data-i]')
    if (item) {
      const index = Number(item.dataset.i)
      const box = item.getBoundingClientRect()
      const after = item.dataset.eol === undefined && event.clientX > box.left + box.width / 2
      onpick(after ? index + 1 : index, mistake)
    } else if (mistake !== null) {
      onpick(mistake, mistake) // the marker for missing cells
    } else {
      const line = target.closest<HTMLElement>('[data-end]')
      if (line) onpick(Number(line.dataset.end), null)
    }
  }
</script>

{#snippet marker(pos: number)}
  {#if missing?.has(pos)}
    <span class="missing" data-mistake={pos}></span>
  {/if}
  {#if cursor === pos}
    <span class="caret"></span>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="pages"
  class:marks={showMarks}
  style:--cols={cellsPerLine}
  style:--rows={paged ? linesPerPage : 0}
  onpointerdown={pick}
  onpointerover={hover}
  onpointerleave={() => onmistakehover?.(null)}
>
  {#each pages as page (page.number)}
    <section class="page" aria-label="Page {page.number}">
      {#if paged || pages.length > 1}
        <div class="page-label">Page {page.number}</div>
      {/if}
      <div class="sheet" class:paged>
        {#each page.lines as line, n}
          <div class="line" data-end={line.end}>
            <span class="ln" aria-hidden="true">{n + 1}</span>
            {#each line.items as item}
              {@render marker(item.index)}
              {#if item.kind === 'cell'}
                <span
                  class="cell {DOT_CLASSES[cellDots(item.char)]}"
                  class:wrong={wrong?.has(item.index)}
                  data-mistake={wrong?.has(item.index) ? item.index : undefined}
                  data-i={item.index}
                ></span>
              {:else if item.kind === 'space' || item.kind === 'tab'}
                <span
                  class="cell blank"
                  class:tab={item.kind === 'tab'}
                  class:wrong={wrong?.has(item.index)}
                  style:--w={item.width}
                  data-mistake={wrong?.has(item.index) ? item.index : undefined}
                  data-i={item.index}
                ></span>
              {:else}
                <span class="eol" data-i={item.index} data-eol>
                  {#if item.kind === 'pagebreak'}<span class="pb">page break</span>{:else}<span class="nl">↵</span>{/if}
                </span>
              {/if}
            {/each}
            {#if line === lastLine}
              {@render marker(docLength)}
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .pages {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 24px 16px 40px;
    min-width: fit-content;
  }

  .page {
    position: relative;
  }

  .page-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--muted);
    margin: 0 0 8px 2px;
  }

  .sheet {
    background: var(--paper);
    border: 1px solid var(--paper-edge);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: calc(var(--ch) * 0.6) calc(var(--cw) * 1.2) calc(var(--ch) * 0.6) calc(var(--cw) * 2.2);
    width: calc(var(--cols) * var(--cw) + var(--cw) * 3.4);
    box-sizing: border-box;
  }

  .sheet.paged {
    min-height: calc(var(--rows) * var(--ch) + var(--ch) * 1.2);
  }

  .line {
    position: relative;
    display: flex;
    height: var(--ch);
    cursor: text;
  }

  .ln {
    position: absolute;
    right: calc(100% + var(--cw) * 0.7);
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
    opacity: 0.55;
    user-select: none;
  }

  .eol {
    display: flex;
    align-items: center;
    width: 0;
    overflow: visible;
    white-space: nowrap;
    font-size: 11px;
    color: var(--muted);
    user-select: none;
  }

  .eol > span {
    visibility: hidden;
    padding-left: 3px;
    opacity: 0.6;
  }

  .marks .eol > span {
    visibility: visible;
  }

  .pb {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border: 1px dashed var(--border);
    border-radius: 4px;
    padding: 0 4px;
  }

  .marks .tab::before {
    content: '';
    position: absolute;
    left: 20%;
    right: 20%;
    top: 50%;
    border-top: 1px dashed var(--muted);
    opacity: 0.5;
  }
</style>
