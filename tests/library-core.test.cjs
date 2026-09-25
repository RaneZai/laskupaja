const test=require('node:test'),assert=require('node:assert/strict');
require('../js/library-store.js');const C=globalThis.LPLibraryCore;
const sample=()=>{const s=C.empty();s.customers.push({id:C.uid(),name:'Customer',market:'FI',updated:new Date().toISOString(),data:{name:'Customer',bid:'',address:'Private address',email:'a@example.test',terms:'14'}});return s;};
test('encryption authenticates password and contents and uses fresh randomness',async()=>{
 const a={format:'laskupaja-archive',version:1,snapshots:[sample()]},pw='correct horse battery staple';
 const one=await C.encrypt(a,pw),two=await C.encrypt(a,pw);assert.notEqual(one,two);assert(!one.includes('Private address'));assert.deepEqual(await C.decrypt(one,pw),a);
 await assert.rejects(C.decrypt(one,'a different password'));
 const tampered=JSON.parse(one);tampered.data=(tampered.data[0]==='A'?'B':'A')+tampered.data.slice(1);await assert.rejects(C.decrypt(JSON.stringify(tampered),pw));
});
test('bounds and format reject malicious or future archives before import',async()=>{
 const s=sample();s.schema=2;assert.throws(()=>C.validate(s));
 const dup=sample();dup.customers.push({...dup.customers[0]});assert.throws(()=>C.validate(dup));
 const polluted=JSON.parse('{"__proto__":{"polluted":true}}');const data=sample();data.customers[0].data.extra=polluted;assert.throws(()=>C.validate(data));assert.equal({}.polluted,undefined);
 const a={format:'laskupaja-archive',version:1,snapshots:[sample()]};await assert.rejects(C.encrypt(a,'short'));
 const e=JSON.parse(await C.encrypt(a,'a very long password'));e.iterations=999999999;await assert.rejects(C.decrypt(JSON.stringify(e),'a very long password'));
});
test('merge preserves differing records and does not mutate either input',()=>{
 const local=sample(),incoming=C.copy(local);incoming.customers[0].data.address='Other address';const before=C.copy(local);const merged=C.merge(local,incoming);assert.equal(merged.conflicts,1);assert.equal(merged.state.customers.length,2);assert.notEqual(merged.state.customers[0].id,merged.state.customers[1].id);assert.deepEqual(local,before);assert.equal(incoming.customers[0].data.address,'Other address');
 assert.equal(C.merge(local,local).state.customers.length,1);
});
test('invoice versions and status survive encrypted backup and conflict merge',async()=>{
 const data={sender:{name:'Company',bid:'',address:'Street\nCity',iban:''},client:{name:'Customer',bid:'',address:'Street\nCity'},meta:{number:'2026-001',date:'2026-09-25',due:'2026-10-09',terms:'14'},notes:'',items:[{desc:'Service',unit:'h',qty:1,price:100,vat:'25.5'}],pricesIncl:false,reverseCharge:false};
 const s=C.empty(),id=C.uid();s.invoices.push({id,name:'2026-001',market:'FI',updated:'2026-09-25T12:00:00Z',data:C.copy(data),status:'paid',history:[{updated:'2026-09-25T11:00:00Z',data:C.copy(data)}]});s.invoices[0].data.items[0].price=150;s.working.FI={draft:C.copy(data),profile:{},lastNo:'2026-001',invoiceId:id};
 const a={format:'laskupaja-archive',version:1,snapshots:[s]},pw='a safe test password';assert.deepEqual(await C.decrypt(await C.encrypt(a,pw),pw),a);
 const incoming=C.copy(s);incoming.invoices[0].data.items[0].price=200;const merged=C.merge(s,incoming);assert.equal(merged.conflicts,1);assert.equal(merged.state.invoices[1].history[0].data.items[0].price,100);assert.equal(merged.state.working.FI.invoiceId,id);
 const bad=C.copy(s);bad.invoices[0].status='anything';assert.throws(()=>C.validate(bad));bad.invoices[0].status='paid';bad.invoices[0].history[0].data.items[0].price='broken';assert.throws(()=>C.validate(bad));
});
