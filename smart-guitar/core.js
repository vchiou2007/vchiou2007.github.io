(function(root){
 'use strict';
 const chords=[['C','1','#20df83'],['Dm','2','#427bff'],['Em','3','#ff8168'],['F','4','#c25af5'],['G','5','#19cee5'],['Am','6','#f4e952'],['Bm','7','#ee45ba']];
 function parse(text){
  const result=[];let pending=null;
  for(const part of text.split(/(\[[^\]]+\])/g)){
   if(/^\[[^\]]+\]$/.test(part)){if(pending)result.push({text:'',chord:pending});pending=part.slice(1,-1);}
   else for(const char of Array.from(part)){result.push({text:char==='_'?'':char,chord:pending});pending=null;}
  }
  if(pending)result.push({text:'',chord:pending});return result;
 }
 function validate(song){
  if(!song||song.version!==1||typeof song.title!=='string'||!song.title.trim()||song.title.length>100||typeof song.artist!=='string'||song.artist.length>100||!Array.isArray(song.rows)||song.rows.length<1||song.rows.length>300)throw Error('歌曲格式不正確，或行數超出 1～300 行。');
  for(const r of song.rows){if(typeof r.text!=='string'||r.text.length>300||typeof r.section!=='string'||r.section.length>40||typeof r.source!=='string'||r.source.length>200)throw Error('譜行資料不正確。');if(r.beats!==undefined&&(!Number.isFinite(r.beats)||r.beats<0.25||r.beats>128))throw Error('每行拍數須為 0.25～128。');}
  if(![null,...Array.from({length:13},(_,i)=>i)].includes(song.capo)||!(song.bpm===null||(Number.isFinite(song.bpm)&&song.bpm>=20&&song.bpm<=300)))throw Error('速度或 Capo 超出範圍。');
  return song;
 }
 function timeline(rows){let total=0;const spans=rows.map(r=>{const beats=r.beats??8;const span={start:total,end:total+beats,beats};total+=beats;return span;});return {spans,total};}
 function locateBeat(plan,beat){const b=Math.max(0,Math.min(beat,plan.total));let index=plan.spans.findIndex(s=>b<s.end);if(index<0)index=plan.spans.length-1;const span=plan.spans[index];return {index,fraction:span?Math.max(0,Math.min(1,(b-span.start)/span.beats)):0};}
 function advanceBeat(beat,seconds,bpm,total){return Math.min(total,Math.max(0,beat)+Math.max(0,seconds)*bpm/60);}
 const api={chords,parse,validate,timeline,locateBeat,advanceBeat};if(typeof module!=='undefined')module.exports=api;else root.ScoreCore=api;
})(globalThis);
