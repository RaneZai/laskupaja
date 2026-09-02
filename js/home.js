/* ============================================================
 * Laskupaja – homepage strings (loaded after i18n.js)
 * The homepage has no logic beyond shared i18n.
 * ============================================================ */
(function () {
  'use strict';

  window.LP.i18n.register({
    fi: {
      'home.badge': 'ALV-kannat 2026 ajan tasalla: yleinen 25,5 % · alennettu 13,5 %',
      'home.heroTitle': 'Ilmainen laskutusohjelma suomalaisille freelancerille ja pienyrityksille',
      'home.lead':
        'Tee ammattimainen lasku PDF-muotoon ja laske arvonlisävero suoraan selaimessasi. ' +
        'Ei rekisteröitymistä, ei asennusta, ei käyttörajoja – ja kaikki tiedot pysyvät omalla koneellasi.',
      'home.ctaInvoice': 'Tee lasku →',
      'home.ctaVat': 'Laske ALV →',
      'home.toolInvoiceTitle': 'Laskun laatija',
      'home.toolInvoiceDesc':
        'Luo PDF-lasku suomeksi tai englanniksi: laskurivit, ALV-erittely kannan mukaan, ' +
        'viitenumero (kansallinen ja RF) sekä siisti A4-tuloste.',
      'home.toolVatTitle': 'ALV-laskuri',
      'home.toolVatDesc':
        'Laske ALV molempiin suuntiin – netosta bruttoon ja brutosta nettoon. ' +
        'Vuoden 2026 kannat (25,5 % / 13,5 % / 10 %) ja omat prosentit.',
      'home.open': 'Avaa työkalu →',
      'home.whyTitle': 'Miksi Laskupaja?',
      'home.f1t': 'Oikeat ALV-kannat 2026',
      'home.f1d': 'Alennettu kanta laski 14 % → 13,5 % 1.1.2026 alkaen – Laskupajassa uudet kannat ovat olleet käytössä siitä lähtien.',
      'home.f2t': 'Suomeksi ja englanniksi',
      'home.f2d': 'Koko työkalu vaihdetaan FI ↔ EN yhdellä klikkauksella – myös valmiin laskun kieli.',
      'home.f3t': 'Selkeä, ammattimainen tuloste',
      'home.f3d': 'A4-mittainen lasku oikealla ALV-erittelyllä ja maksutiedoilla. Tallennus PDF:nä yhdellä painalluksella.',
      'home.f4t': 'Yksityisyys ensin',
      'home.f4d': 'Ei kirjautumista, ei palvelinta, ei seurantaa. Laskun tiedot tallennetaan vain selaimesi muistiin.',
      'home.f5t': 'ALV-laskuri bonuksena',
      'home.f5d': 'Nopea laskuri arvonlisäveron lisäämiseen ja erottamiseen – myös custom-prosentilla.',
      'home.faqTitle': 'Usein kysyttyä',
      'home.q1': 'Onko Laskupaja todella ilmainen?',
      'home.a1': 'Kyllä. Ei rekisteröitymistä, ei maksua eikä käyttörajoja. Työkalut toimivat kokonaan selaimessa.',
      'home.q2': 'Minne tietoni tallennetaan?',
      'home.a2': 'Laskun luonnos ja asetukset tallentuvat vain selaimesi paikalliseen muistiin (localStorage). Mitään ei lähetetä palvelimelle.',
      'home.q3': 'Mikä ALV-kanta laskuuni kuuluu?',
      'home.a3': 'Useimmat palvelut: yleinen 25,5 %. Alennettu 13,5 % (1.1.2026 alkaen, aiemmin 14 %) koskee mm. elintarvikkeita, ravintola- ja ateriapalveluita, lääkkeitä ja majoitusta; 10 % esim. kirjoille. Epävarassa tarkista',
      'home.q4': 'Miten saan laskun PDF-tiedostona?',
      'home.a4': 'Täytä lasku ja paina Tulosta-painiketta tai Ctrl+P (Mac: Cmd+P) ja valitse "Tallenna PDF:änä". Tuloste on A4-kokoinen ja valmis asiakkaalle lähetettäväksi.',
      'home.privacyTitle': 'Yksityisyys: ',
      'home.privacyText': ' Laskupaja ei lähetä tietojasi minnekään. Sulje selain – luonnos odottaa sinua seuraavalla kerralla.',
      'home.privacyStorage':
        'Tiedot eivät koskaan lähde selaimestasi. Selaimeen tallentaminen on valinnaista – voit tyhjentää tallennetut tiedot milloin vain laskutyökalun sivulta.',
    },
    en: {
      'home.badge': '2026 VAT rates up to date: general 25.5% · reduced 13.5%',
      'home.heroTitle': 'Free invoicing tool for Finnish freelancers and small businesses',
      'home.lead':
        'Create a professional invoice as a PDF and calculate VAT right in your browser. ' +
        'No signup, no install, no usage limits – and your data never leaves your device.',
      'home.ctaInvoice': 'Make an invoice →',
      'home.ctaVat': 'Calculate VAT →',
      'home.toolInvoiceTitle': 'Invoice generator',
      'home.toolInvoiceDesc':
        'Build a PDF invoice in Finnish or English: line items, VAT breakdown by rate, ' +
        'payment references (Finnish and RF) and a clean A4 printout.',
      'home.toolVatTitle': 'VAT calculator',
      'home.toolVatDesc':
        'Add or remove VAT in either direction. 2026 rates (25.5% / 13.5% / 10%) plus custom percentages.',
      'home.open': 'Open tool →',
      'home.whyTitle': 'Why Laskupaja?',
      'home.f1t': 'Correct 2026 VAT rates',
      'home.f1d': 'Finland’s reduced rate dropped from 14% to 13.5% on 1 Jan 2026 – Laskupaja has used the new rates since day one.',
      'home.f2t': 'Finnish and English',
      'home.f2d': 'Switch the entire tool between FI ↔ EN with one click – including the finished invoice.',
      'home.f3t': 'Clean, professional printout',
      'home.f3d': 'An A4 invoice with a proper VAT breakdown and payment details. Save as PDF with one click.',
      'home.f4t': 'Privacy first',
      'home.f4d': 'No login, no server, no tracking. Invoice data is stored only in your browser.',
      'home.f5t': 'VAT calculator included',
      'home.f5d': 'A fast calculator for adding and removing VAT – with custom rates too.',
      'home.faqTitle': 'FAQ',
      'home.q1': 'Is Laskupaja really free?',
      'home.a1': 'Yes. No signup, no payment, no usage caps. The tools run entirely in your browser.',
      'home.q2': 'Where is my data stored?',
      'home.a2': 'The invoice draft and settings are saved only in your browser’s local storage. Nothing is ever sent to a server.',
      'home.q3': 'Which VAT rate applies to my invoice?',
      'home.a3': 'Most services: general 25.5%. The reduced 13.5% (from 1 Jan 2026, previously 14%) covers e.g. food, restaurant and catering services, medicines and accommodation; 10% e.g. books. When in doubt, check',
      'home.q4': 'How do I get the invoice as a PDF file?',
      'home.a4': 'Fill in the invoice and press the Print button or Ctrl+P (Mac: Cmd+P), then choose “Save as PDF”. The printout is A4 and ready to send.',
      'home.privacyTitle': 'Privacy: ',
      'home.privacyText': ' Laskupaja never sends your data anywhere. Close the browser – your draft will be waiting.',
      'home.privacyStorage':
        'Your data never leaves your browser. Saving to the browser is optional – you can clear the saved data at any time on the invoice tool page.',
    },
  });
})();
