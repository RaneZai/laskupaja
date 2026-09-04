/* ============================================================
 * Laskupaja – i18n runtime (FI default, EN/ES/DE secondary)
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

  /* Supported languages. FI/EN is the original pair (default 'fi');
   * ES and DE pages set <html data-lp-lang="es|de"> for their default. */
  const LANGS = ['fi', 'en', 'es'];

  /* Which languages each site family may show. The FI and EN sites share
   * the FI/EN pair (historic behaviour); the ES and DE sites pair their own
   * language with English. A stored choice is honoured only inside the
   * current family, so an FI/EN choice never hijacks an ES page and vice
   * versa. */
  const FAMILY = {
    fi: ['fi', 'en'],
    en: ['fi', 'en'],
    es: ['es', 'en'],
    de: ['de', 'en'],
  };

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
    es: {
      'nav.home': 'Inicio',
      'nav.invoice': 'Factura',
      'nav.vat': 'Calculadora de IVA',
      'footer.disclaimer':
        'No es asesoramiento jurídico. Revisa los datos de la factura antes de enviarla.',
      'footer.sources': 'Tipos de IVA 2026: fuentes oficiales',
      'footer.privacy':
        'Todo se procesa únicamente en tu navegador – nada se envía a ningún servidor.',
      /* Finnish 2026 rate labels (shown only if an ES page ever runs with
       * the fixed FI option list; the /es/ generator uses IVA presets). */
      'vat.255': '25,5 % – general (Finlandia)',
      'vat.135': '13,5 % – reducido (Finlandia; desde 1.1.2026, antes 14 %)',
      'vat.10': '10 % – p. ej. libros, medicamentos, alojamiento',
      'vat.0': '0 % – exento',
      'common.copy': 'Copiar',
      'common.copied': 'Copiado ✓',
    },
  };

  const dicts = {};
  LANGS.forEach((l) => { dicts[l] = Object.assign({}, SHARED[l]); });

  /* Page-level default: /en/ pages set data-lp-lang="en" on <html>.
   * Used only when the visitor has made no explicit choice (no stored
   * value). Finnish pages have no attribute, so their default stays 'fi'.
   * ES/DE generator pages use data-lp-lang="es" / "de" the same way. */
  function defaultLang() {
    const v = document.documentElement.getAttribute('data-lp-lang');
    return LANGS.indexOf(v) !== -1 ? v : 'fi';
  }

  function readStoredLang() {
    const family = FAMILY[defaultLang()];
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && family.indexOf(v) !== -1) return v;
    } catch (e) {
      /* private mode */
    }
    return defaultLang();
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
    if (FAMILY[defaultLang()].indexOf(next) === -1) return;
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
      Object.keys(pageDicts).forEach((l) => {
        if (dicts[l]) Object.assign(dicts[l], pageDicts[l] || {});
      });
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
