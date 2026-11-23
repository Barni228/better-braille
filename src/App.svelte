<script lang="ts">
  import { onMount, tick } from 'svelte'
  import BraillePages from './components/BraillePages.svelte'
  import ChordPreview from './components/ChordPreview.svelte'
  import MistakePopup from './components/MistakePopup.svelte'
  import NumberField from './components/NumberField.svelte'
  import { cellChar, isCellChar } from './lib/braille'
  import { ChordTracker } from './lib/chord'
  import { BRAILLE_CODES } from './lib/codes'
  import { describeMistake, findMistakes, mistakeNear } from './lib/compare'
  import { wordAt, wordEndAfter, wordStartBefore } from './lib/editing'
  import { copyText, downloadText, exportText, importText } from './lib/export'
  import { layout, locate, positionAtCol } from './lib/layout'
  import { translate } from './lib/louis'
  import { LIMITS, sanitizeSettings } from './lib/settings'
  import { load, save } from './lib/storage'
  import { guessPunctuation, toParagraphs } from './lib/text'

  interface Snapshot {
    doc: string
    cursor: number
  }

  const baseUrl = import.meta.env.BASE_URL
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  const savedDoc = load('doc')
  const savedSource = load('source')
  const initialDoc = typeof savedDoc === 'string' ? savedDoc : ''

  const settings = $state(sanitizeSettings(load('settings')))
  let doc = $state(initialDoc)
  let source = $state(typeof savedSource === 'string' ? savedSource : '')
  let cursor = $state(initialDoc.length)
  /** The other end of the selection; equal to `cursor` when nothing is selected. */
  let anchor = $state(initialDoc.length)
  let view = $state<'typed' | 'answer'>('typed')
  let expected = $state<string[] | null>(null)
  let translating = $state(false)
  let translateError = $state('')
  let louisVersion = $state('')
  let pendingDots = $state(0)
  let focused = $state(false)
  let notice = $state('')
  let historySize = $state({ undo: 0, redo: 0 })
  let paper = $state<HTMLElement>()
  /** The mistake explained in the popup. Pinned = opened from the keyboard or a button, so it
   *  stays until dismissed; otherwise it follows the mouse. */
  let popup = $state<{ start: number; pinned: boolean } | null>(null)
  let popupEl = $state<HTMLElement>()
  let popupPos = $state<{ left: number; top: number } | null>(null)

  const chord = new ChordTracker()
  const undoStack: Snapshot[] = []
  const redoStack: Snapshot[] = []
  let lastEdit = { kind: '', time: 0 }
  let goalCol: number | null = null
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let hoverTimer: ReturnType<typeof setTimeout> | undefined

  const pages = $derived(layout(doc, settings))
  const lines = $derived(pages.flatMap((p) => p.lines))
  const answerDoc = $derived(expected ? expected.join('\n') : '')
  const answerPages = $derived(layout(answerDoc, settings))
  const mistakes = $derived(expected && settings.showMistakes ? findMistakes(doc, expected.join(' ')) : null)
  const cellsTyped = $derived([...doc].filter(isCellChar).length)
  const selection = $derived({ start: Math.min(anchor, cursor), end: Math.max(anchor, cursor) })
  const hasSelection = $derived(selection.start < selection.end)
  const selectedCells = $derived([...doc.slice(selection.start, selection.end)].filter(isCellChar).length)
  const popupInfo = $derived.by(() => {
    const open = popup
    if (!open || !mistakes || view !== 'typed') return null
    const index = mistakes.runs.findIndex((r) => r.start === open.start)
    if (index < 0) return null
    return { ...describeMistake(mistakes, doc, mistakes.runs[index]), index: index + 1, total: mistakes.runs.length }
  })
  const position = $derived.by(() => {
    const caret = locate(lines, cursor)
    let rest = caret.line
    for (const page of pages) {
      if (rest < page.lines.length) return { page: page.number, line: rest + 1, cell: caret.col + 1 }
      rest -= page.lines.length
    }
    return { page: 1, line: 1, cell: 1 }
  })

  // Translate the print text whenever it or the braille code changes (debounced).
  $effect(() => {
    const code = BRAILLE_CODES.find((c) => c.id === settings.code) ?? BRAILLE_CODES[0]
    let paragraphs = toParagraphs(source, settings.rejoinHyphens)
    if (settings.guessPunctuation) paragraphs = paragraphs.map((p) => guessPunctuation(p, code.quotes))
    const table = code.table
    if (paragraphs.length === 0) {
      expected = null
      translating = false
      translateError = ''
      return
    }
    let cancelled = false
    translating = true
    const timer = setTimeout(async () => {
      try {
        const result = await translate(table, paragraphs)
        if (cancelled) return
        expected = result.braille
        louisVersion = result.version
        translateError = ''
      } catch (err) {
        if (!cancelled) translateError = err instanceof Error ? err.message : String(err)
      } finally {
        if (!cancelled) translating = false
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })

  $effect(() => save('settings', { ...settings }))
  $effect(() => {
    const value = doc
    const timer = setTimeout(() => save('doc', value), 300)
    return () => clearTimeout(timer)
  })
  $effect(() => {
    const value = source
    const timer = setTimeout(() => save('source', value), 300)
    return () => clearTimeout(timer)
  })

  onMount(() => paper?.focus())

  // Keep the popup next to its mistake as the text and layout change.
  $effect(() => {
    if (!popupInfo) {
      popupPos = null
      return
    }
    void pages
    void settings.cellSize
    tick().then(placePopup)
  })

  // --- Editing -------------------------------------------------------------------------

  function syncHistory() {
    historySize = { undo: undoStack.length, redo: redoStack.length }
  }

  /** Records an undo step. Consecutive edits of the same kind are undone together. */
  function remember(kind: string) {
    const now = Date.now()
    if (kind !== lastEdit.kind || now - lastEdit.time > 1500 || undoStack.length === 0) {
      undoStack.push({ doc, cursor })
      if (undoStack.length > 1000) undoStack.shift()
    }
    lastEdit = { kind, time: now }
    redoStack.length = 0
    syncHistory()
  }

  function apply(next: string, nextCursor: number, kind: string) {
    remember(kind)
    doc = next
    cursor = nextCursor
    anchor = nextCursor
    goalCol = null
    popup = null
    revealCaret()
  }

  function replaceRange(start: number, end: number, text: string, kind: string) {
    apply(doc.slice(0, start) + text + doc.slice(end), start + text.length, kind)
  }

  /** Types text, replacing the selection if there is one. Spaces and line breaks start a new
   *  undo step, so undo takes back one word at a time. */
  function insert(text: string) {
    const kind = hasSelection ? 'replace' : /^\s+$/.test(text) ? 'space' : 'type'
    replaceRange(selection.start, selection.end, text, kind)
  }

  /** Deletes the selection if there is one, otherwise from the cursor to `target`. */
  function deleteTo(target: number) {
    if (hasSelection) return replaceRange(selection.start, selection.end, '', 'delete')
    const to = Math.max(0, Math.min(doc.length, target))
    if (to !== cursor) replaceRange(Math.min(to, cursor), Math.max(to, cursor), '', 'delete')
  }

  function selectAll() {
    anchor = 0
    cursor = doc.length
    goalCol = null
    if (popup?.pinned) popup = null
  }

  function selectWord(index: number) {
    const [start, end] = wordAt(doc, index)
    anchor = start
    moveTo(end, { extend: true })
  }

  // Ctrl/Cmd+C and X copy the selection in the format chosen under "Copy or save".
  const selectedText = () => exportText(doc.slice(selection.start, selection.end), [], settings.exportFormat, false)
  let clipboardEventSeen = false

  /** Lets the browser fire its copy/cut event (see onClipboard); if it doesn't, copies directly. */
  function copySelection(cut: boolean) {
    if (!hasSelection) return
    clipboardEventSeen = false
    const { start, end } = selection
    const text = selectedText()
    setTimeout(async () => {
      if (clipboardEventSeen) return
      const ok = await copyText(text)
      paper?.focus()
      if (!ok) flash('Could not copy')
      else if (cut) replaceRange(start, end, '', 'cut')
    })
  }

  function onClipboard(e: ClipboardEvent) {
    if (!hasSelection || !e.clipboardData) return
    clipboardEventSeen = true
    e.preventDefault()
    e.clipboardData.setData('text/plain', selectedText())
    if (e.type === 'cut') replaceRange(selection.start, selection.end, '', 'cut')
  }

  function clearAll() {
    if (doc.length === 0) return
    lastEdit = { kind: '', time: 0 }
    apply('', 0, 'clear')
    flash('Cleared. Press Ctrl+Z to undo.')
    paper?.focus()
  }

  /** Inserts pasted Unicode braille or Braille ASCII at the cursor (replacing the selection),
   *  as one undo step. */
  function pasteText(text: string) {
    const pasted = importText(text)
    if (pasted.doc.length === 0) {
      flash('Nothing to paste: no braille in the clipboard')
      return
    }
    lastEdit = { kind: '', time: 0 }
    replaceRange(selection.start, selection.end, pasted.doc, 'paste')
    const cells = [...pasted.doc].filter(isCellChar).length
    const from = pasted.format === 'ascii' ? ' from Braille ASCII' : ''
    const skipped = pasted.skipped ? `, skipped ${plural(pasted.skipped, 'other character')}` : ''
    flash(`Pasted ${plural(cells, 'cell')}${from}${skipped}`)
  }

  function onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain')
    if (text === undefined) return
    e.preventDefault()
    pasteText(text)
  }

  async function pasteFromClipboard() {
    view = 'typed'
    await tick()
    paper?.focus()
    try {
      pasteText(await navigator.clipboard.readText())
    } catch {
      flash('Could not read the clipboard. Click the page and press Ctrl+V instead.')
    }
  }

  function restore(from: Snapshot[], to: Snapshot[]) {
    const snapshot = from.pop()
    if (!snapshot) return
    to.push({ doc, cursor })
    doc = snapshot.doc
    cursor = Math.min(snapshot.cursor, snapshot.doc.length)
    anchor = cursor
    lastEdit = { kind: '', time: 0 }
    goalCol = null
    popup = null
    syncHistory()
    revealCaret()
  }

  const undo = () => restore(undoStack, redoStack)
  const redo = () => restore(redoStack, undoStack)

  /** Moves the cursor; with `extend`, the selection grows or shrinks instead of being dropped. */
  function moveTo(pos: number, { keepGoal = false, extend = false } = {}) {
    cursor = Math.max(0, Math.min(doc.length, pos))
    if (!extend) anchor = cursor
    lastEdit = { kind: '', time: 0 }
    if (!keepGoal) goalCol = null
    if (popup?.pinned) popup = null
    revealCaret()
  }

  function moveVertical(direction: 1 | -1, extend = false) {
    const here = locate(lines, cursor)
    goalCol ??= here.col
    const target = here.line + direction
    const pos = target < 0 ? 0 : target >= lines.length ? doc.length : positionAtCol(lines[target], goalCol)
    moveTo(pos, { keepGoal: true, extend })
  }

  function revealCaret() {
    tick().then(() => paper?.querySelector('.caret')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
  }

  // --- Mistakes -----------------------------------------------------------------------

  /** Moves to the next (1) or previous (-1) mistake and explains it. */
  function gotoMistake(direction: 1 | -1) {
    if (!mistakes) return flash('Paste the print text to check for mistakes')
    const runs = mistakes.runs
    if (runs.length === 0) return flash('No mistakes')
    const from = popup?.start ?? cursor
    const run =
      direction > 0
        ? (runs.find((r) => r.start > from) ?? runs[0])
        : (runs.findLast((r) => r.start < from) ?? runs[runs.length - 1])
    view = 'typed'
    tick().then(() => {
      paper?.focus()
      moveTo(run.start)
      popup = { start: run.start, pinned: true }
    })
  }

  /** Shows (or hides) the explanation of the mistake at the cursor. */
  function explainAtCursor() {
    if (popup?.pinned) return (popup = null)
    if (!mistakes) return flash('Paste the print text to check for mistakes')
    const run = mistakeNear(mistakes, cursor)
    if (run) popup = { start: run.start, pinned: true }
    else flash(mistakes.runs.length ? 'No mistake at the cursor. F8 jumps to the next one.' : 'No mistakes')
  }

  function onMistakeHover(pos: number | null) {
    clearTimeout(hoverTimer)
    const run = pos === null ? undefined : mistakes?.runs.find((r) => r.start <= pos && pos < r.end)
    if (!run) {
      if (popup && !popup.pinned) hoverTimer = setTimeout(() => popup?.pinned || (popup = null), 300)
      return
    }
    if (popup?.start === run.start) return
    hoverTimer = setTimeout(() => (popup = { start: run.start, pinned: false }), popup ? 0 : 150)
  }

  /** Puts the popup under its mistake, or above it if there's no room below. */
  function placePopup() {
    const anchor = popup && paper?.querySelector<HTMLElement>(`[data-mistake="${popup.start}"]`)
    if (!paper || !anchor) return (popupPos = null)
    const box = paper.getBoundingClientRect()
    const at = anchor.getBoundingClientRect()
    const width = popupEl?.offsetWidth ?? 300
    const height = popupEl?.offsetHeight ?? 120
    const minLeft = paper.scrollLeft + 8
    const maxLeft = paper.scrollLeft + paper.clientWidth - width - 8
    const left = Math.max(minLeft, Math.min(maxLeft, at.left - box.left + paper.scrollLeft - 16))
    const below = at.bottom + 6 + height <= box.bottom || at.top - 6 - height < box.top
    const top = (below ? at.bottom + 6 : at.top - 6 - height) - box.top + paper.scrollTop
    popupPos = { left, top }
  }

  // --- Keyboard ------------------------------------------------------------------------

  function onKeyDown(e: KeyboardEvent) {
    // On Windows, Alt combinations belong to the browser (Alt+Left is Back).
    if (e.altKey && !isMac) return
    const primary = e.ctrlKey || e.metaKey // Ctrl, or Cmd on a Mac
    const byWord = e.ctrlKey || e.altKey // Ctrl, or Option on a Mac
    const extend = e.shiftKey
    const line = lines[locate(lines, cursor).line]

    if (!primary && !e.altKey && ChordTracker.isDotKey(e.code)) {
      e.preventDefault()
      if (!e.repeat) {
        chord.press(e.code)
        pendingDots = chord.pending
      }
      return
    }

    switch (e.key) {
      case 'Backspace':
        if (e.metaKey || (e.ctrlKey && e.shiftKey)) deleteTo(cursor === line.start ? cursor - 1 : line.start)
        else if (byWord) deleteTo(wordStartBefore(doc, cursor))
        else deleteTo(cursor - 1)
        break
      case 'Delete':
        if (e.metaKey) deleteTo(cursor === line.end ? cursor + 1 : line.end)
        else if (byWord) deleteTo(wordEndAfter(doc, cursor))
        else deleteTo(cursor + 1)
        break
      case 'ArrowLeft':
      case 'ArrowRight': {
        const left = e.key === 'ArrowLeft'
        if (e.metaKey) moveTo(left ? line.start : line.end, { extend })
        else if (byWord) moveTo(left ? wordStartBefore(doc, cursor) : wordEndAfter(doc, cursor), { extend })
        else if (hasSelection && !extend) moveTo(left ? selection.start : selection.end)
        else moveTo(cursor + (left ? -1 : 1), { extend })
        break
      }
      case 'ArrowUp':
      case 'ArrowDown':
        if (e.metaKey) moveTo(e.key === 'ArrowUp' ? 0 : doc.length, { extend })
        else moveVertical(e.key === 'ArrowUp' ? -1 : 1, extend)
        break
      case 'Home':
        moveTo(primary ? 0 : line.start, { extend })
        break
      case 'End':
        moveTo(primary ? doc.length : line.end, { extend })
        break
      case 'Enter':
        insert(primary ? '\f' : '\n')
        break
      case 'Tab':
        if (e.shiftKey || primary || e.altKey) return // Shift+Tab moves focus out of the page
        insert('\t')
        break
      case ' ':
        if (primary || e.altKey) return
        insert(' ')
        break
      case 'Escape':
        if (popup) popup = null
        else if (hasSelection) moveTo(cursor)
        else paper?.blur()
        break
      default:
        if (primary && !e.altKey) return onShortcut(e)
        if (e.altKey || e.code !== 'KeyH') return
        // H (next to J, and not a dot key) explains the mistake at the cursor.
        if (!e.repeat) explainAtCursor()
    }
    e.preventDefault()
  }

  /** Ctrl/Cmd + letter. Anything not handled here (paste, find, reload, ...) goes to the browser. */
  function onShortcut(e: KeyboardEvent) {
    const key = e.key.toLowerCase()
    switch (key) {
      case 'a':
        selectAll()
        break
      case 'z':
        if (e.shiftKey) redo()
        else undo()
        break
      case 'y':
        redo()
        break
      case 'c':
      case 'x':
        copySelection(key === 'x')
        return // The browser now fires a copy or cut event.
      default:
        return
    }
    e.preventDefault()
  }

  function onKeyUp(e: KeyboardEvent) {
    if (!ChordTracker.isDotKey(e.code)) return
    e.preventDefault()
    const dots = chord.release(e.code)
    pendingDots = chord.pending
    if (dots) insert(cellChar(dots))
  }

  function onWindowKeyDown(e: KeyboardEvent) {
    if (e.key === 'F8' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      gotoMistake(e.shiftKey ? -1 : 1)
    }
  }

  function dropChord() {
    chord.reset()
    pendingDots = 0
  }

  // --- Export --------------------------------------------------------------------------

  function flash(message: string) {
    notice = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice = ''), 2200)
  }

  const exportedText = () => exportText(doc, pages, settings.exportFormat, settings.exportLayout)

  async function copyExport() {
    flash((await copyText(exportedText())) ? 'Copied to clipboard' : 'Could not copy')
  }

  function downloadExport() {
    downloadText(exportedText(), settings.exportFormat === 'ascii' ? 'braille-ascii.txt' : 'braille-unicode.txt')
  }

  const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
</script>

<svelte:window onblur={dropChord} onkeydown={onWindowKeyDown} onresize={placePopup} />

<div class="app" class:no-empty-dots={!settings.showEmptyDots} style:--cw="{settings.cellSize}px">
  <header class="topbar">
    <div class="brand">
      <img src="{baseUrl}favicon.svg" alt="" width="28" height="28" />
      <span>Better Braille</span>
    </div>

    <div class="segmented" role="tablist" aria-label="View">
      <button role="tab" aria-selected={view === 'typed'} onclick={() => (view = 'typed')}>Your braille</button>
      <button
        role="tab"
        aria-selected={view === 'answer'}
        disabled={!expected}
        title={expected ? undefined : 'Paste print text first'}
        onclick={() => (view = 'answer')}>Correct braille</button
      >
    </div>

    {#if mistakes}
      <div class="mistake-nav">
        {#if mistakes.runs.length === 0}
          <span class="clean">✓ No mistakes</span>
        {:else}
          <button class="icon" onclick={() => gotoMistake(-1)} title="Previous mistake (Shift+F8)" aria-label="Previous mistake"
            >‹</button
          >
          <button class="count" onclick={() => gotoMistake(1)} title="Show the next mistake (F8)"
            >{plural(mistakes.runs.length, 'mistake')}</button
          >
          <button class="icon" onclick={() => gotoMistake(1)} title="Next mistake (F8)" aria-label="Next mistake">›</button>
        {/if}
      </div>
    {:else if translating}
      <span class="checking">Checking…</span>
    {/if}

    <div class="toolbar">
      <button class="ghost" onclick={pasteFromClipboard} title="Paste Unicode braille or Braille ASCII (Ctrl+V)">Paste</button>
      <button class="ghost" onclick={undo} disabled={historySize.undo === 0} title="Undo (Ctrl+Z)">Undo</button>
      <button class="ghost" onclick={redo} disabled={historySize.redo === 0} title="Redo (Ctrl+Shift+Z)">Redo</button>
      <button class="ghost danger" onclick={clearAll} disabled={doc.length === 0}>Clear</button>
      <span class="divider" aria-hidden="true"></span>
      <button
        class="ghost panel-toggle"
        onclick={() => (settings.showSidebar = !settings.showSidebar)}
        aria-pressed={settings.showSidebar}
        title={settings.showSidebar ? 'Hide the side panel' : 'Show the side panel'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
          {#if settings.showSidebar}<path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4z" fill="currentColor" stroke="none" />{/if}
        </svg>
        <span>Panel</span>
      </button>
    </div>
  </header>

  <main class="workspace" class:no-sidebar={!settings.showSidebar}>
    <section class="editor">
      {#if view === 'typed'}
        <div
          class="paper"
          bind:this={paper}
          tabindex="0"
          role="textbox"
          aria-multiline="true"
          aria-label="Braille document. Type with S D F J K L."
          onkeydown={onKeyDown}
          onkeyup={onKeyUp}
          onpaste={onPaste}
          oncopy={onClipboard}
          oncut={onClipboard}
          onfocus={() => (focused = true)}
          onblur={() => {
            focused = false
            dropChord()
          }}
        >
          <BraillePages
            {pages}
            docLength={doc.length}
            cellsPerLine={settings.cellsPerLine}
            linesPerPage={settings.linesPerPage}
            paged={settings.pageBreaks}
            showMarks={settings.showMarks}
            {cursor}
            selection={hasSelection ? selection : null}
            wrong={mistakes?.wrong}
            missing={mistakes?.missing}
            onpick={(pos, mistake, extend) => {
              paper?.focus()
              moveTo(pos, { extend })
              if (extend) return
              // Clicking a mistake explains it (also on touch screens, which have no hover).
              const run = mistake === null ? undefined : mistakes?.runs.find((r) => r.start <= mistake && mistake < r.end)
              if (run) popup = { start: run.start, pinned: true }
            }}
            ondrag={(pos) => moveTo(pos, { extend: true })}
            ondoubleclick={selectWord}
            onmistakehover={onMistakeHover}
          />
          {#if popupInfo}
            <MistakePopup
              {...popupInfo}
              bind:element={popupEl}
              left={popupPos?.left ?? 0}
              top={popupPos?.top ?? 0}
              visible={popupPos !== null}
              onprev={() => gotoMistake(-1)}
              onnext={() => gotoMistake(1)}
              onclose={() => (popup = null)}
              onpointerenter={() => clearTimeout(hoverTimer)}
              onpointerleave={() => onMistakeHover(null)}
            />
          {/if}
        </div>
      {:else}
        <div class="paper readonly" aria-label="Correct braille">
          <BraillePages
            pages={answerPages}
            docLength={answerDoc.length}
            cellsPerLine={settings.cellsPerLine}
            linesPerPage={settings.linesPerPage}
            paged={settings.pageBreaks}
            showMarks={settings.showMarks}
          />
        </div>
      {/if}

      <footer class="statusbar">
        <ChordPreview dots={pendingDots} />
        {#if view === 'typed'}
          <div class="where">
            <strong>Page {position.page}</strong>
            <span>Line {position.line}</span>
            <span>Cell {position.cell}</span>
            {#if hasSelection}
              <span class="selected-count">{plural(selectedCells, 'cell')} selected</span>
            {:else}
              <span class="muted">{plural(cellsTyped, 'cell')}</span>
            {/if}
          </div>
          <div class="keys">
            {#if focused}
              <span><kbd>Enter</kbd> new line</span>
              <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> page break</span>
              <span><kbd>Tab</kbd> indent</span>
              {#if mistakes}
                <span><kbd>F8</kbd> next mistake</span>
                <span><kbd>H</kbd> explain mistake</span>
              {/if}
              <span><kbd>Esc</kbd> leave page</span>
            {:else}
              <button class="link" onclick={() => paper?.focus()}>Click the page to start typing</button>
            {/if}
          </div>
        {:else}
          <div class="where"><strong>Correct braille</strong><span class="muted">read only</span></div>
        {/if}
      </footer>
    </section>

    {#if settings.showSidebar}
    <aside class="sidebar">
      <section class="card">
        <h2>Check against print</h2>
        <label class="stack">
          <span>Braille code</span>
          <select bind:value={settings.code}>
            {#each BRAILLE_CODES as code (code.id)}
              <option value={code.id}>{code.label}</option>
            {/each}
          </select>
        </label>
        <label class="stack">
          <span>Print text</span>
          <textarea
            bind:value={source}
            rows="7"
            spellcheck="false"
            placeholder="Paste the print text here, for example from OCR."
          ></textarea>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.rejoinHyphens} />
          <span>Join words hyphenated across lines</span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.guessPunctuation} />
          <span>Guess OCR dashes and quotes</span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.showMistakes} />
          <span>Underline mistakes</span>
        </label>

        {#if translateError}
          <p class="status error">Couldn't translate: {translateError}</p>
        {:else if translating && !expected}
          <p class="status muted">Translating…</p>
        {:else if mistakes && mistakes.remaining > 0}
          <p class="status muted">{plural(mistakes.remaining, 'cell')} left to type</p>
        {/if}
        {#if louisVersion}
          <p class="hint">Translated with liblouis {louisVersion}</p>
        {/if}
      </section>

      <section class="card">
        <h2>Page layout</h2>
        <NumberField label="Cells per line" bind:value={settings.cellsPerLine} min={LIMITS.cellsPerLine[0]} max={LIMITS.cellsPerLine[1]} />
        <label class="check">
          <input type="checkbox" bind:checked={settings.pageBreaks} />
          <span>Split into pages</span>
        </label>
        {#if settings.pageBreaks}
          <NumberField label="Lines per page" bind:value={settings.linesPerPage} min={LIMITS.linesPerPage[0]} max={LIMITS.linesPerPage[1]} />
        {/if}
        <NumberField label="Tab width (cells)" bind:value={settings.tabWidth} min={LIMITS.tabWidth[0]} max={LIMITS.tabWidth[1]} />
        <label class="range">
          <span>Cell size</span>
          <input type="range" bind:value={settings.cellSize} min={LIMITS.cellSize[0]} max={LIMITS.cellSize[1]} />
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.showEmptyDots} />
          <span>Show empty dot positions</span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={settings.showMarks} />
          <span>Show line ends and tabs</span>
        </label>
      </section>

      <section class="card">
        <h2>Copy or save</h2>
        <div class="segmented full" role="radiogroup" aria-label="Format">
          <button role="radio" aria-checked={settings.exportFormat === 'unicode'} onclick={() => (settings.exportFormat = 'unicode')}
            >Unicode braille</button
          >
          <button role="radio" aria-checked={settings.exportFormat === 'ascii'} onclick={() => (settings.exportFormat = 'ascii')}
            >Braille font (ASCII)</button
          >
        </div>
        <p class="hint">
          {#if settings.exportFormat === 'unicode'}
            Braille characters (⠃⠗⠇) that show as dots in any app.
          {:else}
            Letters and symbols (BRL) that show as dots in a braille font such as SimBraille. Same as a .brf file.
          {/if}
        </p>
        <label class="check">
          <input type="checkbox" bind:checked={settings.exportLayout} />
          <span>Keep line and page breaks</span>
        </label>
        <div class="row">
          <button class="primary" onclick={copyExport} disabled={doc.length === 0}>Copy</button>
          <button onclick={downloadExport} disabled={doc.length === 0}>Save as .txt</button>
        </div>
      </section>
    </aside>
    {/if}
  </main>

  {#if notice}
    <div class="toast" role="status">{notice}</div>
  {/if}
</div>

<style>
  .app {
    --ch: calc(var(--cw) * 1.6);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100dvh;
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 650;
    font-size: 16px;
    letter-spacing: -0.01em;
  }

  .brand img {
    border-radius: 7px;
  }

  .toolbar {
    margin-left: auto;
    display: flex;
    gap: 4px;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 16px;
    padding: 16px;
    min-height: 0;
  }

  .workspace.no-sidebar {
    grid-template-columns: minmax(0, 1fr);
  }

  .mistake-nav {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface-2);
  }

  .mistake-nav button {
    border: 0;
    background: transparent;
    padding: 4px 8px;
  }

  .mistake-nav .icon {
    width: 28px;
    padding: 4px 0;
    font-size: 18px;
    line-height: 1;
    color: var(--muted);
  }

  .mistake-nav .count {
    color: var(--error);
    font-weight: 650;
  }

  .mistake-nav .clean {
    padding: 4px 10px;
    color: var(--ok);
    font-size: 14px;
    font-weight: 600;
  }

  .checking {
    color: var(--muted);
    font-size: 14px;
  }

  .toolbar .divider {
    width: 1px;
    margin: 6px 4px;
    background: var(--border);
  }

  .panel-toggle[aria-pressed='true'] {
    color: var(--accent);
  }

  .editor {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    overflow: hidden;
  }

  .paper {
    position: relative;
    flex: 1;
    overflow: auto;
    outline: none;
  }

  .statusbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    font-size: 13px;
    flex-wrap: wrap;
  }

  .where {
    display: flex;
    gap: 12px;
    font-variant-numeric: tabular-nums;
  }

  .keys {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    color: var(--muted);
    font-size: 12px;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: auto;
    min-height: 0;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
  }

  .range {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 14px;
  }

  .range input {
    width: 140px;
  }

  textarea {
    resize: vertical;
    min-height: 120px;
  }

  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0;
    font-size: 14px;
  }

  .error {
    color: var(--error);
    font-weight: 600;
  }

  .muted {
    color: var(--muted);
  }

  .selected-count {
    color: var(--accent);
    font-weight: 550;
  }

  .hint {
    margin: -4px 0 0;
    font-size: 12.5px;
    color: var(--muted);
    line-height: 1.45;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row button {
    flex: 1;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 10px;
    background: var(--text);
    color: var(--bg);
    font-size: 14px;
    box-shadow: var(--shadow);
  }

  @media (max-width: 960px) {
    .app {
      height: auto;
      min-height: 100dvh;
    }

    .workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .editor {
      height: 70dvh;
    }

    .sidebar {
      overflow: visible;
    }

    .keys {
      display: none;
    }
  }

  @media (max-width: 560px) {
    .topbar {
      flex-wrap: wrap;
    }

    .brand span {
      display: none;
    }
  }
</style>
