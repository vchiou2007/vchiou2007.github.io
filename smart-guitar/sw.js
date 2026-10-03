'use strict';
const CACHE='smart-guitar-app-v1';
const FILES=['./','index.html','score.html','library.css','library.js','style.css','core.js','app.js','scroll.js','ipad.js','pwa.js','manifest.webmanifest','icon-192.png','icon-512.png','references/score-1.png','references/score-2.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('smart-guitar-app-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope))return;
 const url=new URL(e.request.url);
 if(!FILES.some(f=>new URL(f,self.registration.scope).pathname===url.pathname))return;
 e.respondWith(caches.open(CACHE).then(async cache=>{
  const saved=await cache.match(e.request,{ignoreSearch:true});
  return saved||fetch(e.request);
 }));
});
