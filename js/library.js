/* Private library UI and external encrypted backups. All DOM data uses textContent. */
(function(){
 'use strict';
 const C=window.LPLibraryCore,T=k=>window.LPLibraryText(k),$=s=>document.querySelector(s);
 const market=window.LP_VAT_CONTEXT?.country || (location.pathname.startsWith('/de/')?'DE':location.pathname.startsWith('/es/')?'ES':'FI');
 const store=new C.Store();let adapter,root,notice,list,status,backupStatus,promptBox,ready=false,blocked=false,blockReason='conflict',enabled=true,serial=Promise.resolve(),generation=0;
 let backup=null,password=null,archive=null,timer=null,busyBackup=false,backupError=false,filter='',kind='customers';
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('laskupaja-library'):null;
 const node=(tag,text,attrs={})=>{const el=document.createElement(tag);if(text!==null)el.textContent=text;for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;};
 const button=(key,fn)=>{const b=node('button',T(key),{type:'button',class:'btn btn-secondary btn-sm'});b.addEventListener('click',()=>Promise.resolve().then(fn).catch(showError));return b;};
 const stamp=s=>new Date(s).toLocaleString(document.documentElement.lang||undefined);
 function showError(e){ if(e?.name==='AbortError')return; const key=['off','conflict','invalid','password','fileConflict','mismatch','migration','tooLarge'].includes(e?.message)?e.message:'error';notice.textContent=T(key==='password'?'password':key==='tooLarge'?'invalid':key); if(key==='conflict')blocked=true;if(blocked)blockReason=key; }
 function enqueue(fn){const epoch=generation;const p=serial.then(()=>{if(epoch!==generation)throw Error('conflict');return fn();});serial=p.catch(()=>{});return p;}
 function changed(){ if(!backupError)notice.textContent='';renderList();renderStatus();channel?.postMessage({id:store.state.id,revision:store.state.revision,enabled});clearTimeout(timer);if(password&&backup)timer=setTimeout(()=>writeBackup().catch(backupFailure),1800); }
 function ensure(){if(!ready||blocked)throw Error(blocked?'conflict':'error');if(!enabled)throw Error('off');}
 function count(s=store.state){return C.GROUPS.reduce((n,k)=>n+s[k].length,0);}
 function renderStatus(){
  if(!status)return;if(blocked)notice.textContent=T(blockReason);status.textContent=!enabled?T('off'):T(backup?.lastSuccess?'workingLocal':'local');
  const pieces=[];
  if(backup?.lastSuccess)pieces.push(T('backupSaved')+': '+stamp(backup.lastSuccess));
  if(backup && store.state && (backup.libraryId!==store.state.id || backup.revision!==store.state.revision))pieces.push(T('pending'));
  if(backupError || (backup&&!password))pieces.push(T('attention'));
  backupStatus.textContent=pieces.join(' · ');
  root.querySelectorAll('[data-connection]').forEach(b=>b.hidden=!backup);
  document.querySelectorAll('#private-library [data-save], #invoice-form [data-save], #save-invoice-btn').forEach(b=>b.disabled=!ready||!enabled||blocked);
 }
 function renderList(){
  if(!list||!store.state)return;list.replaceChildren();
  const records=store.state[kind].filter(r=>(r.name+' '+(r.data.desc||'')+' '+r.updated+' '+(r.data.client?.name||'')+' '+(r.data.meta?.date||'')).toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  if(!count())list.append(node('p',T('empty')));
  for(const r of records){
   const row=node('article',null,{class:'library-record'});const info=node('div');info.append(node('strong',r.name||'—'),node('small',r.market+' · '+stamp(r.updated)+(r.data.client?' · '+r.data.client.name:'')));row.append(info);
   const actions=node('div',null,{class:'library-actions'});
   const applicable=r.market===market || kind==='customers';
   if(kind==='invoices'){
    for(const duplicate of [false,true]){const b=button(duplicate?'duplicate':'open',()=>{ensure();if(!confirm(T('confirmOpen')))return;adapter.applyInvoice(C.copy(r.data),duplicate);});b.disabled=!applicable;actions.append(b);}
   }else{
    const b=button('use',()=>{ensure();adapter.use(kind,C.copy(r.data));});b.disabled=!applicable;actions.append(b,button('edit',()=>editRecord(kind,r)));
   }
   actions.append(button('remove',()=>{ensure();if(confirm(T('confirmDelete')))return enqueue(async()=>{await store.edit(s=>{s[kind]=s[kind].filter(x=>x.id!==r.id);return s;});changed();});}));
   row.append(actions);list.append(row);
  }
 }
 function dialog(title){const d=node('dialog',null,{class:'library-dialog','aria-label':title});d.append(node('h2',title));document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();return d;}
 function field(parent,label,value='',type='text'){
  const wrap=node('label',T(label)),input=node('input',null,{type});if(type==='checkbox')input.checked=!!value;else input.value=value;
  if(type==='password'){input.autocomplete='off';input.minLength=12;input.maxLength=1000;}else input.maxLength=label==='address'?2000:200;
  wrap.append(input);parent.append(wrap);return input;
 }
 function editRecord(type,record,initial){
  ensure();const d=dialog(T(type)),form=node('form'),data=record?.data||initial||{};const fields={};
  const names=type==='customers'?['name','bid','address','email','terms']:type==='profiles'?['name','bid','address','iban','defaultTerms','defaultVat']:['name','desc','unit','price','vat','pricesIncl'];
  for(const k of names){const label=type==='products'&&k==='name'?'productName':({defaultTerms:'terms',defaultVat:'vat',pricesIncl:'incl'}[k]||k);fields[k]=field(form,label,(type==='products'&&k==='name'?(data.name??record?.name):data[k])??(k==='terms'||k==='defaultTerms'?'14':k==='vat'||k==='defaultVat'?adapter.defaultVat():k==='unit'?'':k==='price'?'0':''),k==='pricesIncl'?'checkbox':'text');}
  fields.name.required=true;
  const error=node('p','',{role:'alert'});form.append(error);const submit=node('button',T('save'),{type:'submit',class:'btn btn-primary'});form.append(submit,button('cancel',()=>{if(!submit.disabled)d.close();}));d.addEventListener('cancel',e=>{if(submit.disabled)e.preventDefault();});
  form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{
   const value={};for(const k of names)value[k]=fields[k].type==='checkbox'?fields[k].checked:fields[k].value.trim();
   if(type==='customers'||type==='profiles'){const term=value.terms??value.defaultTerms;if(!/^\d{1,3}$/.test(term))throw Error('invalid');}
   if(type==='products' && (Number(value.price.replace(',','.'))<0 || !adapter.rates().includes(value.vat)))throw Error('invalid');
   if(type==='profiles'&&!adapter.rates().includes(value.defaultVat))throw Error('invalid');
   const first=count()===0;await enqueue(async()=>{ensure();await store.edit(s=>{const item={id:record?.id||C.uid(),name:value.name||value.desc,market:record?.market||market,updated:new Date().toISOString(),data:value};s[type]=s[type].filter(r=>r.id!==item.id);s[type].push(item);return s;});changed();});d.close();if(first)firstPrompt();
  }catch(err){error.textContent=T(err.message==='conflict'?'conflict':'invalid');}finally{submit.disabled=false;}});
  d.append(form);
 }
 function firstPrompt(){promptBox.hidden=false; navigator.storage?.persist?.().catch(()=>{});}
 async function saveInvoice(){ensure();const data=adapter.collect();C.draft(data);if(!data.meta.number.trim()||!data.client.name.trim())throw Error('invalid');const first=count()===0;
  await enqueue(async()=>{await store.edit(s=>{s.invoices.push({id:C.uid(),name:data.meta.number,market,updated:new Date().toISOString(),data});return s;});changed();});notice.textContent=T('saved');if(first)firstPrompt();
 }
 function passwordDialog(mode){
  ensure();const restoring=mode==='restore';const d=dialog(T(restoring?'restore':mode==='download'?'download':'setup'));d.append(node('p',T('passwordHelp')));
  const form=node('form'),pw=field(form,'password','','password');pw.required=true;let repeat;if(!restoring){repeat=field(form,'repeat','','password');repeat.required=true;}
  let file;if(restoring){file=node('input',null,{type:'file',accept:'.laskupaja,.json,application/json','aria-label':T('restore')});file.required=true;form.append(file);}
  const err=node('p','',{role:'alert'});form.append(err);
  const submit=node('button',T(restoring?'preview':mode==='download'?'download':'setup'),{type:'submit',class:'btn btn-primary'});form.append(submit,button('cancel',()=>{if(!submit.disabled)d.close();}));d.addEventListener('cancel',e=>{if(submit.disabled)e.preventDefault();});d.append(form);
  form.addEventListener('submit',async e=>{e.preventDefault();if(repeat&&repeat.value!==pw.value){err.textContent=T('repeat');return;}submit.disabled=true;
   // Invoke file picker directly in the user gesture, before crypto/storage awaits.
   let handlePromise;
   if(mode==='setup'&&window.showSaveFilePicker)handlePromise=window.showSaveFilePicker({suggestedName:'Laskupaja.laskupaja',types:[{description:'Laskupaja backup',accept:{'application/json':['.laskupaja']}}]});
   try{
    if(restoring){const f=file.files[0];if(f.size>C.MAX_BYTES)throw Error('invalid');const a=await C.decrypt(await f.text(),pw.value);d.close();preview(a);}
    else if(mode==='download'){await download(pw.value);d.close();}
    else if(handlePromise){const handle=await handlePromise;await connect(handle,pw.value);d.close();}
    else {await download(pw.value);d.close();}
   }catch(e){if(e.name==='AbortError'){d.close();return;}err.textContent=T(e.message==='fileConflict'?'fileConflict':restoring?'badPassword':'attention');}finally{submit.disabled=false;}
  });
 }
 const hash=async raw=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 async function readFile(handle){const f=await handle.getFile();if(f.size>C.MAX_BYTES)throw Error('invalid');return f.text();}
 async function connect(handle,pw){
  if(busyBackup)throw Error('busy');
  await serial;ensure();if(!count()&&!Object.keys(store.state.working).length)throw Error('invalid');
  const raw=await readFile(handle);let previous=null;
  if(raw){previous=await C.decrypt(raw,pw);const latest=previous.snapshots.at(-1);const known=backup?.hash===await hash(raw)&&backup?.libraryId===store.state.id;
   if(!known&&JSON.stringify(latest)!==JSON.stringify(store.state))throw Error('fileConflict');
  }
  backup={handle,hash:await hash(raw),libraryId:store.state.id,revision:previous?.snapshots.at(-1).revision??-1,lastSuccess:null};password=pw;archive=previous;
  try{await writeBackup();await persistBackup(backup);renderStatus();}catch(e){password=null;backupError=true;renderStatus();throw e;}
 }
 async function persistBackup(value){
  // Native file handles are session-only. Persist portable status, never permissions.
  const {handle,...metadata}=value;await store.setting('backup',metadata);
 }
 async function download(pw){await serial;ensure();const state=await store.read();const a={format:'laskupaja-archive',version:1,snapshots:[state]};const raw=await C.encrypt(a,pw);const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const link=node('a',null,{href:url,download:'Laskupaja-'+new Date().toISOString().replace(/[:.]/g,'-')+'.laskupaja'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent=T('downloaded');}
 function backupFailure(e){backupError=true;renderStatus();notice.textContent=T(e?.message==='fileConflict'?'fileConflict':'attention');}
 async function writeBackup(){
  if(busyBackup)return;busyBackup=true;let completed=false;
  try {
   await serial;ensure();if(!password||!backup)throw Error('fileConflict');const session=backup,pw=password,epoch=generation;
   const execute=async()=>{
    if(await session.handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('permission');
    const disk=await readFile(session.handle);if(await hash(disk)!==session.hash)throw Error('fileConflict');
    const current=await store.read();if(current.id!==session.libraryId)throw Error('fileConflict');
    const snapshots=(archive?.snapshots||[]).filter(s=>s.id===current.id&&s.revision!==current.revision).slice(-4);snapshots.push(current);
    const next={format:'laskupaja-archive',version:1,snapshots};const raw=await C.encrypt(next,pw);
    if(epoch!==generation||!enabled||backup!==session)throw Error('conflict');
    const writable=await session.handle.createWritable({mode:'exclusive'});
    try{
     if(await hash(await readFile(session.handle))!==session.hash)throw Error('fileConflict');
     if(epoch!==generation||!enabled||backup!==session)throw Error('conflict');
     await writable.write(raw);
     if(epoch!==generation||!enabled||backup!==session)throw Error('conflict');
     await writable.close();
    }catch(e){await writable.abort().catch(()=>{});throw e;}
    if(epoch!==generation||backup!==session)return;
    // Verify the committed bytes before reporting success or forgetting the old hash.
    if(await readFile(session.handle)!==raw)throw Error('fileConflict');
    session.hash=await hash(raw);session.revision=current.revision;session.lastSuccess=new Date().toISOString();archive=next;backupError=false;notice.textContent='';
    await persistBackup(session);renderStatus();
   };
   if(navigator.locks)await navigator.locks.request('laskupaja-device-backup',{ifAvailable:true},lock=>{if(!lock)throw Error('conflict');return execute();});else await execute();
   completed=true;
  }finally{busyBackup=false;
   if(completed&&enabled&&password&&backup&&backup.libraryId===store.state.id&&backup.revision!==store.state.revision){clearTimeout(timer);timer=setTimeout(()=>writeBackup().catch(backupFailure),300);}
  }
 }
 async function reconnect(){
  ensure();if(!backup)return passwordDialog('setup');
  let handle=backup.handle;
  if(!handle){
   if(window.showOpenFilePicker){[handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Laskupaja backup',accept:{'application/json':['.laskupaja']}}]});}
   else if(window.showSaveFilePicker){handle=await window.showSaveFilePicker({suggestedName:'Laskupaja.laskupaja'});}
   else return passwordDialog('restore');
  }
  const d=dialog(T('reconnect')),f=node('form'),pw=field(f,'password','','password');pw.required=true;const err=node('p','',{role:'alert'}),b=node('button',T('reconnect'),{type:'submit'});f.append(err,b,button('cancel',()=>d.close()));d.append(f);
  f.addEventListener('submit',async e=>{e.preventDefault();b.disabled=true;try{
   const permission=await handle.requestPermission({mode:'readwrite'});if(permission!=='granted'){backupFailure();throw Error('permission');}
   await connect(handle,pw.value);d.close();
  }catch(e){err.textContent=T(e.message==='fileConflict'?'fileConflict':e.message==='permission'?'attention':'badPassword');}finally{b.disabled=false;}});
 }
 function preview(a){
  const d=dialog(T('preview')),label=node('label',T('version')),select=node('select');a.snapshots.forEach((s,i)=>{select.append(node('option',stamp(s.updated)+' · '+s.revision,{value:String(i)}));});select.value=String(a.snapshots.length-1);label.append(select);d.append(label,node('p',T('restoreHelp')));
  const summary=node('p');d.append(summary);const update=()=>{const s=a.snapshots[Number(select.value)];summary.textContent=C.GROUPS.map(k=>T(k)+': '+s[k].length).join(' · ')+' · '+T('conflicts')+': '+C.merge(store.state,s).conflicts;};select.onchange=update;update();const err=node('p','',{role:'alert'});d.append(err);
  const apply=async mode=>{if(busyBackup){err.textContent=T('pending');return;}if(mode==='replace'&&!confirm(T('confirmReplace')))return;try{
   const incoming=C.copy(a.snapshots[Number(select.value)]);C.validate(incoming);clearTimeout(timer);password=null;backup=null;archive=null;
   await enqueue(async()=>{ensure();await store.edit(s=>{const next=mode==='merge'?C.merge(s,incoming).state:incoming;next.id=s.id;return next;});await store.setting('backup',null);});
   generation++;changed();d.close();adapter.reloadWorking(store.state.working[market]);notice.textContent=T('restored');
  }catch(e){err.textContent=T(e.message==='conflict'?'conflict':'invalid');}};
  d.append(button('replace',()=>apply('replace')),button('merge',()=>apply('merge')),button('cancel',()=>d.close()));
 }
 function mount(){
  const previous=$('#private-library'),wasOpen=previous?.open||false;
  root=node('details',null,{class:'card private-library',id:'private-library','aria-label':T('title')});root.open=wasOpen;root.append(node('summary',T('title')));
  const storage=node('div',null,{id:'library-storage-status'});status=node('p');backupStatus=node('p','',{role:'status',id:'library-backup-status'});notice=node('p','',{role:'alert',id:'library-notice'});storage.append(status,backupStatus,notice);
  $('#library-storage-status')?.remove();$('#storage-box').append(storage);
  const originalInfo=$('#storage-box [data-i18n="inv.storageInfo"]');if(originalInfo)originalInfo.hidden=true;
  const backups=node('div',null,{class:'library-actions'});const setup=button('setup',()=>passwordDialog('setup'));setup.dataset.save='';const down=button('download',()=>passwordDialog('download'));down.dataset.save='';const restore=button('restore',()=>passwordDialog('restore'));restore.dataset.save='';const reconnectButton=button('reconnect',reconnect),stopButton=button('disconnect',async()=>{clearTimeout(timer);password=null;backup=null;archive=null;backupError=false;await store.setting('backup',null);renderStatus();});reconnectButton.dataset.connection='';stopButton.dataset.connection='';backups.append(setup,down,restore,reconnectButton,stopButton);root.append(backups,node('p',T('backupHelp'),{class:'hint'}));if(!window.showSaveFilePicker)root.append(node('p',T('manual'),{class:'hint'}));
  promptBox=node('aside',null,{class:'library-prompt'});promptBox.hidden=true;promptBox.append(node('p',T('first')),button('setup',()=>passwordDialog('setup')),button('later',()=>promptBox.hidden=true));storage.append(promptBox);
  const tools=node('div',null,{class:'library-actions'});for(const [key,fn] of [['saveCustomer',()=>editRecord('customers',null,{...adapter.collect().client,terms:adapter.collect().meta.terms,email:adapter.collect().client.email||''})],['newProduct',()=>editRecord('products')],['saveProfile',()=>editRecord('profiles',null,adapter.profile())]]){const b=button(key,fn);b.dataset.save='';tools.append(b);
   const field=key==='saveProfile'?'senderName':key==='saveCustomer'?'clientName':null;
   if(field){
    const id=key==='saveProfile'?'save-profile-inline':'save-customer-inline';
    $('#'+id)?.remove();
    const inline=button(key,fn);inline.id=id;inline.dataset.save='';
    $('#'+field).closest('section').append(inline);
   }
  }root.append(tools);
  const controls=node('div',null,{class:'library-filters'}),typeLabel=node('label',T('title')),type=node('select');C.GROUPS.forEach(k=>type.append(node('option',T(k),{value:k})));type.value=kind;type.onchange=()=>{kind=type.value;renderList();};typeLabel.append(type);const searchLabel=node('label',T('search')),search=node('input',null,{type:'search'});search.value=filter;search.oninput=()=>{filter=search.value;renderList();};searchLabel.append(search);controls.append(typeLabel,searchLabel);root.append(controls,node('p',T('market'),{class:'hint'}));list=node('div',null,{class:'library-list'});root.append(list);
  $('#save-invoice-btn')?.remove();$('#library-save-status')?.remove();
  const saveFeedback=node('span','',{id:'library-save-status',role:'status'});
  const saveButton=button('saveInvoice',async()=>{saveFeedback.textContent='';try{await saveInvoice();saveFeedback.textContent=T('saved');}catch(e){saveFeedback.textContent=T(e.message==='invalid'?'invalid':'error');throw e;}});saveButton.id='save-invoice-btn';
  $('#invoice-form .actions-row').insertBefore(saveButton,$('#autosave-note'));$('#invoice-form .actions-row').append(saveFeedback);
  const old=$('#private-library');if(old)old.replaceWith(root);else $('#invoice-form').before(root);renderStatus();renderList();
 }
 async function init(api){
  adapter=api;enabled=api.remember();mount();
  try{
   await store.open();ready=true;
   if(!enabled){await store.clear();api.removeLegacy();}
   else {
    const legacy=api.legacy();
    if(legacy && !Object.keys(store.state.working).length && count()===0){
     try {C.draft(legacy.draft);await store.edit(s=>{s.working[market]=legacy;return s;});api.removeLegacy();}catch(e){blocked=true;throw Error('migration');}
    }else if(legacy){ // Preserve leftovers until their contents can be explicitly reviewed.
     blocked=true;throw Error('migration');
    }
    backup=await store.setting('backup')||null;
   }
  }catch(e){blocked=true;showError(e);}
  renderStatus();renderList();return store.state?.working[market]||null;
 }
 async function saveWorking(working){ensure();return enqueue(async()=>{ensure();await store.edit(s=>{s.working[market]=working;return s;});changed();});}
 async function clear(on){
  clearTimeout(timer);generation++;enabled=false;password=null;backup=null;archive=null;backupError=false;await serial;
  await store.clear();promptBox.hidden=true;$('#library-save-status').textContent='';adapter.removeLegacy();blocked=false;ready=true;notice.textContent='';enabled=on;channel?.postMessage({cleared:true,enabled:on});renderList();renderStatus();
 }
 if(channel)channel.onmessage=()=>{if(ready){blocked=true;blockReason='conflict';generation++;clearTimeout(timer);password=null;notice.textContent=T('conflict');renderStatus();}};
 document.addEventListener('lp:langchange',()=>{if(adapter)mount();});
 window.LPLibrary={init,saveWorking,clear,enable(on){enabled=on;renderStatus();},get ready(){return ready&&!blocked;},get working(){return store.state?.working[market];},market,nextNumber(base){let n=window.LP.numbering.nextInvoiceNumber(base);const used=new Set((store.state?.invoices||[]).filter(r=>r.market===market).map(r=>r.data.meta.number));if(base)n===String(base)&&(n=String(base)+'-001');while(used.has(n))n=window.LP.numbering.nextInvoiceNumber(n);return n;},showError,T,flush:()=>serial};
})();
