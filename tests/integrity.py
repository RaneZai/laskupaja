#!/usr/bin/env python3
"""Laskupaja integrity checks (no deps): HTML tag balance, i18n key coverage,
JS-referenced element ids, CSS brace balance."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = {
    "index.html": ["js/i18n.js", "js/home.js"],
    "lasku/index.html": ["js/i18n.js", "js/numbering.js", "js/invoice.js"],
    "alv/index.html": ["js/i18n.js", "js/calculator.js"],
    # English/EU layer (static EN pages carry no data-i18n attrs; the
    # invoice entry loads the same dicts plus js/vat-context.js).
    "en/index.html": [],
    "en/invoice/index.html": ["js/i18n.js", "js/vat-context.js", "js/numbering.js", "js/invoice.js"],
    "en/vat/de/index.html": [],
    "en/vat/fr/index.html": [],
    "en/vat/it/index.html": [],
    "en/vat/es/index.html": [],
    "en/vat/nl/index.html": [],
    "en/vat/pl/index.html": [],
    "en/vat/se/index.html": [],
    "en/vat/ie/index.html": [],
    # Spanish site (static homepage; the generator loads the shared engine
    # plus the country-preset context, like /en/invoice/).
    "es/index.html": [],
    "es/factura/index.html": ["js/i18n.js", "js/vat-context.js", "js/numbering.js", "js/invoice.js"],
    # German site (same pattern as the Spanish site).
    "de/index.html": [],
    "de/rechnung/index.html": ["js/i18n.js", "js/vat-context.js", "js/numbering.js", "js/invoice.js"],
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}
errors = []

# ---------- 1. HTML tag balance ----------
class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()))
    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            errors.append(f"{self.getpos()}: closing </{tag}> with empty stack")
            return
        open_tag, pos = self.stack.pop()
        if open_tag != tag:
            errors.append(f"{self.getpos()}: </{tag}> closes <{open_tag}> (opened {pos})")

for page in PAGES:
    src = (ROOT / page).read_text()
    c = Checker()
    c.feed(src)
    c.close()
    leftover = [t for t, _ in c.stack if t != "html"]
    if leftover:
        errors.append(f"{page}: unclosed tags {leftover}")
    else:
        print(f"OK  tag balance: {page}")

# ---------- 2. i18n key coverage ----------
def dict_keys(js_path):
    src = (ROOT / js_path).read_text()
    return set(re.findall(r"'([a-zA-Z0-9_.]+)'\s*:", src))

ATTRS = ("data-i18n", "data-i18n-placeholder", "data-i18n-label",
         "data-i18n-title", "data-i18n-aria")
for page, scripts in PAGES.items():
    html = (ROOT / page).read_text()
    used = set()
    for attr in ATTRS:
        used |= set(re.findall(attr + r'="([^"]+)"', html))
    used |= set(re.findall(r"""(?:LP\.i18n\.t|data-i18n="\w)""", ""))  # no-op keep simple
    known = set()
    for js in scripts:
        known |= dict_keys(js)
    missing = sorted(k for k in used if k not in known)
    if missing:
        errors.append(f"{page}: i18n keys missing from dictionaries: {missing}")
    else:
        print(f"OK  i18n keys ({len(used)} used): {page}")

