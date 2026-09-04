# Laskupaja 🧾

**Ilmainen laskutusverstaas** – a free, zero-backend invoice generator and ALV
calculator for Finnish freelancers and small businesses. Everything runs in the
browser: no signup, no server, no tracking, no external network calls.

- Suomeksi (oletus), englanniksi, espanjaksi ja saksaksi · Finnish (default), English, Spanish and German
- Correct **2026 VAT rates** from day one: general **25,5 %**, reduced
  **13,5 %** (from **1.1.2026**, previously 14 %), **10 %**, **0 %**
- Pure client-side HTML/CSS/JS. No build step, no npm, no CDNs, no fonts
  fetched from anywhere. Hostable on any static host.

## Pages

| Path | Purpose |
|---|---|
| `/` | Homepage: value proposition FI/EN, links to tools, FAQ, SEO text |
| `/lasku/` | Invoice generator (line items, VAT breakdown, references, A4 print) |
| `/alv/` | ALV calculator (add/remove VAT, 2026 rates + custom %, rate info) |
| `/es/` | Spanish homepage: value proposition, tool links, IVA 21 % SEO copy |
| `/es/factura/` | Invoice generator, Spanish default (data-lp-lang="es"), IVA presets 21/10/4/0 via data-lp-country="ES" |
| `/de/` | German homepage: value proposition, §19 UStG note, MwSt. 19 % SEO copy |
| `/de/rechnung/` | Invoice generator, German default (data-lp-lang="de"), MwSt. presets 19/7/0 via data-lp-country="DE" |

## Features

- **Invoice generator** (`/lasku/`): sender & client blocks (name, Y-tunnus,
  address, IBAN), invoice number, invoice date, payment terms in days with
  auto-computed due date, line items (description, qty, unit, unit price,
  per-line VAT %), "prices include VAT" toggle, totals with **VAT breakdown by
  rate** (net / VAT / gross, EUR only).
- **VAT options (2026-correct)**: 25,5 % (yleinen), 13,5 % (alennettu,
  1.1.2026 alkaen – aiemmin 14 %), 10 %, 0 %. Labelled in the UI and cited.
- **EU reverse charge (B2B, 0 %)**: checkbox on every generator locale
  (FI/EN/ES/DE). When enabled, all line VAT is forced to 0 % and the
  invoice carries the mandatory art. 196 annotation (Directive
  2006/112/EC) in the print view and summary; per-row rates are
  remembered and restored on uncheck, and the state persists with the
  draft.
- **Viitenumero**: both the Finnish national creditor reference (weights 7-3-1,
  mod 10) and the international **RF reference (ISO 11649)** – generated from
  the invoice number, plus a paste-and-check validator that auto-detects the
  format. Proven by `tests/reference.test.js`.
- **FI/EN language toggle** persisted in `localStorage`; every UI string (and
  the printed invoice) exists in both languages.
- **Business profile ("Omat tiedot")**: sender name, Y-tunnus, address, IBAN
  plus default payment terms and default VAT % are stored under their own
  `localStorage` key, separately from the per-invoice draft, and prefilled on
  every load. "New invoice" keeps the profile, clears client/rows/message,
  auto-increments the number and resets dates (today / today + default terms).
- **Invoice numbering**: trailing digits are incremented with prefix and zero
  padding preserved ("2026-004" → "2026-005", "INV007" → "INV008"); values
  without trailing digits stay editable as-is. First visit prefills
  `YYYY-001`. Proven by `tests/increment.test.js`.
- **Storage transparency & opt-out**: the invoice page shows an info box
  (FI/EN) explaining that data is stored only in the browser. "Remember my
  details on this device" (default on) toggles all persistence; turning it
  off – or "Clear saved data" – wipes every data key the app writes
  (draft, last invoice number, profile). The language preference is a
  non-personal UI setting and may persist.
- **Print to PDF** (Ctrl+P / button): professional A4 print stylesheet –
  invoice header, item table, right-aligned totals, payment block
  (IBAN + viite + RF + amount + due date), footer disclaimer
  *“Ei oikeudellista neuvontaa / Not legal advice”*.
- **Draft autosave** to `localStorage`; remembers the last invoice number and
  suggests the next one; “New invoice” asks for confirmation first.
- **ALV calculator** (`/alv/`): amount + direction (net→gross / gross→net) +
  rate selector (25,5 / 13,5 / 10 / 0 / custom %), live results, plus an info
  section about the 2026 rate change with vero.fi citations.

