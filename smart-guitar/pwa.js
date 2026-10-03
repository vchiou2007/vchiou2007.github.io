'use strict';
if('serviceWorker' in navigator){
 navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{
  const status=document.querySelector('#offline');
  if(status)status.textContent='已備妥離線使用 · 歌單與樂譜已儲存在此裝置';
 }).catch(()=>{const status=document.querySelector('#offline');if(status)status.textContent='目前使用線上模式；離線儲存未完成。';});
}else{const status=document.querySelector('#offline');if(status)status.textContent='目前使用線上模式。';}
