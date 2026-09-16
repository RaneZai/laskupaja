/* Uses the operations Playwright installation via NODE_PATH. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const data=require('../eu-vat-rates/rates.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.VAT_TEST_URL||'file://'+path.resolve(__dirname,'../eu-vat-rates/index.html');
 await page.goto(url);
 assert.equal(await page.locator('tbody tr').count(),27);
 assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://laskupaja.com/eu-vat-rates/');
 assert.equal(await page.locator('meta[name=robots][content*=noindex]').count(),0);
 const fmt=n=>n.toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
 for(const c of data.countries){
  await page.selectOption('#country',c.code);
  assert.equal(await page.inputValue('#rate'),String(c.standard));
  assert.equal(await page.locator('#gross').textContent(),fmt(100+c.standard));
  const options=await page.locator('#rate-choice option').evaluateAll(os=>os.map(o=>o.value));
  assert.deepEqual(options,[c.standard,...c.reduced.filter(n=>n!==c.standard),'custom'].map(String));
  for(const rate of c.reduced){
   await page.selectOption('#rate-choice',String(rate));
   assert.equal(await page.locator('#gross').textContent(),fmt(100+rate));
  }
 }
 await page.selectOption('#country','FI');
 const reduced=data.countries.find(c=>c.code==='FI').reduced.at(-1);
 await page.selectOption('#rate-choice',String(reduced));
 await page.selectOption('#mode','remove');await page.fill('#amount',String(100+reduced).replace('.',','));
 assert.equal(await page.locator('#net').textContent(),'100.00');
 await page.selectOption('#rate-choice','custom');await page.fill('#rate','4.5');
 assert.equal(await page.inputValue('#country'),'FI');
 await page.fill('#amount','-2');assert.equal(await page.locator('#result').isVisible(),false);
 await page.fill('#amount','100');await page.selectOption('#mode','add');
 assert.equal(await page.locator('#gross').textContent(),'104.50');
 await page.fill('#search','DE');assert.equal(await page.locator('tbody tr:visible').count(),3); // Denmark, Germany and Sweden
 await page.fill('#search','Germany');assert.equal(await page.locator('tbody tr:visible').count(),1);
 await page.fill('#search','nothing matches');assert.equal(await page.locator('#empty').isVisible(),true);
 await page.fill('#search','');await page.selectOption('#sort','high');
 assert.equal(await page.locator('tbody tr').first().getAttribute('data-code'),data.countries.slice().sort((a,b)=>b.standard-a.standard||a.name.localeCompare(b.name))[0].code);
 await page.setViewportSize({width:390,height:844});
 await page.locator('#sources summary').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.VAT_SCREENSHOT) await page.screenshot({path:process.env.VAT_SCREENSHOT,fullPage:true});
 assert.deepEqual(errors,[]);
 const nojs=await browser.newContext({javaScriptEnabled:false});const p=await nojs.newPage();await p.goto(url);
 assert.equal(await p.locator('tbody tr').count(),27);
 assert.equal(await p.locator('#amount').isDisabled(),true);
 assert.equal(await p.locator('#result').isVisible(),false);
 console.log('EU VAT browser checks passed: all 27 countries and rates, calculation, filtering, mobile, no JavaScript');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
