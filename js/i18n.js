/* ============================================================
 * Laskupaja – i18n runtime (FI default, EN secondary)
 * - Strings live in dictionaries; pages mark elements with
 *   data-i18n="key" (textContent), data-i18n-placeholder="key",
 *   data-i18n-title="key", data-i18n-label="key" (sets data-label
 *   for responsive table CSS) and data-i18n-aria="key".
 * - Page scripts register page-specific dictionaries via
 *   LP.i18n.register({ fi: {...}, en: {...} }) before DOMContentLoaded.
 * - Language choice persists in localStorage (laskupaja:lang).
 * - Changing language re-applies translations and dispatches
 *   "lp:langchange" on document so dynamic renderers can refresh.
 * ============================================================ */
(function () {
  'use strict';

  const LP = (window.LP = window.LP || {});
  const STORAGE_KEY = 'laskupaja:lang';
  /* NOTE: the language choice (laskupaja:lang) is a non-personal UI setting,
   * not user data. It intentionally keeps persisting even when the user opts
   * out of data storage on the invoice page ("Remember my details" = off):
   * that opt-out wipes personal data keys only (see LS_DATA_KEYS in
   * js/invoice.js), and the spec explicitly allows the language preference
   * to survive the wipe. */

  /* Shared strings used by every page. */
  const SHARED = {
    fi: {
      'nav.home': 'Etusivu',
      'nav.invoice': 'Lasku',
      'nav.vat': 'ALV-laskuri',
      'footer.disclaimer':
        'Ei oikeudellista neuvontaa. Tarkista laskun tiedot ennen lähettämistä.',
      'footer.sources': 'ALV-kannat 2026: vero.fi',
      'footer.privacy': 'Kaikki tiedot käsitellään vain selaimessasi – mitään ei lähetetä palvelimelle.',
      'vat.255': '25,5 % – yleinen',
      'vat.135': '13,5 % – alennettu (1.1.2026 alkaen; aiemmin 14 %)',
      'vat.10': '10 % – esim. kirjat, lääkkeet, majoitus',
      'vat.0': '0 % – veroton',
      'common.copy': 'Kopioi',
      'common.copied': 'Kopioitu ✓',
    },
    en: {
      'nav.home': 'Home',
      'nav.invoice': 'Invoice',
      'nav.vat': 'VAT calculator',
      'footer.disclaimer':
        'Not legal advice. Check the invoice details before sending.',
      'footer.sources': '2026 VAT rates: vero.fi (Finnish Tax Administration)',
      'footer.privacy':
        'Everything is processed in your browser only – nothing is sent to a server.',
      'vat.255': '25.5% – general',
      'vat.135': '13.5% – reduced (from 1 Jan 2026; previously 14%)',
      'vat.10': '10% – e.g. books, medicines, accommodation',
      'vat.0': '0% – zero-rated',
      'common.copy': 'Copy',
      'common.copied': 'Copied ✓',
    },
  };

  const dicts = {
    fi: Object.assign({}, SHARED.fi),
    en: Object.assign({}, SHARED.en),
  };

  /* Page-level default: /en/ pages set data-lp-lang="en" on <html>.
   * Used only when the visitor has made no explicit choice (no stored
   * value). Finnish pages have no attribute, so their default stays 'fi'. */
  function defaultLang() {
    return document.documentElement.getAttribute('data-lp-lang') === 'en' ? 'en' : 'fi';
  }

  function readStoredLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'en' || v === 'fi' ? v : defaultLang();
    } catch (e) {
      return defaultLang();
    }
  }

  let lang = readStoredLang();

  function t(key) {
    return (dicts[lang] && dicts[lang][key]) || dicts.fi[key] || key;
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    /* data-label powers the responsive stacked table (CSS content: attr(data-label)) */
    scope.querySelectorAll('[data-i18n-label]').forEach((el) => {
      el.setAttribute('data-label', t(el.getAttribute('data-i18n-label')));
    });
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang-toggle]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-lang-toggle') === lang);
      b.setAttribute('aria-pressed', b.getAttribute('data-lang-toggle') === lang ? 'true' : 'false');
    });
  }

  function setLang(next) {
    if (next !== 'fi' && next !== 'en') return;
    if (next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* private mode: language still works for this session */
    }
    apply();
    document.dispatchEvent(new CustomEvent('lp:langchange', { detail: { lang } }));
  }

  LP.i18n = {
    register(pageDicts) {
      Object.assign(dicts.fi, pageDicts.fi || {});
      Object.assign(dicts.en, pageDicts.en || {});
    },
    t,
    apply,
    setLang,
    getLang() {
      return lang;
    },
  };

  /* Language toggle buttons anywhere in the document. */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang-toggle]');
    if (btn) setLang(btn.getAttribute('data-lang-toggle'));
  });

  document.addEventListener('DOMContentLoaded', () => apply());
})();
