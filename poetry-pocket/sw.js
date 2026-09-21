const VERSION='poetry-pocket-v1-79c0f740f48f';
const FILES=['./','./art/poetic-wind.webp','./art/poetic-rain.webp','./art/poetic-cloud.webp','./art/poetic-snow.webp','./art/poetic-night.webp','./art/poetic-sun.webp','./art/poetic-river.webp','./art/poetic-willow.webp','./welcome-carousel.js','./art/poetic-spring.webp','./art/poetic-lotus.webp','./art/poetic-autumn.webp','./art/poetic-moonlight.webp','./index.html','./styles.css','./app.js','./core.js','./familiarity.js','./familiarity-ui.js','./explorer.js','./views.js','./storage.js','./speech.js','./feihua-core.js','./feihua-views.js','./recitation.js','./vendor/pinyin-pro.mjs','./vendor/character-variants.js','./data/feihua-keywords.json','./manifest.webmanifest','./data/poems.json','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable.png','./icons/apple-touch-icon.png'];
const scoped=path=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const responses=await Promise.all(FILES.map(async path=>{
      const response=await fetch(new Request(scoped(path),{cache:'reload',credentials:'same-origin'}));
      if(!response.ok||new URL(response.url).origin!==self.location.origin)throw new Error('離線資源尚不可用');
      const type=response.headers.get('content-type')||'';
      if(path.endsWith('.js')&&!/javascript/.test(type))throw new Error('語法資源未能存取');
      if(path.endsWith('.json')&&!/json/.test(type))throw new Error('詩詞資料未能存取');
      if(path==='./'||path.endsWith('.html')){const text=await response.clone().text();if(!text.includes('data-poetry-app'))throw new Error('請先開啟詩詞頁面完成存取');}
      return [scoped(path),response];
    }));
    const cache=await caches.open(VERSION);
    for(const [url,response] of responses)await cache.put(url,response);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('poetry-pocket-v')&&key!==VERSION)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  const known=new Set(FILES.map(scoped));
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(VERSION);
      // The cached shell is available immediately; a new worker updates it atomically.
      return await cache.match(scoped('./index.html'))||fetch(request);
    })());return;
  }
  if(known.has(url.href))event.respondWith((async()=>{const cache=await caches.open(VERSION);return await cache.match(request)||fetch(request);})());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);const found=await Promise.all(FILES.map(path=>cache.match(scoped(path))));
    event.ports[0]?.postMessage({ready:found.every(Boolean),version:VERSION});
  })());
});
