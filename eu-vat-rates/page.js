'use strict';
const $=id=>document.getElementById(id);
const rows=[...document.querySelectorAll('tbody tr')];
const rates=Object.fromEntries(rows.map(r=>[r.dataset.code,{standard:Number(r.dataset.rate),reduced:r.cells[2].textContent.replace('%','').split('/').map(Number)}]));
const fmt=n=>n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
function number(value){const v=value.trim().replace(',','.');return /^\d+(\.\d+)?$/.test(v)?Number(v):NaN;}
function calculate(){
 const amount=number($('amount').value),rate=number($('rate').value);
 const valid=Number.isFinite(amount)&&amount<=1e12&&Number.isFinite(rate)&&rate<=100;
 $('error').textContent=valid?'':'Enter a non-negative amount up to 1 trillion and a VAT rate from 0 to 100.';
 $('result').hidden=!valid;$('formula').hidden=!valid;if(!valid)return;
 const remove=$('mode').value==='remove',net=remove?amount/(1+rate/100):amount,tax=remove?amount-net:net*rate/100,gross=remove?amount:net+tax;
 $('net').textContent=fmt(net);$('tax').textContent=fmt(tax);$('gross').textContent=fmt(gross);$('rate-label').textContent=rate+'%';
 $('formula').textContent=remove?`${fmt(amount)} ÷ ${1+rate/100} = ${fmt(net)} before VAT`:`${fmt(net)} × ${rate}% = ${fmt(tax)} VAT`;
 rows.forEach(r=>r.classList.toggle('selected',r.dataset.code===$('country').value));
}
function choose(code){
 $('country').value=code;
 const data=rates[code], select=$('rate-choice');
 select.replaceChildren(new Option(`Standard · ${data.standard}%`,String(data.standard)));
 [...new Set(data.reduced)].filter(rate=>rate!==data.standard).forEach(rate=>select.add(new Option(`${rate===0?'Zero rate':'Reduced'} · ${rate}%`,String(rate))));
 select.add(new Option('Custom rate…','custom'));
 $('rate').value=data.standard;$('custom-rate').hidden=true;calculate();
}
$('rate-choice').addEventListener('change',()=>{
 const custom=$('rate-choice').value==='custom';$('custom-rate').hidden=!custom;
 if(custom){$('rate').focus();}else{$('rate').value=$('rate-choice').value;}
 calculate();
});
$('controls').disabled=false;
$('country').addEventListener('change',()=>choose($('country').value));
$('rate').addEventListener('input',calculate);
['amount','mode'].forEach(id=>$(id).addEventListener('input',calculate));
rows.forEach(r=>r.querySelector('button').addEventListener('click',()=>{choose(r.dataset.code);$('calculator').scrollIntoView({block:'start'});$('amount').focus({preventScroll:true});}));
function filter(){const q=$('search').value.trim().toLocaleLowerCase();let n=0;rows.forEach(r=>{r.hidden=!(r.dataset.country+' '+r.dataset.code).toLowerCase().includes(q);if(!r.hidden)n++;});$('count').textContent=n+' '+(n===1?'country':'countries');$('empty').hidden=n!==0;}
$('search').addEventListener('input',filter);
$('sort').addEventListener('change',()=>{const mode=$('sort').value;rows.slice().sort((a,b)=>mode==='name'?a.dataset.country.localeCompare(b.dataset.country):(Number(a.dataset.rate)-Number(b.dataset.rate))*(mode==='high'?-1:1)||a.dataset.country.localeCompare(b.dataset.country)).forEach(r=>document.querySelector('tbody').append(r));});
choose($('country').value);
