import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('實際 App 啟動、飛花令路由、遮蔽和搜尋不影響舊路由',async()=>{
 const handlers={},windows={},app={innerHTML:'',querySelectorAll:()=>[]},dialog={open:false,addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}};
 const toast={textContent:'',classList:{add(){},remove(){}}};
 globalThis.document={hidden:false,body:{dataset:{}},querySelector:s=>s==='#app'?app:s==='#sheet'?dialog:s==='#toast'?toast:null,querySelectorAll:()=>[],addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn)};
 globalThis.window={addEventListener:(name,fn)=>windows[name]=fn,scrollTo(){},isSecureContext:false};
 globalThis.location={hash:'#/today'};globalThis.scrollY=0;globalThis.matchMedia=()=>({matches:false});globalThis.BroadcastChannel=undefined;
 const oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval;
 globalThis.fetch=async path=>new Response(await readFile(new URL('../'+path.replace('./',''),import.meta.url)));
 globalThis.setInterval=()=>0;
 try{
  await import('../app.js');await new Promise(resolve=>setTimeout(resolve,40));assert.ok(app.innerHTML.includes('今日飛花令複習'));
  for(const path of ['/feihua','/feihua/%E6%9C%88','/feihua/%E7%A7%8B','/catalogue','/quotes','/read/li-jing']){location.hash='#'+path;windows.hashchange();assert.ok(app.innerHTML.includes('<main'));assert.ok(!app.innerHTML.includes('undefined'));}
  location.hash='#/feihua/月';windows.hashchange();assert.ok(app.innerHTML.includes('飛花令・月'));
  const click=async dataset=>{for(const fn of handlers.click||[])await fn({target:{closest:s=>s==='button[data-act]'?{dataset}:null}});};
  await click({act:'fh-start'});await click({act:'fh-stage',stage:'5'});assert.ok(app.innerHTML.includes('正文已隱藏'));assert.ok(!app.innerHTML.includes('舉頭望'));
  await click({act:'fh-reveal'});assert.ok(app.innerHTML.includes('fh-gloss'));
 }finally{globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;}
});
