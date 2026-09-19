import { defaults, validatePoems, validateBackup, quoteEntries, pairEntries, togglePoem, toggleQuote, applyReview, searchPoems, escapeHTML as e } from './core.js';
import { LearningStorage } from './storage.js';
import { PoetrySpeech } from './speech.js';
import * as view from './views.js';
import * as explorer from './explorer.js';

const app=document.querySelector('#app'),dialog=document.querySelector('#sheet');
const storage=new LearningStorage();
let poems=[],state=defaults(),storageError='',offline='preparing',offlineError='',toastTimer,modal='',pendingBackup=null;
const ui={query:'',category:'',quote:0,favoriteKind:'poems',practice:{id:'',mode:'read',revealed:new Set(),submitted:false,rating:false}};
ui.catalogue={query:'',type:'',theme:'',sort:'default',selected:[]};
ui.pairs={query:'',type:'',theme:'',saved:false};
ui.pair={id:'',mode:'read',revealed:new Set()};
let speechContext='';
const speech=new PoetrySpeech(updateSpeechUI,toast);
const channel=globalThis.BroadcastChannel?new BroadcastChannel('poetry-pocket-updates'):null;

function toast(message) {
  const element=document.querySelector('#toast');element.textContent=message;element.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),5000);
}
function route() {
  const raw=(location.hash.slice(1)||'/today').split('?');
  return {parts:raw[0].split('/').filter(Boolean),params:new URLSearchParams(raw[1]||'')};
}
function applySettings() {document.body.dataset.theme=state.settings.theme;document.body.dataset.size=state.settings.size;}
function render(keepScroll=false) {
  const y=scrollY,{parts,params}=route(),page=parts[0]||'today';let content,tab=page;
  applySettings();
  const poem=poems.find(p=>p.id===parts[1]);
  switch(page) {
    case 'today': content=explorer.quickPicker(poems)+view.todayView(poems,state,offline);break;
    case 'catalogue':if(params.has('type'))ui.catalogue.type=params.get('type');content=explorer.catalogueView(poems,state,ui.catalogue);tab='library';break;
    case 'couplet':{const q=pairEntries(poems).find(q=>q.id===parts[1]);if(q&&ui.pair.id!==q.id)ui.pair={id:q.id,mode:'read',revealed:new Set()};content=q?explorer.pairPracticeView(q,state,ui.pair):view.empty('找不到這組名句','請回名句選重新選擇。','/quotes');tab='quotes';break;}
    case 'library':ui.query=params.get('search')||'';ui.category=params.get('category')||'';content=view.libraryView(poems,ui.query,ui.category);break;
    case 'authors':case 'locations':content=view.categoriesView(poems,page);tab='library';break;
    case 'read':content=poem?view.readerView(poem,state):view.empty('找不到這首詩','請回到詩集重新選擇。');tab='library';break;
    case 'quotes':content=explorer.pairsView(poems,state,ui.pairs);break;
    case 'study':content=view.studyView(poems,state);break;
    case 'practice':
      if(poem&&ui.practice.id!==poem.id)ui.practice={id:poem.id,mode:'read',revealed:new Set(),submitted:false,rating:false};
      content=poem?view.practiceView(poem,state,ui.practice):view.empty('找不到練習作品','請回到詩集重新選擇。');tab='study';break;
    case 'progress':content=view.progressView(poems,state);tab='study';break;
    case 'favorites':content=view.favoritesView(poems,state,ui.favoriteKind);break;
    default:content=view.empty('這頁還不在詩集裡','回到詩詞，從熟悉的一句開始。');tab='library';
  }
  app.innerHTML=view.shell(content,tab,storageError);
  if(keepScroll)window.scrollTo(0,y);
  updateSpeechUI();
}
function updateSpeechUI() {
  if(!poems.length)return;
  const isPoem=speechContext==='poem';
  document.querySelectorAll('.poem-line.active').forEach(el=>el.classList.remove('active'));
  if(isPoem&&speech.active!==null) {
    const el=document.getElementById(`line-${speech.active}`);el?.classList.add('active');
    if(el&&!dialog.open)el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  const label=document.querySelector('#play-label'),button=document.querySelector('#play-button');
  if(label){label.textContent=speech.playing&&isPoem?(speech.paused?'繼續':'暫停'):'朗讀';button.setAttribute('aria-label',label.textContent+'全詩');const symbol=button.querySelector('svg');if(symbol)symbol.outerHTML=view.icon(speech.playing&&!speech.paused&&isPoem?'pause':'play');}
}
async function commit(reducer,{rerender=true,message='',replace=false}={}) {
  try {
    state=await storage.update(current=>reducer(replace?current:validateBackup(current,poems)),defaults());storageError='';applySettings();channel?.postMessage('updated');
    if(rerender)render(true);if(message)toast(message);return true;
  }catch(error){storageError=error.message;toast(error.message);return false;}
}
function showSheet(title,body,type='') {
  speech.stop();modal=type;
  dialog.innerHTML=`<header class="sheet-head row between"><h2 id="sheet-title">${e(title)}</h2>${view.button(view.icon('close'),'close-sheet','aria-label="關閉"','icon-button')}</header><div class="sheet-body">${body}</div>`;
  if(!dialog.open)dialog.showModal();
}
function settings(){showSheet('讓閱讀更舒服',view.settingsBody(state,speech.voice(),offline),'settings');}
function install(){showSheet('在 iPhone 上開始',view.installBody(offline,offlineError,state),'install');}
function onboarding(page=0) {
  showSheet('詩詞隨身背',`<div class="onboarding"><img src="./icons/icon-192.png" alt="" width="90" height="90"><h2>${page===0?'把年輕時背過的詩，<br>一句一句找回來。':'每天五分鐘，<br>重新遇見那些熟悉的文字。'}</h2><p class="muted">欣賞 · 朗讀 · 理解 · 記憶</p>${view.button(page===0?'下一頁':'開始',page===0?'onboarding-next':'onboarding-done','','button primary full')}<p class="small muted section">${page+1} / 2</p></div>`,'onboarding');
}
function characterSheet(button) {
  const poem=poems.find(p=>p.id===button.dataset.poem),line=poem?.lines[Number(button.dataset.line)];
  const d=poem?.difficultCharacters.find(d=>d.character===button.dataset.character&&d.lineContext===line);if(!d)return;
  showSheet('字詞小箋',`<div class="large-character">${e(d.character)}</div><p class="character-sound">${e(d.zhuyin)}</p><p>${e(d.meaning)}</p><div class="rule"></div><h3>本句</h3><p class="poem-text section">${e(d.lineContext)}</p><p class="section">${e(d.explanation)}</p>${view.button(`${view.icon('play')}朗讀這個字`,'speak-character',`data-text="${e(d.character)}"`,'button soft section')}<p class="small muted section">系統的多音字讀法可能不同，以標示注音為準。</p><details class="section"><summary>注音來源</summary><p class="source">${e(d.source)}</p></details>`,'character');
}
function navigateSearch() {const params=new URLSearchParams();if(ui.query)params.set('search',ui.query);if(ui.category)params.set('category',ui.category);return '#/library'+(params.size?'?'+params.toString():'');}
function testVoice(){speechContext='test';speech.play(['明月松間照，','清泉石上流。'],state.settings.speed);if(speech.playing)toast('正在試聽；若沒有聲音，請查看音量與中文語音設定。');}
async function exportBackup() {
  const saved=await storage.read();const data=JSON.stringify(validateBackup(saved||state,poems),null,2);
  const file=new File([data],`詩詞隨身背-${new Date().toISOString().slice(0,10)}.json`,{type:'application/json'});
  if(navigator.canShare?.({files:[file]})) {try {await navigator.share({files:[file],title:'詩詞學習備份'});return;}catch(error){if(error.name==='AbortError')return;}}
  const url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download=file.name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('備份已匯出，可保存到「檔案」。');
}
async function importBackup(file) {
  if(!file)return;if(file.size>10*1024*1024)throw new Error('備份檔太大，請選擇 10 MB 以下的 JSON 備份。');
  const imported=validateBackup(JSON.parse(await file.text()),poems);pendingBackup=imported;
  showSheet('確認匯入備份',`<p>這份備份有 <strong>${Object.values(imported.progress).filter(p=>p.reviewCount).length}</strong> 首學習紀錄、<strong>${imported.events.length}</strong> 次複習。</p><p class="note section">匯入會取代這台裝置目前的學習紀錄與閱讀設定。建議先匯出現有備份。</p><div class="row wrap section">${view.button('先匯出目前資料','export')}${view.button('確認取代並匯入','confirm-import','','button primary')}</div>`,'import');
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-act]');if(!button)return;
  const act=button.dataset.act;
  try{
    switch(act){
      case 'compare-toggle':{const id=button.dataset.id;if(ui.catalogue.selected.includes(id))ui.catalogue.selected=ui.catalogue.selected.filter(x=>x!==id);else if(ui.catalogue.selected.length<4)ui.catalogue.selected.push(id);else {toast('最多選四首比較，請先取消一首。');break;}render(true);break;}
      case 'compare-clear':ui.catalogue.selected=[];render(true);break;
      case 'pair-mode':speech.stop();ui.pair.mode=button.dataset.value;ui.pair.revealed.clear();render(true);break;
      case 'pair-reset':speech.stop();ui.pair.revealed.clear();render(true);break;
      case 'pair-reveal':ui.pair.revealed.add(Number(button.dataset.index));render(true);break;
      case 'pair-speak':{const q=pairEntries(poems).find(q=>q.id===button.dataset.id);if(q){speechContext='pair';speech.play(q.lines,state.settings.speed);}break;}

      case 'theme':if(await commit(s=>({...s,settings:{...s.settings,theme:button.dataset.value}}))){dialog.querySelectorAll('[data-act=theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===state.settings.theme)));}break;
      case 'settings':settings();break;case 'install':install();break;case 'close-sheet':dialog.close();break;
      case 'onboarding-next':onboarding(1);break;
      case 'onboarding-done':if(await commit(s=>({...s,settings:{...s.settings,onboarded:true}}),{rerender:false}))dialog.close();break;
      case 'favorite':speech.stop();await commit(s=>togglePoem(s,button.dataset.poem),{message:'收藏已更新'});break;
      case 'quote-favorite':await commit(s=>toggleQuote(s,button.dataset.id),{message:'名句收藏已更新'});break;
      case 'filter':ui.category=button.dataset.value;location.hash=navigateSearch();if(location.hash===navigateSearch())render(true);break;
      case 'character':characterSheet(button);break;
      case 'speak-character':speechContext='character';speech.play([button.dataset.text],0.7);break;
      case 'play':case 'replay':{
        const poem=poems.find(p=>p.id===button.dataset.poem);if(!poem)break;
        if(act==='play'&&speech.playing&&speechContext==='poem')speech.togglePause();else {speechContext='poem';speech.play(poem.lines,state.settings.speed);}break;
      }
      case 'stop':speech.stop();break;
      case 'quote-prev':ui.quote--;render(true);break;case 'quote-next':ui.quote++;render(true);break;
      case 'favorite-kind':ui.favoriteKind=button.dataset.value;render(true);break;
      case 'practice-mode':ui.practice.mode=button.dataset.value;ui.practice.revealed.clear();render(true);break;
      case 'reveal':ui.practice.revealed.add(Number(button.dataset.index));render(true);break;
      case 'show-rating':ui.practice.rating=true;render(true);document.querySelector('.rating-grid')?.scrollIntoView({block:'center'});break;
      case 'rate':{
        if(ui.practice.submitted||button.disabled)break;
        document.querySelectorAll('[data-act=rate]').forEach(b=>b.disabled=true);
        const success=await commit(s=>applyReview(s,button.dataset.poem,Number(button.dataset.rating)),{rerender:false});
        if(success)ui.practice.submitted=true;render(true);break;
      }
      case 'practice-again':ui.practice.submitted=false;ui.practice.rating=false;ui.practice.revealed.clear();render(true);break;
      case 'export':await exportBackup();break;
      case 'import':document.querySelector('#backup-file')?.click();break;
      case 'confirm-import':{
        if(!pendingBackup)break;
        const backup=pendingBackup;button.disabled=true;
        if(await commit(()=>backup,{message:'備份已匯入',replace:true})){pendingBackup=null;dialog.close();}else button.disabled=false;break;
      }
      case 'test-voice':testVoice();break;
      case 'retry-offline':offline='preparing';offlineError='';install();await prepareOffline();if(modal==='install'&&dialog.open)install();break;
    }
  }catch(error){toast(error.message||'操作未完成，請再試一次。');}
});
document.addEventListener('compositionend',event=>{if(['catalogue-search','pair-search'].includes(event.target.id))event.target.dispatchEvent(new Event('input',{bubbles:true}));});
document.addEventListener('input',event=>{
  if(event.isComposing)return;
  if(['catalogue-search','pair-search'].includes(event.target.id)){
    const id=event.target.id,pos=event.target.selectionStart;
    (id==='catalogue-search'?ui.catalogue:ui.pairs).query=event.target.value;
    render(true);const input=document.getElementById(id);input.focus({preventScroll:true});if(pos!==null)input.setSelectionRange(pos,pos);return;
  }
  if(event.target.id!=='search-input')return;
  ui.query=event.target.value;
  document.querySelector('#search-results').innerHTML=view.libraryResults(poems,ui.query,ui.category);
  document.querySelector('#result-count').textContent=`${searchPoems(poems,ui.query,ui.category).length} 首作品`;
  history.replaceState(null,'',navigateSearch());
});
document.addEventListener('submit',event=>{if(event.target.id==='search-form'){event.preventDefault();document.querySelector('#search-input').blur();}});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target.id==='quick-poem'){if(poems.some(p=>p.id===target.value))location.hash='/read/'+target.value;return;}
  if(target.dataset.catalogue){ui.catalogue[target.dataset.catalogue]=target.value;history.replaceState(null,'','#/catalogue');render(true);return;}
  if(target.dataset.pairs){ui.pairs[target.dataset.pairs]=target.dataset.pairs==='saved'?target.value==='yes':target.value;render(true);return;}

  if(target.id==='backup-file'){try{await importBackup(target.files[0]);}catch(error){toast(error instanceof SyntaxError?'備份不是有效的 JSON 檔案。':error.message);}target.value='';return;}
  if(!target.dataset.setting)return;
  const key=target.dataset.setting;const value=key==='zhuyin'?target.checked:key==='speed'?Number(target.value):target.value;
  const resumePoem=key==='speed'&&speech.playing&&speechContext==='poem'?poems.find(p=>p.id===route().parts[1]):null;
  const resumeLine=speech.active??0;
  speech.stop();
  const success=await commit(s=>({...s,settings:{...s.settings,[key]:value}}));
  if(success&&resumePoem){speechContext='poem';speech.play(resumePoem.lines,state.settings.speed,resumeLine);}
  if(!success){if(key==='zhuyin')target.checked=state.settings.zhuyin;else target.value=state.settings[key];}
});
let swipeStart=null;
document.addEventListener('pointerdown',event=>{if(event.target.closest('#quote-swipe'))swipeStart={x:event.clientX,y:event.clientY};});
document.addEventListener('pointerup',event=>{
  if(!swipeStart)return;const x=event.clientX-swipeStart.x,y=event.clientY-swipeStart.y;swipeStart=null;
  if(document.querySelector('#quote-swipe')&&route().parts[0]==='quotes'&&Math.abs(x)>65&&Math.abs(x)>Math.abs(y)*1.5){ui.quote+=x<0?1:-1;render(true);}
});
document.addEventListener('pointercancel',()=>swipeStart=null);
dialog.addEventListener('close',()=>{speech.stop();modal='';pendingBackup=null;});
window.addEventListener('hashchange',()=>{speech.stop();if(dialog.open)dialog.close();render();window.scrollTo(0,0);document.querySelector('#main')?.focus({preventScroll:true});});
document.addEventListener('visibilitychange',async()=>{
  if(document.hidden)speech.stop();else if(poems.length){try{const latest=await storage.read();if(latest)state=validateBackup(latest,poems);render(true);}catch(error){toast(error.message);}}
});
window.addEventListener('pagehide',()=>speech.stop());
channel?.addEventListener('message',async()=>{try{const latest=await storage.read();if(latest)state=validateBackup(latest,poems);render(true);}catch(error){toast(error.message);}});
window.addEventListener('online',()=>{if(offline!=='ready')prepareOffline();});
setInterval(()=>{if(!document.hidden&&!dialog.open&&['today','study'].includes(route().parts[0]))render(true);},60000);

