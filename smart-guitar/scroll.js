'use strict';
// Musical time is stored in quarter-note beats, independent of pixel density and BPM.
const playback={running:false,beat:0,last:0,raf:0,countLeft:0,started:false,manual:false,plan:null,positions:[]};
function timeLabel(seconds){const s=Math.floor(seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function refreshScroll(){
 playback.plan=ScoreCore.timeline(state.song.rows);playback.beat=Math.min(playback.beat,playback.plan.total);
 $('#readingMode').value=state.mode;$('#scrollBpm').value=state.scrollBpm;
 $('#scrollProgress').hidden=state.mode!=='continuous';
 for(const id of ['playScroll','restartScroll'])$('#'+id).disabled=state.mode!=='continuous';
 $('#beatSeek').max=playback.plan.total;
 requestAnimationFrame(()=>{measureScroll();if(state.mode==='continuous')positionScroll();updateTransport();});
}
function measureScroll(){
 if(state.mode!=='continuous')return;
 const area=$('#score'),rows=[...area.querySelectorAll('.score-row')];
 if(!rows.length)return;
 // Enough trailing space for the final lyric to reach the same reading position.
 area.style.setProperty('--tail-space',Math.max(0,area.clientHeight-rows.at(-1).getBoundingClientRect().height-40)+'px');
 const first=rows[0].getBoundingClientRect().top;
 playback.positions=rows.map(row=>row.getBoundingClientRect().top-first);
}
function positionScroll(){
 if(state.mode!=='continuous'||!playback.positions.length)return;
 const at=ScoreCore.locateBeat(playback.plan,playback.beat),start=playback.positions[at.index]||0;
 const end=playback.positions[at.index+1]??start;
 $('#score').scrollTop=start+(end-start)*at.fraction;
}
function updateTransport(){
 if(!playback.plan)return;
 $('#playScroll').textContent=playback.running?'Ⅱ 暫停':playback.beat>=playback.plan.total?'▶ 重播':playback.started?'▶ 繼續':'▶ 開始';
 $('#playScroll').setAttribute('aria-pressed',String(playback.running));
 $('#beatSeek').value=playback.beat;
 const seconds=60/state.scrollBpm;
 $('#scrollClock').textContent=playback.countLeft>0?`準備 ${Math.ceil(playback.countLeft)} 拍`:`${timeLabel(playback.beat*seconds)} / ${timeLabel(playback.plan.total*seconds)} · ${playback.beat>=playback.plan.total?'已結束':playback.running?'捲動中':'已暫停'}`;
}
function tickScroll(now){
 if(!playback.running)return;
 let beats=Math.max(0,(now-playback.last)/1000)*state.scrollBpm/60;playback.last=now;
 if(playback.countLeft>0){const consumed=Math.min(beats,playback.countLeft);playback.countLeft-=consumed;beats-=consumed;}
 playback.beat=Math.min(playback.plan.total,playback.beat+beats);
 positionScroll();updateTransport();
 if(playback.beat>=playback.plan.total){pauseScroll();return;}
 playback.raf=requestAnimationFrame(tickScroll);
}
function pauseScroll(){
 playback.running=false;cancelAnimationFrame(playback.raf);playback.last=0;updateTransport();
}
function startScroll(){
 if(state.mode!=='continuous')return;
 if(playback.beat>=playback.plan.total){playback.beat=0;playback.started=false;}
 if(!playback.started){playback.countLeft=state.countIn;playback.started=true;}
 playback.manual=false;measureScroll();positionScroll();playback.running=true;playback.last=performance.now();updateTransport();playback.raf=requestAnimationFrame(tickScroll);
}
function resetScroll(){pauseScroll();playback.beat=0;playback.countLeft=0;playback.started=false;playback.manual=false;positionScroll();updateTransport();}
$('#playScroll').onclick=()=>playback.running?pauseScroll():startScroll();
$('#restartScroll').onclick=resetScroll;
$('#readingMode').onchange=e=>{pauseScroll();state.mode=e.target.value;if(state.mode==='pages')state.page=Math.floor(ScoreCore.locateBeat(playback.plan,playback.beat).index/state.rows);render();save();};
$('#scrollBpm').onchange=e=>{
 const n=Number(e.target.value);if(!Number.isFinite(n)||n<20||n>300){toast('BPM 請輸入 20～300。');e.target.value=state.scrollBpm;return;}
 // Account for the old tempo up to this instant before changing speed.
 if(playback.running){cancelAnimationFrame(playback.raf);tickScroll(performance.now());}
 state.scrollBpm=n;save();updateTransport();
};
$('#beatSeek').oninput=e=>{const targetBeat=Number(e.target.value);pauseScroll();playback.beat=targetBeat;playback.countLeft=0;playback.started=playback.beat>0;playback.manual=false;positionScroll();updateTransport();};
const scoreArea=$('#score');
function beginManual(){if(state.mode!=='continuous')return;pauseScroll();playback.countLeft=0;playback.manual=true;}
scoreArea.addEventListener('wheel',beginManual,{passive:true});
scoreArea.addEventListener('touchstart',beginManual,{passive:true});
scoreArea.addEventListener('pointerdown',e=>{if(e.target===scoreArea)beginManual();});
scoreArea.addEventListener('scroll',()=>{
 if(!playback.manual||playback.running||state.mode!=='continuous')return;
 const y=scoreArea.scrollTop,points=playback.positions;
 let index=points.findIndex((p,i)=>i<points.length-1&&y>=p&&y<points[i+1]);
 if(index<0)index=y<=0?0:points.length-1;
 if(index<0)return;
 const span=playback.plan.spans[index],distance=(points[index+1]??points[index])-points[index];
 playback.beat=span.start+(distance>0?Math.max(0,Math.min(1,(y-points[index])/distance))*span.beats:0);
 playback.started=playback.beat>0;updateTransport();
},{passive:true});
document.addEventListener('keydown',e=>{
 if($('#dialog').open||/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||state.mode!=='continuous')return;
 if(e.code==='Space'){e.preventDefault();playback.running?pauseScroll():startScroll();}
 if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))beginManual();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playback.running)pauseScroll();});
