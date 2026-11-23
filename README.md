# Better Braille

Type braille on a normal keyboard and check it against the print text.

- **Six-key typing.** `F` `D` `S` are dots 1 2 3, and `J` `K` `L` are dots 4 5 6. Press the keys of
  a cell together; the cell is entered when you let go.
- **Mistake checking.** Paste the print text (for example from OCR) and pick a braille code. Wrong
  cells get a red underline and missing cells get a red mark; hover or click one, or press `F8`,
  to see what belongs there. "Correct braille" shows the whole correct translation, which you
  can select and copy just like your own.
- **OCR clean-up.** Words hyphenated across lines are joined again, and dashes and single quotes
  that OCR confuses (`-` vs `–`, `'` vs `‘ ’`) are guessed from context. Both can be turned off.
- **Page layout.** Set cells per line, lines per page and tab width. Words wrap like they would on
  a braille page, and you can add manual page breaks.
- **Copy or save** what you typed, or the correct braille, as Unicode braille (`⠃⠗⠇`) or as
  Braille ASCII (`BRL`, for braille fonts and `.brf` files), with or without the line and page
  breaks, and **paste** either format back in later. The Copy and Save buttons take whichever
  braille is on screen; the label next to them says which.
- **Works offline** and can be installed as an app. Everything stays in your browser.

## Keys

| Key                              | Does                                                             |
| -------------------------------- | ---------------------------------------------------------------- |
| `F` `D` `S` `J` `K` `L` together | Type one braille cell                                            |
| `Space`                          | Space                                                            |
| `Enter`                          | New line                                                         |
| `Ctrl`+`Enter`                   | Page break                                                       |
| `Tab`                            | Jump to the next tab stop                                        |
| `Backspace` / `Delete`           | Delete before / after the cursor, or the selection               |
| `Ctrl`+`C` / `Ctrl`+`V`          | Copy / paste (copies in the format chosen under "Copy or save")  |
| `Ctrl`+`Z` / `Ctrl`+`Shift`+`Z`  | Undo / redo (one word at a time)                                 |
| `F8` / `Shift`+`F8`              | Next / previous mistake, with an explanation                     |
| `H`                              | Explain the mistake at the cursor (press again to hide)          |
| `Esc`                            | Close the explanation, clear the selection, or un-focus the page |

All the usual text editing shortcuts work too (like `ctrl backspace` or `opt backspace` on mac)

In "Correct braille" the moves, selecting, `Ctrl`+`A` and `Ctrl`+`C` work the same, but it
can't be changed.

On a Mac, use `Cmd` instead of `Ctrl` and `Option` instead of `Ctrl` for word moves and
deletes. `Cmd`+`Backspace` deletes to the start of the line, and `Cmd`+arrows go to the start
or end of the line or document.

Some keyboards can't register six keys at once, so a few chords may lose dots. If that happens,
try another keyboard or test yours with an online "key rollover" tester.

## Typing braille into another app

On Windows, [`tools/type_braille.ahk`](tools/type_braille.ahk) ([AutoHotkey](https://www.autohotkey.com)
v2) types braille copied from here into any app that takes six-key chords: copy the braille
(yours or the correct one, Unicode or Braille ASCII), click into the other app and press
`PageDown`. `Esc` stops it. Spaces, line breaks and tabs are typed too, and page breaks as
`Ctrl`+`Enter`. Copy without line and page breaks if the other app wraps lines itself. The
key, the timing and the page break keys are set at the top of the script.

## Develop

Needs Node.js 22.12 or newer (20.19+ also works).

```sh
npm install
npm run dev       # http://localhost:5173, reloads as you edit
npm test          # unit tests
npm run check     # type check
```

To try the real production build, including offline mode and the install button:

```sh
npm run build
npm run preview   # http://localhost:4173
```

`localhost` counts as a secure origin, so the service worker and "Install app" work there
without HTTPS. To test exactly what GitHub Pages will serve (the app lives under
`/<repo-name>/` there):

```sh
BASE_PATH=/better-braille/ npm run build
BASE_PATH=/better-braille/ npm run preview   # http://localhost:4173/better-braille/
```

If an old version sticks around while testing the production build, that's the service worker
cache: reload once more, or clear it in DevTools → Application → Storage.

### From another computer on your network

Add `-- --host` so the server accepts connections from other computers:

```sh
npm run dev -- --host                       # http://<your-mac>.local:5173
npm run build && npm run preview -- --host  # http://<your-mac>.local:4173
```

If the `.local` name doesn't resolve, use the "Network" address Vite prints instead. Over plain
`http://` from another computer the browser treats the page as insecure, so offline mode, the
Install button and the Paste button don't work there (Ctrl+V does). To test those too, open
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` (or `edge://flags/...` in Edge), add
the address, e.g. `http://my-mac.local:4173`, and relaunch the browser.

## Adding a braille code

Add an entry to `src/lib/braille-codes.json` with a liblouis table name (see
`vendor/liblouis/tables/`). The build copies that table and the tables it includes
into `public/liblouis/`.

## liblouis

Translation uses [liblouis](https://liblouis.io) 3.39.0, compiled to WebAssembly and kept in
`vendor/liblouis/` together with its braille tables. The sidebar shows which version
translated the text.

To update to a newer liblouis release:

```sh
scripts/build-liblouis.sh 3.40.0   # any release from github.com/liblouis/liblouis/releases
```

This needs either [Emscripten](https://emscripten.org/docs/getting_started/) (`emcc` on your
PATH) or a running Docker (it then builds inside the `emscripten/emsdk` image). It replaces
`vendor/liblouis/`; commit the result so GitHub Pages gets the same version.

liblouis is licensed under the LGPL; see `vendor/liblouis/LICENSE`.