# ---------- 3. JS-referenced ids exist in the page ----------
for page, scripts in PAGES.items():
    html = (ROOT / page).read_text()
    html_ids = set(re.findall(r'id="([^"]+)"', html))
    for js in scripts:
        js_src = (ROOT / js).read_text()
        for ref in set(re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", js_src)):
            if ref not in html_ids:
                errors.append(f"{page}: id '#{ref}' used in {js} not found in HTML")
    print(f"OK  id cross-check: {page}")

# ---------- 4. CSS brace balance ----------
css = (ROOT / "css/style.css").read_text()
if css.count("{") == css.count("}"):
    print(f"OK  css braces balanced ({css.count('{')} rules)")
else:
    errors.append(f"css braces: {{={css.count('{')} }}={css.count('}')}")

# ---------- 5. print-view is direct child of body (print CSS depends on it) ----------
for lv in ["lasku/index.html", "en/invoice/index.html", "es/factura/index.html",
           "de/rechnung/index.html"]:
    src = (ROOT / lv).read_text()
    if re.search(r"<body>[\s\S]*?<div id=\"print-view\"", src):
        print(f"OK  #print-view present (direct child of body): {lv}")
    else:
        errors.append(f"{lv}: #print-view not found")

# ---------- 6. i18n key parity across locales ----------
PARITY_LOCALES = ["fi", "en", "es", "de"]

def _brace_block(src, start):
    """src[start] must be '{'; return the inner text of the balanced block."""
    depth = 0
    for k in range(start, len(src)):
        if src[k] == "{":
            depth += 1
        elif src[k] == "}":
            depth -= 1
            if depth == 0:
                return src[start + 1:k]
    return None

def _locale_keys(block, locale):
    m = re.search(r"\b" + locale + r"\s*:\s*\{", block)
    if not m:
        return None
    inner = _brace_block(block, m.end() - 1)
    if inner is None:
        return None
    return set(re.findall(r"'([a-zA-Z0-9_.]+)'\s*:", inner))

for js, anchor, what in [
    ("js/i18n.js", "const SHARED =", "shared strings"),
    ("js/invoice.js", "LP.i18n.register({", "invoice page strings"),
]:
    src = (ROOT / js).read_text()
    i = src.find(anchor)
    block = _brace_block(src, src.find("{", i)) if i != -1 else None
    if block is None:
        errors.append(f"{js}: dictionary block after '{anchor}' not found")
        continue
    keysets = {loc: _locale_keys(block, loc) for loc in PARITY_LOCALES}
    missing = [loc for loc, ks in keysets.items() if ks is None]
    if missing:
        errors.append(f"{js}: {what}: missing locale dict(s) {missing}")
        continue
    base = keysets["fi"]
    ok = True
    for loc in PARITY_LOCALES[1:]:
        if keysets[loc] != base:
            errors.append(
                f"{js}: {what}: locale '{loc}' key set differs from 'fi' "
                f"(missing {sorted(base - keysets[loc])}, extra {sorted(keysets[loc] - base)})")
            ok = False
    if ok:
        print(f"OK  {what}: key parity across {PARITY_LOCALES} ({len(base)} keys)")

# ---------- 7. no external resources; local refs resolve ----------
# The Cloudflare Web Analytics beacon is the only allowed external resource.
BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js"
for page in PAGES:
    html = (ROOT / page).read_text()
    for m in re.finditer(r'<script[^>]+src="(https?://[^"]+)"', html):
        if m.group(1) != BEACON_SRC:
            errors.append(f"{page}: external script {m.group(1)}")
    for m in re.finditer(r'<link\b[^>]*>', html):
        tag = m.group(0)
        rel = re.search(r'rel="([^"]+)"', tag)
        href = re.search(r'href="(https?://[^"]+)"', tag)
        if href and rel and re.search(r"stylesheet|icon|preload|modulepreload|fetch", rel.group(1)):
            errors.append(f"{page}: external link resource {href.group(1)}")
    base = (ROOT / page).parent
    for m in re.finditer(r'(?:src|href)="([^"#?]+)"', html):
        u = m.group(1)
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", u) or u.startswith("//"):
            continue  # external URL, checked above
        if u.endswith("/"):
            continue  # page route, not a file
        if not (base / u).resolve().exists():
            errors.append(f"{page}: broken local reference {u}")
print("OK  resources: no external scripts/stylesheets besides the beacon; local refs resolve")

print()
if errors:
    print("FAILURES:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ALL INTEGRITY CHECKS PASSED")
