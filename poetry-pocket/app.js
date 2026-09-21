import {mountWelcomeCarousel} from './welcome-carousel.js';
import {createRegistry,setFamiliarity,LEVELS,SORTS,familiarityOf} from './familiarity.js';
import * as fam from './familiarity-ui.js';
import {lineEntries,validateKeywords,validKeyword,selectLines,learnLine} from './feihua-core.js';
import * as fhView from './feihua-views.js';
import {RecitationRecognition,compareRecitation,readingFor} from './recitation.js';
import { defaults, validatePoems, validateBackup, quoteEntries, pairEntries, togglePoem, toggleQuote, applyReview, searchPoems, escapeHTML as e } from './core.js';
import { LearningStorage } from './storage.js';
import { PoetrySpeech, syncReadingLines } from './speech.js';
import * as view from './views.js';
import * as explorer from './explorer.js';

const app=document.querySelector('#app'),dialog=document.querySelector('#sheet');
const storage=new LearningStorage();
let poems=[],state=defaults(),storageError='',offline='preparing',offlineError='',toastTimer,modal='',pendingBackup=null;
const ui={query:'',category:'',quote:0,favoriteKind:'poems',practice:{id:'',mode:'read',revealed:new Set(),submitted:false,rating:false}};
ui.catalogue={query:'',type:'',theme:'',sort:'default',selected:[]};
ui.pairs={query:'',type:'',theme:'',saved:false};
ui.pair={id:'',mode:'read',revealed:new Set()};
let fhEntries=[],fhKeywords=[],famRegistry=createRegistry([],[]),famTargets=[],famReview=false;
ui.familiarity={};
function familiarityOptions(){const {parts,params}=route();const key=[parts[0]||'today',parts[0]==='feihua'?parts[1]||'index':'',parts[0]==='favorites'?ui.favoriteKind:'',parts[0]==='my-recitation'?params.get('kind')||'poem':''].join('/');return ui.familiarity[key]??={filters:[],sort:'default',batch:false,selected:[]};}
function openFamiliarity(keys,review=false){famTargets=[...new Set(keys)].map(key=>famRegistry.byKey.get(key)).filter(Boolean);famReview=review;if(!famTargets.length)return;showSheet('設定背誦熟悉度',fam.selector(famTargets,review),'familiarity');}
function filterAddress(){const {parts,params}=route();params.delete('levels');history.replaceState(null,'','#/'+parts.map(encodeURIComponent).join('/')+(params.size?'?'+params.toString():''));}
function familiarityQuote(id){const q=quoteEntries(poems).find(q=>q.id===id);if(!q)return null;const all=[...famRegistry.byKey.values()].filter(r=>r.contentType==='quote');const index=all.findIndex(r=>r.key===famRegistry.resolve('quote',id));return {...q,lines:q.lines||[q.text],previous:q.previous||all[(index+all.length-1)%all.length].contentId,next:q.next||all[(index+1)%all.length].contentId};}

ui.fh={id:'',practice:false,stage:1,revealed:false,result:null,transcript:''};
const recognition=new RecitationRecognition(text=>{const q=fhCurrent();if(!q)return;ui.fh.transcript=text;ui.fh.result=compareRecitation(q.text,text);render(true);},active=>{const label=document.querySelector('#fh-mic-status');if(label)label.textContent=active?'正在聆聽，請背出這兩句。':'聆聽已結束，可核對內容或再試一次。';const b=document.querySelector('[data-act="fh-listen"]');if(b)b.textContent=active?'停止聆聽':'我來背';},toast);
function fhList(){const {parts,params}=route();return fam.filterItems(selectLines(fhEntries,fhKeywords,parts[1]||'',state,params.get('filter')||'all',new Date(),famRegistry),'quote');}
function fhCurrent(){return fhEntries.find(q=>q.id===ui.fh.id);}
function fhReset(id){recognition.cancel();speech.stop();ui.fh={id,practice:false,stage:1,revealed:false,result:null,transcript:''};}
let speechContext='';
const speech=new PoetrySpeech(updateSpeechUI,toast);
const channel=globalThis.BroadcastChannel?new BroadcastChannel('poetry-pocket-updates'):null;