function workerStatus(worker){return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timeout=setTimeout(()=>reject(new Error('離線準備仍在進行，請稍後再試。')),10000);channel.port1.onmessage=event=>{clearTimeout(timeout);resolve(event.data);};worker.postMessage({type:'CACHE_STATUS'},[channel.port2]);});}
async function prepareOffline(){
  try{
    if(!('serviceWorker' in navigator)||!window.isSecureContext)throw new Error('這個網址不支援離線安裝。請使用提供給你的 HTTPS 網址。');
    await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('離線準備未完成，請保持連線後重試。')),15000))]);
    const status=await workerStatus(registration.active);
    if(!status.ready)throw new Error('尚有內容未快取，請保持連線並重試。');
    offline='ready';offlineError='';
  }catch(error){offline='unavailable';offlineError=error.message;}
  const label=document.querySelector('#offline-label');if(label)label.textContent=offline==='ready'?'已備妥離線閱讀':'離線閱讀尚未就緒';
}
let refreshingWorker=false;
if('serviceWorker' in navigator){const wasControlled=Boolean(navigator.serviceWorker.controller);navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wasControlled&&!refreshingWorker){refreshingWorker=true;location.reload();}});}
async function boot(){
  try{
    const response=await fetch('./data/poems.json');if(!response.ok)throw new Error('詩集暫時無法載入');poems=validatePoems(await response.json());
    try{await storage.open();const saved=await storage.read();if(saved)state=validateBackup(saved,poems);}catch(error){storageError=error.message+' 目前可閱讀，儲存功能需要修復後再用。';}
    render();prepareOffline();
    if(!state.settings.onboarded&&!storageError)onboarding();
  }catch(error){app.innerHTML=`<main class="loading"><h1>詩集暫時無法開啟</h1><p>${e(error.message)}</p><p>首次使用需要連線，離線時請從主畫面已安裝的版本開啟。</p><a class="button primary section" href="./">重新開啟</a></main>`;}
}
boot();
