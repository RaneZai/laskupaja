/* ============================================================
 * Laskupaja – ALV calculator (VAT add / remove)
 * Live results; FI/EN via shared i18n; comma-tolerant input.
 *
 * 2026 rates (verified 2026-09-02):
 *  - general 25.5 %, reduced 13.5 % (from 1.1.2026, previously 14 %), 10 %, 0 %
 *  - https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/arvonlisaverotus/arvonlisaveroprosentit/
 *  - https://www.vero.fi/tietoa-verohallinnosta/uutishuone/verotuksen_muutoksia/alv-kannan-aleneminen/
 * ============================================================ */
(function () {
  'use strict';

  const LP = window.LP;
  const t = (k) => LP.i18n.t(k);

  LP.i18n.register({
    fi: {
      'calc.title': 'ALV-laskuri 2026',
      'calc.lead': 'Lisää arvonlisävero nettohintaan tai erota se bruttohinnasta – laskuri päivittyy kirjoittaessa.',
      'calc.amount': 'Summa (€)',
      'calc.dir': 'Suunta',
      'calc.dirAdd': 'Lisää ALV (netto → brutto)',
      'calc.dirRemove': 'Poista ALV (brutto → netto)',
      'calc.rate': 'ALV-kanta',
      'calc.custom': 'Muu %',
      'calc.customLabel': 'Oma prosentti',
      'calc.results': 'Tulos',
      'calc.net': 'Veroton (netto)',
      'calc.vatPart': 'ALV-osuus',
      'calc.gross': 'Sis. ALV (brutto)',
      'calc.formulaAdd': 'Kaava: brutto = netto × (1 + kanta/100)',
      'calc.formulaRemove': 'Kaava: netto = brutto / (1 + kanta/100)',
      'calc.infoTitle': 'ALV-kanta laski 1.1.2026 – 13,5 % korvasi 14 %:n',
      'calc.infoText1': 'Alennettu arvonlisäverokanta laski 14 prosentista 13,5 prosenttiin 1.1.2026 alkaen. Yleinen kanta (25,5 %) ei muuttunut. Lähde: ',
      'calc.infoLink1': 'vero.fi – alv-kannan aleneminen',
      'calc.infoText2': '',
      'calc.infoText3': 'Kattava lista kannoista ja tuoteryhmistä: ',
      'calc.infoLink2': 'vero.fi – arvonlisäveroprosentit',
      'calc.ratesTitle': 'Voimassa olevat ALV-kannat Suomessa',
      'calc.tableRate': 'Kanta',
      'calc.tableApplies': 'Tyypilliset kohteet',
      'calc.tGeneral': 'Yleinen kanta: useimmat tavarat ja palvelut.',
      'calc.tReduced': 'Alennettu kanta (1.1.2026 alkaen; aiemmin 14 %): mm. elintarvikkeet, ravintola- ja ateriapalvelut, lääkkeet, majoitus, henkilöliikenne.',
      'calc.tTen': 'Erittäin alennettu: mm. kirjat, sanoma- ja aikakauslehdet, lääkkeistä 10 %:iin kuuluvat, liikuntapalvelut, kulttuuri- ja urheilutapahtumat.',
      'calc.tZero': 'Veroton kanta: mm. tietyt terveys- ja sosiaalipalvelut, kirjastot, rahoitus- ja vakuutuspalvelut.',
      'calc.tableNote': 'Lista on lyhennys; tarkista aina soveltuvuus omalle toiminnallesi: ',
    },
    en: {
      'calc.title': 'VAT calculator 2026',
      'calc.lead': 'Add VAT to a net price or remove it from a gross price – results update as you type.',
      'calc.amount': 'Amount (€)',
      'calc.dir': 'Direction',
      'calc.dirAdd': 'Add VAT (net → gross)',
      'calc.dirRemove': 'Remove VAT (gross → net)',
      'calc.rate': 'VAT rate',
      'calc.custom': 'Custom %',
      'calc.customLabel': 'Custom rate',
      'calc.results': 'Result',
      'calc.net': 'Net (excl. VAT)',
      'calc.vatPart': 'VAT portion',
      'calc.gross': 'Gross (incl. VAT)',
      'calc.formulaAdd': 'Formula: gross = net × (1 + rate/100)',
      'calc.formulaRemove': 'Formula: net = gross / (1 + rate/100)',
      'calc.infoTitle': 'VAT rate dropped on 1 Jan 2026 – 13.5% replaced 14%',
      'calc.infoText1': 'Finland’s reduced VAT rate fell from 14% to 13.5% on 1 January 2026. The general rate (25.5%) did not change. Source: ',
      'calc.infoLink1': 'vero.fi – VAT rate reduction',
      'calc.infoText2': '',
      'calc.infoText3': 'Full list of rates and product groups: ',
      'calc.infoLink2': 'vero.fi – VAT percentages',
      'calc.ratesTitle': 'Current VAT rates in Finland',
      'calc.tableRate': 'Rate',
      'calc.tableApplies': 'Typical scope',
      'calc.tGeneral': 'General rate: most goods and services.',
      'calc.tReduced': 'Reduced rate (from 1 Jan 2026; previously 14%): e.g. food, restaurant and catering services, medicines, accommodation, passenger transport.',
      'calc.tTen': 'Further-reduced: e.g. books, newspapers and periodicals, medicines in this bracket, sports services, cultural and sports events.',
      'calc.tZero': 'Zero rate: e.g. certain health and social services, libraries, financial and insurance services.',
      'calc.tableNote': 'This list is a summary; always verify the rate for your own activity: ',
    },
  });

  /* state: direction 'add' | 'remove'; rate as number, or 'custom' with input */
  let direction = 'add';
  let selectedRate = 25.5; /* actual numeric rate used in math */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function parseNum(s) {
    const v = parseFloat(String(s == null ? '' : s).replace(/\s+/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  function fmtMoney(v) {
    return new Intl.NumberFormat(LP.i18n.getLang() === 'fi' ? 'fi-FI' : 'en-IE', {
      style: 'currency', currency: 'EUR',
    }).format(v);
  }

  function fmtRate(n) {
    return LP.i18n.getLang() === 'fi' ? String(n).replace('.', ',') + ' %' : n + '%';
  }

  function currentRateNumber() {
    const customBtn = $('#rate-seg button[data-rate="custom"]');
    if (customBtn.classList.contains('active')) {
      const v = parseNum($('#calc-custom-rate').value);
      return Math.min(Math.max(v, 0), 100);
    }
    return parseNum(String(selectedRate));
  }

  function calculate() {
    const amount = parseNum($('#calc-amount').value);
    const rate = currentRateNumber();
    let net, gross;
    if (direction === 'add') {
      net = amount;
      gross = amount * (1 + rate / 100);
    } else {
      gross = amount;
      net = rate === 0 ? amount : amount / (1 + rate / 100);
    }
    const vat = gross - net;
    return { net, vat, gross, rate };
  }

  function render() {
    const r = calculate();
    $('#res-net .value').textContent = fmtMoney(r.net);
    $('#res-vat .value').textContent = fmtMoney(r.vat);
    $('#res-gross .value').textContent = fmtMoney(r.gross);
    $('#res-gross .label').textContent = t('calc.gross') + ' (' + fmtRate(r.rate) + ')';
    $('#calc-formula').textContent =
      t(direction === 'add' ? 'calc.formulaAdd' : 'calc.formulaRemove');
  }

  function init() {
    render();

    $('#calc-amount').addEventListener('input', render);
    $('#calc-custom-rate').addEventListener('input', render);

    /* direction buttons */
    $('#dir-add').addEventListener('click', () => {
      direction = 'add';
      $('#dir-add').classList.add('active');
      $('#dir-remove').classList.remove('active');
      render();
    });
    $('#dir-remove').addEventListener('click', () => {
      direction = 'remove';
      $('#dir-remove').classList.add('active');
      $('#dir-add').classList.remove('active');
      render();
    });

    /* rate segmented control */
    $('#rate-seg').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-rate]');
      if (!btn) return;
      $$('#rate-seg button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const isCustom = btn.getAttribute('data-rate') === 'custom';
      $('#custom-rate-field').hidden = !isCustom;
      if (isCustom) {
        if (!$('#calc-custom-rate').value) $('#calc-custom-rate').value = '12';
        $('#calc-custom-rate').focus();
      } else {
        selectedRate = parseNum(btn.getAttribute('data-rate'));
      }
      render();
    });

    /* re-render on language change (money formats + labels) */
    document.addEventListener('lp:langchange', render);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
