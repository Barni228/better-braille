<script lang="ts">
  import { DOT_CLASSES, cellDots, dotNumbers, isBlankChar } from '../lib/braille'

  interface Props {
    typed: string
    expected: string
    index: number
    total: number
    left: number
    top: number
    visible: boolean
    element?: HTMLElement
    onprev: () => void
    onnext: () => void
    onclose: () => void
    onpointerenter: () => void
    onpointerleave: () => void
  }

  let {
    typed,
    expected,
    index,
    total,
    left,
    top,
    visible,
    element = $bindable(),
    onprev,
    onnext,
    onclose,
    onpointerenter,
    onpointerleave,
  }: Props = $props()

  const MAX_CELLS = 24
  const title = $derived(typed === '' ? 'Missing' : expected === '' ? 'Extra' : 'Wrong')
</script>

{#snippet cells(text: string)}
  {@const shown = [...text].slice(0, MAX_CELLS)}
  <span class="cells">
    {#each shown as ch, i (i)}
      {#if isBlankChar(ch)}
        <span class="blank-label">space</span>
      {:else}
        <span class="cell-box">
          <span class="cell {DOT_CLASSES[cellDots(ch)]}"></span>
          {#if shown.length <= 6}<span class="dots">{dotNumbers(cellDots(ch))}</span>{/if}
        </span>
      {/if}
    {/each}
    {#if text.length > MAX_CELLS}<span class="more">+{text.length - MAX_CELLS} more</span>{/if}
  </span>
{/snippet}

<!-- Hovering keeps the popup open; it never takes focus away from the page. -->
<div
  class="popup"
  class:visible
  bind:this={element}
  style:left="{left}px"
  style:top="{top}px"
  role="status"
  aria-live="polite"
  {onpointerenter}
  {onpointerleave}
  onpointerdown={(e) => e.preventDefault()}
>
  <div class="head">
    <strong class="kind">{title}</strong>
    <span class="count">{index} of {total}</span>
    <div class="nav">
      <button class="icon" onclick={onprev} title="Previous mistake (Shift+F8)" aria-label="Previous mistake">‹</button>
      <button class="icon" onclick={onnext} title="Next mistake (F8)" aria-label="Next mistake">›</button>
      <button class="icon" onclick={onclose} title="Close (Esc)" aria-label="Close">×</button>
    </div>
  </div>

  {#if typed === ''}
    <div class="row"><span class="label">Missing here</span>{@render cells(expected)}</div>
  {:else if expected === ''}
    <div class="row"><span class="label">Extra</span>{@render cells(typed)}</div>
    <p class="note">Not in the print text.</p>
  {:else}
    <div class="row"><span class="label">You typed</span>{@render cells(typed)}</div>
    <div class="row"><span class="label">Should be</span>{@render cells(expected)}</div>
  {/if}
</div>

<style>
  .popup {
    --cw: 22px;
    --ch: calc(var(--cw) * 1.6);
    position: absolute;
    z-index: 20;
    width: max-content;
    max-width: min(420px, calc(100% - 16px));
    padding: 10px 12px 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 8px 28px rgb(16 24 40 / 0.18);
    font-size: 13px;
    visibility: hidden;
  }

  .popup.visible {
    visibility: visible;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .kind {
    color: var(--error);
  }

  .count {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .nav {
    display: flex;
    gap: 2px;
    margin-left: auto;
  }

  .icon {
    width: 26px;
    height: 26px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    font-size: 17px;
    line-height: 1;
    color: var(--muted);
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 4px 0;
  }

  .label {
    flex: none;
    width: 72px;
    padding-top: 8px;
    color: var(--muted);
  }

  .cells {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 2px 4px;
  }

  .cell-box {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .cell-box .cell {
    background-color: var(--surface-2);
    border-radius: 4px;
  }

  .dots {
    font-size: 10.5px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .blank-label,
  .more {
    align-self: center;
    padding: 2px 6px;
    border-radius: 5px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11.5px;
  }

  .note {
    margin: 0;
    color: var(--muted);
  }
</style>
