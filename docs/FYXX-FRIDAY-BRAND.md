# Fyxx Friday — brand guidelines

Source: Andrea's Illustrator file (shared by Naim, 19 Nov 2026). Use these for
**everything**: the landing page, the emails, the story overlays and any new
design. **Five colours, nothing else.**

## Colours

| Colour | Hex | Where Andrea uses it |
|---|---|---|
| **Red** | `#F61D2F` | Background of Post-02, Post-03 and Story-03. The "2026" numerals on Post-01 and Post-05. The logo and "NOVEMBER 27" on the cream designs (Post-04, Post-06, Story-02, Story-04). The starburst and the copy blocks on Post-06 and Story-02. |
| **Burgundy** | `#480016` | Background of Post-01, Post-05 and Story-01. |
| **Cream** | `#F3EFEA` | Background of Post-04, Post-06, Story-02 and Story-04. The "fyxx Friday" logo on the burgundy and red designs (it looks white, it is this cream). |
| **Warm cream** | `#FBF1E3` | Only on Post-02: the "2026" numerals and "NOVEMBER 27". Also on the printable poster. |
| **Black** | `#000000` | The logo on Post-02, Post-06 and Story-02. Body text and "SPECIAL OFFERS. BEST DEALS." on the cream and red designs. The copy block text on Post-05. |

- **No pure white anywhere.** Anything that looks white is cream `#F3EFEA`.
- **Black is never a background**: only logos and text.

### Allowed pairings (text on background)

| Background | Logo | Headline / "NOVEMBER 27" | Body text |
|---|---|---|---|
| Cream `#F3EFEA` | Red (or Black on Post-06 / Story-02) | Red | Black |
| Red `#F61D2F` | Cream (or Black on Post-02) | Warm cream (Post-02 only) or Cream | Black |
| Burgundy `#480016` | Cream | Red ("2026") | Cream |

## Logo

Official "fyxx Friday" logo SVGs (from Naim's Drive, "Fyxx Friday 2026 Logos
(SVG)"), one per palette colour, in `public/brand/`:

| File | Use on |
|---|---|
| `fyxx-friday-logo-cream.svg` | Burgundy and red backgrounds (most designs) |
| `fyxx-friday-logo-red.svg` | Cream backgrounds (Post-04, Story-04, the site's cream header) |
| `fyxx-friday-logo-black.svg` | Post-02, Post-06 and Story-02 |
| `fyxx-friday-logo-warm-cream.svg` | Post-02 accents / the printable poster only |
| `fyxx-friday-logo-burgundy.svg` | In the file, but not used in Andrea's designs |

Website: `<img src="/brand/fyxx-friday-logo-cream.svg">` (aspect ratio 2587 × 1446).

## Fonts

**Aktiv Grotesk** (Adobe Fonts): **Medium**, **Ex Medium**, **Ex Bold**, **Ex XBold**.
"Ex" = the Extended width (Adobe family name `aktiv-grotesk-extended`).

- Website: loaded from the Fyxx Adobe Fonts web project `xse1zxg`
  (`https://use.typekit.net/xse1zxg.css`). That project currently has regular
  Aktiv Grotesk but **not the Extended width yet**: add it in Adobe Fonts
  (see below) and the site's headings switch to it automatically.
- Emails: most email apps (Gmail, Outlook) don't load Adobe Fonts. Put
  headlines and the logo in **images**, and set live text as
  `"aktiv-grotesk", Helvetica, Arial, sans-serif` so it falls back cleanly.

### Adding Aktiv Grotesk Extended to the web project (one-time)

1. fonts.adobe.com → **My Adobe Fonts → Web Projects** → the project with ID
   **xse1zxg** → **Edit project**.
2. Add **Aktiv Grotesk Extended**: Medium, Bold and XBold (normal, not italic).
3. **Save**. Within a few minutes `friday.myfyxx.com` headings use it. No
   code change needed. (Check the project's allowed domains include
   `friday.myfyxx.com` or `*.myfyxx.com`.)

## Where it lives in the website code

- Colours are theme tokens in `src/styles.css`: `--ff-red`, `--ff-burgundy`,
  `--ff-cream`, `--ff-warm-cream`, `--ff-black`, available as Tailwind classes
  `bg-ff-red`, `text-ff-cream`, `border-ff-red`, etc. The base UI colours
  (background, text, buttons, borders) are all set from them.
- **Never hard-code a hex** in a component; use the `ff-*` classes.
- Product photos have white backgrounds in Shopify; the site blends them onto
  cream (`mix-blend-multiply`) so no white boxes appear.

## Emails (Klaviyo)

- Body background **Cream**; header band **Burgundy** with the **cream** logo
  (like Post-01), or **Red** with the cream logo (like Post-03).
- Headline images exported from Andrea's file; live text **Black** on cream.
- Buttons: **Red** background, **Cream** text ("SHOP NOW").
- Footer: **Burgundy** background, **Cream** text.
- Never white: set the email's outer and inner backgrounds to `#F3EFEA`.

## Story overlays (1080 × 1920)

- Use Andrea's Story-01 to Story-04 as the base.
- Keep text and stickers out of the top **250 px** and bottom **340 px**
  (Instagram's name bar and reply box cover them).
- Overlay text: **Cream** on burgundy/red, **Black** on cream; links/stickers
  in **Red** on cream.
- Link stickers should point to a tagged link, e.g.
  `https://friday.myfyxx.com/?utm_source=instagram&utm_medium=story&utm_campaign=bf26`.
