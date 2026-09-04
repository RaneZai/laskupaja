/* ============================================================
 * Laskupaja – country VAT presets for /en/invoice/ (only).
 * Loaded before js/invoice.js. Reads ?country=CC&vat=XX:
 *  - valid CC  -> stored under laskupaja:country and applied
 *  - no CC     -> falls back to the stored country, if any
 * Exposes window.LP_VAT_CONTEXT = { country, rates, defaultVat, unit }
 * which js/invoice.js uses to swap the Finnish VAT options.
 * The /lasku/ page never loads this file, so FI behavior is unchanged.
 *
 * Rates verified 2026-09-03 – sources are cited on each /en/vat/[cc]/ page.
 * Standard rate first, then the main reduced rates, 0 last.
 *
 * laskupaja:country is a non-personal UI setting like laskupaja:lang
 * (js/i18n.js) and intentionally survives the storage opt-out.
 * ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'laskupaja:country';

  var COUNTRY_RATES = {
    DE: ['19', '7', '0'],
    FR: ['20', '10', '5.5', '2.1', '0'],
    IT: ['22', '10', '5', '4', '0'],
    ES: ['21', '10', '4', '0'],
    NL: ['21', '9', '0'],
    PL: ['23', '8', '5', '0'],
    SE: ['25', '12', '6', '0'],
    IE: ['23', '13.5', '9', '4.8', '0'],
  };

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  var params = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) { /* old browser */ }

  var country = '';
  if (params) {
    var q = (params.get('country') || '').trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(COUNTRY_RATES, q)) country = q;
  }
  if (country) {
    lsSet(STORAGE_KEY, country); /* remember the choice for later visits */
  } else {
    var stored = lsGet(STORAGE_KEY);
    if (stored && Object.prototype.hasOwnProperty.call(COUNTRY_RATES, stored)) country = stored;
  }

  if (!country) return; /* no preset -> generator keeps the Finnish 2026 rates */

  var rates = COUNTRY_RATES[country].slice();

  /* Optional ?vat=XX preselects a rate; a valid rate outside the country's
   * normal list is added to the options so deep links never break. */
  var vat = params ? String(params.get('vat') || '').trim().replace(',', '.') : '';
  if (/^\d+(\.\d+)?$/.test(vat)) {
    var n = Number(vat);
    if (n >= 0 && n <= 100) {
      vat = String(n); /* normalise e.g. '19.0' -> '19' */
      if (rates.indexOf(vat) === -1) {
        rates.push(vat);
        rates.sort(function (a, b) { return Number(b) - Number(a); });
      }
    } else {
      vat = '';
    }
  } else {
    vat = '';
  }

  window.LP_VAT_CONTEXT = {
    country: country,
    rates: rates,
    defaultVat: vat || rates[0], /* first entry = standard rate */
    unit: 'pcs', /* default unit for new rows (FI pages use 'kpl') */
  };
})();
