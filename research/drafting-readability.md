# How readable are the Drafting tokens and fonts?

Research for [#107](https://github.com/MoritzKopmann/AISoftwareFactory/issues/107) (part of map [#105](https://github.com/MoritzKopmann/AISoftwareFactory/issues/105)).
Researched 2026-09-28 against `packages/app/assets/kit/kit.css` at `a74c742` (main) and `packages/ui/src/app.css`.
The prototype `origin/prototype/design-system:prototype/design-system/directions.html` defines the same Drafting tokens (`:root[data-kit="b"]`), so every number below applies to its bridge-page specimens too: the questionnaire round and the confirm figure.

All contrast figures are **measured**. WCAG 2.2 ratios use the relative-luminance formula. APCA Lc values use the reference implementation `apca-w3` 0.1.9 (`APCAcontrast(sRGBtoY(fg), sRGBtoY(bg))`). A positive Lc means dark text on a light background, and a negative Lc means light text on a dark background. Font metrics were read from the woff2 files with `fontkit`. The scripts are in the appendix.

## Answer

**Drafting reads well. Body text, headings and `--muted` pass everywhere in both themes. Six concrete defects remain, and each one takes a small token tweak, not a redesign:**

1. **The light primary button fails WCAG 1.4.3.** White `--accent-ink` on `--accent` `#d05f1a` measures **3.94:1**, and 15px normal-weight text needs 4.5. The shipped UI uses this pair on `form button` in `packages/ui/src/app.css`.
2. **Light `--accent` fails as text on every surface: 3.12–3.76:1.** The prototype uses accent-coloured text for the "ready" and "in progress" chips and for the `tag-suggested` tag (10.5px). Orange can't be both a bright fill and a 4.5:1 text colour on pale grey-blue, so split it into two tokens: `--accent` for fills and rules, and a darker `--accent-text` for text.
3. **Light `--warn` fails on `--bg` (4.12) and `--surface-2` (3.82). Light `--ok` fails on `--surface-2` (4.20).** Both need small darkenings (ΔL in OKLCH of −0.04 and −0.016).
4. **Dark `--border-strong` is below the 3:1 non-text minimum on `--surface` (2.89) and `--surface-2` (2.56).** It is the card and input border. Lightening it slightly fixes this.
5. **Dark-mode secondary colours are weak under APCA even though WCAG 2 passes them comfortably.** `--muted`, `--info`, `--hitl` and `--danger` sit at **Lc 44–50** on dark surfaces, while APCA Bronze asks Lc 60 for content text. The 11px muted labels are drawn in exactly these colours. WCAG 2 is the conformance bar, and APCA is only a draft, but this matches the known dark-mode blind spot of the WCAG 2 formula. A +0.05 OKLCH lightness lift brings them to Lc 55–58 without flattening the text/muted hierarchy.
6. **The prototype asks for weights the UI font doesn't ship.** Atkinson Hyperlegible (v1) only ships 400 and 700. The prototype's `font-weight: 600` (buttons, answer titles, accordions) therefore renders as 700, and `500` (ticket titles) renders as 400. Atkinson Hyperlegible Next ships 200–800 with identical metrics, so it's a like-for-like swap that fixes this.

The **11px uppercase mono labels are acceptable, but only for short labels**. JetBrains Mono's caps are 0.73 em tall, so an 11px label has 8.0px caps. That is as tall as the x-height of 16px Atkinson Hyperlegible. The 0.08em tracking sits inside Butterick's 5–12% range for caps. The weak spots are the chips' reduced tracking (0.048em) and the dark-mode label contrast (item 5). The **uppercase mono headings are fine for one-line section names**, but ticket titles and other variable-length prose shouldn't be set in them. Keep **JetBrains Mono** and **Atkinson Hyperlegible**, preferably upgraded to **Next**. Inter, IBM Plex and Geist would be neither more legible nor closer to Drafting's character.

## 1. Contrast: failing and weak pairs

Thresholds: WCAG 2.2 [SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires 4.5:1 for text, or 3:1 for large text (≥ 24px, or ≥ 18.5px bold), and ratios are not rounded ("4.499:1 would not meet the 4.5:1 threshold"). [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) requires 3:1 for UI components and graphical objects "against adjacent color(s)". APCA [Bronze Simple Mode](https://readtech.org/ARC/tests/bronze-simple-mode/) asks for Lc 75 minimum on body text (Lc 90 preferred) and Lc 60 on other content text. APCA/ARC is "not presently an official recommendation" ([ARC](https://readtech.org/ARC/)), so it's used here as a second opinion, not a gate.

Almost all Drafting text is smaller than 18.5px bold (labels and chips are 11px, buttons 13.5px, body 15px), so the 4.5:1 bar applies throughout.

### Failing or weak pairs

| Theme | Pair | WCAG | APCA Lc | Verdict |
|---|---|---|---|---|
| light | `--accent-ink` #ffffff on `--accent` #d05f1a (primary button) | **3.94** | −71.6 | **Fails 1.4.3** |
| light | `--accent` #d05f1a on `--bg` #e9eef2 | **3.37** | 55.5 | **Fails 1.4.3** as text (passes 3:1 as a rule or focus ring) |
| light | `--accent` on `--surface` #f8fafb | **3.76** | 62.9 | **Fails 1.4.3** as text |
| light | `--accent` on `--surface-2` #dfe6ec | **3.12** | 50.7 | **Fails 1.4.3** as text |
| light | `--accent` on `--accent-soft` #f8e2d2 (tag on a checked answer) | **3.15** | 51.2 | **Fails 1.4.3** |
| light | `--warn` #a2640b on `--bg` | **4.12** | 62.5 | **Fails 1.4.3** |
| light | `--warn` on `--surface-2` | **3.82** | 57.7 | **Fails 1.4.3** |
| light | `--ok` #2b7a44 on `--surface-2` | **4.20** | 60.6 | **Fails 1.4.3** |
| light | `--ok` on `--bg` | 4.53 | 65.5 | Passes by 0.03 |
| light | `--border` #a9b8c5 on bg / surface / surface-2 | 1.74 / 1.94 / 1.61 | — | Below 3:1. Fine for dividers. As the only outline of a prototype `.answer` card it is allowed, because the card has visible text and a radio (1.4.11 doesn't require a boundary then), but it is weak |
| light | `--border-strong` #6f8499 on `--surface-2` | 3.07 | — | Passes by 0.07 |
| dark | `--border-strong` #4d6a86 on `--surface` #122130 | **2.89** | — | **Fails 1.4.11** where it outlines an input or card on a surface |
| dark | `--border-strong` on `--surface-2` #192b3d | **2.56** | — | **Fails 1.4.11** |
| dark | `--border` #2e4760 on bg / surface / surface-2 | 1.85 / 1.70 / 1.50 | — | Decorative dividers only |
| dark | `--muted` #8aa1b6 on bg / surface / surface-2 | 6.65 / 6.11 / 5.40 | −48.8 / −47.8 / −46.1 | Passes WCAG, but is **below APCA Lc 60** |
| dark | `--danger` #f07268 on bg / surface / surface-2 | 6.19 / 5.69 / 5.03 | −46.3 / −45.3 / −43.6 | Weak under APCA |
| dark | `--hitl` #a98cf0 on bg / surface / surface-2 | 6.51 / 5.99 / 5.29 | −48.0 / −47.0 / −45.4 | Weak under APCA |
| dark | `--info` #6fa6db on bg / surface / surface-2 | 6.90 / 6.34 / 5.61 | −50.5 / −49.5 / −47.9 | Weak under APCA |
| dark | `--accent-ink` #1c0d03 on `--accent` #ff8a45 | 8.10 | 57.6 | Fine under WCAG. Slightly under Lc 60 for 13.5px button text |

### Pairs that pass comfortably

- **Light:** `--text` is 12.4–15.0:1 (Lc 87–99) on all surfaces. `--muted` is 5.15–6.20 (Lc 67–79). `--danger` is 4.71–5.67. `--info` is 5.26–6.33. `--hitl` is 5.04–6.07. `--text` on `--accent-soft` is 12.53. `--border-strong` on bg and surface is 3.31 and 3.69. The accent focus ring and active-tab underline on bg are 3.37 (3:1 is enough for non-text).
- **Dark:** `--text` is 11.2–13.8:1 (Lc −86 to −88). `--accent` is 6.17–7.59. `--ok` is 6.38–7.85. `--warn` is 7.06–8.69. The accent focus ring is ≥ 6.98.
- **Prototype composites:** `--text` on the changed-node fill (warn 14% on surface) is 12.51 light and 9.75 dark. `--muted` on the row-hover tint (accent 5%) is 5.83 light and 5.70 dark.

The full 80-row measurement is reproduced by `contrast.mjs` in the appendix.

### Candidate tweaks and their measured effect

The lightness moves are in OKLCH, with hue kept and chroma kept where the sRGB gamut allows. Each one is the smallest step that reaches the target.

| Token | Now | Proposed | Measured effect |
|---|---|---|---|
| light `--accent` (fills: primary button, progress, rules, focus ring) | #d05f1a | **#c45404** (ΔL −0.034) | White ink goes from 3.94 to **4.55** (Lc −71.6 → −76.3). The ring and underline on bg go from 3.37 to 3.89. It is still visibly signal orange |
| light `--accent-text` (**new**: accent-coloured text such as chips and tags). In dark it equals `--accent` | — | **#ab4904** (ΔL −0.090 from #d05f1a) | bg **4.88** (Lc 67.2), surface **5.44** (74.5), surface-2 **4.52** (62.4), accent-soft **4.56** (62.9), row hover 5.11 |
| light `--warn` | #a2640b | **#935902** (ΔL −0.040) | bg 4.12 → **4.90**, surface 4.60 → **5.46**, surface-2 3.82 → **4.54** (Lc 57.7 → 62.9) |
| light `--ok` | #2b7a44 | **#257540** (ΔL −0.016) | bg 4.53 → **4.86**, surface-2 4.20 → **4.51** |
| light `--border-strong` (optional, for margin) | #6f8499 | #6c8095 | surface-2 3.07 → 3.23, bg 3.31 → 3.48 |
| dark `--border-strong` | #4d6a86 | **#587592** (ΔL +0.038) | bg 3.15 → **3.70**, surface 2.89 → **3.40**, surface-2 2.56 → **3.01** |
| dark `--muted` | #8aa1b6 | **#9ab2c7** (ΔL +0.054) | Lc −48.8/−47.8/−46.1 → **−57.8/−56.8/−55.2**. The text:muted luminance ratio drops from 2.07 to 1.70, so the hierarchy is still clear |
| dark `--danger` | #f07268 | **#ff8f84** (ΔL +0.068) | Lc −46.3/−45.3/−43.6 → **−57.9/−56.9/−55.3** |
| dark `--info` | #6fa6db | **#7cb4ea** (ΔL +0.044) | Lc −50.5/−49.5/−47.9 → **−58.0/−57.0/−55.3** |
| dark `--hitl` | #a98cf0 | **#baa0ff** (ΔL +0.058) | Lc −48.0/−47.0/−45.4 → **−57.9/−56.9/−55.2** |

Alternatives that were measured and not recommended:

- **One darker `--accent` for everything (#ab4904).** It meets every text pair and gives white ink 5.70:1, but it turns signal orange into burnt orange and costs Drafting its accent.
- **A dark ink on the current light accent.** Navy `--text` on #d05f1a gives only **3.98**. The dark-mode ink #1c0d03 gives 4.81, which passes, but a black-on-orange primary button in light mode changes the look more than a slightly deeper orange does.
- **Dark secondary colours at a full Lc 60.** `--muted` #a3bbd0, `--danger` #ff9e94, `--info` #85bdf3 and `--hitl` #c1abff all reach Lc ≥ 60, but they drop the text:muted luminance ratio to 1.54, so muted stops reading as secondary. It also washes out the status hues. Lc 55 is the better trade for a single-user tool.

## 2. The 11px uppercase mono labels and chips, and the mono headings

**What the guidance says:**

- **All caps suits short labels, not running text.** Butterick lists caps as "suitable for headings shorter than one line …, headers, footers, captions, or other labels", and says "always add letterspacing to caps" ([All caps](https://practicaltypography.com/all-caps.html)). He recommends "5–12% extra space with caps, but not with lowercase", which is "particularly important at small sizes" ([Letterspacing](https://practicaltypography.com/letterspacing.html)).
- NN/g's glanceable-typography study (Frutiger, isolated words) found that "uppercase outperformed lowercase": lowercase took 26% longer, and condensed widths took 11.2% longer. It adds that "these findings don't necessarily apply to scanning or reading longer text" ([NN/g, Typography for Glanceable Reading](https://www.nngroup.com/articles/glanceable-fonts/)). Status chips and field labels are exactly the glance case.
- WCAG has no minimum font size. The Understanding doc for 1.4.3 notes that fonts with thin strokes are harder to read at low contrast, and advises exceeding the minimum ratio in that case ([Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- APCA Bronze sets no minimum size ([ARC](https://readtech.org/ARC/)). APCA's own font lookup table (`fontLookupAPCA` in `apca-w3` 0.1.9, reference font Barlow) doesn't admit 11px at weight 500 for *fluent* text at any reachable Lc: it needs Lc ≈ 115+, and the ceiling is about Lc 106. So by APCA's model, 11px labels only work as short, non-fluent "spot" text, never as sentences.

**Judgement for Drafting:**

- **Glyph size is not the problem.** Measured cap height is 0.730 em for JetBrains Mono, so an 11px label has **8.0px caps**. That is the x-height of 16.2px Atkinson Hyperlegible (x-height 0.496 em). Monospace caps are also evenly spaced: every advance is 0.600 em, close to the 0.634 em average of Atkinson's proportional caps, and narrow letters like I get the same cell as W. The labels are larger and more open than "11px" suggests.
- **Label tracking of 0.08em (8%) is inside Butterick's range.** The chips use `calc(var(--label-spacing) * .6)`, which is **0.048em (4.8%)**, just under it. The `h1`–`h3` use 0.04em, but those are 14.5–22px and weight 700 in a monospace with generous sidebearings, so that is acceptable. **Suggestion:** set the chips to the full 0.08em. The prototype's 10.5px `tag-suggested` is the smallest text in the system, so raise it to 11px so that all label text uses one size.
- **Contrast is the real risk at 11px.** Light `--muted` labels are at Lc 67–79, which is fine. Dark `--muted` labels are at Lc 46–49, which is weak (see the tweaks above). Light accent, warn and ok chips fail WCAG outright (see §1). Fixing the colours matters more than changing the size.
- **Uppercase mono headings (h1 22px, h2 16px, h3 14.5px, all 700) are fine for UI section names** of a few words. That is the "headings shorter than one line" case. **Don't put free text such as ticket titles, question text or plan summaries in `h1`–`h3`.** Uppercase removes word shape, which makes longer text slower to read, and NN/g's caveat applies. The prototype already sets ticket titles in `--font-ui` mixed case (`.ticket .title`) and uses uppercase only for surface titles such as "Questionnaire round" and "Confirm". Keep that rule explicit: a heading element or class for chrome, and mixed case for content.
- **`--text-size: 15px` with Atkinson Hyperlegible** gives a 7.4px x-height, about the same as Inter at 13.6px. That suits a dense tool, and there is no reason to shrink it.

## 3. The fonts compared

The metrics were measured from the Fontsource 5.3.0 Latin woff2 files. "Sample" is the advance width of "The quick brown fox jumps over the lazy dog" in em, which is a proxy for how many characters fit per line. All the candidates are **SIL OFL 1.1** and ship as self-hostable woff2, as the current fonts do (`atkinson-hyperlegible-OFL.txt` and `jetbrains-mono-OFL.txt` sit next to the woff2 files).

### UI (sans)

| Font | Version | x-height / em | Cap / em | Avg lowercase advance | Sample (em) | Weights (static woff2) | 400 Latin woff2 |
|---|---|---|---|---|---|---|---|
| **Atkinson Hyperlegible** (current) | 1.006 | 0.496 | 0.668 | 0.483 em | 19.52 | 400, 700 only | 17.2 KB |
| **Atkinson Hyperlegible Next** | 2.001 | 0.496 | 0.668 | 0.487 em | 19.61 | 200–800 (7) | 12.1 KB |
| Inter | 4.001 | 0.546 | 0.728 | 0.536 em | 21.36 | 100–900 | 23.7 KB |
| IBM Plex Sans | 3.201 | 0.516 | 0.698 | 0.505 em | 19.87 | 100–700 | 22.6 KB |
| Geist | 1.002 | 0.530 | 0.710 | 0.539 em | 21.01 | 100–900 | 33.4 KB |

- **Atkinson Hyperlegible Next** came out on 2025-02-10. The Braille Institute describes it as building on the 2019 face, with "seven weights (up from two)", a variable version, more than 150 languages, and free distribution via Google Fonts and BrailleInstitute.org ([Braille Institute announcement](https://www.brailleinstitute.org/about-us/news/braille-institute-launches-enhanced-atkinson-hyperlegible-font-to-make-reading-easier/)). Its vertical metrics match v1 exactly and its widths are within 1%, so it's a drop-in upgrade: layouts won't reflow, and it fixes the missing 500/600 weights (§ Answer, item 6). Atkinson's distinctive, disambiguated letterforms (the I/l/1 and O/0 distinctions its design is known for) are also a large part of what gives Drafting its character.
- **Inter and Geist** have larger x-heights (0.546 and 0.530), but they are also about 9–10% wider, so a 14px Inter line costs roughly the same horizontal room as a 15px Atkinson line and gives little net density gain. They would also make Drafting look like every other SaaS tool, which works against "keeping Drafting's character".
- **IBM Plex Sans** is the closest in width to Atkinson (+2%), with a slightly larger x-height. It's a credible alternative with an engineered feel, but it offers no clear legibility gain over Atkinson Next, and switching would cost the hyperlegible letterforms.

### Mono

| Font | Version | x-height / em | Cap / em | Advance | Weights | 400 Latin woff2 |
|---|---|---|---|---|---|---|
| **JetBrains Mono** (current) | 2.211 | **0.550** | 0.730 | 0.600 em | 100–800 | 21.2 KB |
| Atkinson Hyperlegible Mono | 2.001 | 0.496 | 0.668 | **0.632 em** | 200–800 | 10.1 KB |
| IBM Plex Mono | 2.3 | 0.516 | 0.698 | 0.600 em | 100–700 | 14.7 KB |
| Geist Mono | 1.701 | 0.530 | 0.710 | 0.600 em | 100–900 | 9.9 KB |

- **JetBrains Mono has the tallest x-height and caps of the group at the standard 0.6 em advance.** JetBrains states the design goal as: "Characters remain standard in width, but the height of the lowercase is maximized" ([JetBrains Mono](https://www.jetbrains.com/lp/mono/)). For 11px uppercase labels, cap height is what counts, and JetBrains Mono's 0.730 is the largest here.
- **Atkinson Hyperlegible Mono** would match the UI face, but it is **5% wider** (0.632 em) and has **8.5% shorter caps** (0.668). At the same 11px it gives 7.3px caps instead of 8.0px, and it takes more width. That makes it worse for the label and chip role, not better.
- IBM Plex Mono and Geist Mono are good faces, but both are smaller on the vertical metrics that matter here. Neither would improve the labels.

## 4. Font weights in use against weights shipped

Only `kit.css` ships `@font-face` rules: Atkinson Hyperlegible 400/700 and JetBrains Mono 400/500/700. CSS font matching ([CSS Fonts 4 §5.2](https://www.w3.org/TR/css-fonts-4/#font-style-matching)) resolves a requested 600 to the next heavier available face (700), and a requested 500 in the 400–500 band to 400. The prototype's `.btn`, `.answer .a-title`, accordion summaries and `.tag-suggested` ask for 600, and `.ticket .title` asks for 500. On the UI face they render as 700 and 400. The mono `.lane-label` also asks for 600 and renders as 700. The prototype loads the same weights from Google Fonts (Atkinson 400/700, JetBrains Mono 400/500/700), so what you see there is what aisf would render. The `.label` and `.chip` classes ask for mono 500, which is shipped, so they are unaffected. With Atkinson Hyperlegible Next, ship at least 400, 600 and 700, or use the single variable file, so that the intended weights render.

## Implications for aisf

- **Fix the two real WCAG failures in `kit.css` first. Both are one-line token changes:** light `--accent` #d05f1a → **#c45404**, so white button text reaches 4.55:1, and light `--warn` → **#935902** and `--ok` → **#257540**, so status text reaches ≥ 4.5 on every surface. Dark `--border-strong` → **#587592** makes input and card borders reach 3:1.
- **Add one token, `--accent-text`** (light **#ab4904**, dark = `--accent`), and use it wherever orange is used for *text*: chips, tags and links. `--accent` stays the bright fill, rule and focus colour, so the signal orange survives.
- **Lift the dark secondary colours by about +0.05 OKLCH L** (`--muted` #9ab2c7, `--danger` #ff8f84, `--info` #7cb4ea, `--hitl` #baa0ff), from Lc 44–50 to Lc 55–58. The 11px labels, which are drawn in these colours, benefit most.
- **Keep the 11px uppercase mono labels, but restrict them to short labels.** Use the full 0.08em tracking on chips too, make 11px the floor (raise the 10.5px tag), and keep uppercase mono headings for chrome only. Ticket titles and questionnaire text stay in mixed-case `--font-ui`.
- **Keep JetBrains Mono. Swap Atkinson Hyperlegible for Atkinson Hyperlegible Next**, which has the same metrics, is OFL, self-hosts from Fontsource, is smaller per weight and has real 500/600 weights. Don't move to Inter, Geist or Atkinson Mono.
- **The prototype `directions.html` shares every token**, so the questionnaire and confirm bridge pages pick up these fixes automatically once they read `kit.css`. Its `tag-suggested` (accent text on `--accent-soft`, currently 3.15:1) is the pair that most needs `--accent-text`, which measures 4.56 there.

## Appendix: reproduction

Setup: `npm i apca-w3@0.1.9 fontkit @fontsource/{atkinson-hyperlegible,atkinson-hyperlegible-next,atkinson-hyperlegible-mono,inter,ibm-plex-sans,ibm-plex-mono,geist-sans,geist-mono,jetbrains-mono}` in a scratch directory. Node 18 is enough.

`contrast.mjs` (WCAG and APCA for every pair):

```js
import { APCAcontrast, sRGBtoY } from 'apca-w3';
export const themes = {
  light: { bg: '#e9eef2', surface: '#f8fafb', 'surface-2': '#dfe6ec', border: '#a9b8c5', 'border-strong': '#6f8499', text: '#13243a', muted: '#4c6075', accent: '#d05f1a', 'accent-ink': '#ffffff', 'accent-soft': '#f8e2d2', ok: '#2b7a44', warn: '#a2640b', danger: '#b8322f', info: '#2d5f93', hitl: '#6b47c2' },
  dark: { bg: '#0d1924', surface: '#122130', 'surface-2': '#192b3d', border: '#2e4760', 'border-strong': '#4d6a86', text: '#d8e4ee', muted: '#8aa1b6', accent: '#ff8a45', 'accent-ink': '#1c0d03', 'accent-soft': '#3b2515', ok: '#5cc07a', warn: '#e5ab4e', danger: '#f07268', info: '#6fa6db', hitl: '#a98cf0' },
};
export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (h) => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const wcag = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const apca = (t, b) => APCAcontrast(sRGBtoY(hex2rgb(t)), sRGBtoY(hex2rgb(b)));
// for each theme: text/muted/accent/ok/warn/danger/info/hitl × bg/surface/surface-2,
// accent-ink on accent, text/muted/accent on accent-soft, border/border-strong × the three surfaces
```

`tweaks.mjs` converts each colour to OKLCH (Ottosson's matrices), steps L by 0.002 in one direction (reducing chroma only when out of gamut), and returns the first hex that meets the target: `min(wcag over the surfaces) ≥ 4.5` for text, `≥ 3` for borders, or `min(|Lc|) ≥ 55/60` for the dark secondaries.

`fonts.mjs` opens each `@fontsource/<pkg>/files/<pkg>-latin-400-normal.woff2` with `fontkit.create()` and reports `xHeight / unitsPerEm`, `capHeight / unitsPerEm`, and the laid-out advance of a–z, A–Z and the pangram.
