/* ============================================================
 * Laskupaja – invoice generator logic
 *  - line items with per-line VAT (2026 rates, see lasku/index.html head)
 *  - totals with VAT breakdown by rate
 *  - national + RF payment references (js/reference.js)
 *  - draft autosave to localStorage, next invoice number suggestion
 *  - A4 print view built before every print
 *
 * VAT rates 2026 (verified 2026-09-02):
 *  - general 25.5 %: https://www.vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/arvonlisaverotus/arvonlisaveroprosentit/
 *  - reduced 13.5 % from 1.1.2026 (previously 14 %):
 *    https://www.vero.fi/tietoa-verohallinnosta/uutishuone/verotuksen_muutoksia/alv-kannan-aleneminen/
 * ============================================================ */
(function () {
  'use strict';

  const LP = window.LP;
  const Viite = window.Viite;
  const t = (k) => LP.i18n.t(k);

  /* ---------- i18n: page strings ---------- */

  LP.i18n.register({
    fi: {
      'inv.title': 'Laskun laatija',
      'inv.lead': 'Täytä tiedot, tarkista yhteenveto ja tulosta lasku A4-PDF:nä. Luonnos tallentuu automaattisesti selaimeen.',
      'inv.sender': 'Laskuttaja',
      'inv.senderName': 'Nimi tai yritys *',
      'inv.namePh': 'esim. Matti Meikäläinen / Meikäläinen Oy',
      'inv.senderBid': 'Y-tunnus',
      'inv.address': 'Osoite',
      'inv.iban': 'IBAN-tilinumero',
      'inv.client': 'Asiakas',
      'inv.clientName': 'Nimi tai yritys *',
      'inv.clientBid': 'Y-tunnus (valinnainen)',
      'inv.details': 'Laskun tiedot',
      'inv.number': 'Laskunumero',
      'inv.date': 'Laskupäivä',
      'inv.terms': 'Maksuaika (päivää)',
      'inv.due': 'Eräpäivä',
      'inv.pricesIncl': 'Syötetyt yksikköhinnat sisältävät ALV:n',
      'inv.pricesInclHint': 'Jos rasti ei ole päällä, hinnat tulkitaan verottomiksi ja ALV lisätään päälle.',
      'inv.items': 'Laskurivit',
      'inv.desc': 'Kuvaus',
      'inv.descPh': 'esim. Verkkosivujen suunnittelu',
      'inv.qty': 'Määrä',
      'inv.unit': 'Yksikkö',
      'inv.unitPrice': 'Yksikköhinta (€)',
      'inv.vatCol': 'ALV %',
      'inv.sum': 'Rivisumma',
      'inv.removeRow': 'Poista rivi',
      'inv.addRow': '+ Lisää rivi',
      'inv.totals': 'Yhteenveto',
      'inv.netTotal': 'Veroton yhteensä',
      'inv.vatTotal': 'ALV yhteensä',
      'inv.grossTotal': 'Maksettava yhteensä',
      'inv.vatFrom': 'ALV',
      'inv.netLabel': 'veroton',
      'inv.pricesInclNote': 'Hinnat tulkitaan ALV sisältäviksi.',
      'inv.pricesExclNote': 'Hinnat ovat verottomia; ALV lisätään päälle.',
      'inv.ref': 'Viitenumero',
      'inv.refNational': 'Kansallinen viitenumero',
      'inv.refRF': 'Kansainvälinen RF-viite (ISO 11649)',
      'inv.refNationalHint': 'Suomalainen standardi, 7-3-1-tarkiste. Sopii kotimaiseen maksuliikenteeseen.',
      'inv.refRFHint': 'Sopii myös kansainvälisiin SEPA-maksuihin.',
      'inv.refHint': 'Viitteet muodostetaan automaattisesti laskunumerosta (RF käyttää numeron kirjaimia ja numeroita).',
      'inv.refCheckPh': 'Liitä tarkistettava viite tai RF-viite…',
      'inv.refCheckLabel': 'Tarkistettava viitenumero',
      'inv.refCheckBtn': 'Tarkista',
      'inv.refValidNational': '✓ Kelpaava kansallinen viitenumero',
      'inv.refValidRF': '✓ Kelpaava RF-viite',
      'inv.refInvalid': '✗ Viite ei kelpaa',
      'inv.refUnknown': '✗ Tuntematon muoto',
      'inv.new': 'Uusi lasku',
      'inv.print': 'Tulosta / Tallenna PDF',
      'inv.confirmNew': 'Luodaanko uusi lasku? Nykyinen luonnos tyhjennetään (laskunumero kasvatetaan).',
      'inv.autosave': 'Luonnos tallentuu automaattisesti selaimeen.',
      'inv.savedAt': 'Tallennettu',
      'print.title': 'LASKU',
      'print.number': 'Laskunumero',
      'print.date': 'Laskupäivä',
      'print.due': 'Eräpäivä',
      'print.terms': 'Maksuaika',
      'print.days': 'pv',
      'print.client': 'Asiakas',
      'print.desc': 'Kuvaus',
      'print.qty': 'Mrä',
      'print.unit': 'Yks.',
      'print.unitPrice': 'A-hinta €',
      'print.vat': 'ALV %',
      'print.sum': 'Summa €',
      'print.net': 'Veroton',
      'print.vatSum': 'ALV',
      'print.total': 'Maksettava yhteensä',
      'print.payment': 'Maksu',
      'print.iban': 'Tilinumero (IBAN)',
      'print.ref': 'Viitenumero',
      'print.refRf': 'RF-viite',
      'print.amount': 'Maksettava summa',
      'print.bid': 'Y-tunnus',
      'print.thanks': 'Kiitos yhteistyöstä!',
      'print.disclaimer': 'Ei oikeudellista neuvontaa.',
      'print.madeWith': 'Lasku laadittu Laskupajassa – laskupaja.com',
    },
    en: {
      'inv.title': 'Invoice generator',
      'inv.lead': 'Fill in the details, check the summary and print the invoice as an A4 PDF. The draft autosaves in your browser.',
      'inv.sender': 'Seller',
      'inv.senderName': 'Name or company *',
      'inv.namePh': 'e.g. Jane Doe / Doe Ltd',
      'inv.senderBid': 'Business ID (Y-tunnus)',
      'inv.address': 'Address',
      'inv.iban': 'IBAN account number',
      'inv.client': 'Client',
      'inv.clientName': 'Name or company *',
      'inv.clientBid': 'Business ID (optional)',
      'inv.details': 'Invoice details',
      'inv.number': 'Invoice number',
      'inv.date': 'Invoice date',
      'inv.terms': 'Payment terms (days)',
      'inv.due': 'Due date',
      'inv.pricesIncl': 'Entered unit prices include VAT',
      'inv.pricesInclHint': 'If unchecked, prices are treated as net (excl. VAT) and VAT is added on top.',
      'inv.items': 'Line items',
      'inv.desc': 'Description',
      'inv.descPh': 'e.g. Website design',
      'inv.qty': 'Qty',
      'inv.unit': 'Unit',
      'inv.unitPrice': 'Unit price (€)',
      'inv.vatCol': 'VAT %',
      'inv.sum': 'Line total',
      'inv.removeRow': 'Remove row',
      'inv.addRow': '+ Add row',
      'inv.totals': 'Summary',
      'inv.netTotal': 'Total net',
      'inv.vatTotal': 'Total VAT',
      'inv.grossTotal': 'Total due',
      'inv.vatFrom': 'VAT',
      'inv.netLabel': 'net',
      'inv.pricesInclNote': 'Prices are treated as VAT-inclusive.',
      'inv.pricesExclNote': 'Prices are net; VAT is added on top.',
      'inv.ref': 'Payment reference',
      'inv.refNational': 'Finnish national reference',
      'inv.refRF': 'International RF reference (ISO 11649)',
      'inv.refNationalHint': 'Finnish standard, 7-3-1 checksum. Suited for domestic payments.',
      'inv.refRFHint': 'Also suited for international SEPA payments.',
      'inv.refHint': 'References are generated automatically from the invoice number (RF uses its letters and digits).',
      'inv.refCheckPh': 'Paste a reference or RF reference to check…',
      'inv.refCheckLabel': 'Reference number to check',
      'inv.refCheckBtn': 'Check',
      'inv.refValidNational': '✓ Valid Finnish reference number',
      'inv.refValidRF': '✓ Valid RF reference',
      'inv.refInvalid': '✗ Invalid reference',
      'inv.refUnknown': '✗ Unknown format',
      'inv.new': 'New invoice',
      'inv.print': 'Print / Save as PDF',
      'inv.confirmNew': 'Create a new invoice? The current draft will be cleared (number incremented).',
      'inv.autosave': 'The draft autosaves to your browser.',
      'inv.savedAt': 'Saved',
      'print.title': 'INVOICE',
      'print.number': 'Invoice no.',
      'print.date': 'Invoice date',
      'print.due': 'Due date',
      'print.terms': 'Payment terms',
      'print.days': 'days',
      'print.client': 'Client',
      'print.desc': 'Description',
      'print.qty': 'Qty',
      'print.unit': 'Unit',
      'print.unitPrice': 'Unit €',
      'print.vat': 'VAT %',
      'print.sum': 'Total €',
      'print.net': 'Net',
      'print.vatSum': 'VAT',
      'print.total': 'Total due',
      'print.payment': 'Payment',
      'print.iban': 'Account (IBAN)',
      'print.ref': 'Reference no.',
      'print.refRf': 'RF reference',
      'print.amount': 'Amount due',
      'print.bid': 'Business ID',
      'print.thanks': 'Thank you for your business!',
      'print.disclaimer': 'Not legal advice.',
      'print.madeWith': 'Invoice made with Laskupaja – laskupaja.com',
    },
  });

  /* ---------- constants & helpers ---------- */

  const VAT_OPTIONS = [
    { value: '25.5', key: 'vat.255' },
    { value: '13.5', key: 'vat.135' },
    { value: '10', key: 'vat.10' },
    { value: '0', key: 'vat.0' },
  ];

  const LS_DRAFT = 'laskupaja:draft';
  const LS_LAST_NO = 'laskupaja:lastInvoiceNo';
  const DEFAULT_TERMS = 14;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function parseNum(s) {
    const v = parseFloat(String(s == null ? '' : s).replace(/\s+/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  function fmtMoney(cents) {
    const locale = LP.i18n.getLang() === 'fi' ? 'fi-FI' : 'en-IE';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }

  function fmtRate(rateStr) {
    const n = Number(rateStr);
    return LP.i18n.getLang() === 'fi' ? String(n).replace('.', ',') + ' %' : n + '%';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(LP.i18n.getLang() === 'fi' ? 'fi-FI' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function todayISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function addDaysISO(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + Number(days));
    const p = (n) => String(n).padStart(2, '0');
    return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* noop */ }
  }

  /* ---------- line rows ---------- */

  function vatSelectHTML(selected) {
    return VAT_OPTIONS.map(
      (o) => `<option value="${o.value}"${o.value === selected ? ' selected' : ''} data-i18n="${o.key}"></option>`
    ).join('');
  }

  function addRow(item) {
    const item_ = item || {};
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = [
      `<td class="col-desc" data-i18n-label="inv.desc"><input type="text" class="ri-desc" value="${esc(item_.desc || '')}" data-i18n-placeholder="inv.descPh"></td>`,
      `<td data-i18n-label="inv.qty"><input type="text" inputmode="decimal" class="ri-qty" value="${esc(item_.qty != null ? item_.qty : 1)}"></td>`,
      `<td data-i18n-label="inv.unit"><input type="text" list="unit-list" class="ri-unit" value="${esc(item_.unit || 'kpl')}"></td>`,
      `<td data-i18n-label="inv.unitPrice"><input type="text" inputmode="decimal" class="ri-price" placeholder="0,00" value="${esc(item_.price != null ? item_.price : '')}"></td>`,
      `<td data-i18n-label="inv.vatCol"><select class="ri-vat">${vatSelectHTML(item_.vat || '25.5')}</select></td>`,
      `<td class="col-sum" data-i18n-label="inv.sum"><span class="ri-total">–</span></td>`,
      `<td><button type="button" class="btn btn-ghost remove-row" data-i18n-aria="inv.removeRow" aria-label="×" title="×">×</button></td>`,
    ].join('');
    $('#items-body').appendChild(tr);
    LP.i18n.apply(tr); /* translate placeholders, data-labels and options in this row */
    updateRowTotal(tr);
  }

  function rowValues(tr) {
    return {
      desc: tr.querySelector('.ri-desc').value.trim(),
      qty: parseNum(tr.querySelector('.ri-qty').value),
      unit: tr.querySelector('.ri-unit').value.trim(),
      price: parseNum(tr.querySelector('.ri-price').value),
      vat: tr.querySelector('.ri-vat').value,
    };
  }

  function updateRowTotal(tr) {
    const v = rowValues(tr);
    tr.querySelector('.ri-total').textContent = fmtMoney(Math.round(v.qty * v.price * 100));
  }

  function collectItems() {
    return $$('#items-body .item-row').map(rowValues);
  }

  /* ---------- totals ---------- */

  function computeTotals(items, pricesIncl) {
    let netC = 0;
    let vatC = 0;
    const byRate = {};
    for (const it of items) {
      const entered = it.qty * it.price;
      let net;
      if (pricesIncl) net = entered / (1 + Number(it.vat) / 100);
      else net = entered;
      const vat = pricesIncl ? entered - net : net * (Number(it.vat) / 100);
      const nC = Math.round(net * 100);
      const vC = Math.round(vat * 100);
      if (!byRate[it.vat]) byRate[it.vat] = { netC: 0, vatC: 0 };
      byRate[it.vat].netC += nC;
      byRate[it.vat].vatC += vC;
      netC += nC;
      vatC += vC;
    }
    return { netC, vatC, grossC: netC + vatC, byRate };
  }

  function renderTotals() {
    const pricesIncl = $('#pricesInclVat').checked;
    const totals = computeTotals(collectItems(), pricesIncl);
    const rateKeys = Object.keys(totals.byRate).sort((a, b) => Number(b) - Number(a));
    const breakdown = rateKeys
      .map(
        (k) =>
          `<tr class="group"><td>${esc(fmtRate(k))} · ${esc(t('inv.netLabel'))} ${esc(fmtMoney(totals.byRate[k].netC))}</td>` +
          `<td>${esc(t('inv.vatFrom'))} ${esc(fmtMoney(totals.byRate[k].vatC))}</td></tr>`
      )
      .join('');
    $('#totals').innerHTML =
      `<div class="totals-box"><table>` +
      breakdown +
      `<tr class="sub"><td>${esc(t('inv.netTotal'))}</td><td>${esc(fmtMoney(totals.netC))}</td></tr>` +
      `<tr class="sub"><td>${esc(t('inv.vatTotal'))}</td><td>${esc(fmtMoney(totals.vatC))}</td></tr>` +
      `<tr class="grand"><td>${esc(t('inv.grossTotal'))}</td><td>${esc(fmtMoney(totals.grossC))}</td></tr>` +
      `</table>` +
      `<p class="hint">${esc(pricesIncl ? t('inv.pricesInclNote') : t('inv.pricesExclNote'))}</p></div>`;
  }

  /* ---------- references ---------- */

  function currentRefs() {
    const num = $('#invoiceNumber').value.trim();
    if (!num) return null;
    let national = null;
    let rf = null;
    try { national = Viite.generateNational(num); } catch (e) { national = null; }
    try { rf = Viite.generateRF(num); } catch (e) { rf = null; }
    return { national, rf };
  }

  function renderRefs() {
    const refs = currentRefs();
    $('#ref-national-value').textContent = refs && refs.national ? refs.national : '—';
    $('#ref-rf-value').textContent = refs && refs.rf ? refs.rf : '—';
  }

  function checkReference() {
    const res = Viite.validateAny($('#ref-check-input').value);
    const el = $('#ref-check-result');
    if (res.format === 'national') {
      el.className = res.valid ? 'status-ok' : 'status-err';
      el.textContent = res.valid ? t('inv.refValidNational') : t('inv.refInvalid');
    } else if (res.format === 'rf') {
      el.className = res.valid ? 'status-ok' : 'status-err';
      el.textContent = res.valid ? t('inv.refValidRF') : t('inv.refInvalid');
    } else {
      el.className = 'status-err';
      el.textContent = t('inv.refUnknown');
    }
  }

  /* ---------- draft: collect / apply / autosave ---------- */

  function collectForm() {
    return {
      v: 1,
      sender: {
        name: $('#senderName').value,
        bid: $('#senderBid').value,
        address: $('#senderAddress').value,
        iban: $('#senderIban').value,
      },
      client: {
        name: $('#clientName').value,
        bid: $('#clientBid').value,
        address: $('#clientAddress').value,
      },
      meta: {
        number: $('#invoiceNumber').value,
        date: $('#invoiceDate').value,
        terms: $('#paymentTerms').value,
        due: $('#dueDate').value,
      },
      pricesIncl: $('#pricesInclVat').checked,
      items: collectItems(),
    };
  }

  function applyDraft(d) {
    if (!d) return;
    const set = (id, v) => { if (v != null) $(id).value = v; };
    set('#senderName', d.sender && d.sender.name);
    set('#senderBid', d.sender && d.sender.bid);
    set('#senderAddress', d.sender && d.sender.address);
    set('#senderIban', d.sender && d.sender.iban);
    set('#clientName', d.client && d.client.name);
    set('#clientBid', d.client && d.client.bid);
    set('#clientAddress', d.client && d.client.address);
    set('#invoiceNumber', d.meta && d.meta.number);
    set('#invoiceDate', d.meta && d.meta.date);
    set('#paymentTerms', d.meta && d.meta.terms);
    set('#dueDate', d.meta && d.meta.due);
    if (d.pricesIncl != null) $('#pricesInclVat').checked = !!d.pricesIncl;
    const items = Array.isArray(d.items) && d.items.length ? d.items : [{}];
    $('#items-body').innerHTML = '';
    items.forEach((it) => addRow(it));
  }

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 350);
  }

  function saveDraft() {
    const data = collectForm();
    lsSet(LS_DRAFT, JSON.stringify(data));
    if (data.meta.number && data.meta.number.trim()) {
      lsSet(LS_LAST_NO, data.meta.number.trim());
    }
    const note = $('#autosave-note');
    const time = new Date().toLocaleTimeString(LP.i18n.getLang() === 'fi' ? 'fi-FI' : 'en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    note.textContent = t('inv.savedAt') + ' ' + time;
  }

  /* ---------- invoice numbering ---------- */

  function nextInvoiceNumber(last) {
    if (!last) return String(new Date().getFullYear()) + '001';
    const m = String(last).match(/^(.*?)(\d+)$/);
    if (!m) return last + '-2';
    const prefix = m[1];
    const digits = m[2];
    let n = (BigInt(digits) + 1n).toString();
    if (n.length < digits.length) n = n.padStart(digits.length, '0');
    return prefix + n;
  }

  /* ---------- dates ---------- */

  function syncDueFromTerms() {
    const date = $('#invoiceDate').value || todayISO();
    const terms = parseNum($('#paymentTerms').value);
    $('#dueDate').value = addDaysISO(date, terms);
  }

  function syncTermsFromDue() {
    const start = $('#invoiceDate').value;
    const due = $('#dueDate').value;
    if (!start || !due) return;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = due.split('-').map(Number);
    const ms = new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd);
    const days = Math.round(ms / 86400000);
    if (days >= 0) $('#paymentTerms').value = days;
  }

  /* ---------- print view ---------- */

  function buildPrintView() {
    const d = collectForm();
    const totals = computeTotals(d.items, d.pricesIncl);
    const refs = currentRefs();
    const rateKeys = Object.keys(totals.byRate).sort((a, b) => Number(b) - Number(a));

    const itemsRows = d.items
      .map(
        (it) =>
          `<tr><td>${esc(it.desc || '—')}</td>` +
          `<td class="num">${esc(String(it.qty).replace('.', ','))}</td>` +
          `<td>${esc(it.unit || '')}</td>` +
          `<td class="num">${esc(String(it.price).replace('.', ','))}</td>` +
          `<td class="num">${esc(fmtRate(it.vat))}</td>` +
          `<td class="num">${esc(fmtMoney(Math.round(it.qty * it.price * 100)))}</td></tr>`
      )
      .join('');

    const breakdownRows = rateKeys
      .map(
        (k) =>
          `<tr><td>${esc(fmtRate(k))} · ${esc(t('print.net'))} ${esc(fmtMoney(totals.byRate[k].netC))}</td>` +
          `<td class="num">${esc(t('print.vatSum'))} ${esc(fmtMoney(totals.byRate[k].vatC))}</td></tr>`
      )
      .join('');

    $('#print-view').innerHTML =
      `<div class="pv-head">` +
      `<div><div class="pv-brand">${esc(d.sender.name || '—')}</div>` +
      `<div>${esc((d.sender.address || '').replace(/\n/g, ' · '))}</div>` +
      `<div>${d.sender.bid ? esc(t('print.bid')) + ': ' + esc(d.sender.bid) : ''}</div></div>` +
      `<div class="pv-meta"><h1>${esc(t('print.title'))}</h1>` +
      `<div>${esc(t('print.number'))}: <strong>${esc(d.meta.number || '—')}</strong></div>` +
      `<div>${esc(t('print.date'))}: ${esc(fmtDate(d.meta.date))}</div>` +
      `<div>${esc(t('print.due'))}: ${esc(fmtDate(d.meta.due))}</div></div>` +
      `</div>` +
      `<div class="pv-parties">` +
      `<div class="pv-party"><h3>${esc(t('print.client'))}</h3><p>${esc(d.client.name || '—')}` +
      `${d.client.bid ? '\n' + esc(t('print.bid')) + ': ' + esc(d.client.bid) : ''}` +
      `${d.client.address ? '\n' + esc(d.client.address) : ''}</p></div>` +
      `<div class="pv-party"><h3>${esc(t('print.terms'))}</h3>` +
      `<p>${esc(d.meta.terms || '0')} ${esc(t('print.days'))}</p></div>` +
      `</div>` +
      `<table><thead><tr><th>${esc(t('print.desc'))}</th><th class="num">${esc(t('print.qty'))}</th>` +
      `<th>${esc(t('print.unit'))}</th><th class="num">${esc(t('print.unitPrice'))}</th>` +
      `<th class="num">${esc(t('print.vat'))}</th><th class="num">${esc(t('print.sum'))}</th></tr></thead>` +
      `<tbody>${itemsRows || `<tr><td colspan="6">—</td></tr>`}</tbody></table>` +
      `<table class="pv-totals">${breakdownRows}` +
      `<tr><td>${esc(t('print.net'))}</td><td class="num">${esc(fmtMoney(totals.netC))}</td></tr>` +
      `<tr><td>${esc(t('print.vatSum'))}</td><td class="num">${esc(fmtMoney(totals.vatC))}</td></tr>` +
      `<tr class="grand"><td>${esc(t('print.total'))}</td><td class="num">${esc(fmtMoney(totals.grossC))}</td></tr></table>` +
      `<div class="pv-payment"><h3>${esc(t('print.payment'))}</h3><dl>` +
      `<dt>${esc(t('print.iban'))}</dt><dd>${esc(d.sender.iban || '—')}</dd>` +
      `<dt>${esc(t('print.ref'))}</dt><dd>${refs && refs.national ? esc(refs.national) : '—'}</dd>` +
      `<dt>${esc(t('print.refRf'))}</dt><dd>${refs && refs.rf ? esc(refs.rf) : '—'}</dd>` +
      `<dt>${esc(t('print.amount'))}</dt><dd>${esc(fmtMoney(totals.grossC))}</dd>` +
      `<dt>${esc(t('print.due'))}</dt><dd>${esc(fmtDate(d.meta.due))}</dd>` +
      `</dl></div>` +
      `<div class="pv-footer"><span>${esc(t('print.thanks'))} ${esc(t('print.disclaimer'))}</span>` +
      `<span>${esc(t('print.madeWith'))}</span></div>`;
  }

  /* ---------- copy helper ---------- */

  function copyText(text, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = t('common.copied');
      setTimeout(() => { btn.textContent = old || t('common.copy'); }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    done();
  }

  /* ---------- init & events ---------- */

  function init() {
    /* default or restored state */
    const draft = lsGet(LS_DRAFT);
    if (draft) {
      try { applyDraft(JSON.parse(draft)); } catch (e) { lsDel(LS_DRAFT); }
    }
    if (!$('#items-body .item-row')) addRow();
    if (!$('#invoiceDate').value) $('#invoiceDate').value = todayISO();
    if (!$('#dueDate').value) syncDueFromTerms();
    if (!$('#invoiceNumber').value) {
      $('#invoiceNumber').value = nextInvoiceNumber(lsGet(LS_LAST_NO));
    }

    renderTotals();
    renderRefs();
    buildPrintView();

    /* any input: update the touched row sum immediately, debounce the rest */
    $('#invoice-form').addEventListener('input', (e) => {
      const tr = e.target.closest('.item-row');
      if (tr) updateRowTotal(tr);
      scheduleSave();
    });

    /* debounced recompute (totals, refs) without stealing focus */
    let renderTimer = null;
    $('#invoice-form').addEventListener('input', () => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        renderTotals();
        renderRefs();
        buildPrintView();
      }, 250);
    });

    /* dates */
    $('#invoiceDate').addEventListener('change', syncDueFromTerms);
    $('#paymentTerms').addEventListener('change', syncDueFromTerms);
    $('#dueDate').addEventListener('change', syncTermsFromDue);

    /* rows */
    $('#add-row').addEventListener('click', () => { addRow(); saveDraft(); });
    $('#items-body').addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-row');
      if (!btn) return;
      const tr = btn.closest('tr');
      const rows = $$('#items-body .item-row');
      if (rows.length === 1) {
        tr.querySelectorAll('input').forEach((i) => { i.value = i.classList.contains('ri-qty') ? '1' : ''; });
        updateRowTotal(tr);
      } else {
        tr.remove();
      }
      renderTotals();
      saveDraft();
    });

    /* references */
    $('#ref-check-btn').addEventListener('click', checkReference);
    $('#ref-check-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); checkReference(); }
    });

    /* copy buttons (data-copy = id of element whose text to copy) */
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const src = document.getElementById(btn.getAttribute('data-copy'));
      if (src && src.textContent.trim() !== '—') copyText(src.textContent.trim(), btn);
    });

    /* new invoice */
    $('#new-invoice-btn').addEventListener('click', () => {
      if (!window.confirm(t('inv.confirmNew'))) return;
      lsDel(LS_DRAFT);
      const next = nextInvoiceNumber(lsGet(LS_LAST_NO));
      $('#invoice-form').reset();
      $('#items-body').innerHTML = '';
      addRow();
      $('#invoiceDate').value = todayISO();
      $('#paymentTerms').value = DEFAULT_TERMS;
      syncDueFromTerms();
      $('#invoiceNumber').value = next;
      lsSet(LS_LAST_NO, next);
      renderTotals();
      renderRefs();
      buildPrintView();
      saveDraft();
      $('#senderName').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* print */
    $('#print-btn').addEventListener('click', () => {
      buildPrintView();
      window.print();
    });
    window.addEventListener('beforeprint', buildPrintView);

    /* language switch: refresh everything rendered from JS */
    document.addEventListener('lp:langchange', () => {
      $$('#items-body .item-row').forEach(updateRowTotal);
      renderTotals();
      renderRefs();
      buildPrintView();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
