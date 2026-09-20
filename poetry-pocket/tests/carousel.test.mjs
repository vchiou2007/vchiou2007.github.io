import test from 'node:test';
import assert from 'node:assert/strict';
import {welcomeBanner,mountWelcomeCarousel,wrapSlide} from '../welcome-carousel.js';
test('四張畫廊：手動、滑動、自動、暫停與離頁清理',()=>{
 globalThis.matchMedia=()=>({matches:false});globalThis.document={hidden:false,activeElement:null};
 const html=welcomeBanner();assert.equal((html.match(/data-slide=/g)||[]).length,4);assert.equal(wrapSlide(-1),3);assert.equal(wrapSlide(4),0);
 let tick=null,clears=0;const oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;
 globalThis.setInterval=(fn,ms)=>{assert.equal(ms,7000);tick=fn;return 1;};globalThis.clearInterval=()=>{tick=null;clears++;};
 const handlers={};const make=()=>({classList:{toggle(){}},setAttribute(k,v){this[k]=v;},textContent:''});const imgs=Array.from({length:4},make),dots=Array.from({length:4},make),toggle=make(),caption=make();
 const el={querySelectorAll:s=>s==='[data-slide]'?imgs:dots,querySelector:s=>s.includes('toggle')?toggle:caption,contains:x=>!!x,addEventListener:(k,fn)=>handlers[k]=fn,removeEventListener:k=>delete handlers[k]};
 const click=dataset=>handlers.click({target:{closest:()=>({dataset,blur(){}})}});
 try{mountWelcomeCarousel({querySelector:()=>el});tick();assert.match(caption.textContent,/2 \/ 4/);click({carouselIndex:'3'});assert.match(caption.textContent,/4 \/ 4/);click({carouselAction:'next'});assert.match(caption.textContent,/1 \/ 4/);click({carouselAction:'toggle'});assert.equal(tick,null);assert.equal(toggle.textContent,'播放');click({carouselAction:'toggle'});assert.equal(typeof tick,'function');document.hidden=true;tick();assert.match(caption.textContent,/1 \/ 4/);document.hidden=false;
 handlers.pointerdown({clientX:100,clientY:10,target:{closest:()=>null}});handlers.pointerup({clientX:20,clientY:15});assert.match(caption.textContent,/2 \/ 4/);mountWelcomeCarousel({querySelector:()=>null});assert.equal(tick,null);assert.ok(clears>0);assert.equal(Object.keys(handlers).length,0);
 }finally{globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;}
});
