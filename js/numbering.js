/* ============================================================
 * Laskupaja – invoice numbering (no dependencies)
 *
 * nextInvoiceNumber("2026-004") -> "2026-005": trailing digits are
 * incremented, the prefix and zero padding are preserved. Strings
 * without trailing digits are returned unchanged so the field stays
 * freely editable. Empty/null input yields the first-visit default:
 * current year + "-001".
 *
 * UMD-lite: usable in the browser (window.LP.numbering) and in Node
 * (module.exports) so tests/increment.test.js exercises the exact
 * same code the invoice page uses (same pattern as js/reference.js).
 * ============================================================ */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LP = root.LP || {};
    root.LP.numbering = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Sensible default for the very first invoice: current year + "-001". */
  function defaultInvoiceNumber(now) {
    const d = now instanceof Date ? now : new Date();
    return String(d.getFullYear()) + '-001';
  }

  /** Increment the trailing digits of an invoice number.
   *  - "2026-004" -> "2026-005", "INV007" -> "INV008", "1" -> "2"
   *  - zero padding is preserved: "009" -> "010", "099" -> "100"
   *    (and rolls over naturally: "999" -> "1000")
   *  - no trailing digits ("ABC") -> returned unchanged (editable as-is)
   *  - null/undefined/empty/whitespace -> defaultInvoiceNumber()
   *  BigInt keeps long digit runs exact; Number would drift past 2^53. */
  function nextInvoiceNumber(last) {
    if (last == null || String(last).trim() === '') return defaultInvoiceNumber();
    const s = String(last).trim();
    const m = s.match(/^(.*?)(\d+)$/);
    if (!m) return s;
    let n = (BigInt(m[2]) + 1n).toString();
    if (n.length < m[2].length) n = n.padStart(m[2].length, '0');
    return m[1] + n;
  }

  return { defaultInvoiceNumber, nextInvoiceNumber };
});