window.addEventListener('resize',()=>{if(state.mode==='continuous'){measureScroll();positionScroll();}});
$('#timingSettings').onclick=()=>{
 const b=modal('自動捲譜 · 速度與拍數');
 field(b,'從哪一行開始',select(state.song.rows.map((r,i)=>[i,(i+1)+' · '+(parse(r.text).map(t=>t.text).join('')||r.section)]),ScoreCore.locateBeat(playback.plan,playback.beat).index,v=>{playback.beat=playback.plan.spans[+v].start;playback.countLeft=0;playback.started=playback.beat>0;playback.manual=false;positionScroll();updateTransport();}));
 b.append(create('p','BPM 是每分鐘的四分音符拍數。4/4 每小節 4 拍；一行秒數＝拍數 × 60 ÷ BPM。此曲先依原譜小節數安排，弱起、句尾延長與個人速度可逐行微調。74 BPM 是練習起始值，不是原曲標定速度。','hint'));
 const presets=create('div',undefined,'page-options');for(const n of [64,74,84,94]){const btn=create('button',n+' BPM');btn.onclick=()=>{state.scrollBpm=n;$('#scrollBpm').value=n;save();updateTransport();toast('練習速度：'+n+' BPM');};presets.append(btn);}b.append(presets);
 field(b,'開始前預備拍',select([[0,'不預備'],[4,'4 拍'],[8,'8 拍']],state.countIn,v=>{state.countIn=+v;save();}));
 b.append(create('p','前奏 16 拍；其餘樂句按 4 或 8 拍分配。手動上下捲動會暫停，移到需要的位置後按「繼續」。切到背景也會暫停。','hint'));
 const entries=[];
 state.song.rows.forEach((r,i)=>{
  const input=create('input');input.type='number';input.min='0.25';input.max='128';input.step='0.25';input.value=r.beats;input.setAttribute('aria-label',`第 ${i+1} 行拍數`);
  const text=parse(r.text).map(t=>t.text).join('')||r.section||'器樂';field(b,text,input);entries.push(input);
 });
 const holder=create('div',undefined,'sticky-save'),btn=create('button','儲存拍數','primary');btn.onclick=()=>{
  try{const candidate={...state.song,rows:state.song.rows.map((r,i)=>({...r,beats:Number(entries[i].value)}))};validate(candidate);state.song=candidate;resetScroll();render();save();$('#dialog').close();toast(storageError?'拍數已套用，請匯出備份。':'拍數已儲存，從開頭準備。');}catch(e){toast(e.message);}
 };holder.append(btn);b.append(holder);
};
refreshScroll();
