'use strict';
const CACHE='smart-guitar-app-v4';
const FILES=['water.html','water-app.js','water-scroll.js','water-song.json','references/water-1.png','references/water-2.png','./','index.html','score.html','library.css','library.js','style.css','core.js','app.js','scroll.js','ipad.js','pwa.js','manifest.webmanifest','icon-192.png','icon-512.png','references/score-1.png','references/score-2.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(new URL(f,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('smart-guitar-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;
 const url=new URL(e.request.url);
 if(!FILES.some(f=>new URL(f,self.registration.scope).pathname===url.pathname))return;
 e.respondWith(caches.open(CACHE).then(async cache=>{
  // A fresh launch must not remain pinned to an old cached interface.
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch(e.request,{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('Network response unavailable');
   const key=new URL(url.pathname,url.origin).href;
   await cache.put(key,response.clone());
   return response;
  }catch(error){
   const saved=await cache.match(e.request,{ignoreSearch:true});
   if(saved)return saved;
   return new Response('目前無法連線，請連網後重新開啟。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }finally{clearTimeout(timer);}
 }));
});

