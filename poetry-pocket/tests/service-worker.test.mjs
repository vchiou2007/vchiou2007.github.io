import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const dist=new URL('../',import.meta.url);
async function environment(broken=false){
  const handlers={},stores=new Map(),scope='https://example.test/poetry/';let network=true;
  const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {put:async(key,value)=>store.set(typeof key==='string'?key:key.url,value.clone()),match:async key=>store.get(typeof key==='string'?key:key.url)?.clone()};}};
  const self={registration:{scope},location:{origin:'https://example.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const fetch=async request=>{
    if(!network)throw new Error('offline');const url=typeof request==='string'?request:request.url;
    const relative=url.replace(scope,'')||'index.html',extension=relative.split('.').pop();
    const content=broken&&relative==='app.js'?'<html>Sign in</html>':await readFile(new URL(relative,dist));
    const response=new Response(content,{headers:{'content-type':broken&&relative==='app.js'?'text/html':extension==='js'?'text/javascript':extension==='json'?'application/json':extension==='html'?'text/html':'application/octet-stream'}});
    Object.defineProperty(response,'url',{value:url});return response;
  };
  vm.runInNewContext(await readFile(new URL('sw.js',dist),'utf8'),{self,caches,fetch,URL,Request,Response,Set,Promise});
  return {handlers,caches,stores,scope,goOffline:()=>network=false};
}
const lifecycle=(env,name)=>new Promise((resolve,reject)=>env.handlers[name]({waitUntil:p=>p.then(resolve,reject)}));
test('完整預存後能在無網路時取得首頁、詩集、所有程式',async()=>{
  const env=await environment();await lifecycle(env,'install');await lifecycle(env,'activate');env.goOffline();
  for(const [path,mode] of [['','navigate'],['data/poems.json','cors'],['app.js','cors']]){
    let response;env.handlers.fetch({request:{url:env.scope+path,method:'GET',mode},respondWith:p=>response=p});
    const result=await response;assert.equal(result.status,200);assert.ok((await result.text()).length>100);
  }
  let status;let task;env.handlers.message({data:{type:'CACHE_STATUS'},ports:[{postMessage:data=>status=data}],waitUntil:p=>task=p});await task;assert.equal(status.ready,true);
});
test('登入頁不能被當成語法資源快取',async()=>{const env=await environment(true);await assert.rejects(lifecycle(env,'install'));assert.equal(env.stores.size,0);});
test('清理只處理自己舊版快取',async()=>{const env=await environment();await env.caches.open('other-app');await env.caches.open('poetry-pocket-v-old');await lifecycle(env,'install');await lifecycle(env,'activate');assert.ok(env.stores.has('other-app'));assert.ok(!env.stores.has('poetry-pocket-v-old'));});
