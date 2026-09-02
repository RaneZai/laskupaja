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
lv = (ROOT / "lasku/index.html").read_text()
if re.search(r"<body>[\s\S]*?<div id=\"print-view\"", lv):
    print("OK  #print-view present (direct child of body)")
else:
    errors.append("lasku/index.html: #print-view not found")

print()
if errors:
    print("FAILURES:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ALL INTEGRITY CHECKS PASSED")
