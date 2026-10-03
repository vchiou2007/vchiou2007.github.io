'use strict';
const {chords,parse,validate}=ScoreCore;
const SEED={version:1,title:'月亮代表我的心',artist:'鄧麗君',capo:null,bpm:null,rows:[
 ['前奏','[C]_[Am]_[F]_[G]_','第 1 頁第一譜列；器樂旋律未轉錄'],
 ['主歌 · 第一遍','你[C]問我愛你[Em]有多深','第 1 頁第一至二譜列；「你」為弱起'],
 ['','我[F]愛你有幾[C]分','第 1 頁第二譜列'],
 ['','我的[Am]情也真','第 1 頁第二譜列'],
 ['','我的[F]愛也真','第 1 頁第二譜列'],
 ['','月亮[Dm]代表我的[G]心','第 1 頁第三譜列，第一結尾'],
 ['主歌 · 第二遍','你[C]問我愛你[Em]有多深','展開反覆；第 1 頁第二行歌詞'],
 ['','我[F]愛你有幾[C]分','展開反覆'],
 ['','我的[Am]情不移','第 1 頁第二行歌詞'],
 ['','我的[F]愛不變','第 1 頁第二行歌詞'],
 ['主歌 · 第二結尾','月亮[Dm]代[G]表我的[C]心','第 1 頁第三譜列第二結尾；G 對位待校對'],
 ['副歌','輕[C]輕的一個[Em]吻','第 1 頁第三至四譜列'],
 ['','已經[F]打動我的[C]心','第 1 頁第四譜列'],
 ['','深[C]深的一段[Em]情','第 1 頁第四譜列'],
 ['','叫我[F]思念到如[G]今','第 1 頁接第 2 頁第一譜列'],
 ['主歌 · 最後一遍','你[C]問我愛你[Em]有多深','第 2 頁第一譜列'],
 ['','我[F]愛你有幾[C]分','第 2 頁第一至二譜列'],
 ['','你去[Am]想一想','第 2 頁第二譜列'],
 ['','你去[F]看一看','第 2 頁第二譜列'],
 ['結尾','月亮[Dm]代[G]表我的[C]心','第 2 頁第二譜列；G 對位待校對，結束於 C']
].map(([section,text,source])=>({section,text,source}))};
const KEY='smart-guitar-mvp-v1';let state={song:structuredClone(SEED),page:0,rows:10,size:28,favorite:false};
let storageError=false;try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){validate(saved.song);state={...state,...saved};state.rows=[8,10].includes(state.rows)?state.rows:10;state.size=[24,28,32].includes(state.size)?state.size:28;state.page=Number.isInteger(state.page)?state.page:0;}}catch(e){storageError=true;}
const SONG_BEATS=[16,8,8,4,4,8,8,8,4,4,8,8,8,8,8,8,8,4,4,8];
function fillTiming(song){song.rows.forEach((r,i)=>{if(r.beats===undefined)r.beats=song.title===SEED.title&&song.rows.length===SEED.rows.length&&r.text===SEED.rows[i].text?SONG_BEATS[i]:8;});}
fillTiming(state.song);
state.mode=state.mode==='pages'?'pages':'continuous';
state.scrollBpm=Number.isFinite(state.scrollBpm)&&state.scrollBpm>=20&&state.scrollBpm<=300?state.scrollBpm:(state.song.bpm??74);
state.countIn=[0,4,8].includes(state.countIn)?state.countIn:4;
const $=s=>document.querySelector(s);const create=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageError=false;}catch(e){storageError=true;toast('瀏覽器無法儲存，請從歌曲工具匯出備份。');}status();}
function status(){$('#saveStatus').textContent=storageError?'尚未儲存 · 請匯出備份':'換和弦提示 · 非逐拍節奏譜';}
function render(){
 const pages=Math.ceil(state.song.rows.length/state.rows);state.page=Math.max(0,Math.min(state.page,pages-1));
 $('#title').textContent=state.song.title;$('#artist').textContent=state.song.artist;document.title=state.song.title+' · 智慧吉他譜';$('#capo').textContent='Capo '+(state.song.capo??'待確認');$('#bpm').textContent='BPM '+(state.song.bpm??'待確認');
 $('#favorite').textContent=state.favorite?'♥':'♡';$('#favorite').style.color=state.favorite?'#ee45ba':'';$('#favorite').setAttribute('aria-pressed',String(state.favorite));
 document.documentElement.style.setProperty('--font',state.size+'px');document.documentElement.style.setProperty('--box',(state.size+15)+'px');$('#score').style.setProperty('--rows',state.rows);
 const score=$('#score');score.replaceChildren();
 document.body.classList.toggle('continuous',state.mode==='continuous');
 if(state.mode==='continuous')window.scrollTo(0,0);
 const visible=state.mode==='continuous'?state.song.rows:state.song.rows.slice(state.page*state.rows,(state.page+1)*state.rows);
 for(const row of visible){
  const el=create('div',undefined,'score-row'+(row.text.includes('_')?' instrumental':''));
  if(row.section)el.append(create('span',row.section,'section-label'));
  const content=create('div',undefined,'row-content');
  for(const token of parse(row.text)){
   const unit=create('span',token.text,'lyric'+(token.chord?' mark':''));
   if(token.chord){const info=chords.find(c=>c[0]===token.chord);unit.style.setProperty('--color',info?info[2]:'#c6cbd2');const label=create('span',undefined,'chord-label');label.append(create('b',info?info[1]:'?'),create('small',token.chord));unit.append(label);unit.title=info?'按鍵 '+info[1]+' · '+token.chord:token.chord+'：尚未設定按鍵';}
   content.append(unit);
  }el.append(content);score.append(el);
 }
 if(state.mode!=='continuous')for(let i=visible.length;i<state.rows;i++)score.append(create('div',undefined,'score-row empty'));
 $('#page').textContent=`第 ${state.page+1} / ${pages} 頁`;$('#prev').disabled=state.page===0;$('#next').disabled=state.page===pages-1;$('#sectionStatus').textContent=state.mode==='continuous'?`全曲連續 · ${state.song.rows.length} 行`:`每頁 ${state.rows} 行 · ${state.song.rows.length} 行完整展開`;status();
 if(typeof refreshScroll==='function')refreshScroll();
}
for(const [chord,n,color] of chords){const el=create('div',undefined,'legend-item');el.style.setProperty('--color',color);el.append(create('b',n),create('small',chord),create('i'));$('#legend').append(el);}
function turn(delta){if(state.mode==='continuous')return;state.page+=delta;render();save();window.scrollTo({top:0,behavior:'instant'});}
$('#prev').onclick=()=>turn(-1);$('#next').onclick=()=>turn(1);$('#favorite').onclick=()=>{state.favorite=!state.favorite;render();save();};
document.addEventListener('keydown',e=>{if($('#dialog').open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(e.key==='ArrowRight'){e.preventDefault();turn(1);}if(e.key==='ArrowLeft'){e.preventDefault();turn(-1);}});
let touch=null;$('#score').addEventListener('touchstart',e=>{touch={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};},{passive:true});$('#score').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*1.5)turn(dx<0?1:-1);touch=null;},{passive:true});
function modal(title){if(typeof pauseScroll==='function')pauseScroll();$('#dialogTitle').textContent=title;$('#dialogBody').replaceChildren();if(!$('#dialog').open)$('#dialog').showModal();return $('#dialogBody');}
$('#close').onclick=()=>$('#dialog').close();$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function field(parent,label,control){const line=create('label',undefined,'field');line.append(create('span',label),control);parent.append(line);}
function select(options,value,fn){const s=create('select');for(const [v,label]of options){const o=create('option',label);o.value=v;s.append(o);}s.value=value;s.onchange=()=>fn(s.value);return s;}
$('#settings').onclick=()=>{const b=modal('閱讀設定');field(b,'每頁行數',select([[10,'10 行 · 精簡'],[8,'8 行 · 寬鬆']],state.rows,v=>{const anchor=state.page*state.rows;state.rows=+v;state.page=Math.floor(anchor/state.rows);render();save();}));field(b,'歌詞大小',select([[24,'小'],[28,'標準'],[32,'大']],state.size,v=>{state.size=+v;render();save();}));b.append(create('p','黑底與七色按鍵固定不變。小螢幕可上下捲動；左右滑動可翻頁。','hint'));};
$('#page').onclick=()=>{const b=modal('前往頁面'),list=create('div',undefined,'page-options');for(let i=0;i<Math.ceil(state.song.rows.length/state.rows);i++){const btn=create('button','第 '+(i+1)+' 頁');btn.onclick=()=>{state.page=i;render();save();$('#dialog').close();window.scrollTo(0,0);};list.append(btn);}b.append(list);};
$('#source').onclick=()=>{const b=modal('原始樂譜 · 鄧麗君版本');b.append(create('p','依你提供的兩頁整理，使用 C 調指法。來源下方提到的 Capo 4 是另一演示版本，本譜未直接套用。此 MVP 顯示換和弦提示，未重現完整指法、旋律與逐拍節奏；第二結尾及結尾的 G 對位可在校對編輯器修正。','hint'));for(let i=1;i<=2;i++){b.append(create('h3','來源第 '+i+' 頁'));const img=create('img',undefined,'source-img');img.src='references/score-'+i+'.png';img.alt='月亮代表我的心原譜第 '+i+' 頁';b.append(img);}};
function tool(b,label,fn){const btn=create('button',label,'tool');btn.onclick=fn;b.append(btn);}
$('#more').onclick=()=>{const b=modal('歌曲工具');tool(b,'✎  校對歌詞與和弦',edit);tool(b,'↓  匯出歌曲備份',exportSong);tool(b,'↑  匯入歌曲備份',()=>$('#file').click());b.append(create('p','目前是單曲 MVP，支援校對、翻頁與本機保存。檔案備份可帶到另一個瀏覽器；沒有自動雲端同步。','hint'));};
function edit(){const b=modal('校對歌詞與和弦');b.append(create('p','在換和弦的字前加上 [C]、[Dm] 等標記，例如：你[C]問我愛你[Em]有多深。空方塊使用 [C]_。這是換和弦位置，不代表每次撥弦。','hint'));const title=create('input');title.value=state.song.title;field(b,'歌名',title);const artist=create('input');artist.value=state.song.artist;field(b,'歌手',artist);const bpm=create('input');bpm.type='number';bpm.min=20;bpm.max=300;bpm.placeholder='待確認';bpm.value=state.song.bpm??'';field(b,'BPM',bpm);const capo=create('input');capo.type='number';capo.min=0;capo.max=12;capo.placeholder='待確認';capo.value=state.song.capo??'';field(b,'Capo',capo);
 const fields=[];state.song.rows.forEach((row,i)=>{const wrap=create('div',undefined,'edit-row');wrap.append(create('small',`第 ${i+1} 行 · ${row.source}`,'hint'));const s=create('input');s.value=row.section;s.placeholder='段落名稱（可留白）';s.setAttribute('aria-label','第 '+(i+1)+' 行段落');const t=create('textarea');t.value=row.text;t.setAttribute('aria-label','第 '+(i+1)+' 行歌詞和弦');wrap.append(s,t);b.append(wrap);fields.push({s,t,source:row.source,beats:row.beats});});const bottom=create('div',undefined,'sticky-save'),btn=create('button','儲存校對結果','primary');btn.onclick=()=>{const candidate={...state.song,title:title.value.trim(),artist:artist.value.trim(),bpm:bpm.value===''?null:Number(bpm.value),capo:capo.value===''?null:Number(capo.value),rows:fields.map(x=>({section:x.s.value,text:x.t.value,source:x.source,beats:x.beats}))};try{validate(candidate);state.song=candidate;render();save();if(!storageError)toast('已儲存校對結果');$('#dialog').close();}catch(e){toast(e.message);}};bottom.append(btn);b.append(bottom);
}
function exportSong(){const blob=new Blob([JSON.stringify(state.song,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download='月亮代表我的心-校對備份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出歌曲資料；原圖保留於應用程式資料夾。');}
$('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('備份檔不可超過 1 MB。');const song=validate(JSON.parse(await file.text()));if(!confirm('以匯入資料取代目前歌曲？建議先匯出目前版本。'))return;fillTiming(song);state.song=song;state.page=0;resetScroll();render();save();if(!storageError)toast('匯入完成');$('#dialog').close();}catch(err){toast('匯入失敗：'+err.message);}finally{e.target.value='';}};
render();if(storageError)toast('先前資料無法讀取或儲存不可用，目前顯示初始歌曲。');
