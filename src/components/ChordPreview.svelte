<script lang="ts">
  /** Dots held down in the chord being typed. */
  let { dots = 0 }: { dots: number } = $props()

  // Row by row: dot 1 (F) and 4 (J), dot 2 (D) and 5 (K), dot 3 (S) and 6 (L).
  const KEYS = [
    { dot: 1, key: 'F' },
    { dot: 4, key: 'J' },
    { dot: 2, key: 'D' },
    { dot: 5, key: 'K' },
    { dot: 3, key: 'S' },
    { dot: 6, key: 'L' },
  ]
</script>

<div class="chord" aria-hidden="true" title="Dots 1 2 3 = F D S, dots 4 5 6 = J K L">
  {#each KEYS as k (k.dot)}
    <span class="dot" class:on={(dots & (1 << (k.dot - 1))) !== 0}>{k.key}</span>
  {/each}
</div>

<style>
  .chord {
    display: grid;
    grid-template-columns: repeat(2, 20px);
    grid-auto-rows: 20px;
    gap: 3px 5px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }

  .dot {
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface);
    border: 1px solid var(--border);
    transition:
      background 80ms,
      color 80ms,
      transform 80ms;
  }

  .dot.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
    transform: scale(1.08);
  }
</style>
