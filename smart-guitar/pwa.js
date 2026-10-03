'use strict';
if('serviceWorker' in navigator){
 let refreshing=false;
 const hadController=Boolean(navigator.serviceWorker.controller);
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController||refreshing)return;
  if(typeof playback!=='undefined'&&playback.running){
   if(typeof toast==='function')toast('新版已準備好，下次開啟時使用。');
   return;
  }
  refreshing=true;location.reload();
 });
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{
  registration.update().catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)registration.update().catch(()=>{});});
  return navigator.serviceWorker.ready;
 }).then(()=>{
  const status=document.querySelector('#offline');
  if(status)status.textContent='已備妥離線使用 · 歌單與樂譜已儲存在此裝置';
 }).catch(()=>{const status=document.querySelector('#offline');if(status)status.textContent='目前使用線上模式；離線儲存未完成。';});
}else{const status=document.querySelector('#offline');if(status)status.textContent='目前使用線上模式。';}