function toast(message) {
  const element=document.querySelector('#toast');element.textContent=message;element.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('show'),5000);
}
function route() {
  const raw=(location.hash.slice(1)||'/my-recitation').split('?');
  return {parts:raw[0].split('/').filter(Boolean).map(x=>{try{return decodeURIComponent(x);}catch{return x;}}),params:new URLSearchParams(raw[1]||'')};
}
function applySettings() {document.body.dataset.theme=state.settings.theme;document.body.dataset.size=state.settings.size;}
function render(keepScroll=false) {
  const y=scrollY,{parts,params}=route(),page=parts[0]||'today';let content,tab=page;
  applySettings();
  const options=familiarityOptions();
  if(params.has('levels'))options.filters=params.get('levels').split(',').filter(x=>Object.hasOwn(LEVELS,x));
  fam.configureFamiliarity(state,famRegistry,options);
  const poem=poems.find(p=>p.id===parts[1]);
  switch(page) {
    case 'today': content=view.welcomeBanner()+fam.managerView('poem',ui.recitationQuery||'')+explorer.quickPicker(poems)+fhView.homeTile(fhEntries,fhKeywords,state)+view.todayView(poems,state,offline);break;
    case 'my-recitation':content=view.welcomeBanner()+fam.managerView(params.get('kind')==='quote'?'quote':'poem',ui.recitationQuery||'');tab='my-recitation';break;
    case 'feihua':{
      const char=parts[1],filter=params.get('filter')||'all';tab='study';
      if(!char){content=fhView.indexView(fhEntries,fhKeywords,state,filter);break;}
      if(!validKeyword(char)){content=view.empty('請輸入一個中文字','例如：月、花、秋。','/feihua');break;}
      const list=fhList(),id=params.get('line'),q=list.find(q=>q.id===id)||list[0];
      if(q&&ui.fh.id!==q.id)fhReset(q.id);if(!q)fhReset('');
      content=(!ui.fh.practice?`<details class="fam-detail-filter" ${options.batch||options.filters.length?'open':''}><summary>篩選與批次標記${options.filters.length?' · '+options.filters.map(x=>LEVELS[x].short).join('＋'):''}</summary>${fam.controls(list,'quote')}</details>`:'')+(q?fhView.cardView(q,char,state,ui.fh,list.indexOf(q),list.length,filter,recognition):view.empty('這個範圍暫時沒有名句','可調整熟悉度篩選，或回索引換一個字。','/feihua'));
      if(options.batch&&!ui.fh.practice)content+=`<section class="section"><h2>本字名句・批次標記</h2><div class="poem-list">${list.map(item=>`<article class="poem-row">${fam.quoteTools(item)}<p class="poem-text fam-excerpt">${e(item.text)}</p><p class="small muted">${e(item.poem.author)} · ${e(item.poem.title)}</p></article>`).join('')}</div></section>`;break;
    }
    case 'catalogue':if(params.has('type'))ui.catalogue.type=params.get('type');content=explorer.catalogueView(poems,state,ui.catalogue);tab='library';break;
    case 'couplet':{const q=familiarityQuote(parts[1]);if(q&&ui.pair.id!==q.id)ui.pair={id:q.id,mode:'read',revealed:new Set()};content=q?explorer.pairPracticeView(q,state,ui.pair):view.empty('找不到這組名句','請回名句選重新選擇。','/quotes');tab='quotes';break;}
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
  mountWelcomeCarousel(app);
  if(keepScroll)window.scrollTo(0,y);
  updateSpeechUI();
}
function updateSpeechUI() {
  if(!poems.length)return;
  const isPoem=speechContext==='poem';
  syncReadingLines(app,speech,(isPoem||speechContext==='pair'||speechContext==='feihua')&&!dialog.open,matchMedia('(prefers-reduced-motion: reduce)').matches);
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
  recognition.cancel();speech.stop();modal=type;
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
  showSheet('確認匯入備份',`<p>這份備份有 <strong>${Object.values(imported.progress).filter(p=>p.reviewCount).length}</strong> 首學習紀錄、<strong>${Object.keys(imported.lineProgress).length}</strong> 組飛花令進度、<strong>${imported.events.length}</strong> 次複習，以及 <strong>${Object.keys(imported.familiarity.records).length}</strong> 項熟悉度標記。</p><p class="note section">匯入會取代這台裝置目前的學習紀錄與閱讀設定。建議先匯出現有備份。</p><div class="row wrap section">${view.button('先匯出目前資料','export')}${view.button('確認取代並匯入','confirm-import','','button primary')}</div>`,'import');
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-act]');if(!button)return;
  const act=button.dataset.act;
  try{
    switch(act){
      case 'fam-open':openFamiliarity([button.dataset.key]);break;
      case 'fam-review':openFamiliarity([famRegistry.resolve(button.dataset.type,button.dataset.id)],true);break;
      case 'fam-batch-set':openFamiliarity(familiarityOptions().selected);break;
      case 'fam-order':if(Object.hasOwn(SORTS,button.dataset.value)){familiarityOptions().sort=button.dataset.value;render(true);}break;
      case 'fam-set':{const targets=[...famTargets],review=famReview,value=button.dataset.value;if(!targets.length)break;dialog.querySelectorAll('[data-act=fam-set]').forEach(b=>b.disabled=true);if(await commit(s=>setFamiliarity(s,targets,value,new Date(),review),{rerender:false,message:targets.length===1?'熟悉度已儲存':`已更新 ${targets.length} 項熟悉度` })){familiarityOptions().selected=[];render(true);dialog.close();}else dialog.querySelectorAll('[data-act=fam-set]').forEach(b=>b.disabled=false);break;}
      case 'fam-batch':{const o=familiarityOptions();o.batch=!o.batch;o.selected=[];render(true);break;}
      case 'fam-all':familiarityOptions().selected=[...fam.currentFamiliarityUI().visible];render(true);break;
      case 'fam-none':familiarityOptions().selected=[];render(true);break;
      case 'fam-filter':{const o=familiarityOptions(),value=button.dataset.value;o.filters=value==='all'?[]:o.filters.includes(value)?o.filters.filter(x=>x!==value):[...o.filters,value];o.selected=[];filterAddress();render(true);break;}
      case 'fam-unfamiliar':{const o=familiarityOptions();o.filters=['weak','shaky'];o.selected=[];filterAddress();render(true);break;}

      case 'fh-character':{const q=fhEntries.find(q=>q.id===button.dataset.id);if(q){const d=readingFor(q,Number(button.dataset.index));showSheet('字詞小箋',`<div class="large-character">${e(d.character)}</div><p class="character-sound">${e(d.zhuyin)}</p><p>${e(d.meaning)}</p><p class="section">${e(d.explanation)}</p><p class="small muted section">${e(d.source||'pinyin-pro 3.29.4 字音參考；多音字請配合文意。')}</p>`,'character');}break;}
      case 'fh-move':{const list=fhList(),index=list.findIndex(q=>q.id===ui.fh.id),q=list[index+Number(button.dataset.offset)];if(q){fhReset(q.id);location.hash=fhView.fhURL(route().parts[1],route().params.get('filter')||'all',q.id);}break;}
      case 'fh-start':{const q=fhCurrent();if(q){recognition.cancel();speech.stop();familiarityOptions().batch=false;familiarityOptions().selected=[];ui.fh.practice=true;ui.fh.stage=1;ui.fh.revealed=false;await commit(s=>learnLine(s,q.id));}break;}
      case 'fh-exit':fhReset(ui.fh.id);render(true);break;
      case 'fh-stage':recognition.cancel();speech.stop();ui.fh.stage=Number(button.dataset.stage);ui.fh.revealed=false;ui.fh.result=null;ui.fh.transcript='';render(true);break;
      case 'fh-reveal':ui.fh.revealed=true;render(true);break;
      case 'fh-speak':{const q=fhCurrent();if(q){recognition.cancel();speechContext='feihua';speech.play(q.lines,state.settings.speed);}break;}
      case 'fh-listen':speech.stop();if(recognition.active)recognition.cancel();else{ui.fh.result=null;ui.fh.transcript='';render(true);recognition.start();}break;
      case 'fh-review':{const q=fhCurrent();if(q){recognition.cancel();speech.stop();button.disabled=true;await commit(s=>setFamiliarity(learnLine(s,q.id,button.dataset.value),[famRegistry.byKey.get(famRegistry.resolve('quote',q.id))],{forgot:'weak',familiar:'familiar',reset:'unlearned'}[button.dataset.value],new Date(),button.dataset.value!=='reset'),{message:button.dataset.value==='reset'?'已標為未學':'已更新下次複習時間'});}break;}

      case 'compare-toggle':{const id=button.dataset.id;if(ui.catalogue.selected.includes(id))ui.catalogue.selected=ui.catalogue.selected.filter(x=>x!==id);else if(ui.catalogue.selected.length<4)ui.catalogue.selected.push(id);else {toast('最多選四首比較，請先取消一首。');break;}render(true);break;}
      case 'compare-clear':ui.catalogue.selected=[];render(true);break;
      case 'pair-mode':speech.stop();ui.pair.mode=button.dataset.value;ui.pair.revealed.clear();render(true);break;
      case 'pair-reset':speech.stop();ui.pair.revealed.clear();render(true);break;
      case 'pair-reveal':ui.pair.revealed.add(Number(button.dataset.index));render(true);break;
      case 'pair-speak':{const q=familiarityQuote(button.dataset.id);if(q){speechContext='pair';speech.play(q.lines,state.settings.speed);}break;}

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
document.addEventListener('compositionend',event=>{if(['search-input','recitation-search','catalogue-search','pair-search'].includes(event.target.id))event.target.dispatchEvent(new Event('input',{bubbles:true}));});
document.addEventListener('input',event=>{
  if(event.isComposing)return;
  if(['recitation-search','catalogue-search','pair-search'].includes(event.target.id)){
    const id=event.target.id,pos=event.target.selectionStart;
    if(id==='recitation-search')ui.recitationQuery=event.target.value;else (id==='catalogue-search'?ui.catalogue:ui.pairs).query=event.target.value;familiarityOptions().selected=[];
    render(true);const input=document.getElementById(id);input.focus({preventScroll:true});if(pos!==null)input.setSelectionRange(pos,pos);return;
  }
  if(event.target.id!=='search-input')return;
  ui.query=event.target.value;
  const position=event.target.selectionStart;
  history.replaceState(null,'',navigateSearch());familiarityOptions().selected=[];render(true);
  const input=document.querySelector('#search-input');input.focus({preventScroll:true});if(position!==null)input.setSelectionRange(position,position);
});
document.addEventListener('click',event=>{if(event.target.closest('[data-fh-reveal]')){ui.fh.revealed=true;render(true);}});
document.addEventListener('keydown',event=>{if(event.target.matches('[data-fh-reveal]')&&['Enter',' '].includes(event.key)){event.preventDefault();ui.fh.revealed=true;render(true);}});
document.addEventListener('submit',event=>{
 if(event.target.id==='fh-search'){event.preventDefault();const char=new FormData(event.target).get('character').trim();if(!validKeyword(char)){toast('請輸入一個中文字，例如「秋」。');return;}location.hash=fhView.fhURL(char);return;}
 if(event.target.id==='fh-check'){event.preventDefault();const q=fhCurrent(),text=document.querySelector('#fh-transcript').value;if(!text.trim()){toast('請先輸入背誦內容。');return;}recognition.cancel();ui.fh.transcript=text;ui.fh.result=compareRecitation(q.text,text);render(true);return;}
if(['search-form','recitation-search-form'].includes(event.target.id)){event.preventDefault();const input=document.getElementById(event.target.id==='search-form'?'search-input':'recitation-search');input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById(input.id)?.blur();}});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target.hasAttribute('data-fam-sort')){if(Object.hasOwn(SORTS,target.value))familiarityOptions().sort=target.value;render(true);return;}
  if(target.dataset.famSelect){const o=familiarityOptions(),key=target.dataset.famSelect;if(!famRegistry.byKey.has(key))return;o.selected=target.checked?[...new Set([...o.selected,key])]:o.selected.filter(x=>x!==key);render(true);return;}

  if(target.id==='quick-poem'){if(poems.some(p=>p.id===target.value))location.hash='/read/'+target.value;return;}
  if(target.dataset.catalogue){familiarityOptions().selected=[];ui.catalogue[target.dataset.catalogue]=target.value;history.replaceState(null,'','#/catalogue');render(true);return;}
  if(target.dataset.pairs){familiarityOptions().selected=[];ui.pairs[target.dataset.pairs]=target.dataset.pairs==='saved'?target.value==='yes':target.value;render(true);return;}

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
dialog.addEventListener('close',()=>{speech.stop();modal='';pendingBackup=null;famTargets=[];famReview=false;});
window.addEventListener('hashchange',()=>{recognition.cancel();speech.stop();if(dialog.open)dialog.close();render();window.scrollTo(0,0);});
document.addEventListener('visibilitychange',async()=>{
  if(document.hidden){recognition.cancel();speech.stop();}else if(poems.length){try{const latest=await storage.read();if(latest)state=validateBackup(latest,poems);render(true);}catch(error){toast(error.message);}}
});
window.addEventListener('pagehide',()=>{recognition.cancel();speech.stop();});
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
    famRegistry=createRegistry(poems,quoteEntries(poems));fhEntries=lineEntries(poems);const keyResponse=await fetch('./data/feihua-keywords.json');if(!keyResponse.ok)throw Error('飛花令索引暫時無法載入');fhKeywords=validateKeywords(await keyResponse.json(),fhEntries);
    try{await storage.open();const saved=await storage.read();if(saved){state=validateBackup(saved,poems);if(saved.familiarity===undefined)state=await storage.update(current=>validateBackup(current||defaults(),poems),defaults());}}catch(error){storageError=error.message+' 目前可閱讀，儲存功能需要修復後再用。';}
    render();prepareOffline();
    if(!state.settings.onboarded&&!storageError)onboarding();
  }catch(error){app.innerHTML=`<main class="loading"><h1>詩集暫時無法開啟</h1><p>${e(error.message)}</p><p>首次使用需要連線，離線時請從主畫面已安裝的版本開啟。</p><a class="button primary section" href="./">重新開啟</a></main>`;}
}
boot();