## Sources for the 2026 VAT rates (verified 2026-09-02)

- Alennettu kanta 14 % → **13,5 %** 1.1.2026 alkaen:
  <https://www.vero.fi/tietoa-verohallinnosta/uutishuone/verotuksen_muutoksia/alv-kannan-aleneminen/>
- Voimassa olevat kannat (yleinen 25,5 %):
  <https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/arvonlisaverotus/arvonlisaveroprosentit/>

Viitenumero algorithms: Finanssiala ry viitenumero-ohje (7-3-1) and
ISO 11649 (RF, mod 97). See comments in `js/reference.js`.

## Run locally

No build step. Either open `index.html` directly in a browser, or serve the
folder (nicer, matches production URLs):

```bash
cd laskupaja
python3 -m http.server 8000
# → http://localhost:8000/
```

Run the tests (plain Node + Python stdlib, no dependencies):

```bash
node tests/reference.test.js   # viitenumero (RF + national)
node tests/increment.test.js   # invoice number increment
python3 tests/integrity.py     # HTML/i18n/id/CSS integrity checks
```

## Deploy

### GitHub Pages

1. Push this folder's contents to a repository (repo root = site root).
2. Repo **Settings → Pages → Source**: deploy from branch, e.g. `main` / `/ (root)`.
3. Site lands at `https://<user>.github.io/<repo>/`. Relative asset paths
   (`css/…`, `js/…`, `lasku/`, `alv/`) work on any base path.

### Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Direct Upload**
   (no build command needed) or connect the Git repo with
   *Build command* empty and *Output directory* `/`.
2. Add a custom domain when ready.

**Before launch (both):** replace `laskupaja.com` with the real domain in
`index.html`, `lasku/index.html`, `alv/index.html` (canonical + `og:url` +
`og:image`) and `sitemap.xml` + `robots.txt`.

## SEO keyword targets

Primary (FI): **ilmainen laskupohja**, **laskutusohjelma ilmainen**,
**lasku pdf**, **alv laskuri**, **alv 13,5 2026**.
Secondary (EN): *free invoice generator Finland*, *Finnish VAT calculator*.
These appear naturally in titles, meta descriptions, H1s and body copy;
`sitemap.xml` + `robots.txt` are included. Next SEO steps after launch:
Google Search Console verification, a few genuinely useful backlinks
(freelancer communities, forums), and page-speed upkeep (the site is a few KB,
so this should stay easy).

## Monetization (NOT YET – placeholders only)

The app contains **no ad or affiliate code**. Reserved spots are marked with
`<!-- MONETIZATION SLOT … -->` comments in `index.html` (hero-below +
"kokeile myös" section), `lasku/index.html` (below-tools) and
`alv/index.html` (below-calculator).

Plan once there is real traffic (~1k+ visits/month):

1. **Affiliate first** (“kokeile myös” section): accounting/invoicing tools
   buy ads on these exact keywords – candidates: **Holvi, UKKO, SimplBooks**
   (plus later Procountor, Fennoa). Manual, honest one-line reviews.
2. **AdSense second**, only if affiliates underperform; keep it below the
   tools so the product stays fast and clean.
3. Track outbound clicks with a tiny redirect-free `rel="sponsored"` link +
   analytics only if a privacy-friendly, client-side option is acceptable.

## Competitors (short version – see `notes/competitors.md`)

- `laskutuskone.fi` – free template hook + freemium software funnel.
- `ilmainenlaskutusohjelma.fi` – single-page free tool, dated UI, FI-only.
- Laskupaja's edge: 2026 VAT rates from day one, FI/EN, modern UI,
  privacy-first, bonus ALV calculator.

## Project layout

```
laskupaja/
├── index.html          # homepage
├── lasku/index.html    # invoice generator
├── alv/index.html      # ALV calculator
├── css/style.css       # shared styles incl. A4 print stylesheet
├── js/i18n.js          # FI/EN runtime (shared strings, localStorage)
├── js/reference.js     # viitenumero: national 7-3-1 + RF (ISO 11649)
├── js/numbering.js     # invoice number increment (prefix/padding-preserving)
├── js/invoice.js       # invoice logic (rows, totals, profile, drafts, print view)
├── js/calculator.js    # ALV calculator
├── js/home.js          # homepage strings
├── assets/             # favicon.svg, og-cover.svg
├── tests/reference.test.js
├── notes/competitors.md
├── robots.txt · sitemap.xml
└── README.md · LICENSE (MIT)
```

## License

MIT – see `LICENSE`.
