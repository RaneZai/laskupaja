#!/usr/bin/env python3
"""Render the single EU VAT reference from reviewed data; no extra pages."""
import datetime as dt
import html
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
CODES = 'AT BE BG HR CY CZ DK EE FI FR DE EL HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split()
OFFICIAL = ('europa.eu', 'usp.gv.at', 'bmf.gv.at', 'fin.belgium.be', 'finances.belgium.be',
 'nra.bg', 'porezna-uprava.gov.hr', 'porezna-uprava.hr', 'mof.gov.cy', 'gov.cy',
 'financnisprava.gov.cz', 'mfcr.cz', 'skat.dk', 'emta.ee', 'vero.fi', 'impots.gouv.fr',
 'bundesfinanzministerium.de', 'gesetze-im-internet.de', 'aade.gr', 'minfin.gov.gr',
 'nav.gov.hu', 'revenue.ie', 'agenziaentrate.gov.it', 'finanze.gov.it', 'vid.gov.lv',
 'vmi.lt', 'guichet.public.lu', 'pfi.public.lu', 'aed.public.lu', 'mtca.gov.mt',
 'cfr.gov.mt', 'belastingdienst.nl', 'podatki.gov.pl', 'portaldasfinancas.gov.pt',
 'anaf.ro', 'mfinante.gov.ro', 'financnasprava.sk', 'gov.si', 'fu.gov.si',
 'agenciatributaria.gob.es', 'skatteverket.se')

def official(url):
    u = urlsplit(url)
    return u.scheme == 'https' and not u.username and not u.password and u.port in (None,443) and any(u.hostname == d or (u.hostname or '').endswith('.'+d) for d in OFFICIAL)

def validate(data):
    assert set(data) == {'checked','content_updated','countries'}, 'Unexpected data fields'
    checked = dt.date.fromisoformat(data['checked'])
    assert dt.date.fromisoformat(data['content_updated']) <= checked, 'Content date after check'
    assert checked <= dt.datetime.now(dt.timezone(dt.timedelta(hours=3))).date(), 'Future check date'
    assert [c['code'] for c in data['countries']] == CODES, 'Country coverage/order changed'
    for c in data['countries']:
        assert set(c) == {'code','name','standard','reduced','sources','note'}
        assert isinstance(c['name'],str) and 1 <= len(c['name']) <= 30
        assert type(c['standard']) in (int,float) and math.isfinite(c['standard']) and 0 < c['standard'] <= 100
        assert isinstance(c['reduced'],list) and len(c['reduced']) <= 12
        assert all(type(r) in (int,float) and math.isfinite(r) and 0 <= r < c['standard'] for r in c['reduced'])
        assert len(c['reduced']) == len(set(c['reduced']))
        assert isinstance(c['note'],str) and len(c['note']) <= 700
        assert 1 <= len(c['sources']) <= 8 and all(official(u) for u in c['sources']), 'Official HTTPS sources required'
    return data

def number(n):
    return format(n, '.10g')

def render(source, data):
    validate(data)
    rows, notes = [], []
    for c in data['countries']:
        name, code = html.escape(c['name']), c['code']
        standard = number(c['standard'])
        rates = ' / '.join(number(n) for n in c['reduced']) + '%' if c['reduced'] else '—'
        rows.append(f'<tr data-country="{name}" data-rate="{standard}" data-code="{code}"><th scope="row"><span class="code">{code}</span>{name}</th><td class="rate">{standard}%</td><td>{rates}</td><td><button class="use" type="button" aria-label="Use {name} standard rate">Use rate <span aria-hidden="true">↗</span></button></td></tr>')
        links = ' · '.join(f'<a href="{html.escape(u,quote=True)}">{html.escape(urlsplit(u).hostname)}</a>' for u in c['sources'])
        note = f'<p>{html.escape(c["note"])}</p>' if c['note'] else ''
        notes.append(f'<li><strong>{name}</strong>{note}<p>{links}</p></li>')
    source, n = re.subn(r'<tbody>.*?</tbody>',lambda _: '<tbody>\n'+'\n'.join(rows)+'\n</tbody>',source,flags=re.S)
    assert n == 1
    fi = next(c for c in data['countries'] if c['code'] == 'FI')
    options = f'<option value="{number(fi["standard"])}">Standard · {number(fi["standard"])}%</option>'
    options += ''.join(f'<option value="{number(r)}">Reduced / special · {number(r)}%</option>' for r in fi['reduced'])
    options += '<option value="custom">Custom rate…</option>'
    source,n = re.subn(r'(<select id="rate-choice"[^>]*>).*?</select>', lambda m:m[1]+options+'</select>',source)
    assert n == 1
    day = dt.date.fromisoformat(data['checked'])
    source,n = re.subn(r'<time datetime="[^"]+">.*?</time>',f'<time datetime="{day.isoformat()}">{day.day} {day:%B %Y}</time>',source)
    assert n == 1
    source,n = re.subn(r'<!-- country-notes:start -->.*?<!-- country-notes:end -->',lambda _: '<!-- country-notes:start --><details><summary>Country notes and official sources</summary><ul class="country-notes">'+'\n'.join(notes)+'</ul></details><!-- country-notes:end -->',source,flags=re.S)
    assert n == 1
    return source

if __name__ == '__main__':
    data = json.loads((ROOT/'eu-vat-rates/rates.json').read_text())
    path = ROOT/'eu-vat-rates/index.html'
    current = path.read_text()
    result = render(current,data)
    if '--check' in sys.argv:
        assert current == result, 'VAT HTML is out of sync with reviewed data'
        print('EU VAT: 27 countries, official sources, dates and static HTML verified')
    else:
        path.write_text(result)
