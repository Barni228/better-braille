#Requires AutoHotkey v2.0
#SingleInstance Force

; Type braille: press PageDown to type the braille on the clipboard as 6-key
; braille chords. Copy it in Better Braille first (Copy button or Ctrl+C), as
; Unicode braille or as Braille ASCII; the script tells them apart the same way
; Better Braille's own paste does. Nothing is translated: every cell is typed
; exactly as it was copied. Press Esc to stop while it is typing.
;
; Copied with line and page breaks, every line ends with Enter, so turn that
; off if the app you type into wraps lines by itself.
;
; Dot -> key:  1=F  2=D  3=S  4=J  5=K  6=L   (plus Space, Enter and Tab)
; All keys of a chord go down together, are held briefly, then released together.

TypeKey       := "PgDn"              ; types the clipboard
HoldMs        := 40                  ; how long a chord is held down
GapMs         := 40                  ; pause between chords
PageBreakKeys := ["Ctrl", "Enter"]   ; pressed together for a page break

; keys for dots 1..6, as scan codes so they are the F D S J K L keys whatever
; keyboard layout is switched on
DotKeys := ["sc021", "sc020", "sc01F", "sc024", "sc025", "sc026"]

; North American Braille ASCII indexed by dot pattern (dot n is bit n - 1),
; the same table as in src/lib/braille.ts
BrailleAscii := " A1B'K2L@CIF/MSP`"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\0Z7(_?W]#Y)="
AsciiDots := Map()
AsciiDots.CaseSense := "Off"   ; "a" is the same cell as "A"
for i, ch in StrSplit(BrailleAscii)
    AsciiDots[ch] := i - 1
for pair in ["``@", "{[", "|\", "}]", "~^"]   ; lowercase forms some .brf files use
    AsciiDots[SubStr(pair, 1, 1)] := AsciiDots[SubStr(pair, 2, 1)]

SetKeyDelay(-1, -1)

Busy  := false
Abort := false

Hotkey(TypeKey, TypeClipboard)

TypeClipboard(*) {
    global Busy, Abort
    if Busy
        return
    chords := BrailleToChords(A_Clipboard, &skipped)
    Busy := true
    Abort := false
    try {
        for keys in chords {
            if Abort
                break
            PressTogether(keys)
        }
    } finally {
        Busy := false
    }
    note := Abort ? "Stopped" : ""
    if skipped
        note .= (note ? "`n" : "") "Skipped " skipped " characters that are not braille"
    if note {
        ToolTip(note)
        SetTimer(() => ToolTip(), -3000)
    }
}

; Turn copied braille into the keys to press: one list of keys per chord.
; Text with Unicode braille in it is read as that, anything else as Braille
; ASCII. skipped is set to the number of characters that are neither.
BrailleToChords(text, &skipped) {
    text := StrReplace(StrReplace(text, "`r`n", "`n"), "`r", "`n")
    ; braille copied with its layout has a line break before every page break
    ; and one at the very end; those are not typed
    text := StrReplace(text, "`n`f", "`f")
    if (SubStr(text, -1) = "`n")
        text := SubStr(text, 1, -1)

    chars := StrSplit(text)
    unicode := false
    for ch in chars {
        if IsBrailleCell(ch) {
            unicode := true
            break
        }
    }

    chords := []
    skipped := 0
    for ch in chars {
        switch ch {
            case " ", Chr(0x2800): chords.Push(["Space"])
            case "`n": chords.Push(["Enter"])
            case "`t": chords.Push(["Tab"])
            case "`f": chords.Push(PageBreakKeys)
            default:
                if unicode
                    dots := IsBrailleCell(ch) ? Ord(ch) - 0x2800 : -1
                else
                    dots := AsciiDots.Get(ch, -1)
                if (dots < 0) {
                    skipped++
                    continue
                }
                dots &= 0x3F   ; only 6-dot braille: dots 7 and 8 are dropped
                chords.Push(dots ? DotsToKeys(dots) : ["Space"])
        }
    }
    return chords
}

; a Unicode braille character with at least one raised dot
IsBrailleCell(ch) => Ord(ch) > 0x2800 && Ord(ch) <= 0x28FF

DotsToKeys(dots) {
    keys := []
    for dot, key in DotKeys {
        if (dots & (1 << (dot - 1)))
            keys.Push(key)
    }
    return keys
}

; press all keys down together, hold, release all together
PressTogether(keys) {
    downs := ""
    ups := ""
    for k in keys {
        downs .= "{" k " down}"
        ups .= "{" k " up}"
    }
    SendEvent(downs)
    Sleep(HoldMs)
    SendEvent(ups)
    Sleep(GapMs)
}

#HotIf Busy
Esc:: {
    global Abort := true
}
#HotIf
