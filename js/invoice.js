/* ============================================================
 * Laskupaja – invoice generator logic
 *  - line items with per-line VAT (2026 rates, see lasku/index.html head)
 *  - totals with VAT breakdown by rate
 *  - national + RF payment references (js/reference.js)
 *  - invoice numbering: prefix/padding-preserving increment (js/numbering.js)
 *  - persistent business profile ("Omat tiedot"), stored in localStorage
 *    SEPARATELY from the per-invoice draft
 *  - draft autosave to localStorage, only while "remember my details" is on
 *  - storage opt-out: wipes every data key and stops persisting entirely
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
  const Numbering = window.LP.numbering;
  const t = (k) => LP.i18n.t(k);

  /* ---------- i18n: page strings ---------- */

  LP.i18n.register({
    fi: {
      'inv.title': 'Laskun laatija',
      'inv.lead': 'Täytä tiedot, tarkista yhteenveto ja tulosta lasku A4-PDF:nä. Luonnos tallentuu automaattisesti selaimeen.',
      'inv.myDetails': 'Omat tiedot – laskuttaja',
      'inv.myDetailsHint': 'Nämä tiedot tallennetaan selaimen muistiin ja esitäytetään tuleviin laskuihin.',
      'inv.senderName': 'Nimi tai yritys *',
      'inv.namePh': 'esim. Matti Meikäläinen / Meikäläinen Oy',
      'inv.senderBid': 'Y-tunnus',
      'inv.address': 'Osoite',
      'inv.iban': 'IBAN-tilinumero',
      'inv.defaultTerms': 'Oletusmaksuaika (päivää)',
      'inv.defaultVat': 'Oletus ALV-% uusille riveille',
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
      'inv.notes': 'Viesti laskulle (valinnainen)',
      'inv.notesPh': 'esim. Kiitos tilauksesta!',
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
      'inv.reverseCharge': 'EU:käänteinen verovelvollisuus (B2B, 0 %)',
      'inv.rcHint': 'Kaikkien rivien ALV pakotetaan 0 %:iin ja laskuun tulee käänteisen verovelvollisuuden vaadittava merkintä.',
      'inv.rcAnnotation': 'Käänteinen verovelvollisuus — veron maksaa ostaja (neuvoston direktiivi 2006/112/EY, 196 art.)',
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
      'inv.confirmNew': 'Luodaanko uusi lasku? Asiakas, rivit ja viesti tyhjennetään – omat tiedot säilyvät ja laskunumero kasvatetaan.',
      'inv.autosave': 'Luonnos tallentuu automaattisesti selaimeen.',
      'inv.savedAt': 'Tallennettu',
      'inv.storageTitle': 'Tietojen tallennus',
      'inv.storageInfo': 'Tiedot tallennetaan vain selaimeesi (localStorage) — niitä ei lähetetä mihinkään palvelimelle.',
      'inv.remember': 'Muista tietoni tällä laitteella',
      'inv.clearSaved': 'Tyhjennä tallennetut tiedot',
      'inv.confirmClear': 'Tyhjennetäänkö kaikki tallennetut tiedot (luonnos ja omat tiedot)? Tätä ei voi kumota.',
      'inv.confirmRememberOff': 'Poistetaanko tietojen muistaminen käytöstä? Kaikki tallennetut tiedot pyyhkitään selaimen muistista.',
      'inv.storageOff': 'Tietoja ei tallenneta – muistaminen on pois päältä.',
      'inv.cleared': 'Tallennetut tiedot tyhjennetty.',
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
      'print.payableBy': 'Maksu viimeistään',
      'print.madeWith': 'Lasku laadittu Laskupajassa – laskupaja.com',
    },
    en: {
      'inv.title': 'Invoice generator',
      'inv.lead': 'Fill in the details, check the summary and print the invoice as an A4 PDF. The draft autosaves in your browser.',
      'inv.myDetails': 'My details – seller',
      'inv.myDetailsHint': 'These details are saved in your browser and prefilled into future invoices.',
      'inv.senderName': 'Name or company *',
      'inv.namePh': 'e.g. Jane Doe / Doe Ltd',
      'inv.senderBid': 'Business ID / VAT number',
      'inv.address': 'Address',
      'inv.iban': 'IBAN account number',
      'inv.defaultTerms': 'Default payment terms (days)',
      'inv.defaultVat': 'Default VAT % for new rows',
      'inv.client': 'Client',
      'inv.clientName': 'Name or company *',
      'inv.clientBid': 'Business ID / VAT number (optional)',
      'inv.details': 'Invoice details',
      'inv.number': 'Invoice number',
      'inv.date': 'Invoice date',
      'inv.terms': 'Payment terms (days)',
      'inv.due': 'Due date',
      'inv.pricesIncl': 'Entered unit prices include VAT',
      'inv.pricesInclHint': 'If unchecked, prices are treated as net (excl. VAT) and VAT is added on top.',
      'inv.notes': 'Message on the invoice (optional)',
      'inv.notesPh': 'e.g. Thank you for your order!',
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
      'inv.reverseCharge': 'EU reverse charge (B2B, 0 %)',
      'inv.rcHint': 'All line VAT is forced to 0% and the required reverse-charge note is added to the invoice.',
      'inv.rcAnnotation': 'VAT reverse charged — recipient liable for VAT (Directive 2006/112/EC art. 196)',
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
      'inv.confirmNew': 'Create a new invoice? Client, rows and message will be cleared – your details stay and the number is incremented.',
      'inv.autosave': 'The draft autosaves to your browser.',
      'inv.savedAt': 'Saved',
      'inv.storageTitle': 'Data storage',
      'inv.storageInfo': 'Your details are stored only in your browser — nothing is ever sent to any server.',
      'inv.remember': 'Remember my details on this device',
      'inv.clearSaved': 'Clear saved data',
      'inv.confirmClear': 'Clear all saved data (draft and your details)? This cannot be undone.',
      'inv.confirmRememberOff': 'Turn off remembering? All saved data will be wiped from your browser.',
      'inv.storageOff': 'Nothing is being saved — remembering is off.',
      'inv.cleared': 'Saved data cleared.',
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
      'print.payableBy': 'Payable by',
      'print.madeWith': 'Invoice made with Laskupaja – laskupaja.com',
    },
    es: {
      'inv.title': 'Generador de facturas',
      'inv.lead': 'Rellena los datos, revisa el resumen e imprime la factura como PDF A4. El borrador se guarda automáticamente en tu navegador.',
      'inv.myDetails': 'Mis datos – emisor',
      'inv.myDetailsHint': 'Estos datos se guardan en tu navegador y se rellenan automáticamente en futuras facturas.',
      'inv.senderName': 'Nombre o empresa *',
      'inv.namePh': 'p. ej. María García / García S.L.',
      'inv.senderBid': 'NIF/CIF o n.º IVA intracomunitario',
      'inv.address': 'Dirección',
      'inv.iban': 'IBAN (número de cuenta)',
      'inv.defaultTerms': 'Plazo de pago por defecto (días)',
      'inv.defaultVat': 'IVA % por defecto para nuevas líneas',
      'inv.client': 'Cliente',
      'inv.clientName': 'Nombre o empresa *',
      'inv.clientBid': 'NIF/CIF o n.º IVA intracomunitario (opcional)',
      'inv.details': 'Datos de la factura',
      'inv.number': 'Nº de factura',
      'inv.date': 'Fecha de la factura',
      'inv.terms': 'Plazo de pago (días)',
      'inv.due': 'Vencimiento',
      'inv.pricesIncl': 'Los precios unitarios introducidos incluyen IVA',
      'inv.pricesInclHint': 'Si no está marcado, los precios se tratan como base imponible (sin IVA) y el IVA se añade encima.',
      'inv.notes': 'Mensaje en la factura (opcional)',
      'inv.notesPh': 'p. ej. ¡Gracias por tu pedido!',
      'inv.items': 'Conceptos',
      'inv.desc': 'Concepto',
      'inv.descPh': 'p. ej. Diseño de páginas web',
      'inv.qty': 'Cantidad',
      'inv.unit': 'Unidad',
      'inv.unitPrice': 'Precio unitario (€)',
      'inv.vatCol': 'IVA %',
      'inv.sum': 'Importe',
      'inv.removeRow': 'Eliminar línea',
      'inv.addRow': '+ Añadir línea',
      'inv.totals': 'Resumen',
      'inv.netTotal': 'Base imponible total',
      'inv.vatTotal': 'Total IVA',
      'inv.grossTotal': 'Total a pagar',
      'inv.vatFrom': 'IVA',
      'inv.netLabel': 'base imponible',
      'inv.pricesInclNote': 'Los precios se tratan como IVA incluido.',
      'inv.pricesExclNote': 'Los precios van sin IVA; el IVA se añade encima.',
      'inv.reverseCharge': 'Autoliquidación inversa del IVA (UE, 0 %)',
      'inv.rcHint': 'El IVA de todas las líneas se fija en 0 % y la factura incluye la mención obligatoria de autoliquidación inversa.',
      'inv.rcAnnotation': 'IVA Autoliquidación inversa — destinatario obligado al pago (Directiva 2006/112/CE art. 196)',
      'inv.ref': 'Referencia de pago',
      'inv.refNational': 'Referencia nacional finlandesa',
      'inv.refRF': 'Referencia internacional RF (ISO 11649)',
      'inv.refNationalHint': 'Estándar finlandés, dígito de control 7-3-1. Para pagos dentro de Finlandia.',
      'inv.refRFHint': 'Válida también para pagos SEPA internacionales.',
      'inv.refHint': 'Las referencias se generan automáticamente a partir del número de factura (la RF usa sus letras y dígitos).',
      'inv.refCheckPh': 'Pega una referencia o referencia RF para comprobar…',
      'inv.refCheckLabel': 'Referencia a comprobar',
      'inv.refCheckBtn': 'Comprobar',
      'inv.refValidNational': '✓ Referencia nacional finlandesa válida',
      'inv.refValidRF': '✓ Referencia RF válida',
      'inv.refInvalid': '✗ Referencia no válida',
      'inv.refUnknown': '✗ Formato desconocido',
      'inv.new': 'Nueva factura',
      'inv.print': 'Imprimir / Guardar en PDF',
      'inv.confirmNew': '¿Crear una nueva factura? Se borrarán el cliente, las líneas y el mensaje – tus datos se conservan y el número se incrementa.',
      'inv.autosave': 'El borrador se guarda automáticamente en tu navegador.',
      'inv.savedAt': 'Guardado',
      'inv.storageTitle': 'Almacenamiento de datos',
      'inv.storageInfo': 'Tus datos se guardan solo en tu navegador — nunca se envían a ningún servidor.',
      'inv.remember': 'Recordar mis datos en este dispositivo',
      'inv.clearSaved': 'Borrar datos guardados',
      'inv.confirmClear': '¿Borrar todos los datos guardados (borrador y tus datos)? No se puede deshacer.',
      'inv.confirmRememberOff': '¿Desactivar el guardado? Se borrarán todos los datos guardados del navegador.',
      'inv.storageOff': 'No se está guardando nada – el guardado está desactivado.',
      'inv.cleared': 'Datos guardados borrados.',
      'print.title': 'FACTURA',
      'print.number': 'Nº factura',
      'print.date': 'Fecha',
      'print.due': 'Vencimiento',
      'print.terms': 'Plazo de pago',
      'print.days': 'días',
      'print.client': 'Cliente',
      'print.desc': 'Concepto',
      'print.qty': 'Cant.',
      'print.unit': 'Ud.',
      'print.unitPrice': 'Precio unit. €',
      'print.vat': 'IVA %',
      'print.sum': 'Total €',
      'print.net': 'Base imp.',
      'print.vatSum': 'IVA',
      'print.total': 'Total a pagar',
      'print.payment': 'Forma de pago',
      'print.iban': 'Cuenta (IBAN)',
      'print.ref': 'Referencia',
      'print.refRf': 'Referencia RF',
      'print.amount': 'Importe a pagar',
      'print.bid': 'NIF/CIF',
      'print.thanks': '¡Gracias por su confianza!',
      'print.disclaimer': 'No es asesoramiento jurídico.',
      'print.payableBy': 'Vencimiento',
      'print.madeWith': 'Factura creada con Laskupaja – laskupaja.com',
    },
    de: {
      'inv.title': 'Rechnung erstellen',
      'inv.lead': 'Daten ausfüllen, Zusammenfassung prüfen und die Rechnung als A4-PDF drucken. Der Entwurf wird automatisch im Browser gespeichert.',
      'inv.myDetails': 'Meine Daten – Leistender',
      'inv.myDetailsHint': 'Diese Daten werden in deinem Browser gespeichert und bei künftigen Rechnungen vorbefüllt.',
      'inv.senderName': 'Name oder Firma *',
      'inv.namePh': 'z. B. Max Mustermann / Mustermann GmbH',
      'inv.senderBid': 'Steuernummer / USt-IdNr.',
      'inv.address': 'Adresse',
      'inv.iban': 'IBAN (Kontonummer)',
      'inv.defaultTerms': 'Standard-Zahlungsziel (Tage)',
      'inv.defaultVat': 'Standard-MwSt. % für neue Positionen',
      'inv.client': 'Kunde',
      'inv.clientName': 'Name oder Firma *',
      'inv.clientBid': 'Steuernummer / USt-IdNr. (optional)',
      'inv.details': 'Rechnungsdaten',
      'inv.number': 'Rechnungsnummer',
      'inv.date': 'Rechnungsdatum',
      'inv.terms': 'Zahlungsziel (Tage)',
      'inv.due': 'Fälligkeitsdatum',
      'inv.pricesIncl': 'Eingegebene Einzelpreise enthalten MwSt.',
      'inv.pricesInclHint': 'Wenn deaktiviert, gelten Preise als Netto (ohne MwSt.) und die MwSt. wird oben aufgeschlagen.',
      'inv.notes': 'Nachricht auf der Rechnung (optional)',
      'inv.notesPh': 'z. B. Vielen Dank für Ihren Auftrag!',
      'inv.items': 'Rechnungspositionen',
      'inv.desc': 'Beschreibung',
      'inv.descPh': 'z. B. Webdesign',
      'inv.qty': 'Menge',
      'inv.unit': 'Einheit',
      'inv.unitPrice': 'Einzelpreis (€)',
      'inv.vatCol': 'MwSt. %',
      'inv.sum': 'Summe',
      'inv.removeRow': 'Position entfernen',
      'inv.addRow': '+ Position hinzufügen',
      'inv.totals': 'Zusammenfassung',
      'inv.netTotal': 'Gesamt netto',
      'inv.vatTotal': 'MwSt. gesamt',
      'inv.grossTotal': 'Gesamt brutto',
      'inv.vatFrom': 'MwSt.',
      'inv.netLabel': 'netto',
      'inv.pricesInclNote': 'Preise gelten als inkl. MwSt.',
      'inv.pricesExclNote': 'Preise sind netto; die MwSt. wird aufgeschlagen.',
      'inv.reverseCharge': 'Umkehrung der Steuerschuldnerschaft (EU, 0 %)',
      'inv.rcHint': 'Die MwSt. aller Positionen wird auf 0 % gesetzt und die Rechnung erhält den vorgeschriebenen Hinweis zur Umkehrung der Steuerschuldnerschaft.',
      'inv.rcAnnotation': 'Umkehrung der Steuerschuldnerschaft — Leistungsempfänger schuldet die Steuer (RL 2006/112/EG Art. 196)',
      'inv.ref': 'Zahlungsreferenz',
      'inv.refNational': 'Finnische nationale Referenz',
      'inv.refRF': 'Internationale RF-Referenz (ISO 11649)',
      'inv.refNationalHint': 'Finnischer Standard, Prüfziffer 7-3-1. Für Zahlungen innerhalb Finnlands.',
      'inv.refRFHint': 'Auch für internationale SEPA-Zahlungen geeignet.',
      'inv.refHint': 'Referenzen werden automatisch aus der Rechnungsnummer erzeugt (die RF nutzt ihre Buchstaben und Ziffern).',
      'inv.refCheckPh': 'Referenz oder RF-Referenz zum Prüfen einfügen…',
      'inv.refCheckLabel': 'Zu prüfende Referenz',
      'inv.refCheckBtn': 'Prüfen',
      'inv.refValidNational': '✓ Gültige finnische Referenz',
      'inv.refValidRF': '✓ Gültige RF-Referenz',
      'inv.refInvalid': '✗ Ungültige Referenz',
      'inv.refUnknown': '✗ Unbekanntes Format',
      'inv.new': 'Neue Rechnung',
      'inv.print': 'Drucken / Als PDF speichern',
      'inv.confirmNew': 'Neue Rechnung erstellen? Kunde, Positionen und Nachricht werden gelöscht – deine Daten bleiben erhalten und die Nummer wird hochgezählt.',
      'inv.autosave': 'Der Entwurf speichert sich automatisch im Browser.',
      'inv.savedAt': 'Gespeichert',
      'inv.storageTitle': 'Datenspeicherung',
      'inv.storageInfo': 'Deine Daten werden nur in deinem Browser gespeichert — sie werden nie an einen Server gesendet.',
      'inv.remember': 'Meine Daten auf diesem Gerät merken',
      'inv.clearSaved': 'Gespeicherte Daten löschen',
      'inv.confirmClear': 'Alle gespeicherten Daten löschen (Entwurf und meine Daten)? Das kann nicht rückgängig gemacht werden.',
      'inv.confirmRememberOff': 'Merken ausschalten? Alle gespeicherten Daten werden aus dem Browser gelöscht.',
      'inv.storageOff': 'Es wird nichts gespeichert – das Merken ist ausgeschaltet.',
      'inv.cleared': 'Gespeicherte Daten gelöscht.',
      'print.title': 'RECHNUNG',
      'print.number': 'Rechnungsnr.',
      'print.date': 'Rechnungsdatum',
      'print.due': 'Fälligkeitsdatum',
      'print.terms': 'Zahlungsziel',
      'print.days': 'Tage',
      'print.client': 'Leistungsempfänger',
      'print.desc': 'Beschreibung',
      'print.qty': 'Menge',
      'print.unit': 'Einh.',
      'print.unitPrice': 'Einzelpreis €',
      'print.vat': 'MwSt. %',
      'print.sum': 'Summe €',
      'print.net': 'Netto',
      'print.vatSum': 'MwSt.',
      'print.total': 'Gesamtbetrag',
      'print.payment': 'Zahlung',
      'print.iban': 'Konto (IBAN)',
      'print.ref': 'Referenznr.',
      'print.refRf': 'RF-Referenz',
      'print.amount': 'Zahlbetrag',
      'print.bid': 'Steuernummer/USt-IdNr.',
      'print.thanks': 'Vielen Dank für die Zusammenarbeit!',
      'print.disclaimer': 'Keine Rechtsberatung.',
      'print.payableBy': 'Zahlbar bis',
      'print.madeWith': 'Rechnung erstellt mit Laskupaja – laskupaja.com',
    },
  });

  /* ---------- constants & helpers ---------- */

  const VAT_OPTIONS = [
    { value: '25.5', key: 'vat.255' },
    { value: '13.5', key: 'vat.135' },
    { value: '10', key: 'vat.10' },
    { value: '0', key: 'vat.0' },
  ];

  /* Country rate context (set by localized generators via js/vat-context.js,
   * built from ?country=CC&vat=XX or the stored laskupaja:country).
   * Null on /lasku/, so Finnish pages keep the fixed 2026 options above. */
  const CTX = window.LP_VAT_CONTEXT || null;

  function vatOptions() {
    if (!CTX) return VAT_OPTIONS;
    return CTX.rates.map((v) => ({ value: String(v), label: v + '%', key: null }));
  }

  const LS_DRAFT = 'laskupaja:draft';
  const LS_LAST_NO = 'laskupaja:lastInvoiceNo';
  const LS_PROFILE = 'laskupaja:profile';   /* business profile, separate from the draft */
  const LS_REMEMBER = 'laskupaja:remember'; /* '0' = opted out; absent = on (default) */
  /* Data keys wiped by the storage opt-out and the "Clear saved data" button.
   * laskupaja:lang (js/i18n.js) is deliberately NOT wiped: language is a
   * non-personal UI preference, not user data, and per spec it may persist
   * even when remember=off. The remember flag itself is also a setting – the
   * opt-out writes '0' to it so the choice survives reloads. */
  const LS_DATA_KEYS = [LS_DRAFT, LS_LAST_NO, LS_PROFILE];
  const DEFAULT_TERMS = 14;

  /* Locale for Intl formatting (money, dates, times) per UI language. */
  const LOCALES = {
    fi: 'fi-FI',
    en: 'en-IE',
    es: 'es-ES',
    de: 'de-DE',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function parseNum(s) {
    const v = parseFloat(String(s == null ? '' : s).replace(/\s+/g, '').replace(',', '.'));
    return isNaN(v) ? 0 : v;
  }

  function fmtMoney(cents) {
    const locale = LOCALES[LP.i18n.getLang()] || 'en-IE';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
  }

  function fmtRate(rateStr) {
    const n = Number(rateStr);
    const lang = LP.i18n.getLang();
    return lang === 'en' ? n + '%' : String(n).replace('.', ',') + ' %';
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(LOCALES[LP.i18n.getLang()] || 'en-GB', {
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

  /* Replace the Finnish VAT options with the preset country's rates and
   * preselect ?vat=XX (or the standard rate) when CTX is set. */
  function applyVatContext() {
    const opts = vatOptions();
    $('#profileVat').innerHTML = opts
      .map((o) => `<option value="${o.value}">${esc(o.label)}</option>`)
      .join('');
    if (CTX.defaultVat && opts.some((o) => o.value === CTX.defaultVat)) {
      $('#profileVat').value = CTX.defaultVat;
    }
  }

  /* ---------- storage opt-out ---------- */

  /* Remembering is ON by default; only an explicit '0' opts out. */
  function rememberOn() {
    return lsGet(LS_REMEMBER) !== '0';
  }

  /* Wipe every data key the app writes (draft, last number, profile). */
  function wipeStoredData() {
    LS_DATA_KEYS.forEach(lsDel);
  }

  /* Status line inside the storage box (aria-live). */
  function setStorageStatus(msg) {
    const el = $('#storage-status');
    if (el) el.textContent = msg || '';
  }

  /* Sync checkbox, box look and status line with the remember setting. */
  function refreshStorageUI() {
    const on = rememberOn();
    $('#rememberMe').checked = on;
    const box = $('#storage-box');
    if (box) box.classList.toggle('off', !on);
    setStorageStatus(on ? '' : t('inv.storageOff'));
    if (!on) $('#autosave-note').textContent = t('inv.storageOff');
  }

  /* ---------- line rows ---------- */

  function vatSelectHTML(selected) {
    return vatOptions()
      .map((o) => {
        const sel = o.value === selected ? ' selected' : '';
        return o.key
          ? `<option value="${o.value}"${sel} data-i18n="${o.key}"></option>`
          : `<option value="${o.value}"${sel}>${esc(o.label)}</option>`;
      })
      .join('');
  }

  /* Current profile defaults (fallbacks match the HTML defaults). */
  function defaultTerms() {
    const n = parseInt($('#profileTerms').value, 10);
    return isNaN(n) ? DEFAULT_TERMS : n;
  }

  function defaultVat() {
    const el = $('#profileVat');
    const valid = vatOptions().map((o) => o.value);
    /* clamp: stored profile values from the other page (e.g. Finnish 25.5
     * on a DE-preset page) fall back to the first option */
    if (el && valid.indexOf(el.value) !== -1) return el.value;
    return valid[0];
  }

  /* ---------- EU reverse charge (B2B, 0 %) ---------- */

  /* While the reverse-charge checkbox (#reverseCharge) is on, every line's
   * VAT is forced to 0 % (Directive 2006/112/EC art. 196: the recipient is
   * liable for the VAT) and the print view carries the mandatory annotation.
   * Each row select remembers its previous rate in data-prev-vat so
   * unchecking restores the invoice as it was. */
  function rcOn() {
    const cb = $('#reverseCharge');
    return !!(cb && cb.checked);
  }

  function applyReverseCharge(remember) {
    const on = rcOn();
    const profileSel = $('#profileVat');
    if (profileSel) profileSel.disabled = on;
    $$('#items-body .item-row').forEach((tr) => {
      const sel = tr.querySelector('.ri-vat');
      if (!sel) return;
      if (on) {
        if (remember && sel.value !== '0' && !sel.dataset.prevVat) {
          sel.dataset.prevVat = sel.value;
        }
        sel.value = '0';
        sel.disabled = true;
      } else {
        sel.disabled = false;
        if (sel.dataset.prevVat) {
          sel.value = sel.dataset.prevVat;
          delete sel.dataset.prevVat;
        }
      }
    });
  }

  function addRow(item) {
    const item_ = item || {};
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = [
      `<td class="col-desc" data-i18n-label="inv.desc"><input type="text" class="ri-desc" value="${esc(item_.desc || '')}" data-i18n-placeholder="inv.descPh"></td>`,
      `<td data-i18n-label="inv.qty"><input type="text" inputmode="decimal" class="ri-qty" value="${esc(item_.qty != null ? item_.qty : 1)}"></td>`,
      `<td data-i18n-label="inv.unit"><input type="text" list="unit-list" class="ri-unit" value="${esc(item_.unit || (CTX && CTX.unit) || 'kpl')}"></td>`,
      `<td data-i18n-label="inv.unitPrice"><input type="text" inputmode="decimal" class="ri-price" placeholder="0,00" value="${esc(item_.price != null ? item_.price : '')}"></td>`,
      `<td data-i18n-label="inv.vatCol"><select class="ri-vat"${rcOn() ? ' disabled' : ''}>${vatSelectHTML(rcOn() ? '0' : (item_.vat || defaultVat()))}</select></td>`,
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
    const rcNote = rcOn()
      ? `<p class="hint rc-note">${esc(t('inv.rcAnnotation'))}</p>`
      : '';
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
      `<p class="hint">${esc(pricesIncl ? t('inv.pricesInclNote') : t('inv.pricesExclNote'))}</p>` +
      rcNote +
      `</div>`;
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

  /* ---------- business profile ("Omat tiedot") ---------- */

  /* The sender card on the page doubles as the profile editor: name,
   * Y-tunnus, address, IBAN + default payment terms and default VAT %.
   * Stored under its own localStorage key, separately from the draft. */
  function collectProfile() {
    const terms = parseInt($('#profileTerms').value, 10);
    return {
      v: 1,
      name: $('#senderName').value,
      bid: $('#senderBid').value,
      address: $('#senderAddress').value,
      iban: $('#senderIban').value,
      defaultTerms: isNaN(terms) ? DEFAULT_TERMS : String(terms),
      defaultVat: $('#profileVat').value || '25.5',
    };
  }

  function applyProfile(p) {
    if (!p) return;
    const set = (id, v) => { if (v != null) $(id).value = v; };
    set('#senderName', p.name);
    set('#senderBid', p.bid);
    set('#senderAddress', p.address);
    set('#senderIban', p.iban);
    set('#profileTerms', p.defaultTerms);
    set('#profileVat', p.defaultVat);
  }

  function loadProfile() {
    const raw = lsGet(LS_PROFILE);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { lsDel(LS_PROFILE); return null; }
  }

  /* Profile persistence is gated by the remember opt-out. */
  function saveProfile() {
    if (!rememberOn()) return;
    lsSet(LS_PROFILE, JSON.stringify(collectProfile()));
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
      notes: $('#invoiceNotes').value,
      pricesIncl: $('#pricesInclVat').checked,
      reverseCharge: rcOn(),
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
    set('#invoiceNotes', d.notes);
    if (d.pricesIncl != null) $('#pricesInclVat').checked = !!d.pricesIncl;
    if (d.reverseCharge != null) $('#reverseCharge').checked = !!d.reverseCharge;
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
    if (!rememberOn()) {
      /* opted out: nothing is ever persisted; keep the UI honest */
      $('#autosave-note').textContent = t('inv.storageOff');
      return;
    }
    const data = collectForm();
    lsSet(LS_DRAFT, JSON.stringify(data));
    saveProfile(); /* the sender card fields double as the persistent profile */
    if (data.meta.number && data.meta.number.trim()) {
      lsSet(LS_LAST_NO, data.meta.number.trim());
    }
    const note = $('#autosave-note');
    const time = new Date().toLocaleTimeString(LOCALES[LP.i18n.getLang()] || 'en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
    note.textContent = t('inv.savedAt') + ' ' + time;
  }

  /* Invoice numbering lives in js/numbering.js (LP.numbering),
   * shared with tests/increment.test.js via its UMD-lite export. */

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
      (d.notes && d.notes.trim() ? `<p class="pv-notes">${esc(d.notes)}</p>` : '') +
      `<table class="pv-totals">${breakdownRows}` +
      `<tr><td>${esc(t('print.net'))}</td><td class="num">${esc(fmtMoney(totals.netC))}</td></tr>` +
      `<tr><td>${esc(t('print.vatSum'))}</td><td class="num">${esc(fmtMoney(totals.vatC))}</td></tr>` +
      `<tr class="grand"><td>${esc(t('print.total'))}</td><td class="num">${esc(fmtMoney(totals.grossC))}</td></tr></table>` +
      (rcOn() ? `<p class="pv-rc">${esc(t('inv.rcAnnotation'))}</p>` : '') +
      `<div class="pv-payment"><h3>${esc(t('print.payment'))}</h3><dl>` +
      `<dt>${esc(t('print.iban'))}</dt><dd>${esc(d.sender.iban || '—')}</dd>` +
      `<dt>${esc(t('print.ref'))}</dt><dd>${refs && refs.national ? esc(refs.national) : '—'}</dd>` +
      `<dt>${esc(t('print.refRf'))}</dt><dd>${refs && refs.rf ? esc(refs.rf) : '—'}</dd>` +
      `<dt>${esc(t('print.amount'))}</dt><dd>${esc(fmtMoney(totals.grossC))}</dd>` +
      `<dt>${esc(t('print.payableBy'))}</dt><dd>${esc(fmtDate(d.meta.due))}</dd>` +
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
    if (CTX) applyVatContext(); /* country options before profile/draft load */
    /* default or restored state */
    const remember = rememberOn();
    refreshStorageUI(); /* checkbox reflects the stored opt-out */
    if (remember) {
      const profile = loadProfile();
      if (profile) applyProfile(profile);
      const draftRaw = lsGet(LS_DRAFT);
      if (draftRaw) {
        let draftApplied = false;
        try { applyDraft(JSON.parse(draftRaw)); draftApplied = true; } catch (e) { lsDel(LS_DRAFT); }
        if (draftApplied && !profile) {
          /* migrate: v1 drafts predate the separate profile store */
          saveProfile();
        }
      } else if (profile) {
        /* fresh invoice with saved defaults: terms follow the profile */
        $('#paymentTerms').value = defaultTerms();
      }
    }
    if (rcOn()) applyReverseCharge(false); /* restored draft had RC on: force 0 % + lock selects */
    if (!$('#items-body .item-row')) addRow();
    if (!$('#invoiceDate').value) $('#invoiceDate').value = todayISO();
    if (!$('#paymentTerms').value) $('#paymentTerms').value = defaultTerms();
    if (!$('#dueDate').value) syncDueFromTerms();
    if (!$('#invoiceNumber').value) {
      $('#invoiceNumber').value = Numbering.nextInvoiceNumber(lsGet(LS_LAST_NO));
    }
    if (!remember) $('#autosave-note').textContent = t('inv.storageOff');

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

    /* reverse charge (B2B, 0 %): force all line VAT to zero + annotate */
    $('#reverseCharge').addEventListener('change', () => {
      applyReverseCharge(true);
      renderTotals();
      buildPrintView();
      scheduleSave();
    });

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

    /* new invoice: keep the business profile, clear per-invoice fields */
    $('#new-invoice-btn').addEventListener('click', () => {
      if (!window.confirm(t('inv.confirmNew'))) return;
      const profile = collectProfile(); /* snapshot before form.reset() */
      /* When remembering is off there is no stored last number, so the
       * on-screen number is the increment base. */
      const lastNo = (rememberOn() && lsGet(LS_LAST_NO)) || $('#invoiceNumber').value.trim();
      const next = Numbering.nextInvoiceNumber(lastNo || null);
      lsDel(LS_DRAFT);
      $('#invoice-form').reset();
      applyReverseCharge(false); /* reset unchecked RC: re-enable the VAT selects */
      applyProfile(profile);
      $('#items-body').innerHTML = '';
      addRow(); /* picks up the profile default VAT */
      $('#invoiceDate').value = todayISO();
      $('#paymentTerms').value = defaultTerms();
      syncDueFromTerms();
      $('#invoiceNumber').value = next;
      renderTotals();
      renderRefs();
      buildPrintView();
      saveDraft(); /* no-op when remembering is off */
      $('#clientName').focus(); /* sender stays prefilled → start at the client */
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* storage opt-out & clear (storage box above the form) */
    $('#rememberMe').addEventListener('change', () => {
      if ($('#rememberMe').checked) {
        lsSet(LS_REMEMBER, '1');
        setStorageStatus('');
        saveDraft(); /* immediately persist the current profile + draft again */
      } else {
        if (!window.confirm(t('inv.confirmRememberOff'))) {
          $('#rememberMe').checked = true; /* cancelled: revert the toggle */
          return;
        }
        wipeStoredData();
        lsSet(LS_REMEMBER, '0'); /* the opt-out itself is a setting: persist it */
        refreshStorageUI();
        $('#autosave-note').textContent = t('inv.storageOff');
      }
    });

    $('#clear-saved-btn').addEventListener('click', () => {
      if (!window.confirm(t('inv.confirmClear'))) return;
      wipeStoredData();
      setStorageStatus(t('inv.cleared'));
      $('#autosave-note').textContent = t('inv.cleared');
      /* While remembering stays on, the next edit autosaves a fresh draft. */
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
      refreshStorageUI(); /* re-translate the storage status line */
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
