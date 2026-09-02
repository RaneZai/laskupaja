/* ============================================================
 * Laskupaja – viitenumero utilities (no dependencies)
 *
 * 1) Finnish national creditor reference ("kotimainen viitenumero")
 *    - Digits only, total length 4-20 chars (base 3-19 + 1 check digit)
 *    - Check digit: weights 7-3-1 applied right to left over the base,
 *      sum the products, check = (10 - (sum mod 10)) mod 10.
 *
 * 2) International RF creditor reference (ISO 11649 / "RF reference")
 *    - Format: RF + 2 check digits + base (1-21 alphanumeric chars)
 *    - Check: whole reference (base + "RF" + check digits, letters as
 *      A=10..Z=35) must be congruent to 1 modulo 97.
 *
 * Sources (accessed 2026-09-02):
 *  - Finanssiala ry viitenumero-ohje (kotimainen viitenumero):
 *    https://www.finanssiala.fi/finanssiala/maksuliikenne/viitenumero/
 *  - ISO 11649 / RFC-style RF creditor reference (EPC):
 *    https://www.europeanpaymentscouncil.eu/document-library/other-documents
 *
 * UMD-lite: usable in the browser (window.Viite) and in Node (module.exports)
 * so that tests/reference.test.js can exercise the exact same code.
 * ============================================================ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Viite = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- Finnish national reference ---------- */

  /** Weights 7-3-1, right to left, over the base (all digits except check). */
  function nationalCheckDigit(base) {
    const digits = String(base).replace(/\s+/g, '').split('').reverse().map(Number);
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i] * weights[i % 3];
    }
    return (10 - (sum % 10)) % 10;
  }

  /** Build a valid national viitenumero from an invoice number.
   *  Digit string is used as-is; bases shorter than 3 digits are
   *  zero-padded ("1" -> "001...") to satisfy the 4-20 char standard. */
  function generateNational(invoiceNumber) {
    let base = String(invoiceNumber ?? '').replace(/\D+/g, '');
    if (!/^\d{1,19}$/.test(base)) {
      throw new Error(
        'National reference base must be 1-19 digits (got "' + invoiceNumber + '")'
      );
    }
    if (base.length < 3) base = base.padStart(3, '0');
    return base + nationalCheckDigit(base);
  }

  /** Validate a national viitenumero (whitespace tolerated). */
  function validateNational(ref) {
    const s = String(ref ?? '').replace(/\s+/g, '');
    if (!/^\d{4,20}$/.test(s)) return false;
    const base = s.slice(0, -1);
    const check = Number(s.slice(-1));
    return nationalCheckDigit(base) === check;
  }

  /* ---------- International RF reference (ISO 11649) ---------- */

  /** Char-by-char mod 97 over an alphanumeric string (A=10..Z=35). Returns -1 on bad input. */
  function rfMod97(str) {
    let mod = 0;
    for (const ch of String(str)) {
      const code = ch.charCodeAt(0);
      let val;
      if (code >= 48 && code <= 57) val = code - 48;        // '0'-'9'
      else if (code >= 65 && code <= 90) val = code - 55;   // 'A'-'Z'
      else return -1;
      mod = (mod * (val > 9 ? 100 : 10) + val) % 97;
    }
    return mod;
  }

  /** Build a valid RF reference ("RFxx" + base) from an invoice number. */
  function generateRF(invoiceNumber) {
    const base = String(invoiceNumber ?? '')
      .replace(/[^0-9A-Za-z]/g, '')
      .toUpperCase();
    if (!/^[0-9A-Z]{1,21}$/.test(base)) {
      throw new Error(
        'RF reference base must be 1-21 alphanumeric chars (got "' + invoiceNumber + '")'
      );
    }
    const mod = rfMod97(base + 'RF00');
    const check = String(98 - mod).padStart(2, '0');
    return 'RF' + check + base;
  }

  /** Validate an RF creditor reference (case/space/dash insensitive). */
  function validateRF(ref) {
    const s = String(ref ?? '')
      .replace(/[\s-]+/g, '')
      .toUpperCase();
    if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(s)) return false;
    const base = s.slice(4);
    const checkDigits = s.slice(2, 4);
    return rfMod97(base + 'RF' + checkDigits) === 1;
  }

  /** Detect and validate either format. Returns { format: 'national'|'rf'|null, valid: bool }. */
  function validateAny(ref) {
    const s = String(ref ?? '')
      .replace(/[\s-]+/g, '')
      .toUpperCase();
    if (s.startsWith('RF')) {
      return { format: 'rf', valid: validateRF(s) };
    }
    if (/^\d+$/.test(s)) {
      return { format: 'national', valid: validateNational(s) };
    }
    return { format: null, valid: false };
  }

  return {
    generateNational,
    validateNational,
    nationalCheckDigit,
    generateRF,
    validateRF,
    rfMod97,
    validateAny,
  };
});
