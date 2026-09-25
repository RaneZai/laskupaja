/* Device-local records. No network calls; backup encryption uses Web Crypto. */
(function (g) {
  'use strict';
  const VERSION = 1, MAX_BYTES = 25 * 1024 * 1024, GROUPS = ['customers', 'products', 'profiles', 'invoices'];
  const copy = v => structuredClone(v);
  const uid = () => crypto.randomUUID();
  const fail = code => { throw new Error(code); };
  function text(v, limit = 10000) { if (typeof v !== 'string' || v.length > limit) fail('invalid'); }
  function plain(v) { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('invalid'); }
  function safe(v, depth = 0) {
    if (depth > 12) fail('invalid');
    if (typeof v === 'string') text(v);
    else if (typeof v === 'number') { if (!Number.isFinite(v)) fail('invalid'); }
    else if (v === null || typeof v === 'boolean') return;
    else if (Array.isArray(v)) { if (v.length > 5000) fail('invalid'); v.forEach(x => safe(x, depth + 1)); }
    else { plain(v); for (const k of Object.keys(v)) { if (['__proto__', 'prototype', 'constructor'].includes(k)) fail('invalid'); safe(v[k], depth + 1); } }
  }
  function draft(d) {
    plain(d); safe(d);
    for (const k of ['sender','client','meta']) plain(d[k]);
    for (const [obj, keys] of [[d.sender,['name','bid','address','iban']],[d.client,['name','bid','address']],[d.meta,['number','date','terms','due']]]) keys.forEach(k => text(obj[k]));
    text(d.notes); if (!Array.isArray(d.items) || d.items.length > 500) fail('invalid');
    for (const it of d.items) { plain(it); text(it.desc); text(it.unit); for (const k of ['qty','price','vat']) if (!['string','number'].includes(typeof it[k]) || !Number.isFinite(Number(String(it[k]).replace(',','.')))) fail('invalid'); }
  }
  function validate(s) {
    plain(s); safe(s);
    if (s.schema !== VERSION || !Number.isSafeInteger(s.revision) || s.revision < 0) fail('invalid');
    text(s.id, 100); text(s.updated, 100); plain(s.working);
    for (const [market,w] of Object.entries(s.working)) { if (!['FI','DE','ES'].includes(market)) fail('invalid'); plain(w); draft(w.draft); plain(w.profile); text(w.lastNo); if(w.invoiceId!=null)text(w.invoiceId,100); }
    for (const type of GROUPS) {
      if (!Array.isArray(s[type]) || s[type].length > 5000) fail('invalid');
      const ids = new Set();
      for (const r of s[type]) {
        plain(r); text(r.id,100); if (ids.has(r.id)) fail('invalid'); ids.add(r.id);
        text(r.name,200); text(r.updated,100); if (!['FI','DE','ES'].includes(r.market)) fail('invalid'); plain(r.data);
        if (type === 'invoices') {
          draft(r.data);
          if(r.status!==undefined && !['paid','unpaid'].includes(r.status))fail('invalid');
          if(r.history!==undefined){
            if(!Array.isArray(r.history))fail('invalid');
            for(const v of r.history){plain(v);text(v.updated,100);draft(v.data);}
          }
        }
        if (type === 'customers') ['name','bid','address','email','terms'].forEach(k => text(r.data[k]));
        if (type === 'profiles') ['name','bid','address','iban','defaultTerms','defaultVat'].forEach(k => { if (!['string','number'].includes(typeof r.data[k])) fail('invalid'); });
        if (type === 'products') { if(r.data.name!==undefined)text(r.data.name,200); ['desc','unit','price','vat'].forEach(k => text(r.data[k])); if (typeof r.data.pricesIncl !== 'boolean' || !Number.isFinite(Number(r.data.price.replace(',','.'))) || !Number.isFinite(Number(r.data.vat))) fail('invalid'); }
      }
    }
    return s;
  }
  function empty() { return {schema:VERSION,id:uid(),revision:0,updated:new Date().toISOString(),working:{},customers:[],products:[],profiles:[],invoices:[]}; }
  class Store {
    constructor() { this.db = null; this.state = null; }
    async open() {
      this.db = await new Promise((resolve,reject) => {
        const r = indexedDB.open('laskupaja-library',1);
        r.onupgradeneeded = () => { r.result.createObjectStore('data'); r.result.createObjectStore('settings'); };
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error('blocked'));
      });
      this.db.onversionchange = () => this.db.close();
      await this.edit(s => s, true);
      return this.state;
    }
    async read() {
      const result = await new Promise((resolve,reject) => { const tx=this.db.transaction('data');const r=tx.objectStore('data').get('state'); r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
      return validate(result);
    }
    edit(fn, initialize = false) {
      const expected = this.state && {id:this.state.id,revision:this.state.revision};
      return new Promise((resolve,reject) => {
        const tx=this.db.transaction('data','readwrite');const os=tx.objectStore('data');const r=os.get('state');let next, reason;
        r.onsuccess=()=> { try {
          const current=r.result || empty();
          if (!initialize && expected && (current.id!==expected.id || current.revision!==expected.revision)) fail('conflict');
          next=fn(copy(current)) || current;
          if (!initialize) { next.revision=current.revision+1;next.updated=new Date().toISOString(); }
          validate(next);os.put(next,'state');
        } catch(e) {reason=e;tx.abort();} };
        tx.oncomplete=()=>{this.state=copy(next);resolve(copy(next));};
        tx.onabort=()=>reject(reason || tx.error || new Error('storage'));tx.onerror=()=>{};
      });
    }
    setting(key,value) {
      return new Promise((resolve,reject)=>{const tx=this.db.transaction('settings',arguments.length===1?'readonly':'readwrite');const os=tx.objectStore('settings');const r=arguments.length===1?os.get(key):value===null?os.delete(key):os.put(value,key);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error || new Error('storage'));});
    }
    clear() {
      return new Promise((resolve,reject)=>{const tx=this.db.transaction(['data','settings'],'readwrite');const state=empty();tx.objectStore('data').put(state,'state');tx.objectStore('settings').clear();tx.oncomplete=()=>{this.state=state;resolve();};tx.onabort=()=>reject(tx.error||new Error('storage'));});
    }
  }
  const b64 = bytes => { let s=''; for (const n of bytes) s+=String.fromCharCode(n); return btoa(s); };
  const un64 = s => { text(s,MAX_BYTES*2); return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); };
  async function key(password,salt) {
    if (typeof password!=='string' || password.length<12 || password.length>1000) fail('password');
    const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function validateArchive(a) {
    plain(a);if(a.format!=='laskupaja-archive' || a.version!==1 || !Array.isArray(a.snapshots) || !a.snapshots.length || a.snapshots.length>5) fail('invalid');
    a.snapshots.forEach(validate); return a;
  }
  async function encrypt(archive,password) {
    validateArchive(archive);const input=new TextEncoder().encode(JSON.stringify(archive));if(input.length>MAX_BYTES) fail('tooLarge');
    const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(password,salt),input);
    const output=JSON.stringify({format:'laskupaja-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:600000,salt:b64(salt),iv:b64(iv),data:b64(new Uint8Array(encrypted))});
    if(output.length>MAX_BYTES)fail('tooLarge');return output;
  }
  async function decrypt(raw,password) {
    if(typeof raw!=='string'||raw.length>MAX_BYTES) fail('tooLarge');
    const e=JSON.parse(raw);if(e.format!=='laskupaja-encrypted'||e.version!==1||e.kdf!=='PBKDF2-SHA256'||e.iterations!==600000)fail('invalid');
    const salt=un64(e.salt),iv=un64(e.iv);if(salt.length!==16||iv.length!==12)fail('invalid');
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv},await key(password,salt),un64(e.data));
    return validateArchive(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  }
  function merge(local,incoming) {
    validate(local);validate(incoming); const out=copy(local);let conflicts=0;
    for (const type of GROUPS) for(const r of incoming[type]) {
      const old=out[type].find(x=>x.id===r.id);
      if(!old)out[type].push(copy(r));
      else if(JSON.stringify(old)!==JSON.stringify(r)){const clone=copy(r);clone.id=uid();out[type].push(clone);conflicts++;}
    }
    // Keep this browser's working drafts; imported drafts are recoverable invoices.
    for(const [market,w] of Object.entries(incoming.working)) {
      out.invoices.push({id:uid(),market,name:w.draft.meta.number||'Draft',updated:incoming.updated,data:copy(w.draft)});
    }
    return {state:validate(out),conflicts};
  }
  g.LPLibraryCore={Store,empty,validate,draft,copy,uid,encrypt,decrypt,merge,MAX_BYTES,GROUPS};
})(globalThis);
