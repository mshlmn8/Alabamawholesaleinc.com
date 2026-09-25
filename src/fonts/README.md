# Local fonts for the Alabama Wholesale skeleton

These are unmodified Latin-subset WOFF2 files downloaded from the official Google Fonts service on 2026-09-21. The skeleton can load them entirely from this folder, without requesting Google Fonts at runtime.

## Included faces

| Family | Style | CSS weights | File | Bytes |
| --- | --- | --- | --- | ---: |
| Barlow Condensed | Normal | 500 | `barlow-condensed-latin-500.woff2` | 14,680 |
| Barlow Condensed | Normal | 600 | `barlow-condensed-latin-600.woff2` | 14,844 |
| Barlow Condensed | Normal | 700 | `barlow-condensed-latin-700.woff2` | 14,888 |
| Barlow Condensed | Normal | 800 | `barlow-condensed-latin-800.woff2` | 14,764 |
| DM Sans | Normal | 400–700 | `dm-sans-latin-variable.woff2` | 36,980 |

Total font payload: **96,156 bytes (about 94 KiB)**. The DM Sans variable file serves all four requested weights: 400, 500, 600, and 700. Only normal styles are included; italic and extended language subsets are not bundled.

## Use

The app's `src/index.css` imports the local stylesheet before the page styles:

```css
@import url('./fonts/fonts.css');
```

```css
body { font-family: 'DM Sans', Arial, sans-serif; }
h1, h2, h3 { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; }
```

Every face uses `font-display: swap`. All font URLs inside `fonts.css` are relative to this directory. Text outside the provided Latin subset falls back to the next font in the CSS stack.

## Official sources and licensing

- [Google Fonts CSS API request](https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap)
- [Barlow Condensed family and source](https://github.com/google/fonts/tree/main/ofl/barlowcondensed)
- [DM Sans family and source](https://github.com/google/fonts/tree/main/ofl/dmsans)
- Both families use the SIL Open Font License 1.1. The original, unmodified licenses are included in `Barlow-Condensed-OFL.txt` and `DM-Sans-OFL.txt`.

`provenance.json` records the exact official `fonts.gstatic.com` download URL, byte size, and SHA-256 digest for each font, plus the official license source URLs. The font binaries have not been converted or edited.

## Verification

Each downloaded font has the `wOF2` file signature. Chromium successfully decoded all five files using the browser FontFace API; `document.fonts.load()` returned a loaded face and `document.fonts.check()` passed for every requested family/weight combination. The results are in `verification.json`.

This font-only verification used the downloaded bytes directly. The page's own stylesheet integration should also be checked when the skeleton is rendered.
